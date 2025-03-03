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

// Export NATTraversalHelper
export {
  NATTraversalHelper,
  NATTraversalConfig,
  NATTraversalEvent,
  NATTraversalStrategy,
  NATTraversalStats,
  NetworkTypeInfo,
  ICECandidateType,
  ICECandidateInfo
} from './NATTraversalHelper';

// Export WebRTCEncryption
export {
  WebRTCEncryption,
  EncryptionMode,
  EncryptionConfig,
  EncryptionHeader,
  EncryptionKeyInfo,
  EncryptionStats
} from './WebRTCEncryption';

// Export WebRTCRecorder
export {
  WebRTCRecorder,
  RecordingFormat,
  RecordingQuality,
  RecordingState,
  RecordingEvent,
  RecordingConfig,
  RecordingMetadata,
  RecordingStats
} from './WebRTCRecorder';

// Export StreamIngestionPipeline
export {
  StreamIngestionPipeline,
  StreamSourceType,
  StreamOutputFormat,
  StreamProcessingOptions,
  StreamSourceConfig,
  StreamOutputConfig,
  StreamIngestionConfig,
  StreamIngestionStatus,
  StreamHealthStatus,
  StreamIngestionEvent,
  StreamIngestionStats
} from './StreamIngestionPipeline';

// Import needed for the function below
import { WebRTCSignalingServer } from './WebRTCSignalingServer';
import { WebRTCStreamHandler } from './WebRTCStreamHandler';
import { NATTraversalHelper, NATTraversalConfig, NATTraversalEvent, NATTraversalStrategy, NATTraversalStats, NetworkTypeInfo, ICECandidateType, ICECandidateInfo } from './NATTraversalHelper';
import { WebRTCEncryption, EncryptionMode, EncryptionConfig, EncryptionHeader, EncryptionKeyInfo, EncryptionStats } from './WebRTCEncryption';
import { WebRTCRecorder, RecordingFormat, RecordingQuality, RecordingState, RecordingEvent, RecordingConfig, RecordingMetadata, RecordingStats } from './WebRTCRecorder';
import { StreamIngestionPipeline, StreamSourceType, StreamOutputFormat, StreamProcessingOptions, StreamSourceConfig, StreamOutputConfig, StreamIngestionConfig, StreamIngestionStatus, StreamHealthStatus, StreamIngestionEvent, StreamIngestionStats } from './StreamIngestionPipeline';

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
  natTraversal?: Partial<NATTraversalConfig>;
  encryption?: {
    enabled: boolean;
    mode?: EncryptionMode;
    keyRotationInterval?: number;
    usePerFrameIV?: boolean;
  };
}) {
  // Create NAT traversal helper if enabled
  const natHelper = config.natTraversal ?
    new NATTraversalHelper(config.natTraversal) : undefined;
  
  // Get optimized ICE server configuration if NAT helper is available
  const iceServers = natHelper ?
    natHelper.getOptimizedIceServers() :
    config.iceServers;
  
  // Create signaling server with optimized ICE servers
  const signalingServer = new WebRTCSignalingServer({
    ...config,
    iceServers
  });
  
  // Create stream handler
  const streamHandler = new WebRTCStreamHandler(signalingServer);
  
  // Create encryption helper if enabled
  const encryption = config.encryption?.enabled ?
    new WebRTCEncryption({
      mode: config.encryption.mode || EncryptionMode.AES_GCM,
      keyRotationInterval: config.encryption.keyRotationInterval || 3600,
      usePerFrameIV: config.encryption.usePerFrameIV !== false
    }) : undefined;
  
  return {
    signalingServer,
    streamHandler,
    natHelper,
    encryption,
    
    // Helper method to start the system
    async start() {
      await signalingServer.start();
      return { signalingServer, streamHandler, natHelper, encryption };
    },
    
    // Helper method to stop the system
    async stop() {
      streamHandler.closeAllStreams();
      await signalingServer.stop();
      
      // Clean up additional resources
      if (natHelper) {
        natHelper.cleanup();
      }
      
      if (encryption) {
        encryption.cleanup();
      }
    }
  };
}