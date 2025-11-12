import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Database } from './database.js';
import { NotificationQueue } from './queue.js';
import { WebhookServer } from './webhook.js';
import { CommandHandler } from './commands.js';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '5000');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const DATABASE_PATH = process.env.DATABASE_PATH || './data/bot.db';

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
let queue: NotificationQueue;

// Initialize command handler
let commandHandler: CommandHandler;

// Event: Bot ready
client.on(Events.ClientReady, async () => {
  console.log(`✅ Bot logged in as ${client.user?.tag}`);

  // Register slash commands
  await commandHandler.registerGlobalCommands();

  // Start webhook server
  const webhook = new WebhookServer(queue, WEBHOOK_SECRET);
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
  console.log('Shutting down gracefully...');
  await client.destroy();
  await database.close();
  process.exit(0);
});

async function main() {
  try {
    // Initialize database
    console.log('Initializing database...');
    await database.initialize();

    // Initialize queue
    queue = new NotificationQueue(client, database, CHANNEL_ID);

    // Initialize command handler
    commandHandler = new CommandHandler(client, database, queue);

    // Login to Discord
    console.log('Connecting to Discord...');
    await client.login(TOKEN);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
