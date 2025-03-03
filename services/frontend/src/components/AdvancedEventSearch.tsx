import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Button,
  Grid,
  Collapse,
  Divider,
  Slider,
  SelectChangeEvent,
  Autocomplete
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';

interface FilterPreset {
  id: string;
  name: string;
  filters: EventFilters;
}

interface EventFilters {
  eventType: string;
  cameraId: string;
  startDate: string;
  endDate: string;
  minConfidence: string;
  metadata?: {
    objectClasses?: string[];
    hasVehicle?: boolean;
    hasPerson?: boolean;
    hasAnimal?: boolean;
    minObjects?: number;
    maxObjects?: number;
    objectPosition?: string;
  };
  [key: string]: any;
}

interface AdvancedEventSearchProps {
  cameras: any[];
  onSearch: (filters: EventFilters) => void;
  initialFilters?: EventFilters;
  onExport?: (format: string) => void;
}

// Object detection classes
const OBJECT_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 
  'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

const defaultFilters: EventFilters = {
  eventType: 'all',
  cameraId: 'all',
  startDate: '',
  endDate: '',
  minConfidence: '0',
  metadata: {
    objectClasses: [],
    hasVehicle: false,
    hasPerson: false,
    hasAnimal: false,
    minObjects: 1,
    maxObjects: 10,
    objectPosition: 'any'
  }
};

const AdvancedEventSearch: React.FC<AdvancedEventSearchProps> = ({
  cameras,
  onSearch,
  initialFilters,
  onExport
}) => {
  // State
  const [filters, setFilters] = useState<EventFilters>(initialFilters || defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [objectCountRange, setObjectCountRange] = useState<[number, number]>([1, 10]);
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  // Use initial filters when they change
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
      
      // Update object count range if metadata exists
      if (initialFilters.metadata) {
        setObjectCountRange([
          initialFilters.metadata.minObjects || 1,
          initialFilters.metadata.maxObjects || 10
        ]);
      }
    }
  }, [initialFilters]);

  // Load saved presets from localStorage
  useEffect(() => {
    const savedPresetsJson = localStorage.getItem('eventFilterPresets');
    if (savedPresetsJson) {
      try {
        const presets = JSON.parse(savedPresetsJson);
        setSavedPresets(presets);
      } catch (e) {
        console.error('Error loading saved presets:', e);
      }
    }
  }, []);

  // Handle basic filter changes
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

  // Handle date changes
  const handleDateChange = (name: string, value: string) => {
    if (value) {
      try {
        // Try to parse as a date to ensure valid format
        const date = new Date(value);
        setFilters({
          ...filters,
          [name]: date.toISOString()
        });
      } catch (e) {
        console.error('Invalid date format:', e);
      }
    } else {
      setFilters({
        ...filters,
        [name]: ''
      });
    }
  };

  // Handle metadata changes
  const handleMetadataChange = (name: string, value: any) => {
    setFilters({
      ...filters,
      metadata: {
        ...filters.metadata,
        [name]: value
      }
    });
  };

  // Handle object count range
  const handleObjectCountChange = (event: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      setObjectCountRange(newValue as [number, number]);
      setFilters({
        ...filters,
        metadata: {
          ...filters.metadata,
          minObjects: newValue[0],
          maxObjects: newValue[1]
        }
      });
    }
  };

  // Handle search action
  const handleSearch = () => {
    onSearch(filters);
  };

  // Handle reset filters
  const handleReset = () => {
    setFilters(defaultFilters);
    setObjectCountRange([1, 10]);
    setShowAdvanced(false);
  };

  // Handle save preset
  const handleSavePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      filters: { ...filters }
    };

    const updatedPresets = [...savedPresets, newPreset];
    setSavedPresets(updatedPresets);
    localStorage.setItem('eventFilterPresets', JSON.stringify(updatedPresets));
    setPresetName('');
    setShowPresetSave(false);
  };

  // Handle load preset
  const handleLoadPreset = (preset: FilterPreset) => {
    setFilters({ ...preset.filters });
    if (preset.filters.metadata) {
      setObjectCountRange([
        preset.filters.metadata.minObjects || 1,
        preset.filters.metadata.maxObjects || 10
      ]);
    }
  };

  // Handle delete preset
  const handleDeletePreset = (presetId: string) => {
    const updatedPresets = savedPresets.filter(preset => preset.id !== presetId);
    setSavedPresets(updatedPresets);
    localStorage.setItem('eventFilterPresets', JSON.stringify(updatedPresets));
  };

  // Handle quick date filters
  const handleQuickDateFilter = (days: number) => {
    const now = new Date();
    const startDate = subDays(now, days);
    
    setFilters({
      ...filters,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    });
  };

  // Handle export
  const handleExport = (format: string) => {
    if (onExport) {
      onExport(format);
    }
  };

  // Format date for display (from ISO to yyyy-MM-ddTHH:mm)
  const formatDateForInput = (isoDate: string): string => {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate);
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (e) {
      return '';
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <FilterListIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Event Search</Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Basic filters */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel id="event-type-select-label">Event Type</InputLabel>
            <Select
              labelId="event-type-select-label"
              id="event-type-select"
              name="eventType"
              value={filters.eventType}
              onChange={handleSelectFilterChange}
              label="Event Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="motion">Motion</MenuItem>
              <MenuItem value="person">Person</MenuItem>
              <MenuItem value="vehicle">Vehicle</MenuItem>
              <MenuItem value="animal">Animal</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
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
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Start Date"
            type="datetime-local"
            value={formatDateForInput(filters.startDate)}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="End Date"
            type="datetime-local"
            value={formatDateForInput(filters.endDate)}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap' }}>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => handleQuickDateFilter(1)}
          sx={{ mr: 1, mb: 1 }}
        >
          Today
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => handleQuickDateFilter(7)}
          sx={{ mr: 1, mb: 1 }}
        >
          Last 7 Days
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => handleQuickDateFilter(30)}
          sx={{ mr: 1, mb: 1 }}
        >
          Last 30 Days
        </Button>
      </Box>

      <Box 
        sx={{ 
          mt: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}
      >
        <Button
          variant="text"
          color="primary"
          onClick={() => setShowAdvanced(!showAdvanced)}
          startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
        </Button>

        {savedPresets.length > 0 && (
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="preset-select-label">Saved Searches</InputLabel>
            <Select
              labelId="preset-select-label"
              id="preset-select"
              label="Saved Searches"
              value=""
              onChange={(e) => {
                const presetId = e.target.value;
                const preset = savedPresets.find(p => p.id === presetId);
                if (preset) handleLoadPreset(preset);
              }}
              displayEmpty
            >
              <MenuItem value="" disabled>
                <em>Select a saved search</em>
              </MenuItem>
              {savedPresets.map(preset => (
                <MenuItem key={preset.id} value={preset.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{preset.name}</span>
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePreset(preset.id);
                    }}
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Advanced filters */}
      <Collapse in={showAdvanced}>
        <Box sx={{ mt: 3, mb: 2 }}>
          <Divider>
            <Chip label="Advanced Filters" />
          </Divider>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="confidence-select-label">Minimum Confidence</InputLabel>
              <Select
                labelId="confidence-select-label"
                id="confidence-select"
                name="minConfidence"
                value={filters.minConfidence}
                onChange={handleSelectFilterChange}
                label="Minimum Confidence"
              >
                <MenuItem value="0">Any</MenuItem>
                <MenuItem value="0.5">50%</MenuItem>
                <MenuItem value="0.7">70%</MenuItem>
                <MenuItem value="0.9">90%</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <Autocomplete
              multiple
              id="object-classes"
              options={OBJECT_CLASSES}
              value={filters.metadata?.objectClasses || []}
              onChange={(_, newValue) => handleMetadataChange('objectClasses', newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Object Classes" placeholder="Select objects" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography id="object-count-slider" gutterBottom>
              Number of Objects: {objectCountRange[0]} - {objectCountRange[1]}
            </Typography>
            <Slider
              getAriaLabel={() => 'Object count range'}
              value={objectCountRange}
              onChange={handleObjectCountChange}
              valueLabelDisplay="auto"
              min={1}
              max={20}
              step={1}
              marks={[
                { value: 1, label: '1' },
                { value: 5, label: '5' },
                { value: 10, label: '10' },
                { value: 15, label: '15' },
                { value: 20, label: '20' }
              ]}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="object-position-label">Object Position</InputLabel>
              <Select
                labelId="object-position-label"
                id="object-position"
                value={filters.metadata?.objectPosition || 'any'}
                onChange={(e) => handleMetadataChange('objectPosition', e.target.value)}
                label="Object Position"
              >
                <MenuItem value="any">Any Position</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="top">Top</MenuItem>
                <MenuItem value="bottom">Bottom</MenuItem>
                <MenuItem value="left">Left</MenuItem>
                <MenuItem value="right">Right</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Collapse>

      {/* Action buttons */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{ mr: 1 }}
          >
            Search
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleReset}
          >
            Reset
          </Button>
        </Box>

        <Box>
          {showPresetSave ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField
                size="small"
                label="Save as"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                sx={{ mr: 1 }}
              />
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                Save
              </Button>
              <IconButton size="small" onClick={() => setShowPresetSave(false)} sx={{ ml: 1 }}>
                <CloseIcon />
              </IconButton>
            </Box>
          ) : (
            <Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => setShowPresetSave(true)}
                sx={{ mr: 1 }}
              >
                Save Search
              </Button>
              {onExport && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('csv')}
                >
                  Export Results
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default AdvancedEventSearch;