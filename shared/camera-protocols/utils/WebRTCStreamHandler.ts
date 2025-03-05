import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WebRTCSignalingServer, SignalingServerEvent } from './WebRTCSignalingServer';

/**
 * WebRTC stream state
 */
export enum WebRTCStreamState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  ERROR = 'error',
  CLOSED = 'closed',
}

/**
 * WebRTC stream configuration
 */
export interface WebRTCStreamConfig {
  id?: string;
  sourceUrl: string;
  encoding?: 'h264' | 'vp8' | 'vp9';
  resolution?: {
    width: number;
    height: number;
  };
  frameRate?: number;
  maxBitrate?: number;
}

/**
 * WebRTC stream statistics
 */
export interface WebRTCStreamStats {
  activeConnections: number;
  totalConnections: number;
  bytesTransferred: number;
  startTime: number;
  errors: number;
}

/**
 * WebRTC stream connection
 */
interface StreamConnection {
  id: string;
  clientId: string;
  streamId: string;
  startTime: number;
  bytesTransferred: number;
}

/**
 * WebRTC stream handler events
 */
export enum WebRTCStreamEvent {
  STREAM_CREATED = 'stream-created',
  STREAM_CLOSED = 'stream-closed',
  CLIENT_CONNECTED = 'client-connected',
  CLIENT_DISCONNECTED = 'client-disconnected',
  ERROR = 'error',
}

/**
 * Interface for stream request event
 */
export interface StreamRequestEvent {
  clientId: string;
  streamId: string;
  options: Record<string, unknown>;
}

/**
 * Interface for connection established event
 */
export interface ConnectionEstablishedEvent {
  connectionId: string;
}

/**
 * Interface for connection closed event
 */
export interface ConnectionClosedEvent {
  connectionId: string;
}

/**
 * Interface for client disconnected event
 */
export interface ClientDisconnectedEvent {
  clientId: string;
}

/**
 * Interface for signaling error event
 */
export interface SignalingErrorEvent {
  error: Error;
}

/**
 * WebRTC stream handler
 * Manages WebRTC stream instances and their connections
 */
export class WebRTCStreamHandler extends EventEmitter {
  /**
   * Active streams
   */
  private streams: Map<
    string,
    {
      config: WebRTCStreamConfig;
      state: WebRTCStreamState;
      stats: WebRTCStreamStats;
      connections: Map<string, StreamConnection>;
    }
  > = new Map();

  /**
   * WebRTC signaling server
   */
  private signalingServer: WebRTCSignalingServer;

  /**
   * Create a new WebRTC stream handler
   *
   * @param signalingServer Signaling server instance
   */
  constructor(signalingServer: WebRTCSignalingServer) {
    super();

    this.signalingServer = signalingServer;

    // Set up signaling server event handlers
    this.setupSignalingEvents();
  }

  /**
   * Set up signaling server event handlers
   */
  private setupSignalingEvents(): void {
    // Handle stream requests
    this.signalingServer.on(
      SignalingServerEvent.STREAM_REQUESTED,
      this.handleStreamRequest.bind(this)
    );

    // Handle connection established
    this.signalingServer.on(
      SignalingServerEvent.CONNECTION_ESTABLISHED,
      this.handleConnectionEstablished.bind(this)
    );

    // Handle connection closed
    this.signalingServer.on(
      SignalingServerEvent.CONNECTION_CLOSED,
      this.handleConnectionClosed.bind(this)
    );

    // Handle client disconnected
    this.signalingServer.on(
      SignalingServerEvent.CLIENT_DISCONNECTED,
      this.handleClientDisconnected.bind(this)
    );

    // Handle errors
    this.signalingServer.on(SignalingServerEvent.ERROR, this.handleSignalingError.bind(this));
  }

  /**
   * Create a new WebRTC stream
   *
   * @param config Stream configuration
   * @returns Stream ID
   */
  public createStream(config: WebRTCStreamConfig): string {
    // Generate stream ID if not provided
    const streamId = config.id || `stream-${uuidv4()}`;

    // Create stream entry
    this.streams.set(streamId, {
      config: {
        ...config,
        id: streamId,
      },
      state: WebRTCStreamState.INITIALIZING,
      stats: {
        activeConnections: 0,
        totalConnections: 0,
        bytesTransferred: 0,
        startTime: Date.now(),
        errors: 0,
      },
      connections: new Map(),
    });

    // Initialize stream (implementation would depend on the source)
    this.initializeStream(streamId);

    // Emit stream created event
    this.emit(WebRTCStreamEvent.STREAM_CREATED, {
      streamId,
      config,
    });

    return streamId;
  }

  /**
   * Initialize stream from source
   * This is a placeholder for actual implementation
   *
   * @param streamId Stream identifier
   */
  private initializeStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return;
    }

    // In a real implementation, this would:
    // 1. Connect to the source stream (RTSP, HLS, etc.)
    // 2. Set up media pipeline
    // 3. Create WebRTC compatible media tracks
    // 4. Initialize any encoding/transcoding needed

    try {
      // Mock implementation for now
      setTimeout(() => {
        // Update stream state to active
        stream.state = WebRTCStreamState.ACTIVE;

        console.log(`WebRTC stream ${streamId} initialized and active`);
      }, 500);
    } catch (error) {
      console.error(`Error initializing stream ${streamId}:`, error);

      stream.state = WebRTCStreamState.ERROR;
      stream.stats.errors++;

      this.emit(WebRTCStreamEvent.ERROR, {
        streamId,
        error,
        message: 'Failed to initialize stream',
      });
    }
  }

  /**
   * Handle stream request from client
   *
   * @param event Stream request event
   */
  private handleStreamRequest(event: StreamRequestEvent): void {
    const { clientId, streamId, options } = event;

    // Check if stream exists
    const stream = this.streams.get(streamId);
    if (!stream) {
      console.error(`Client ${clientId} requested non-existent stream ${streamId}`);
      return;
    }

    // Don't allow connections to streams that aren't active
    if (stream.state !== WebRTCStreamState.ACTIVE) {
      console.error(`Client ${clientId} requested stream ${streamId} which is not active`);
      return;
    }

    // Create peer connection for this stream
    const connectionId = this.signalingServer.createStreamConnection(streamId, {
      encoding: (options.encoding as string) || stream.config.encoding || 'h264',
      resolution:
        (options.resolution as { width: number; height: number }) || stream.config.resolution,
      frameRate: (options.frameRate as number) || stream.config.frameRate,
      maxBitrate: (options.maxBitrate as number) || stream.config.maxBitrate,
    });

    // Create connection record
    stream.connections.set(connectionId, {
      id: connectionId,
      clientId,
      streamId,
      startTime: Date.now(),
      bytesTransferred: 0,
    });

    // Update stats
    stream.stats.totalConnections++;
    stream.stats.activeConnections++;

    // Send stream response to client
    this.signalingServer.sendStreamResponse(clientId, streamId, connectionId);

    console.log(`WebRTC stream connection created for client ${clientId} to stream ${streamId}`);
  }

  /**
   * Handle connection established
   *
   * @param event Connection established event
   */
  private handleConnectionEstablished(event: ConnectionEstablishedEvent): void {
    const { connectionId } = event;

    // Find the stream for this connection
    for (const [streamId, stream] of this.streams.entries()) {
      if (stream.connections.has(connectionId)) {
        const connection = stream.connections.get(connectionId)!;

        // Emit client connected event
        this.emit(WebRTCStreamEvent.CLIENT_CONNECTED, {
          streamId,
          connectionId,
          clientId: connection.clientId,
        });

        console.log(`WebRTC connection ${connectionId} established for stream ${streamId}`);
        return;
      }
    }
  }

  /**
   * Handle connection closed
   *
   * @param event Connection closed event
   */
  private handleConnectionClosed(event: ConnectionClosedEvent): void {
    const { connectionId } = event;

    // Find the stream for this connection
    for (const [streamId, stream] of this.streams.entries()) {
      if (stream.connections.has(connectionId)) {
        const connection = stream.connections.get(connectionId)!;

        // Remove connection
        stream.connections.delete(connectionId);

        // Update stats
        stream.stats.activeConnections--;

        // Emit client disconnected event
        this.emit(WebRTCStreamEvent.CLIENT_DISCONNECTED, {
          streamId,
          connectionId,
          clientId: connection.clientId,
          duration: Date.now() - connection.startTime,
          bytesTransferred: connection.bytesTransferred,
        });

        console.log(`WebRTC connection ${connectionId} closed for stream ${streamId}`);
        return;
      }
    }
  }

  /**
   * Handle client disconnected
   *
   * @param event Client disconnected event
   */
  private handleClientDisconnected(event: ClientDisconnectedEvent): void {
    const { clientId } = event;

    // Find all connections for this client and clean them up
    for (const [, stream] of this.streams.entries()) {
      for (const [connectionId, connection] of stream.connections.entries()) {
        if (connection.clientId === clientId) {
          // Remove connection
          stream.connections.delete(connectionId);

          // Update stats
          stream.stats.activeConnections--;

          console.log(`Removed connection ${connectionId} for disconnected client ${clientId}`);
        }
      }
    }
  }

  /**
   * Handle signaling error
   *
   * @param event Error event
   */
  private handleSignalingError(event: SignalingErrorEvent): void {
    const { error } = event;

    console.error('WebRTC signaling error:', error);

    // Emit error event
    this.emit(WebRTCStreamEvent.ERROR, {
      error,
      message: 'WebRTC signaling error',
    });
  }

  /**
   * Close a stream
   *
   * @param streamId Stream identifier
   */
  public closeStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return;
    }

    // Close all connections for this stream
    for (const connectionId of stream.connections.keys()) {
      // This will trigger the connection closed handler
      const connection = stream.connections.get(connectionId)!;

      // Emit client disconnected event
      this.emit(WebRTCStreamEvent.CLIENT_DISCONNECTED, {
        streamId,
        connectionId,
        clientId: connection.clientId,
        duration: Date.now() - connection.startTime,
        bytesTransferred: connection.bytesTransferred,
      });
    }

    // Update stream state
    stream.state = WebRTCStreamState.CLOSED;

    // Remove stream
    this.streams.delete(streamId);

    // Emit stream closed event
    this.emit(WebRTCStreamEvent.STREAM_CLOSED, {
      streamId,
      stats: stream.stats,
    });

    console.log(`WebRTC stream ${streamId} closed`);
  }

  /**
   * Close all streams
   */
  public closeAllStreams(): void {
    for (const streamId of this.streams.keys()) {
      this.closeStream(streamId);
    }
  }

  /**
   * Get stream statistics
   *
   * @param streamId Stream identifier
   * @returns Stream statistics or undefined if stream not found
   */
  public getStreamStats(streamId: string): WebRTCStreamStats | undefined {
    return this.streams.get(streamId)?.stats;
  }

  /**
   * Get all stream IDs
   *
   * @returns Array of stream IDs
   */
  public getStreamIds(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Get all active stream connections
   *
   * @param streamId Stream identifier
   * @returns Array of connection IDs
   */
  public getStreamConnections(streamId: string): string[] {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return [];
    }

    return Array.from(stream.connections.keys());
  }

  /**
   * Record bytes transferred for a connection
   * Useful for tracking bandwidth usage
   *
   * @param connectionId Connection identifier
   * @param bytes Number of bytes transferred
   */
  public recordBytesTransferred(connectionId: string, bytes: number): void {
    // Find the connection
    for (const stream of this.streams.values()) {
      const connection = stream.connections.get(connectionId);
      if (connection) {
        // Update connection bytes
        connection.bytesTransferred += bytes;

        // Update stream bytes
        stream.stats.bytesTransferred += bytes;
        return;
      }
    }
  }
}
