import { EventEmitter } from 'events';
import * as sdpTransform from 'sdp-transform';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

/**
 * Peer connection state
 */
export enum PeerConnectionState {
  NEW = 'new',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed'
}

/**
 * Interface for ICE Server configuration
 */
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * WebRTC peer connection configuration
 */
export interface PeerConnectionConfig {
  id: string;
  iceServers: IceServerConfig[];
  maxBitrate?: number;
  encoding?: string;
  resolution?: {
    width: number;
    height: number;
  };
  frameRate?: number;
}

/**
 * Signaling message types
 */
export enum SignalingMessageType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice-candidate',
  CONNECTION_STATE = 'connection-state',
  ERROR = 'error',
  CLOSE = 'close'
}

/**
 * Signaling message interface
 */
export interface SignalingMessage {
  type: SignalingMessageType;
  connectionId?: string;
  data?: any;
  error?: string;
}

/**
 * WebRTC peer connection manager class
 * Handles WebRTC peer connections and signaling for the camera protocol
 */
export class PeerConnectionManager extends EventEmitter {
  /**
   * Active peer connections
   */
  private connections: Map<string, {
    state: PeerConnectionState;
    config: PeerConnectionConfig;
    client?: WebSocket;
    lastActivity: number;
    sdpOffer?: any;
    sdpAnswer?: any;
    iceCandidates: any[];
  }> = new Map();

  /**
   * WebSocket OPEN state constant
   */
  private readonly WS_OPEN: number = 1;

  /**
   * Create a new peer connection manager
   */
  constructor() {
    super();
    
    // Start maintenance interval
    setInterval(this.performMaintenance.bind(this), 30000); // Every 30 seconds
  }

  /**
   * Create a new peer connection
   * 
   * @param config Peer connection configuration
   * @returns Connection ID
   */
  public createConnection(config: PeerConnectionConfig): string {
    const connectionId = config.id || uuidv4();
    
    this.connections.set(connectionId, {
      state: PeerConnectionState.NEW,
      config,
      lastActivity: Date.now(),
      iceCandidates: []
    });
    
    return connectionId;
  }

  /**
   * Get connection state
   * 
   * @param connectionId Connection ID
   * @returns Connection state or undefined if not found
   */
  public getConnectionState(connectionId: string): PeerConnectionState | undefined {
    return this.connections.get(connectionId)?.state;
  }

  /**
   * Associate a client with a connection
   * 
   * @param connectionId Connection ID
   * @param client WebSocket client
   * @returns True if successful, false otherwise
   */
  public associateClient(connectionId: string, client: WebSocket): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }
    
    connection.client = client;
    connection.lastActivity = Date.now();
    
    return true;
  }

  /**
   * Handle signaling message
   * 
   * @param connectionId Connection ID
   * @param message Signaling message
   * @returns True if successful, false otherwise
   */
  public handleSignalingMessage(connectionId: string, message: SignalingMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }
    
    // Update activity timestamp
    connection.lastActivity = Date.now();
    
    // Process message based on type
    switch (message.type) {
      case SignalingMessageType.OFFER:
        return this.handleOffer(connectionId, message.data);
        
      case SignalingMessageType.ANSWER:
        return this.handleAnswer(connectionId, message.data);
        
      case SignalingMessageType.ICE_CANDIDATE:
        return this.handleIceCandidate(connectionId, message.data);
        
      case SignalingMessageType.CONNECTION_STATE:
        return this.handleConnectionState(connectionId, message.data);
        
      case SignalingMessageType.CLOSE:
        this.closeConnection(connectionId);
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Handle SDP offer
   * 
   * @param connectionId Connection ID
   * @param offer SDP offer
   * @returns True if successful, false otherwise
   */
  private handleOffer(connectionId: string, offer: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }
    
    // Process and store the offer
    connection.sdpOffer = offer;
    
    // Update connection state
    this.updateConnectionState(connectionId, PeerConnectionState.CONNECTING);
    
    // Create a modified SDP answer based on the connection config
    const answer = this.createSdpAnswer(offer, connection.config);
    connection.sdpAnswer = answer;
    
    // Send the answer to the client
    this.sendSignalingMessage(connectionId, {
      type: SignalingMessageType.ANSWER,
      connectionId,
      data: answer
    });
    
    // Emit event for the offer
    this.emit('offer', {
      connectionId,
      offer,
      config: connection.config
    });
    
    return true;
  }

  /**
   * Handle SDP answer
   * 
   * @param connectionId Connection ID
   * @param answer SDP answer
   * @returns True if successful, false otherwise
   */
  private handleAnswer(connectionId: string, answer: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }
    
    // Store the answer
    connection.sdpAnswer = answer;
    
    // Update connection state
    this.updateConnectionState(connectionId, PeerConnectionState.CONNECTING);
    
    // Emit event for the answer
    this.emit('answer', {
      connectionId,
      answer,
      config: connection.config
    });
    
    return true;
  }

  /**
   * Handle ICE candidate
   * 
   * @param connectionId Connection ID
   * @param candidate ICE candidate
   * @returns True if successful, false otherwise
   */
  private handleIceCandidate(connectionId: string, candidate: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }
    
    // Store the ICE candidate
    connection.iceCandidates.push(candidate);
    
    // Emit event for the ICE candidate
    this.emit('iceCandidate', {
      connectionId,
      candidate,
      config: connection.config
    });
    
    return true;
  }

  /**
   * Handle connection state update
   * 
   * @param connectionId Connection ID
   * @param state Connection state
   * @returns True if successful, false otherwise
   */
  private handleConnectionState(connectionId: string, state: string): boolean {
    // Update connection state based on client report
    if (Object.values(PeerConnectionState).includes(state as PeerConnectionState)) {
      this.updateConnectionState(connectionId, state as PeerConnectionState);
      return true;
    }
    
    return false;
  }

  /**
   * Update connection state
   * 
   * @param connectionId Connection ID
   * @param state New connection state
   */
  private updateConnectionState(connectionId: string, state: PeerConnectionState): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }
    
    // Update state
    connection.state = state;
    
    // Emit state change event
    this.emit('connectionStateChange', {
      connectionId,
      state,
      config: connection.config
    });
    
    // Notify the client
    this.sendSignalingMessage(connectionId, {
      type: SignalingMessageType.CONNECTION_STATE,
      connectionId,
      data: state
    });
    
    // If connected, emit connected event
    if (state === PeerConnectionState.CONNECTED) {
      this.emit('connected', {
        connectionId,
        config: connection.config
      });
    }
    
    // If disconnected, failed, or closed, emit disconnected event
    if (
      state === PeerConnectionState.DISCONNECTED ||
      state === PeerConnectionState.FAILED ||
      state === PeerConnectionState.CLOSED
    ) {
      this.emit('disconnected', {
        connectionId,
        state,
        config: connection.config
      });
    }
  }

  /**
   * Send signaling message to client
   * 
   * @param connectionId Connection ID
   * @param message Signaling message
   * @returns True if successful, false otherwise
   */
  public sendSignalingMessage(connectionId: string, message: SignalingMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.client) {
      return false;
    }
    
    // Check if client is connected
    if (connection.client.readyState !== this.WS_OPEN) {
      return false;
    }
    
    try {
      // Send message to client
      connection.client.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending signaling message to client (${connectionId}):`, error);
      return false;
    }
  }

  /**
   * Create SDP answer based on offer and configuration
   * 
   * @param offer SDP offer
   * @param config Peer connection configuration
   * @returns SDP answer
   */
  private createSdpAnswer(offer: any, config: PeerConnectionConfig): any {
    try {
      // Parse the SDP offer
      const sdpObj = sdpTransform.parse(offer.sdp);
      
      // Find the video media section
      const videoMedia = sdpObj.media.find((m: any) => m.type === 'video');
      
      if (videoMedia) {
        // Apply bitrate constraint if specified
        if (config.maxBitrate) {
          this.applyBitrateConstraint(videoMedia, config.maxBitrate);
        }
        
        // Apply resolution constraint if specified
        if (config.resolution) {
          this.applyResolutionConstraint(videoMedia, config.resolution);
        }
        
        // Apply framerate constraint if specified
        if (config.frameRate) {
          this.applyFramerateConstraint(videoMedia, config.frameRate);
        }
        
        // Apply encoding preference if specified
        if (config.encoding) {
          this.applyEncodingPreference(videoMedia, config.encoding);
        }
      }
      
      // Generate the SDP string
      const sdpString = sdpTransform.write(sdpObj);
      
      // Create the answer object
      return {
        type: 'answer',
        sdp: sdpString
      };
    } catch (error) {
      console.error('Error creating SDP answer:', error);
      
      // Return the offer as answer if we couldn't modify it
      return {
        type: 'answer',
        sdp: offer.sdp
      };
    }
  }

  /**
   * Apply bitrate constraint to SDP media section
   * 
   * @param media SDP media section
   * @param maxBitrate Maximum bitrate in kbps
   */
  private applyBitrateConstraint(media: any, maxBitrate: number): void {
    // Convert to bps for SDP
    const bps = maxBitrate * 1000;
    
    // Add or update b=AS line
    media.bandwidth = [
      { type: 'AS', limit: maxBitrate },
      { type: 'TIAS', limit: bps }
    ];
  }

  /**
   * Apply resolution constraint to SDP media section
   * 
   * @param media SDP media section
   * @param resolution Resolution object with width and height
   */
  private applyResolutionConstraint(media: any, resolution: { width: number; height: number }): void {
    // Find or create the imageattr line
    if (!media.fmtp) {
      media.fmtp = [];
    }
    
    // Create or update the image attributes for each codec
    media.fmtp.forEach((fmtp: any) => {
      const config = fmtp.config || '';
      
      // Remove existing resolution parameters
      let newConfig = config.replace(/resolution=\S+;?/, '');
      
      // Add new resolution
      if (newConfig.length > 0 && !newConfig.endsWith(';')) {
        newConfig += ';';
      }
      
      newConfig += `resolution=${resolution.width}x${resolution.height}`;
      
      // Update the config
      fmtp.config = newConfig;
    });
  }

  /**
   * Apply framerate constraint to SDP media section
   * 
   * @param media SDP media section
   * @param frameRate Frame rate
   */
  private applyFramerateConstraint(media: any, frameRate: number): void {
    // Add framerate attribute
    if (!media.framerate) {
      media.framerate = frameRate;
    } else {
      media.framerate = Math.min(media.framerate, frameRate);
    }
  }

  /**
   * Apply encoding preference to SDP media section
   * 
   * @param media SDP media section
   * @param encoding Preferred encoding
   */
  private applyEncodingPreference(media: any, encoding: string): void {
    // Find payload types for the preferred encoding
    const preferredPayloadTypes: number[] = [];
    
    // Check rtpmap for preferred encoding
    if (media.rtp) {
      for (const rtp of media.rtp) {
        // Check for H.264, VP8, VP9, etc.
        if (
          (encoding.toLowerCase() === 'h264' && rtp.codec.toLowerCase().includes('h264')) ||
          (encoding.toLowerCase() === 'vp8' && rtp.codec.toLowerCase().includes('vp8')) ||
          (encoding.toLowerCase() === 'vp9' && rtp.codec.toLowerCase().includes('vp9'))
        ) {
          preferredPayloadTypes.push(rtp.payload);
        }
      }
    }
    
    // Reorder payload types to prioritize preferred encoding
    if (preferredPayloadTypes.length > 0 && media.payloads) {
      const payloads = media.payloads.split(' ').map(Number);
      // Move preferred payload types to the beginning
      const reorderedPayloads = [
        ...preferredPayloadTypes,
        ...payloads.filter((pt: number) => !preferredPayloadTypes.includes(pt))
      ];
      
      // Update payloads
      media.payloads = reorderedPayloads.join(' ');
    }
  }

  /**
   * Close a connection
   * 
   * @param connectionId Connection ID
   */
  public closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }
    
    // Notify client
    this.sendSignalingMessage(connectionId, {
      type: SignalingMessageType.CLOSE,
      connectionId
    });
    
    // Update state
    this.updateConnectionState(connectionId, PeerConnectionState.CLOSED);
    
    // Remove connection
    this.connections.delete(connectionId);
    
    // Emit close event
    this.emit('close', {
      connectionId,
      config: connection.config
    });
  }

  /**
   * Close all connections
   */
  public closeAllConnections(): void {
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }
  }

  /**
   * Get all connections
   * 
   * @returns Map of all connections
   */
  public getAllConnections(): Map<string, {
    state: PeerConnectionState;
    config: PeerConnectionConfig;
  }> {
    // Create a new map with only the public information
    const result = new Map<string, {
      state: PeerConnectionState;
      config: PeerConnectionConfig;
    }>();
    
    for (const [id, connection] of this.connections.entries()) {
      result.set(id, {
        state: connection.state,
        config: connection.config
      });
    }
    
    return result;
  }

  /**
   * Perform periodic maintenance on connections
   */
  private performMaintenance(): void {
    const now = Date.now();
    const inactiveThreshold = 60000; // 60 seconds
    
    // Check for inactive connections
    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > inactiveThreshold) {
        // Connection is inactive, close it
        this.closeConnection(connectionId);
      }
    }
  }
}