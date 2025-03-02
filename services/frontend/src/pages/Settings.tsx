import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  Switch,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { token } = useAuth();
  
  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // Mock settings data
  const [generalSettings, setGeneralSettings] = useState({
    systemName: 'OmniSight NVR',
    recordingsPath: '/opt/omnisight/recordings',
    retentionDays: 30,
    autoCleanup: true,
    maxStorageUsage: 90
  });

  const [recordingSettings, setRecordingSettings] = useState({
    enabled: true,
    defaultSegmentDuration: 600,
    defaultFormat: 'mp4',
    recordOnMotion: true,
    preRecordSeconds: 5,
    postRecordSeconds: 10
  });

  const [detectionSettings, setDetectionSettings] = useState({
    enabled: true,
    detectionInterval: 1000,
    minConfidence: 0.6,
    motionSensitivity: 5,
    enablePersonDetection: true,
    enableVehicleDetection: true,
    enableAnimalDetection: false
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: false,
    emailRecipients: 'admin@example.com',
    pushEnabled: false,
    notifyOnMotion: true,
    notifyOnPerson: true,
    notifyOnVehicle: true,
    notifyOnAnimal: false,
    notifyOnSystemEvents: true
  });

  const [userAccounts, setUserAccounts] = useState([
    { id: '1', username: 'admin', email: 'admin@example.com', role: 'admin', lastLogin: '2023-01-01T12:00:00Z' },
    { id: '2', username: 'user1', email: 'user1@example.com', role: 'user', lastLogin: '2023-01-01T10:00:00Z' },
    { id: '3', username: 'viewer', email: 'viewer@example.com', role: 'viewer', lastLogin: '2023-01-01T09:00:00Z' }
  ]);

  // In a real implementation, we would fetch settings from the API
  useEffect(() => {
    const fetchSettings = async () => {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // This would be a real API call in production
        /*
        const response = await axios.get(`${API_URL}/system/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const settings = response.data;
        setGeneralSettings(settings.general);
        setRecordingSettings(settings.recording);
        setDetectionSettings(settings.detection);
        setNotificationSettings(settings.notifications);
        */
        
        // Simulate API delay
        setTimeout(() => {
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching settings:', error);
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [token, API_URL]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveSettings = () => {
    setLoading(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    // In a real implementation, we would save settings to the API
    /*
    const settings = {
      general: generalSettings,
      recording: recordingSettings,
      detection: detectionSettings,
      notifications: notificationSettings
    };
    
    axios.put(`${API_URL}/system/settings`, settings, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        setSaveSuccess(true);
        setLoading(false);
      })
      .catch((error) => {
        setSaveError(error.response?.data?.error || 'Failed to save settings');
        setLoading(false);
      });
    */
    
    // Simulate API delay
    setTimeout(() => {
      setSaveSuccess(true);
      setLoading(false);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }, 1000);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading && tabValue === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved successfully
        </Alert>
      )}
      
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}
      
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="General" {...a11yProps(0)} />
          <Tab label="Recording" {...a11yProps(1)} />
          <Tab label="Detection" {...a11yProps(2)} />
          <Tab label="Notifications" {...a11yProps(3)} />
          <Tab label="User Accounts" {...a11yProps(4)} />
        </Tabs>
        
        {/* General Settings */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                System Settings
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="System Name"
                fullWidth
                value={generalSettings.systemName}
                onChange={(e) => setGeneralSettings({ ...generalSettings, systemName: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Recordings Path"
                fullWidth
                value={generalSettings.recordingsPath}
                onChange={(e) => setGeneralSettings({ ...generalSettings, recordingsPath: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Storage Settings
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Retention Period (days)"
                type="number"
                fullWidth
                value={generalSettings.retentionDays}
                onChange={(e) => setGeneralSettings({ ...generalSettings, retentionDays: parseInt(e.target.value) })}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Maximum Storage Usage: {generalSettings.maxStorageUsage}%
              </Typography>
              <Slider
                value={generalSettings.maxStorageUsage}
                onChange={(e, newValue) => setGeneralSettings({ ...generalSettings, maxStorageUsage: newValue as number })}
                aria-labelledby="max-storage-usage-slider"
                valueLabelDisplay="auto"
                step={5}
                marks
                min={50}
                max={95}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generalSettings.autoCleanup}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, autoCleanup: e.target.checked })}
                  />
                }
                label="Automatically clean up old recordings when storage limit is reached"
              />
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Recording Settings */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={recordingSettings.enabled}
                    onChange={(e) => setRecordingSettings({ ...recordingSettings, enabled: e.target.checked })}
                  />
                }
                label="Enable Recording"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Default Segment Duration (seconds)"
                type="number"
                fullWidth
                value={recordingSettings.defaultSegmentDuration}
                onChange={(e) => setRecordingSettings({ ...recordingSettings, defaultSegmentDuration: parseInt(e.target.value) })}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="format-select-label">Default Format</InputLabel>
                <Select
                  labelId="format-select-label"
                  value={recordingSettings.defaultFormat}
                  label="Default Format"
                  onChange={(e) => setRecordingSettings({ ...recordingSettings, defaultFormat: e.target.value })}
                >
                  <MenuItem value="mp4">MP4</MenuItem>
                  <MenuItem value="mkv">MKV</MenuItem>
                  <MenuItem value="avi">AVI</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Event-Based Recording
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={recordingSettings.recordOnMotion}
                    onChange={(e) => setRecordingSettings({ ...recordingSettings, recordOnMotion: e.target.checked })}
                  />
                }
                label="Record on Motion Detection"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Pre-Record Buffer (seconds)"
                type="number"
                fullWidth
                value={recordingSettings.preRecordSeconds}
                onChange={(e) => setRecordingSettings({ ...recordingSettings, preRecordSeconds: parseInt(e.target.value) })}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Post-Record Buffer (seconds)"
                type="number"
                fullWidth
                value={recordingSettings.postRecordSeconds}
                onChange={(e) => setRecordingSettings({ ...recordingSettings, postRecordSeconds: parseInt(e.target.value) })}
              />
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Detection Settings */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={detectionSettings.enabled}
                    onChange={(e) => setDetectionSettings({ ...detectionSettings, enabled: e.target.checked })}
                  />
                }
                label="Enable Object Detection"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Detection Interval (milliseconds)"
                type="number"
                fullWidth
                value={detectionSettings.detectionInterval}
                onChange={(e) => setDetectionSettings({ ...detectionSettings, detectionInterval: parseInt(e.target.value) })}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Minimum Confidence: {detectionSettings.minConfidence * 100}%
              </Typography>
              <Slider
                value={detectionSettings.minConfidence * 100}
                onChange={(e, newValue) => setDetectionSettings({ ...detectionSettings, minConfidence: (newValue as number) / 100 })}
                aria-labelledby="min-confidence-slider"
                valueLabelDisplay="auto"
                step={5}
                marks
                min={30}
                max={95}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography gutterBottom>
                Motion Sensitivity: {detectionSettings.motionSensitivity}
              </Typography>
              <Slider
                value={detectionSettings.motionSensitivity}
                onChange={(e, newValue) => setDetectionSettings({ ...detectionSettings, motionSensitivity: newValue as number })}
                aria-labelledby="motion-sensitivity-slider"
                valueLabelDisplay="auto"
                step={1}
                marks
                min={1}
                max={10}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Detection Types
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={detectionSettings.enablePersonDetection}
                      onChange={(e) => setDetectionSettings({ ...detectionSettings, enablePersonDetection: e.target.checked })}
                    />
                  }
                  label="Person Detection"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={detectionSettings.enableVehicleDetection}
                      onChange={(e) => setDetectionSettings({ ...detectionSettings, enableVehicleDetection: e.target.checked })}
                    />
                  }
                  label="Vehicle Detection"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={detectionSettings.enableAnimalDetection}
                      onChange={(e) => setDetectionSettings({ ...detectionSettings, enableAnimalDetection: e.target.checked })}
                    />
                  }
                  label="Animal Detection"
                />
              </FormGroup>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Notification Settings */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Email Notifications
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.emailEnabled}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailEnabled: e.target.checked })}
                  />
                }
                label="Enable Email Notifications"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Email Recipients (comma separated)"
                fullWidth
                value={notificationSettings.emailRecipients}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailRecipients: e.target.value })}
                disabled={!notificationSettings.emailEnabled}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Push Notifications
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.pushEnabled}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, pushEnabled: e.target.checked })}
                  />
                }
                label="Enable Push Notifications"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Notification Triggers
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.notifyOnMotion}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyOnMotion: e.target.checked })}
                    />
                  }
                  label="Motion Detection"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.notifyOnPerson}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyOnPerson: e.target.checked })}
                    />
                  }
                  label="Person Detection"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.notifyOnVehicle}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyOnVehicle: e.target.checked })}
                    />
                  }
                  label="Vehicle Detection"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.notifyOnAnimal}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyOnAnimal: e.target.checked })}
                    />
                  }
                  label="Animal Detection"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.notifyOnSystemEvents}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyOnSystemEvents: e.target.checked })}
                    />
                  }
                  label="System Events (errors, storage warnings, etc.)"
                />
              </FormGroup>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* User Accounts */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              User Accounts
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
            >
              Add User
            </Button>
          </Box>
          
          <List>
            {userAccounts.map((user) => (
              <React.Fragment key={user.id}>
                <ListItem>
                  <ListItemText
                    primary={user.username}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {user.email}
                        </Typography>
                        {` — Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`}
                        <br />
                        {`Last login: ${formatDate(user.lastLogin)}`}
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" aria-label="edit">
                      <RefreshIcon />
                    </IconButton>
                    <IconButton edge="end" aria-label="delete" color="error" sx={{ ml: 1 }}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider variant="inset" component="li" />
              </React.Fragment>
            ))}
          </List>
        </TabPanel>
      </Paper>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
};

export default Settings;