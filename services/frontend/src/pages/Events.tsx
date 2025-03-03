import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  Paper,
  Divider,
  Button,
  IconButton,
  Dialog,
  Chip
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  ViewList as ViewListIcon,
  Timeline as TimelineIcon,
  GridView as GridViewIcon,
  Map as MapIcon,
  ZoomIn as ZoomInIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import EventList from '../components/EventList';
import EventTimeline from '../components/EventTimeline';
import EventMap from '../components/EventMap';
import EventGrid from '../components/EventGrid';
import EventDetails from '../components/EventDetails';
import AdvancedEventSearch from '../components/AdvancedEventSearch';
import { format } from 'date-fns';

// Interfaces for event data
interface Event {
  id: string;
  timestamp: string;
  type: string;
  camera?: {
    id: string;
    name: string;
  };
  recording?: {
    id: string;
    startTime: string;
    endTime: string;
  };
  thumbnailPath?: string;
  detectedObjects?: DetectedObject[];
  confidence: number;
}

interface DetectedObject {
  id: string;
  type: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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

const Events: React.FC = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [filters, setFilters] = useState<EventFilter>({
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

  // Fetch events on component mount or when filters change
  useEffect(() => {
    fetchEvents();
  }, [page, filters]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters based on filters
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '50');
      
      if (filters.startDate) {
        params.append('startTime', filters.startDate.toISOString());
      }
      
      if (filters.endDate) {
        params.append('endTime', filters.endDate.toISOString());
      }
      
      if (filters.cameraIds.length > 0) {
        filters.cameraIds.forEach(id => params.append('cameraIds', id));
      }
      
      if (filters.eventTypes.length > 0) {
        filters.eventTypes.forEach(type => params.append('eventTypes', type));
      }
      
      if (filters.objectTypes.length > 0) {
        filters.objectTypes.forEach(type => params.append('objectTypes', type));
      }
      
      if (filters.minConfidence > 0) {
        params.append('minConfidence', filters.minConfidence.toString());
      }
      
      if (filters.hasObjects !== null) {
        params.append('hasObjects', filters.hasObjects.toString());
      }
      
      if (filters.timeRange !== null) {
        params.append('timeRangeStart', filters.timeRange[0].toString());
        params.append('timeRangeEnd', filters.timeRange[1].toString());
      }
      
      if (filters.tags.length > 0) {
        filters.tags.forEach(tag => params.append('tags', tag));
      }
      
      if (filters.metadata) {
        params.append('metadata', JSON.stringify(filters.metadata));
      }

      // Make the API request
      const response = await axios.get(`/api/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEvents(response.data.events);
      setTotalEvents(response.data.pagination.total);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportEvents = async (filterToExport: EventFilter, format: string) => {
    try {
      setLoading(true);
      
      // Build query parameters based on filters
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (filterToExport.startDate) {
        params.append('startTime', filterToExport.startDate.toISOString());
      }
      
      if (filterToExport.endDate) {
        params.append('endTime', filterToExport.endDate.toISOString());
      }
      
      if (filterToExport.cameraIds.length > 0) {
        filterToExport.cameraIds.forEach(id => params.append('cameraIds', id));
      }
      
      if (filterToExport.eventTypes.length > 0) {
        filterToExport.eventTypes.forEach(type => params.append('eventTypes', type));
      }
      
      if (filterToExport.objectTypes.length > 0) {
        filterToExport.objectTypes.forEach(type => params.append('objectTypes', type));
      }
      
      if (filterToExport.minConfidence > 0) {
        params.append('minConfidence', filterToExport.minConfidence.toString());
      }
      
      // Generate a filename
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const filename = `events-export-${dateStr}.${format}`;
      
      // Make API request for export
      const response = await axios.get(`/api/events/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create a download link and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting events:', err);
      setError('Failed to export events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (_: React.SyntheticEvent, newValue: number) => {
    setView(newValue);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };

  const handleFilterSearch = (newFilters: EventFilter) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page with new filters
  };

  const handleExport = (filterToExport: EventFilter, format: string) => {
    exportEvents(filterToExport, format);
  };

  const renderContent = () => {
    if (loading && events.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error">{error}</Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchEvents}
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </Paper>
      );
    }

    if (events.length === 0) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No events found matching your criteria
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your filters or time range
          </Typography>
        </Paper>
      );
    }

    switch (view) {
      case 0: // List view
        return (
          <EventList
            events={events}
            onEventClick={handleEventClick}
            totalCount={totalEvents}
            page={page}
            onPageChange={(newPage) => setPage(newPage)}
          />
        );
      case 1: // Timeline view
        return (
          <EventTimeline
            events={events}
            onEventClick={handleEventClick}
            startDate={filters.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
            endDate={filters.endDate || new Date()}
          />
        );
      case 2: // Grid view
        return (
          <EventGrid
            events={events}
            onEventClick={handleEventClick}
            totalCount={totalEvents}
            page={page}
            onPageChange={(newPage) => setPage(newPage)}
          />
        );
      case 3: // Map view
        return <EventMap events={events} onEventClick={handleEventClick} />;
      default:
        return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Event Browser</Typography>
        <Box>
          <IconButton 
            onClick={() => setShowFilters(!showFilters)}
            color={showFilters ? 'primary' : 'default'}
          >
            <FilterIcon />
          </IconButton>
          <IconButton onClick={fetchEvents}>
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={() => handleExport(filters, 'csv')}>
            <DownloadIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Filter section */}
      {showFilters && (
        <Box sx={{ mb: 3 }}>
          <AdvancedEventSearch
            onSearch={handleFilterSearch}
            onExport={handleExport}
          />
        </Box>
      )}

      {/* View selection tabs */}
      <Tabs
        value={view}
        onChange={handleViewChange}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab icon={<ViewListIcon />} label="List" />
        <Tab icon={<TimelineIcon />} label="Timeline" />
        <Tab icon={<GridViewIcon />} label="Grid" />
        <Tab icon={<MapIcon />} label="Map" />
      </Tabs>

      {/* Active filters chips */}
      {(filters.eventTypes.length > 0 || 
       filters.cameraIds.length > 0 || 
       filters.objectTypes.length > 0 || 
       filters.tags.length > 0) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
            Active Filters:
          </Typography>
          
          {filters.eventTypes.map((type) => (
            <Chip
              key={`event-${type}`}
              label={`Event: ${type}`}
              size="small"
              onDelete={() => setFilters({
                ...filters,
                eventTypes: filters.eventTypes.filter(t => t !== type)
              })}
            />
          ))}
          
          {filters.objectTypes.map((type) => (
            <Chip
              key={`object-${type}`}
              label={`Object: ${type}`}
              size="small"
              onDelete={() => setFilters({
                ...filters,
                objectTypes: filters.objectTypes.filter(t => t !== type)
              })}
            />
          ))}
          
          {filters.tags.map((tag) => (
            <Chip
              key={`tag-${tag}`}
              label={`Tag: ${tag}`}
              size="small"
              onDelete={() => setFilters({
                ...filters,
                tags: filters.tags.filter(t => t !== tag)
              })}
            />
          ))}
          
          <Chip
            label={`Date: ${filters.startDate ? format(filters.startDate, 'MMM d') : ''} - ${filters.endDate ? format(filters.endDate, 'MMM d') : ''}`}
            size="small"
          />
          
          {filters.minConfidence > 0 && (
            <Chip
              label={`Confidence: >${filters.minConfidence}%`}
              size="small"
            />
          )}
        </Box>
      )}

      {/* Events content */}
      <Box sx={{ minHeight: 400 }}>
        {renderContent()}
      </Box>

      {/* Event details dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedEvent && (
          <EventDetails
            event={selectedEvent}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </Dialog>
    </Box>
  );
};

export default Events;