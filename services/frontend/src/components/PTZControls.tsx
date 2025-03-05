import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Slider,
  Typography,
  Grid,
  CircularProgress
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HomeIcon from '@mui/icons-material/Home';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// PTZ Movement types
interface PtzMovement {
  pan?: number;
  tilt?: number;
  zoom?: number;
  speed?: number;
  absolute?: boolean;
  continuous?: boolean;
}

interface PTZControlsProps {
  cameraId: string;
  disabled?: boolean;
  onError?: (error: string) => void;
}

const PTZControls: React.FC<PTZControlsProps> = ({ cameraId, disabled = false, onError }) => {
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [capabilities, setCapabilities] = useState<{
    ptz: boolean;
    presets: boolean;
  }>({ ptz: false, presets: false });

  // Fetch camera capabilities on mount
  useEffect(() => {
    const fetchCapabilities = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/protocols/${cameraId}/capabilities`);
        setCapabilities({
          ptz: response.data.capabilities.ptz || false,
          presets: response.data.capabilities.presets || false
        });
      } catch (error) {
        console.error('Error fetching camera capabilities:', error);
        if (onError) onError('Failed to fetch camera capabilities');
      }
    };

    if (cameraId) {
      fetchCapabilities();
    }
  }, [cameraId, onError]);

  // Execute a PTZ movement
  const executeMove = async (movement: PtzMovement) => {
    if (!capabilities.ptz || disabled || loading) return;

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/protocols/${cameraId}/ptz`, {
        action: 'move',
        params: {
          ...movement,
          speed
        }
      });
    } catch (error) {
      console.error('Error executing PTZ command:', error);
      if (onError) onError('Failed to execute PTZ command');
    } finally {
      setLoading(false);
    }
  };

  // Move the camera in a specific direction
  const handleMove = (direction: 'up' | 'down' | 'left' | 'right') => {
    const movement: PtzMovement = { continuous: true };

    switch (direction) {
      case 'up':
        movement.tilt = 1;
        break;
      case 'down':
        movement.tilt = -1;
        break;
      case 'left':
        movement.pan = -1;
        break;
      case 'right':
        movement.pan = 1;
        break;
    }

    executeMove(movement);
  };

  // Stop all movement
  const handleStop = async () => {
    if (!capabilities.ptz || disabled || loading) return;

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/protocols/${cameraId}/ptz`, {
        action: 'stop'
      });
    } catch (error) {
      console.error('Error stopping PTZ:', error);
      if (onError) onError('Failed to stop camera movement');
    } finally {
      setLoading(false);
    }
  };

  // Zoom in or out
  const handleZoom = (direction: 'in' | 'out') => {
    const movement: PtzMovement = {
      zoom: direction === 'in' ? 1 : -1,
      continuous: true
    };
    executeMove(movement);
  };

  // Go to home position
  const handleHome = async () => {
    if (!capabilities.ptz || disabled || loading) return;

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/protocols/${cameraId}/ptz`, {
        action: 'home'
      });
    } catch (error) {
      console.error('Error going to home position:', error);
      if (onError) onError('Failed to go to home position');
    } finally {
      setLoading(false);
    }
  };

  // Handle speed change
  const handleSpeedChange = (event: Event, newValue: number | number[]) => {
    setSpeed(newValue as number);
  };

  if (!capabilities.ptz) {
    return (
      <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          PTZ control not available for this camera
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        PTZ Controls {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography id="speed-slider" gutterBottom>
          Speed: {Math.round(speed * 100)}%
        </Typography>
        <Slider
          aria-labelledby="speed-slider"
          value={speed}
          onChange={handleSpeedChange}
          min={0.1}
          max={1}
          step={0.1}
          marks
          disabled={disabled || loading}
        />
      </Box>

      <Grid container spacing={1} justifyContent="center" alignItems="center">
        {/* Empty space */}
        <Grid item xs={4} />
        
        {/* Up button */}
        <Grid item xs={4} sx={{ textAlign: 'center' }}>
          <IconButton
            color="primary"
            disabled={disabled || loading}
            onMouseDown={() => handleMove('up')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove('up')}
            onTouchEnd={handleStop}
            size="large"
          >
            <ArrowUpwardIcon />
          </IconButton>
        </Grid>
        
        {/* Empty space */}
        <Grid item xs={4} />

        {/* Left button */}
        <Grid item xs={4} sx={{ textAlign: 'right' }}>
          <IconButton
            color="primary"
            disabled={disabled || loading}
            onMouseDown={() => handleMove('left')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove('left')}
            onTouchEnd={handleStop}
            size="large"
          >
            <ArrowBackIcon />
          </IconButton>
        </Grid>

        {/* Home button */}
        <Grid item xs={4} sx={{ textAlign: 'center' }}>
          <IconButton
            color="secondary"
            disabled={disabled || loading}
            onClick={handleHome}
            size="large"
          >
            <HomeIcon />
          </IconButton>
        </Grid>

        {/* Right button */}
        <Grid item xs={4} sx={{ textAlign: 'left' }}>
          <IconButton
            color="primary"
            disabled={disabled || loading}
            onMouseDown={() => handleMove('right')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove('right')}
            onTouchEnd={handleStop}
            size="large"
          >
            <ArrowForwardIcon />
          </IconButton>
        </Grid>

        {/* Empty space */}
        <Grid item xs={4} />
        
        {/* Down button */}
        <Grid item xs={4} sx={{ textAlign: 'center' }}>
          <IconButton
            color="primary"
            disabled={disabled || loading}
            onMouseDown={() => handleMove('down')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove('down')}
            onTouchEnd={handleStop}
            size="large"
          >
            <ArrowDownwardIcon />
          </IconButton>
        </Grid>
        
        {/* Empty space */}
        <Grid item xs={4} />

        {/* Zoom controls */}
        <Grid item xs={6} sx={{ textAlign: 'right' }}>
          <IconButton
            color="primary"
            disabled={disabled || loading}
            onMouseDown={() => handleZoom('in')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleZoom('in')}
            onTouchEnd={handleStop}
            size="large"
          >
            <ZoomInIcon />
          </IconButton>
        </Grid>

        <Grid item xs={6} sx={{ textAlign: 'left' }}>
          <IconButton
            color="primary"
            disabled={disabled || loading}
            onMouseDown={() => handleZoom('out')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleZoom('out')}
            onTouchEnd={handleStop}
            size="large"
          >
            <ZoomOutIcon />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default PTZControls;