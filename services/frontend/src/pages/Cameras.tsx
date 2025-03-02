import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Videocam as VideocamIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

// Mock data for initial development
const mockCameras = [
  { id: '1', name: 'Front Door', rtspUrl: 'rtsp://example.com/stream1', status: 'online', location: 'Front Door', model: 'Generic RTSP Camera', thumbnail: 'https://via.placeholder.com/300x200?text=Front+Door' },
  { id: '2', name: 'Backyard', rtspUrl: 'rtsp://example.com/stream2', status: 'online', location: 'Backyard', model: 'Generic RTSP Camera', thumbnail: 'https://via.placeholder.com/300x200?text=Backyard' },
  { id: '3', name: 'Garage', rtspUrl: 'rtsp://example.com/stream3', status: 'offline', location: 'Garage', model: 'Generic RTSP Camera', thumbnail: 'https://via.placeholder.com/300x200?text=Garage' },
  { id: '4', name: 'Living Room', rtspUrl: 'rtsp://example.com/stream4', status: 'online', location: 'Living Room', model: 'Generic RTSP Camera', thumbnail: 'https://via.placeholder.com/300x200?text=Living+Room' }
];

const Cameras: React.FC = () => {
  const [cameras, setCameras] = useState(mockCameras);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // In a real implementation, we would fetch data from the API
  useEffect(() => {
    const fetchCameras = async () => {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // This would be a real API call in production
        /*
        const response = await axios.get(`${API_URL}/cameras`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setCameras(response.data.cameras);
        */
        
        // Simulate API delay
        setTimeout(() => {
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching cameras:', error);
        setLoading(false);
      }
    };
    
    fetchCameras();
  }, [token, API_URL]);

  const handleAddCamera = () => {
    setSelectedCamera(null);
    setOpenDialog(true);
  };

  const handleEditCamera = (camera: any) => {
    setSelectedCamera(camera);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSaveCamera = () => {
    // In a real implementation, we would save to the API
    setOpenDialog(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Cameras
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddCamera}
        >
          Add Camera
        </Button>
      </Box>
      
      <Grid container spacing={3}>
        {cameras.map((camera) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={camera.id}>
            <Card>
              <CardMedia
                component="img"
                height="140"
                image={camera.thumbnail}
                alt={camera.name}
              />
              <CardContent>
                <Typography gutterBottom variant="h6" component="div">
                  {camera.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {camera.status === 'online' ? (
                    <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                  ) : (
                    <WarningIcon color="error" sx={{ mr: 1 }} />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {camera.status === 'online' ? 'Online' : 'Offline'}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Location: {camera.location}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Model: {camera.model}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button size="small" color="primary" startIcon={<VideocamIcon />}>
                    View
                  </Button>
                  <Box>
                    <IconButton size="small" onClick={() => handleEditCamera(camera)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Add/Edit Camera Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedCamera ? 'Edit Camera' : 'Add Camera'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Camera Name"
            fullWidth
            variant="outlined"
            defaultValue={selectedCamera?.name || ''}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="RTSP URL"
            fullWidth
            variant="outlined"
            defaultValue={selectedCamera?.rtspUrl || ''}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Username (optional)"
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Password (optional)"
            type="password"
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Location"
            fullWidth
            variant="outlined"
            defaultValue={selectedCamera?.location || ''}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Model"
            fullWidth
            variant="outlined"
            defaultValue={selectedCamera?.model || ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveCamera} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Cameras;