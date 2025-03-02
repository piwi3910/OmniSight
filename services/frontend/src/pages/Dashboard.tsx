import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  VideoLibrary as VideoLibraryIcon,
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// Mock data for initial development
const mockCameras = [
  { id: '1', name: 'Front Door', status: 'online', thumbnail: 'https://via.placeholder.com/300x200?text=Front+Door' },
  { id: '2', name: 'Backyard', status: 'online', thumbnail: 'https://via.placeholder.com/300x200?text=Backyard' },
  { id: '3', name: 'Garage', status: 'offline', thumbnail: 'https://via.placeholder.com/300x200?text=Garage' },
  { id: '4', name: 'Living Room', status: 'online', thumbnail: 'https://via.placeholder.com/300x200?text=Living+Room' }
];

const mockEvents = [
  { id: '1', type: 'motion', camera: 'Front Door', timestamp: '2023-01-01T12:00:00Z' },
  { id: '2', type: 'person', camera: 'Backyard', timestamp: '2023-01-01T12:05:00Z' },
  { id: '3', type: 'vehicle', camera: 'Driveway', timestamp: '2023-01-01T12:10:00Z' },
  { id: '4', type: 'motion', camera: 'Living Room', timestamp: '2023-01-01T12:15:00Z' },
  { id: '5', type: 'person', camera: 'Front Door', timestamp: '2023-01-01T12:20:00Z' }
];

const mockSystemStatus = {
  cameras: { total: 4, online: 3, offline: 1 },
  storage: { total: 1000, used: 400, free: 600 },
  recordings: { active: 3, total: 100 },
  events: { last24Hours: 25 }
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [cameras, setCameras] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(mockSystemStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch data in parallel
      const [camerasResponse, eventsResponse, systemResponse] = await Promise.all([
        axios.get(`${API_URL}/cameras`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/events?limit=5`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/system/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setCameras(camerasResponse.data.cameras || []);
      setEvents(eventsResponse.data.events || []);
      setSystemStatus(systemResponse.data || mockSystemStatus);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
      
      // Use mock data in development
      if (process.env.NODE_ENV === 'development') {
        setCameras(mockCameras);
        setEvents(mockEvents);
        setSystemStatus(mockSystemStatus);
      }
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);
  
  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Loading state
  if (loading && cameras.length === 0 && events.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {/* Error message */}
      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.light' }}>
          <Typography color="error.dark">{error}</Typography>
        </Paper>
      )}
      
      {/* Refresh button */}
      {(error || loading) && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Dashboard'}
          </Button>
        </Box>
      )}
      
      {/* System Status */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            onClick={() => navigate('/cameras')}
          >
            <Typography variant="h6" color="primary" gutterBottom>
              Cameras
            </Typography>
            <Typography variant="h3" component="div">
              {systemStatus.cameras.online}/{systemStatus.cameras.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Online Cameras
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            onClick={() => navigate('/settings')}
          >
            <Typography variant="h6" color="primary" gutterBottom>
              Storage
            </Typography>
            <Typography variant="h3" component="div">
              {Math.round((systemStatus.storage.used / systemStatus.storage.total) * 100)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {systemStatus.storage.free} GB Free
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            onClick={() => navigate('/recordings')}
          >
            <Typography variant="h6" color="primary" gutterBottom>
              Recordings
            </Typography>
            <Typography variant="h3" component="div">
              {systemStatus.recordings.active}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Recordings
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            onClick={() => navigate('/events')}
          >
            <Typography variant="h6" color="primary" gutterBottom>
              Events
            </Typography>
            <Typography variant="h3" component="div">
              {systemStatus.events.last24Hours}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last 24 Hours
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Camera Feeds */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Camera Feeds
        </Typography>
        
        {cameras.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No cameras found
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/cameras')}
              sx={{ mt: 1 }}
            >
              Add Camera
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {cameras.map((camera) => (
              <Grid item xs={12} sm={6} md={3} key={camera.id}>
                <Card>
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
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => navigate(`/live/${camera.id}`)}
                      disabled={camera.status !== 'online'}
                    >
                      {camera.status === 'online' ? 'View Live' : 'Offline'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      
      {/* Recent Events */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Recent Events
        </Typography>
        
        {events.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No recent events
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/events')}
              sx={{ mt: 1 }}
            >
              View All Events
            </Button>
          </Paper>
        ) : (
          <Paper sx={{ width: '100%' }}>
            <List>
              {events.map((event) => (
                <React.Fragment key={event.id}>
                  <ListItem>
                    <ListItemIcon>
                      {event.type === 'motion' && <NotificationsIcon />}
                      {event.type === 'person' && <VideocamIcon />}
                      {event.type === 'vehicle' && <VideoLibraryIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${event.type.charAt(0).toUpperCase() + event.type.slice(1)} detected`}
                      secondary={`${event.camera} - ${formatDate(event.timestamp)}`}
                    />
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => navigate(`/events?id=${event.id}`)}
                    >
                      View Details
                    </Button>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
              <ListItem>
                <Button
                  fullWidth
                  onClick={() => navigate('/events')}
                  sx={{ textAlign: 'center' }}
                >
                  View All Events
                </Button>
              </ListItem>
            </List>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;