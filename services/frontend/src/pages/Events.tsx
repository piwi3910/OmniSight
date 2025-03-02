import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
  Grid
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  Person as PersonIcon,
  DirectionsCar as DirectionsCarIcon,
  Pets as PetsIcon,
  NotificationsActive as NotificationsActiveIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

// Mock data for initial development
const mockEvents = [
  { id: '1', type: 'motion', cameraName: 'Front Door', timestamp: '2023-01-01T12:00:00Z', confidence: 0.85, thumbnail: 'https://via.placeholder.com/300x200?text=Motion+Event' },
  { id: '2', type: 'person', cameraName: 'Backyard', timestamp: '2023-01-01T12:05:00Z', confidence: 0.92, thumbnail: 'https://via.placeholder.com/300x200?text=Person+Event' },
  { id: '3', type: 'vehicle', cameraName: 'Driveway', timestamp: '2023-01-01T12:10:00Z', confidence: 0.88, thumbnail: 'https://via.placeholder.com/300x200?text=Vehicle+Event' },
  { id: '4', type: 'motion', cameraName: 'Living Room', timestamp: '2023-01-01T12:15:00Z', confidence: 0.75, thumbnail: 'https://via.placeholder.com/300x200?text=Motion+Event' },
  { id: '5', type: 'person', cameraName: 'Front Door', timestamp: '2023-01-01T12:20:00Z', confidence: 0.95, thumbnail: 'https://via.placeholder.com/300x200?text=Person+Event' },
  { id: '6', type: 'animal', cameraName: 'Backyard', timestamp: '2023-01-01T12:25:00Z', confidence: 0.82, thumbnail: 'https://via.placeholder.com/300x200?text=Animal+Event' },
  { id: '7', type: 'vehicle', cameraName: 'Driveway', timestamp: '2023-01-01T12:30:00Z', confidence: 0.91, thumbnail: 'https://via.placeholder.com/300x200?text=Vehicle+Event' },
  { id: '8', type: 'motion', cameraName: 'Garage', timestamp: '2023-01-01T12:35:00Z', confidence: 0.78, thumbnail: 'https://via.placeholder.com/300x200?text=Motion+Event' }
];

const Events: React.FC = () => {
  const [events, setEvents] = useState(mockEvents);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [openFilterDialog, setOpenFilterDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // In a real implementation, we would fetch data from the API
  useEffect(() => {
    const fetchEvents = async () => {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // This would be a real API call in production
        /*
        const response = await axios.get(`${API_URL}/events`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setEvents(response.data.events);
        */
        
        // Simulate API delay
        setTimeout(() => {
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [token, API_URL]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenFilterDialog = () => {
    setOpenFilterDialog(true);
  };

  const handleCloseFilterDialog = () => {
    setOpenFilterDialog(false);
  };

  const handleViewEvent = (event: any) => {
    setSelectedEvent(event);
    setOpenEventDialog(true);
  };

  const handleCloseEventDialog = () => {
    setOpenEventDialog(false);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'table' ? 'grid' : 'table');
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get icon for event type
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <PersonIcon />;
      case 'vehicle':
        return <DirectionsCarIcon />;
      case 'animal':
        return <PetsIcon />;
      case 'motion':
      default:
        return <NotificationsActiveIcon />;
    }
  };

  // Get color for event type
  const getEventColor = (type: string) => {
    switch (type) {
      case 'person':
        return 'primary';
      case 'vehicle':
        return 'secondary';
      case 'animal':
        return 'success';
      case 'motion':
      default:
        return 'warning';
    }
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
          Events
        </Typography>
        <Box>
          <Button
            variant="outlined"
            color="primary"
            sx={{ mr: 2 }}
            onClick={toggleViewMode}
          >
            {viewMode === 'table' ? 'Grid View' : 'Table View'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<FilterListIcon />}
            onClick={handleOpenFilterDialog}
          >
            Filter
          </Button>
        </Box>
      </Box>
      
      {viewMode === 'table' ? (
        <>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="events table">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Camera</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ mr: 1 }}>
                            {getEventIcon(event.type)}
                          </Box>
                          <Chip
                            label={event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                            color={getEventColor(event.type) as any}
                            size="small"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>{event.cameraName}</TableCell>
                      <TableCell>{formatDate(event.timestamp)}</TableCell>
                      <TableCell>{`${Math.round(event.confidence * 100)}%`}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="primary"
                          aria-label="view event"
                          onClick={() => handleViewEvent(event)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={events.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      ) : (
        <>
          <Grid container spacing={3}>
            {events
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((event) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={event.id}>
                  <Card>
                    <CardMedia
                      component="img"
                      height="140"
                      image={event.thumbnail}
                      alt={`${event.type} event`}
                    />
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ mr: 1 }}>
                          {getEventIcon(event.type)}
                        </Box>
                        <Chip
                          label={event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                          color={getEventColor(event.type) as any}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Camera: {event.cameraName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Time: {formatDate(event.timestamp)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Confidence: {`${Math.round(event.confidence * 100)}%`}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleViewEvent(event)}
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <TablePagination
              rowsPerPageOptions={[4, 8, 12, 16]}
              component="div"
              count={events.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Box>
        </>
      )}
      
      {/* Filter Dialog */}
      <Dialog open={openFilterDialog} onClose={handleCloseFilterDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Events</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel id="event-type-select-label">Event Type</InputLabel>
            <Select
              labelId="event-type-select-label"
              id="event-type-select"
              label="Event Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="motion">Motion</MenuItem>
              <MenuItem value="person">Person</MenuItem>
              <MenuItem value="vehicle">Vehicle</MenuItem>
              <MenuItem value="animal">Animal</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="camera-select-label">Camera</InputLabel>
            <Select
              labelId="camera-select-label"
              id="camera-select"
              label="Camera"
            >
              <MenuItem value="all">All Cameras</MenuItem>
              <MenuItem value="1">Front Door</MenuItem>
              <MenuItem value="2">Backyard</MenuItem>
              <MenuItem value="3">Garage</MenuItem>
              <MenuItem value="4">Living Room</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            margin="normal"
            label="Start Date"
            type="datetime-local"
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />
          
          <TextField
            margin="normal"
            label="End Date"
            type="datetime-local"
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="confidence-select-label">Minimum Confidence</InputLabel>
            <Select
              labelId="confidence-select-label"
              id="confidence-select"
              label="Minimum Confidence"
            >
              <MenuItem value="0">Any</MenuItem>
              <MenuItem value="0.5">50%</MenuItem>
              <MenuItem value="0.7">70%</MenuItem>
              <MenuItem value="0.9">90%</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFilterDialog}>Cancel</Button>
          <Button variant="contained" color="primary">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Event Detail Dialog */}
      {selectedEvent && (
        <Dialog open={openEventDialog} onClose={handleCloseEventDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {`${selectedEvent.type.charAt(0).toUpperCase() + selectedEvent.type.slice(1)} Event - ${selectedEvent.cameraName}`}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <img
                  src={selectedEvent.thumbnail}
                  alt={`${selectedEvent.type} event`}
                  style={{ width: '100%', borderRadius: '4px' }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Event Details
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Type:</strong> {selectedEvent.type.charAt(0).toUpperCase() + selectedEvent.type.slice(1)}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Camera:</strong> {selectedEvent.cameraName}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Time:</strong> {formatDate(selectedEvent.timestamp)}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Confidence:</strong> {`${Math.round(selectedEvent.confidence * 100)}%`}
                </Typography>
                <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                  Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="outlined" size="small">
                    View Recording
                  </Button>
                  <Button variant="outlined" size="small">
                    Download Image
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEventDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default Events;