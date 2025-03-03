/**
 * WebRTC Stream Ingestion Pipeline
 * 
 * Handles ingestion, processing, and distribution of media streams
 * from various sources (RTSP, HLS, direct WebRTC, etc.) into the
 * WebRTC streaming system.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { WebRTCRecorder, RecordingConfig, RecordingEvent } from './WebRTCRecorder';

/**
 * Supported source types for stream ingestion
 */
export enum StreamSourceType {
  RTSP = 'rtsp',
  HLS = 'hls',
  MJPEG = 'mjpeg',
  FILE = 'file',
  URL = 'url',
  WEBRTC_DIRECT = 'webrtc-direct'
}

/**
 * Supported output formats for the stream ingestion pipeline
 */
export enum StreamOutputFormat {
  RAW_H264 = 'h264',
  RAW_VP8 = 'vp8',
  RAW_VP9 = 'vp9',
  WEBM = 'webm',
  MP4 = 'mp4',
  HLS = 'hls',
  MJPEG = 'mjpeg'
}

/**
 * Stream processing options for the ingestion pipeline
 */
export interface StreamProcessingOptions {
  // Whether to perform video resizing
  resize?: boolean;
  // Target resolution for resizing (e.g., '1280x720')
  resolution?: string;
  
  // Whether to perform frame rate adjustment
  adjustFrameRate?: boolean;
  // Target frame rate
  frameRate?: number;
  
  // Whether to perform bitrate adjustment
  adjustBitrate?: boolean;
  // Target bitrate in kbps
  bitrate?: number;
  
  // Whether to perform video denoising
  denoise?: boolean;
  
  // Whether to perform hardware acceleration
  hardwareAcceleration?: boolean;
  // Type of hardware acceleration to use
  hwaccelMethod?: 'auto' | 'cuda' | 'vaapi' | 'qsv' | 'videotoolbox' | 'dxva2';
  
  // Additional FFmpeg options
  additionalFFmpegOptions?: string[];
}

/**
 * Media track information
 */
export interface MediaTrackInfo {
  id: string;
  type: 'video' | 'audio';
  codec: string;
  width?: number;
  height?: number;
  frameRate?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

/**
 * Stream source configuration
 */
export interface StreamSourceConfig {
  // Type of stream source
  type: StreamSourceType;
  
  // URL or path to the stream source
  url: string;
  
  // Authentication credentials for the source
  auth?: {
    username?: string;
    password?: string;
    token?: string;
  };
  
  // Connection retry options
  retry?: {
    maxAttempts: number;
    delay: number;
    exponentialBackoff: boolean;
  };
  
  // Source-specific options
  options?: Record<string, any>;
}

/**
 * Stream output configuration
 */
export interface StreamOutputConfig {
  // Output format
  format: StreamOutputFormat;
  
  // Processing options for the output
  processing?: StreamProcessingOptions;
  
  // Whether to enable recording for this output
  enableRecording?: boolean;
  
  // Recording configuration if recording is enabled
  recordingConfig?: Partial<RecordingConfig>;
  
  // Additional output-specific options
  options?: Record<string, any>;
}

/**
 * Stream ingestion configuration
 */
export interface StreamIngestionConfig {
  // Unique ID for the stream
  streamId: string;
  
  // Source configuration
  source: StreamSourceConfig;
  
  // Array of output configurations
  outputs: StreamOutputConfig[];
  
  // Temporary directory for processing files
  tempDir?: string;
  
  // Whether to enable stream health monitoring
  enableHealthMonitoring?: boolean;
  
  // Health monitoring options
  healthMonitoring?: {
    // Check interval in seconds
    checkInterval: number;
    // Maximum allowed frame delay in seconds
    maxFrameDelay: number;
    // Whether to auto-reconnect on failure
    autoReconnect: boolean;
    // Maximum reconnect attempts
    maxReconnectAttempts: number;
  };
}

/**
 * Stream ingestion status
 */
export enum StreamIngestionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  STREAMING = 'streaming',
  RECONNECTING = 'reconnecting',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Stream health status
 */
export interface StreamHealthStatus {
  status: StreamIngestionStatus;
  lastFrameReceived?: Date;
  frameDelay?: number;
  bitrate?: number;
  frameRate?: number;
  dropRate?: number;
  error?: string;
}

/**
 * Stream ingestion events
 */
export enum StreamIngestionEvent {
  CONNECT = 'stream:connect',
  START = 'stream:start',
  STOP = 'stream:stop',
  RECONNECT = 'stream:reconnect',
  ERROR = 'stream:error',
  HEALTH_STATUS = 'stream:health_status',
  TRACK_ADDED = 'stream:track_added',
  TRACK_REMOVED = 'stream:track_removed',
  DATA = 'stream:data',
  RECORDING_START = 'stream:recording_start',
  RECORDING_STOP = 'stream:recording_stop'
}

/**
 * Stream ingestion statistics
 */
export interface StreamIngestionStats {
  streamId: string;
  status: StreamIngestionStatus;
  uptime?: number;
  bytesReceived: number;
  framesProcessed: number;
  frameRate?: number;
  bitrate?: number;
  reconnectCount: number;
  tracks: MediaTrackInfo[];
  outputs: {
    format: StreamOutputFormat;
    bytesOutput: number;
    isRecording: boolean;
  }[];
  health: StreamHealthStatus;
}

/**
 * Stream ingestion pipeline for WebRTC streaming
 * 
 * Handles ingestion of media streams from various sources
 * and processes them for WebRTC distribution.
 */
export class StreamIngestionPipeline extends EventEmitter {
  private config: StreamIngestionConfig;
  private status: StreamIngestionStatus = StreamIngestionStatus.IDLE;
  private processInstances: Map<string, ChildProcess> = new Map();
  private tracks: MediaTrackInfo[] = [];
  private startTime?: Date;
  private bytesReceived: number = 0;
  private framesProcessed: number = 0;
  private reconnectCount: number = 0;
  private lastError?: Error;
  private healthStatus: StreamHealthStatus = { status: StreamIngestionStatus.IDLE };
  private healthCheckTimer?: NodeJS.Timeout;
  private recorders: Map<string, WebRTCRecorder> = new Map();
  private outputStats: Map<string, { bytesOutput: number, isRecording: boolean }> = new Map();
  
  /**
   * Create a new stream ingestion pipeline
   * 
   * @param config Stream ingestion configuration
   */
  constructor(config: StreamIngestionConfig) {
    super();
    this.config = this.validateConfig(config);
    
    // Initialize temp directory
    this.setupTempDirectory();
    
    // Initialize output stats
    this.config.outputs.forEach((output, index) => {
      this.outputStats.set(`output_${index}`, {
        bytesOutput: 0,
        isRecording: false
      });
    });
  }
  
  /**
   * Validate and normalize configuration
   * 
   * @param config Configuration to validate
   * @returns Validated and normalized configuration
   */
  private validateConfig(config: StreamIngestionConfig): StreamIngestionConfig {
    const validatedConfig = { ...config };
    
    // Ensure streamId exists
    if (!validatedConfig.streamId) {
      validatedConfig.streamId = `stream_${uuidv4()}`;
    }
    
    // Validate source configuration
    if (!validatedConfig.source || !validatedConfig.source.url) {
      throw new Error('Stream source URL is required');
    }
    
    // Ensure outputs array exists
    if (!validatedConfig.outputs || validatedConfig.outputs.length === 0) {
      throw new Error('At least one output configuration is required');
    }
    
    // Set default temp directory if not provided
    if (!validatedConfig.tempDir) {
      validatedConfig.tempDir = path.join(os.tmpdir(), 'omnisight-stream-ingestion');
    }
    
    // Default health monitoring settings
    if (validatedConfig.enableHealthMonitoring !== false) {
      validatedConfig.enableHealthMonitoring = true;
      
      if (!validatedConfig.healthMonitoring) {
        validatedConfig.healthMonitoring = {
          checkInterval: 5,
          maxFrameDelay: 10,
          autoReconnect: true,
          maxReconnectAttempts: 5
        };
      }
    }
    
    return validatedConfig;
  }
  
  /**
   * Set up temporary directory for stream processing
   */
  private setupTempDirectory(): void {
    if (!this.config.tempDir) {
      return;
    }
    
    // Create base temp directory if it doesn't exist
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
    }
    
    // Create stream-specific temp directory
    const streamTempDir = path.join(this.config.tempDir, this.config.streamId);
    if (!fs.existsSync(streamTempDir)) {
      fs.mkdirSync(streamTempDir, { recursive: true });
    }
  }
  
  /**
   * Start the stream ingestion pipeline
   * 
   * @returns Promise that resolves when ingestion starts
   */
  public async start(): Promise<void> {
    if (this.status === StreamIngestionStatus.STREAMING) {
      throw new Error('Stream ingestion is already running');
    }
    
    try {
      this.status = StreamIngestionStatus.CONNECTING;
      this.startTime = new Date();
      this.bytesReceived = 0;
      this.framesProcessed = 0;
      
      // Emit connect event
      this.emit(StreamIngestionEvent.CONNECT, {
        streamId: this.config.streamId,
        source: this.config.source
      });
      
      // Start ingestion based on source type
      await this.startIngestion();
      
      // Start health monitoring if enabled
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }
      
      this.status = StreamIngestionStatus.STREAMING;
      
      // Emit start event
      this.emit(StreamIngestionEvent.START, {
        streamId: this.config.streamId,
        startTime: this.startTime
      });
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }
  
  /**
   * Stop the stream ingestion pipeline
   * 
   * @returns Promise that resolves when ingestion stops
   */
  public async stop(): Promise<void> {
    if (this.status === StreamIngestionStatus.IDLE || 
        this.status === StreamIngestionStatus.STOPPED) {
      return Promise.resolve();
    }
    
    try {
      // Stop all processes
      for (const [key, process] of this.processInstances) {
        process.kill();
        this.processInstances.delete(key);
      }
      
      // Stop all recorders
      for (const [key, recorder] of this.recorders) {
        await recorder.stop();
        this.recorders.delete(key);
      }
      
      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = undefined;
      }
      
      this.status = StreamIngestionStatus.STOPPED;
      
      // Emit stop event
      this.emit(StreamIngestionEvent.STOP, {
        streamId: this.config.streamId,
        duration: this.startTime ? 
          (new Date().getTime() - this.startTime.getTime()) / 1000 : 0
      });
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }
  
  /**
   * Start stream ingestion based on source type
   * 
   * @returns Promise that resolves when ingestion starts
   */
  private async startIngestion(): Promise<void> {
    // Determine ingestion method based on source type
    switch (this.config.source.type) {
      case StreamSourceType.RTSP:
        await this.startRtspIngestion();
        break;
      case StreamSourceType.HLS:
        await this.startHlsIngestion();
        break;
      case StreamSourceType.MJPEG:
        await this.startMjpegIngestion();
        break;
      case StreamSourceType.FILE:
        await this.startFileIngestion();
        break;
      case StreamSourceType.URL:
        await this.startUrlIngestion();
        break;
      case StreamSourceType.WEBRTC_DIRECT:
        await this.startWebRtcDirectIngestion();
        break;
      default:
        throw new Error(`Unsupported source type: ${this.config.source.type}`);
    }
    
    // Once ingestion has started, configure outputs
    await this.configureOutputs();
    
    return Promise.resolve();
  }
  
  /**
   * Start RTSP stream ingestion
   * 
   * @returns Promise that resolves when RTSP ingestion starts
   */
  private async startRtspIngestion(): Promise<void> {
    // Construct auth part of URL if credentials are provided
    let rtspUrl = this.config.source.url;
    if (this.config.source.auth?.username && this.config.source.auth?.password) {
      const urlObj = new URL(rtspUrl);
      urlObj.username = this.config.source.auth.username;
      urlObj.password = this.config.source.auth.password;
      rtspUrl = urlObj.toString();
    }
    
    // Prepare FFmpeg input arguments
    const inputArgs = [
      '-rtsp_transport', 'tcp',  // Use TCP for RTSP (more reliable)
      '-i', rtspUrl,
      '-f', 'null'  // Discard output temporarily
    ];
    
    // Add any additional options
    if (this.config.source.options?.additionalInputArgs) {
      inputArgs.push(...this.config.source.options.additionalInputArgs);
    }
    
    // First process is just to validate the RTSP stream
    // In a real implementation, we would have more sophisticated handling
    const validateProcess = spawn('ffmpeg', inputArgs);
    
    return new Promise<void>((resolve, reject) => {
      // Set timeout for initial connection
      const timeout = setTimeout(() => {
        validateProcess.kill();
        reject(new Error('RTSP connection timeout'));
      }, 10000);
      
      // Listen for errors
      validateProcess.stderr.on('data', (data) => {
        const output = data.toString();
        
        // Look for successful stream info
        if (output.includes('Stream mapping:')) {
          clearTimeout(timeout);
          validateProcess.kill();
          resolve();
        }
      });
      
      // Handle process exit
      validateProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`RTSP validation failed with code: ${code}`));
        }
      });
    });
  }
  
  /**
   * Start HLS stream ingestion
   * 
   * @returns Promise that resolves when HLS ingestion starts
   */
  private async startHlsIngestion(): Promise<void> {
    // In a real implementation, this would handle HLS stream ingestion
    // For now, we'll just simulate successful initialization
    return Promise.resolve();
  }
  
  /**
   * Start MJPEG stream ingestion
   * 
   * @returns Promise that resolves when MJPEG ingestion starts
   */
  private async startMjpegIngestion(): Promise<void> {
    // In a real implementation, this would handle MJPEG stream ingestion
    // For now, we'll just simulate successful initialization
    return Promise.resolve();
  }
  
  /**
   * Start file ingestion
   * 
   * @returns Promise that resolves when file ingestion starts
   */
  private async startFileIngestion(): Promise<void> {
    // In a real implementation, this would handle file ingestion
    // For now, we'll just simulate successful initialization
    return Promise.resolve();
  }
  
  /**
   * Start URL ingestion
   * 
   * @returns Promise that resolves when URL ingestion starts
   */
  private async startUrlIngestion(): Promise<void> {
    // In a real implementation, this would handle URL ingestion
    // For now, we'll just simulate successful initialization
    return Promise.resolve();
  }
  
  /**
   * Start WebRTC direct ingestion
   * 
   * @returns Promise that resolves when WebRTC direct ingestion starts
   */
  private async startWebRtcDirectIngestion(): Promise<void> {
    // In a real implementation, this would handle WebRTC direct ingestion
    // For now, we'll just simulate successful initialization
    return Promise.resolve();
  }
  
  /**
   * Configure outputs for the ingestion pipeline
   * 
   * @returns Promise that resolves when outputs are configured
   */
  private async configureOutputs(): Promise<void> {
    // Configure each output
    for (let i = 0; i < this.config.outputs.length; i++) {
      const output = this.config.outputs[i];
      const outputKey = `output_${i}`;
      
      // Start recording if enabled for this output
      if (output.enableRecording && output.recordingConfig) {
        await this.startRecording(outputKey, output.recordingConfig);
      }
    }
    
    return Promise.resolve();
  }
  
  /**
   * Start recording for an output
   * 
   * @param outputKey Key for the output
   * @param recordingConfig Recording configuration
   * @returns Promise that resolves when recording starts
   */
  private async startRecording(
    outputKey: string, 
    recordingConfig: Partial<RecordingConfig>
  ): Promise<void> {
    // Create recorder for this output
    const recorder = new WebRTCRecorder(
      this.config.streamId,
      recordingConfig
    );
    
    // Set up recorder event handlers
    recorder.on(RecordingEvent.ERROR, (event) => {
      this.emit(StreamIngestionEvent.ERROR, {
        streamId: this.config.streamId,
        outputKey,
        error: event.error,
        message: `Recording error: ${event.error.message}`
      });
    });
    
    // Start the recording
    await recorder.start();
    
    // Update output stats
    const stats = this.outputStats.get(outputKey);
    if (stats) {
      stats.isRecording = true;
      this.outputStats.set(outputKey, stats);
    }
    
    // Store recorder
    this.recorders.set(outputKey, recorder);
    
    // Emit recording start event
    this.emit(StreamIngestionEvent.RECORDING_START, {
      streamId: this.config.streamId,
      outputKey,
      recordingId: recorder.getRecordingId()
    });
    
    return Promise.resolve();
  }
  
  /**
   * Stop recording for an output
   * 
   * @param outputKey Key for the output
   * @returns Promise that resolves when recording stops
   */
  private async stopRecording(outputKey: string): Promise<void> {
    const recorder = this.recorders.get(outputKey);
    if (!recorder) {
      return Promise.resolve();
    }
    
    // Stop the recording
    const metadata = await recorder.stop();
    
    // Update output stats
    const stats = this.outputStats.get(outputKey);
    if (stats) {
      stats.isRecording = false;
      this.outputStats.set(outputKey, stats);
    }
    
    // Remove recorder
    this.recorders.delete(outputKey);
    
    // Emit recording stop event
    this.emit(StreamIngestionEvent.RECORDING_STOP, {
      streamId: this.config.streamId,
      outputKey,
      recordingId: metadata.recordingId,
      duration: metadata.duration,
      segments: metadata.segmentCount
    });
    
    return Promise.resolve();
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (!this.config.healthMonitoring) {
      return;
    }
    
    // Clear existing timer if any
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Initialize health status
    this.healthStatus = {
      status: this.status,
      lastFrameReceived: new Date()
    };
    
    // Set up health check interval
    this.healthCheckTimer = setInterval(() => {
      this.checkStreamHealth();
    }, this.config.healthMonitoring.checkInterval * 1000);
  }
  
  /**
   * Check stream health
   */
  private checkStreamHealth(): void {
    if (!this.config.healthMonitoring) {
      return;
    }
    
    // Check if we're still receiving frames
    if (this.healthStatus.lastFrameReceived) {
      const now = new Date();
      const delay = (now.getTime() - this.healthStatus.lastFrameReceived.getTime()) / 1000;
      
      this.healthStatus.frameDelay = delay;
      
      // Frame delay exceeds threshold
      if (delay > this.config.healthMonitoring.maxFrameDelay) {
        this.healthStatus.status = StreamIngestionStatus.ERROR;
        this.healthStatus.error = `Frame delay exceeds threshold: ${delay.toFixed(1)}s`;
        
        // Emit health status event
        this.emit(StreamIngestionEvent.HEALTH_STATUS, this.healthStatus);
        
        // Auto-reconnect if enabled
        if (this.config.healthMonitoring.autoReconnect) {
          this.reconnect();
        }
        
        return;
      }
    }
    
    // Update health status
    this.healthStatus.status = this.status;
    
    // Emit health status event
    this.emit(StreamIngestionEvent.HEALTH_STATUS, this.healthStatus);
  }
  
  /**
   * Reconnect the stream
   * 
   * @returns Promise that resolves when reconnection completes
   */
  private async reconnect(): Promise<void> {
    if (this.status === StreamIngestionStatus.RECONNECTING) {
      return Promise.resolve();
    }
    
    try {
      this.status = StreamIngestionStatus.RECONNECTING;
      this.reconnectCount++;
      
      // Emit reconnect event
      this.emit(StreamIngestionEvent.RECONNECT, {
        streamId: this.config.streamId,
        attempt: this.reconnectCount
      });
      
      // Stop current processes
      for (const [key, process] of this.processInstances) {
        process.kill();
        this.processInstances.delete(key);
      }
      
      // Start ingestion again
      await this.startIngestion();
      
      this.status = StreamIngestionStatus.STREAMING;
      
      // Update health status
      this.healthStatus.status = this.status;
      this.healthStatus.error = undefined;
      this.healthStatus.lastFrameReceived = new Date();
      
      // Emit health status event
      this.emit(StreamIngestionEvent.HEALTH_STATUS, this.healthStatus);
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }
  
  /**
   * Handle incoming frame data
   * 
   * @param outputKey Key for the output
   * @param data Frame data
   */
  public handleFrame(outputKey: string, data: Buffer): void {
    if (this.status !== StreamIngestionStatus.STREAMING) {
      return;
    }
    
    // Update statistics
    this.bytesReceived += data.length;
    this.framesProcessed++;
    
    // Update output statistics
    const outputStats = this.outputStats.get(outputKey);
    if (outputStats) {
      outputStats.bytesOutput += data.length;
      this.outputStats.set(outputKey, outputStats);
    }
    
    // Update health status
    this.healthStatus.lastFrameReceived = new Date();
    
    // Send frame to recorder if recording is enabled for this output
    const recorder = this.recorders.get(outputKey);
    if (recorder) {
      recorder.handleFrame(data).catch(error => {
        this.emit(StreamIngestionEvent.ERROR, {
          streamId: this.config.streamId,
          outputKey,
          error,
          message: `Recording error: ${error.message}`
        });
      });
    }
    
    // Emit data event
    this.emit(StreamIngestionEvent.DATA, {
      streamId: this.config.streamId,
      outputKey,
      size: data.length
    });
  }
  
  /**
   * Add a media track
   * 
   * @param track Media track info
   */
  public addTrack(track: MediaTrackInfo): void {
    // Check if track already exists
    const existingTrack = this.tracks.find(t => t.id === track.id);
    if (existingTrack) {
      return;
    }
    
    // Add track
    this.tracks.push(track);
    
    // Emit track added event
    this.emit(StreamIngestionEvent.TRACK_ADDED, {
      streamId: this.config.streamId,
      track
    });
  }
  
  /**
   * Remove a media track
   * 
   * @param trackId ID of the track to remove
   */
  public removeTrack(trackId: string): void {
    // Find track index
    const trackIndex = this.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) {
      return;
    }
    
    // Get track before removing
    const track = this.tracks[trackIndex];
    
    // Remove track
    this.tracks.splice(trackIndex, 1);
    
    // Emit track removed event
    this.emit(StreamIngestionEvent.TRACK_REMOVED, {
      streamId: this.config.streamId,
      trackId,
      track
    });
  }
  
  /**
   * Handle an error
   * 
   * @param error The error that occurred
   */
  private handleError(error: Error): void {
    this.lastError = error;
    this.status = StreamIngestionStatus.ERROR;
    
    // Update health status
    this.healthStatus.status = this.status;
    this.healthStatus.error = error.message;
    
    // Emit error event
    this.emit(StreamIngestionEvent.ERROR, {
      streamId: this.config.streamId,
      error,
      message: error.message
    });
    
    // Emit health status event
    this.emit(StreamIngestionEvent.HEALTH_STATUS, this.healthStatus);
  }
  
  /**
   * Get stream ingestion statistics
   * 
   * @returns Current ingestion statistics
   */
  public getStats(): StreamIngestionStats {
    // Calculate uptime
    const uptime = this.startTime ? 
      (new Date().getTime() - this.startTime.getTime()) / 1000 : undefined;
    
    // Prepare output stats
    const outputs = Array.from(this.outputStats.entries()).map(([key, stats]) => {
      const outputIndex = parseInt(key.split('_')[1]);
      return {
        format: this.config.outputs[outputIndex].format,
        bytesOutput: stats.bytesOutput,
        isRecording: stats.isRecording
      };
    });
    
    return {
      streamId: this.config.streamId,
      status: this.status,
      uptime,
      bytesReceived: this.bytesReceived,
      framesProcessed: this.framesProcessed,
      reconnectCount: this.reconnectCount,
      tracks: this.tracks,
      outputs,
      health: this.healthStatus
    };
  }
  
  /**
   * Get the stream ID
   * 
   * @returns Stream ID
   */
  public getStreamId(): string {
    return this.config.streamId;
  }
  
  /**
   * Get the stream status
   * 
   * @returns Current stream status
   */
  public getStatus(): StreamIngestionStatus {
    return this.status;
  }
  
  /**
   * Get the stream health status
   * 
   * @returns Current health status
   */
  public getHealthStatus(): StreamHealthStatus {
    return this.healthStatus;
  }
}