/**
 * WebRTC Camera Protocol Demo
 * 
 * This example demonstrates how to use the WebRTC camera protocol components
 * to set up a complete WebRTC streaming system.
 */

import {
  createWebRTCSystem,
  WebRTCStreamState,
  WebRTCStreamEvent,
  EncryptionMode,
  NATTraversalStrategy
} from '../utils';

/**
 * Simple WebRTC client/server demo for camera streaming
 */
async function runWebRTCDemo() {
  console.log('Starting WebRTC Camera Protocol Demo...');
  
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
    // Start the system
    console.log('Starting WebRTC system...');
    await webrtcSystem.start();
    console.log('WebRTC system started successfully');
    
    // Log NAT traversal information if available
    if (natHelper) {
      const networkInfo = natHelper.getNetworkTypeInfo();
      const strategy = natHelper.getSelectedStrategy();
      
      console.log('Network Information:', networkInfo);
      console.log('Selected NAT Traversal Strategy:', strategy);
      
      // Examples of different strategies and what they mean
      switch (strategy) {
        case NATTraversalStrategy.DIRECT_FIRST:
          console.log('Using direct connection first, falling back to relay if needed');
          break;
        case NATTraversalStrategy.RELAY_FIRST:
          console.log('Using relay connection first for reliability (likely behind symmetric NAT)');
          break;
        case NATTraversalStrategy.RELAY_ONLY:
          console.log('Using relay-only mode (direct connections not possible in this network)');
          break;
        case NATTraversalStrategy.DIRECT_ONLY:
          console.log('Using direct-only mode (no relay servers needed)');
          break;
        case NATTraversalStrategy.PARALLEL:
          console.log('Using parallel connection strategy for fastest connection establishment');
          break;
      }
    }
    
    // Log encryption information if available
    if (encryption) {
      const config = encryption.getConfig();
      console.log('Encryption Mode:', config.mode);
      console.log('Key Rotation Interval:', config.keyRotationInterval, 'seconds');
    }
    
    // Set up event handlers for the stream handler
    streamHandler.on(WebRTCStreamEvent.STREAM_CREATED, (event) => {
      console.log(`Stream created: ${event.streamId}`);
    });
    
    streamHandler.on(WebRTCStreamEvent.CLIENT_CONNECTED, (event) => {
      console.log(`Client connected: ${event.clientId} to stream ${event.streamId}`);
    });
    
    streamHandler.on(WebRTCStreamEvent.CLIENT_DISCONNECTED, (event) => {
      console.log(`Client disconnected: ${event.clientId} from stream ${event.streamId}`);
      console.log(`  Duration: ${(event.duration / 1000).toFixed(1)}s`);
      console.log(`  Bytes transferred: ${(event.bytesTransferred / 1024 / 1024).toFixed(2)} MB`);
    });
    
    streamHandler.on(WebRTCStreamEvent.STREAM_CLOSED, (event) => {
      console.log(`Stream closed: ${event.streamId}`);
      console.log(`  Stats: ${JSON.stringify(event.stats, null, 2)}`);
    });
    
    streamHandler.on(WebRTCStreamEvent.ERROR, (event) => {
      console.error(`Stream error: ${event.message}`, event.error);
    });
    
    // Create a test stream
    console.log('Creating test stream...');
    const streamId = streamHandler.createStream({
      sourceUrl: 'rtsp://camera.example.com/stream1',
      encoding: 'h264',
      resolution: {
        width: 1280,
        height: 720
      },
      frameRate: 30,
      maxBitrate: 2000000 // 2 Mbps
    });
    
    console.log(`Test stream created with ID: ${streamId}`);
    
    // In a real application, this would run for the lifetime of the application
    // For demo purposes, we'll run for 60 seconds
    console.log('WebRTC demo is running. Press Ctrl+C to stop.');
    
    // Wait for 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Clean up
    console.log('Cleaning up...');
    streamHandler.closeStream(streamId);
    await webrtcSystem.stop();
    
    console.log('WebRTC demo completed successfully');
  } catch (error) {
    console.error('Error in WebRTC demo:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runWebRTCDemo().catch(console.error);
}

// Export for use in other files
export { runWebRTCDemo };