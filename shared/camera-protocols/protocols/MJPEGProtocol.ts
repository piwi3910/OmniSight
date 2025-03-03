import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import {
  AbstractCameraProtocol
} from '../AbstractCameraProtocol';
import {
  CameraConfig,
  CameraCapabilities,
  CameraInfo,
  ConnectionStatus,
  PtzMovement,
  StreamOptions,
  StreamProfile
} from '../interfaces/ICameraProtocol';

/**
 * Class representing boundary parsing state
 */
class BoundaryParser {
  private boundary: string;
  private buffer: Buffer = Buffer.alloc(0);
  private frameCallback: (frame: Buffer) => void;
  private boundaryPattern: Buffer;
  private contentTypePattern: Buffer = Buffer.from('Content-Type: image/jpeg', 'ascii');
  private contentLengthPattern: Buffer = Buffer.from('Content-Length: ', 'ascii');
  private doubleNewlinePattern: Buffer = Buffer.from('\r\n\r\n', 'ascii');

  /**
   * Create a boundary parser
   * 
   * @param boundary MJPEG boundary string
   * @param callback Function to call when a frame is found
   */
  constructor(boundary: string, callback: (frame: Buffer) => void) {
    this.boundary = boundary;
    this.frameCallback = callback;
    this.boundaryPattern = Buffer.from('--' + this.boundary, 'ascii');
  }

  /**
   * Process incoming data
   * 
   * @param chunk Raw data chunk
   */
  public processChunk(chunk: Buffer): void {
    // Append new data to existing buffer
    this.buffer = Buffer.concat([this.buffer, chunk]);
    
    // Find boundaries until no more are found
    let boundaryIndex = this.findPattern(this.boundaryPattern);
    while (boundaryIndex !== -1) {
      // Extract frame data between boundaries
      const frameData = this.buffer.slice(0, boundaryIndex);
      
      // Process the frame if it's not empty
      if (frameData.length > 0) {
        this.processFrame(frameData);
      }
      
      // Remove processed data (including boundary) from buffer
      this.buffer = this.buffer.slice(boundaryIndex + this.boundaryPattern.length);
      
      // Find next boundary
      boundaryIndex = this.findPattern(this.boundaryPattern);
    }
    
    // Prevent buffer from growing too large
    if (this.buffer.length > 1024 * 1024) { // 1MB max
      // Reset buffer if it gets too large (something is wrong)
      this.buffer = Buffer.alloc(0);
    }
  }

  /**
   * Find pattern in buffer
   * 
   * @param pattern Pattern to find
   * @returns Index of pattern or -1 if not found
   */
  private findPattern(pattern: Buffer): number {
    return this.buffer.indexOf(pattern);
  }

  /**
   * Process a frame
   * 
   * @param frameData Frame data
   */
  private processFrame(frameData: Buffer): void {
    // Find content type marker
    const contentTypeIndex = this.findPattern(this.contentTypePattern);
    if (contentTypeIndex === -1) return;
    
    // Find content length marker
    const contentLengthIndex = this.findPattern(this.contentLengthPattern);
    if (contentLengthIndex === -1) return;
    
    // Find double newline (header/body separator)
    const doubleNewlineIndex = this.findPattern(this.doubleNewlinePattern);
    if (doubleNewlineIndex === -1) return;
    
    // Extract content length
    const contentLengthStr = frameData.slice(
      contentLengthIndex + this.contentLengthPattern.length,
      frameData.indexOf('\r\n', contentLengthIndex)
    ).toString('ascii');
    
    const contentLength = parseInt(contentLengthStr.trim(), 10);
    if (isNaN(contentLength)) return;
    
    // Extract JPEG data
    const jpegStartIndex = doubleNewlineIndex + this.doubleNewlinePattern.length;
    const jpegData = frameData.slice(jpegStartIndex, jpegStartIndex + contentLength);
    
    // Call callback with JPEG data
    if (jpegData.length === contentLength) {
      this.frameCallback(jpegData);
    }
  }
}

/**
 * MJPEG camera protocol implementation
 * 
 * This class implements the ICameraProtocol interface for MJPEG camera streams.
 * MJPEG streams work over HTTP and consist of a series of JPEG images separated
 * by multipart boundaries.
 */
export class MJPEGProtocol extends AbstractCameraProtocol {
  /**
   * Protocol identifier
   */
  public readonly protocolId: string = 'mjpeg';
  
  /**
   * Protocol name
   */
  public readonly protocolName: string = 'Motion JPEG';
  
  /**
   * Protocol capabilities
   */
  public readonly capabilities: CameraCapabilities = {
    ptz: false,
    presets: false,
    digitalPtz: true,
    motionDetection: false,
    audio: false,
    twoWayAudio: false,
    encodings: ['mjpeg'],
    authMethods: ['basic', 'digest'],
    localRecording: false,
    events: false,
    protocolSpecific: {
      supportsMultipart: true
    }
  };
  
  /**
   * HTTP client instance
   */
  private httpClient: AxiosInstance | null = null;
  
  /**
   * Stream request response
   */
  private streamResponse: AxiosResponse | null = null;
  
  /**
   * Active streams
   */
  private streams: Map<string, {
    emitter: EventEmitter;
    parser: BoundaryParser;
    latestFrame: Uint8Array;
    options?: StreamOptions;
  }> = new Map();
  
  /**
   * Camera information
   */
  private cameraInfoCache: CameraInfo | null = null;
  
  /**
   * Execute HTTP request with auth
   * 
   * @param url URL to request
   * @param options Request options
   */
  private async executeRequest(url: string, options: any = {}): Promise<AxiosResponse> {
    if (!this.httpClient) {
      throw new Error('HTTP client not initialized');
    }
    
    return this.httpClient.request({
      url,
      ...options
    });
  }
  
  /**
   * Connect to camera
   * 
   * @param config Camera configuration
   */
  protected async performConnect(config: CameraConfig): Promise<boolean> {
    const timeout = config.timeout || 5000;
    
    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: `http://${config.host}:${config.port}`,
      timeout,
      auth: config.username && config.password ? {
        username: config.username,
        password: config.password
      } : undefined,
      validateStatus: (status: number) => status < 500 // Don't throw on 4xx errors
    });
    
    try {
      // Test connection by requesting stream info
      const response = await this.httpClient.head(config.path || '/');
      
      if (response.status >= 400) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Disconnect from camera
   */
  protected async performDisconnect(): Promise<void> {
    // Stop all active streams
    for (const streamId of this.streams.keys()) {
      await this.performStopStream(streamId);
    }
    
    // Clean up
    this.streams.clear();
    this.httpClient = null;
    this.streamResponse = null;
  }
  
  /**
   * Start camera stream
   * 
   * @param options Stream options
   */
  protected async performStartStream(options?: StreamOptions): Promise<string> {
    if (!this.httpClient || !this.config) {
      throw new Error('Camera not connected');
    }
    
    // Generate stream ID
    const streamId = `stream-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Create stream path
    const streamPath = this.config.path || '/';
    
    // Create event emitter for stream events
    const emitter = new EventEmitter();
    
    // Create frame buffer
    let latestFrame: Uint8Array = new Uint8Array(0);
    
    // Create boundary parser
    const parser = new BoundaryParser('mjpegboundary', (frame: Buffer) => {
      latestFrame = new Uint8Array(frame);
      emitter.emit('frame', latestFrame);
    });
    
    // Store stream data
    this.streams.set(streamId, {
      emitter,
      parser,
      latestFrame,
      options
    });
    
    try {
      // Request stream
      const response = await this.httpClient.get(streamPath, {
        responseType: 'stream',
        timeout: 0 // No timeout for streaming
      });
      
      if (response.status !== 200) {
        this.streams.delete(streamId);
        throw new Error(`Failed to start stream: HTTP ${response.status}`);
      }
      
      // Extract content type and boundary
      const contentType = response.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      const boundary = boundaryMatch ? boundaryMatch[1] : 'mjpegboundary';
      
      // Create new parser with correct boundary
      const streamData = this.streams.get(streamId)!;
      streamData.parser = new BoundaryParser(boundary, (frame: Buffer) => {
        streamData.latestFrame = new Uint8Array(frame);
        streamData.emitter.emit('frame', streamData.latestFrame);
      });
      
      this.streams.set(streamId, streamData);
      
      // Set up stream processing
      const stream = response.data as Readable;
      
      stream.on('data', (chunk: Buffer) => {
        try {
          const streamData = this.streams.get(streamId);
          if (streamData) {
            streamData.parser.processChunk(chunk);
          }
        } catch (error) {
          console.error('Error processing MJPEG stream chunk:', error);
        }
      });
      
      stream.on('end', () => {
        // Stream ended, remove it
        this.performStopStream(streamId).catch(console.error);
      });
      
      stream.on('error', (error: Error) => {
        console.error('MJPEG stream error:', error);
        this.performStopStream(streamId).catch(console.error);
      });
      
      // Store response to close later
      this.streamResponse = response;
      
      return streamId;
    } catch (error) {
      // Clean up on error
      this.streams.delete(streamId);
      throw error;
    }
  }
  
  /**
   * Stop camera stream
   * 
   * @param streamId Stream identifier
   */
  protected async performStopStream(streamId: string): Promise<void> {
    const streamData = this.streams.get(streamId);
    if (!streamData) {
      return;
    }
    
    // Remove listeners and clean up
    streamData.emitter.removeAllListeners();
    
    // Close stream if it's the last one
    if (this.streams.size === 1 && this.streamResponse) {
      const stream = this.streamResponse.data as Readable;
      stream.destroy();
      this.streamResponse = null;
    }
    
    // Remove stream from registry
    this.streams.delete(streamId);
  }
  
  /**
   * Get a frame from camera
   */
  public async getFrame(): Promise<Uint8Array> {
    if (this.streams.size === 0) {
      // No active stream, start one
      const streamId = await this.startStream();
      
      // Wait for first frame
      const streamData = this.streams.get(streamId)!;
      
      if (streamData.latestFrame.length === 0) {
        // Wait for frame
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            streamData.emitter.removeListener('frame', frameHandler);
            reject(new Error('Timeout waiting for frame'));
          }, 5000);
          
          const frameHandler = () => {
            clearTimeout(timeout);
            resolve(true);
          };
          
          streamData.emitter.once('frame', frameHandler);
        });
      }
      
      const frame = streamData.latestFrame;
      
      // Stop stream
      await this.performStopStream(streamId);
      
      return frame;
    } else {
      // Return latest frame from first stream
      const [streamId] = this.streams.keys();
      const streamData = this.streams.get(streamId)!;
      
      if (streamData.latestFrame.length === 0) {
        // Wait for frame
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            streamData.emitter.removeListener('frame', frameHandler);
            reject(new Error('Timeout waiting for frame'));
          }, 5000);
          
          const frameHandler = () => {
            clearTimeout(timeout);
            resolve(true);
          };
          
          streamData.emitter.once('frame', frameHandler);
        });
      }
      
      return streamData.latestFrame;
    }
  }
  
  /**
   * Get camera information
   */
  public async getCameraInfo(): Promise<CameraInfo> {
    if (this.cameraInfoCache) {
      return this.cameraInfoCache;
    }
    
    if (!this.httpClient || !this.config) {
      throw new Error('Camera not connected');
    }
    
    // For MJPEG, we don't have a standard way to get camera info
    // We'll just provide basic info based on the connection
    const info: CameraInfo = {
      manufacturer: 'Unknown',
      model: 'MJPEG Camera',
      firmwareVersion: 'Unknown',
      additionalInfo: {
        protocol: this.protocolName,
        url: `http://${this.config.host}:${this.config.port}${this.config.path || '/'}`
      }
    };
    
    // Try to get a frame to determine resolution
    try {
      const frame = await this.getFrame();
      
      // In a real implementation, we would extract image dimensions
      // from the JPEG header, but for simplicity, we'll just note
      // that we have frame data
      info.additionalInfo = {
        ...info.additionalInfo,
        hasFrameData: frame.length > 0,
        frameSize: frame.length
      };
    } catch (error) {
      // Ignore errors
    }
    
    this.cameraInfoCache = info;
    return info;
  }
  
  /**
   * Get available stream profiles
   */
  public async getAvailableStreams(): Promise<StreamProfile[]> {
    // MJPEG typically doesn't have multiple stream profiles
    // We'll just return a single profile based on the current connection
    
    if (!this.config) {
      throw new Error('Camera not connected');
    }
    
    // Create a single default profile
    const profile: StreamProfile = {
      id: 'default',
      name: 'Default MJPEG Stream',
      encoding: 'mjpeg',
      resolution: { width: 640, height: 480 }, // Default resolution
      frameRate: 15, // Default frame rate
      parameters: {
        path: this.config.path || '/'
      }
    };
    
    // Try to get a frame to determine actual resolution
    try {
      const frame = await this.getFrame();
      
      // In a real implementation, we would extract image dimensions
      // from the JPEG header, but for now we'll stick with defaults
    } catch (error) {
      // Ignore errors
    }
    
    return [profile];
  }
  
  /**
   * Get protocol-specific options
   */
  public getProtocolOptions(): Record<string, any> {
    return {
      // MJPEG-specific options
      streamPath: this.config?.path || '/',
      compression: 'auto',
      forceMultipart: true
    };
  }
  
  /**
   * Set protocol-specific options
   * 
   * @param options Protocol options
   */
  public async setProtocolOptions(options: Record<string, any>): Promise<void> {
    // Most options can't be changed for MJPEG streams
    // We'll just update the config
    if (this.config) {
      if (options.streamPath) {
        this.config.path = options.streamPath;
      }
    }
  }
  
  /**
   * Perform protocol-specific connection test
   * 
   * @param config Camera configuration
   */
  protected async performTestConnection(config: CameraConfig): Promise<boolean> {
    const timeout = config.timeout || 5000;
    
    try {
      // Create HTTP client for testing
      const client = axios.create({
        baseURL: `http://${config.host}:${config.port}`,
        timeout,
        auth: config.username && config.password ? {
          username: config.username,
          password: config.password
        } : undefined,
        validateStatus: (status: number) => status < 500 // Don't throw on 4xx errors
      });
      
      // Test connection
      const response = await client.head(config.path || '/');
      
      return response.status < 400;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * PTZ methods (not supported in basic MJPEG)
   */
  protected async performMove(movement: PtzMovement): Promise<void> {
    throw new Error('PTZ controls not supported by MJPEG protocol');
  }
  
  protected async performGotoPreset(presetId: string): Promise<void> {
    throw new Error('PTZ presets not supported by MJPEG protocol');
  }
  
  protected async performSavePreset(presetName: string): Promise<string> {
    throw new Error('PTZ presets not supported by MJPEG protocol');
  }
  
  /**
   * Event subscription (not supported in basic MJPEG)
   */
  protected async performSubscribeToEvents(eventTypes: string[]): Promise<string> {
    throw new Error('Event subscription not supported by MJPEG protocol');
  }
  
  protected async performUnsubscribeFromEvents(subscriptionId: string): Promise<void> {
    throw new Error('Event subscription not supported by MJPEG protocol');
  }
}