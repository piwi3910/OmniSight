import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  IconButton,
  CircularProgress,
  Slider,
  Tooltip,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Fullscreen as FullscreenIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  ArrowBack as ArrowBackIcon,
  Screenshot as ScreenshotIcon,
  Videocam as VideocamIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const LiveView: React.FC = () => {
  const { cameraId } = useParams<{ cameraId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  
  // Fetch camera details
  useEffect(() => {
    const fetchCamera = async () => {
      if (!token || !cameraId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`${API_URL}/cameras/${cameraId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setCamera(response.data);
        
        // Get stream URL
        const streamResponse = await axios.get(`${API_URL}/streams/${cameraId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setStreamUrl(streamResponse.data.url);
      } catch (error) {
        console.error('Error fetching camera details:', error);
        setError('Failed to load camera. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCamera();
  }, [cameraId, token, API_URL]);
  
  // Handle video playback
  useEffect(() => {
    if (videoRef.current && streamUrl) {
      if (isPlaying) {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Failed to play video stream. Please try again.');
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, streamUrl]);
  
  // Handle volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);
  
  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Take screenshot
  const takeScreenshot = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Create download link
    const link = document.createElement('a');
    link.download = `screenshot-${camera?.name || 'camera'}-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  // Start recording
  const startRecording = async () => {
    if (!token || !cameraId) return;
    
    setLoading(true);
    
    try {
      await axios.post(`${API_URL}/recordings`, { cameraId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Show success message
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to start recording. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && !camera) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ flexGrow: 1, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/cameras')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">
          {camera?.name || 'Live View'}
        </Typography>
      </Box>
      
      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
          <Typography color="error.dark">{error}</Typography>
        </Box>
      )}
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={9}>
          <Paper 
            ref={containerRef} 
            sx={{ 
              position: 'relative', 
              width: '100%', 
              bgcolor: 'black',
              borderRadius: 1,
              overflow: 'hidden'
            }}
          >
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
                  zIndex: 1
                }}
              >
                <CircularProgress />
              </Box>
            )}
            
            {streamUrl ? (
              <video 
                ref={videoRef}
                style={{ width: '100%', display: 'block' }}
                autoPlay
                playsInline
                muted={isMuted}
                src={streamUrl}
                onError={() => setError('Error loading video stream')}
              />
            ) : (
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: '400px',
                  color: 'white'
                }}
              >
                <VideocamIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" sx={{ opacity: 0.7 }}>
                  {error || 'Stream not available'}
                </Typography>
              </Box>
            )}
            
            {/* Video controls */}
            <Box 
              sx={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                p: 1,
                bgcolor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <IconButton 
                color="inherit" 
                onClick={() => setIsPlaying(!isPlaying)}
                sx={{ color: 'white' }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mx: 1, flex: 1 }}>
                <IconButton 
                  color="inherit" 
                  onClick={() => setIsMuted(!isMuted)}
                  sx={{ color: 'white' }}
                >
                  {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                </IconButton>
                <Slider
                  size="small"
                  value={volume}
                  onChange={(_, newValue) => setVolume(newValue as number)}
                  disabled={isMuted}
                  sx={{ 
                    mx: 1, 
                    width: 100,
                    color: 'white',
                    '& .MuiSlider-thumb': {
                      width: 12,
                      height: 12
                    }
                  }}
                />
              </Box>
              
              <Tooltip title="Take Screenshot">
                <IconButton 
                  color="inherit" 
                  onClick={takeScreenshot}
                  sx={{ color: 'white' }}
                >
                  <ScreenshotIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Toggle Fullscreen">
                <IconButton 
                  color="inherit" 
                  onClick={toggleFullscreen}
                  sx={{ color: 'white' }}
                >
                  <FullscreenIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Camera Details
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Status:</strong> {camera?.status || 'Unknown'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Location:</strong> {camera?.location || 'Not specified'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Model:</strong> {camera?.model || 'Not specified'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>IP Address:</strong> {camera?.ipAddress || 'Not available'}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                Actions
              </Typography>
              
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={<VideocamIcon />}
                onClick={startRecording}
                disabled={loading}
                sx={{ mb: 1 }}
              >
                Start Recording
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                startIcon={<SettingsIcon />}
                onClick={() => navigate(`/cameras/edit/${cameraId}`)}
              >
                Camera Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LiveView;