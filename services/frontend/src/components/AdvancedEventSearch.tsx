import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Grid,
  Typography, 
  TextField, 
  Button, 
  Chip,
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  Slider,
  FormControlLabel,
  Switch,
  Autocomplete,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Menu,
  Popover,
  Tooltip,
  Divider,
  Paper,
  ButtonGroup
} from '@mui/material';
import { 
  DatePicker, 
  DateTimePicker, 
  LocalizationProvider 
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  SaveAlt as SaveIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  ContentCopy as ContentCopyIcon,
  Share as ShareIcon,
  MoreVert as MoreVertIcon,
  CloudDownload as CloudDownloadIcon,
  CameraAlt as CameraIcon,
  Tag as TagIcon,
  RestoreFromTrash as RestoreIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

// Define interfaces for event-related data
interface ObjectType {
  id: string;
  label: string;
  count: number;
}

interface SavedFilter {
  id: string;
  name: string;
  filter: EventFilter;
  isFavorite: boolean;
  createdAt: string;
}

interface EventFilter {
  startDate: Date | null;
  endDate: Date | null;
  cameraIds: string[];
  eventTypes: string[];
  objectTypes: string[];
  minConfidence: number;
  metadata: Record<string, any> | null;
  hasObjects: boolean | null;
  timeRange: [number, number] | null;
  tags: string[];
}

interface Camera {
  id: string;
  name: string;
  location: string;
}

const AdvancedEventSearch: React.FC<{
  onSearch: (filter: EventFilter) => void;
  onExport: (filter: EventFilter, format: string) => void;
}> = ({ onSearch, onExport }) => {
  const { token } = useAuth();
  const [filter, setFilter] = useState<EventFilter>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    endDate: new Date(),
    cameraIds: [],
    eventTypes: [],
    objectTypes: [],
    minConfidence: 60,
    metadata: null,
    hasObjects: null,
    timeRange: null,
    tags: []
  });

  // State variables for UI components
  const [availableObjectTypes, setAvailableObjectTypes] = useState<ObjectType[]>([]);
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState<string>('');
  const [saveFilterDialogOpen, setSaveFilterDialogOpen] = useState<boolean>(false);
  const [exportMenuAnchorEl, setExportMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [metadataFields, setMetadataFields] = useState<{key: string, value: string}[]>([]);
  const [newMetadataKey, setNewMetadataKey] = useState<string>('');
  const [newMetadataValue, setNewMetadataValue] = useState<string>('');
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch initial data on component mount
  useEffect(() => {
    fetchObjectTypes();
    fetchEventTypes();
    fetchCameras();
    fetchSavedFilters();
    fetchAvailableTags();
  }, []);

  // API calls
  const fetchObjectTypes = async () => {
    try {
      const response = await axios.get('/api/events/object-types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableObjectTypes(response.data);
    } catch (error) {
      console.error('Error fetching object types:', error);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const response = await axios.get('/api/events/event-types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableEventTypes(response.data);
    } catch (error) {
      console.error('Error fetching event types:', error);
    }
  };

  const fetchCameras = async () => {
    try {
      const response = await axios.get('/api/cameras', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCameras(response.data);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    }
  };

  const fetchSavedFilters = async () => {
    try {
      const response = await axios.get('/api/user/saved-filters', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedFilters(response.data);
    } catch (error) {
      console.error('Error fetching saved filters:', error);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await axios.get('/api/events/tags', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Error fetching available tags:', error);
    }
  };

  const saveFilter = async () => {
    if (!filterName.trim()) return;
    
    try {
      setLoading(true);
      
      const response = await axios.post('/api/user/saved-filters', {
        name: filterName,
        filter,
        isFavorite: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSavedFilters([...savedFilters, response.data]);
      setFilterName('');
      setSaveFilterDialogOpen(false);
    } catch (error) {
      console.error('Error saving filter:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteFilter = async (id: string) => {
    try {
      await axios.delete(`/api/user/saved-filters/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSavedFilters(savedFilters.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting filter:', error);
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      const filterToUpdate = savedFilters.find(f => f.id === id);
      if (!filterToUpdate) return;
      
      const response = await axios.patch(`/api/user/saved-filters/${id}`, {
        isFavorite: !filterToUpdate.isFavorite
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSavedFilters(savedFilters.map(f => f.id === id ? response.data : f));
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Event handlers
  const handleSearch = () => {
    setLoading(true);
    onSearch(filter);
    setTimeout(() => setLoading(false), 500); // Simulated loading for better UX
  };

  const handleExport = (format: string) => {
    setExportMenuAnchorEl(null);
    onExport(filter, format);
  };

  const handleFilterChange = (key: keyof EventFilter, value: any) => {
    setFilter({
      ...filter,
      [key]: value
    });
  };

  const handleLoadFilter = (savedFilter: SavedFilter) => {
    setFilter(savedFilter.filter);
  };

  const handleAddMetadataField = () => {
    if (!newMetadataKey.trim()) return;
    
    setMetadataFields([...metadataFields, { key: newMetadataKey, value: newMetadataValue }]);
    setNewMetadataKey('');
    setNewMetadataValue('');
    
    // Update the filter metadata
    const updatedMetadata = { ...(filter.metadata || {}) };
    updatedMetadata[newMetadataKey] = newMetadataValue;
    
    handleFilterChange('metadata', updatedMetadata);
  };

  const handleRemoveMetadataField = (index: number) => {
    const field = metadataFields[index];
    const updatedFields = [...metadataFields];
    updatedFields.splice(index, 1);
    setMetadataFields(updatedFields);
    
    // Update the filter metadata
    const updatedMetadata = { ...(filter.metadata || {}) };
    delete updatedMetadata[field.key];
    
    handleFilterChange('metadata', Object.keys(updatedMetadata).length > 0 ? updatedMetadata : null);
  };

  const handleResetFilter = () => {
    setFilter({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endDate: new Date(),
      cameraIds: [],
      eventTypes: [],
      objectTypes: [],
      minConfidence: 60,
      metadata: null,
      hasObjects: null,
      timeRange: null,
      tags: []
    });
    setMetadataFields([]);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="div">
              <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Advanced Event Search
            </Typography>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={advancedMode}
                    onChange={(e) => setAdvancedMode(e.target.checked)}
                    color="primary"
                  />
                }
                label="Advanced Mode"
              />
            </Box>
          </Box>
          
          <Grid container spacing={2}>
            {/* Date range filter */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Date Range
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <DateTimePicker
                  label="From"
                  value={filter.startDate}
                  onChange={(date) => handleFilterChange('startDate', date)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
                <DateTimePicker
                  label="To"
                  value={filter.endDate}
                  onChange={(date) => handleFilterChange('endDate', date)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Box>
            </Grid>
            
            {/* Event type filter */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Event Types
              </Typography>
              <FormControl fullWidth size="small">
                <Autocomplete
                  multiple
                  options={availableEventTypes}
                  renderInput={(params) => <TextField {...params} label="Select Event Types" />}
                  value={filter.eventTypes}
                  onChange={(_, newValue) => handleFilterChange('eventTypes', newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        {...getTagProps({ index })}
                        size="small"
                      />
                    ))
                  }
                />
              </FormControl>
            </Grid>
            
            {/* Camera filter */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Cameras
              </Typography>
              <FormControl fullWidth size="small">
                <Autocomplete
                  multiple
                  options={cameras}
                  getOptionLabel={(option) => option.name}
                  renderInput={(params) => <TextField {...params} label="Select Cameras" />}
                  value={cameras.filter(c => filter.cameraIds.includes(c.id))}
                  onChange={(_, newValue) => handleFilterChange('cameraIds', newValue.map(c => c.id))}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option.name}
                        {...getTagProps({ index })}
                        size="small"
                      />
                    ))
                  }
                />
              </FormControl>
            </Grid>
            
            {/* Object type filter */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Object Types
              </Typography>
              <FormControl fullWidth size="small">
                <Autocomplete
                  multiple
                  options={availableObjectTypes}
                  getOptionLabel={(option) => `${option.label} (${option.count})`}
                  renderInput={(params) => <TextField {...params} label="Select Object Types" />}
                  value={availableObjectTypes.filter(o => filter.objectTypes.includes(o.id))}
                  onChange={(_, newValue) => handleFilterChange('objectTypes', newValue.map(o => o.id))}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option.label}
                        {...getTagProps({ index })}
                        size="small"
                      />
                    ))
                  }
                />
              </FormControl>
            </Grid>
            
            {/* Confidence threshold */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Minimum Confidence ({filter.minConfidence}%)
              </Typography>
              <Slider
                value={filter.minConfidence}
                onChange={(_, newValue) => handleFilterChange('minConfidence', newValue)}
                aria-labelledby="confidence-slider"
                valueLabelDisplay="auto"
                step={5}
                marks
                min={0}
                max={100}
              />
            </Grid>
            
            {/* Tags filter */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <FormControl fullWidth size="small">
                <Autocomplete
                  multiple
                  freeSolo
                  options={availableTags}
                  renderInput={(params) => <TextField {...params} label="Select or Create Tags" />}
                  value={filter.tags}
                  onChange={(_, newValue) => handleFilterChange('tags', newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        {...getTagProps({ index })}
                        size="small"
                      />
                    ))
                  }
                />
              </FormControl>
            </Grid>
            
            {/* Advanced filters (conditionally rendered) */}
            {advancedMode && (
              <>
                <Grid item xs={12}>
                  <Divider>
                    <Chip label="Advanced Filters" />
                  </Divider>
                </Grid>
                
                {/* Metadata search */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Metadata Search
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={5}>
                        <TextField
                          label="Key"
                          value={newMetadataKey}
                          onChange={(e) => setNewMetadataKey(e.target.value)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={5}>
                        <TextField
                          label="Value"
                          value={newMetadataValue}
                          onChange={(e) => setNewMetadataValue(e.target.value)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={2}>
                        <Button
                          variant="outlined"
                          onClick={handleAddMetadataField}
                          disabled={!newMetadataKey.trim()}
                          fullWidth
                        >
                          Add
                        </Button>
                      </Grid>
                    </Grid>
                    
                    {metadataFields.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Applied Metadata Filters:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                          {metadataFields.map((field, index) => (
                            <Chip
                              key={index}
                              label={`${field.key}: ${field.value}`}
                              onDelete={() => handleRemoveMetadataField(index)}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                </Grid>
                
                {/* Time range filter */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Time of Day Filter
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filter.timeRange !== null}
                        onChange={(e) => handleFilterChange('timeRange', e.target.checked ? [0, 24] : null)}
                        color="primary"
                      />
                    }
                    label="Filter by time of day"
                  />
                  
                  {filter.timeRange && (
                    <Box sx={{ px: 2, mt: 2 }}>
                      <Slider
                        value={filter.timeRange}
                        onChange={(_, newValue) => handleFilterChange('timeRange', newValue)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}:00`}
                        step={1}
                        marks
                        min={0}
                        max={24}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {`${filter.timeRange[0]}:00 - ${filter.timeRange[1]}:00`}
                      </Typography>
                    </Box>
                  )}
                </Grid>
                
                {/* Object presence filter */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Object Presence
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Object Detection</InputLabel>
                    <Select
                      value={filter.hasObjects === null ? '' : filter.hasObjects ? 'with' : 'without'}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleFilterChange('hasObjects', value === '' ? null : value === 'with');
                      }}
                      label="Object Detection"
                    >
                      <MenuItem value="">Any</MenuItem>
                      <MenuItem value="with">With detected objects</MenuItem>
                      <MenuItem value="without">Without detected objects</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
          </Grid>
          
          {/* Filter actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Box>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<RefreshIcon />}
                onClick={handleResetFilter}
                sx={{ mr: 1 }}
              >
                Reset
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => setSaveFilterDialogOpen(true)}
              >
                Save Filter
              </Button>
            </Box>
            
            <Box>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<CloudDownloadIcon />}
                onClick={(e) => setExportMenuAnchorEl(e.currentTarget)}
                sx={{ mr: 1 }}
              >
                Export
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </Button>
            </Box>
          </Box>
          
          {/* Saved filters section */}
          {savedFilters.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Saved Filters
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {savedFilters.map((savedFilter) => (
                  <Chip
                    key={savedFilter.id}
                    label={savedFilter.name}
                    onClick={() => handleLoadFilter(savedFilter)}
                    onDelete={() => deleteFilter(savedFilter.id)}
                    icon={
                      savedFilter.isFavorite ? 
                      <FavoriteIcon color="error" fontSize="small" /> : 
                      <FavoriteBorderIcon fontSize="small" onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(savedFilter.id);
                      }} />
                    }
                    variant="outlined"
                    color={savedFilter.isFavorite ? "primary" : "default"}
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
      
      {/* Save filter dialog */}
      <Dialog open={saveFilterDialogOpen} onClose={() => setSaveFilterDialogOpen(false)}>
        <DialogTitle>Save Search Filter</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Filter Name"
            type="text"
            fullWidth
            variant="outlined"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveFilterDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveFilter} color="primary" disabled={!filterName.trim() || loading}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Export menu */}
      <Menu
        anchorEl={exportMenuAnchorEl}
        open={Boolean(exportMenuAnchorEl)}
        onClose={() => setExportMenuAnchorEl(null)}
      >
        <MenuItem onClick={() => handleExport('csv')}>
          <Typography variant="body2">CSV (.csv)</Typography>
        </MenuItem>
        <MenuItem onClick={() => handleExport('json')}>
          <Typography variant="body2">JSON (.json)</Typography>
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>
          <Typography variant="body2">PDF Report (.pdf)</Typography>
        </MenuItem>
        <MenuItem onClick={() => handleExport('xlsx')}>
          <Typography variant="body2">Excel (.xlsx)</Typography>
        </MenuItem>
      </Menu>
    </LocalizationProvider>
  );
};

export default AdvancedEventSearch;