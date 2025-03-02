import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';
import fs from 'fs-extra';
import path from 'path';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 3002;
const recordingsPath = process.env.RECORDINGS_PATH || path.join(__dirname, '../recordings');

// Ensure recordings directory exists
fs.ensureDirSync(recordingsPath);

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'recording',
    recordingsPath,
    diskSpace: {
      // In a real implementation, we would check available disk space
      available: 'To be implemented'
    }
  });
});

// API routes
app.get('/api/recordings', (req, res) => {
  res.status(200).json({ message: 'Recordings list endpoint (to be implemented)' });
});

app.post('/api/recordings/start', (req, res) => {
  res.status(201).json({ message: 'Start recording endpoint (to be implemented)' });
});

app.post('/api/recordings/:id/stop', (req, res) => {
  res.status(200).json({ message: 'Stop recording endpoint (to be implemented)' });
});

app.get('/api/recordings/:id', (req, res) => {
  res.status(200).json({ message: 'Get recording details endpoint (to be implemented)' });
});

app.get('/api/recordings/:id/segments', (req, res) => {
  res.status(200).json({ message: 'Get recording segments endpoint (to be implemented)' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
  logger.info(`Recording Service running on port ${port}`);
  logger.info(`Recordings will be stored in: ${recordingsPath}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Close any active recordings, connections, etc.
  process.exit(0);
});

export default app;