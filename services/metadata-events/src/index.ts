import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import path from 'path';
import fs from 'fs';
import sequelize, { testConnection } from './config/database';

// Import routes
import eventRoutes from './routes/eventRoutes';

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

// Configure logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

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

// API routes
app.use('/api/events', eventRoutes);

// WebSocket setup
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('subscribe', (data) => {
    logger.info(`Client ${socket.id} subscribed to: ${JSON.stringify(data)}`);
    if (data.channel === 'camera_events' && data.cameraId) {
      socket.join(`camera:${data.cameraId}`);
    }
  });
  
  socket.on('unsubscribe', (data) => {
    logger.info(`Client ${socket.id} unsubscribed from: ${JSON.stringify(data)}`);
    if (data.channel === 'camera_events' && data.cameraId) {
      socket.leave(`camera:${data.cameraId}`);
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

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
    
    // Sync database models (in development only)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database synced');
    }
    
    // Start server
    server.listen(port, () => {
      logger.info(`Metadata & Events Service running on port ${port}`);
      logger.info(`Thumbnails will be stored in: ${thumbnailsPath}`);
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
    sequelize.close().then(() => {
      logger.info('Database connection closed');
      process.exit(0);
    });
  });
});

// Start the server
startServer();

export default app;