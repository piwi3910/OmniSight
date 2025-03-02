import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  SelectChangeEvent,
  Checkbox,
  FormControlLabel
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
  const navigate = useNavigate();
  
  // State
  const [recordings, setRecordings] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [openFilterDialog, setOpenFilterDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    cameraId: 'all',
    startDate: '',
    endDate: '',
    hasEvents: false
  });
  
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // Fetch cameras for filter dropdown
  useEffect(() => {
    const fetchCameras = async () => {
      if (!token) return;
      
      try {
        const response = await axios.get(`${API_URL}/cameras`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setCameras(response.data.cameras || []);
      } catch (error) {
        console.error('Error fetching cameras:', error);
        // Use mock data in development
        if (process.env.NODE_ENV === 'development') {
          setCameras([
            { id: '1', name: 'Front Door' },
            { id: '2', name: 'Backyard' },
            { id: '3', name: 'Garage' },
            { id: '4', name: 'Living Room' }
          ]);
        }
      }
    };
    
    fetchCameras();
  }, [token, API_URL]);
  
  // Fetch recordings with filters
  const fetchRecordings = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params: any = {
        page: page + 1, // API uses 1-based indexing
        limit: rowsPerPage
      };
      
      if (filters.cameraId !== 'all') {
        params.cameraId = filters.cameraId;
      }
      
      if (filters.startDate) {
        params.startDate = new Date(filters.startDate).toISOString();
      }
      
      if (filters.endDate) {
        params.endDate = new Date(filters.endDate).toISOString();
      }
      
      if (filters.hasEvents) {
        params.hasEvents = true;
      }
      
      const response = await axios.get(`${API_URL}/recordings`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setRecordings(response.data.recordings || []);
      setTotalCount(response.data.totalCount || response.data.recordings?.length || 0);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      setError('Failed to load recordings. Please try again.');
      
      // Use mock data in development
      if (process.env.NODE_ENV === 'development') {
        setRecordings(mockRecordings);
        setTotalCount(mockRecordings.length);
      }
    } finally {
      setLoading(false);
    }
  }, [token, API_URL, page, rowsPerPage, filters]);
  
  // Fetch recordings when dependencies change
  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

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

  // Filter change handlers
  const handleTextFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };
  
  const handleSelectFilterChange = (event: SelectChangeEvent) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };
  
  const handleBooleanFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setFilters({
      ...filters,
      [name]: checked
    });
  };

  // Apply filters
  const handleApplyFilters = () => {
    setPage(0); // Reset to first page when applying filters
    setOpenFilterDialog(false);
    fetchRecordings();
  };

  // Recording actions
  const handlePlayRecording = (recording: any) => {
    setSelectedRecording(recording);
    navigate(`/recordings/${recording.id}`);
  };

  const handleDeleteClick = (recording: any) => {
    setSelectedRecording(recording);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedRecording(null);
  };

  const handleDeleteRecording = async () => {
    if (!selectedRecording || !token) return;
    
    setLoading(true);
    
    try {
      await axios.delete(`${API_URL}/recordings/${selectedRecording.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh recordings list
      fetchRecordings();
      setDeleteDialogOpen(false);
      setSelectedRecording(null);
    } catch (error) {
      console.error('Error deleting recording:', error);
      setError('Failed to delete recording. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRecording = async (recording: any) => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      const response = await axios.get(`${API_URL}/recordings/${recording.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `recording-${recording.cameraName}-${new Date(recording.startTime).toISOString()}.mp4`;
      link.click();
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading recording:', error);
      setError('Failed to download recording. Please try again.');
    } finally {
      setLoading(false);
    }
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

  // Loading state
  if (loading && recordings.length === 0) {
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
      
      {/* Error message */}
      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
          <Typography color="error.dark">{error}</Typography>
        </Box>
      )}
      
      {/* Empty state */}
      {recordings.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No recordings found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Try adjusting your filters or check back later
          </Typography>
        </Box>
      )}
      
      {/* Recordings table */}
      {recordings.length > 0 && (
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
                  <TableRow
                    key={recording.id}
                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                  >
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
                        disabled={loading}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                      <IconButton
                        color="primary"
                        aria-label="download recording"
                        onClick={() => handleDownloadRecording(recording)}
                        disabled={loading}
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        aria-label="delete recording"
                        onClick={() => handleDeleteClick(recording)}
                        disabled={loading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {recordings.length > 0 && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`}
        />
      )}
      
      {/* Filter Dialog */}
      <Dialog open={openFilterDialog} onClose={handleCloseFilterDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Recordings</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel id="camera-select-label">Camera</InputLabel>
            <Select
              labelId="camera-select-label"
              id="camera-select"
              name="cameraId"
              value={filters.cameraId}
              onChange={handleSelectFilterChange}
              label="Camera"
            >
              <MenuItem value="all">All Cameras</MenuItem>
              {cameras.map(camera => (
                <MenuItem key={camera.id} value={camera.id}>
                  {camera.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            margin="normal"
            name="startDate"
            label="Start Date"
            type="datetime-local"
            fullWidth
            value={filters.startDate}
            onChange={handleTextFilterChange}
            InputLabelProps={{
              shrink: true,
            }}
          />
          
          <TextField
            margin="normal"
            name="endDate"
            label="End Date"
            type="datetime-local"
            fullWidth
            value={filters.endDate}
            onChange={handleTextFilterChange}
            InputLabelProps={{
              shrink: true,
            }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                name="hasEvents"
                checked={filters.hasEvents}
                onChange={handleBooleanFilterChange}
              />
            }
            label="Show only recordings with events"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFilterDialog}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleApplyFilters}
          >
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      {selectedRecording && (
        <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
          <DialogTitle>Delete Recording</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the recording from {selectedRecording.cameraName}
              ({formatDate(selectedRecording.startTime)})? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel}>Cancel</Button>
            <Button
              onClick={handleDeleteRecording}
              color="error"
              variant="contained"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default Recordings;