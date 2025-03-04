/**
 * MJPEG Protocol Implementation
 * 
 * Implements the Motion JPEG camera protocol for the OmniSight system.
 * This protocol is widely supported by legacy IP cameras and provides
 * compatibility with older systems.
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { Readable, Transform } from 'stream';
import { AbstractCameraProtocol } from '../AbstractCameraProtocol';
import { 
  CameraCapabilities, 
  CameraConfig, 
  CameraEvent, 
  CameraInfo, 
  ConnectionStatus, 
  PtzMovement, 
  StreamOptions, 
  StreamProfile 
} from '../interfaces/ICameraProtocol';

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
  ERROR = 'error'
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
export class MJPEGProtocol extends AbstractCameraProtocol {
  // Protocol identifier
  readonly protocolId: string = 'mjpeg';
  
  // Protocol name
  readonly protocolName: string = 'Motion JPEG';
  
  // Camera capabilities
  readonly capabilities: CameraCapabilities = {
    ptz: false,
    presets: false,
    digitalPtz: true,
    motionDetection: false,
    audio: false,
    twoWayAudio: false,
    encodings: ['mjpeg'],
    authMethods: ['basic'],
    localRecording: false,
    events: false,
    protocolSpecific: {
      supportFrameExtraction: true,
      supportDirectBrowserViewing: true
    }
  };
  
  // HTTP client instance
  private httpClient: AxiosInstance;
  
  // Current connection response
  private response?: http.IncomingMessage;
  
  // Current MJPEG status
  private mjpegStatus: MJPEGProtocolStatus = MJPEGProtocolStatus.DISCONNECTED;
  
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
      capacity: 30,
      utilization: 0
    }
  };
  
  // Sequence number for frames
  private sequenceNumber: number = 0;
  
  // Frame rate calculation
  private frameRateCalculation = {
    lastCalculation: Date.now(),
    framesSinceLastCalculation: 0
  };
  
  // Bitrate calculation
  private bitrateCalculation = {
    lastCalculation: Date.now(),
    bytesSinceLastCalculation: 0
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
  
  // Stream options
  private streamOptions: StreamOptions = {};
  
  // Event emitter for internal events
  private eventEmitter = new EventEmitter();
  
  // Max buffer size
  private maxBufferSize: number = 30;
  
  // Active stream ID
  private activeStreamId?: string;
  
  // Logger
  private logger = {
    debug: (message: string) => console.debug(`[MJPEG] ${message}`),
    info: (message: string) => console.info(`[MJPEG] ${message}`),
    warn: (message: string) => console.warn(`[MJPEG] ${message}`),
    error: (message: string) => console.error(`[MJPEG] ${message}`)
  };
  
  constructor() {
    super();
    
    // Create HTTP client
    this.httpClient = axios.create({
      timeout: 10000,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({
        keepAlive: true,
        rejectUnauthorized: true
      }),
      responseType: 'stream'
    });
  }
  
  /**
   * Connect to the camera
   * 
   * @param config Camera configuration
   * @returns Promise that resolves to true when connected
   */
  protected async performConnect(config: CameraConfig): Promise<boolean> {
    try {
      this.mjpegStatus = MJPEGProtocolStatus.CONNECTING;
      this.logger.info(`Connecting to MJPEG stream: ${config.host}:${config.port}${config.path || ''}`);
      
      // Build URL
      const protocol = config.options?.useHttps ? 'https' : 'http';
      const url = `${protocol}://${config.host}:${config.port}${config.path || ''}`;
      
      // Update axios client configuration
      this.httpClient = axios.create({
        timeout: config.timeout || 10000,
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({
          keepAlive: true,
          rejectUnauthorized: config.options?.validateCertificate !== false
        }),
        headers: config.options?.headers as Record<string, string>,
        auth: config.username && config.password
          ? {
              username: config.username,
              password: config.password
            }
          : undefined,
        responseType: 'stream'
      });
      
      // Make HTTP request to MJPEG stream
      const response = await this.httpClient.get(url, {
        maxRedirects: 5
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
        throw new Error(`Unexpected Content-Type: ${contentType}, expected multipart/x-mixed-replace`);
      }
      
      // Set up the stream parser
      this.setupStreamParser();
      
      // Update status and stats
      this.mjpegStatus = MJPEGProtocolStatus.CONNECTED;
      this.stats.status = MJPEGProtocolStatus.CONNECTED;
      this.stats.connectionTimestamp = new Date();
      this.currentReconnectionAttempt = 0;
      
      return true;
    } catch (error) {
      this.logger.error(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
      this.mjpegStatus = MJPEGProtocolStatus.ERROR;
      this.stats.status = MJPEGProtocolStatus.ERROR;
      this.stats.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }
  
  /**
   * Disconnect from the camera
   */
  protected async performDisconnect(): Promise<void> {
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
    this.mjpegStatus = MJPEGProtocolStatus.DISCONNECTED;
    this.stats.status = MJPEGProtocolStatus.DISCONNECTED;
    
    if (this.stats.connectionTimestamp) {
      this.stats.timeConnected = 
        (Date.now() - this.stats.connectionTimestamp.getTime()) / 1000;
    }
  }
  
  /**
   * Get a frame from the camera
   */
  async getFrame(): Promise<Uint8Array> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Cannot get frame: Camera is not connected');
    }
    
    // Get the latest frame from the buffer
    const frame = this.getLatestFrame();
    if (!frame) {
      throw new Error('No frames available in buffer');
    }
    
    return frame.data;
  }
  
  /**
   * Get camera information
   */
  async getCameraInfo(): Promise<CameraInfo> {
    // Basic camera info for MJPEG protocol
    // In a real implementation, we would attempt to detect more details
    return {
      manufacturer: 'Generic',
      model: 'MJPEG Camera',
      firmwareVersion: 'Unknown',
      additionalInfo: {
        protocol: 'MJPEG',
        supportsDirectStreaming: true
      }
    };
  }
  
  /**
   * Get available stream profiles
   */
  async getAvailableStreams(): Promise<StreamProfile[]> {
    // MJPEG typically has a single stream profile
    return [{
      id: 'default',
      name: 'Default MJPEG Stream',
      encoding: 'mjpeg',
      resolution: { 
        width: this.config?.options?.defaultWidth || 640, 
        height: this.config?.options?.defaultHeight || 480 
      },
      frameRate: this.frameRate || 15
    }];
  }
  
  /**
   * Get protocol-specific options
   */
  getProtocolOptions(): Record<string, any> {
    return {
      boundary: this.boundary,
      frameRate: this.frameRate,
      bufferSize: this.maxBufferSize,
      framesReceived: this.stats.framesReceived,
      bytesReceived: this.stats.bytesReceived,
      bitrate: this.stats.bitrate
    };
  }
  
  /**
   * Set protocol-specific options
   */
  async setProtocolOptions(options: Record<string, any>): Promise<void> {
    // Handle buffer size option
    if (options.bufferSize && typeof options.bufferSize === 'number') {
      this.maxBufferSize = options.bufferSize;
      this.stats.buffer.capacity = this.maxBufferSize;
    }
  }
  
  /**
   * Start a stream
   */
  protected async performStartStream(options?: StreamOptions): Promise<string> {
    // MJPEG protocol typically only supports a single stream
    // If we already have an active stream, return its ID
    if (this.activeStreamId) {
      return this.activeStreamId;
    }
    
    // Store stream options
    this.streamOptions = options || {};
    
    // Generate a stream ID
    const streamId = `mjpeg-stream-${Date.now()}`;
    this.activeStreamId = streamId;
    
    return streamId;
  }
  
  /**
   * Stop a stream
   */
  protected async performStopStream(streamId: string): Promise<void> {
    // If this is our active stream, clear it
    if (this.activeStreamId === streamId) {
      this.activeStreamId = undefined;
      
      // Clear frame buffer
      this.frameBuffer = [];
      this.stats.buffer.size = 0;
      this.stats.buffer.utilization = 0;
    }
  }
  
  /**
   * Test connection to camera
   */
  protected async performTestConnection(config: CameraConfig): Promise<boolean> {
    try {
      // Build URL
      const protocol = config.options?.useHttps ? 'https' : 'http';
      const url = `${protocol}://${config.host}:${config.port}${config.path || ''}`;
      
      // Create temporary HTTP client
      const client = axios.create({
        timeout: 5000, // Short timeout for test
        auth: config.username && config.password
          ? {
              username: config.username,
              password: config.password
            }
          : undefined
      });
      
      // Try to get headers only to check if stream is accessible
      const response = await client.head(url);
      
      // Check content type
      const contentType = response.headers['content-type'];
      return contentType?.includes('multipart/x-mixed-replace') || contentType?.includes('image/jpeg');
    } catch (error) {
      this.logger.debug(`Test connection failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
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
    this.response.on('error', (error) => {
      this.logger.error(`Stream error: ${error.message}`);
      this.handleConnectionError(error);
    });
    
    // Handle end of stream
    this.response.on('end', () => {
      if (this.mjpegStatus === MJPEGProtocolStatus.CONNECTED) {
        this.logger.warn('MJPEG stream ended unexpectedly');
        this.handleUnexpectedDisconnection();
      }
    });
    
    // Handle close
    this.response.on('close', () => {
      if (this.mjpegStatus === MJPEGProtocolStatus.CONNECTED) {
        this.logger.warn('MJPEG stream closed unexpectedly');
        this.handleUnexpectedDisconnection();
      }
    });
  }
  
  /**
   * Parse a chunk of data from the MJPEG stream
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
        headers: { ...this.currentFrameHeaders }
      };
      
      // Add frame to buffer
      this.addFrameToBuffer(frame);
      
      // Update stats
      this.stats.framesReceived++;
      this.frameRateCalculation.framesSinceLastCalculation++;
      
      // Reset frame buffer and headers for next frame
      this.currentFrameBuffer = [];
      this.currentFrameHeaders = {};
      
      // Emit frame event
      this.eventEmitter.emit('frame', frame);
    } catch (error) {
      this.logger.error(`Error processing MJPEG frame: ${error instanceof Error ? error.message : String(error)}`);
      
      // Reset frame buffer and headers for next frame
      this.currentFrameBuffer = [];
      this.currentFrameHeaders = {};
    }
  }
  
  /**
   * Add frame to the frame buffer
   */
  private addFrameToBuffer(frame: MJPEGFrame): void {
    // Check buffer size limit
    if (this.frameBuffer.length >= this.maxBufferSize) {
      // Remove oldest frame
      this.frameBuffer.shift();
    }
    
    // Add frame to buffer
    this.frameBuffer.push(frame);
    
    // Update buffer stats
    this.stats.buffer.size = this.frameBuffer.length;
    this.stats.buffer.utilization = 
      (this.frameBuffer.length / this.maxBufferSize) * 100;
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
   */
  private handleConnectionError(error: Error): void {
    this.logger.error(`MJPEG connection error: ${error.message}`);
    
    // Update status and stats
    this.mjpegStatus = MJPEGProtocolStatus.ERROR;
    this.stats.status = MJPEGProtocolStatus.ERROR;
    this.stats.lastError = error.message;
    
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
    if (!this.config?.options?.reconnect?.enabled) {
      this.mjpegStatus = MJPEGProtocolStatus.DISCONNECTED;
      this.stats.status = MJPEGProtocolStatus.DISCONNECTED;
      return;
    }
    
    // Check max reconnection attempts
    const maxAttempts = this.config?.options?.reconnect?.maxAttempts || 5;
    if (this.currentReconnectionAttempt >= maxAttempts) {
      this.logger.warn(`MJPEG reached maximum reconnection attempts (${maxAttempts})`);
      this.mjpegStatus = MJPEGProtocolStatus.DISCONNECTED;
      this.stats.status = MJPEGProtocolStatus.DISCONNECTED;
      return;
    }
    
    // Update status and stats
    this.mjpegStatus = MJPEGProtocolStatus.RECONNECTING;
    this.stats.status = MJPEGProtocolStatus.RECONNECTING;
    this.currentReconnectionAttempt++;
    this.stats.reconnectionAttempts++;
    
    // Calculate reconnection delay with exponential backoff if enabled
    let reconnectionDelay = this.config?.options?.reconnect?.delay || 1000;
    
    if (
      this.config?.options?.reconnect?.useExponentialBackoff &&
      this.currentReconnectionAttempt > 1
    ) {
      reconnectionDelay = reconnectionDelay * Math.pow(2, this.currentReconnectionAttempt - 1);
      reconnectionDelay = Math.min(reconnectionDelay, 30000); // Maximum 30 seconds
    }
    
    // Set reconnection timer
    this.reconnectionTimer = setTimeout(() => {
      if (this.config) {
        this.connect(this.config).catch((error) => {
          this.logger.error(`MJPEG reconnection failed: ${error.message}`);
          this.handleUnexpectedDisconnection();
        });
      }
    }, reconnectionDelay);
  }
  
  /**
   * Get the latest frame from the buffer
   */
  private getLatestFrame(): MJPEGFrame | undefined {
    if (this.frameBuffer.length === 0) {
      return undefined;
    }
    
    return this.frameBuffer[this.frameBuffer.length - 1];
  }
  
  /**
   * Get MJPEG protocol statistics
   */
  getMJPEGStats(): MJPEGProtocolStats {
    // Update time connected if connected
    if (
      this.mjpegStatus === MJPEGProtocolStatus.CONNECTED &&
      this.stats.connectionTimestamp
    ) {
      this.stats.timeConnected = 
        (Date.now() - this.stats.connectionTimestamp.getTime()) / 1000;
    }
    
    return { ...this.stats };
  }
  
  /**
   * The following methods are not supported by MJPEG protocol and will throw errors
   */
  
  protected performMove(movement: PtzMovement): Promise<void> {
    throw new Error('PTZ controls are not supported by MJPEG protocol');
  }
  
  protected performGotoPreset(presetId: string): Promise<void> {
    throw new Error('PTZ presets are not supported by MJPEG protocol');
  }
  
  protected performSavePreset(presetName: string): Promise<string> {
    throw new Error('PTZ presets are not supported by MJPEG protocol');
  }
  
  protected performSubscribeToEvents(eventTypes: string[]): Promise<string> {
    throw new Error('Event subscription is not supported by MJPEG protocol');
  }
  
  protected performUnsubscribeFromEvents(subscriptionId: string): Promise<void> {
    throw new Error('Event subscription is not supported by MJPEG protocol');
  }
}