import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';
import * as tf from '@tensorflow/tfjs-node';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 3003;
const detectionInterval = parseInt(process.env.DETECTION_INTERVAL || '1000', 10);
const minConfidence = parseFloat(process.env.MIN_CONFIDENCE || '0.6');

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

// Initialize TensorFlow model
let model: tf.GraphModel;

async function loadModel() {
  try {
    // In a real implementation, we would load a specific model
    // For now, we'll just log that we're ready to load a model
    logger.info('TensorFlow.js initialized and ready to load models');
    
    // Example of how to load a model (commented out for now)
    // model = await tf.loadGraphModel('file://./models/model.json');
    // logger.info('Model loaded successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to load model:', error);
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'object-detection',
    modelLoaded: !!model,
    detectionInterval,
    minConfidence
  });
});

// API routes
app.get('/api/detection/settings', (req, res) => {
  res.status(200).json({
    enabled: true,
    detectionInterval,
    minConfidence,
    objectTypes: [
      { type: 'person', enabled: true, minConfidence: 0.7 },
      { type: 'vehicle', enabled: true, minConfidence: 0.7 },
      { type: 'animal', enabled: false, minConfidence: 0.7 }
    ]
  });
});

app.put('/api/detection/settings', (req, res) => {
  res.status(200).json({ message: 'Update detection settings endpoint (to be implemented)' });
});

app.post('/api/detection/detect', (req, res) => {
  // This would normally process an image and return detections
  res.status(200).json({ 
    message: 'Object detection endpoint (to be implemented)',
    detections: []
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server and load model
async function startServer() {
  const modelLoaded = await loadModel();
  
  app.listen(port, () => {
    logger.info(`Object Detection Service running on port ${port}`);
    if (modelLoaded) {
      logger.info('Ready to process detection requests');
    } else {
      logger.warn('Service started but model failed to load');
    }
  });
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Clean up resources
  process.exit(0);
});

export default app;