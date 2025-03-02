import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import config from './config/config';
import logger from './utils/logger';
import { initRabbitMQ, closeRabbitMQ } from './utils/rabbitmq';
import { stopAllStreams } from './utils/streamHandler';
import streamRoutes from './routes/streamRoutes';

// Create Express app
const app = express();
const port = config.server.port;

// Ensure data directory exists
const dataDir = config.stream.dataPath;
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  logger.info(`Created data directory: ${dataDir}`);
}

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'stream-ingestion',
    version: '1.0.0',
    environment: config.server.env
  });
});

// API routes
app.use('/api/streams', streamRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const startServer = async () => {
  try {
    // Initialize RabbitMQ
    await initRabbitMQ();
    
    // Start server
    app.listen(port, () => {
      logger.info(`Stream Ingestion Service running on port ${port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`Data directory: ${dataDir}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    // Stop all active streams
    await stopAllStreams();
    
    // Close RabbitMQ connection
    await closeRabbitMQ();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

export default app;