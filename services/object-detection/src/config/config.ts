import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration object
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3003,
    env: process.env.NODE_ENV || 'development',
  },
  
  // RabbitMQ configuration
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    frameExchange: 'video.frames',
    eventExchange: 'video.events',
    detectionExchange: 'detection.events',
  },
  
  // TensorFlow configuration
  tensorflow: {
    modelPath: process.env.MODEL_PATH || './models/coco-ssd',
    modelType: process.env.MODEL_TYPE || 'coco-ssd', // coco-ssd, mobilenet, etc.
    useGPU: process.env.USE_GPU === 'true',
    workerThreads: parseInt(process.env.WORKER_THREADS || '2', 10),
  },
  
  // Detection configuration
  detection: {
    minConfidence: parseFloat(process.env.MIN_CONFIDENCE || '0.6'),
    detectionInterval: parseInt(process.env.DETECTION_INTERVAL || '1000', 10), // ms
    classes: (process.env.DETECTION_CLASSES || 'person,car,truck,bicycle,motorcycle,dog,cat').split(','),
    motionSensitivity: parseInt(process.env.MOTION_SENSITIVITY || '5', 10), // 1-10
    regionOfInterest: process.env.REGION_OF_INTEREST ? 
      JSON.parse(process.env.REGION_OF_INTEREST) : 
      { x: 0, y: 0, width: 1, height: 1 }, // Default is full frame
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