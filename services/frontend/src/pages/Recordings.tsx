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
  CircularProgress
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

// Mock data for initial development
const mockRecordings = [
  { id: '1', cameraName: 'Front Door', startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T01:00:00.000Z', duration: 3600, status: 'completed', fileSize: 15000000 },
  { id: '2', cameraName: 'Backyard', startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T01:00:00.000Z', duration: 3600, status: 'completed', fileSize: 14500000 },
  { id: '3', cameraName: 'Garage', startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T01:00:00.000Z', duration: 3600, status: 'completed', fileSize: 13000000 },
  { id: '4', cameraName: 'Living Room', startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T01:00:00.000Z', duration: 3600, status: 'completed', fileSize: 12000000 },
  { id: '5', cameraName: 'Front Door', startTime: '2023-01-01T01:00:00.000Z', endTime: '2023-01-01T02:00:00.000Z', duration: 3600, status: 'completed', fileSize: 15500000 },
  { id: '6', cameraName: 'Backyard', startTime: '2023-01-01T01:00:00.000Z', endTime: '2023-01-01T02:00:00.000Z', duration: 3600, status: 'completed', fileSize: 14000000 },
  { id: '7', cameraName: 'Garage', startTime: '2023-01-01T01:00:00.000Z', endTime: '2023-01-01T02:00:00.000Z', duration: 3600, status: 'completed', fileSize: 13500000 },
  { id: '8', cameraName: 'Living Room', startTime: '2023-01-01T01:00:00.000Z', endTime: '2023-01-01T02:00:00.000Z', duration: 3600, status: 'completed', fileSize: 12500000 },
];

const Recordings: React.FC = () => {
  const [recordings, setRecordings] = useState(mockRecordings);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [openFilterDialog, setOpenFilterDialog] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [openPlaybackDialog, setOpenPlaybackDialog] = useState(false);
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // In a real implementation, we would fetch data from the API
  useEffect(() => {
    const fetchRecordings = async () => {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // This would be a real API call in production
        /*
        const response = await axios.get(`${API_URL}/recordings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setRecordings(response.data.recordings);
        */
        
        // Simulate API delay
        setTimeout(() => {
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching recordings:', error);
        setLoading(false);
      }
    };
    
    fetchRecordings();
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

  const handlePlayRecording = (recording: any) => {
    setSelectedRecording(recording);
    setOpenPlaybackDialog(true);
  };

  const handleClosePlaybackDialog = () => {
    setOpenPlaybackDialog(false);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
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
          Recordings
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<FilterListIcon />}
          onClick={handleOpenFilterDialog}
        >
          Filter
        </Button>
      </Box>
      
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="recordings table">
          <TableHead>
            <TableRow>
              <TableCell>Camera</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recordings
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((recording) => (
                <TableRow key={recording.id}>
                  <TableCell component="th" scope="row">
                    {recording.cameraName}
                  </TableCell>
                  <TableCell>{formatDate(recording.startTime)}</TableCell>
                  <TableCell>{formatDate(recording.endTime)}</TableCell>
                  <TableCell>{formatDuration(recording.duration)}</TableCell>
                  <TableCell>{formatFileSize(recording.fileSize)}</TableCell>
                  <TableCell>
                    <Chip
                      label={recording.status}
                      color={recording.status === 'completed' ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="primary"
                      aria-label="play recording"
                      onClick={() => handlePlayRecording(recording)}
                    >
                      <PlayArrowIcon />
                    </IconButton>
                    <IconButton color="primary" aria-label="download recording">
                      <DownloadIcon />
                    </IconButton>
                    <IconButton color="error" aria-label="delete recording">
                      <DeleteIcon />
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
        count={recordings.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
      
      {/* Filter Dialog */}
      <Dialog open={openFilterDialog} onClose={handleCloseFilterDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Recordings</DialogTitle>
        <DialogContent>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFilterDialog}>Cancel</Button>
          <Button variant="contained" color="primary">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Playback Dialog */}
      {selectedRecording && (
        <Dialog open={openPlaybackDialog} onClose={handleClosePlaybackDialog} maxWidth="md" fullWidth>
          <DialogTitle>{`${selectedRecording.cameraName} - ${formatDate(selectedRecording.startTime)}`}</DialogTitle>
          <DialogContent>
            <Box sx={{ width: '100%', height: 0, paddingBottom: '56.25%', position: 'relative', bgcolor: 'black' }}>
              <Typography
                variant="body1"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'white'
                }}
              >
                Video Player Placeholder
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePlaybackDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default Recordings;