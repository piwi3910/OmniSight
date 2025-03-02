import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 8000;
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OmniSight API',
      version: '1.0.0',
      description: 'OmniSight NVR System API Documentation',
    },
    servers: [
      {
        url: `http://localhost:${port}/api/v1`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'api-gateway',
    connections: io.engine.clientsCount
  });
});

// Authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    (req as any).user = user;
    next();
  });
};

// API routes
app.post('/api/v1/auth/login', (req, res) => {
  // Mock login for demonstration
  const { email, password } = req.body;
  
  // In a real implementation, we would verify against database
  if (email === 'admin@example.com' && password === 'password') {
    const user = { id: '1', email, role: 'admin' };
    const token = jwt.sign(user, process.env.JWT_SECRET || 'default_secret', { expiresIn: process.env.JWT_EXPIRATION || '1h' });
    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret', { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d' });
    
    res.json({ token, refreshToken, user });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Service proxies
// Stream Ingestion Service
app.use('/api/v1/streams', authenticateToken, createProxyMiddleware({
  target: process.env.STREAM_INGESTION_SERVICE_URL || 'http://stream-ingestion:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/streams': '/api/streams'
  },
  logLevel: 'warn'
}));

// Recording Service
app.use('/api/v1/recordings', authenticateToken, createProxyMiddleware({
  target: process.env.RECORDING_SERVICE_URL || 'http://recording:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/recordings': '/api/recordings'
  },
  logLevel: 'warn'
}));

// Object Detection Service
app.use('/api/v1/detection', authenticateToken, createProxyMiddleware({
  target: process.env.OBJECT_DETECTION_SERVICE_URL || 'http://object-detection:3003',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/detection': '/api/detection'
  },
  logLevel: 'warn'
}));

// Metadata & Events Service
app.use('/api/v1/events', authenticateToken, createProxyMiddleware({
  target: process.env.METADATA_EVENTS_SERVICE_URL || 'http://metadata-events:3004',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/events': '/api/events'
  },
  logLevel: 'warn'
}));

// WebSocket setup for proxying events
io.on('connection', (socket) => {
  logger.info(`Client connected to WebSocket: ${socket.id}`);
  
  // Authenticate WebSocket connection
  socket.on('authenticate', (data) => {
    try {
      const user = jwt.verify(data.token, process.env.JWT_SECRET || 'default_secret');
      logger.info(`WebSocket client authenticated: ${socket.id}`);
      socket.emit('authenticated', { success: true });
      
      // Now we can set up event forwarding from the metadata-events service
      // In a real implementation, we would connect to the metadata-events service WebSocket
      
    } catch (error) {
      logger.warn(`WebSocket authentication failed: ${socket.id}`);
      socket.emit('authenticated', { success: false, error: 'Invalid token' });
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
server.listen(port, () => {
  logger.info(`API Gateway running on port ${port}`);
  logger.info(`Swagger documentation available at http://localhost:${port}/api-docs`);
});

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
    process.exit(0);
  });
});

export default app;