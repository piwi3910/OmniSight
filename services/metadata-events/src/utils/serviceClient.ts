import { createServiceClient, ServiceCommunicationOptions } from '@omnisight/shared';
import config from '../config/config';
import logger from './logger';

/**
 * Service clients for communicating with other services
 * 
 * This module provides pre-configured service clients for each service,
 * using the shared communication library with circuit breakers and retries.
 */

// Create service configuration from environment/config
const serviceConfig: Record<string, ServiceCommunicationOptions> = {
  // Stream ingestion service
  streamIngestion: {
    baseUrl: config.services.streamIngestion.url,
    timeout: config.services.streamIngestion.timeout,
    headers: {
      'X-Service-Name': 'metadata-events'
    },
    logger
  },
  
  // Recording service
  recording: {
    baseUrl: config.services.recording.url,
    timeout: config.services.recording.timeout,
    headers: {
      'X-Service-Name': 'metadata-events'
    },
    logger
  },
  
  // Object detection service
  objectDetection: {
    baseUrl: config.services.objectDetection.url,
    timeout: config.services.objectDetection.timeout,
    headers: {
      'X-Service-Name': 'metadata-events'
    },
    logger
  }
};

// Create service clients
const serviceClients = {
  // Stream ingestion service client
  streamIngestion: createServiceClient(serviceConfig.streamIngestion, {
    failureThreshold: 3,
    resetTimeout: 10000
  }),
  
  // Recording service client
  recording: createServiceClient(serviceConfig.recording, {
    failureThreshold: 3,
    resetTimeout: 10000
  }),
  
  // Object detection service client
  objectDetection: createServiceClient(serviceConfig.objectDetection, {
    failureThreshold: 3,
    resetTimeout: 10000
  })
};

/**
 * Stream ingestion service API methods
 */
export const streamIngestionService = {
  /**
   * Get stream status
   * @param streamId Stream ID
   */
  async getStreamStatus(streamId: string) {
    return serviceClients.streamIngestion.get(`/api/streams/${streamId}/status`);
  },
  
  /**
   * Start a stream
   * @param cameraId Camera ID
   * @param options Stream options
   */
  async startStream(cameraId: string, options: any) {
    return serviceClients.streamIngestion.post(`/api/cameras/${cameraId}/stream/start`, options);
  },
  
  /**
   * Stop a stream
   * @param streamId Stream ID
   */
  async stopStream(streamId: string) {
    return serviceClients.streamIngestion.post(`/api/streams/${streamId}/stop`);
  }
};

/**
 * Recording service API methods
 */
export const recordingService = {
  /**
   * Get recording details
   * @param recordingId Recording ID
   */
  async getRecording(recordingId: string) {
    return serviceClients.recording.get(`/api/recordings/${recordingId}`);
  },
  
  /**
   * Get recording segments
   * @param recordingId Recording ID
   */
  async getRecordingSegments(recordingId: string) {
    return serviceClients.recording.get(`/api/recordings/${recordingId}/segments`);
  },
  
  /**
   * Start recording for a stream
   * @param streamId Stream ID
   * @param options Recording options
   */
  async startRecording(streamId: string, options: any) {
    return serviceClients.recording.post(`/api/streams/${streamId}/recording/start`, options);
  },
  
  /**
   * Stop recording
   * @param recordingId Recording ID
   */
  async stopRecording(recordingId: string) {
    return serviceClients.recording.post(`/api/recordings/${recordingId}/stop`);
  }
};

/**
 * Object detection service API methods
 */
export const objectDetectionService = {
  /**
   * Get detection status
   */
  async getStatus() {
    return serviceClients.objectDetection.get('/api/detection/status');
  },
  
  /**
   * Run detection on an image
   * @param imageData Base64 encoded image data
   * @param options Detection options
   */
  async detectObjects(imageData: string, options: any) {
    return serviceClients.objectDetection.post('/api/detection/detect', {
      image: imageData,
      ...options
    });
  },
  
  /**
   * Configure detection settings
   * @param settings Detection settings
   */
  async configureDetection(settings: any) {
    return serviceClients.objectDetection.post('/api/detection/configure', settings);
  }
};

// Export service clients
export default {
  streamIngestion: streamIngestionService,
  recording: recordingService,
  objectDetection: objectDetectionService
};