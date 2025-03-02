import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import http from 'http';
import config from './config/config';
import logger from './utils/logger';
import routes from './routes/routes';
import { websocketProxy } from './middleware/proxy';
import { setupSwagger } from './utils/swagger';

// Create Express app
const app = express();
const port = config.server.port;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: config.server.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'api-gateway',
    version: '1.0.0',
    environment: config.server.env
  });
});

// Setup Swagger
setupSwagger(app);

// API routes
app.use('/api/v1', routes);

// WebSocket proxy
if (websocketProxy.upgrade) {
  server.on('upgrade', websocketProxy.upgrade);
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
const startServer = async () => {
  try {
    server.listen(port, () => {
      logger.info(`API Gateway running on port ${port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`CORS Origin: ${config.server.corsOrigin}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10s
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Start the server
startServer();

export default app;