import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Snackbar,
  Alert,
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Drawer,
  Button
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  DirectionsCar as CarIcon,
  Pets as PetsIcon,
  VideocamOff as VideocamOffIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  MotionPhotosOff as MotionIcon,
  Event as EventIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import io, { Socket } from 'socket.io-client';

// Types
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  cameraId?: string;
  cameraName?: string;
  recordingId?: string;
  eventId?: string;
  thumbnailUrl?: string;
  detectedObjects?: Array<{
    label: string;
    confidence: number;
  }>;
  read: boolean;
}

interface EventNotificationsProps {
  maxNotifications?: number;
}

const EventNotifications: React.FC<EventNotificationsProps> = ({ maxNotifications = 50 }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const { token } = useAuth();
  const navigate = useNavigate();
  
  // Socket.io endpoint from environment variable
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000';
  
  // Connect to WebSocket
  useEffect(() => {
    if (!token) return;
    
    // Initialize socket connection with auth token
    const socketInstance = io(SOCKET_URL, {
      auth: { token },
      path: '/api/socket'
    });
    
    socketInstance.on('connect', () => {
      console.log('Socket connected');
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    setSocket(socketInstance);
    
    // Clean up on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [token, SOCKET_URL]);
  
  // Listen for notifications
  useEffect(() => {
    if (!socket) return;
    
    // Event notifications
    socket.on('event:object_detected', (data) => {
      handleNewNotification({
        id: `event-${Date.now()}`,
        type: 'object_detected',
        title: 'Object Detected',
        message: `${data.detectedObjects?.length || 0} object(s) detected on ${data.cameraName}`,
        timestamp: new Date().toISOString(),
        cameraId: data.cameraId,
        cameraName: data.cameraName,
        eventId: data.eventId,
        thumbnailUrl: data.thumbnailUrl,
        detectedObjects: data.detectedObjects,
        read: false
      });
    });
    
    // Camera notifications
    socket.on('event:camera_offline', (data) => {
      handleNewNotification({
        id: `camera-${Date.now()}`,
        type: 'camera_offline',
        title: 'Camera Offline',
        message: `Camera ${data.cameraName} is offline`,
        timestamp: new Date().toISOString(),
        cameraId: data.cameraId,
        cameraName: data.cameraName,
        read: false
      });
    });
    
    // Recording notifications
    socket.on('event:recording_started', (data) => {
      handleNewNotification({
        id: `recording-${Date.now()}`,
        type: 'recording_started',
        title: 'Recording Started',
        message: `Recording started on ${data.cameraName}`,
        timestamp: new Date().toISOString(),
        cameraId: data.cameraId,
        cameraName: data.cameraName,
        recordingId: data.recordingId,
        read: false
      });
    });
    
    socket.on('event:recording_completed', (data) => {
      handleNewNotification({
        id: `recording-${Date.now()}`,
        type: 'recording_completed',
        title: 'Recording Completed',
        message: `Recording completed on ${data.cameraName}`,
        timestamp: new Date().toISOString(),
        cameraId: data.cameraId,
        cameraName: data.cameraName,
        recordingId: data.recordingId,
        read: false
      });
    });
    
    // System notifications
    socket.on('event:system_alert', (data) => {
      handleNewNotification({
        id: `system-${Date.now()}`,
        type: 'system_alert',
        title: 'System Alert',
        message: data.message,
        timestamp: new Date().toISOString(),
        read: false
      });
    });
    
    // Clean up listeners
    return () => {
      socket.off('event:object_detected');
      socket.off('event:camera_offline');
      socket.off('event:recording_started');
      socket.off('event:recording_completed');
      socket.off('event:system_alert');
    };
  }, [socket]);
  
  // Handle new notifications
  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      // Add new notification and limit total
      const updated = [notification, ...prev].slice(0, maxNotifications);
      
      // Update unread count
      const unread = updated.filter((n) => !n.read).length;
      setUnreadCount(unread);
      
      return updated;
    });
    
    // Show snackbar for the latest notification
    setLatestNotification(notification);
    setSnackbarOpen(true);
  }, [maxNotifications]);
  
  // Get notifications from localStorage on mount
  useEffect(() => {
    try {
      const savedNotifications = localStorage.getItem('omnisight_notifications');
      if (savedNotifications) {
        const parsed = JSON.parse(savedNotifications) as Notification[];
        setNotifications(parsed);
        setUnreadCount(parsed.filter((n) => !n.read).length);
      }
    } catch (err) {
      console.error('Error loading notifications from localStorage:', err);
    }
  }, []);
  
  // Save notifications to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('omnisight_notifications', JSON.stringify(notifications));
    } catch (err) {
      console.error('Error saving notifications to localStorage:', err);
    }
  }, [notifications]);
  
  // Handle menu open
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.type === 'object_detected' && notification.eventId) {
      navigate(`/events/${notification.eventId}`);
    } else if (notification.type === 'camera_offline' && notification.cameraId) {
      navigate(`/cameras/${notification.cameraId}`);
    } else if (['recording_started', 'recording_completed'].includes(notification.type) && notification.recordingId) {
      navigate(`/recordings/${notification.recordingId}`);
    } else if (notification.type === 'system_alert') {
      navigate('/monitoring');
    }
    
    // Close drawer or menu
    setDrawerOpen(false);
    handleMenuClose();
  };
  
  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications((prev) => 
      prev.map((n) => n.id === id ? { ...n, read: true } : n)
    );
    
    // Update unread count
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };
  
  // Mark all as read
  const markAllAsRead = () => {
    setNotifications((prev) => 
      prev.map((n) => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  };
  
  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    setDrawerOpen(false);
  };
  
  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  // Handle snackbar click
  const handleSnackbarClick = () => {
    if (latestNotification) {
      handleNotificationClick(latestNotification);
    }
    setSnackbarOpen(false);
  };
  
  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'object_detected':
        return <PersonIcon />;
      case 'camera_offline':
        return <VideocamOffIcon />;
      case 'recording_started':
      case 'recording_completed':
        return <StorageIcon />;
      case 'system_alert':
        return <WarningIcon />;
      default:
        return <EventIcon />;
    }
  };
  
  // Get severity for notification type
  const getNotificationSeverity = (type: string): 'success' | 'info' | 'warning' | 'error' => {
    switch (type) {
      case 'object_detected':
        return 'info';
      case 'camera_offline':
        return 'error';
      case 'recording_started':
        return 'success';
      case 'recording_completed':
        return 'success';
      case 'system_alert':
        return 'warning';
      default:
        return 'info';
    }
  };
  
  // Format timestampl
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM d, h:mm a');
    } catch (err) {
      return 'Unknown time';
    }
  };
  
  return (
    <>
      {/* Notification Icon */}
      <IconButton 
        color="inherit" 
        onClick={handleMenuOpen}
        size="large"
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      {/* Quick notification menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          style: {
            width: 350,
            maxHeight: 400
          }
        }}
      >
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1">Notifications</Typography>
          <Box>
            {unreadCount > 0 && (
              <Button size="small" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
            <Button size="small" onClick={() => { setDrawerOpen(true); handleMenuClose(); }}>
              View all
            </Button>
          </Box>
        </Box>
        
        <Divider />
        
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <ListItemText primary="No notifications" />
          </MenuItem>
        ) : (
          <>
            {notifications.slice(0, 5).map((notification) => (
              <MenuItem 
                key={notification.id} 
                onClick={() => handleNotificationClick(notification)}
                sx={{ 
                  opacity: notification.read ? 0.7 : 1,
                  bgcolor: notification.read ? 'transparent' : 'action.hover'
                }}
              >
                <ListItemIcon>
                  {getNotificationIcon(notification.type)}
                </ListItemIcon>
                <ListItemText 
                  primary={notification.title}
                  secondary={
                    <>
                      <Typography variant="body2" noWrap>
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(notification.timestamp)}
                      </Typography>
                    </>
                  }
                />
              </MenuItem>
            ))}
            
            {notifications.length > 5 && (
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <Button size="small" onClick={() => { setDrawerOpen(true); handleMenuClose(); }}>
                  View all ({notifications.length})
                </Button>
              </Box>
            )}
          </>
        )}
      </Menu>
      
      {/* Full notification drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 400 } }
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          <Box>
            <IconButton size="small" onClick={() => setDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        
        <Divider />
        
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between' }}>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<EventIcon />} onClick={markAllAsRead}>
              Mark all as read
            </Button>
          )}
          <Button 
            size="small" 
            color="error" 
            startIcon={<DeleteIcon />} 
            onClick={clearAllNotifications}
            disabled={notifications.length === 0}
          >
            Clear all
          </Button>
        </Box>
        
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            notifications.map((notification) => (
              <React.Fragment key={notification.id}>
                <ListItem 
                  alignItems="flex-start" 
                  sx={{ 
                    opacity: notification.read ? 0.7 : 1,
                    bgcolor: notification.read ? 'transparent' : 'action.hover',
                    borderLeft: '4px solid',
                    borderLeftColor: `${getNotificationSeverity(notification.type)}.main`
                  }}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      size="small" 
                      onClick={() => markAsRead(notification.id)}
                      sx={{ visibility: notification.read ? 'hidden' : 'visible' }}
                    >
                      <EventIcon fontSize="small" />
                    </IconButton>
                  }
                  onClick={() => handleNotificationClick(notification)}
                >
                  {notification.thumbnailUrl ? (
                    <ListItemAvatar>
                      <Avatar variant="rounded" src={notification.thumbnailUrl} alt={notification.title}>
                        {getNotificationIcon(notification.type)}
                      </Avatar>
                    </ListItemAvatar>
                  ) : (
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                  )}
                  
                  <ListItemText
                    primary={
                      <Typography 
                        variant="subtitle2" 
                        sx={{ fontWeight: notification.read ? 'normal' : 'bold' }}
                      >
                        {notification.title}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.primary">
                          {notification.message}
                        </Typography>
                        
                        {notification.cameraName && (
                          <Typography variant="caption" display="block">
                            Camera: {notification.cameraName}
                          </Typography>
                        )}
                        
                        {notification.detectedObjects && notification.detectedObjects.length > 0 && (
                          <Typography variant="caption" display="block">
                            Detected: {notification.detectedObjects.map(obj => obj.label).join(', ')}
                          </Typography>
                        )}
                        
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(notification.timestamp)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))
          )}
        </List>
      </Drawer>
      
      {/* Toast notification for new events */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose}
          severity={latestNotification ? getNotificationSeverity(latestNotification.type) : 'info'}
          variant="filled"
          sx={{ width: '100%' }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleSnackbarClick}
              startIcon={<PlayArrowIcon />}
            >
              View
            </Button>
          }
        >
          {latestNotification?.title}
          <Typography variant="caption" display="block">
            {latestNotification?.message}
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default EventNotifications;