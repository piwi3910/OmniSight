import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tooltip,
  Chip,
  CircularProgress,
  useTheme,
  alpha,
  Slider,
  Button,
  IconButton,
  Popover,
  Zoom
} from '@mui/material';
import {
  Today as TodayIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Event as EventIcon,
  Person as PersonIcon,
  DirectionsCar as DirectionsCarIcon,
  Pets as PetsIcon,
  NotificationsActive as NotificationsActiveIcon,
  FilterList as FilterListIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { format, addDays, subDays, startOfDay, endOfDay, isSameDay, differenceInDays, addHours, parseISO } from 'date-fns';

interface EventTimelineProps {
  events: any[];
  onEventClick: (event: any) => void;
  onRangeChange?: (startDate: Date, endDate: Date) => void;
  onFilter?: (filterType: string, value: string) => void;
  loading?: boolean;
}

interface EventGroup {
  date: Date;
  events: any[];
  typeCount: {
    person: number;
    vehicle: number;
    animal: number;
    motion: number;
    [key: string]: number;
  };
}

const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  onEventClick,
  onRangeChange,
  onFilter,
  loading = false
}) => {
  const theme = useTheme();
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // State
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 7),
    end: new Date()
  });
  const [zoomLevel, setZoomLevel] = useState<'day' | 'hour'>('day');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ event: any; position: { top: number; left: number } } | null>(null);
  const [groupedEvents, setGroupedEvents] = useState<EventGroup[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [startAnchorEl, setStartAnchorEl] = useState<HTMLElement | null>(null);
  const [endAnchorEl, setEndAnchorEl] = useState<HTMLElement | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });
  
  // Process events into grouped format by date
  useEffect(() => {
    if (!events.length) {
      setGroupedEvents([]);
      return;
    }
    
    const groupByDate = new Map<string, EventGroup>();
    
    events.forEach(event => {
      const eventDate = new Date(event.timestamp);
      const dateKey = format(eventDate, 'yyyy-MM-dd');
      
      if (!groupByDate.has(dateKey)) {
        groupByDate.set(dateKey, {
          date: startOfDay(eventDate),
          events: [],
          typeCount: {
            person: 0,
            vehicle: 0,
            animal: 0,
            motion: 0
          }
        });
      }
      
      const group = groupByDate.get(dateKey)!;
      group.events.push(event);
      
      // Count by type
      if (event.type in group.typeCount) {
        group.typeCount[event.type]++;
      } else {
        group.typeCount[event.type] = 1;
      }
    });
    
    // Sort groups by date
    const sorted = Array.from(groupByDate.values()).sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );
    
    setGroupedEvents(sorted);
    
    // Update visible range if needed
    if (sorted.length > 0) {
      const oldestEvent = sorted[0].date;
      const newestEvent = sorted[sorted.length - 1].date;
      
      // If current range doesn't include events, adjust it
      if (visibleRange.start > oldestEvent || visibleRange.end < newestEvent) {
        setVisibleRange({
          start: subDays(oldestEvent, 1),
          end: addDays(newestEvent, 1)
        });
      }
    }
  }, [events]);
  
  // Calculate timeline items based on grouped events and visible range
  const getTimelineItems = () => {
    if (zoomLevel === 'day') {
      // Day-level grouping (already done)
      return groupedEvents.filter(group => 
        group.date >= visibleRange.start && group.date <= visibleRange.end
      );
    } else {
      // Hour-level grouping
      const hourlyGroups: EventGroup[] = [];
      
      groupedEvents.forEach(dayGroup => {
        if (dayGroup.date >= visibleRange.start && dayGroup.date <= visibleRange.end) {
          // Group by hour within the day
          const hourMap = new Map<number, EventGroup>();
          
          dayGroup.events.forEach(event => {
            const eventDate = new Date(event.timestamp);
            const hour = eventDate.getHours();
            
            if (!hourMap.has(hour)) {
              hourMap.set(hour, {
                date: new Date(dayGroup.date.getFullYear(), dayGroup.date.getMonth(), dayGroup.date.getDate(), hour),
                events: [],
                typeCount: {
                  person: 0,
                  vehicle: 0,
                  animal: 0,
                  motion: 0
                }
              });
            }
            
            const hourGroup = hourMap.get(hour)!;
            hourGroup.events.push(event);
            
            // Count by type
            if (event.type in hourGroup.typeCount) {
              hourGroup.typeCount[event.type]++;
            } else {
              hourGroup.typeCount[event.type] = 1;
            }
          });
          
          // Add hourly groups to result
          hourlyGroups.push(...Array.from(hourMap.values()));
        }
      });
      
      return hourlyGroups.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
  };
  
  // Zoom in/out
  const handleZoomIn = () => {
    if (zoomLevel === 'day') {
      setZoomLevel('hour');
    } else {
      // Already at max zoom
      const rangeMiddle = new Date((visibleRange.start.getTime() + visibleRange.end.getTime()) / 2);
      const newStart = subDays(rangeMiddle, 1);
      const newEnd = addDays(rangeMiddle, 1);
      setVisibleRange({ start: newStart, end: newEnd });
    }
  };
  
  const handleZoomOut = () => {
    if (zoomLevel === 'hour') {
      setZoomLevel('day');
    } else {
      // Widen day view
      const rangeMiddle = new Date((visibleRange.start.getTime() + visibleRange.end.getTime()) / 2);
      const currentDays = differenceInDays(visibleRange.end, visibleRange.start);
      const newStart = subDays(rangeMiddle, currentDays);
      const newEnd = addDays(rangeMiddle, currentDays);
      setVisibleRange({ start: newStart, end: newEnd });
    }
  };
  
  // Navigation
  const handleNavigatePrevious = () => {
    const daysDiff = differenceInDays(visibleRange.end, visibleRange.start);
    setVisibleRange({
      start: subDays(visibleRange.start, daysDiff),
      end: subDays(visibleRange.end, daysDiff)
    });
  };
  
  const handleNavigateNext = () => {
    const daysDiff = differenceInDays(visibleRange.end, visibleRange.start);
    setVisibleRange({
      start: addDays(visibleRange.start, daysDiff),
      end: addDays(visibleRange.end, daysDiff)
    });
  };
  
  const handleNavigateToday = () => {
    const today = new Date();
    const daysDiff = differenceInDays(visibleRange.end, visibleRange.start);
    setVisibleRange({
      start: subDays(today, Math.floor(daysDiff / 2)),
      end: addDays(today, Math.ceil(daysDiff / 2))
    });
  };
  
  // Handle event hover
  const handleEventHover = (event: any, mouseEvent: React.MouseEvent) => {
    const rect = mouseEvent.currentTarget.getBoundingClientRect();
    setHoverInfo({
      event,
      position: {
        top: rect.top - 5,
        left: rect.left + rect.width / 2
      }
    });
  };
  
  const handleEventHoverEnd = () => {
    setHoverInfo(null);
  };
  
  // Handle date selection
  const handleDateClick = (date: Date, index: number) => {
    if (!selectionRange.start) {
      // Start new selection
      setSelectionRange({ start: date, end: null });
      setStartAnchorEl(document.getElementById(`timeline-item-${index}`));
    } else if (!selectionRange.end) {
      // Complete selection
      let start = selectionRange.start;
      let end = date;
      
      // Ensure start is before end
      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }
      
      setSelectionRange({ start, end });
      setEndAnchorEl(document.getElementById(`timeline-item-${index}`));
      
      // Notify parent of range change
      if (onRangeChange) {
        onRangeChange(startOfDay(start), endOfDay(end));
      }
      
      // Reset selection after a moment
      setTimeout(() => {
        setSelectionRange({ start: null, end: null });
        setStartAnchorEl(null);
        setEndAnchorEl(null);
      }, 2000);
    }
  };
  
  // Handle event type filter
  const handleEventTypeFilter = (type: string) => {
    setSelectedEventType(selectedEventType === type ? null : type);
    
    if (onFilter) {
      onFilter('eventType', selectedEventType === type ? 'all' : type);
    }
  };
  
  // Export timeline data
  const handleExportData = () => {
    const timelineData = getTimelineItems();
    if (!timelineData || timelineData.length === 0) return;
    
    const exportData = {
      timelineRange: {
        start: visibleRange.start.toISOString(),
        end: visibleRange.end.toISOString()
      },
      zoomLevel,
      eventGroups: timelineData.map(group => ({
        date: group.date.toISOString(),
        eventCount: group.events.length,
        typeDistribution: group.typeCount
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-timeline-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Get event type icon component
  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <PersonIcon fontSize="small" />;
      case 'vehicle':
        return <DirectionsCarIcon fontSize="small" />;
      case 'animal':
        return <PetsIcon fontSize="small" />;
      case 'motion':
      default:
        return <NotificationsActiveIcon fontSize="small" />;
    }
  };
  
  // Get color for event type
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'person':
        return theme.palette.primary.main;
      case 'vehicle':
        return theme.palette.secondary.main;
      case 'animal':
        return theme.palette.success.main;
      case 'motion':
      default:
        return theme.palette.warning.main;
    }
  };
  
  // Format the date label based on zoom level
  const formatDateLabel = (date: Date) => {
    if (zoomLevel === 'day') {
      return format(date, 'MMM d');
    } else {
      return format(date, 'h a');
    }
  };
  
  // Timeline items
  const timelineItems = getTimelineItems() || [];
  
  return (
    <Paper 
      sx={{ 
        p: 2, 
        bgcolor: 'background.default', 
        borderRadius: 1,
        boxShadow: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Event Timeline</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={handleNavigatePrevious} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Button 
            size="small" 
            startIcon={<TodayIcon />} 
            onClick={handleNavigateToday}
            sx={{ mx: 1 }}
          >
            Today
          </Button>
          <IconButton onClick={handleNavigateNext} size="small">
            <ArrowForwardIcon />
          </IconButton>
          <IconButton onClick={handleZoomOut} size="small" sx={{ ml: 2 }}>
            <ZoomOutIcon />
          </IconButton>
          <IconButton onClick={handleZoomIn} size="small">
            <ZoomInIcon />
          </IconButton>
          <IconButton onClick={handleExportData} size="small" title="Export Timeline Data">
            <DownloadIcon />
          </IconButton>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ mr: 2 }}>
          Filter by event type:
        </Typography>
        {['person', 'vehicle', 'animal', 'motion'].map(type => (
          <Chip
            key={type}
            icon={getEventTypeIcon(type)}
            label={type.charAt(0).toUpperCase() + type.slice(1)}
            onClick={() => handleEventTypeFilter(type)}
            color={selectedEventType === type ? 'primary' : 'default'}
            sx={{ mr: 1, mb: 1 }}
          />
        ))}
      </Box>
      
      <Box 
        sx={{ 
          display: 'flex', 
          overflowX: 'auto', 
          pb: 1,
          alignItems: 'flex-end',
          position: 'relative'
        }}
        ref={timelineRef}
      >
        {loading && (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.paper, 0.7),
            zIndex: 1
          }}>
            <CircularProgress size={40} />
          </Box>
        )}
        
        {timelineItems.length === 0 ? (
          <Box sx={{ 
            py: 5, 
            width: '100%', 
            textAlign: 'center',
            opacity: loading ? 0.5 : 1
          }}>
            <EventIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
            <Typography color="text.secondary">
              No events in the selected time range
            </Typography>
          </Box>
        ) : (
          timelineItems.map((group, index) => {
            // Find maximum count for scaling
            const maxCount = Math.max(
              group.typeCount.person || 0,
              group.typeCount.vehicle || 0,
              group.typeCount.animal || 0,
              group.typeCount.motion || 0
            );
            
            // Check if this date is within selection range
            const inSelectionRange = selectionRange.start && 
              (!selectionRange.end || selectionRange.end >= group.date) && 
              selectionRange.start <= group.date;
            
            return (
              <Box
                id={`timeline-item-${index}`}
                key={group.date.toISOString()}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: zoomLevel === 'day' ? 70 : 50,
                  mx: 1,
                  cursor: 'pointer',
                  opacity: selectedEventType ? 0.7 : 1,
                  bgcolor: inSelectionRange ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                  borderRadius: 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.05)
                  }
                }}
                onClick={() => handleDateClick(group.date, index)}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    mb: 1,
                    fontWeight: isSameDay(group.date, new Date()) ? 'bold' : 'normal'
                  }}
                >
                  {formatDateLabel(group.date)}
                </Typography>
                
                <Box sx={{ height: 100, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  {Object.entries(group.typeCount).map(([type, count]) => {
                    if (count === 0 || (selectedEventType !== null && selectedEventType !== type)) return null;
                    
                    const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    
                    return (
                      <Tooltip 
                        key={type} 
                        title={`${count} ${type} event${count !== 1 ? 's' : ''}`}
                        arrow
                      >
                        <Box
                          sx={{
                            height: `${Math.max(10, height)}%`,
                            bgcolor: getEventTypeColor(type),
                            flex: 1,
                            mx: 0.5,
                            borderTopLeftRadius: 2,
                            borderTopRightRadius: 2,
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onMouseEnter={(e) => {
                            const firstEvent = group.events.find(event => event.type === type);
                            if (firstEvent) {
                              handleEventHover(firstEvent, e);
                            }
                          }}
                          onMouseLeave={handleEventHoverEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            const firstEvent = group.events.find(event => event.type === type);
                            if (firstEvent && onEventClick) {
                              onEventClick(firstEvent);
                            }
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
                
                <Typography variant="caption" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                  {group.events.length} event{group.events.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            );
          })
        )}
      </Box>
      
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {`Showing events from ${format(visibleRange.start, 'PPP')} to ${format(visibleRange.end, 'PPP')}`}
        </Typography>
      </Box>
      
      {/* Popovers for date range selection */}
      <Popover
        open={!!startAnchorEl}
        anchorEl={startAnchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 1, bgcolor: theme.palette.primary.main, color: 'white' }}>
          <Typography variant="caption">
            Start: {selectionRange.start ? format(selectionRange.start, 'PPP') : ''}
          </Typography>
        </Box>
      </Popover>
      
      <Popover
        open={!!endAnchorEl}
        anchorEl={endAnchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 1, bgcolor: theme.palette.primary.main, color: 'white' }}>
          <Typography variant="caption">
            End: {selectionRange.end ? format(selectionRange.end, 'PPP') : ''}
          </Typography>
        </Box>
      </Popover>
      
      {/* Event hover popover */}
      <Zoom in={!!hoverInfo}>
        <Paper
          sx={{
            position: 'fixed',
            top: hoverInfo?.position.top ? hoverInfo.position.top - 120 : 0,
            left: hoverInfo?.position.left ? hoverInfo.position.left - 100 : 0,
            p: 1,
            maxWidth: 200,
            boxShadow: 3,
            visibility: hoverInfo ? 'visible' : 'hidden',
            zIndex: 1500,
          }}
        >
          {hoverInfo?.event && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                {getEventTypeIcon(hoverInfo.event.type)}
                <Typography variant="subtitle2" sx={{ ml: 0.5 }}>
                  {hoverInfo.event.type.charAt(0).toUpperCase() + hoverInfo.event.type.slice(1)}
                </Typography>
              </Box>
              <Typography variant="caption" display="block">
                Camera: {hoverInfo.event.cameraName}
              </Typography>
              <Typography variant="caption" display="block">
                Time: {format(parseISO(hoverInfo.event.timestamp), 'PPp')}
              </Typography>
              <Typography variant="caption" display="block">
                Confidence: {Math.round(hoverInfo.event.confidence * 100)}%
              </Typography>
            </Box>
          )}
        </Paper>
      </Zoom>
    </Paper>
  );
};

export default EventTimeline;