/**
 * MJPEG Protocol Implementation
 *
 * Implements the Motion JPEG camera protocol for the OmniSight system.
 * This protocol is widely supported by legacy IP cameras and provides
 * compatibility with older systems.
 */

import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { Readable, Transform } from 'stream';
import { AbstractCameraProtocol } from '../AbstractCameraProtocol';
import { ICameraProtocol, CameraCapability } from '../interfaces/ICameraProtocol';

/**
 * MJPEG connection options
 */
export interface MJPEGConnectionOptions {
  // URL of the MJPEG stream
  url: string;

  // Authentication credentials
  username?: string;
  password?: string;

  // Connection timeout in milliseconds
  timeout?: number;

  // Whether to use HTTPS for connection
  useHttps?: boolean;

  // Request headers
  headers?: Record<string, string>;

  // Whether to validate SSL certificates
  validateCertificate?: boolean;

  // Reconnection settings
  reconnect?: {
    // Whether to automatically reconnect
    enabled: boolean;

    // Maximum number of reconnection attempts
    maxAttempts?: number;

    // Delay between reconnection attempts in milliseconds
    delay?: number;

    // Whether to use exponential backoff for reconnection
    useExponentialBackoff?: boolean;
  };
}

/**
 * MJPEG streaming options
 */
export interface MJPEGStreamingOptions {
  // Maximum frame rate to process (0 = no limit)
  maxFrameRate?: number;

  // Whether to enable motion detection
  enableMotionDetection?: boolean;

  // Frame scaling options
  scaling?: {
    // Whether to scale frames
    enabled: boolean;

    // Target width
    width?: number;

    // Target height
    height?: number;

    // Scaling quality (0-100)
    quality?: number;
  };

  // Frame buffer size (number of frames)
  bufferSize?: number;
}

/**
 * MJPEG protocol events
 */
export enum MJPEGProtocolEvent {
  CONNECTED = 'mjpeg:connected',
  DISCONNECTED = 'mjpeg:disconnected',
  RECONNECTING = 'mjpeg:reconnecting',
  FRAME_RECEIVED = 'mjpeg:frame_received',
  ERROR = 'mjpeg:error',
  BUFFER_FULL = 'mjpeg:buffer_full',
  BUFFER_EMPTY = 'mjpeg:buffer_empty',
  FRAME_RATE_CHANGE = 'mjpeg:frame_rate_change',
}

/**
 * MJPEG frame type
 */
export interface MJPEGFrame {
  // Frame data
  data: Buffer;

  // Frame timestamp
  timestamp: Date;

  // Frame sequence number
  sequenceNumber: number;

  // Frame content type
  contentType: string;

  // Frame content length
  contentLength: number;

  // Custom headers from the frame
  headers: Record<string, string>;
}

/**
 * MJPEG protocol status
 */
export enum MJPEGProtocolStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * MJPEG protocol statistics
 */
export interface MJPEGProtocolStats {
  // Current status
  status: MJPEGProtocolStatus;

  // Connection timestamp
  connectionTimestamp?: Date;

  // Time connected in seconds
  timeConnected?: number;

  // Number of frames received
  framesReceived: number;

  // Current frame rate
  frameRate: number;

  // Total bytes received
  bytesReceived: number;

  // Current bitrate in bits per second
  bitrate: number;

  // Number of reconnection attempts
  reconnectionAttempts: number;

  // Last error message
  lastError?: string;

  // Buffer statistics
  buffer: {
    // Current buffer size in frames
    size: number;

    // Maximum buffer size
    capacity: number;

    // Buffer utilization percentage
    utilization: number;
  };
}

/**
 * MJPEG protocol implementation for the OmniSight system
 */
export class MJPEGProtocol extends AbstractCameraProtocol implements ICameraProtocol {
  // Camera capabilities
  private capabilities: Set<CameraCapability> = new Set([
    CameraCapability.STREAM,
    CameraCapability.SNAPSHOT,
  ]);

  // Connection options
  private connectionOptions: MJPEGConnectionOptions;

  // Streaming options
  private streamingOptions: MJPEGStreamingOptions;

  // HTTP client instance
  private httpClient: AxiosInstance;

  // Current connection response
  private response?: http.IncomingMessage;

  // Current connection status
  private status: MJPEGProtocolStatus = MJPEGProtocolStatus.DISCONNECTED;

  // Frame buffer
  private frameBuffer: MJPEGFrame[] = [];

  // Current frame rate
  private frameRate: number = 0;

  // Statistics
  private stats: MJPEGProtocolStats = {
    status: MJPEGProtocolStatus.DISCONNECTED,
    framesReceived: 0,
    frameRate: 0,
    bytesReceived: 0,
    bitrate: 0,
    reconnectionAttempts: 0,
    buffer: {
      size: 0,
      capacity: 0,
      utilization: 0,
    },
  };

  // Sequence number for frames
  private sequenceNumber: number = 0;

  // Frame rate calculation
  private frameRateCalculation = {
    lastCalculation: Date.now(),
    framesSinceLastCalculation: 0,
  };

  // Bitrate calculation
  private bitrateCalculation = {
    lastCalculation: Date.now(),
    bytesSinceLastCalculation: 0,
  };

  // Reconnection timer
  private reconnectionTimer?: NodeJS.Timeout;

  // Current reconnection attempt
  private currentReconnectionAttempt: number = 0;

  // MJPEG boundary string (used in multipart/x-mixed-replace)
  private boundary: string = '';

  // Current frame buffer (used while parsing a frame)
  private currentFrameBuffer: Buffer[] = [];

  // Current frame headers
  private currentFrameHeaders: Record<string, string> = {};

  // Parser state
  private parserState: 'boundary' | 'headers' | 'content' = 'boundary';

  // Last frame timestamp
  private lastFrameTimestamp: number = 0;

  /**
   * Create a new MJPEG protocol instance
   *
   * @param id Unique identifier for this camera
   * @param name Human-readable name for this camera
   * @param connectionOptions Connection options
   * @param streamingOptions Streaming options
   */
  constructor(
    id: string,
    name: string,
    connectionOptions: MJPEGConnectionOptions,
    streamingOptions: MJPEGStreamingOptions = {}
  ) {
    super(id, name, 'mjpeg');

    this.connectionOptions = this.validateConnectionOptions(connectionOptions);
    this.streamingOptions = this.validateStreamingOptions(streamingOptions);

    // Create HTTP client
    this.httpClient = axios.create({
      timeout: this.connectionOptions.timeout,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({
        keepAlive: true,
        rejectUnauthorized: this.connectionOptions.validateCertificate,
      }),
      headers: this.connectionOptions.headers,
      auth:
        this.connectionOptions.username && this.connectionOptions.password
          ? {
              username: this.connectionOptions.username,
              password: this.connectionOptions.password,
            }
          : undefined,
      responseType: 'stream',
    });

    // Update buffer capacity in stats
    this.stats.buffer.capacity = this.streamingOptions.bufferSize || 30;
  }

  /**
   * Validate connection options and apply defaults
   *
   * @param options Connection options to validate
   * @returns Validated connection options
   */
  private validateConnectionOptions(options: MJPEGConnectionOptions): MJPEGConnectionOptions {
    if (!options.url) {
      throw new Error('MJPEG connection URL is required');
    }

    return {
      ...options,
      timeout: options.timeout || 10000,
      useHttps: options.useHttps !== false,
      validateCertificate: options.validateCertificate !== false,
      reconnect: {
        enabled: options.reconnect?.enabled !== false,
        maxAttempts: options.reconnect?.maxAttempts || 10,
        delay: options.reconnect?.delay || 1000,
        useExponentialBackoff: options.reconnect?.useExponentialBackoff !== false,
      },
    };
  }

  /**
   * Validate streaming options and apply defaults
   *
   * @param options Streaming options to validate
   * @returns Validated streaming options
   */
  private validateStreamingOptions(options: MJPEGStreamingOptions): MJPEGStreamingOptions {
    return {
      ...options,
      maxFrameRate: options.maxFrameRate || 0,
      enableMotionDetection: options.enableMotionDetection || false,
      scaling: {
        enabled: options.scaling?.enabled || false,
        width: options.scaling?.width,
        height: options.scaling?.height,
        quality: options.scaling?.quality || 90,
      },
      bufferSize: options.bufferSize || 30,
    };
  }

  /**
   * Connect to the MJPEG camera stream
   *
   * @returns Promise that resolves when connected
   */
  public async connect(): Promise<void> {
    if (this.status === MJPEGProtocolStatus.CONNECTED) {
      return Promise.resolve();
    }

    try {
      this.status = MJPEGProtocolStatus.CONNECTING;
      this.logger.info(`Connecting to MJPEG stream: ${this.connectionOptions.url}`);

      // Make HTTP request to MJPEG stream
      const response = await this.httpClient.get(this.connectionOptions.url, {
        maxRedirects: 5,
      });

      // Get response stream
      this.response = response.data;

      // Check response headers
      const contentType = response.headers['content-type'];
      if (!contentType) {
        throw new Error('Missing Content-Type header in MJPEG stream response');
      }

      // Parse boundary from content type
      if (contentType.startsWith('multipart/x-mixed-replace')) {
        const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
        if (boundaryMatch && boundaryMatch[1]) {
          this.boundary = boundaryMatch[1];
          this.logger.debug(`Found MJPEG boundary: ${this.boundary}`);
        } else {
          throw new Error('Missing boundary in Content-Type header');
        }
      } else {
        throw new Error(
          `Unexpected Content-Type: ${contentType}, expected multipart/x-mixed-replace`
        );
      }

      // Set up the stream parser
      this.setupStreamParser();

      // Update status and stats
      this.status = MJPEGProtocolStatus.CONNECTED;
      this.stats.status = MJPEGProtocolStatus.CONNECTED;
      this.stats.connectionTimestamp = new Date();
      this.currentReconnectionAttempt = 0;

      // Emit connected event
      this.emit(MJPEGProtocolEvent.CONNECTED, {
        cameraId: this.id,
        url: this.connectionOptions.url,
        timestamp: new Date(),
      });

      return Promise.resolve();
    } catch (error) {
      this.handleConnectionError(error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Disconnect from the MJPEG camera stream
   *
   * @returns Promise that resolves when disconnected
   */
  public async disconnect(): Promise<void> {
    if (this.status === MJPEGProtocolStatus.DISCONNECTED) {
      return Promise.resolve();
    }

    try {
      // Clear reconnection timer if any
      if (this.reconnectionTimer) {
        clearTimeout(this.reconnectionTimer);
        this.reconnectionTimer = undefined;
      }

      // Abort response if any
      if (this.response) {
        this.response.destroy();
        this.response = undefined;
      }

      // Update status and stats
      this.status = MJPEGProtocolStatus.DISCONNECTED;
      this.stats.status = MJPEGProtocolStatus.DISCONNECTED;

      if (this.stats.connectionTimestamp) {
        this.stats.timeConnected = (Date.now() - this.stats.connectionTimestamp.getTime()) / 1000;
      }

      // Emit disconnected event
      this.emit(MJPEGProtocolEvent.DISCONNECTED, {
        cameraId: this.id,
        timestamp: new Date(),
      });

      return Promise.resolve();
    } catch (error) {
      this.logger.error(`Error during MJPEG disconnect: ${error}`);
      return Promise.reject(error);
    }
  }

  /**
   * Restart the MJPEG camera stream connection
   *
   * @returns Promise that resolves when reconnected
   */
  public async restart(): Promise<void> {
    try {
      await this.disconnect();
      await this.connect();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Check if the protocol is connected
   *
   * @returns True if connected, false otherwise
   */
  public isConnected(): boolean {
    return this.status === MJPEGProtocolStatus.CONNECTED;
  }

  /**
   * Set up the stream parser for MJPEG
   */
  private setupStreamParser(): void {
    if (!this.response) {
      return;
    }

    // Reset parser state
    this.parserState = 'boundary';
    this.currentFrameBuffer = [];
    this.currentFrameHeaders = {};

    // Parse the MJPEG stream
    this.response.on('data', (chunk: Buffer) => {
      this.parseChunk(chunk);
    });

    // Handle errors
    this.response.on('error', error => {
      this.handleConnectionError(error);
    });

    // Handle end of stream
    this.response.on('end', () => {
      if (this.status === MJPEGProtocolStatus.CONNECTED) {
        this.logger.warn('MJPEG stream ended unexpectedly');
        this.handleUnexpectedDisconnection();
      }
    });

    // Handle close
    this.response.on('close', () => {
      if (this.status === MJPEGProtocolStatus.CONNECTED) {
        this.logger.warn('MJPEG stream closed unexpectedly');
        this.handleUnexpectedDisconnection();
      }
    });
  }

  /**
   * Parse a chunk of data from the MJPEG stream
   *
   * @param chunk Chunk of data to parse
   */
  private parseChunk(chunk: Buffer): void {
    // Update received bytes for bitrate calculation
    this.stats.bytesReceived += chunk.length;
    this.bitrateCalculation.bytesSinceLastCalculation += chunk.length;

    // Handle different parser states
    switch (this.parserState) {
      case 'boundary':
        this.parseBoundary(chunk);
        break;
      case 'headers':
        this.parseHeaders(chunk);
        break;
      case 'content':
        this.parseContent(chunk);
        break;
    }

    // Calculate frame rate and bitrate periodically
    this.calculateMetrics();
  }

  /**
   * Parse boundary in MJPEG stream
   *
   * @param chunk Chunk of data to parse
   */
  private parseBoundary(chunk: Buffer): void {
    // Convert chunk to string for easier processing
    const chunkStr = chunk.toString('utf8');

    // Look for boundary
    if (chunkStr.includes(this.boundary)) {
      // Move to headers state
      this.parserState = 'headers';

      // Keep data after boundary for header parsing
      const boundaryIndex = chunkStr.indexOf(this.boundary) + this.boundary.length;
      const remainingData = chunk.slice(boundaryIndex);

      if (remainingData.length > 0) {
        this.parseHeaders(remainingData);
      }
    }
  }

  /**
   * Parse headers in MJPEG stream
   *
   * @param chunk Chunk of data to parse
   */
  private parseHeaders(chunk: Buffer): void {
    // Convert chunk to string for easier processing
    const chunkStr = chunk.toString('utf8');

    // Check for end of headers (double CRLF)
    const headersEndIndex = chunkStr.indexOf('\r\n\r\n');

    if (headersEndIndex !== -1) {
      // Extract headers
      const headersStr = chunkStr.substring(0, headersEndIndex);
      const headerLines = headersStr.split('\r\n');

      // Parse headers
      for (const line of headerLines) {
        if (line.trim().length === 0) continue;

        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const name = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          this.currentFrameHeaders[name] = value;
        }
      }

      // Move to content state
      this.parserState = 'content';

      // Keep data after headers for content parsing
      const remainingData = chunk.slice(headersEndIndex + 4); // +4 for \r\n\r\n

      if (remainingData.length > 0) {
        this.parseContent(remainingData);
      }
    }
  }

  /**
   * Parse content in MJPEG stream
   *
   * @param chunk Chunk of data to parse
   */
  private parseContent(chunk: Buffer): void {
    // Get content length from headers
    const contentLength = parseInt(this.currentFrameHeaders['content-length'] || '0', 10);

    if (isNaN(contentLength) || contentLength <= 0) {
      // No content length, try to detect boundary
      const chunkStr = chunk.toString('utf8');
      const boundaryIndex = chunkStr.indexOf('--' + this.boundary);

      if (boundaryIndex !== -1) {
        // Found boundary, extract frame data before boundary
        const frameData = chunk.slice(0, boundaryIndex);
        this.currentFrameBuffer.push(frameData);

        // Process the frame
        this.processFrame();

        // Move to boundary state
        this.parserState = 'boundary';

        // Keep data after boundary for next frame
        const remainingData = chunk.slice(boundaryIndex);

        if (remainingData.length > 0) {
          this.parseBoundary(remainingData);
        }
      } else {
        // No boundary found, store chunk for later
        this.currentFrameBuffer.push(chunk);
      }
    } else {
      // Content length specified, check current buffer size
      const currentSize = this.currentFrameBuffer.reduce((size, buf) => size + buf.length, 0);

      if (currentSize + chunk.length >= contentLength) {
        // We have enough data to complete the frame
        const remainingBytes = contentLength - currentSize;
        this.currentFrameBuffer.push(chunk.slice(0, remainingBytes));

        // Process the frame
        this.processFrame();

        // Move to boundary state
        this.parserState = 'boundary';

        // Keep data after content for next frame
        const remainingData = chunk.slice(remainingBytes);

        if (remainingData.length > 0) {
          this.parseBoundary(remainingData);
        }
      } else {
        // Still need more data
        this.currentFrameBuffer.push(chunk);
      }
    }
  }

  /**
   * Process a complete frame
   */
  private processFrame(): void {
    try {
      // Create frame data buffer
      const frameData = Buffer.concat(this.currentFrameBuffer);

      // Get content type
      const contentType = this.currentFrameHeaders['content-type'] || 'image/jpeg';

      // Create frame object
      const frame: MJPEGFrame = {
        data: frameData,
        timestamp: new Date(),
        sequenceNumber: this.sequenceNumber++,
        contentType: contentType,
        contentLength: frameData.length,
        headers: { ...this.currentFrameHeaders },
      };

      // Add frame to buffer
      this.addFrameToBuffer(frame);

      // Update stats
      this.stats.framesReceived++;
      this.frameRateCalculation.framesSinceLastCalculation++;

      // Update last frame timestamp
      this.lastFrameTimestamp = Date.now();

      // Reset frame buffer and headers for next frame
      this.currentFrameBuffer = [];
      this.currentFrameHeaders = {};

      // Emit frame received event
      this.emit(MJPEGProtocolEvent.FRAME_RECEIVED, {
        cameraId: this.id,
        frame: frame,
      });
    } catch (error) {
      this.logger.error(`Error processing MJPEG frame: ${error}`);

      // Reset frame buffer and headers for next frame
      this.currentFrameBuffer = [];
      this.currentFrameHeaders = {};
    }
  }

  /**
   * Add frame to the frame buffer
   *
   * @param frame Frame to add
   */
  private addFrameToBuffer(frame: MJPEGFrame): void {
    // Check buffer size limit
    if (this.frameBuffer.length >= (this.streamingOptions.bufferSize || 30)) {
      // Remove oldest frame
      this.frameBuffer.shift();

      // Emit buffer full event if this is the first overflow
      if (this.frameBuffer.length === (this.streamingOptions.bufferSize || 30)) {
        this.emit(MJPEGProtocolEvent.BUFFER_FULL, {
          cameraId: this.id,
          bufferSize: this.frameBuffer.length,
        });
      }
    }

    // Add frame to buffer
    this.frameBuffer.push(frame);

    // Update buffer stats
    this.stats.buffer.size = this.frameBuffer.length;
    this.stats.buffer.utilization =
      (this.frameBuffer.length / (this.streamingOptions.bufferSize || 30)) * 100;

    // Emit buffer empty event if buffer was empty
    if (this.frameBuffer.length === 1) {
      this.emit(MJPEGProtocolEvent.BUFFER_EMPTY, {
        cameraId: this.id,
        bufferSize: this.frameBuffer.length,
      });
    }
  }

  /**
   * Calculate frame rate and bitrate
   */
  private calculateMetrics(): void {
    const now = Date.now();

    // Calculate frame rate every second
    if (now - this.frameRateCalculation.lastCalculation >= 1000) {
      const seconds = (now - this.frameRateCalculation.lastCalculation) / 1000;
      this.frameRate = this.frameRateCalculation.framesSinceLastCalculation / seconds;

      // Update stats
      this.stats.frameRate = this.frameRate;

      // Emit frame rate change event if significant change
      const previousFrameRate = this.stats.frameRate;
      if (Math.abs(this.frameRate - previousFrameRate) > 1) {
        this.emit(MJPEGProtocolEvent.FRAME_RATE_CHANGE, {
          cameraId: this.id,
          previousFrameRate: previousFrameRate,
          currentFrameRate: this.frameRate,
        });
      }

      // Reset frame rate calculation
      this.frameRateCalculation.lastCalculation = now;
      this.frameRateCalculation.framesSinceLastCalculation = 0;
    }

    // Calculate bitrate every second
    if (now - this.bitrateCalculation.lastCalculation >= 1000) {
      const seconds = (now - this.bitrateCalculation.lastCalculation) / 1000;
      const bitsPerSecond = (this.bitrateCalculation.bytesSinceLastCalculation * 8) / seconds;

      // Update stats
      this.stats.bitrate = bitsPerSecond;

      // Reset bitrate calculation
      this.bitrateCalculation.lastCalculation = now;
      this.bitrateCalculation.bytesSinceLastCalculation = 0;
    }
  }

  /**
   * Handle connection error
   *
   * @param error Error to handle
   */
  private handleConnectionError(error: Error): void {
    this.logger.error(`MJPEG connection error: ${error.message}`);

    // Update status and stats
    this.status = MJPEGProtocolStatus.ERROR;
    this.stats.status = MJPEGProtocolStatus.ERROR;
    this.stats.lastError = error.message;

    // Emit error event
    this.emit(MJPEGProtocolEvent.ERROR, {
      cameraId: this.id,
      error: error,
      timestamp: new Date(),
    });

    // Try to reconnect if enabled
    this.handleUnexpectedDisconnection();
  }

  /**
   * Handle unexpected disconnection
   */
  private handleUnexpectedDisconnection(): void {
    // Clear current response
    this.response = undefined;

    // Check reconnection settings
    if (!this.connectionOptions.reconnect?.enabled) {
      this.status = MJPEGProtocolStatus.DISCONNECTED;
      this.stats.status = MJPEGProtocolStatus.DISCONNECTED;
      return;
    }

    // Check max reconnection attempts
    if (
      this.connectionOptions.reconnect.maxAttempts !== undefined &&
      this.currentReconnectionAttempt >= this.connectionOptions.reconnect.maxAttempts
    ) {
      this.logger.warn(
        `MJPEG reached maximum reconnection attempts (${this.connectionOptions.reconnect.maxAttempts})`
      );
      this.status = MJPEGProtocolStatus.DISCONNECTED;
      this.stats.status = MJPEGProtocolStatus.DISCONNECTED;
      return;
    }

    // Update status and stats
    this.status = MJPEGProtocolStatus.RECONNECTING;
    this.stats.status = MJPEGProtocolStatus.RECONNECTING;
    this.currentReconnectionAttempt++;
    this.stats.reconnectionAttempts++;

    // Calculate reconnection delay with exponential backoff if enabled
    let reconnectionDelay = this.connectionOptions.reconnect.delay || 1000;

    if (
      this.connectionOptions.reconnect.useExponentialBackoff &&
      this.currentReconnectionAttempt > 1
    ) {
      reconnectionDelay = reconnectionDelay * Math.pow(2, this.currentReconnectionAttempt - 1);
      reconnectionDelay = Math.min(reconnectionDelay, 30000); // Maximum 30 seconds
    }

    // Emit reconnecting event
    this.emit(MJPEGProtocolEvent.RECONNECTING, {
      cameraId: this.id,
      attempt: this.currentReconnectionAttempt,
      delay: reconnectionDelay,
      timestamp: new Date(),
    });

    // Set reconnection timer
    this.reconnectionTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.logger.error(`MJPEG reconnection failed: ${error.message}`);
        this.handleUnexpectedDisconnection();
      });
    }, reconnectionDelay);
  }

  /**
   * Get the current protocol status
   *
   * @returns Current protocol status
   */
  public getStatus(): MJPEGProtocolStatus {
    return this.status;
  }

  /**
   * Get protocol statistics
   *
   * @returns Protocol statistics
   */
  public getStats(): MJPEGProtocolStats {
    // Update time connected if connected
    if (this.status === MJPEGProtocolStatus.CONNECTED && this.stats.connectionTimestamp) {
      this.stats.timeConnected = (Date.now() - this.stats.connectionTimestamp.getTime()) / 1000;
    }

    return { ...this.stats };
  }

  /**
   * Get the latest frame from the buffer
   *
   * @returns Latest frame or undefined if buffer is empty
   */
  public getLatestFrame(): MJPEGFrame | undefined {
    if (this.frameBuffer.length === 0) {
      return undefined;
    }

    return this.frameBuffer[this.frameBuffer.length - 1];
  }

  /**
   * Get frame at specified index from the buffer
   *
   * @param index Index of the frame to get (negative index counts from the end)
   * @returns Frame at specified index or undefined if index is out of bounds
   */
  public getFrameAt(index: number): MJPEGFrame | undefined {
    if (this.frameBuffer.length === 0) {
      return undefined;
    }

    // Handle negative index (count from the end)
    if (index < 0) {
      index = this.frameBuffer.length + index;
    }

    // Check bounds
    if (index < 0 || index >= this.frameBuffer.length) {
      return undefined;
    }

    return this.frameBuffer[index];
  }

  /**
   * Get all frames in the buffer
   *
   * @returns All frames in the buffer
   */
  public getAllFrames(): MJPEGFrame[] {
    return [...this.frameBuffer];
  }

  /**
   * Clear the frame buffer
   */
  public clearFrameBuffer(): void {
    this.frameBuffer = [];
    this.stats.buffer.size = 0;
    this.stats.buffer.utilization = 0;

    // Emit buffer empty event
    this.emit(MJPEGProtocolEvent.BUFFER_EMPTY, {
      cameraId: this.id,
      bufferSize: 0,
    });
  }

  /**
   * Take a snapshot of the current frame
   *
   * @returns Promise that resolves with the snapshot data
   */
  public async takeSnapshot(): Promise<Buffer> {
    if (this.status !== MJPEGProtocolStatus.CONNECTED) {
      throw new Error('Cannot take snapshot: MJPEG stream not connected');
    }

    const frame = this.getLatestFrame();
    if (!frame) {
      throw new Error('Cannot take snapshot: No frames available');
    }

    return frame.data;
  }

  /**
   * Get supported capabilities
   *
   * @returns Set of supported capabilities
   */
  public getCapabilities(): Set<CameraCapability> {
    return new Set(this.capabilities);
  }

  /**
   * Check if capability is supported
   *
   * @param capability Capability to check
   * @returns True if capability is supported, false otherwise
   */
  public hasCapability(capability: CameraCapability): boolean {
    return this.capabilities.has(capability);
  }

  /**
   * Create a readable stream of MJPEG frames
   *
   * @returns Readable stream of MJPEG frames
   */
  public createStream(): Readable {
    const stream = new Readable({
      objectMode: true,
      read() {}, // No-op, we push frames in the event handler
    });

    // Define event types
    interface FrameReceivedEvent {
      cameraId: string;
      frame: MJPEGFrame;
    }

    interface ErrorEvent {
      cameraId: string;
      error: Error;
      timestamp: Date;
    }

    // Handle frame received event
    const frameHandler = (event: FrameReceivedEvent) => {
      stream.push(event.frame);
    };

    // Handle disconnect event
    const disconnectHandler = () => {
      stream.push(null); // End the stream
      cleanup();
    };

    // Handle error event
    const errorHandler = (event: ErrorEvent) => {
      stream.emit('error', event.error);
      cleanup();
    };

    // Clean up event handlers
    const cleanup = () => {
      this.removeListener(MJPEGProtocolEvent.FRAME_RECEIVED, frameHandler);
      this.removeListener(MJPEGProtocolEvent.DISCONNECTED, disconnectHandler);
      this.removeListener(MJPEGProtocolEvent.ERROR, errorHandler);
    };

    // Set up event handlers
    this.on(MJPEGProtocolEvent.FRAME_RECEIVED, frameHandler);
    this.on(MJPEGProtocolEvent.DISCONNECTED, disconnectHandler);
    this.on(MJPEGProtocolEvent.ERROR, errorHandler);

    // Clean up when the stream is closed
    stream.on('close', cleanup);

    return stream;
  }

  /**
   * Create a transform stream that converts MJPEG frames to image buffers
   *
   * @returns Transform stream that converts MJPEG frames to image buffers
   */
  public createImageStream(): Transform {
    const transform = new Transform({
      objectMode: true,
      transform(frame: MJPEGFrame, encoding, callback) {
        try {
          this.push(frame.data);
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
    });

    const stream = this.createStream();
    stream.pipe(transform);

    // Forward errors
    stream.on('error', error => {
      transform.emit('error', error);
    });

    return transform;
  }
}
