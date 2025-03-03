import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import routes from './routes/routes';
import config from './config/config';
import logger from './utils/logger';
import { initializeWebSocketServer } from './middleware/websocketProxy';
import { errorHandler } from '@omnisight/shared';
import { initializeHealthCheck, createServiceHealthMiddleware } from './utils/healthCheck';

// Create Express application
const app = express();

// Create HTTP server
const server = createServer(app);

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: config.server.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize Socket.IO for WebSocket proxy
initializeWebSocketServer(io);

// Middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: config.server.corsOrigin })); // CORS
app.use(express.json()); // JSON parsing
app.use(express.urlencoded({ extended: true })); // URL-encoded parsing

// Logging middleware
if (config.logging.logRequests) {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Health check routes
app.use(initializeHealthCheck());

// Service health middleware - checks if target service is healthy before proxying
app.use(createServiceHealthMiddleware());

// API routes
app.use('/api/v1', routes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource was not found'
    }
  });
});

// Start server
const PORT = config.server.port;
server.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT} in ${config.server.env} mode`);
  logger.info(`Health check endpoint available at http://localhost:${PORT}/health`);
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
  } else {
    logger.error('Server error:', error);
  }
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

export default server;