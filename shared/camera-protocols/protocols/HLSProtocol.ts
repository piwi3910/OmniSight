/**
 * HLS Protocol Implementation
 *
 * Implements enhanced HTTP Live Streaming (HLS) protocol for the OmniSight system.
 * This protocol provides advanced features beyond basic HLS playback, including
 * multi-bitrate streaming, segment encryption, and low-latency options.
 */

import { EventEmitter } from 'events';
import { AbstractCameraProtocol } from '../AbstractCameraProtocol';
import {
  CameraCapabilities,
  CameraConfig,
  CameraInfo,
  ConnectionStatus,
  PtzMovement,
  StreamOptions,
  StreamProfile,
} from '../interfaces/ICameraProtocol';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

/**
 * HLS protocol events
 */
export enum HLSProtocolEvent {
  STREAM_STARTED = 'hls:stream_started',
  STREAM_STOPPED = 'hls:stream_stopped',
  SEGMENT_CREATED = 'hls:segment_created',
  PLAYLIST_UPDATED = 'hls:playlist_updated',
  ERROR = 'hls:error',
  WARNING = 'hls:warning',
  INFO = 'hls:info',
}

/**
 * HLS stream settings
 */
export interface HLSStreamSettings {
  // Segment duration in seconds
  segmentDuration: number;

  // Number of segments in playlist
  playlistSize: number;

  // Output directory for HLS files
  outputDir: string;

  // Unique stream identifier
  streamId: string;

  // Base URL for playlist references
  baseUrl?: string;

  // Whether to generate a master playlist for ABR
  generateMasterPlaylist: boolean;

  // Available video qualities
  videoQualities: {
    name: string;
    width: number;
    height: number;
    bitrate: number;
  }[];

  // Security options
  security?: {
    // Enable segment encryption
    enableEncryption: boolean;

    // Key rotation interval in segments
    keyRotationInterval?: number;

    // Authentication token
    authToken?: string;
  };

  // Low-latency options
  lowLatency?: {
    // Enable low-latency mode
    enabled: boolean;

    // Part duration for LL-HLS in seconds
    partDuration?: number;

    // Number of preload hints
    preloadHints?: number;
  };

  // CDN options
  cdn?: {
    // Enable CDN-compatible options
    enabled: boolean;

    // CDN base URL
    baseUrl?: string;

    // Cache control directives
    cacheControl?: string;
  };

  // FFmpeg options
  ffmpegOptions?: string[];

  // Custom HTTP headers
  httpHeaders?: Record<string, string>;
}

/**
 * HLS stream information
 */
export interface HLSStreamInfo {
  // Stream configuration
  settings: HLSStreamSettings;

  // Path to the master playlist
  masterPlaylistPath?: string;

  // Paths to variant playlists
  variantPlaylistPaths: string[];

  // Public URLs
  masterPlaylistUrl?: string;
  variantPlaylistUrls: string[];

  // Number of segments generated
  segmentsGenerated: number;

  // Stream start time
  startTime: Date;

  // Stream duration in seconds
  duration: number;

  // Current FFmpeg process
  ffmpegProcess?: ChildProcess;

  // Current processing status
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

  // Last error message
  lastError?: string;
}

/**
 * HLS protocol statistics
 */
export interface HLSProtocolStats {
  // Active streams count
  activeStreams: number;

  // Total segments generated
  totalSegmentsGenerated: number;

  // Storage used in bytes
  storageUsed: number;

  // Active quality variants
  activeQualityVariants: number;

  // Encryption key rotations
  keyRotations: number;

  // CDN traffic in bytes
  cdnTraffic: number;
}

/**
 * Enhanced HLS protocol implementation for OmniSight system
 */
export class HLSProtocol extends AbstractCameraProtocol {
  // Protocol identifier
  readonly protocolId: string = 'hls';

  // Protocol name
  readonly protocolName: string = 'HTTP Live Streaming (HLS)';

  // Protocol capabilities - will be updated based on setup
  readonly capabilities: CameraCapabilities = {
    ptz: false,
    presets: false,
    digitalPtz: false,
    motionDetection: false,
    audio: true,
    twoWayAudio: false,
    encodings: ['h264', 'h265', 'aac'],
    authMethods: ['token', 'cookies'],
    localRecording: true,
    events: false,
    protocolSpecific: {
      supportsAdaptiveBitrate: true,
      supportsLowLatency: true,
      supportsCDN: true,
      supportsEncryption: true,
    },
  };

  // Active HLS streams
  private hlsStreams: Map<string, HLSStreamInfo> = new Map();

  // Encryption keys for streams
  private encryptionKeys: Map<string, Map<string, Buffer>> = new Map();

  // Statistics
  private stats: HLSProtocolStats = {
    activeStreams: 0,
    totalSegmentsGenerated: 0,
    storageUsed: 0,
    activeQualityVariants: 0,
    keyRotations: 0,
    cdnTraffic: 0,
  };

  // Event emitter for internal events
  private eventEmitter = new EventEmitter();

  // Output base directory
  private baseOutputDir: string;

  // Default stream settings
  private defaultStreamSettings: Partial<HLSStreamSettings> = {
    segmentDuration: 4,
    playlistSize: 5,
    generateMasterPlaylist: true,
    videoQualities: [
      {
        name: 'high',
        width: 1280,
        height: 720,
        bitrate: 2500000,
      },
      {
        name: 'medium',
        width: 854,
        height: 480,
        bitrate: 1000000,
      },
      {
        name: 'low',
        width: 640,
        height: 360,
        bitrate: 500000,
      },
    ],
    security: {
      enableEncryption: false,
      keyRotationInterval: 10,
    },
    lowLatency: {
      enabled: false,
      partDuration: 0.5,
      preloadHints: 3,
    },
    cdn: {
      enabled: false,
      cacheControl: 'max-age=5',
    },
  };

  // Logger
  private logger = {
    debug: (message: string) => console.debug(`[HLS] ${message}`),
    info: (message: string) => console.info(`[HLS] ${message}`),
    warn: (message: string) => console.warn(`[HLS] ${message}`),
    error: (message: string) => console.error(`[HLS] ${message}`),
  };

  /**
   * Create a new HLS protocol instance
   *
   * @param baseOutputDir Base directory for HLS output files
   */
  constructor(baseOutputDir: string = '/tmp/omnisight-hls') {
    super();
    this.baseOutputDir = baseOutputDir;

    // Set up event handlers
    this.setupEventHandlers();

    // Ensure base directory exists
    this.ensureDirectoryExists(this.baseOutputDir);
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Handle segment creation events
    this.eventEmitter.on(HLSProtocolEvent.SEGMENT_CREATED, (data: { streamId: string }) => {
      this.stats.totalSegmentsGenerated++;
      const stream = this.hlsStreams.get(data.streamId);
      if (stream) {
        stream.segmentsGenerated++;
      }
    });

    // Handle stream started events
    this.eventEmitter.on(HLSProtocolEvent.STREAM_STARTED, () => {
      this.stats.activeStreams = this.hlsStreams.size;
    });

    // Handle stream stopped events
    this.eventEmitter.on(HLSProtocolEvent.STREAM_STOPPED, () => {
      this.stats.activeStreams = this.hlsStreams.size;
    });

    // Handle error events
    this.eventEmitter.on(HLSProtocolEvent.ERROR, (error: Error | string) => {
      this.logger.error(`HLS error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  /**
   * Connect to the camera
   *
   * @param config Camera configuration
   * @returns Promise that resolves to true when connected
   */
  protected async performConnect(config: CameraConfig): Promise<boolean> {
    // HLS doesn't have a persistent connection to the camera, just validate config
    if (!config.host) {
      this.logger.error('Invalid camera configuration: host is required');
      return false;
    }

    // Set up HLS-specific configuration
    if (config.options?.hls) {
      // Update capabilities based on configuration
      this.capabilities.audio = config.options.hls.audio !== false;
      this.capabilities.localRecording = config.options.hls.recording !== false;

      if (config.options.hls.videoQualities) {
        this.defaultStreamSettings.videoQualities = config.options.hls.videoQualities;
      }

      if (config.options.hls.segmentDuration) {
        this.defaultStreamSettings.segmentDuration = config.options.hls.segmentDuration;
      }

      if (config.options.hls.playlistSize) {
        this.defaultStreamSettings.playlistSize = config.options.hls.playlistSize;
      }

      if (config.options.hls.security) {
        this.defaultStreamSettings.security = {
          ...this.defaultStreamSettings.security,
          ...config.options.hls.security,
        };
      }

      if (config.options.hls.lowLatency) {
        this.defaultStreamSettings.lowLatency = {
          ...this.defaultStreamSettings.lowLatency,
          ...config.options.hls.lowLatency,
        };
      }

      if (config.options.hls.cdn) {
        this.defaultStreamSettings.cdn = {
          ...this.defaultStreamSettings.cdn,
          ...config.options.hls.cdn,
        };
      }
    }

    return true;
  }

  /**
   * Disconnect from the camera
   */
  protected async performDisconnect(): Promise<void> {
    // Stop all active streams
    for (const streamId of this.hlsStreams.keys()) {
      await this.stopHLSStream(streamId);
    }
  }

  /**
   * Get a frame from the camera
   */
  async getFrame(): Promise<Uint8Array> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Cannot get frame: Camera is not connected');
    }

    // Extract a frame from an active stream
    if (this.hlsStreams.size === 0) {
      throw new Error('No active HLS streams available for frame extraction');
    }

    // Get the first stream
    const streamId = this.hlsStreams.keys().next().value;
    const stream = streamId ? this.hlsStreams.get(streamId) : undefined;

    if (!stream) {
      throw new Error('Stream not found');
    }

    try {
      // Use FFmpeg to extract a single frame
      const outputPath = path.join(this.baseOutputDir, `frame-${Date.now()}.jpg`);

      // Get the first variant playlist
      const variantPlaylistPath = stream.variantPlaylistPaths[0];

      return new Promise<Uint8Array>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i',
          variantPlaylistPath,
          '-vframes',
          '1',
          '-q:v',
          '2',
          outputPath,
        ]);

        ffmpeg.on('close', code => {
          if (code !== 0) {
            reject(new Error(`FFmpeg exited with code ${code}`));
            return;
          }

          // Read the frame
          fs.readFile(outputPath, (err, data) => {
            // Clean up
            fs.unlink(outputPath, () => {});

            if (err) {
              reject(err);
              return;
            }

            resolve(new Uint8Array(data));
          });
        });

        ffmpeg.on('error', err => {
          reject(err);
        });
      });
    } catch (error) {
      this.logger.error(
        `Error extracting frame: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get camera information
   */
  async getCameraInfo(): Promise<CameraInfo> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Camera is not connected');
    }

    return {
      manufacturer: 'Generic',
      model: 'HLS Camera',
      firmwareVersion: 'N/A',
      additionalInfo: {
        protocolType: 'HLS',
        activeStreams: this.hlsStreams.size,
        hlsVersion: '3.0',
        supportedFeatures: Object.keys(this.capabilities.protocolSpecific || {}),
      },
    };
  }

  /**
   * Get available stream profiles
   */
  async getAvailableStreams(): Promise<StreamProfile[]> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Camera is not connected');
    }

    // HLS supports multiple quality variants
    return (this.defaultStreamSettings.videoQualities || []).map(quality => ({
      id: quality.name,
      name: `HLS ${quality.name} (${quality.width}x${quality.height})`,
      encoding: 'h264',
      resolution: {
        width: quality.width,
        height: quality.height,
      },
      frameRate: 30,
      bitrate: quality.bitrate,
      parameters: {
        segmentDuration: this.defaultStreamSettings.segmentDuration,
        playlistSize: this.defaultStreamSettings.playlistSize,
        lowLatency: this.defaultStreamSettings.lowLatency?.enabled,
      },
    }));
  }

  /**
   * Get protocol-specific options
   */
  getProtocolOptions(): Record<string, unknown> {
    return {
      defaultStreamSettings: this.defaultStreamSettings,
      activeStreams: Array.from(this.hlsStreams.entries()).map(([id, info]) => ({
        id,
        status: info.status,
        startTime: info.startTime,
        duration: info.duration,
        segmentsGenerated: info.segmentsGenerated,
        qualities: info.settings.videoQualities.map((q: { name: string }) => q.name),
        urls: {
          master: info.masterPlaylistUrl,
          variants: info.variantPlaylistUrls,
        },
        security: {
          encrypted: info.settings.security?.enableEncryption,
          keyRotationEnabled: info.settings.security?.keyRotationInterval !== undefined,
          keyRotationInterval: info.settings.security?.keyRotationInterval,
        },
        lowLatency: info.settings.lowLatency?.enabled,
      })),
      stats: this.stats,
    };
  }

  /**
   * Set protocol-specific options
   */
  async setProtocolOptions(options: Record<string, unknown>): Promise<void> {
    if (options.defaultStreamSettings) {
      this.defaultStreamSettings = {
        ...this.defaultStreamSettings,
        ...options.defaultStreamSettings,
      };
    }

    if (options.baseOutputDir && typeof options.baseOutputDir === 'string') {
      this.baseOutputDir = options.baseOutputDir;
      this.ensureDirectoryExists(this.baseOutputDir);
    }
  }

  /**
   * Start a stream
   */
  protected async performStartStream(options?: StreamOptions): Promise<string> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Camera is not connected');
    }

    if (!this.config) {
      throw new Error('Camera configuration is missing');
    }

    try {
      // Generate a stream ID
      const streamId = `hls-stream-${uuidv4()}`;

      // Set up output directory
      const outputDir = path.join(this.baseOutputDir, streamId);
      this.ensureDirectoryExists(outputDir);

      // Merge default settings with options
      const selectedQualities = options?.profile
        ? [this.defaultStreamSettings.videoQualities?.find(q => q.name === options.profile)].filter(
            Boolean
          )
        : this.defaultStreamSettings.videoQualities;

      if (!selectedQualities || selectedQualities.length === 0) {
        throw new Error('No valid quality profile found');
      }

      // Create stream settings
      const streamSettings: HLSStreamSettings = {
        segmentDuration:
          (options?.parameters?.segmentDuration as number) ||
          this.defaultStreamSettings.segmentDuration ||
          4,
        playlistSize:
          (options?.parameters?.playlistSize as number) ||
          this.defaultStreamSettings.playlistSize ||
          5,
        outputDir,
        streamId,
        baseUrl: (options?.parameters?.baseUrl as string) || this.defaultStreamSettings.baseUrl,
        generateMasterPlaylist: selectedQualities.length > 1,
        videoQualities: selectedQualities as Array<{
          name: string;
          width: number;
          height: number;
          bitrate: number;
        }>,
        security: {
          enableEncryption:
            (options?.parameters?.enableEncryption as boolean) ||
            this.defaultStreamSettings.security?.enableEncryption ||
            false,
          keyRotationInterval:
            (options?.parameters?.keyRotationInterval as number) ||
            this.defaultStreamSettings.security?.keyRotationInterval,
        },
        lowLatency: {
          enabled:
            (options?.parameters?.lowLatency as boolean) ||
            this.defaultStreamSettings.lowLatency?.enabled ||
            false,
          partDuration:
            (options?.parameters?.partDuration as number) ||
            this.defaultStreamSettings.lowLatency?.partDuration,
          preloadHints:
            (options?.parameters?.preloadHints as number) ||
            this.defaultStreamSettings.lowLatency?.preloadHints,
        },
        cdn: {
          enabled:
            (options?.parameters?.cdnEnabled as boolean) ||
            this.defaultStreamSettings.cdn?.enabled ||
            false,
          baseUrl:
            (options?.parameters?.cdnBaseUrl as string) || this.defaultStreamSettings.cdn?.baseUrl,
          cacheControl:
            (options?.parameters?.cacheControl as string) ||
            this.defaultStreamSettings.cdn?.cacheControl,
        },
        ffmpegOptions:
          (options?.parameters?.ffmpegOptions as string[]) ||
          this.defaultStreamSettings.ffmpegOptions,
      };

      // Start HLS stream
      await this.startHLSStream(streamId, streamSettings, this.config);

      return streamId;
    } catch (error) {
      this.logger.error(
        `Failed to start HLS stream: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Stop a stream
   */
  protected async performStopStream(streamId: string): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      return;
    }

    await this.stopHLSStream(streamId);
  }

  /**
   * Start an HLS stream
   *
   * @param streamId Stream identifier
   * @param settings Stream settings
   * @param config Camera configuration
   */
  private async startHLSStream(
    streamId: string,
    settings: HLSStreamSettings,
    config: CameraConfig
  ): Promise<void> {
    // Create stream info object
    const streamInfo: HLSStreamInfo = {
      settings,
      variantPlaylistPaths: [],
      variantPlaylistUrls: [],
      segmentsGenerated: 0,
      startTime: new Date(),
      duration: 0,
      status: 'starting',
    };

    // Store stream info
    this.hlsStreams.set(streamId, streamInfo);

    try {
      // Generate encryption keys if needed
      if (settings.security?.enableEncryption) {
        await this.generateEncryptionKeys(streamId, settings);
      }

      // Build FFmpeg command for each quality variant
      const qualityVariants = settings.videoQualities;

      // Set up master playlist path
      if (settings.generateMasterPlaylist) {
        streamInfo.masterPlaylistPath = path.join(settings.outputDir, 'master.m3u8');
        streamInfo.masterPlaylistUrl = settings.baseUrl
          ? `${settings.baseUrl}/${streamId}/master.m3u8`
          : `file://${streamInfo.masterPlaylistPath}`;
      }

      // Create variant playlists
      for (const quality of qualityVariants) {
        const variantDir = path.join(settings.outputDir, quality.name);
        this.ensureDirectoryExists(variantDir);

        const variantPlaylistPath = path.join(variantDir, 'playlist.m3u8');
        streamInfo.variantPlaylistPaths.push(variantPlaylistPath);

        const variantPlaylistUrl = settings.baseUrl
          ? `${settings.baseUrl}/${streamId}/${quality.name}/playlist.m3u8`
          : `file://${variantPlaylistPath}`;
        streamInfo.variantPlaylistUrls.push(variantPlaylistUrl);
      }

      // Update stream info
      this.hlsStreams.set(streamId, streamInfo);

      // Build source URL
      const sourceUrl = this.buildSourceUrl(config);

      // Start FFmpeg process to generate HLS streams
      await this.startFFmpegProcess(streamId, sourceUrl, streamInfo);

      // Update status
      streamInfo.status = 'running';
      this.hlsStreams.set(streamId, streamInfo);

      // Emit stream started event
      this.eventEmitter.emit(HLSProtocolEvent.STREAM_STARTED, {
        streamId,
        settings,
        masterPlaylistUrl: streamInfo.masterPlaylistUrl,
        variantPlaylistUrls: streamInfo.variantPlaylistUrls,
      });

      // Update stats
      this.stats.activeStreams = this.hlsStreams.size;
      this.stats.activeQualityVariants += settings.videoQualities.length;

      // Generate master playlist if needed
      if (settings.generateMasterPlaylist) {
        await this.generateMasterPlaylist(streamId, streamInfo);
      }
    } catch (error) {
      // Update status
      streamInfo.status = 'error';
      streamInfo.lastError = error instanceof Error ? error.message : String(error);
      this.hlsStreams.set(streamId, streamInfo);

      // Emit error event
      this.eventEmitter.emit(HLSProtocolEvent.ERROR, {
        streamId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      // Clean up
      await this.stopHLSStream(streamId);

      throw error;
    }
  }

  /**
   * Build source URL from camera configuration
   *
   * @param config Camera configuration
   * @returns Source URL for FFmpeg
   */
  private buildSourceUrl(config: CameraConfig): string {
    const protocol = config.options?.protocol || 'rtsp';

    if (protocol === 'rtsp') {
      // Build RTSP URL
      const credentials =
        config.username && config.password
          ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
          : '';

      return `rtsp://${credentials}${config.host}:${config.port || 554}${config.path || ''}`;
    } else if (protocol === 'http' || protocol === 'https') {
      // Build HTTP URL
      return `${protocol}://${config.host}:${config.port || 80}${config.path || ''}`;
    } else {
      // Custom protocol or file
      return config.options?.sourceUrl || '';
    }
  }

  /**
   * Start FFmpeg process to generate HLS streams
   *
   * @param streamId Stream identifier
   * @param sourceUrl Source URL
   * @param streamInfo Stream information
   */
  private async startFFmpegProcess(
    streamId: string,
    sourceUrl: string,
    streamInfo: HLSStreamInfo
  ): Promise<void> {
    const settings = streamInfo.settings;
    const qualityVariants = settings.videoQualities;

    // Base FFmpeg arguments
    const baseArgs = [
      '-y', // Overwrite output files
      '-i',
      sourceUrl, // Input source
      '-loglevel',
      'warning', // Set log level
    ];

    // Add custom FFmpeg options if provided
    if (settings.ffmpegOptions && settings.ffmpegOptions.length > 0) {
      baseArgs.push(...settings.ffmpegOptions);
    }

    // Map streams and add output options for each quality variant
    for (let i = 0; i < qualityVariants.length; i++) {
      const quality = qualityVariants[i];
      const variantDir = path.join(settings.outputDir, quality.name);

      // Video options
      baseArgs.push(
        '-map',
        '0:v:0', // Map video stream
        '-c:v',
        'libx264', // Video codec
        '-profile:v',
        'main', // H.264 profile
        '-preset',
        'veryfast', // Encoding preset
        '-crf',
        '23', // Constant rate factor
        '-sc_threshold',
        '0', // Scene change threshold
        '-g',
        `${2 * Math.round(30)}`, // GOP size (2 seconds at 30 fps)
        '-keyint_min',
        `${Math.round(30)}`, // Minimum keyframe interval
        '-r',
        '30', // Frame rate
        '-b:v',
        `${quality.bitrate}`, // Video bitrate
        '-maxrate',
        `${Math.floor(quality.bitrate * 1.2)}`, // Max bitrate
        '-bufsize',
        `${Math.floor(quality.bitrate * 2)}`, // Buffer size
        '-s',
        `${quality.width}x${quality.height}` // Resolution
      );

      // Audio options if available
      if (this.capabilities.audio) {
        baseArgs.push(
          '-map',
          '0:a:0?', // Map audio stream if available
          '-c:a',
          'aac', // Audio codec
          '-b:a',
          '128k', // Audio bitrate
          '-ac',
          '2' // Audio channels
        );
      } else {
        baseArgs.push('-an'); // No audio
      }

      // HLS options
      baseArgs.push(
        '-f',
        'hls', // Format
        '-hls_time',
        `${settings.segmentDuration}`, // Segment duration
        '-hls_list_size',
        `${settings.playlistSize}`, // Playlist size
        '-hls_segment_filename',
        `${path.join(variantDir, 'segment_%03d.ts')}`, // Segment filename pattern
        '-hls_flags',
        'independent_segments' // Each segment is independent
      );

      // Add delete segments option if CDN is not enabled
      if (!settings.cdn?.enabled) {
        baseArgs.push('+delete_segments');
      }

      // Add low-latency options if enabled
      if (settings.lowLatency?.enabled) {
        baseArgs.push(
          '-hls_flags',
          'program_date_time+low_latency',
          '-hls_segment_type',
          'fmp4', // Use fMP4 segments for LL-HLS
          '-hls_fmp4_init_filename',
          'init.mp4', // Initialization segment name
          '-hls_segment_options',
          'fmp4_padding=1', // Add empty moof atom for low latency
          '-hls_playlist_type',
          'event', // Live event
          '-method',
          'PUT' // Use PUT for segment uploads
        );

        if (settings.lowLatency.partDuration) {
          baseArgs.push(
            '-hls_part_time',
            `${settings.lowLatency.partDuration}` // Part duration for LL-HLS
          );
        }
      }

      // Add encryption options if enabled
      if (settings.security?.enableEncryption) {
        const keyInfoFile = path.join(variantDir, 'enc.keyinfo');
        baseArgs.push('-hls_key_info_file', keyInfoFile);
      }

      // Output variant playlist
      baseArgs.push(streamInfo.variantPlaylistPaths[i]);
    }

    // Start FFmpeg process
    return new Promise<void>((resolve, reject) => {
      try {
        const ffmpeg = spawn('ffmpeg', baseArgs);

        // Store process in stream info
        streamInfo.ffmpegProcess = ffmpeg;
        this.hlsStreams.set(streamId, streamInfo);

        // Handle FFmpeg output
        ffmpeg.stdout.on('data', data => {
          this.logger.debug(`FFmpeg output: ${data}`);
        });

        ffmpeg.stderr.on('data', data => {
          const output = data.toString();

          // Look for segment creation in output
          if (output.includes('Opening') && output.includes('for writing')) {
            // A new segment is being created
            const match = output.match(/Opening\s+'([^']+)'\s+for\s+writing/);
            if (match && match[1]) {
              const segmentPath = match[1];
              // Extract variant name from path
              const pathParts = segmentPath.split(path.sep);
              const variantIndex = pathParts.indexOf(streamId) + 1;
              const variantName =
                variantIndex < pathParts.length ? pathParts[variantIndex] : 'unknown';

              // Emit segment created event
              this.eventEmitter.emit(HLSProtocolEvent.SEGMENT_CREATED, {
                streamId,
                segmentPath,
                variant: variantName,
              });

              // Update playlist status
              this.eventEmitter.emit(HLSProtocolEvent.PLAYLIST_UPDATED, {
                streamId,
                variant: variantName,
              });
            }
          } else if (output.includes('Error')) {
            // Error in FFmpeg
            this.logger.error(`FFmpeg error: ${output}`);

            // Emit error event
            this.eventEmitter.emit(HLSProtocolEvent.ERROR, {
              streamId,
              error: new Error(`FFmpeg error: ${output}`),
            });
          }
        });

        // Handle FFmpeg process exit
        ffmpeg.on('close', code => {
          this.logger.info(`FFmpeg process exited with code ${code}`);

          // Update stream info
          const stream = this.hlsStreams.get(streamId);
          if (stream) {
            stream.ffmpegProcess = undefined;
            if (code === 0) {
              stream.status = 'stopped';
            } else {
              stream.status = 'error';
              stream.lastError = `FFmpeg exited with code ${code}`;
            }
            this.hlsStreams.set(streamId, stream);
          }

          // FFmpeg process exited
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`));
          }
        });

        // Handle FFmpeg process error
        ffmpeg.on('error', err => {
          this.logger.error(`FFmpeg process error: ${err.message}`);

          // Update stream info
          const stream = this.hlsStreams.get(streamId);
          if (stream) {
            stream.ffmpegProcess = undefined;
            stream.status = 'error';
            stream.lastError = err.message;
            this.hlsStreams.set(streamId, stream);
          }

          // Emit error event
          this.eventEmitter.emit(HLSProtocolEvent.ERROR, {
            streamId,
            error: err,
          });

          reject(err);
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate master playlist for adaptive bitrate streaming
   *
   * @param streamId Stream identifier
   * @param streamInfo Stream information
   */
  private async generateMasterPlaylist(streamId: string, streamInfo: HLSStreamInfo): Promise<void> {
    if (!streamInfo.masterPlaylistPath) {
      return;
    }

    try {
      // Create master playlist content
      let masterPlaylistContent = '#EXTM3U\n';
      masterPlaylistContent += '#EXT-X-VERSION:3\n';

      // Add variant streams
      for (let i = 0; i < streamInfo.settings.videoQualities.length; i++) {
        const quality = streamInfo.settings.videoQualities[i];
        const bandwidth = quality.bitrate;
        const resolution = `${quality.width}x${quality.height}`;

        // Generate relative path to variant playlist
        const variantPath = `./${quality.name}/playlist.m3u8`;

        // Add stream info
        masterPlaylistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},NAME="${quality.name}"\n`;
        masterPlaylistContent += `${variantPath}\n`;
      }

      // Write master playlist to file
      await fs.promises.writeFile(streamInfo.masterPlaylistPath, masterPlaylistContent);

      // Emit playlist updated event
      this.eventEmitter.emit(HLSProtocolEvent.PLAYLIST_UPDATED, {
        streamId,
        masterPlaylist: true,
      });
    } catch (error) {
      this.logger.error(
        `Error generating master playlist: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate encryption keys for HLS stream
   *
   * @param streamId Stream identifier
   * @param settings Stream settings
   */
  private async generateEncryptionKeys(
    streamId: string,
    settings: HLSStreamSettings
  ): Promise<void> {
    if (!settings.security?.enableEncryption) {
      return;
    }

    try {
      // Create key map for this stream
      const keyMap = new Map<string, Buffer>();
      this.encryptionKeys.set(streamId, keyMap);

      // Generate key for each quality variant
      for (const quality of settings.videoQualities) {
        // Generate encryption key
        const key = crypto.randomBytes(16);
        keyMap.set(quality.name, key);

        // Create key file
        const keyDir = path.join(settings.outputDir, quality.name);
        this.ensureDirectoryExists(keyDir);

        const keyPath = path.join(keyDir, 'enc.key');
        const keyInfoPath = path.join(keyDir, 'enc.keyinfo');

        // Write key to file
        await fs.promises.writeFile(keyPath, key);

        // Create key info file
        let keyInfoContent = keyPath + '\n';
        keyInfoContent += path.join(quality.name, 'enc.key') + '\n'; // Path in playlist
        keyInfoContent += Buffer.from(crypto.randomBytes(16)).toString('hex');

        await fs.promises.writeFile(keyInfoPath, keyInfoContent);

        // Update stats
        this.stats.keyRotations++;
      }
    } catch (error) {
      this.logger.error(
        `Error generating encryption keys: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Stop an HLS stream
   *
   * @param streamId Stream identifier
   */
  private async stopHLSStream(streamId: string): Promise<void> {
    // Get stream info
    const streamInfo = this.hlsStreams.get(streamId);
    if (!streamInfo) {
      return;
    }

    try {
      // Update status
      streamInfo.status = 'stopping';
      this.hlsStreams.set(streamId, streamInfo);

      // Stop FFmpeg process if running
      if (streamInfo.ffmpegProcess) {
        streamInfo.ffmpegProcess.kill('SIGTERM');

        // Wait for process to exit
        await new Promise<void>(resolve => {
          if (!streamInfo.ffmpegProcess) {
            resolve();
            return;
          }

          streamInfo.ffmpegProcess.once('close', () => {
            resolve();
          });

          // Force kill after timeout
          setTimeout(() => {
            if (streamInfo.ffmpegProcess) {
              streamInfo.ffmpegProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        });

        streamInfo.ffmpegProcess = undefined;
      }

      // Calculate stream duration
      streamInfo.duration = (Date.now() - streamInfo.startTime.getTime()) / 1000;

      // Update status
      streamInfo.status = 'stopped';
      this.hlsStreams.set(streamId, streamInfo);

      // Remove encryption keys
      this.encryptionKeys.delete(streamId);

      // Update stats
      this.stats.activeQualityVariants -= streamInfo.settings.videoQualities.length;

      // Remove from active streams
      this.hlsStreams.delete(streamId);

      // Emit stream stopped event
      this.eventEmitter.emit(HLSProtocolEvent.STREAM_STOPPED, {
        streamId,
        duration: streamInfo.duration,
        segmentsGenerated: streamInfo.segmentsGenerated,
      });

      // Update stats
      this.stats.activeStreams = this.hlsStreams.size;

      // Clean up output directory if needed
      if (streamInfo.settings.security?.enableEncryption) {
        // Keep files for encrypted streams
        return;
      }

      if (streamInfo.settings.cdn?.enabled) {
        // Keep files for CDN-enabled streams
        return;
      }

      // Delete output directory
      fs.rm(streamInfo.settings.outputDir, { recursive: true, force: true }, err => {
        if (err) {
          this.logger.warn(`Error removing output directory: ${err.message}`);
        }
      });
    } catch (error) {
      this.logger.error(
        `Error stopping HLS stream: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Ensure a directory exists
   *
   * @param dir Directory path
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Test connection to camera
   */
  protected async performTestConnection(config: CameraConfig): Promise<boolean> {
    try {
      // Build source URL
      const sourceUrl = this.buildSourceUrl(config);

      // Test connection using FFmpeg
      return new Promise<boolean>(resolve => {
        const ffmpeg = spawn('ffmpeg', [
          '-t',
          '1', // Stop after 1 second
          '-i',
          sourceUrl, // Input source
          '-f',
          'null', // Null output
          '-', // Output to stdout
        ]);

        let output = '';

        ffmpeg.stderr.on('data', data => {
          output += data.toString();
        });

        ffmpeg.on('close', code => {
          // Check for successful connection
          const hasVideoStream = output.includes('Video:');
          resolve(code === 0 || hasVideoStream);
        });

        ffmpeg.on('error', () => {
          resolve(false);
        });

        // Kill process after timeout
        setTimeout(() => {
          ffmpeg.kill('SIGKILL');
          resolve(false);
        }, 5000);
      });
    } catch {
      return false;
    }
  }

  /**
   * The following methods are not supported by HLS protocol and will throw errors
   */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected performMove(_movement: PtzMovement): Promise<void> {
    throw new Error('PTZ controls are not supported by HLS protocol');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected performGotoPreset(_presetId: string): Promise<void> {
    throw new Error('PTZ presets are not supported by HLS protocol');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected performSavePreset(_presetName: string): Promise<string> {
    throw new Error('PTZ presets are not supported by HLS protocol');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected performSubscribeToEvents(_eventTypes: string[]): Promise<string> {
    throw new Error('Event subscription is not supported by HLS protocol');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected performUnsubscribeFromEvents(_subscriptionId: string): Promise<void> {
    throw new Error('Event subscription is not supported by HLS protocol');
    throw new Error('Event subscription is not supported by HLS protocol');
  }
}
