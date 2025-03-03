import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

/**
 * Stream Ingestion Service configuration
 */
const config = {
  // Server configuration
  server: {
    port: process.env.STREAM_INGESTION_PORT || 3002,
    host: process.env.STREAM_INGESTION_HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  
  // Version information
  version: process.env.STREAM_INGESTION_VERSION || '1.0.0',
  
  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    frameExchange: 'streams',
    eventExchange: 'events'
  },
  
  // Stream configuration
  stream: {
    dataPath: process.env.STREAM_DATA_PATH || './data',
    reconnectInterval: parseInt(process.env.STREAM_RECONNECT_INTERVAL || '5000'),
    maxReconnectAttempts: parseInt(process.env.STREAM_MAX_RECONNECT_ATTEMPTS || '3'),
    frameRate: parseInt(process.env.STREAM_FRAME_RATE || '15'),
    width: parseInt(process.env.STREAM_WIDTH || '640'),
    height: parseInt(process.env.STREAM_HEIGHT || '480')
  },
  
  // API configuration
  api: {
    metadataServiceUrl: process.env.METADATA_SERVICE_URL || 'http://localhost:3001',
    timeout: parseInt(process.env.API_TIMEOUT || '5000')
  },
  
  // Database configuration (for stream metadata)
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