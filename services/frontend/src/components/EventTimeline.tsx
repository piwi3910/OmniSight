import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  ButtonGroup,
  Button,
  CircularProgress,
  useTheme,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Divider,
  Popover
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  Today,
  Schedule,
  NavigateBefore,
  NavigateNext,
  SkipPrevious,
  SkipNext,
  FilterList,
  CloudDownload
} from '@mui/icons-material';
import { format, addDays, subDays, startOfDay, endOfDay, differenceInDays, addHours, subHours, isWithinInterval } from 'date-fns';

// Define interfaces for event-related data
interface Event {
  id: string;
  timestamp: string;
  type: string;
  camera?: {
    id: string;
    name: string;
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

interface EventTimelineProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  startDate: Date;
  endDate: Date;
}

// Define event types with their colors
const EVENT_TYPES: Record<string, { color: string; label: string }> = {
  'motion': { color: '#FFA726', label: 'Motion' },
  'person': { color: '#42A5F5', label: 'Person' },
  'vehicle': { color: '#66BB6A', label: 'Vehicle' },
  'animal': { color: '#EC407A', label: 'Animal' },
  'face': { color: '#AB47BC', label: 'Face' },
  'tamper': { color: '#EF5350', label: 'Tamper' },
  'crossline': { color: '#7E57C2', label: 'Line Cross' },
  'intrusion': { color: '#FF7043', label: 'Intrusion' },
  'object_left': { color: '#26A69A', label: 'Object Left' },
  'object_removed': { color: '#BDBDBD', label: 'Object Removed' }
};

// Default color for unknown event types
const DEFAULT_EVENT_COLOR = '#9E9E9E';

const EventTimeline: React.FC<EventTimelineProps> = ({ events, onEventClick, startDate, endDate }) => {
  const theme = useTheme();
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // State variables for timeline control
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [currentDate, setCurrentDate] = useState<Date>(new Date(startDate));
  const [zoomLevel, setZoomLevel] = useState<number>(100); // percentage
  const [hoveredEvent, setHoveredEvent] = useState<Event | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Calculate date range based on view mode
  const getDateRange = () => {
    if (viewMode === 'day') {
      return {
        start: startOfDay(currentDate),
        end: endOfDay(currentDate)
      };
    } else { // week view
      const start = subDays(startOfDay(currentDate), 3);
      const end = addDays(endOfDay(currentDate), 3);
      return { start, end };
    }
  };

  // Filter events based on current date range
  useEffect(() => {
    setLoading(true);
    
    const { start, end } = getDateRange();
    
    // Filter events that fall within the current date range
    const filtered = events.filter(event => {
      const eventDate = new Date(event.timestamp);
      return isWithinInterval(eventDate, { start, end });
    });
    
    setFilteredEvents(filtered);
    
    // Calculate event counts by type
    const counts: Record<string, number> = {};
    filtered.forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    setEventCounts(counts);
    
    setLoading(false);
  }, [events, currentDate, viewMode]);

  // Handle timeline navigation
  const navigateTimeline = (direction: 'prev' | 'next') => {
    if (viewMode === 'day') {
      setCurrentDate(prev => direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
    } else { // week view
      setCurrentDate(prev => direction === 'prev' ? subDays(prev, 7) : addDays(prev, 7));
    }
  };

  // Handle zoom level change
  const handleZoomChange = (newZoomLevel: number) => {
    setZoomLevel(Math.max(50, Math.min(200, newZoomLevel)));
  };

  // Get color for event type
  const getEventColor = (eventType: string) => {
    return EVENT_TYPES[eventType]?.color || DEFAULT_EVENT_COLOR;
  };

  // Get position for an event on the timeline
  const getEventPosition = (eventTimestamp: string) => {
    const { start, end } = getDateRange();
    const eventDate = new Date(eventTimestamp);
    
    // Calculate total time range in milliseconds
    const rangeMs = end.getTime() - start.getTime();
    
    // Calculate position as percentage
    const position = ((eventDate.getTime() - start.getTime()) / rangeMs) * 100;
    return Math.max(0, Math.min(100, position));
  };

  // Generate time markers for the timeline
  const generateTimeMarkers = () => {
    const { start, end } = getDateRange();
    const markers = [];
    
    if (viewMode === 'day') {
      // For day view, show hourly markers
      for (let hour = 0; hour <= 24; hour += 2) {
        const markerTime = addHours(start, hour);
        if (markerTime <= end) {
          markers.push({
            time: markerTime,
            label: format(markerTime, 'HH:mm'),
            position: (hour / 24) * 100
          });
        }
      }
    } else { // week view
      // For week view, show daily markers
      const days = differenceInDays(end, start);
      for (let day = 0; day <= days; day++) {
        const markerTime = addDays(start, day);
        markers.push({
          time: markerTime,
          label: format(markerTime, 'EEE, MMM d'),
          position: (day / days) * 100
        });
      }
    }
    
    return markers;
  };

  // Handle event hover
  const handleEventHover = (event: React.MouseEvent<HTMLDivElement>, eventData: Event) => {
    setHoveredEvent(eventData);
    setPopoverAnchor(event.currentTarget);
  };

  // Generate heat map data for event distribution
  const generateHeatMap = () => {
    const { start, end } = getDateRange();
    const heatMap = [];
    
    // Determine number of segments based on view mode
    const segments = viewMode === 'day' ? 24 : 7;
    
    // Initialize counts for each segment
    const segmentCounts = Array(segments).fill(0);
    
    // Count events in each segment
    filteredEvents.forEach(event => {
      const eventDate = new Date(event.timestamp);
      let segmentIndex;
      
      if (viewMode === 'day') {
        // For day view, segment by hour
        segmentIndex = eventDate.getHours();
      } else {
        // For week view, segment by day of week
        const daysDiff = differenceInDays(eventDate, start);
        segmentIndex = Math.min(Math.max(0, daysDiff), segments - 1);
      }
      
      segmentCounts[segmentIndex]++;
    });
    
    // Find maximum count for normalization
    const maxCount = Math.max(...segmentCounts, 1);
    
    // Generate heat map segments
    for (let i = 0; i < segments; i++) {
      const count = segmentCounts[i];
      const intensity = count / maxCount;
      
      heatMap.push({
        position: (i / segments) * 100,
        width: 100 / segments,
        intensity,
        count
      });
    }
    
    return heatMap;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Event Timeline</Typography>
          
          <Box>
            <ButtonGroup size="small" variant="outlined" sx={{ mr: 2 }}>
              <Button 
                variant={viewMode === 'day' ? 'contained' : 'outlined'} 
                onClick={() => setViewMode('day')}
                startIcon={<Schedule />}
              >
                Day
              </Button>
              <Button 
                variant={viewMode === 'week' ? 'contained' : 'outlined'} 
                onClick={() => setViewMode('week')}
                startIcon={<Today />}
              >
                Week
              </Button>
            </ButtonGroup>
            
            <IconButton onClick={() => handleZoomChange(zoomLevel - 10)} disabled={zoomLevel <= 50}>
              <ZoomOut />
            </IconButton>
            <IconButton onClick={() => handleZoomChange(zoomLevel + 10)} disabled={zoomLevel >= 200}>
              <ZoomIn />
            </IconButton>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <IconButton onClick={() => navigateTimeline('prev')}>
            <NavigateBefore />
          </IconButton>
          
          <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'center' }}>
            {viewMode === 'day' 
              ? format(currentDate, 'EEEE, MMMM d, yyyy')
              : `Week of ${format(subDays(currentDate, currentDate.getDay()), 'MMM d')} - ${format(addDays(subDays(currentDate, currentDate.getDay()), 6), 'MMM d, yyyy')}`
            }
          </Typography>
          
          <IconButton onClick={() => navigateTimeline('next')}>
            <NavigateNext />
          </IconButton>
        </Box>
        
        {/* Event type legend */}
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {Object.entries(eventCounts).map(([type, count]) => (
            <Chip
              key={type}
              label={`${EVENT_TYPES[type]?.label || type}: ${count}`}
              sx={{
                backgroundColor: getEventColor(type),
                color: 'white',
                '& .MuiChip-label': { fontWeight: 500 }
              }}
              size="small"
            />
          ))}
          
          {Object.keys(eventCounts).length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary">
              No events in this time period
            </Typography>
          )}
        </Box>
        
        {/* Timeline container */}
        <Paper 
          elevation={1} 
          sx={{ 
            position: 'relative', 
            height: 150, 
            mb: 1, 
            overflow: 'hidden',
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              {/* Heat map background */}
              <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.15 }}>
                {generateHeatMap().map((segment, index) => (
                  <Box
                    key={index}
                    sx={{
                      position: 'absolute',
                      left: `${segment.position}%`,
                      width: `${segment.width}%`,
                      height: '100%',
                      bgcolor: 'primary.main',
                      opacity: segment.intensity,
                    }}
                  />
                ))}
              </Box>
              
              {/* Time markers */}
              <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                {generateTimeMarkers().map((marker, index) => (
                  <Box key={index} sx={{ position: 'absolute', left: `${marker.position}%`, height: '100%' }}>
                    <Box sx={{ 
                      width: 1, 
                      height: '100%', 
                      bgcolor: 'divider', 
                      opacity: 0.5 
                    }} />
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        position: 'absolute',
                        bottom: 4,
                        left: -20,
                        width: 40,
                        textAlign: 'center', 
                        color: 'text.secondary',
                        fontSize: '0.65rem'
                      }}
                    >
                      {marker.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              
              {/* Events markers */}
              <Box
                ref={timelineRef}
                sx={{
                  position: 'relative',
                  width: `${zoomLevel}%`,
                  height: '80%',
                  transform: zoomLevel > 100 ? `translateX(-${(zoomLevel - 100) / 2}%)` : 'none',
                  transition: 'transform 0.3s ease-out',
                }}
              >
                {filteredEvents.map((event) => {
                  const position = getEventPosition(event.timestamp);
                  return (
                    <Tooltip 
                      key={event.id} 
                      title={`${format(new Date(event.timestamp), 'HH:mm:ss')} - ${EVENT_TYPES[event.type]?.label || event.type}`}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: `${position}%`,
                          top: '30%',
                          width: 8,
                          height: 40,
                          bgcolor: getEventColor(event.type),
                          borderRadius: 1,
                          transform: 'translateX(-50%)',
                          cursor: 'pointer',
                          '&:hover': {
                            height: 50,
                            width: 10,
                            top: '25%',
                            zIndex: 10
                          }
                        }}
                        onClick={() => onEventClick(event)}
                        onMouseEnter={(e) => handleEventHover(e, event)}
                        onMouseLeave={() => setHoveredEvent(null)}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </>
          )}
        </Paper>
        
        {/* Timeline controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {filteredEvents.length} events shown
          </Typography>
          
          <Box>
            <IconButton size="small" onClick={() => setCurrentDate(startDate)}>
              <SkipPrevious fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => navigateTimeline('prev')}>
              <NavigateBefore fontSize="small" />
            </IconButton>
            <Button size="small">Today</Button>
            <IconButton size="small" onClick={() => navigateTimeline('next')}>
              <NavigateNext fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setCurrentDate(endDate)}>
              <SkipNext fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
      
      {/* Event details popover */}
      <Popover
        open={Boolean(hoveredEvent) && Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={() => setHoveredEvent(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        sx={{ pointerEvents: 'none' }}
      >
        {hoveredEvent && (
          <Box sx={{ p: 2, maxWidth: 300 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box 
                sx={{ 
                  width: 12, 
                  height: 12, 
                  bgcolor: getEventColor(hoveredEvent.type),
                  borderRadius: '50%',
                  mr: 1
                }} 
              />
              <Typography variant="subtitle2">
                {EVENT_TYPES[hoveredEvent.type]?.label || hoveredEvent.type}
              </Typography>
            </Box>
            
            <Grid container spacing={1} sx={{ mb: 1 }}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Time:
                </Typography>
                <Typography variant="body2">
                  {format(new Date(hoveredEvent.timestamp), 'HH:mm:ss')}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Confidence:
                </Typography>
                <Typography variant="body2">
                  {hoveredEvent.confidence}%
                </Typography>
              </Grid>
            </Grid>
            
            {hoveredEvent.camera && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Camera:
                </Typography>
                <Typography variant="body2">
                  {hoveredEvent.camera.name}
                </Typography>
              </Box>
            )}
            
            {hoveredEvent.thumbnailPath && (
              <Box 
                component="img" 
                src={hoveredEvent.thumbnailPath} 
                alt="Event thumbnail"
                sx={{ 
                  width: '100%', 
                  height: 100, 
                  objectFit: 'cover',
                  borderRadius: 1
                }}
              />
            )}
          </Box>
        )}
      </Popover>
    </Card>
  );
};

export default EventTimeline;