import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Slider,
  Typography,
  Grid,
  Stack,
  Paper
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_STREAM_SETTINGS } from '../config';

interface MJPEGPlayerProps {
  cameraId: string;
  streamId?: string;
  autoPlay?: boolean;
  width?: string | number;
  height?: string | number;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  className?: string;
  style?: React.CSSProperties;
  refreshRate?: number; // Refresh rate in milliseconds
  showControls?: boolean;
  quality?: 'high' | 'medium' | 'low';
}

interface StreamStats {
  fps: number;
  latency: number;
  resolution: string;
  quality: string;
  bufferSize: number;
}

const MJPEGPlayer: React.FC<MJPEGPlayerProps> = ({
  cameraId,
  streamId = 'primary',
  autoPlay = true,
  width = '100%',
  height = 'auto',
  onError,
  onStatusChange,
  className,
  style,
  refreshRate = 100, // Default 100ms refresh rate
  showControls = true,
  quality = 'medium'
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [loading, setLoading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<'high' | 'medium' | 'low'>(quality);
  const [bufferSize, setBufferSize] = useState<number>(5); // Number of frames to buffer
  const [statsVisible, setStatsVisible] = useState(false);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsInterval, setStatsIntervalRef] = useState<NodeJS.Timeout | null>(null);

  // Frame rate measurement
  const frameCounter = useRef<number>(0);
  const lastFrameTime = useRef<number>(Date.now());
  const currentFps = useRef<number>(0);

  // Connect to stream on component mount or when parameters change
  useEffect(() => {
    if (cameraId && autoPlay) {
      connectToStream();
    } else {
      disconnectFromStream();
    }

    return () => {
      disconnectFromStream();
      
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, [cameraId, streamId, selectedQuality, bufferSize]);

  // Handle status changes
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(connectionStatus);
    }
  }, [connectionStatus, onStatusChange]);

  // Connect to MJPEG stream
  const connectToStream = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');

      // Generate stream URL with parameters
      const streamUrl = generateStreamUrl();
      setCurrentSrc(streamUrl);

      // Start stats monitoring
      startStatsPolling();

      // Update connection status
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error connecting to MJPEG stream:', error);
      setConnectionStatus('error');
      if (onError) onError('Failed to connect to stream');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect from MJPEG stream
  const disconnectFromStream = () => {
    // Stop stats polling
    if (statsInterval) {
      clearInterval(statsInterval);
      setStatsIntervalRef(null);
    }

    // Clear image source
    setCurrentSrc('');
    setConnectionStatus('disconnected');
    setStreamStats(null);
  };

  // Generate stream URL based on parameters
  const generateStreamUrl = () => {
    const params = new URLSearchParams();
    params.append('streamId', streamId);
    params.append('quality', selectedQuality);
    params.append('bufferSize', bufferSize.toString());
    params.append('timestamp', Date.now().toString()); // Prevent caching

    return `${API_BASE_URL}/cameras/${cameraId}/stream/mjpeg?${params.toString()}`;
  };

  // Handle quality change
  const handleQualityChange = (event: SelectChangeEvent<string>) => {
    setSelectedQuality(event.target.value as 'high' | 'medium' | 'low');
  };

  // Handle buffer size change
  const handleBufferSizeChange = (event: Event, newValue: number | number[]) => {
    setBufferSize(newValue as number);
  };

  // Handle image load to measure frame rate
  const handleImageLoad = () => {
    const now = Date.now();
    frameCounter.current += 1;
    
    // Calculate FPS every second
    if (now - lastFrameTime.current >= 1000) {
      currentFps.current = Math.round((frameCounter.current * 1000) / (now - lastFrameTime.current));
      frameCounter.current = 0;
      lastFrameTime.current = now;
      
      // Update stats
      if (streamStats) {
        setStreamStats({
          ...streamStats,
          fps: currentFps.current
        });
      }
    }
  };

  // Handle image error
  const handleImageError = () => {
    if (connectionStatus === 'connected') {
      setConnectionStatus('error');
      if (onError) onError('Stream connection lost');
    }
  };

  // Force refresh the stream
  const refreshStream = () => {
    if (connectionStatus === 'connected') {
      const newSrc = generateStreamUrl();
      setCurrentSrc(newSrc);
    }
  };

  // Poll for stream statistics
  const startStatsPolling = () => {
    // Clear existing interval if any
    if (statsInterval) {
      clearInterval(statsInterval);
    }

    // Initialize stats
    setStreamStats({
      fps: 0,
      latency: 0,
      resolution: getResolutionForQuality(selectedQuality),
      quality: selectedQuality,
      bufferSize: bufferSize
    });

    // Start new polling interval
    const interval = setInterval(() => {
      // In a real implementation, we might fetch these stats from the server
      // For now, we're updating with local measurements
      if (streamStats) {
        const latency = Math.floor(Math.random() * 200) + 50; // Simulate latency between 50-250ms
        
        setStreamStats({
          fps: currentFps.current,
          latency: latency,
          resolution: getResolutionForQuality(selectedQuality),
          quality: selectedQuality,
          bufferSize: bufferSize
        });
      }
    }, 1000);

    setStatsIntervalRef(interval);
  };

  // Get resolution string based on quality
  const getResolutionForQuality = (quality: string) => {
    switch (quality) {
      case 'high':
        return '1280x720';
      case 'medium':
        return '854x480';
      case 'low':
        return '640x360';
      default:
        return '854x480';
    }
  };

  return (
    <Box 
      className={className}
      style={style}
      sx={{ position: 'relative', width, height }}
    >
      {currentSrc ? (
        <img
          ref={imgRef}
          src={currentSrc}
          alt="MJPEG Stream"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            color: '#fff'
          }}
        >
          <Typography variant="body1">Stream disconnected</Typography>
        </Box>
      )}

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

      {showControls && (
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
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={connectionStatus === 'connected' ? disconnectFromStream : connectToStream}
              startIcon={connectionStatus === 'connected' ? <VideocamIcon /> : <VideocamOffIcon />}
            >
              {connectionStatus === 'connected' ? 'Disconnect' : 'Connect'}
            </Button>

            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={refreshStream}
              startIcon={<RefreshIcon />}
              disabled={connectionStatus !== 'connected'}
            >
              Refresh
            </Button>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={() => setStatsVisible(!statsVisible)}
              startIcon={<SpeedIcon />}
            >
              Stats
            </Button>

            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={() => setSettingsOpen(!settingsOpen)}
              startIcon={<SettingsIcon />}
            >
              Settings
            </Button>

            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={selectedQuality}
                onChange={handleQualityChange}
                displayEmpty
                variant="standard"
                sx={{ color: 'white' }}
              >
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
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
            MJPEG Stream Settings
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            Buffer Size: {bufferSize} frames
          </Typography>
          <Slider
            value={bufferSize}
            onChange={handleBufferSizeChange}
            min={1}
            max={20}
            step={1}
            marks={[
              { value: 1, label: '1' },
              { value: 10, label: '10' },
              { value: 20, label: '20' }
            ]}
            sx={{ mb: 2 }}
          />

          <Typography variant="body2" gutterBottom>
            Quality: {selectedQuality}
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={selectedQuality}
              onChange={handleQualityChange}
              variant="outlined"
              sx={{ color: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <MenuItem value="high">High (1280x720)</MenuItem>
              <MenuItem value="medium">Medium (854x480)</MenuItem>
              <MenuItem value="low">Low (640x360)</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={refreshStream}
            startIcon={<RefreshIcon />}
          >
            Apply Settings
          </Button>
        </Paper>
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
            FPS: {streamStats.fps}
          </Typography>
          <Typography variant="caption" component="div">
            Resolution: {streamStats.resolution}
          </Typography>
          <Typography variant="caption" component="div">
            Quality: {streamStats.quality}
          </Typography>
          <Typography variant="caption" component="div">
            Buffer: {streamStats.bufferSize} frames
          </Typography>
          <Typography variant="caption" component="div">
            Latency: {streamStats.latency}ms
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MJPEGPlayer;