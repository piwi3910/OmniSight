import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  IconButton,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Slider,
  Typography,
  Stack,
  Grid
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import LowQualityIcon from '@mui/icons-material/SignalCellular1Bar';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_STREAM_SETTINGS } from '../config';

interface HLSPlayerProps {
  cameraId: string;
  streamId?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  width?: string | number;
  height?: string | number;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  className?: string;
  style?: React.CSSProperties;
  lowLatency?: boolean;
}

interface HLSLevel {
  bitrate: number;
  width: number;
  height: number;
  name: string;
  level: number;
}

interface StreamStats {
  bandwidthEstimate: number;
  bitrateDownload: number;
  bufferLength: number;
  droppedFrames: number;
  latency: number;
  playbackRate: number;
  resolution: string;
  currentLevel: number;
}

const HLSPlayer: React.FC<HLSPlayerProps> = ({
  cameraId,
  streamId = 'primary',
  autoPlay = true,
  muted = true,
  controls = true,
  width = '100%',
  height = 'auto',
  onError,
  onStatusChange,
  className,
  style,
  lowLatency = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(!muted);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [levels, setLevels] = useState<HLSLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 means auto
  const [latencyMode, setLatencyMode] = useState<'auto' | 'low' | 'normal'>(lowLatency ? 'low' : 'auto');
  
  const [statsVisible, setStatsVisible] = useState(false);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [statsInterval, setStatsIntervalRef] = useState<NodeJS.Timeout | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Set up HLS player on mount
  useEffect(() => {
    if (cameraId) {
      initPlayer();
    }
    
    return () => {
      destroyPlayer();
    };
  }, [cameraId, streamId, latencyMode]);

  // Status change effect
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(connectionStatus);
    }
  }, [connectionStatus, onStatusChange]);

  // Initialize HLS player
  const initPlayer = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');
      destroyPlayer(); // Clean up any existing player
      
      // Check if HLS.js is supported
      if (!Hls.isSupported()) {
        throw new Error('HLS is not supported in this browser');
      }
      
      // Get stream URL from API
      const response = await axios.get(`${API_BASE_URL}/cameras/${cameraId}/stream/hls`, {
        params: {
          streamId,
          lowLatency: latencyMode === 'low'
        }
      });
      
      const url = response.data.url;
      setStreamUrl(url);
      
      // Create HLS instance
      const hls = new Hls(getHlsConfig());
      hlsRef.current = hls;
      
      if (videoRef.current) {
        // Bind HLS to video element
        hls.attachMedia(videoRef.current);
        
        // Set up event handlers
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(url);
        });
        
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          // Get quality levels
          const newLevels = data.levels.map((level, index) => ({
            bitrate: level.bitrate,
            width: level.width,
            height: level.height,
            name: `${level.width}x${level.height}`,
            level: index
          }));
          
          setLevels(newLevels);
          
          // Start playback if autoplay is enabled
          if (autoPlay && videoRef.current) {
            videoRef.current.play().catch(error => {
              console.error('Error starting video playback:', error);
            });
          }
          
          setConnectionStatus('connected');
          setLoading(false);
          
          // Start stats monitoring
          startStatsPolling();
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Try to recover network error
                console.error('Network error:', data);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Try to recover media error
                console.error('Media error:', data);
                hls.recoverMediaError();
                break;
              default:
                // Cannot recover
                console.error('Fatal error:', data);
                destroyPlayer();
                setConnectionStatus('error');
                if (onError) onError('Fatal streaming error');
                break;
            }
          }
        });
        
        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          setCurrentLevel(data.level);
          
          // Update stats
          if (streamStats && levels[data.level]) {
            setStreamStats({
              ...streamStats,
              currentLevel: data.level,
              resolution: `${levels[data.level].width}x${levels[data.level].height}`
            });
          }
        });
      }
    } catch (error) {
      console.error('Error initializing HLS player:', error);
      setConnectionStatus('error');
      setLoading(false);
      if (onError) onError('Failed to initialize HLS player');
    }
  };

  // Clean up player
  const destroyPlayer = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (statsInterval) {
      clearInterval(statsInterval);
      setStatsIntervalRef(null);
    }
    
    setLevels([]);
    setCurrentLevel(-1);
    setStreamStats(null);
  };

  // Get HLS.js configuration based on latency mode
  const getHlsConfig = () => {
    const defaultConfig = DEFAULT_STREAM_SETTINGS.hls;
    
    switch (latencyMode) {
      case 'low':
        return {
          ...defaultConfig,
          lowLatencyMode: true,
          liveSyncDuration: 3,
          liveMaxLatencyDuration: 6,
          liveDurationInfinity: true,
          highBufferWatchdogPeriod: 1,
          maxBufferLength: 4
        };
      case 'normal':
        return {
          ...defaultConfig,
          lowLatencyMode: false,
          liveSyncDuration: 3,
          liveMaxLatencyDuration: 10,
          maxBufferLength: 30,
          maxMaxBufferLength: 60
        };
      case 'auto':
      default:
        return defaultConfig;
    }
  };

  // Handle manually setting quality level
  const handleQualityChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    const level = value === 'auto' ? -1 : parseInt(value);
    
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      hlsRef.current.nextLevel = level;
    }
    
    setCurrentLevel(level);
  };

  // Handle latency mode change
  const handleLatencyModeChange = (newMode: 'auto' | 'low' | 'normal') => {
    setLatencyMode(newMode);
    
    // Reinitialize player with new settings
    initPlayer();
  };

  // Handle audio toggle
  const handleAudioToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !audioEnabled;
      setAudioEnabled(!audioEnabled);
    }
  };

  // Handle fullscreen
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Poll for stream statistics
  const startStatsPolling = () => {
    // Clear existing interval if any
    if (statsInterval) {
      clearInterval(statsInterval);
    }
    
    // Start with initial stats
    const initialStats: StreamStats = {
      bandwidthEstimate: 0,
      bitrateDownload: 0,
      bufferLength: 0,
      droppedFrames: 0,
      latency: 0,
      playbackRate: 1,
      resolution: currentLevel >= 0 && levels[currentLevel] ? 
        `${levels[currentLevel].width}x${levels[currentLevel].height}` : 'Auto',
      currentLevel: currentLevel
    };
    
    setStreamStats(initialStats);
    
    // Start new polling interval
    const interval = setInterval(() => {
      if (hlsRef.current && videoRef.current) {
        const hls = hlsRef.current;
        const video = videoRef.current;
        
        // Get updated stats
        setStreamStats({
          bandwidthEstimate: Math.round(hls.bandwidthEstimate / 1000), // kbps
          bitrateDownload: Math.round((hls as any).bitrateTest || 0),
          bufferLength: Math.round(hls.mainBufferInfo?.len || 0),
          droppedFrames: (video as any).webkitDroppedFrameCount || 0,
          latency: Math.round((hls as any).latency || 0),
          playbackRate: video.playbackRate,
          resolution: currentLevel >= 0 && levels[currentLevel] ? 
            `${levels[currentLevel].width}x${levels[currentLevel].height}` : 'Auto',
          currentLevel: currentLevel
        });
      }
    }, 1000);
    
    setStatsIntervalRef(interval);
  };

  return (
    <Box 
      className={className}
      style={style}
      sx={{ position: 'relative', width, height }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        controls={false}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      
      {/* Loading Indicator */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        >
          <CircularProgress color="primary" />
        </Box>
      )}
      
      {/* Stats Overlay */}
      {statsVisible && streamStats && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            fontSize: '0.75rem'
          }}
        >
          <Typography variant="caption" component="div">
            Resolution: {streamStats.resolution}
          </Typography>
          <Typography variant="caption" component="div">
            Bandwidth: {streamStats.bandwidthEstimate} kbps
          </Typography>
          <Typography variant="caption" component="div">
            Buffer: {streamStats.bufferLength.toFixed(1)}s
          </Typography>
          <Typography variant="caption" component="div">
            Latency: {streamStats.latency}ms
          </Typography>
          <Typography variant="caption" component="div">
            Dropped Frames: {streamStats.droppedFrames}
          </Typography>
        </Box>
      )}
      
      {/* Control Bar */}
      {controls && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Left Controls */}
          <Stack direction="row" spacing={1}>
            <IconButton
              size="small"
              color="inherit"
              onClick={handleAudioToggle}
            >
              {audioEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              <Typography variant="caption" color="white" sx={{ mr: 1 }}>
                Quality:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={currentLevel === -1 ? 'auto' : currentLevel.toString()}
                  onChange={handleQualityChange}
                  variant="standard"
                  sx={{ color: 'white', fontSize: '0.75rem' }}
                >
                  <MenuItem value="auto">Auto</MenuItem>
                  {levels.map((level) => (
                    <MenuItem key={level.level} value={level.level.toString()}>
                      {level.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Stack>
          
          {/* Right Controls */}
          <Stack direction="row" spacing={1}>
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setStatsVisible(!statsVisible)}
            >
              <SpeedIcon />
            </IconButton>
            
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <SettingsIcon />
            </IconButton>
            
            <IconButton
              size="small"
              color="inherit"
              onClick={handleFullscreen}
            >
              <FullscreenIcon />
            </IconButton>
          </Stack>
        </Box>
      )}
      
      {/* Settings Panel */}
      {settingsOpen && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 50,
            right: 10,
            width: 300,
            p: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            zIndex: 1000
          }}
        >
          <Typography variant="subtitle1" gutterBottom>
            HLS Stream Settings
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            Latency Mode
          </Typography>
          
          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Button
                variant={latencyMode === 'low' ? 'contained' : 'outlined'}
                color="primary"
                size="small"
                fullWidth
                onClick={() => handleLatencyModeChange('low')}
                startIcon={<LowQualityIcon />}
              >
                Low
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                variant={latencyMode === 'normal' ? 'contained' : 'outlined'}
                color="primary"
                size="small"
                fullWidth
                onClick={() => handleLatencyModeChange('normal')}
                startIcon={<HighQualityIcon />}
              >
                Normal
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                variant={latencyMode === 'auto' ? 'contained' : 'outlined'}
                color="primary"
                size="small"
                fullWidth
                onClick={() => handleLatencyModeChange('auto')}
                startIcon={<AutoAwesomeIcon />}
              >
                Auto
              </Button>
            </Grid>
          </Grid>
          
          <Typography variant="body2" gutterBottom>
            Quality Selection
          </Typography>
          
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={currentLevel === -1 ? 'auto' : currentLevel.toString()}
              onChange={handleQualityChange}
              variant="outlined"
              sx={{ color: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <MenuItem value="auto">Auto (Adaptive)</MenuItem>
              {levels.map((level) => (
                <MenuItem key={level.level} value={level.level.toString()}>
                  {level.name} ({Math.round(level.bitrate / 1000)} kbps)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Typography variant="body2" gutterBottom>
            Current Status
          </Typography>
          
          <Box sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', p: 1, borderRadius: 1 }}>
            <Typography variant="caption" component="div">
              Connection: {connectionStatus}
            </Typography>
            <Typography variant="caption" component="div">
              Buffer: {streamStats?.bufferLength.toFixed(1)}s
            </Typography>
            <Typography variant="caption" component="div">
              Bandwidth: {streamStats?.bandwidthEstimate} kbps
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default HLSPlayer;