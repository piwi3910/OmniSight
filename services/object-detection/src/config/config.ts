import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

/**
 * Object Detection Service configuration
 */
const config = {
  // Server configuration
  server: {
    port: process.env.OBJECT_DETECTION_PORT || 3004,
    host: process.env.OBJECT_DETECTION_HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  
  // Version information
  version: process.env.OBJECT_DETECTION_VERSION || '1.0.0',
  
  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    frameExchange: 'streams',
    eventExchange: 'events',
    detectionExchange: 'detection'
  },
  
  // Detection configuration
  detection: {
    // Model path relative to project root
    modelPath: process.env.DETECTION_MODEL_PATH || path.join(process.cwd(), 'models/coco-ssd/model.json'),
    
    // Minimum confidence threshold (0-1)
    minConfidence: parseFloat(process.env.DETECTION_MIN_CONFIDENCE || '0.5'),
    
    // Detection interval (in milliseconds)
    // How often to process frames from a stream
    detectionInterval: parseInt(process.env.DETECTION_INTERVAL || '1000'),
    
    // Classes to detect (empty array = all classes)
    classes: (process.env.DETECTION_CLASSES || '').split(',').filter(Boolean),
    
    // Motion sensitivity (0-1)
    motionSensitivity: parseFloat(process.env.DETECTION_MOTION_SENSITIVITY || '0.1'),
    
    // Region of interest (by default, entire frame)
    regionOfInterest: process.env.DETECTION_ROI ? JSON.parse(process.env.DETECTION_ROI) : null,
    
    // Number of workers (0 = auto-determine based on CPU cores)
    workers: parseInt(process.env.DETECTION_WORKERS || '0'),
    
    // Maximum queue size (0 = unlimited)
    maxQueueSize: parseInt(process.env.DETECTION_MAX_QUEUE_SIZE || '100'),
    
    // Whether to save detection thumbnails
    saveThumbnails: process.env.DETECTION_SAVE_THUMBNAILS !== 'false',
    
    // Path to save detection thumbnails
    thumbnailPath: process.env.DETECTION_THUMBNAIL_PATH || './data/thumbnails'
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
  },
  
  // Hardware acceleration configuration
  hardware: {
    // Enable/disable hardware acceleration
    accelerationEnabled: process.env.HARDWARE_ACCELERATION_ENABLED !== 'false',
    
    // Preferred platform (nvidia_cuda, nvidia_tensorrt, amd_rocm, intel_openvino, etc.)
    preferredPlatform: process.env.PREFERRED_ACCELERATION_PLATFORM || 'nvidia_tensorrt',
    
    // Platform for inference tasks
    inferencePlatform: process.env.INFERENCE_ACCELERATION_PLATFORM || 'nvidia_tensorrt',
    
    // Platform for image processing tasks
    imageProcessingPlatform: process.env.IMAGE_PROCESSING_ACCELERATION_PLATFORM || 'nvidia_cuda',
    
    // Balance between performance (1.0) and power efficiency (0.0)
    perfPowerBalance: parseFloat(process.env.ACCELERATION_PERF_POWER_BALANCE || '0.7')
  }
};

export default config;