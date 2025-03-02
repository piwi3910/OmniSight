import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/config';
import logger from './utils/logger';
import { initRabbitMQ, closeRabbitMQ } from './utils/rabbitmq';
import { initModel, cleanup } from './utils/detectionManager';
import detectionRoutes from './routes/detectionRoutes';

// Create Express app
const app = express();
const port = config.server.port;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'object-detection',
    version: '1.0.0',
    environment: config.server.env
  });
});

// API routes
app.use('/api/detection', detectionRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const startServer = async () => {
  try {
    // Initialize TensorFlow model
    await initModel();
    
    // Initialize RabbitMQ
    await initRabbitMQ();
    
    // Start server
    app.listen(port, () => {
      logger.info(`Object Detection Service running on port ${port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`Model: ${config.tensorflow.modelType}`);
      logger.info(`GPU Support: ${config.tensorflow.useGPU ? 'Enabled' : 'Disabled'}`);
      logger.info(`Worker Threads: ${config.tensorflow.workerThreads}`);
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
    // Clean up TensorFlow resources
    await cleanup();
    
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