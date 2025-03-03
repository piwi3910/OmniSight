import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Slider,
  Typography,
  Paper,
  Tooltip,
  CircularProgress,
  Popover,
  Fade
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { format } from 'date-fns';

// Custom styled slider with markers for events
const TimelineSlider = styled(Slider)(({ theme }) => ({
  color: theme.palette.primary.main,
  height: 8,
  '& .MuiSlider-thumb': {
    height: 14,
    width: 14,
    backgroundColor: '#fff',
    border: '2px solid currentColor',
    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
      boxShadow: 'inherit',
    },
  },
  '& .MuiSlider-rail': {
    opacity: 0.5,
    backgroundColor: theme.palette.grey[500],
  },
}));

// Event marker component
const EventMarker = styled('div')(({ theme }) => ({
  position: 'absolute',
  width: 4,
  height: 16,
  backgroundColor: theme.palette.error.main,
  borderRadius: 1,
  top: -4,
  transform: 'translateX(-50%)',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.error.dark,
    height: 20,
    top: -6,
  },
}));

// Segment marker component
const SegmentMarker = styled('div')(({ theme }) => ({
  position: 'absolute',
  width: 2,
  height: 12,
  backgroundColor: theme.palette.grey[300],
  borderRadius: 1,
  top: -2,
  transform: 'translateX(-50%)',
  cursor: 'pointer',
}));

// Thumbnail preview component
const ThumbnailPreview = styled(Paper)(({ theme }) => ({
  padding: 2,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[3],
  maxWidth: 200,
}));

interface AdvancedVideoTimelineProps {
  currentTime: number;
  duration: number;
  segments: any[];
  events: any[];
  thumbnails?: Record<string, string>; // Map of time -> thumbnail url
  loading?: boolean;
  onSeek: (time: number) => void;
  onJumpToEvent?: (event: any) => void;
  onJumpToSegment?: (segment: any) => void;
  recordingStartTime?: string; // ISO timestamp of recording start
}

const AdvancedVideoTimeline: React.FC<AdvancedVideoTimelineProps> = ({
  currentTime,
  duration,
  segments,
  events,
  thumbnails = {},
  loading = false,
  onSeek,
  onJumpToEvent,
  onJumpToSegment,
  recordingStartTime
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = normal, > 1 = zoomed in
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, duration]);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ left: number; top: number } | null>(null);
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Update visible range when duration or zoom changes
  useEffect(() => {
    if (duration > 0) {
      const halfWindow = (duration / zoomLevel) / 2;
      // Center the visible range around current playback position
      const center = Math.min(Math.max(currentTime, halfWindow), duration - halfWindow);
      setVisibleRange([
        Math.max(0, center - halfWindow),
        Math.min(duration, center + halfWindow)
      ]);
    } else {
      setVisibleRange([0, 0]);
    }
  }, [duration, zoomLevel, currentTime]);

  // Format time in HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    } else {
      return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
  };

  // Format absolute time (if recording start time is available)
  const formatAbsoluteTime = (seconds: number): string => {
    if (!recordingStartTime) return formatTime(seconds);

    try {
      const startTime = new Date(recordingStartTime);
      const absoluteTime = new Date(startTime.getTime() + seconds * 1000);
      return format(absoluteTime, 'HH:mm:ss');
    } catch (e) {
      return formatTime(seconds);
    }
  };

  // Handle timeline seek
  const handleSeek = (_: Event, newValue: number | number[]) => {
    if (typeof newValue === 'number') {
      onSeek(newValue);
    }
  };

  // Handle mouse move on timeline for preview
  const handleTimelineMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, offsetX / rect.width));
    
    const time = visibleRange[0] + (visibleRange[1] - visibleRange[0]) * percent;
    setPreviewTime(time);
    setPreviewPosition({ left: event.clientX, top: rect.top });
    setPreviewVisible(true);
  };

  // Handle mouse leave
  const handleTimelineMouseLeave = () => {
    setPreviewVisible(false);
  };
  
  // Handle timeline click
  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, offsetX / rect.width));
    
    const time = visibleRange[0] + (visibleRange[1] - visibleRange[0]) * percent;
    onSeek(time);
  };

  // Find closest thumbnail for preview
  const getPreviewThumbnail = (time: number): string | null => {
    if (!thumbnails || Object.keys(thumbnails).length === 0) return null;
    
    const times = Object.keys(thumbnails).map(Number);
    if (times.length === 0) return null;
    
    // Find closest time
    const closestTime = times.reduce((prev, curr) => 
      Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev
    );
    
    return thumbnails[closestTime.toString()];
  };

  // Find events or segments within the visible range
  const visibleEvents = events.filter(event => {
    const eventTime = new Date(event.timestamp).getTime();
    const recordingStart = recordingStartTime ? new Date(recordingStartTime).getTime() : 0;
    const relativeEventTime = (eventTime - recordingStart) / 1000;
    return relativeEventTime >= visibleRange[0] && relativeEventTime <= visibleRange[1];
  });

  // Calculate positions for event markers
  const getEventPosition = (event: any): number => {
    const eventTime = new Date(event.timestamp).getTime();
    const recordingStart = recordingStartTime ? new Date(recordingStartTime).getTime() : 0;
    const relativeEventTime = (eventTime - recordingStart) / 1000;
    
    // Calculate percentage position within visible range
    return ((relativeEventTime - visibleRange[0]) / (visibleRange[1] - visibleRange[0])) * 100;
  };

  // Calculate positions for segment markers
  const getSegmentPositions = (): number[] => {
    if (!segments || segments.length <= 1) return [];
    
    return segments.slice(1).map(segment => {
      const segmentStart = new Date(segment.startTime).getTime();
      const recordingStart = recordingStartTime ? new Date(recordingStartTime).getTime() : 0;
      const relativeSegmentStart = (segmentStart - recordingStart) / 1000;
      
      // Only return positions within visible range
      if (relativeSegmentStart >= visibleRange[0] && relativeSegmentStart <= visibleRange[1]) {
        return ((relativeSegmentStart - visibleRange[0]) / (visibleRange[1] - visibleRange[0])) * 100;
      }
      return -1;
    }).filter(pos => pos >= 0);
  };

  // Handle zoom in/out with mouse wheel
  const handleWheel = (event: React.WheelEvent) => {
    if (duration <= 0) return;
    
    event.preventDefault();
    
    // Change zoom level based on wheel direction
    const newZoom = Math.max(1, Math.min(10, zoomLevel + (event.deltaY < 0 ? 0.5 : -0.5)));
    setZoomLevel(newZoom);
  };

  // Handle click on event marker
  const handleEventClick = (event: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJumpToEvent) {
      onJumpToEvent(event);
    }
  };

  // Render the preview thumbnail
  const renderThumbnail = () => {
    if (!previewVisible || previewTime === null || !previewPosition) return null;
    
    const thumbnail = getPreviewThumbnail(previewTime);
    
    return (
      <Fade in={previewVisible}>
        <ThumbnailPreview
          style={{
            position: 'absolute',
            left: Math.min(Math.max(0, previewPosition.left - 100), window.innerWidth - 200),
            top: previewPosition.top - 120,
          }}
        >
          {thumbnail ? (
            <Box>
              <img 
                src={thumbnail} 
                alt="Preview" 
                style={{ width: '100%', maxHeight: 100, objectFit: 'contain' }} 
              />
              <Typography variant="caption" sx={{ color: 'white', display: 'block', textAlign: 'center', mt: 0.5 }}>
                {formatAbsoluteTime(previewTime)}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'white' }}>
                {formatAbsoluteTime(previewTime)}
              </Typography>
            </Box>
          )}
        </ThumbnailPreview>
      </Fade>
    );
  };

  const segmentPositions = getSegmentPositions();

  return (
    <Box sx={{ position: 'relative', mt: 3, mb: 1 }}>
      {/* Current time display */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {formatAbsoluteTime(visibleRange[0])}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight="bold">
          {formatAbsoluteTime(currentTime)} / {formatAbsoluteTime(duration)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatAbsoluteTime(visibleRange[1])}
        </Typography>
      </Box>
      
      {/* Timeline with events */}
      <Box 
        ref={timelineRef}
        sx={{ 
          position: 'relative', 
          height: 30, 
          cursor: 'pointer',
          '&:hover': {
            '& .MuiSlider-thumb': {
              height: 16,
              width: 16,
            }
          }
        }}
        onMouseMove={handleTimelineMouseMove}
        onMouseLeave={handleTimelineMouseLeave}
        onClick={handleTimelineClick}
        onWheel={handleWheel}
      >
        {/* Loading spinner */}
        {loading && (
          <Box sx={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}>
            <CircularProgress size={16} />
          </Box>
        )}
        
        {/* Slider for timeline */}
        <TimelineSlider
          value={currentTime}
          min={visibleRange[0]}
          max={visibleRange[1]}
          onChange={handleSeek}
          disabled={duration <= 0}
          sx={{ position: 'absolute', width: '100%', top: 8 }}
        />
        
        {/* Event markers */}
        {visibleEvents.map((event, index) => (
          <Tooltip
            key={`event-${event.id || index}`}
            title={
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  {event.type}
                </Typography>
                <Typography variant="caption" display="block">
                  {format(new Date(event.timestamp), 'HH:mm:ss')}
                </Typography>
                {event.metadata && (
                  <Typography variant="caption" display="block">
                    {Object.entries(event.metadata)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(', ')}
                  </Typography>
                )}
              </Box>
            }
          >
            <EventMarker 
              style={{ left: `${getEventPosition(event)}%` }}
              onClick={(e) => handleEventClick(event, e)}
            />
          </Tooltip>
        ))}
        
        {/* Segment markers */}
        {segmentPositions.map((position, index) => (
          <SegmentMarker
            key={`segment-${index}`}
            style={{ left: `${position}%` }}
            onClick={(e) => {
              e.stopPropagation();
              if (onJumpToSegment && segments[index + 1]) {
                onJumpToSegment(segments[index + 1]);
              }
            }}
          />
        ))}
      </Box>
      
      {/* Zoom level indicator */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {zoomLevel > 1 ? `${zoomLevel.toFixed(1)}x zoom` : 'Full timeline'}
        </Typography>
      </Box>
      
      {/* Thumbnail preview */}
      {renderThumbnail()}
    </Box>
  );
};

export default AdvancedVideoTimeline;