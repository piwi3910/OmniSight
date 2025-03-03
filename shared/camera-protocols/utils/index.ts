/**
 * WebRTC Utilities Index
 * 
 * This file exports all WebRTC-related utility classes, interfaces, and types.
 */

// Export PeerConnectionManager
export {
  PeerConnectionManager,
  PeerConnectionState,
  PeerConnectionConfig,
  IceServerConfig,
  SignalingMessage,
  SignalingMessageType
} from './PeerConnectionManager';

// Export WebRTCSignalingServer
export {
  WebRTCSignalingServer,
  SignalingServerConfig,
  SignalingServerEvent
} from './WebRTCSignalingServer';

// Export WebRTCStreamHandler
export {
  WebRTCStreamHandler,
  WebRTCStreamState,
  WebRTCStreamConfig,
  WebRTCStreamStats,
  WebRTCStreamEvent
} from './WebRTCStreamHandler';

// Import needed for the function below
import { WebRTCSignalingServer } from './WebRTCSignalingServer';
import { WebRTCStreamHandler } from './WebRTCStreamHandler';

/**
 * Create and configure a complete WebRTC system
 *
 * @param config Configuration object
 * @returns Configured WebRTC components
 */
export function createWebRTCSystem(config: {
  port: number;
  path?: string;
  authToken?: string;
  iceServers?: {
    urls: string | string[];
    username?: string;
    credential?: string;
  }[];
}) {
  // Create signaling server
  const signalingServer = new WebRTCSignalingServer(config);
  
  // Create stream handler
  const streamHandler = new WebRTCStreamHandler(signalingServer);
  
  return {
    signalingServer,
    streamHandler,
    
    // Helper method to start the system
    async start() {
      await signalingServer.start();
      return { signalingServer, streamHandler };
    },
    
    // Helper method to stop the system
    async stop() {
      streamHandler.closeAllStreams();
      await signalingServer.stop();
    }
  };
}