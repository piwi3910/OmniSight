import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

/**
 * Recording Service configuration
 */
const config = {
  // Server configuration
  server: {
    port: process.env.RECORDING_PORT || 3003,
    host: process.env.RECORDING_HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  
  // Version information
  version: process.env.RECORDING_VERSION || '1.0.0',
  
  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    frameExchange: 'streams',
    eventExchange: 'recordings'
  },
  
  // Recording configuration
  recording: {
    storagePath: process.env.RECORDING_STORAGE_PATH || './storage/recordings',
    segmentDuration: parseInt(process.env.RECORDING_SEGMENT_DURATION || '600'), // 10 minutes by default
    format: process.env.RECORDING_FORMAT || 'mp4',
    codec: process.env.RECORDING_CODEC || 'h264',
    frameRate: parseInt(process.env.RECORDING_FRAME_RATE || '25'),
    resolution: process.env.RECORDING_RESOLUTION || '1280x720',
    thumbnailInterval: parseInt(process.env.RECORDING_THUMBNAIL_INTERVAL || '60'), // Generate thumbnail every 60 seconds
    retentionDays: parseInt(process.env.RECORDING_RETENTION_DAYS || '30') // Store recordings for 30 days by default
  },
  
  // API configuration
  api: {
    metadataServiceUrl: process.env.METADATA_SERVICE_URL || 'http://localhost:3001',
    timeout: parseInt(process.env.API_TIMEOUT || '5000')
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/omnisight?schema=public'
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  }
};

export default config;