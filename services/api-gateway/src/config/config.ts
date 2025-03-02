import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration object
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 8000,
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
  },
  
  // Services
  services: {
    metadataEvents: {
      url: process.env.METADATA_EVENTS_SERVICE_URL || 'http://localhost:3004',
      timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000', 10),
    },
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
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;