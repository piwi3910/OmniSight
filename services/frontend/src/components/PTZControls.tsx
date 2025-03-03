import React, { useState, useEffect } from 'react';
import { Button, Card, IconButton, Box, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Grid, List, ListItem, ListItemText, ListItemSecondaryAction, Typography, Slider, Tooltip } from '@mui/material';
import { 
  ArrowUpward, 
  ArrowDownward, 
  ArrowBack, 
  ArrowForward,
  AddCircle,
  RemoveCircle,
  Speed,
  Home,
  Favorite,
  Add,
  Delete,
  PlayCircleFilled,
  Edit
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface PTZPreset {
  id: string;
  name: string;
  cameraId: string;
  position: {
    pan: number;
    tilt: number;
    zoom: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface PTZControlsProps {
  cameraId: string;
  cameraName: string;
  isPTZCapable: boolean;
}

const PTZControls: React.FC<PTZControlsProps> = ({ cameraId, cameraName, isPTZCapable }) => {
  const { token } = useAuth();
  const [presets, setPresets] = useState<PTZPreset[]>([]);
  const [speed, setSpeed] = useState<number>(5);
  const [continuousMove, setContinuousMove] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [presetDialogOpen, setPresetDialogOpen] = useState<boolean>(false);
  const [presetName, setPresetName] = useState<string>('');

  // Current position states (would be updated from camera status in real implementation)
  const [currentPan, setCurrentPan] = useState<number>(0);
  const [currentTilt, setCurrentTilt] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState<number>(1);

  // Load presets on component mount
  useEffect(() => {
    if (isPTZCapable) {
      fetchPresets();
    }
  }, [cameraId, isPTZCapable]);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/cameras/${cameraId}/ptz/presets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPresets(response.data);
    } catch (err) {
      console.error('Error fetching PTZ presets:', err);
      setError('Failed to load camera presets');
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!isPTZCapable) return;
    
    try {
      setLoading(true);
      
      // Set up movement parameters
      let pan = 0;
      let tilt = 0;
      
      switch (direction) {
        case 'up':
          tilt = speed;
          break;
        case 'down':
          tilt = -speed;
          break;
        case 'left':
          pan = -speed;
          break;
        case 'right':
          pan = speed;
          break;
      }
      
      await axios.post(`/api/cameras/${cameraId}/ptz/move`, {
        pan,
        tilt,
        zoom: 0, // No zoom change
        continuous: continuousMove
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update current position (in a real implementation, this would come from camera feedback)
      if (!continuousMove) {
        setCurrentPan(prev => Math.max(-100, Math.min(100, prev + pan)));
        setCurrentTilt(prev => Math.max(-100, Math.min(100, prev + tilt)));
      }
    } catch (err) {
      console.error('Error moving camera:', err);
      setError('Failed to move camera');
    } finally {
      setLoading(false);
    }
  };

  const handleZoom = async (zoomIn: boolean) => {
    if (!isPTZCapable) return;
    
    try {
      setLoading(true);
      
      const zoomValue = zoomIn ? speed : -speed;
      
      await axios.post(`/api/cameras/${cameraId}/ptz/move`, {
        pan: 0,
        tilt: 0,
        zoom: zoomValue,
        continuous: continuousMove
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update current zoom (in a real implementation, this would come from camera feedback)
      if (!continuousMove) {
        setCurrentZoom(prev => Math.max(1, Math.min(10, prev + (zoomIn ? 0.5 : -0.5))));
      }
    } catch (err) {
      console.error('Error zooming camera:', err);
      setError('Failed to zoom camera');
    } finally {
      setLoading(false);
    }
  };

  const goToPreset = async (presetId: string) => {
    if (!isPTZCapable) return;
    
    try {
      setLoading(true);
      
      await axios.post(`/api/cameras/${cameraId}/ptz/goto-preset`, {
        presetId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // In a real implementation, we would update the position from camera feedback
      const preset = presets.find(p => p.id === presetId);
      if (preset) {
        setCurrentPan(preset.position.pan);
        setCurrentTilt(preset.position.tilt);
        setCurrentZoom(preset.position.zoom);
      }
    } catch (err) {
      console.error('Error moving to preset:', err);
      setError('Failed to move to preset position');
    } finally {
      setLoading(false);
    }
  };

  const savePreset = async () => {
    if (!isPTZCapable || !presetName.trim()) return;
    
    try {
      setLoading(true);
      
      const response = await axios.post(`/api/cameras/${cameraId}/ptz/presets`, {
        name: presetName,
        position: {
          pan: currentPan,
          tilt: currentTilt,
          zoom: currentZoom
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPresets([...presets, response.data]);
      setPresetName('');
      setPresetDialogOpen(false);
    } catch (err) {
      console.error('Error saving preset:', err);
      setError('Failed to save preset');
    } finally {
      setLoading(false);
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!isPTZCapable) return;
    
    try {
      setLoading(true);
      
      await axios.delete(`/api/cameras/${cameraId}/ptz/presets/${presetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPresets(presets.filter(p => p.id !== presetId));
    } catch (err) {
      console.error('Error deleting preset:', err);
      setError('Failed to delete preset');
    } finally {
      setLoading(false);
    }
  };

  const goHome = async () => {
    if (!isPTZCapable) return;
    
    try {
      setLoading(true);
      
      await axios.post(`/api/cameras/${cameraId}/ptz/home`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset position to home
      setCurrentPan(0);
      setCurrentTilt(0);
      setCurrentZoom(1);
    } catch (err) {
      console.error('Error moving to home position:', err);
      setError('Failed to move to home position');
    } finally {
      setLoading(false);
    }
  };

  if (!isPTZCapable) {
    return (
      <Card sx={{ p: 2, mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          This camera does not support PTZ controls
        </Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        PTZ Controls: {cameraName}
      </Typography>
      
      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          {/* Movement controls */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
            <IconButton 
              color="primary" 
              disabled={loading} 
              onMouseDown={() => handleMove('up')}
              sx={{ mb: 1 }}
            >
              <ArrowUpward />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton 
                color="primary" 
                disabled={loading} 
                onMouseDown={() => handleMove('left')}
                sx={{ mr: 3 }}
              >
                <ArrowBack />
              </IconButton>
              
              <IconButton 
                color="primary" 
                disabled={loading} 
                onClick={goHome}
              >
                <Home />
              </IconButton>
              
              <IconButton 
                color="primary" 
                disabled={loading} 
                onMouseDown={() => handleMove('right')}
                sx={{ ml: 3 }}
              >
                <ArrowForward />
              </IconButton>
            </Box>
            
            <IconButton 
              color="primary" 
              disabled={loading} 
              onMouseDown={() => handleMove('down')}
              sx={{ mt: 1 }}
            >
              <ArrowDownward />
            </IconButton>
          </Box>
          
          {/* Zoom controls */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <IconButton 
              color="primary" 
              disabled={loading} 
              onMouseDown={() => handleZoom(false)}
            >
              <RemoveCircle />
            </IconButton>
            
            <Typography variant="body2" sx={{ mx: 2, alignSelf: 'center' }}>
              Zoom: {currentZoom.toFixed(1)}x
            </Typography>
            
            <IconButton 
              color="primary" 
              disabled={loading} 
              onMouseDown={() => handleZoom(true)}
            >
              <AddCircle />
            </IconButton>
          </Box>
          
          {/* Speed control */}
          <Box sx={{ px: 3, mb: 2 }}>
            <Typography id="speed-slider" gutterBottom>
              Speed: {speed}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Speed fontSize="small" />
              </Grid>
              <Grid item xs>
                <Slider
                  value={speed}
                  onChange={(_, newValue) => setSpeed(newValue as number)}
                  aria-labelledby="speed-slider"
                  min={1}
                  max={10}
                  marks
                />
              </Grid>
            </Grid>
          </Box>
        </Grid>
        
        <Grid item xs={12} md={6}>
          {/* Presets section */}
          <Typography variant="subtitle1" gutterBottom>
            Camera Presets
          </Typography>
          
          <List dense>
            {presets.map((preset) => (
              <ListItem key={preset.id}>
                <ListItemText
                  primary={preset.name}
                  secondary={`Pan: ${preset.position.pan}, Tilt: ${preset.position.tilt}, Zoom: ${preset.position.zoom}x`}
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    aria-label="go to preset" 
                    onClick={() => goToPreset(preset.id)}
                    disabled={loading}
                  >
                    <PlayCircleFilled color="primary" />
                  </IconButton>
                  <IconButton 
                    edge="end" 
                    aria-label="delete preset" 
                    onClick={() => deletePreset(preset.id)}
                    disabled={loading}
                  >
                    <Delete color="error" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setPresetDialogOpen(true)}
            disabled={loading}
            fullWidth
            sx={{ mt: 2 }}
          >
            Save Current Position as Preset
          </Button>
        </Grid>
      </Grid>
      
      {/* Dialog for saving presets */}
      <Dialog open={presetDialogOpen} onClose={() => setPresetDialogOpen(false)}>
        <DialogTitle>Save Current Position as Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Preset Name"
            type="text"
            fullWidth
            variant="outlined"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Current Position: Pan: {currentPan}, Tilt: {currentTilt}, Zoom: {currentZoom}x
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPresetDialogOpen(false)}>Cancel</Button>
          <Button onClick={savePreset} color="primary" disabled={!presetName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PTZControls;