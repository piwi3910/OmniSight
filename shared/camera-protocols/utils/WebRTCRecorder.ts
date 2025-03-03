/**
 * WebRTC Stream Recorder Implementation
 * Handles recording of WebRTC streams to disk with metadata
 */

import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export enum RecordingFormat {
  MP4 = 'mp4',
  MKV = 'mkv',
  TS = 'ts',
  WEBM = 'webm'
}

export enum RecordingQuality {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum RecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export enum RecordingEvent {
  START = 'recording:start',
  STOP = 'recording:stop',
  PAUSE = 'recording:pause',
  RESUME = 'recording:resume',
  SEGMENT_COMPLETE = 'recording:segment_complete',
  ERROR = 'recording:error',
  WARNING = 'recording:warning',
  STATE_CHANGE = 'recording:state_change'
}

export interface RecordingConfig {
  // Directory where recordings will be stored
  outputDir: string;
  
  // Format of the recording (mp4, mkv, ts, webm)
  format: RecordingFormat;
  
  // Quality of the recording
  quality: RecordingQuality;
  
  // Maximum duration of a segment in seconds (0 = no segmentation)
  segmentDuration: number;
  
  // Maximum size of a segment in MB (0 = no size limit)
  maxSegmentSize: number;
  
  // Whether to include audio in the recording
  includeAudio: boolean;
  
  // Whether to generate thumbnails
  generateThumbnails: boolean;
  
  // Interval for thumbnail generation in seconds
  thumbnailInterval: number;
  
  // Whether to include metadata in recording
  includeMetadata: boolean;
  
  // Optional recording name prefix
  namePrefix?: string;
  
  // Custom metadata to include with recording
  customMetadata?: Record<string, any>;
}

export interface RecordingMetadata {
  recordingId: string;
  streamId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  format: RecordingFormat;
  quality: RecordingQuality;
  segmentCount: number;
  totalSize: number;
  hasThumbnails: boolean;
  customMetadata?: Record<string, any>;
  segments: RecordingSegment[];
}

export interface RecordingSegment {
  segmentId: string;
  index: number;
  filename: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size: number;
  thumbnailFilename?: string;
}

export interface RecordingStats {
  recordingId: string;
  state: RecordingState;
  duration: number;
  bytesWritten: number;
  segmentsCompleted: number;
  currentSegment?: RecordingSegment;
  error?: Error;
}

const DEFAULT_CONFIG: Partial<RecordingConfig> = {
  format: RecordingFormat.MP4,
  quality: RecordingQuality.MEDIUM,
  segmentDuration: 600, // 10 minutes
  maxSegmentSize: 0,
  includeAudio: true,
  generateThumbnails: true,
  thumbnailInterval: 60,
  includeMetadata: true
};

/**
 * WebRTCRecorder handles the recording of WebRTC streams to disk
 * with support for segmentation, thumbnails, and metadata
 */
export class WebRTCRecorder extends EventEmitter {
  private recordingId: string;
  private streamId: string;
  private config: RecordingConfig;
  private state: RecordingState = RecordingState.IDLE;
  private startTime?: Date;
  private endTime?: Date;
  private currentSegment?: RecordingSegment;
  private segments: RecordingSegment[] = [];
  private segmentWriteStream?: Writable;
  private bytesWritten: number = 0;
  private segmentsCompleted: number = 0;
  private segmentTimer?: NodeJS.Timeout;
  private thumbnailTimer?: NodeJS.Timeout;
  private metadata: RecordingMetadata;
  private error?: Error;
  
  /**
   * Create a new WebRTC recorder
   * 
   * @param streamId The ID of the stream to record
   * @param config Recording configuration
   */
  constructor(streamId: string, config: Partial<RecordingConfig>) {
    super();
    this.streamId = streamId;
    this.recordingId = uuidv4();
    this.config = { ...DEFAULT_CONFIG, ...config } as RecordingConfig;
    
    // Validate config
    this.validateConfig();
    
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    
    // Create subdirectory for this recording
    const recordingDir = path.join(this.config.outputDir, this.recordingId);
    if (!fs.existsSync(recordingDir)) {
      fs.mkdirSync(recordingDir, { recursive: true });
    }
    
    // Create thumbnails directory if needed
    if (this.config.generateThumbnails) {
      const thumbnailsDir = path.join(recordingDir, 'thumbnails');
      if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }
    }
    
    // Initialize metadata
    this.metadata = {
      recordingId: this.recordingId,
      streamId: this.streamId,
      startTime: new Date(),
      format: this.config.format,
      quality: this.config.quality,
      segmentCount: 0,
      totalSize: 0,
      hasThumbnails: this.config.generateThumbnails,
      customMetadata: this.config.customMetadata,
      segments: []
    };
  }
  
  /**
   * Validate configuration parameters
   */
  private validateConfig(): void {
    if (!this.config.outputDir) {
      throw new Error('Output directory is required');
    }
    
    if (this.config.segmentDuration < 0) {
      throw new Error('Segment duration must be greater than or equal to 0');
    }
    
    if (this.config.maxSegmentSize < 0) {
      throw new Error('Max segment size must be greater than or equal to 0');
    }
    
    if (this.config.thumbnailInterval <= 0 && this.config.generateThumbnails) {
      throw new Error('Thumbnail interval must be greater than 0');
    }
  }
  
  /**
   * Start recording the WebRTC stream
   * 
   * @returns Promise that resolves when recording starts
   */
  public async start(): Promise<void> {
    if (this.state === RecordingState.RECORDING) {
      throw new Error('Recording is already in progress');
    }
    
    if (this.state === RecordingState.PAUSED) {
      return this.resume();
    }
    
    try {
      this.state = RecordingState.RECORDING;
      this.startTime = new Date();
      this.metadata.startTime = this.startTime;
      
      // Start first segment
      await this.startNewSegment();
      
      // Set up thumbnail timer if enabled
      if (this.config.generateThumbnails) {
        this.setupThumbnailGeneration();
      }
      
      this.emit(RecordingEvent.START, {
        recordingId: this.recordingId,
        streamId: this.streamId,
        startTime: this.startTime
      });
      
      this.emit(RecordingEvent.STATE_CHANGE, {
        recordingId: this.recordingId,
        state: this.state
      });
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }
  
  /**
   * Stop recording the WebRTC stream
   * 
   * @returns Promise that resolves when recording stops
   */
  public async stop(): Promise<RecordingMetadata> {
    if (this.state !== RecordingState.RECORDING && this.state !== RecordingState.PAUSED) {
      throw new Error('No active recording to stop');
    }
    
    try {
      await this.finalizeCurrentSegment();
      
      // Clear timers
      if (this.segmentTimer) {
        clearTimeout(this.segmentTimer);
        this.segmentTimer = undefined;
      }
      
      if (this.thumbnailTimer) {
        clearTimeout(this.thumbnailTimer);
        this.thumbnailTimer = undefined;
      }
      
      this.state = RecordingState.STOPPED;
      this.endTime = new Date();
      this.metadata.endTime = this.endTime;
      
      if (this.startTime) {
        this.metadata.duration = (this.endTime.getTime() - this.startTime.getTime()) / 1000;
      }
      
      // Save metadata file
      await this.saveMetadata();
      
      this.emit(RecordingEvent.STOP, {
        recordingId: this.recordingId,
        streamId: this.streamId,
        duration: this.metadata.duration,
        segments: this.segments.length
      });
      
      this.emit(RecordingEvent.STATE_CHANGE, {
        recordingId: this.recordingId,
        state: this.state
      });
      
      return this.metadata;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Pause the recording
   * 
   * @returns Promise that resolves when recording is paused
   */
  public async pause(): Promise<void> {
    if (this.state !== RecordingState.RECORDING) {
      throw new Error('Recording is not active');
    }
    
    try {
      // Finalize current segment
      await this.finalizeCurrentSegment();
      
      // Clear timers
      if (this.segmentTimer) {
        clearTimeout(this.segmentTimer);
        this.segmentTimer = undefined;
      }
      
      if (this.thumbnailTimer) {
        clearTimeout(this.thumbnailTimer);
        this.thumbnailTimer = undefined;
      }
      
      this.state = RecordingState.PAUSED;
      
      this.emit(RecordingEvent.PAUSE, {
        recordingId: this.recordingId,
        streamId: this.streamId
      });
      
      this.emit(RecordingEvent.STATE_CHANGE, {
        recordingId: this.recordingId,
        state: this.state
      });
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Resume a paused recording
   * 
   * @returns Promise that resolves when recording is resumed
   */
  public async resume(): Promise<void> {
    if (this.state !== RecordingState.PAUSED) {
      throw new Error('Recording is not paused');
    }
    
    try {
      // Start new segment
      await this.startNewSegment();
      
      // Set up thumbnail timer if enabled
      if (this.config.generateThumbnails) {
        this.setupThumbnailGeneration();
      }
      
      this.state = RecordingState.RECORDING;
      
      this.emit(RecordingEvent.RESUME, {
        recordingId: this.recordingId,
        streamId: this.streamId
      });
      
      this.emit(RecordingEvent.STATE_CHANGE, {
        recordingId: this.recordingId,
        state: this.state
      });
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Handle a frame from the WebRTC stream
   * 
   * @param frame The frame data to write
   * @returns Promise that resolves when frame is written
   */
  public async handleFrame(frame: Buffer): Promise<void> {
    if (this.state !== RecordingState.RECORDING) {
      return Promise.resolve();
    }
    
    try {
      if (!this.segmentWriteStream) {
        throw new Error('No active segment write stream');
      }
      
      // Check if we need to start a new segment due to size limit
      if (this.config.maxSegmentSize > 0 && 
          this.bytesWritten > this.config.maxSegmentSize * 1024 * 1024) {
        await this.finalizeCurrentSegment();
        await this.startNewSegment();
      }
      
      // Write frame to segment file
      if (!this.segmentWriteStream.write(frame)) {
        // If buffer is full, wait for drain event
        await new Promise<void>((resolve) => {
          this.segmentWriteStream!.once('drain', resolve);
        });
      }
      
      this.bytesWritten += frame.length;
      
      if (this.currentSegment) {
        this.currentSegment.size += frame.length;
      }
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Start a new recording segment
   * 
   * @returns Promise that resolves when new segment is started
   */
  private async startNewSegment(): Promise<void> {
    try {
      // First finalize current segment if it exists
      if (this.segmentWriteStream) {
        await this.finalizeCurrentSegment();
      }
      
      const segmentId = uuidv4();
      const segmentIndex = this.segments.length;
      const segmentFilename = `${this.config.namePrefix || ''}segment_${segmentIndex}.${this.config.format}`;
      
      // Create full path to segment file
      const segmentPath = path.join(
        this.config.outputDir,
        this.recordingId,
        segmentFilename
      );
      
      // Create segment metadata
      this.currentSegment = {
        segmentId,
        index: segmentIndex,
        filename: segmentFilename,
        startTime: new Date(),
        size: 0
      };
      
      // Create write stream for segment
      this.segmentWriteStream = fs.createWriteStream(segmentPath);
      this.bytesWritten = 0;
      
      // Set up segment timer if needed
      if (this.config.segmentDuration > 0) {
        this.segmentTimer = setTimeout(() => {
          this.finalizeCurrentSegment()
            .then(() => this.startNewSegment())
            .catch(error => this.handleError(error instanceof Error ? error : new Error(String(error))));
        }, this.config.segmentDuration * 1000);
      }
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Finalize the current recording segment
   * 
   * @returns Promise that resolves when segment is finalized
   */
  private async finalizeCurrentSegment(): Promise<void> {
    if (!this.segmentWriteStream || !this.currentSegment) {
      return Promise.resolve();
    }
    
    return new Promise<void>((resolve, reject) => {
      this.segmentWriteStream!.end(async () => {
        try {
          // Update segment metadata
          if (this.currentSegment) {
            this.currentSegment.endTime = new Date();
            if (this.currentSegment.startTime) {
              this.currentSegment.duration = 
                (this.currentSegment.endTime.getTime() - this.currentSegment.startTime.getTime()) / 1000;
            }
            
            // Add segment to list
            this.segments.push(this.currentSegment);
            this.metadata.segments.push(this.currentSegment);
            
            // Update metadata
            this.metadata.segmentCount = this.segments.length;
            this.metadata.totalSize += this.currentSegment.size;
            
            // Emit segment complete event
            this.emit(RecordingEvent.SEGMENT_COMPLETE, {
              recordingId: this.recordingId,
              streamId: this.streamId,
              segment: this.currentSegment
            });
            
            this.segmentsCompleted++;
          }
          
          // Clear segment write stream
          this.segmentWriteStream = undefined;
          
          // Clear segment timer
          if (this.segmentTimer) {
            clearTimeout(this.segmentTimer);
            this.segmentTimer = undefined;
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  
  /**
   * Set up thumbnail generation
   */
  private setupThumbnailGeneration(): void {
    if (!this.config.generateThumbnails || this.config.thumbnailInterval <= 0) {
      return;
    }
    
    // Clear existing timer if any
    if (this.thumbnailTimer) {
      clearTimeout(this.thumbnailTimer);
    }
    
    // Set up new timer
    this.thumbnailTimer = setInterval(() => {
      this.generateThumbnail()
        .catch(error => this.handleError(error instanceof Error ? error : new Error(String(error))));
    }, this.config.thumbnailInterval * 1000);
  }
  
  /**
   * Generate a thumbnail from the current frame
   * 
   * @returns Promise that resolves when thumbnail is generated
   */
  private async generateThumbnail(): Promise<void> {
    if (!this.currentSegment) {
      return Promise.resolve();
    }
    
    try {
      // This is a placeholder for thumbnail generation logic
      // In a real implementation, we would grab a frame and generate a thumbnail
      const thumbnailFilename = `thumbnail_${this.currentSegment.index}_${Date.now()}.jpg`;
      const thumbnailPath = path.join(
        this.config.outputDir,
        this.recordingId,
        'thumbnails',
        thumbnailFilename
      );
      
      // Update segment with thumbnail filename
      this.currentSegment.thumbnailFilename = thumbnailFilename;
      
      // Note: In a real implementation, we would use something like ffmpeg
      // to extract a frame and save it as a thumbnail
      
      return Promise.resolve();
    } catch (error) {
      this.emit(RecordingEvent.WARNING, {
        recordingId: this.recordingId,
        message: `Failed to generate thumbnail: ${error instanceof Error ? error.message : String(error)}`
      });
      return Promise.resolve(); // Don't fail recording due to thumbnail error
    }
  }
  
  /**
   * Save metadata to disk
   * 
   * @returns Promise that resolves when metadata is saved
   */
  private async saveMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(
        this.config.outputDir,
        this.recordingId,
        'metadata.json'
      );
      
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(this.metadata, null, 2)
      );
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Handle an error during recording
   * 
   * @param error The error that occurred
   */
  private handleError(error: Error): void {
    this.error = error;
    this.state = RecordingState.ERROR;
    
    this.emit(RecordingEvent.ERROR, {
      recordingId: this.recordingId,
      streamId: this.streamId,
      error
    });
    
    this.emit(RecordingEvent.STATE_CHANGE, {
      recordingId: this.recordingId,
      state: this.state
    });
  }
  
  /**
   * Get the current recording statistics
   * 
   * @returns Current recording stats
   */
  public getStats(): RecordingStats {
    return {
      recordingId: this.recordingId,
      state: this.state,
      duration: this.startTime ? 
        ((this.endTime || new Date()).getTime() - this.startTime.getTime()) / 1000 : 0,
      bytesWritten: this.metadata.totalSize,
      segmentsCompleted: this.segmentsCompleted,
      currentSegment: this.currentSegment,
      error: this.error
    };
  }
  
  /**
   * Get the recording metadata
   * 
   * @returns Recording metadata
   */
  public getMetadata(): RecordingMetadata {
    return this.metadata;
  }
  
  /**
   * Get the recording ID
   * 
   * @returns Recording ID
   */
  public getRecordingId(): string {
    return this.recordingId;
  }
  
  /**
   * Get the recording state
   * 
   * @returns Current recording state
   */
  public getState(): RecordingState {
    return this.state;
  }
}