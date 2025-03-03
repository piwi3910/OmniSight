import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  MoreVert as MoreVertIcon,
  Videocam as VideocamIcon,
  Screenshot as ScreenshotIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface CameraStreamProps {
  camera: any;
  streamUrl: string;
  onError: (cameraId: string, error: string) => void;
  onFullscreen: (videoRef: React.RefObject<HTMLVideoElement>) => void;
  onScreenshot: (videoRef: React.RefObject<HTMLVideoElement>, cameraName: string) => void;
}

// Individual camera stream component
const CameraStream: React.FC<CameraStreamProps> = ({ camera, streamUrl, onError, onFullscreen, onScreenshot }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  
  // Handle video load
  const handleVideoLoad = () => {
    setLoading(false);
  };
  
  // Handle video error
  const handleVideoError = () => {
    setLoading(false);
    const errorMsg = 'Failed to load video stream';
    setError(errorMsg);
    onError(camera.id, errorMsg);
  };
  
  // Handle menu open/close
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  // Navigate to single camera view
  const goToLiveView = () => {
    navigate(`/live/${camera.id}`);
    handleMenuClose();
  };
  
  // Take screenshot
  const takeScreenshot = () => {
    onScreenshot(videoRef, camera.name);
    handleMenuClose();
  };
  
  // Go to camera settings
  const goToSettings = () => {
    navigate(`/cameras/edit/${camera.id}`);
    handleMenuClose();
  };
  
  // Start recording
  const startRecording = async () => {
    handleMenuClose();
    try {
      // Implementation to start recording
      // This would call the API to start recording
    } catch (err) {
      console.error(`Error starting recording for camera ${camera.id}:`, err);
    }
  };
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'relative', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'black',
        border: error ? '1px solid red' : 'none'
      }}
    >
      {/* Camera name header */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 1,
          bgcolor: 'rgba(0,0,0,0.7)',
          color: 'white',
          zIndex: 1
        }}
      >
        <Typography variant="subtitle2" noWrap>{camera.name}</Typography>
        <IconButton 
          size="small" 
          sx={{ color: 'white' }} 
          onClick={handleMenuOpen}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={goToLiveView}>Open in Full View</MenuItem>
          <MenuItem onClick={takeScreenshot}>Take Screenshot</MenuItem>
          <MenuItem onClick={startRecording}>Start Recording</MenuItem>
          <MenuItem onClick={goToSettings}>Camera Settings</MenuItem>
        </Menu>
      </Box>
      
      {/* Video stream */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loading && (
          <CircularProgress 
            sx={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              zIndex: 1
            }} 
          />
        )}
        
        {streamUrl ? (
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
          />
        ) : (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              p: 2,
              color: 'gray.500'
            }}
          >
            <VideocamIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
            <Typography variant="caption" align="center">
              {error || 'Stream not available'}
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Controls */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          p: 0.5,
          bgcolor: 'rgba(0,0,0,0.7)',
          color: 'white'
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            color: camera.status === 'online' ? 'success.main' : 'error.main'
          }}
        >
          • {camera.status === 'online' ? 'Live' : 'Offline'}
        </Typography>
        
        <Box>
          <IconButton 
            size="small" 
            sx={{ color: 'white' }} 
            onClick={() => onScreenshot(videoRef, camera.name)}
          >
            <ScreenshotIcon fontSize="small" />
          </IconButton>
          
          <IconButton 
            size="small" 
            sx={{ color: 'white' }} 
            onClick={() => onFullscreen(videoRef)}
          >
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

interface MultiCameraGridProps {
  initialCameras?: any[];
  layout?: 'grid' | 'list';
  defaultGridSize?: number;
}

const MultiCameraGrid: React.FC<MultiCameraGridProps> = ({ 
  initialCameras = [],
  layout = 'grid',
  defaultGridSize = 2
}) => {
  const [cameras, setCameras] = useState<any[]>(initialCameras);
  const [streamUrls, setStreamUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraErrors, setCameraErrors] = useState<Record<string, string>>({});
  const [gridSize, setGridSize] = useState(defaultGridSize);
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  
  // Fetch cameras on mount
  useEffect(() => {
    const fetchCameras = async () => {
      if (!token) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // If no initial cameras provided, fetch them
        if (initialCameras.length === 0) {
          const response = await axios.get(`${API_URL}/cameras`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setCameras(response.data.cameras || []);
        }
        
        // Fetch stream URLs for each camera
        const urls: Record<string, string> = {};
        
        const cameraList = initialCameras.length > 0 ? initialCameras : cameras;
        await Promise.all(
          cameraList.map(async (camera) => {
            try {
              const streamResponse = await axios.get(`${API_URL}/streams/${camera.id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              urls[camera.id] = streamResponse.data.url;
            } catch (err) {
              console.error(`Error fetching stream URL for camera ${camera.id}:`, err);
              setCameraErrors(prev => ({
                ...prev,
                [camera.id]: 'Failed to load stream'
              }));
            }
          })
        );
        
        setStreamUrls(urls);
      } catch (err) {
        console.error('Error fetching cameras:', err);
        setError('Failed to load cameras. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCameras();
  }, [token, API_URL, initialCameras.length]);
  
  // Handle camera stream error
  const handleCameraError = (cameraId: string, errorMsg: string) => {
    setCameraErrors(prev => ({
      ...prev,
      [cameraId]: errorMsg
    }));
  };
  
  // Handle fullscreen for a camera
  const handleFullscreen = (videoRef: React.RefObject<HTMLVideoElement>) => {
    if (!videoRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };
  
  // Handle taking a screenshot
  const handleScreenshot = (videoRef: React.RefObject<HTMLVideoElement>, cameraName: string) => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Create download link
    const link = document.createElement('a');
    link.download = `screenshot-${cameraName || 'camera'}-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  // Handle grid size change
  const handleGridSizeChange = (event: SelectChangeEvent<number>) => {
    setGridSize(event.target.value as number);
  };
  
  if (loading && cameras.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1, m: 2 }}>
        <Typography color="error.dark">{error}</Typography>
      </Box>
    );
  }
  
  if (cameras.length === 0) {
    return (
      <Card sx={{ m: 2 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <VideocamIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" gutterBottom>No Cameras Available</Typography>
            <Typography variant="body2" color="text.secondary">
              Add cameras to your system to view live streams
            </Typography>
          </Box>
        </CardContent>
        <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
          <IconButton 
            color="primary" 
            onClick={() => window.location.href = '/cameras/add'}
          >
            <SettingsIcon />
          </IconButton>
        </CardActions>
      </Card>
    );
  }
  
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Live Camera Feeds</Typography>
        
        <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="grid-size-label">Grid Size</InputLabel>
          <Select
            labelId="grid-size-label"
            id="grid-size-select"
            value={gridSize}
            onChange={handleGridSizeChange}
            label="Grid Size"
          >
            <MenuItem value={1}>1×1</MenuItem>
            <MenuItem value={2}>2×2</MenuItem>
            <MenuItem value={3}>3×3</MenuItem>
            <MenuItem value={4}>4×4</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      <Grid container spacing={2}>
        {cameras.map((camera) => (
          <Grid 
            item 
            key={camera.id} 
            xs={12} 
            sm={gridSize <= 1 ? 12 : 6} 
            md={12 / Math.min(gridSize, 4)} 
            lg={12 / Math.min(gridSize, 4)}
            sx={{ height: layout === 'grid' ? { xs: 220, sm: 280, md: 320 } : 'auto' }}
          >
            <CameraStream
              camera={camera}
              streamUrl={streamUrls[camera.id] || ''}
              onError={handleCameraError}
              onFullscreen={handleFullscreen}
              onScreenshot={handleScreenshot}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default MultiCameraGrid;