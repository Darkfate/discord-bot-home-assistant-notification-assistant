import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Database } from './database.js';
import { PersistentNotificationQueue } from './queue/persistentQueue.js';
import { NotificationScheduler } from './queue/scheduler.js';
import { WebhookServer } from './webhook.js';
import { CommandHandler } from './commands.js';
import { createHAClientFromEnv } from './homeAssistant/client.js';
import { AutomationTriggerQueue } from './homeAssistant/automationQueue.js';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '5000');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const DATABASE_PATH = process.env.DATABASE_PATH || './data/bot.db';
const SCHEDULER_INTERVAL = parseInt(process.env.QUEUE_SCHEDULER_INTERVAL || '30');

if (!TOKEN || !CHANNEL_ID) {
  console.error('Missing required environment variables: DISCORD_TOKEN and DISCORD_CHANNEL_ID');
  process.exit(1);
}

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Initialize database
const database = new Database(DATABASE_PATH);

// Initialize notification queue
let queue: PersistentNotificationQueue;

// Initialize scheduler
let scheduler: NotificationScheduler;

// Initialize command handler
let commandHandler: CommandHandler;

// Initialize Home Assistant integration (optional)
let haQueue: AutomationTriggerQueue | undefined;

// Event: Bot ready
client.on(Events.ClientReady, async () => {
  console.log(`✅ Bot logged in as ${client.user?.tag}`);

  // Register slash commands
  await commandHandler.registerGlobalCommands();

  // Start webhook server
  const webhook = new WebhookServer(queue, database, WEBHOOK_SECRET);
  webhook.start(WEBHOOK_PORT);

  console.log(`🚀 Bot is ready! Webhook listening on port ${WEBHOOK_PORT}`);
});

// Event: Interaction created
client.on(Events.InteractionCreate, async (interaction) => {
  await commandHandler.handleInteraction(interaction);
});

// Event: Bot encounters error
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

// Event: Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');

  // Stop the scheduler first
  if (scheduler) {
    scheduler.stop();
  }

  // Wait for queues to finish processing
  if (haQueue) {
    await haQueue.shutdown();
  }

  if (queue) {
    await queue.shutdown();
  }

  // Close Discord connection
  await client.destroy();

  // Close database connection
  await database.close();

  console.log('Shutdown complete');
  process.exit(0);
});

// Handle SIGTERM as well (for Docker)
process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');

  if (scheduler) {
    scheduler.stop();
  }

  if (haQueue) {
    await haQueue.shutdown();
  }

  if (queue) {
    await queue.shutdown();
  }

  await client.destroy();
  await database.close();

  console.log('Shutdown complete');
  process.exit(0);
});

async function main() {
  try {
    // Initialize database
    console.log('Initializing database...');
    await database.initialize();

    // Initialize persistent queue
    queue = new PersistentNotificationQueue(client, database, CHANNEL_ID!);
    await queue.initialize();

    // Initialize Home Assistant integration (optional)
    const haClient = createHAClientFromEnv();
    if (haClient) {
      console.log('Initializing Home Assistant integration...');

      // Test connection
      const connected = await haClient.validateConnection();
      if (connected) {
        console.log('✅ Home Assistant connection validated');

        // Initialize automation queue
        haQueue = new AutomationTriggerQueue(client, database, haClient, CHANNEL_ID!);
        await haQueue.initialize();
      } else {
        console.warn('⚠️  Failed to connect to Home Assistant - integration disabled');
      }
    }

    // Initialize scheduler (with optional HA queue)
    scheduler = new NotificationScheduler(queue, database, haQueue);
    scheduler.start(SCHEDULER_INTERVAL);

    // Initialize command handler (with optional HA integration)
    commandHandler = new CommandHandler(client, database, queue, haClient || undefined, haQueue);

    // Login to Discord
    console.log('Connecting to Discord...');
    await client.login(TOKEN!);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
