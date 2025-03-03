import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration object
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3004,
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/omnisight',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'omnisight',
  },
  
  // Services
  services: {
    streamIngestion: {
      url: process.env.STREAM_INGESTION_SERVICE_URL || 'http://localhost:3001',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000', 10),
    },
    recording: {
      url: process.env.RECORDING_SERVICE_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000', 10),
    },
    objectDetection: {
      url: process.env.OBJECT_DETECTION_SERVICE_URL || 'http://localhost:3003',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000', 10),
    },
  },
  
  // Thumbnails path
  thumbnails: {
    path: process.env.THUMBNAILS_PATH || './thumbnails',
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  // Retention policy
  retention: {
    defaultDays: parseInt(process.env.DEFAULT_RETENTION_DAYS || '30', 10),
    checkInterval: parseInt(process.env.RETENTION_CHECK_INTERVAL || '86400000', 10), // 24 hours
  },
  
  // Notification settings
  notifications: {
    emailEnabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    smsEnabled: process.env.SMS_NOTIFICATIONS_ENABLED === 'true',
    pushEnabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/combined.log',
    errorFile: process.env.ERROR_LOG_FILE || './logs/error.log',
  },
};

export default config;