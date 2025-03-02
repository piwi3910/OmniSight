import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { prisma, testConnection } from './prisma/client';
import logger from './utils/logger';

// Import routes
import eventRoutes from './routes/eventRoutes';
import userRoutes from './routes/userRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 3004;
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Ensure thumbnails directory exists
const thumbnailsPath = process.env.THUMBNAILS_PATH || path.join(__dirname, '../thumbnails');
if (!fs.existsSync(thumbnailsPath)) {
  fs.mkdirSync(thumbnailsPath, { recursive: true });
}

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());

// Serve thumbnails
app.use('/thumbnails', express.static(thumbnailsPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'metadata-events',
    connections: io.engine.clientsCount
  });
});

// Sample route to test Prisma
app.get('/api/test-prisma', async (req, res) => {
  try {
    // Test a simple query
    const userCount = await prisma.user.count();
    const cameraCount = await prisma.camera.count();
    
    return res.status(200).json({
      message: 'Prisma is working correctly!',
      stats: {
        users: userCount,
        cameras: cameraCount
      }
    });
  } catch (error) {
    logger.error('Error testing Prisma:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

// API routes
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    logger.info('Database connection established');
    
    // Start server
    server.listen(port, () => {
      logger.info(`Metadata & Events Service (Prisma Edition) running on port ${port}`);
      logger.info(`Thumbnails will be stored in: ${thumbnailsPath}`);
      logger.info(`Visit http://localhost:${port}/api/test-prisma to test Prisma connection`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close WebSocket server
  io.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connection
    prisma.$disconnect().then(() => {
      logger.info('Database connection closed');
      process.exit(0);
    });
  });
});

// Start the server
startServer();

export default app;