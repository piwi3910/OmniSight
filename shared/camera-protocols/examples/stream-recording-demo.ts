/**
 * WebRTC Stream Recording and Ingestion Demo
 * 
 * This example demonstrates how to use the WebRTC stream recorder and ingestion
 * pipeline to create a complete streaming system with recording capabilities.
 */

import * as path from 'path';
import {
  createWebRTCSystem,
  WebRTCStreamState,
  WebRTCStreamEvent,
  EncryptionMode,
  NATTraversalStrategy,
  StreamIngestionPipeline,
  StreamSourceType,
  StreamOutputFormat,
  StreamIngestionConfig,
  StreamIngestionEvent,
  RecordingFormat,
  RecordingQuality,
  RecordingEvent
} from '../utils';

// Test camera details
const TEST_CAMERAS = [
  {
    name: 'Front Entrance',
    sourceUrl: 'rtsp://camera1.example.com/stream1',
    username: 'admin',
    password: 'password123'
  },
  {
    name: 'Back Entrance',
    sourceUrl: 'rtsp://camera2.example.com/stream1',
    username: 'admin',
    password: 'password123'
  }
];

/**
 * Full WebRTC streaming and recording demo
 */
async function runStreamingRecordingDemo() {
  console.log('Starting WebRTC Stream Recording Demo...');
  
  // Create the WebRTC system with all components
  const webrtcSystem = createWebRTCSystem({
    // WebSocket server configuration
    port: 8080,
    path: '/webrtc',
    
    // ICE server configuration
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:turn.example.com:3478',
        username: 'demo',
        credential: 'password'
      }
    ],
    
    // NAT traversal configuration
    natTraversal: {
      stunServers: ['stun:stun.l.google.com:19302'],
      turnServers: [{
        urls: 'turn:turn.example.com:3478',
        username: 'demo',
        credential: 'password'
      }],
      mode: 'all',
      gatheringTimeout: 5000,
      connectionTimeout: 10000,
      maxConnectionAttempts: 3
    },
    
    // End-to-end encryption configuration
    encryption: {
      enabled: true,
      mode: EncryptionMode.AES_GCM,
      keyRotationInterval: 3600,
      usePerFrameIV: true
    }
  });
  
  // Get access to the components
  const { signalingServer, streamHandler, natHelper, encryption } = webrtcSystem;
  
  try {
    // Start the WebRTC system
    console.log('Starting WebRTC system...');
    await webrtcSystem.start();
    console.log('WebRTC system started successfully');
    
    // Create stream ingestion pipelines for each camera
    const ingestionPipelines: StreamIngestionPipeline[] = [];
    
    for (const camera of TEST_CAMERAS) {
      console.log(`Setting up stream ingestion for camera: ${camera.name}`);
      
      // Create ingestion config
      const ingestionConfig: StreamIngestionConfig = {
        streamId: `camera_${camera.name.toLowerCase().replace(/\s+/g, '_')}`,
        source: {
          type: StreamSourceType.RTSP,
          url: camera.sourceUrl,
          auth: {
            username: camera.username,
            password: camera.password
          },
          retry: {
            maxAttempts: 5,
            delay: 5000,
            exponentialBackoff: true
          }
        },
        outputs: [
          // WebRTC-compatible H.264 output
          {
            format: StreamOutputFormat.RAW_H264,
            processing: {
              resize: true,
              resolution: '1280x720',
              adjustFrameRate: true,
              frameRate: 30,
              adjustBitrate: true,
              bitrate: 2000
            },
            enableRecording: true,
            recordingConfig: {
              outputDir: path.join(process.cwd(), 'recordings'),
              format: RecordingFormat.MP4,
              quality: RecordingQuality.MEDIUM,
              segmentDuration: 600, // 10 minutes
              includeAudio: true,
              generateThumbnails: true,
              thumbnailInterval: 60,
              namePrefix: `${camera.name}_`
            }
          },
          // Lower quality stream for mobile devices
          {
            format: StreamOutputFormat.RAW_H264,
            processing: {
              resize: true,
              resolution: '640x360',
              adjustFrameRate: true,
              frameRate: 15,
              adjustBitrate: true,
              bitrate: 500
            },
            enableRecording: false
          }
        ],
        tempDir: path.join(process.cwd(), 'temp'),
        enableHealthMonitoring: true,
        healthMonitoring: {
          checkInterval: 5,
          maxFrameDelay: 10,
          autoReconnect: true,
          maxReconnectAttempts: 5
        }
      };
      
      // Create ingestion pipeline
      const pipeline = new StreamIngestionPipeline(ingestionConfig);
      
      // Set up pipeline event handlers
      setupPipelineEventHandlers(pipeline);
      
      // Start the pipeline
      await pipeline.start();
      console.log(`Stream ingestion started for camera: ${camera.name}`);
      
      // Create WebRTC stream using this pipeline
      const streamId = streamHandler.createStream({
        id: pipeline.getStreamId(),
        sourceUrl: camera.sourceUrl,
        encoding: 'h264',
        resolution: {
          width: 1280,
          height: 720
        },
        frameRate: 30,
        maxBitrate: 2000000
      });
      
      console.log(`WebRTC stream created with ID: ${streamId}`);
      
      // Add pipeline to our list
      ingestionPipelines.push(pipeline);
    }
    
    // Set up event handlers for the stream handler
    setupStreamHandlerEventHandlers(streamHandler);
    
    // In a real application, this would run for the lifetime of the application
    // For demo purposes, we'll run for 300 seconds (5 minutes)
    console.log('Streaming and recording demo is running. Press Ctrl+C to stop.');
    console.log('Streams will be recorded for 5 minutes...');
    
    // Wait for 5 minutes
    await new Promise(resolve => setTimeout(resolve, 300000));
    
    // Clean up
    console.log('Cleaning up...');
    
    // Stop all ingestion pipelines
    for (const pipeline of ingestionPipelines) {
      await pipeline.stop();
      console.log(`Stream ingestion stopped for stream: ${pipeline.getStreamId()}`);
    }
    
    // Close all streams
    streamHandler.closeAllStreams();
    
    // Stop WebRTC system
    await webrtcSystem.stop();
    
    console.log('Streaming and recording demo completed successfully');
  } catch (error) {
    console.error('Error in streaming demo:', error);
  }
}

/**
 * Set up event handlers for a stream ingestion pipeline
 * 
 * @param pipeline The pipeline to set up event handlers for
 */
function setupPipelineEventHandlers(pipeline: StreamIngestionPipeline): void {
  pipeline.on(StreamIngestionEvent.CONNECT, (event) => {
    console.log(`[${pipeline.getStreamId()}] Connecting to source: ${event.source.url}`);
  });
  
  pipeline.on(StreamIngestionEvent.START, (event) => {
    console.log(`[${pipeline.getStreamId()}] Stream ingestion started at ${event.startTime}`);
  });
  
  pipeline.on(StreamIngestionEvent.STOP, (event) => {
    console.log(`[${pipeline.getStreamId()}] Stream ingestion stopped after ${event.duration.toFixed(1)}s`);
  });
  
  pipeline.on(StreamIngestionEvent.RECONNECT, (event) => {
    console.log(`[${pipeline.getStreamId()}] Reconnecting (attempt ${event.attempt})...`);
  });
  
  pipeline.on(StreamIngestionEvent.ERROR, (event) => {
    console.error(`[${pipeline.getStreamId()}] Error: ${event.message}`);
  });
  
  pipeline.on(StreamIngestionEvent.HEALTH_STATUS, (event) => {
    if (event.status !== 'streaming') {
      console.log(`[${pipeline.getStreamId()}] Health status: ${event.status}${event.error ? ` (${event.error})` : ''}`);
    }
  });
  
  pipeline.on(StreamIngestionEvent.RECORDING_START, (event) => {
    console.log(`[${pipeline.getStreamId()}] Recording started: ${event.recordingId}`);
  });
  
  pipeline.on(StreamIngestionEvent.RECORDING_STOP, (event) => {
    console.log(`[${pipeline.getStreamId()}] Recording stopped: ${event.recordingId}, duration: ${event.duration.toFixed(1)}s, segments: ${event.segments}`);
  });
}

/**
 * Set up event handlers for the WebRTC stream handler
 * 
 * @param streamHandler The stream handler to set up event handlers for
 */
function setupStreamHandlerEventHandlers(streamHandler: any): void {
  streamHandler.on(WebRTCStreamEvent.STREAM_CREATED, (event: any) => {
    console.log(`WebRTC stream created: ${event.streamId}`);
  });
  
  streamHandler.on(WebRTCStreamEvent.CLIENT_CONNECTED, (event: any) => {
    console.log(`Client connected: ${event.clientId} to stream ${event.streamId}`);
  });
  
  streamHandler.on(WebRTCStreamEvent.CLIENT_DISCONNECTED, (event: any) => {
    console.log(`Client disconnected: ${event.clientId} from stream ${event.streamId}`);
    console.log(`  Session duration: ${(event.duration / 1000).toFixed(1)}s`);
    console.log(`  Bytes transferred: ${(event.bytesTransferred / 1024 / 1024).toFixed(2)} MB`);
  });
  
  streamHandler.on(WebRTCStreamEvent.STREAM_CLOSED, (event: any) => {
    console.log(`Stream closed: ${event.streamId}`);
  });
  
  streamHandler.on(WebRTCStreamEvent.ERROR, (event: any) => {
    console.error(`Stream error: ${event.message}`);
  });
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runStreamingRecordingDemo().catch(console.error);
}

// Export for use in other files
export { runStreamingRecordingDemo };