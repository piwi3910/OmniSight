import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { errorHandler, createHealthCheckManager, commonDependencies } from '@omnisight/shared';
import config from './config/config';
import detectionRoutes from './routes/detectionRoutes';
import logger from './utils/logger';
import { initializeRabbitMQ, initializeWorkers } from './utils/detectionManager';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Initialize Express application
const app = express();
const server = createServer(app);

// Initialize Prisma client
const prisma = new PrismaClient();

// Ensure temporary directory exists
const tmpDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Ensure thumbnails directory exists
const thumbnailsDir = path.join(process.cwd(), config.detection.thumbnailPath);
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check
const healthCheck = createHealthCheckManager({
  serviceName: 'object-detection',
  version: config.version,
  dependencies: [
    // Database health check
    commonDependencies.createDatabaseCheck({
      name: 'database',
      critical: true,
      checkFn: async () => {
        await prisma.$queryRaw`SELECT 1`;
      }
    }),
    
    // RabbitMQ health check
    commonDependencies.createRabbitMQCheck({
      name: 'rabbitmq',
      critical: true,
      checkFn: async () => {
        // RabbitMQ initialization handles connection check
        await initializeRabbitMQ();
      }
    }),
    
    // Model health check
    {
      name: 'model',
      type: 'model',
      critical: true,
      check: async () => {
        try {
          // Check if model file exists
          const modelPath = config.detection.modelPath;
          const modelExists = fs.existsSync(modelPath);
          
          if (!modelExists) {
            return {
              status: 'error',
              details: {
                error: `Model file not found at ${modelPath}`
              }
            };
          }
          
          return {
            status: 'ok',
            details: {
              modelPath
            }
          };
        } catch (error) {
          return {
            status: 'error',
            details: {
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    }
  ]
});

// Add health check routes
app.use(healthCheck.getHealthCheckRouter());

// API routes
app.use('/api/detection', detectionRoutes);

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

async function startServer() {
  try {
    // Initialize RabbitMQ
    await initializeRabbitMQ();
    
    // Initialize worker threads
    initializeWorkers();
    
    // Start health check monitoring
    healthCheck.startMonitoring();
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Object Detection Service listening on port ${PORT} in ${config.server.env} mode`);
      logger.info(`Health check endpoint available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

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
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop health check monitoring
  healthCheck.stopMonitoring();
  
  try {
    // Close Prisma connection
    await prisma.$disconnect();
    logger.info('Database connections closed');
    
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Start the server
startServer();

export default server;