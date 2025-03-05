import * as wrtc from 'wrtc';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';

const logger = new Logger('WebRTCSignalingServer');

interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface SessionOptions {
  simulcast?: boolean;
  codec?: string;
  maxBitrate?: number;
  encryption?: boolean;
  keyFrameInterval?: number;
}

interface SessionConfig {
  cameraId: string;
  streamId: string;
  clientId: string;
  options?: SessionOptions;
}

interface SessionInfo {
  id: string;
  cameraId: string;
  streamId: string;
  clientId: string;
  peerConnection?: wrtc.RTCPeerConnection;
  dataChannel?: wrtc.RTCDataChannel;
  options: SessionOptions;
  stats: {
    created: Date;
    lastActivity: Date;
    bytesSent: number;
    bytesReceived: number;
    packetsLost: number;
    bitrate: number;
    framerate: number;
  };
}

/**
 * WebRTC Signaling Server for handling peer connections
 */
export class WebRTCSignalingServer extends EventEmitter {
  private static instance: WebRTCSignalingServer;
  private sessions: Map<string, SessionInfo>;
  private iceServers: ICEServer[];
  private defaultOptions: SessionOptions;

  private constructor() {
    super();
    this.sessions = new Map();
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' }
    ];
    this.defaultOptions = {
      simulcast: false,
      codec: 'h264',
      maxBitrate: 2000,
      encryption: true,
      keyFrameInterval: 60
    };

    // Set up periodic cleanup
    setInterval(() => this.cleanupInactiveSessions(), 60000);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebRTCSignalingServer {
    if (!WebRTCSignalingServer.instance) {
      WebRTCSignalingServer.instance = new WebRTCSignalingServer();
    }
    return WebRTCSignalingServer.instance;
  }

  /**
   * Get ICE servers configuration
   */
  public getIceServers(): ICEServer[] {
    return [...this.iceServers];
  }

  /**
   * Set ICE servers configuration
   */
  public async setIceServers(servers: ICEServer[]): Promise<void> {
    this.iceServers = [...servers];
    logger.info('ICE servers updated', { count: servers.length });
  }

  /**
   * Create a new WebRTC session
   */
  public async createSession(config: SessionConfig): Promise<SessionInfo> {
    const sessionId = uuidv4();
    
    const session: SessionInfo = {
      id: sessionId,
      cameraId: config.cameraId,
      streamId: config.streamId,
      clientId: config.clientId,
      options: { ...this.defaultOptions, ...config.options },
      stats: {
        created: new Date(),
        lastActivity: new Date(),
        bytesSent: 0,
        bytesReceived: 0,
        packetsLost: 0,
        bitrate: 0,
        framerate: 0
      }
    };
    
    // Create peer connection
    const peerConnection = new wrtc.RTCPeerConnection({
      iceServers: this.iceServers
    });
    
    // Set up data channel
    const dataChannel = peerConnection.createDataChannel('control', {
      ordered: true
    });
    
    dataChannel.onopen = () => {
      logger.info('Data channel opened', { sessionId });
      this.emit('dataChannelOpen', sessionId);
    };
    
    dataChannel.onclose = () => {
      logger.info('Data channel closed', { sessionId });
      this.emit('dataChannelClose', sessionId);
    };
    
    dataChannel.onmessage = (event) => {
      logger.debug('Data channel message received', { sessionId, data: event.data });
      this.emit('dataChannelMessage', sessionId, event.data);
    };
    
    // Set up ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        logger.debug('ICE candidate generated', { sessionId });
        this.emit('iceCandidate', sessionId, event.candidate);
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      logger.info('Connection state changed', { 
        sessionId, 
        state: peerConnection.connectionState 
      });
      this.emit('connectionStateChange', sessionId, peerConnection.connectionState);
      
      // Update activity timestamp
      if (this.sessions.has(sessionId)) {
        const sessionInfo = this.sessions.get(sessionId)!;
        sessionInfo.stats.lastActivity = new Date();
      }
    };
    
    session.peerConnection = peerConnection;
    session.dataChannel = dataChannel;
    
    // Store session
    this.sessions.set(sessionId, session);
    
    logger.info('WebRTC session created', { sessionId, cameraId: config.cameraId });
    return session;
  }

  /**
   * Create an offer for a session
   */
  public async createOffer(sessionId: string): Promise<wrtc.RTCSessionDescription | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.peerConnection) {
      logger.error('Session not found', { sessionId });
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      // Create offer
      const offer = await session.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // Set local description
      await session.peerConnection.setLocalDescription(offer);
      
      logger.info('Offer created', { sessionId });
      return offer;
    } catch (error) {
      logger.error('Error creating offer', { sessionId, error });
      throw error;
    }
  }

  /**
   * Handle answer from remote peer
   */
  public async handleAnswer(sessionId: string, answer: wrtc.RTCSessionDescription): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.peerConnection) {
      logger.error('Session not found', { sessionId });
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      await session.peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription(answer));
      logger.info('Answer handled', { sessionId });
      
      // Update activity timestamp
      session.stats.lastActivity = new Date();
    } catch (error) {
      logger.error('Error handling answer', { sessionId, error });
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  public async addIceCandidate(sessionId: string, candidate: wrtc.RTCIceCandidate): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.peerConnection) {
      logger.error('Session not found', { sessionId });
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      await session.peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
      logger.debug('ICE candidate added', { sessionId });
      
      // Update activity timestamp
      session.stats.lastActivity = new Date();
    } catch (error) {
      logger.error('Error adding ICE candidate', { sessionId, error });
      throw error;
    }
  }

  /**
   * Close WebRTC session
   */
  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn('Session not found when closing', { sessionId });
      return;
    }
    
    try {
      // Close data channel
      if (session.dataChannel) {
        session.dataChannel.close();
      }
      
      // Close peer connection
      if (session.peerConnection) {
        session.peerConnection.close();
      }
      
      // Remove session
      this.sessions.delete(sessionId);
      
      logger.info('WebRTC session closed', { sessionId });
      this.emit('sessionClosed', sessionId);
    } catch (error) {
      logger.error('Error closing WebRTC session', { sessionId, error });
      throw error;
    }
  }

  /**
   * Get stream statistics
   */
  public async getStreamStats(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.peerConnection) {
      logger.error('Session not found', { sessionId });
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      const stats = await session.peerConnection.getStats();
      const result: any = { ...session.stats };
      
      // Process stats
      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          result.bytesSent = report.bytesSent;
          result.packetsSent = report.packetsSent;
          
          if (report.framesEncoded && report.timestamp) {
            result.framerate = Math.round(report.framesEncoded / 
              ((Date.now() - session.stats.created.getTime()) / 1000));
          }
          
          if (report.bytesSent && report.timestamp) {
            result.bitrate = Math.round((report.bytesSent * 8) / 
              ((Date.now() - session.stats.created.getTime()) / 1000) / 1000);
          }
        }
        
        if (report.type === 'inbound-rtp') {
          result.bytesReceived = report.bytesReceived;
          result.packetsLost = report.packetsLost;
        }
      });
      
      return result;
    } catch (error) {
      logger.error('Error getting stream stats', { sessionId, error });
      throw error;
    }
  }

  /**
   * Update stream configuration
   */
  public async updateStreamConfig(sessionId: string, config: Partial<SessionOptions>): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.error('Session not found', { sessionId });
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Update session options
    session.options = { ...session.options, ...config };
    
    // Apply configuration changes if possible
    if (session.dataChannel && session.dataChannel.readyState === 'open') {
      session.dataChannel.send(JSON.stringify({
        type: 'config-update',
        config: session.options
      }));
    }
    
    logger.info('Stream config updated', { sessionId, config });
  }

  /**
   * Get active sessions count
   */
  public getSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.stats.lastActivity.getTime();
      
      if (inactiveTime > inactiveThreshold) {
        logger.info('Closing inactive session', { sessionId, inactiveTime });
        this.closeSession(sessionId).catch(error => {
          logger.error('Error closing inactive session', { sessionId, error });
        });
      }
    }
  }
}