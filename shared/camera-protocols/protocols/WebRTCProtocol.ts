import * as http from 'http';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { AbstractCameraProtocol } from '../AbstractCameraProtocol';
import {
  CameraConfig,
  CameraCapabilities,
  CameraInfo,
  PtzMovement,
  StreamOptions,
  StreamProfile,
} from '../interfaces/ICameraProtocol';

/**
 * WebRTC signaling message types
 */
enum SignalingMessageType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice-candidate',
  STREAM_REQUEST = 'stream-request',
  STREAM_RESPONSE = 'stream-response',
  ERROR = 'error',
  CLOSE = 'close',
  KEEP_ALIVE = 'keep-alive',
}

/**
 * WebRTC signaling message
 */
interface SignalingMessage {
  type: SignalingMessageType;
  sessionId?: string;
  streamId?: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * WebRTC stream session info
 */
interface StreamSession {
  id: string;
  streamId: string;
  clientId?: string;
  options?: StreamOptions;
  lastActivity: number;
  timeoutHandle?: NodeJS.Timeout;
}

/**
 * ICE Server interface for type safety
 */
interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * WebRTC camera protocol implementation
 *
 * This class implements the ICameraProtocol interface for WebRTC camera streams.
 * WebRTC provides ultra-low latency streaming with peer-to-peer connections when possible.
 */
export class WebRTCProtocol extends AbstractCameraProtocol {
  /**
   * Protocol identifier
   */
  public readonly protocolId: string = 'webrtc';

  /**
   * Protocol name
   */
  public readonly protocolName: string = 'WebRTC';

  /**
   * Protocol capabilities
   */
  public readonly capabilities: CameraCapabilities = {
    ptz: false,
    presets: false,
    digitalPtz: true,
    motionDetection: false,
    audio: true,
    twoWayAudio: true,
    encodings: ['h264', 'vp8', 'vp9'],
    authMethods: ['token'],
    localRecording: false,
    events: false,
    protocolSpecific: {
      usesTURN: true,
      usesSTUN: true,
      p2p: true,
      lowLatency: true,
    },
  };

  /**
   * Active stream sessions
   */
  protected activeStreams: Map<string, StreamSession> = new Map();

  /**
   * WebSocket server for signaling
   * Using any type due to complexity with the WebSocket library's type definitions
   * A more specific type would require significant refactoring
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private signalingServer: any = null;

  /**
   * WebSocket connections by client ID
   */
  private clients: Map<string, WebSocket> = new Map();

  /**
   * HTTP server for WebRTC signaling
   */
  private httpServer: http.Server | null = null;

  /**
   * RTC stream profiles
   */
  private streamProfiles: StreamProfile[] = [];

  /**
   * Camera info cache
   */
  private cameraInfoCache: CameraInfo | null = null;

  /**
   * Session timeout duration in milliseconds
   */
  private sessionTimeoutMs: number = 30000; // 30 seconds

  /**
   * WebSocket OPEN state constant
   */
  private readonly WS_OPEN: number = 1;

  /**
   * Connect to camera
   *
   * @param config Camera configuration
   */
  protected async performConnect(config: CameraConfig): Promise<boolean> {
    try {
      const port = config.webrtcPort || 8433;

      // Create default stream profiles if not defined in config
      if (!this.streamProfiles.length) {
        this.createDefaultProfiles();
      }

      // Create HTTP server for WebRTC signaling
      this.httpServer = http.createServer();

      // Create WebSocket server for signaling
      this.signalingServer = new WebSocket.Server({
        server: this.httpServer,
        path: '/webrtc-signaling',
      });

      // Set up WebSocket events
      this.signalingServer.on('connection', this.handleConnection.bind(this));
      this.signalingServer.on('error', this.handleError.bind(this));

      // Start HTTP server
      return new Promise(resolve => {
        if (!this.httpServer) {
          resolve(false);
          return;
        }

        this.httpServer.listen(port, () => {
          console.log(`WebRTC signaling server started on port ${port}`);
          resolve(true);
        });

        this.httpServer.on('error', err => {
          console.error('WebRTC signaling server error:', err);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Failed to start WebRTC server:', error);
      return false;
    }
  }

  /**
   * Create default stream profiles
   */
  private createDefaultProfiles(): void {
    // Add common profiles
    this.streamProfiles = [
      {
        id: 'hd',
        name: 'HD (1280x720)',
        encoding: 'h264',
        resolution: { width: 1280, height: 720 },
        frameRate: 30,
        bitrate: 2000,
        parameters: {
          profile: 'main',
          level: '4.0',
        },
      },
      {
        id: 'sd',
        name: 'SD (640x480)',
        encoding: 'h264',
        resolution: { width: 640, height: 480 },
        frameRate: 30,
        bitrate: 1000,
        parameters: {
          profile: 'main',
          level: '3.1',
        },
      },
      {
        id: 'low',
        name: 'Low (320x240)',
        encoding: 'h264',
        resolution: { width: 320, height: 240 },
        frameRate: 15,
        bitrate: 500,
        parameters: {
          profile: 'baseline',
          level: '3.0',
        },
      },
    ];
  }

  /**
   * Handle new WebSocket connection
   *
   * @param ws WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = uuidv4();
    this.clients.set(clientId, ws);

    // Set up client events
    ws.on('message', (message: string) => {
      try {
        const msg = JSON.parse(message) as SignalingMessage;
        this.handleSignalingMessage(clientId, msg, ws);
      } catch (error) {
        console.error('Invalid signaling message:', error);
        this.sendErrorToClient(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      // Clean up client and associated streams
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', error => {
      console.error('WebSocket client error:', error);
      this.handleClientDisconnect(clientId);
    });

    // Send initial connection confirmation
    ws.send(
      JSON.stringify({
        type: 'connection-established',
        clientId,
      })
    );
  }

  /**
   * Handle signaling message from client
   *
   * @param clientId Client identifier
   * @param message Signaling message
   * @param ws WebSocket connection
   */
  private handleSignalingMessage(clientId: string, message: SignalingMessage, ws: WebSocket): void {
    // Update last activity time for the session
    if (message.sessionId) {
      const session = this.findSessionBySessionId(message.sessionId);
      if (session) {
        this.resetSessionTimeout(session);
      }
    }

    // Handle different message types
    switch (message.type) {
      case SignalingMessageType.STREAM_REQUEST:
        this.handleStreamRequest(clientId, message, ws);
        break;

      case SignalingMessageType.OFFER:
        // Forward offer to the other peer (not used in this implementation)
        break;

      case SignalingMessageType.ANSWER:
        // Forward answer to the other peer (not used in this implementation)
        break;

      case SignalingMessageType.ICE_CANDIDATE:
        // Forward ICE candidate to the other peer (not used in this implementation)
        break;

      case SignalingMessageType.CLOSE:
        this.handleCloseRequest(message.sessionId || '', clientId);
        break;

      case SignalingMessageType.KEEP_ALIVE:
        // Keep-alive messages just update the timestamp (done above)
        break;

      default:
        this.sendErrorToClient(ws, 'Unknown message type');
    }
  }

  /**
   * Handle stream request from client
   *
   * @param clientId Client identifier
   * @param message Stream request message
   * @param ws WebSocket connection
   */
  private handleStreamRequest(clientId: string, message: SignalingMessage, ws: WebSocket): void {
    if (!message.streamId) {
      this.sendErrorToClient(ws, 'Missing streamId in stream request');
      return;
    }

    // Find the requested stream
    const streamId = message.streamId;
    const stream = this.activeStreams.get(streamId);

    if (!stream) {
      this.sendErrorToClient(ws, `Stream ${streamId} not found`);
      return;
    }

    // Create a new session for this client
    const sessionId = uuidv4();
    const session: StreamSession = {
      id: sessionId,
      streamId,
      clientId,
      options: stream.options,
      lastActivity: Date.now(),
    };

    // Start timeout for this session
    this.resetSessionTimeout(session);

    // Store session
    this.activeStreams.set(sessionId, session);

    // Send stream response with session ID
    const responseMessage: SignalingMessage = {
      type: SignalingMessageType.STREAM_RESPONSE,
      sessionId,
      streamId,
      data: {
        profile: this.getProfileForStream(stream),
        iceServers: this.getIceServers(),
      },
    };

    ws.send(JSON.stringify(responseMessage));
  }

  /**
   * Handle close request from client
   *
   * @param sessionId Session identifier
   * @param clientId Client identifier
   */
  private handleCloseRequest(sessionId: string, clientId: string): void {
    const session = this.findSessionBySessionId(sessionId);
    if (session) {
      // Check if client owns this session
      if (session.clientId === clientId) {
        this.activeStreams.delete(sessionId);
        this.cleanupSession(session);
      }
    }
  }

  /**
   * Handle client disconnect
   *
   * @param clientId Client identifier
   */
  private handleClientDisconnect(clientId: string): void {
    // Remove client
    this.clients.delete(clientId);

    // Clean up any associated sessions
    for (const [sessionId, session] of this.activeStreams.entries()) {
      if (session.clientId === clientId) {
        this.activeStreams.delete(sessionId);
        this.cleanupSession(session);
      }
    }
  }

  /**
   * Handle WebSocket server error
   *
   * @param error Error object
   */
  private handleError(error: Error): void {
    console.error('WebRTC signaling server error:', error);
  }

  /**
   * Send error message to client
   *
   * @param ws WebSocket connection
   * @param errorMsg Error message
   */
  private sendErrorToClient(ws: WebSocket, errorMsg: string): void {
    const errorMessage: SignalingMessage = {
      type: SignalingMessageType.ERROR,
      error: errorMsg,
    };

    ws.send(JSON.stringify(errorMessage));
  }

  /**
   * Find session by session ID
   *
   * @param sessionId Session identifier
   */
  private findSessionBySessionId(sessionId: string): StreamSession | undefined {
    return this.activeStreams.get(sessionId);
  }

  /**
   * Reset session timeout
   *
   * @param session Stream session
   */
  private resetSessionTimeout(session: StreamSession): void {
    // Clear existing timeout
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Update activity timestamp
    session.lastActivity = Date.now();

    // Set new timeout
    session.timeoutHandle = setTimeout(() => {
      this.handleSessionTimeout(session);
    }, this.sessionTimeoutMs);
  }

  /**
   * Handle session timeout
   *
   * @param session Stream session
   */
  private handleSessionTimeout(session: StreamSession): void {
    const inactivityTime = Date.now() - session.lastActivity;

    if (inactivityTime >= this.sessionTimeoutMs) {
      // Remove session
      this.activeStreams.delete(session.id);
      this.cleanupSession(session);

      // Notify client if still connected
      const client = session.clientId ? this.clients.get(session.clientId) : undefined;
      if (client && client.readyState === this.WS_OPEN) {
        const message: SignalingMessage = {
          type: SignalingMessageType.CLOSE,
          sessionId: session.id,
          error: 'Session timeout due to inactivity',
        };

        client.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Clean up session resources
   *
   * @param session Stream session
   */
  private cleanupSession(session: StreamSession): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Additional cleanup as needed for WebRTC resources
  }

  /**
   * Get profile for stream
   *
   * @param stream Stream session
   */
  private getProfileForStream(stream: StreamSession): StreamProfile {
    if (stream.options && stream.options.profile) {
      // Find profile by ID
      const profileId = stream.options.profile;
      const profile = this.streamProfiles.find(p => p.id === profileId);

      if (profile) {
        return profile;
      }
    } else if (stream.options && stream.options.resolution) {
      // Find profile by resolution
      const targetWidth = stream.options.resolution.width;
      const targetHeight = stream.options.resolution.height;

      // Find closest match
      let bestMatch = this.streamProfiles[0];
      let bestDiff = Number.MAX_SAFE_INTEGER;

      for (const profile of this.streamProfiles) {
        const width = profile.resolution.width;
        const height = profile.resolution.height;

        const diff = Math.abs(width - targetWidth) + Math.abs(height - targetHeight);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestMatch = profile;
        }
      }

      return bestMatch;
    }

    // Return default profile (first one)
    return this.streamProfiles[0];
  }

  /**
   * Get ICE servers configuration
   */
  private getIceServers(): IceServer[] {
    // Start with default public STUN servers
    const iceServers: IceServer[] = [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
      {
        urls: 'stun:stun1.l.google.com:19302',
      },
    ];

    // Add custom ICE servers from config if available
    if (this.config?.webrtcConfig?.iceServers) {
      return this.config.webrtcConfig.iceServers;
    }

    // Add custom TURN servers if provided in config
    if (this.config?.webrtcConfig?.turnServer) {
      iceServers.push({
        urls: `turn:${this.config.webrtcConfig.turnServer}`,
        username: this.config.webrtcConfig.turnUsername || '',
        credential: this.config.webrtcConfig.turnCredential || '',
      });
    }

    // Add custom STUN servers if provided
    if (this.config?.webrtcConfig?.stunServers) {
      for (const stunServer of this.config.webrtcConfig.stunServers) {
        iceServers.push({
          urls: `stun:${stunServer}`,
        });
      }
    }

    return iceServers;
  }

  /**
   * Disconnect from camera
   */
  protected async performDisconnect(): Promise<void> {
    // Close all active sessions
    for (const session of this.activeStreams.values()) {
      this.cleanupSession(session);
    }

    this.activeStreams.clear();
    this.clients.clear();

    // Close signaling server
    if (this.signalingServer) {
      return new Promise(resolve => {
        if (this.signalingServer) {
          this.signalingServer.close(() => {
            // Close HTTP server
            if (this.httpServer) {
              this.httpServer.close(() => {
                this.signalingServer = null;
                this.httpServer = null;
                resolve();
              });
            } else {
              this.signalingServer = null;
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    }

    return Promise.resolve();
  }

  /**
   * Start camera stream
   *
   * @param options Stream options
   */
  protected async performStartStream(options?: StreamOptions): Promise<string> {
    // Generate stream ID
    const streamId = `stream-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Create stream session without client (will be added when client connects)
    const session: StreamSession = {
      id: streamId, // Use streamId as sessionId initially
      streamId,
      options,
      lastActivity: Date.now(),
    };

    // Store stream
    this.activeStreams.set(streamId, session);

    return streamId;
  }

  /**
   * Stop camera stream
   *
   * @param streamId Stream identifier
   */
  protected async performStopStream(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId);

    if (stream) {
      // Clean up session
      this.cleanupSession(stream);

      // Remove stream
      this.activeStreams.delete(streamId);

      // Notify clients if needed
      if (stream.clientId) {
        const client = this.clients.get(stream.clientId);
        if (client && client.readyState === this.WS_OPEN) {
          const message: SignalingMessage = {
            type: SignalingMessageType.CLOSE,
            streamId,
            sessionId: stream.id,
          };

          client.send(JSON.stringify(message));
        }
      }
    }
  }

  /**
   * Get camera information
   */
  public async getCameraInfo(): Promise<CameraInfo> {
    if (this.cameraInfoCache) {
      return this.cameraInfoCache;
    }

    // For WebRTC, we don't have a standard way to get camera info
    // We'll just return basic info
    const info: CameraInfo = {
      manufacturer: 'OmniSight',
      model: 'WebRTC Camera',
      firmwareVersion: '1.0.0',
      additionalInfo: {
        protocol: this.protocolName,
        signalingPort: this.config?.webrtcPort || 8433,
      },
    };

    this.cameraInfoCache = info;
    return info;
  }

  /**
   * Get available stream profiles
   */
  public async getAvailableStreams(): Promise<StreamProfile[]> {
    return this.streamProfiles;
  }

  /**
   * Get protocol-specific options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getProtocolOptions(): Record<string, any> {
    return {
      signalingPort: this.config?.webrtcPort || 8433,
      iceServers: this.getIceServers(),
      profiles: this.streamProfiles.map(p => ({
        id: p.id,
        name: p.name,
        resolution: p.resolution,
      })),
    };
  }

  /**
   * Set protocol-specific options
   *
   * @param options Protocol options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async setProtocolOptions(options: Record<string, any>): Promise<void> {
    // Update ICE servers if provided
    if (options.iceServers && Array.isArray(options.iceServers)) {
      if (this.config && !this.config.webrtcConfig) {
        this.config.webrtcConfig = {};
      }

      if (this.config && this.config.webrtcConfig) {
        // Add direct ICE servers config
        this.config.webrtcConfig.iceServers = options.iceServers;

        // Attempt to extract TURN server info for backward compatibility
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const turnServer = options.iceServers.find(
          (s: any) =>
            s.urls &&
            ((typeof s.urls === 'string' && s.urls.startsWith('turn:')) ||
              (Array.isArray(s.urls) && s.urls.some((url: string) => url.startsWith('turn:'))))
        );

        if (turnServer) {
          const turnUrl =
            typeof turnServer.urls === 'string'
              ? turnServer.urls
              : turnServer.urls.find((url: string) => url.startsWith('turn:'));

          if (turnUrl) {
            this.config.webrtcConfig.turnServer = turnUrl.replace('turn:', '');
            this.config.webrtcConfig.turnUsername = turnServer.username || '';
            this.config.webrtcConfig.turnCredential = turnServer.credential || '';
          }
        }
      }
    }

    // Update stream profiles if provided
    if (options.profiles && Array.isArray(options.profiles)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.streamProfiles = options.profiles.map((p: any) => ({
        id: p.id || 'default',
        name: p.name || 'Default Profile',
        encoding: p.encoding || 'h264',
        resolution: {
          width: p.resolution?.width || 640,
          height: p.resolution?.height || 480,
        },
        frameRate: p.frameRate || 30,
        bitrate: p.bitrate || 1000,
        parameters: p.parameters || {},
      }));
    }
  }

  /**
   * Test connection to camera
   *
   * @param config Camera configuration
   */
  protected async performTestConnection(config: CameraConfig): Promise<boolean> {
    const port = config.webrtcPort || 8433;

    // Simple port check to see if we can bind
    return new Promise(resolve => {
      try {
        const server = http.createServer();

        server.once('error', () => {
          // Port is in use or not available
          resolve(false);
        });

        server.once('listening', () => {
          // Port is available
          server.close(() => {
            resolve(true);
          });
        });

        // Try to listen on the port
        server.listen(port);
      } catch (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _
      ) {
        // Any error means the connection test failed
        resolve(false);
      }
    });
  }

  /**
   * Get a frame from camera (not directly supported by WebRTC)
   */
  public async getFrame(): Promise<Uint8Array> {
    throw new Error('WebRTC protocol does not support direct frame capture. Use a stream instead.');
  }

  /**
   * Create client HTML for embedding WebRTC stream
   *
   * @param streamId Stream identifier
   */
  public createClientEmbedHtml(streamId: string): string {
    const signalingPort = this.config?.webrtcPort || 8433;
    const host = this.config?.host || 'localhost';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OmniSight WebRTC Stream</title>
  <style>
    body { margin: 0; padding: 0; background: #000; }
    #videoContainer { width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; }
    video { max-width: 100%; max-height: 100%; }
    .status { position: absolute; top: 10px; left: 10px; color: white; font-family: Arial; font-size: 14px; background: rgba(0,0,0,0.5); padding: 5px 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <div id="videoContainer">
    <video id="videoElement" autoplay playsinline></video>
  </div>
  <div id="statusElement" class="status">Connecting...</div>

  <script>
    // WebRTC stream client
    const streamId = "${streamId}";
    const signalingUrl = "ws://${host}:${signalingPort}/webrtc-signaling";
    
    // Define WebSocket constants if needed
    const WS_CONNECTING = 0;
    const WS_OPEN = 1;
    const WS_CLOSING = 2;
    const WS_CLOSED = 3;
    
    let peerConnection = null;
    let signalingConnection = null;
    let sessionId = null;
    let keepAliveInterval = null;
    
    const videoElement = document.getElementById('videoElement');
    const statusElement = document.getElementById('statusElement');
    
    // Set up signaling connection
    function connectToSignalingServer() {
      signalingConnection = new WebSocket(signalingUrl);
      
      signalingConnection.onopen = () => {
        statusElement.textContent = "Signaling connected, requesting stream...";
        // Request the stream
        sendSignalingMessage({
          type: 'stream-request',
          streamId
        });
      };
      
      signalingConnection.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleSignalingMessage(message);
      };
      
      signalingConnection.onerror = (error) => {
        statusElement.textContent = "Signaling error: " + error.message;
        console.error("Signaling error:", error);
      };
      
      signalingConnection.onclose = () => {
        statusElement.textContent = "Signaling disconnected";
        // Clean up
        stopKeepAlive();
        closePeerConnection();
        
        // Try to reconnect after delay
        setTimeout(connectToSignalingServer, 5000);
      };
    }
    
    // Handle signaling messages
    function handleSignalingMessage(message) {
      switch (message.type) {
        case 'connection-established':
          statusElement.textContent = "Connection established, initializing...";
          break;
          
        case 'stream-response':
          sessionId = message.sessionId;
          statusElement.textContent = "Stream available, establishing WebRTC connection...";
          
          // Initialize WebRTC with the ICE servers
          initializeWebRTC(message.data.iceServers, message.data.profile);
          
          // Start sending keep-alive messages
          startKeepAlive();
          break;
          
        case 'offer':
          if (!peerConnection) {
            statusElement.textContent = "Error: Received offer but peer connection not initialized";
            return;
          }
          
          handleOffer(message.data);
          break;
          
        case 'ice-candidate':
          if (!peerConnection) {
            statusElement.textContent = "Error: Received ICE candidate but peer connection not initialized";
            return;
          }
          
          handleIceCandidate(message.data);
          break;
          
        case 'close':
          statusElement.textContent = "Stream closed: " + (message.error || "by server");
          closePeerConnection();
          break;
          
        case 'error':
          statusElement.textContent = "Error: " + message.error;
          console.error("Signaling error:", message.error);
          break;
      }
    }
    
    // Initialize WebRTC connection
    function initializeWebRTC(iceServers, profile) {
      // Close existing connection if any
      closePeerConnection();
      
      // Create new connection
      peerConnection = new RTCPeerConnection({ 
        iceServers,
        iceTransportPolicy: 'all'
      });
      
      // Set up event handlers
      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          videoElement.srcObject = event.streams[0];
          statusElement.textContent = "Stream connected";
        }
      };
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage({
            type: 'ice-candidate',
            sessionId,
            data: event.candidate
          });
        }
      };
      
      peerConnection.oniceconnectionstatechange = () => {
        statusElement.textContent = "ICE state: " + peerConnection.iceConnectionState;
        
        if (peerConnection.iceConnectionState === 'disconnected' ||
            peerConnection.iceConnectionState === 'failed' ||
            peerConnection.iceConnectionState === 'closed') {
          statusElement.textContent = "Connection lost, reconnecting...";
          
          // Try to reconnect
          requestStream();
        }
      };
      
      // Create and send offer
      createAndSendOffer(profile);
    }
    
    // Create and send WebRTC offer
    async function createAndSendOffer(profile) {
      try {
        // Add transceiver for video (and audio if needed)
        const videoTransceiver = peerConnection.addTransceiver('video', {
          direction: 'recvonly',
          streams: [new MediaStream()],
        });
        
        // Set codec preferences if supported
        if (RTCRtpSender.getCapabilities && RTCRtpSender.getCapabilities('video')) {
          const capabilities = RTCRtpSender.getCapabilities('video');
          const preferredCodecs = capabilities.codecs.filter(codec => 
            codec.mimeType.toLowerCase() === 'video/' + profile.encoding.toLowerCase());
            
          if (preferredCodecs.length > 0 && videoTransceiver.setCodecPreferences) {
            videoTransceiver.setCodecPreferences(preferredCodecs);
          }
        }
        
        // Create offer
        const offer = await peerConnection.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true
        });
        
        // Set local description
        await peerConnection.setLocalDescription(offer);
        
        // Send offer to signaling server
        sendSignalingMessage({
          type: 'offer',
          sessionId,
          data: offer
        });
      } catch (error) {
        statusElement.textContent = "Error creating offer: " + error.message;
        console.error("Error creating offer:", error);
      }
    }
    
    // Handle received offer
    async function handleOffer(offer) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create answer
        const answer = await peerConnection.createAnswer();
        
        // Set local description
        await peerConnection.setLocalDescription(answer);
        
        // Send answer to signaling server
        sendSignalingMessage({
          type: 'answer',
          sessionId,
          data: answer
        });
      } catch (error) {
        statusElement.textContent = "Error handling offer: " + error.message;
        console.error("Error handling offer:", error);
      }
    }
    
    // Handle received ICE candidate
    async function handleIceCandidate(candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
    
    // Send signaling message
    function sendSignalingMessage(message) {
      if (signalingConnection && signalingConnection.readyState === WS_OPEN) {
        signalingConnection.send(JSON.stringify(message));
      }
    }
    
    // Request stream
    function requestStream() {
      sendSignalingMessage({
        type: 'stream-request',
        streamId
      });
    }
    
    // Start keep-alive interval
    function startKeepAlive() {
      stopKeepAlive();
      
      // Send keep-alive message every 10 seconds
      keepAliveInterval = setInterval(() => {
        if (sessionId) {
          sendSignalingMessage({
            type: 'keep-alive',
            sessionId
          });
        }
      }, 10000); // 10 seconds
    }
    
    // Stop keep-alive interval
    function stopKeepAlive() {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }
    
    // Close peer connection
    function closePeerConnection() {
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      
      // Clear video
      videoElement.srcObject = null;
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      // Send close message
      if (sessionId) {
        sendSignalingMessage({
          type: 'close',
          sessionId
        });
      }
      
      // Clean up
      stopKeepAlive();
      closePeerConnection();
      
      if (signalingConnection) {
        signalingConnection.close();
      }
    });
    
    // Start the connection
    connectToSignalingServer();
  </script>
</body>
</html>
`;
  }

  /**
   * Move camera (not supported in this implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async performMove(_movement: PtzMovement): Promise<void> {
    throw new Error('WebRTC protocol does not support PTZ controls in this implementation');
  }

  /**
   * Go to preset (not supported in this implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async performGotoPreset(_presetId: string): Promise<void> {
    throw new Error('WebRTC protocol does not support PTZ presets in this implementation');
  }

  /**
   * Save preset (not supported in this implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async performSavePreset(_presetName: string): Promise<string> {
    throw new Error('WebRTC protocol does not support PTZ presets in this implementation');
  }

  /**
   * Subscribe to camera events (not supported in this implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async performSubscribeToEvents(_eventTypes: string[]): Promise<string> {
    throw new Error('WebRTC protocol does not support event subscription in this implementation');
  }

  /**
   * Unsubscribe from camera events (not supported in this implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async performUnsubscribeFromEvents(_subscriptionId: string): Promise<void> {
    throw new Error('WebRTC protocol does not support event subscription in this implementation');
  }
}
