import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.SANDBOX_PORT || '3000', 10);
const BOT_API_URL = process.env.BOT_API_URL || 'http://discord-bot:5000';

// Enable CORS for development
app.use(cors());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Proxy API requests to bot service
app.use(
  '/sandbox/api',
  createProxyMiddleware({
    target: BOT_API_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/sandbox/api': '', // Remove /sandbox/api prefix
    },
    onProxyReq: (proxyReq, req) => {
      console.log(`[Proxy] ${req.method} ${req.url} → ${BOT_API_URL}${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req) => {
      console.log(`[Proxy] ${req.method} ${req.url} ← ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`[Proxy Error] ${req.method} ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Proxy Error',
          message: 'Failed to connect to bot service',
          details: err.message,
        });
      }
    },
  })
);

// Serve static React build in production
const staticPath = path.join(__dirname, '../../frontend/dist');
console.log(`[Static] Serving frontend from: ${staticPath}`);

app.use('/sandbox', express.static(staticPath));

// SPA fallback (for client-side routing)
app.get('/sandbox/*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  console.log(`[SPA] Serving index.html for: ${req.url}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`[SPA Error] Failed to serve index.html:`, err.message);
      res.status(500).json({
        error: 'Failed to serve frontend',
        message: 'Frontend build not found. Run "npm run build" in frontend directory.',
      });
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sandbox',
    timestamp: new Date().toISOString(),
    botApiUrl: BOT_API_URL,
  });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/sandbox');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Discord Bot Sandbox Service                              ║
╠═══════════════════════════════════════════════════════════╣
║  Status: Running                                          ║
║  Port: ${PORT}                                            ║
║  URL: http://localhost:${PORT}/sandbox                    ║
║  Bot API: ${BOT_API_URL}                                  ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
