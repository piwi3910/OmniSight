import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration object
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3002,
    env: process.env.NODE_ENV || 'development',
  },
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'omnisight',
  },
  
  // RabbitMQ configuration
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    frameExchange: 'video.frames',
    eventExchange: 'video.events',
  },
  
  // Recording configuration
  recording: {
    path: process.env.RECORDINGS_PATH || './recordings',
    segmentDuration: parseInt(process.env.SEGMENT_DURATION || '600', 10), // 10 minutes in seconds
    format: process.env.RECORDING_FORMAT || 'mp4',
    codec: process.env.RECORDING_CODEC || 'libx264',
    frameRate: parseInt(process.env.FRAME_RATE || '10', 10),
    resolution: process.env.RESOLUTION || '640x480',
    thumbnailInterval: parseInt(process.env.THUMBNAIL_INTERVAL || '60', 10), // Generate thumbnail every 60 seconds
  },
  
  // Storage configuration
  storage: {
    retentionDays: parseInt(process.env.RETENTION_DAYS || '30', 10),
    maxUsagePercent: parseInt(process.env.MAX_STORAGE_USAGE || '90', 10),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600', 10), // Check storage every hour
  },
  
  // Metadata service
  metadataService: {
    url: process.env.METADATA_EVENTS_SERVICE_URL || 'http://localhost:3004',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;