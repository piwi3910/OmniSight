import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

/**
 * API Gateway configuration
 */
const config = {
  // Server configuration
  server: {
    port: process.env.API_GATEWAY_PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  
  // Version information
  version: process.env.API_GATEWAY_VERSION || '1.0.0',
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  
  // Service URLs
  services: {
    metadataEvents: {
      url: process.env.METADATA_EVENTS_URL || 'http://localhost:3001',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000')
    },
    streamIngestion: {
      url: process.env.STREAM_INGESTION_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000')
    },
    recording: {
      url: process.env.RECORDING_URL || 'http://localhost:3003',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000')
    },
    objectDetection: {
      url: process.env.OBJECT_DETECTION_URL || 'http://localhost:3004',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000')
    }
  },
  
  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchanges: {
      events: 'events',
      streams: 'streams',
      recordings: 'recordings',
      detection: 'detection',
      system: 'system'
    },
    queues: {
      apiGatewayEvents: 'api-gateway.events',
      apiGatewayNotifications: 'api-gateway.notifications'
    }
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/omnisight?schema=public'
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    logRequests: process.env.LOG_REQUESTS !== 'false'
  }
};

export default config;