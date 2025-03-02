import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
  // State for cameras and UI
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    rtspUrl: '',
    username: '',
    password: '',
    location: '',
    model: ''
  });
  
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // Fetch cameras from API
  const fetchCameras = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/cameras`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCameras(response.data.cameras || []);
    } catch (error) {
      console.error('Error fetching cameras:', error);
      setError('Failed to load cameras. Please try again.');
      // Fallback to mock data in development
      if (process.env.NODE_ENV === 'development') {
        setCameras(mockCameras);
      }
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);
  
  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  // Form handling
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleAddCamera = () => {
    setSelectedCamera(null);
    setFormData({
      name: '',
      rtspUrl: '',
      username: '',
      password: '',
      location: '',
      model: ''
    });
    setOpenDialog(true);
  };

  const handleEditCamera = (camera: any) => {
    setSelectedCamera(camera);
    setFormData({
      name: camera.name || '',
      rtspUrl: camera.rtspUrl || '',
      username: camera.username || '',
      password: '', // Don't populate password for security
      location: camera.location || '',
      model: camera.model || ''
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setError(null);
  };

  const handleDeleteClick = (camera: any) => {
    setSelectedCamera(camera);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedCamera(null);
  };

  // API interactions
  const handleSaveCamera = async () => {
    try {
      setLoading(true);
      
      const cameraData = {
        ...formData,
        // Only include password if it was entered
        ...(formData.password ? { password: formData.password } : {})
      };
      
      if (selectedCamera) {
        // Update existing camera
        await axios.put(`${API_URL}/cameras/${selectedCamera.id}`, cameraData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create new camera
        await axios.post(`${API_URL}/cameras`, cameraData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      // Refresh camera list
      await fetchCameras();
      
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving camera:', error);
      setError('Failed to save camera. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCamera = async () => {
    if (!selectedCamera) return;
    
    try {
      setLoading(true);
      
      await axios.delete(`${API_URL}/cameras/${selectedCamera.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh camera list
      await fetchCameras();
      
      setDeleteDialogOpen(false);
      setSelectedCamera(null);
    } catch (error) {
      console.error('Error deleting camera:', error);
      setError('Failed to delete camera. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartStream = async (cameraId: string) => {
    try {
      setLoading(true);
      
      await axios.post(`${API_URL}/streams`, { cameraId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh camera list to update status
      await fetchCameras();
    } catch (error) {
      console.error('Error starting stream:', error);
      setError('Failed to start stream. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading and error states
  if (loading && cameras.length === 0) {
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
          disabled={loading}
        >
          Add Camera
        </Button>
      </Box>
      
      {/* Error message */}
      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
          <Typography color="error.dark">{error}</Typography>
        </Box>
      )}
      
      {/* Empty state */}
      {cameras.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No cameras found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Add your first camera to start monitoring
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
      )}
      
      {/* Camera grid */}
      <Grid container spacing={3}>
        {cameras.map((camera) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={camera.id}>
            <Card sx={{ position: 'relative' }}>
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
                    bgcolor: 'rgba(0,0,0,0.5)',
                    zIndex: 1
                  }}
                >
                  <CircularProgress />
                </Box>
              )}
              <CardMedia
                component="img"
                height="140"
                image={camera.thumbnail || `https://via.placeholder.com/300x200?text=${encodeURIComponent(camera.name)}`}
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
                  Location: {camera.location || 'Not specified'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Model: {camera.model || 'Not specified'}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  {camera.status === 'online' ? (
                    <Button
                      size="small"
                      color="primary"
                      startIcon={<VideocamIcon />}
                      component="a"
                      href={`/live/${camera.id}`}
                    >
                      View Live
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      color="primary"
                      startIcon={<VideocamIcon />}
                      onClick={() => handleStartStream(camera.id)}
                      disabled={loading}
                    >
                      Start Stream
                    </Button>
                  )}
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleEditCamera(camera)}
                      disabled={loading}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(camera)}
                      disabled={loading}
                    >
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
          {error && (
            <Box sx={{ mb: 2, p: 1, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error.dark">{error}</Typography>
            </Box>
          )}
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Camera Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={handleInputChange}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="rtspUrl"
            label="RTSP URL"
            fullWidth
            variant="outlined"
            value={formData.rtspUrl}
            onChange={handleInputChange}
            required
            sx={{ mb: 2 }}
            placeholder="rtsp://username:password@camera-ip:port/stream"
          />
          <TextField
            margin="dense"
            name="username"
            label="Username (optional)"
            fullWidth
            variant="outlined"
            value={formData.username}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="password"
            label="Password (optional)"
            type="password"
            fullWidth
            variant="outlined"
            value={formData.password}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="location"
            label="Location"
            fullWidth
            variant="outlined"
            value={formData.location}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="model"
            label="Model"
            fullWidth
            variant="outlined"
            value={formData.model}
            onChange={handleInputChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveCamera}
            variant="contained"
            color="primary"
            disabled={loading || !formData.name || !formData.rtspUrl}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Camera</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the camera "{selectedCamera?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button
            onClick={handleDeleteCamera}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Cameras;