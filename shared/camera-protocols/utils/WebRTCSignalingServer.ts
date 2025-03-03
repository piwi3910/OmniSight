import * as http from 'http';
import * as WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  PeerConnectionManager, 
  PeerConnectionConfig, 
  SignalingMessage,
  SignalingMessageType
} from './PeerConnectionManager';

/**
 * WebRTC signaling client
 */
interface SignalingClient {
  id: string;
  ws: WebSocket;
  lastActivity: number;
  authenticated: boolean;
  connectionIds: string[];
}

/**
 * WebRTC signaling server configuration
 */
export interface SignalingServerConfig {
  port: number;
  path?: string;
  authToken?: string;
  iceServers?: {
    urls: string | string[];
    username?: string;
    credential?: string;
  }[];
  pingInterval?: number;
  maxInactivityTimeout?: number;
}

/**
 * WebRTC signaling server events
 */
export enum SignalingServerEvent {
  CLIENT_CONNECTED = 'client-connected',
  CLIENT_DISCONNECTED = 'client-disconnected',
  STREAM_REQUESTED = 'stream-requested',
  CONNECTION_ESTABLISHED = 'connection-established',
  CONNECTION_CLOSED = 'connection-closed',
  ERROR = 'error'
}

/**
 * WebRTC signaling server class
 * Implements a WebSocket-based signaling server for WebRTC
 */
export class WebRTCSignalingServer extends EventEmitter {
  /**
   * HTTP server instance
   */
  private httpServer: http.Server;
  
  /**
   * WebSocket server instance
   */
  private wsServer: WebSocket.Server;
  
  /**
   * Connected clients
   */
  private clients: Map<string, SignalingClient> = new Map();
  
  /**
   * Peer connection manager
   */
  private peerConnectionManager: PeerConnectionManager;
  
  /**
   * Server configuration
   */
  private config: SignalingServerConfig;
  
  /**
   * Server running state
   */
  private running: boolean = false;
  
  /**
   * Ping interval handle
   */
  private pingIntervalHandle: NodeJS.Timeout | null = null;

  /**
   * Create a new WebRTC signaling server
   * 
   * @param config Server configuration
   */
  constructor(config: SignalingServerConfig) {
    super();
    
    this.config = {
      ...config,
      path: config.path || '/webrtc-signaling',
      pingInterval: config.pingInterval || 30000, // 30 seconds
      maxInactivityTimeout: config.maxInactivityTimeout || 60000 // 60 seconds
    };
    
    // Create HTTP server
    this.httpServer = http.createServer();
    
    // Create WebSocket server
    this.wsServer = new WebSocket.Server({
      server: this.httpServer,
      path: this.config.path
    });
    
    // Create peer connection manager
    this.peerConnectionManager = new PeerConnectionManager();
    
    // Set up peer connection manager events
    this.setupPeerConnectionEvents();
  }

  /**
   * Start the signaling server
   * 
   * @returns Promise that resolves when the server starts
   */
  public async start(): Promise<void> {
    if (this.running) {
      return;
    }
    
    // Set up WebSocket server events
    this.wsServer.on('connection', this.handleConnection.bind(this));
    this.wsServer.on('error', this.handleServerError.bind(this));
    
    // Start HTTP server
    return new Promise<void>((resolve, reject) => {
      this.httpServer.listen(this.config.port, () => {
        console.log(`WebRTC signaling server started on port ${this.config.port}`);
        this.running = true;
        
        // Start ping interval
        this.startPingInterval();
        
        resolve();
      });
      
      this.httpServer.on('error', (error) => {
        console.error('Failed to start WebRTC signaling server:', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the signaling server
   * 
   * @returns Promise that resolves when the server stops
   */
  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    
    // Stop ping interval
    this.stopPingInterval();
    
    // Close all peer connections
    this.peerConnectionManager.closeAllConnections();
    
    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.ws.close();
      } catch (error) {
        console.error('Error closing client connection:', error);
      }
    }
    
    this.clients.clear();
    
    // Close WebSocket server
    return new Promise<void>((resolve) => {
      this.wsServer.close(() => {
        // Close HTTP server
        this.httpServer.close(() => {
          this.running = false;
          resolve();
        });
      });
    });
  }

  /**
   * Create a new stream connection
   * 
   * @param streamId Stream identifier
   * @param config Peer connection configuration
   * @returns Connection ID
   */
  public createStreamConnection(streamId: string, config: Omit<PeerConnectionConfig, 'id' | 'iceServers'>): string {
    // Create a new peer connection
    const connectionId = this.peerConnectionManager.createConnection({
      id: `stream-${streamId}-${uuidv4()}`,
      iceServers: this.config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      ...config
    });
    
    return connectionId;
  }

  /**
   * Handle new WebSocket connection
   * 
   * @param ws WebSocket connection
   * @param req HTTP request
   */
  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    // Generate client ID
    const clientId = uuidv4();
    
    // Create client object
    const client: SignalingClient = {
      id: clientId,
      ws,
      lastActivity: Date.now(),
      authenticated: !this.config.authToken, // Auto-authenticate if no token required
      connectionIds: []
    };
    
    // Store client
    this.clients.set(clientId, client);
    
    // Set up client event handlers
    ws.on('message', (data: WebSocket.Data) => {
      this.handleClientMessage(clientId, data);
    });
    
    ws.on('close', () => {
      this.handleClientDisconnect(clientId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleClientDisconnect(clientId);
    });
    
    // Send initial connection confirmation
    this.sendToClient(clientId, {
      type: 'connection-established',
      data: {
        clientId,
        requiresAuth: this.config.authToken !== undefined && !client.authenticated
      }
    });
    
    // Emit client connected event
    this.emit(SignalingServerEvent.CLIENT_CONNECTED, {
      clientId,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });
  }

  /**
   * Handle message from client
   * 
   * @param clientId Client identifier
   * @param data Message data
   */
  private handleClientMessage(clientId: string, data: WebSocket.Data): void {
    // Update client activity timestamp
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    client.lastActivity = Date.now();
    
    // Parse message
    let message: any;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      console.error(`Invalid JSON message from client ${clientId}:`, error);
      this.sendErrorToClient(clientId, 'Invalid JSON message');
      return;
    }
    
    // Check message type
    if (!message.type) {
      this.sendErrorToClient(clientId, 'Missing message type');
      return;
    }
    
    // Handle authentication first if required
    if (!client.authenticated) {
      if (message.type === 'authenticate') {
        this.handleAuthMessage(clientId, message);
      } else {
        this.sendErrorToClient(clientId, 'Authentication required');
      }
      return;
    }
    
    // Handle message based on type
    switch (message.type) {
      case 'stream-request':
        this.handleStreamRequest(clientId, message);
        break;
        
      case 'offer':
      case 'answer':
      case 'ice-candidate':
      case 'connection-state':
      case 'close':
        // These are all signaling messages for the peer connection
        this.handleSignalingMessage(clientId, message);
        break;
        
      case 'ping':
        // Just respond with a pong
        this.sendToClient(clientId, { type: 'pong' });
        break;
        
      default:
        console.warn(`Unknown message type from client ${clientId}: ${message.type}`);
        this.sendErrorToClient(clientId, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle authentication message
   * 
   * @param clientId Client identifier
   * @param message Authentication message
   */
  private handleAuthMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Check token
    if (message.token !== this.config.authToken) {
      this.sendErrorToClient(clientId, 'Invalid authentication token');
      return;
    }
    
    // Authentication successful
    client.authenticated = true;
    
    // Send success response
    this.sendToClient(clientId, {
      type: 'authentication-success'
    });
  }

  /**
   * Handle stream request message
   * 
   * @param clientId Client identifier
   * @param message Stream request message
   */
  private handleStreamRequest(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Check for stream ID
    if (!message.streamId) {
      this.sendErrorToClient(clientId, 'Missing streamId');
      return;
    }
    
    // Emit stream request event
    this.emit(SignalingServerEvent.STREAM_REQUESTED, {
      clientId,
      streamId: message.streamId,
      options: message.options || {}
    });
    
    // Response will be handled by external logic through the event
  }

  /**
   * Send stream response to client
   * 
   * @param clientId Client identifier
   * @param streamId Stream identifier
   * @param connectionId Connection identifier
   */
  public sendStreamResponse(clientId: string, streamId: string, connectionId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Add connection ID to client
    client.connectionIds.push(connectionId);
    
    // Get connection config
    const connection = this.peerConnectionManager.getAllConnections().get(connectionId);
    if (!connection) {
      this.sendErrorToClient(clientId, 'Failed to create stream connection');
      return;
    }
    
    // Associate client with connection
    this.peerConnectionManager.associateClient(connectionId, client.ws);
    
    // Send stream response
    this.sendToClient(clientId, {
      type: 'stream-response',
      streamId,
      connectionId,
      data: {
        iceServers: connection.config.iceServers,
        profile: {
          encoding: connection.config.encoding,
          resolution: connection.config.resolution,
          frameRate: connection.config.frameRate,
          maxBitrate: connection.config.maxBitrate
        }
      }
    });
  }

  /**
   * Handle signaling message
   * 
   * @param clientId Client identifier
   * @param message Signaling message
   */
  private handleSignalingMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Check for connection ID
    if (!message.connectionId) {
      this.sendErrorToClient(clientId, 'Missing connectionId');
      return;
    }
    
    // Check if client owns this connection
    if (!client.connectionIds.includes(message.connectionId)) {
      this.sendErrorToClient(clientId, 'Invalid connectionId');
      return;
    }
    
    // Map message type to SignalingMessageType
    let signalingType: SignalingMessageType;
    switch (message.type) {
      case 'offer':
        signalingType = SignalingMessageType.OFFER;
        break;
      case 'answer':
        signalingType = SignalingMessageType.ANSWER;
        break;
      case 'ice-candidate':
        signalingType = SignalingMessageType.ICE_CANDIDATE;
        break;
      case 'connection-state':
        signalingType = SignalingMessageType.CONNECTION_STATE;
        break;
      case 'close':
        signalingType = SignalingMessageType.CLOSE;
        break;
      default:
        this.sendErrorToClient(clientId, `Unknown signaling message type: ${message.type}`);
        return;
    }
    
    // Create signaling message
    const signalingMessage: SignalingMessage = {
      type: signalingType,
      connectionId: message.connectionId,
      data: message.data
    };
    
    // Forward message to peer connection manager
    const result = this.peerConnectionManager.handleSignalingMessage(
      message.connectionId,
      signalingMessage
    );
    
    if (!result) {
      this.sendErrorToClient(clientId, 'Failed to process signaling message');
    }
  }

  /**
   * Handle client disconnect
   * 
   * @param clientId Client identifier
   */
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Close all peer connections for this client
    for (const connectionId of client.connectionIds) {
      this.peerConnectionManager.closeConnection(connectionId);
    }
    
    // Remove client
    this.clients.delete(clientId);
    
    // Emit client disconnected event
    this.emit(SignalingServerEvent.CLIENT_DISCONNECTED, {
      clientId
    });
  }

  /**
   * Handle server error
   * 
   * @param error Error object
   */
  private handleServerError(error: Error): void {
    console.error('WebRTC signaling server error:', error);
    
    // Emit error event
    this.emit(SignalingServerEvent.ERROR, {
      error
    });
  }

  /**
   * Send message to client
   * 
   * @param clientId Client identifier
   * @param message Message to send
   * @returns Whether the message was sent successfully
   */
  private sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Send error message to client
   * 
   * @param clientId Client identifier
   * @param errorMessage Error message
   * @returns Whether the message was sent successfully
   */
  private sendErrorToClient(clientId: string, errorMessage: string): boolean {
    return this.sendToClient(clientId, {
      type: 'error',
      error: errorMessage
    });
  }

  /**
   * Set up peer connection manager events
   */
  private setupPeerConnectionEvents(): void {
    // Connection state change event
    this.peerConnectionManager.on('connectionStateChange', (event) => {
      // Forward event to interested parties
      this.emit('connection-state-change', event);
    });
    
    // Connected event
    this.peerConnectionManager.on('connected', (event) => {
      this.emit(SignalingServerEvent.CONNECTION_ESTABLISHED, event);
    });
    
    // Disconnected event
    this.peerConnectionManager.on('disconnected', (event) => {
      this.emit(SignalingServerEvent.CONNECTION_CLOSED, event);
    });
    
    // Close event
    this.peerConnectionManager.on('close', (event) => {
      this.emit(SignalingServerEvent.CONNECTION_CLOSED, event);
    });
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    // Clear existing interval if any
    this.stopPingInterval();
    
    // Start new interval
    this.pingIntervalHandle = setInterval(
      this.pingClients.bind(this),
      this.config.pingInterval
    );
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingIntervalHandle) {
      clearInterval(this.pingIntervalHandle);
      this.pingIntervalHandle = null;
    }
  }

  /**
   * Ping all clients to keep connections alive and detect inactive clients
   */
  private pingClients(): void {
    const now = Date.now();
    const maxInactivity = this.config.maxInactivityTimeout || 60000;
    
    // Check all clients
    for (const [clientId, client] of this.clients.entries()) {
      // Check if client is inactive
      if (now - client.lastActivity > maxInactivity) {
        console.log(`Client ${clientId} inactive, closing connection`);
        
        try {
          client.ws.close();
        } catch (error) {
          console.error(`Error closing inactive client ${clientId}:`, error);
        }
        
        this.handleClientDisconnect(clientId);
        continue;
      }
      
      // Send ping to client
      this.sendToClient(clientId, { type: 'ping' });
    }
  }
}