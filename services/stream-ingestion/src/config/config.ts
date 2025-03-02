import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration object
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3001,
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
  
  // Stream configuration
  stream: {
    dataPath: process.env.STREAM_DATA_PATH || './data',
    reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || '5000', 10),
    frameRate: parseInt(process.env.FRAME_RATE || '10', 10),
    width: parseInt(process.env.FRAME_WIDTH || '640', 10),
    height: parseInt(process.env.FRAME_HEIGHT || '480', 10),
  },
  
  // Recording service
  recordingService: {
    url: process.env.RECORDING_SERVICE_URL || 'http://localhost:3002',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;