import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  IconButton,
  CircularProgress,
  Slider,
  Tooltip,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Menu,
  MenuItem,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Fullscreen as FullscreenIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  ArrowBack as ArrowBackIcon,
  Screenshot as ScreenshotIcon,
  Download as DownloadIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPreviousIcon,
  Videocam as VideocamIcon,
  Event as EventIcon,
  Person as PersonIcon,
  DirectionsCar as CarIcon,
  MoreVert as MoreVertIcon,
  Speed as SpeedIcon,
  ZoomIn as ZoomInIcon,
  Timeline as TimelineIcon,
  Movie as MovieIcon,
  Share as ShareIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import AdvancedVideoTimeline from '../components/AdvancedVideoTimeline';
import ExportVideoDialog from '../components/ExportVideoDialog';

const RecordingPlayer: React.FC = () => {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [currentSegment, setCurrentSegment] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Advanced state
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [speedMenuAnchorEl, setSpeedMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [segmentLoading, setSegmentLoading] = useState<boolean>(false);
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const [moreMenuAnchorEl, setMoreMenuAnchorEl] = useState<null | HTMLElement>(null);
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  
  // Fetch recording details
  useEffect(() => {
    const fetchRecording = async () => {
      if (!token || !recordingId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get recording details
        const recordingResponse = await axios.get(`${API_URL}/recordings/${recordingId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setRecording(recordingResponse.data);
        
        // Get segments
        const segmentsResponse = await axios.get(`${API_URL}/recordings/${recordingId}/segments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setSegments(segmentsResponse.data.segments || []);
        
        if (segmentsResponse.data.segments && segmentsResponse.data.segments.length > 0) {
          setCurrentSegment(segmentsResponse.data.segments[0]);
        }
        
        // Get events
        const eventsResponse = await axios.get(`${API_URL}/recordings/${recordingId}/events`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setEvents(eventsResponse.data.events || []);
        
        // Get thumbnails
        const thumbnailsResponse = await axios.get(`${API_URL}/recordings/${recordingId}/thumbnails`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setThumbnails(thumbnailsResponse.data.thumbnails || {});
      } catch (error) {
        console.error('Error fetching recording details:', error);
        setError('Failed to load recording. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecording();
  }, [recordingId, token, API_URL]);
  
  // Handle video playback
  useEffect(() => {
    if (videoRef.current && currentSegment) {
      if (isPlaying) {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Failed to play video. Please try again.');
        });
      } else {
        videoRef.current.pause();
      }
      
      // Set playback speed
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [isPlaying, currentSegment, playbackSpeed]);
  
  // Handle volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);
  
  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Update progress
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setProgress(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };
  
  // Seek to position
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setProgress(time);
    }
  };
  
  // Format time
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Take screenshot
  const takeScreenshot = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Create download link
    const link = document.createElement('a');
    link.download = `screenshot-${recording?.camera?.name || 'recording'}-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  // Download segment
  const downloadSegment = async () => {
    if (!currentSegment || !token) return;
    
    try {
      const response = await axios.get(`${API_URL}/segments/${currentSegment.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `recording-${recording?.camera?.name || 'segment'}-${new Date().toISOString()}.mp4`;
      link.click();
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading segment:', error);
      setError('Failed to download segment. Please try again.');
    }
  };
  
  // Navigate to next/previous segment
  const navigateSegment = (direction: 'next' | 'prev') => {
    if (!currentSegment || segments.length <= 1) return;
    
    setSegmentLoading(true);
    
    const currentIndex = segments.findIndex(segment => segment.id === currentSegment.id);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % segments.length;
    } else {
      newIndex = (currentIndex - 1 + segments.length) % segments.length;
    }
    
    setCurrentSegment(segments[newIndex]);
    setProgress(0); // Reset progress for new segment
    
    // Reset segment loading state when video loads
    const handleLoaded = () => {
      setSegmentLoading(false);
      videoRef.current?.removeEventListener('loadeddata', handleLoaded);
    };
    videoRef.current?.addEventListener('loadeddata', handleLoaded);
  };
  
  // Jump to event
  const jumpToEvent = (event: any) => {
    if (!segments || segments.length === 0) return;
    
    // Find segment containing this event
    const eventTime = new Date(event.timestamp).getTime();
    const segment = segments.find(seg => {
      const startTime = new Date(seg.startTime).getTime();
      const endTime = new Date(seg.endTime).getTime();
      return eventTime >= startTime && eventTime <= endTime;
    });
    
    if (segment) {
      // If different segment, load it
      if (segment.id !== currentSegment?.id) {
        setSegmentLoading(true);
        setCurrentSegment(segment);
      }
      
      // Calculate time offset within segment
      const segmentStartTime = new Date(segment.startTime).getTime();
      const eventOffset = (eventTime - segmentStartTime) / 1000; // in seconds
      
      // Set video time after video loads
      const setVideoTime = () => {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, eventOffset - 2); // 2 seconds before event
          setIsPlaying(true);
          setSegmentLoading(false);
        }
      };
      
      if (videoRef.current && videoRef.current.readyState >= 2) {
        setVideoTime();
      } else {
        const handleLoaded = () => {
          setVideoTime();
          videoRef.current?.removeEventListener('loadeddata', handleLoaded);
        };
        videoRef.current?.addEventListener('loadeddata', handleLoaded);
      }
    }
  };
  
  // Get event icon
  const getEventIcon = (eventType: string) => {
    switch (eventType.toLowerCase()) {
      case 'person':
        return <PersonIcon />;
      case 'vehicle':
      case 'car':
        return <CarIcon />;
      default:
        return <EventIcon />;
    }
  };
  
  // Handle speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    setSpeedMenuAnchorEl(null);
  };
  
  // Open speed menu
  const handleSpeedMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSpeedMenuAnchorEl(event.currentTarget);
  };
  
  // Close speed menu
  const handleSpeedMenuClose = () => {
    setSpeedMenuAnchorEl(null);
  };
  
  // Handle more menu
  const handleMoreMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMoreMenuAnchorEl(event.currentTarget);
  };
  
  const handleMoreMenuClose = () => {
    setMoreMenuAnchorEl(null);
  };
  
  // Show export dialog
  const handleExportClick = () => {
    handleMoreMenuClose();
    setShowExportDialog(true);
  };
  
  // Handle export dialog close
  const handleExportDialogClose = () => {
    setShowExportDialog(false);
  };
  
  // Handle jump to segment
  const handleJumpToSegment = (segment: any) => {
    if (!segment || segment.id === currentSegment?.id) return;
    
    setSegmentLoading(true);
    setCurrentSegment(segment);
    setProgress(0); // Reset progress for new segment
  };
  
  // Calculate total recording duration
  const getTotalDuration = () => {
    return segments.reduce((total, segment) => total + (segment.duration || 0), 0);
  };
  
  // Calculate current global position
  const getCurrentGlobalPosition = () => {
    if (!currentSegment) return 0;
    
    // Sum durations of all previous segments
    const prevSegmentsDuration = segments
      .slice(0, segments.findIndex(s => s.id === currentSegment.id))
      .reduce((total, segment) => total + (segment.duration || 0), 0);
    
    // Add current progress in current segment
    return prevSegmentsDuration + progress;
  };
  
  if (loading && !recording) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ flexGrow: 1, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/recordings')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {recording?.camera?.name ? `${recording.camera.name} - Recording` : 'Recording Playback'}
        </Typography>
        <Chip 
          label={`${playbackSpeed}x`} 
          color="primary" 
          size="small" 
          icon={<SpeedIcon />}
          onClick={handleSpeedMenuOpen}
          sx={{ mr: 1 }}
        />
        <IconButton onClick={handleMoreMenuOpen}>
          <MoreVertIcon />
        </IconButton>
        
        {/* Speed menu */}
        <Menu
          anchorEl={speedMenuAnchorEl}
          open={Boolean(speedMenuAnchorEl)}
          onClose={handleSpeedMenuClose}
        >
          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
            <MenuItem 
              key={speed} 
              onClick={() => handleSpeedChange(speed)}
              selected={playbackSpeed === speed}
            >
              {speed}x {speed === 1 && '(Normal)'}
            </MenuItem>
          ))}
        </Menu>
        
        {/* More options menu */}
        <Menu
          anchorEl={moreMenuAnchorEl}
          open={Boolean(moreMenuAnchorEl)}
          onClose={handleMoreMenuClose}
        >
          <MenuItem onClick={takeScreenshot}>
            <ListItemIcon>
              <ScreenshotIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Take Screenshot</ListItemText>
          </MenuItem>
          <MenuItem onClick={downloadSegment}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download Current Segment</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleExportClick}>
            <ListItemIcon>
              <MovieIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export Custom Video</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => navigate(`/cameras/${recording?.camera?.id}`)}>
            <ListItemIcon>
              <VideocamIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Camera</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
      
      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
          <Typography color="error.dark">{error}</Typography>
        </Box>
      )}
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={9}>
          <Paper 
            ref={containerRef} 
            sx={{ 
              position: 'relative', 
              width: '100%', 
              bgcolor: 'black',
              borderRadius: 1,
              overflow: 'hidden'
            }}
          >
            {(loading || segmentLoading) && (
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  zIndex: 1,
                  bgcolor: 'rgba(0,0,0,0.5)'
                }}
              >
                <CircularProgress color="primary" />
              </Box>
            )}
            
            {currentSegment?.url ? (
              <video 
                ref={videoRef}
                style={{ width: '100%', display: 'block' }}
                autoPlay
                playsInline
                muted={isMuted}
                src={currentSegment.url}
                onTimeUpdate={handleTimeUpdate}
                onError={() => setError('Error loading video')}
              />
            ) : (
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: '400px',
                  color: 'white'
                }}
              >
                <VideocamIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" sx={{ opacity: 0.7 }}>
                  {error || 'Recording not available'}
                </Typography>
              </Box>
            )}
            
            {/* Video controls */}
            <Box 
              sx={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                p: 1,
                bgcolor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Advanced timeline component */}
              <AdvancedVideoTimeline
                currentTime={progress}
                duration={duration}
                segments={segments}
                events={events}
                thumbnails={thumbnails}
                loading={segmentLoading}
                onSeek={handleSeek}
                onJumpToEvent={jumpToEvent}
                onJumpToSegment={handleJumpToSegment}
                recordingStartTime={recording?.startTime}
              />
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <IconButton 
                  color="inherit" 
                  onClick={() => navigateSegment('prev')}
                  disabled={segments.length <= 1}
                  sx={{ color: 'white' }}
                >
                  <SkipPreviousIcon />
                </IconButton>
                
                <IconButton 
                  color="inherit" 
                  onClick={() => setIsPlaying(!isPlaying)}
                  sx={{ color: 'white' }}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                
                <IconButton 
                  color="inherit" 
                  onClick={() => navigateSegment('next')}
                  disabled={segments.length <= 1}
                  sx={{ color: 'white' }}
                >
                  <SkipNextIcon />
                </IconButton>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mx: 1, flex: 1 }}>
                  <IconButton 
                    color="inherit" 
                    onClick={() => setIsMuted(!isMuted)}
                    sx={{ color: 'white' }}
                  >
                    {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                  </IconButton>
                  <Slider
                    size="small"
                    value={volume}
                    onChange={(_, newValue) => setVolume(newValue as number)}
                    disabled={isMuted}
                    sx={{ 
                      mx: 1, 
                      width: 100,
                      color: 'white',
                      '& .MuiSlider-thumb': {
                        width: 12,
                        height: 12
                      }
                    }}
                  />
                </Box>
                
                <Tooltip title="Take Screenshot">
                  <IconButton 
                    color="inherit" 
                    onClick={takeScreenshot}
                    sx={{ color: 'white' }}
                  >
                    <ScreenshotIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Download Segment">
                  <IconButton 
                    color="inherit" 
                    onClick={downloadSegment}
                    sx={{ color: 'white' }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Export Video">
                  <IconButton 
                    color="inherit" 
                    onClick={handleExportClick}
                    sx={{ color: 'white' }}
                  >
                    <MovieIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Toggle Fullscreen">
                  <IconButton 
                    color="inherit" 
                    onClick={toggleFullscreen}
                    sx={{ color: 'white' }}
                  >
                    <FullscreenIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recording Details
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Camera:</strong> {recording?.camera?.name || 'Unknown'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Start Time:</strong> {recording?.startTime ? format(new Date(recording.startTime), 'PPpp') : 'Unknown'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>End Time:</strong> {recording?.endTime ? format(new Date(recording.endTime), 'PPpp') : 'Unknown'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Duration:</strong> {recording?.duration ? `${Math.floor(recording.duration / 60)} min ${recording.duration % 60} sec` : 'Unknown'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Segments:</strong> {segments.length}
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                <strong>Events:</strong> {events.length}
              </Typography>
              
              {currentSegment && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Current Segment
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Start:</strong> {format(new Date(currentSegment.startTime), 'HH:mm:ss')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Duration:</strong> {formatTime(duration)}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Events
              </Typography>
              
              {events.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No events detected in this recording
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {events.map((event) => (
                    <ListItem 
                      key={event.id} 
                      button 
                      onClick={() => jumpToEvent(event)}
                      sx={{ 
                        borderLeft: '3px solid',
                        borderColor: 'primary.main',
                        mb: 1,
                        bgcolor: 'action.hover'
                      }}
                    >
                      <ListItemIcon>
                        {getEventIcon(event.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={event.type}
                        secondary={event.timestamp ? format(new Date(event.timestamp), 'pp') : 'Unknown time'}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Export dialog */}
      <ExportVideoDialog
        open={showExportDialog}
        onClose={handleExportDialogClose}
        recordingId={recordingId || ''}
        recordingName={recording?.name || 'Recording'}
        cameraName={recording?.camera?.name || 'Camera'}
        segments={segments}
        token={token || ''}
        selectedSegmentId={currentSegment?.id}
        currentTime={getCurrentGlobalPosition()}
        API_URL={API_URL}
      />
    </Box>
  );
};

export default RecordingPlayer;