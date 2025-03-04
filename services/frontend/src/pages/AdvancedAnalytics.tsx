import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Paper, 
  Button, 
  Tabs, 
  Tab, 
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip,
  Divider,
  useTheme
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  DateRange as DateRangeIcon,
  GetApp as DownloadIcon,
  Info as InfoIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { styled } from '@mui/material/styles';
import { 
  Area, 
  AreaChart, 
  Bar, 
  BarChart, 
  CartesianGrid, 
  Legend,
  Line, 
  LineChart, 
  Pie, 
  PieChart, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  XAxis, 
  YAxis,
  Cell,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format, subDays, isAfter, isBefore, parseISO } from 'date-fns';

const AnalyticsCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s, box-shadow 0.3s',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[8],
  },
}));

const AnalyticsCardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2),
  paddingBottom: theme.spacing(1),
}));

const AnalyticsCardContent = styled(CardContent)({
  flexGrow: 1,
  padding: '0 16px 16px',
  '&:last-child': {
    paddingBottom: 16,
  },
});

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#5DADE2', '#45B39D', '#F4D03F'];

interface AnalyticsData {
  status: string;
  cameras: {
    total: number;
    active: number;
    byType: Record<string, number>;
    byStatus: {
      online: number;
      offline: number;
      error: number;
    };
  };
  events: {
    total: number;
    byType: Record<string, number>;
    byTime: {
      date: string;
      count: number;
    }[];
    byCamera: Record<string, number>;
  };
  detections: {
    total: number;
    byObject: Record<string, number>;
    byTime: {
      date: string;
      count: number;
    }[];
    byConfidence: {
      range: string;
      count: number;
    }[];
  };
  recordings: {
    total: number;
    sizeGB: number;
    byCamera: Record<string, number>;
    byTime: {
      date: string;
      count: number;
      sizeGB: number;
    }[];
  };
  performance: {
    apiResponseTimes: {
      endpoint: string;
      avgResponseTime: number;
      p95ResponseTime: number;
      errorRate: number;
    }[];
    processingTimes: {
      service: string;
      operation: string;
      avgTime: number;
    }[];
    resources: {
      timestamp: string;
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      networkIn: number;
      networkOut: number;
    }[];
  };
  predictions: {
    storageGrowth: {
      date: string;
      predicted: number;
      actual?: number;
    }[];
    eventFrequency: {
      hour: number;
      frequency: number;
    }[];
    detectionHotspots: {
      cameraId: string;
      frequency: number;
    }[];
  };
}

interface FilterOptions {
  startDate: Date;
  endDate: Date;
  cameras: string[];
  objectTypes: string[];
  eventTypes: string[];
  timeGranularity: 'hour' | 'day' | 'week' | 'month';
}

const AdvancedAnalytics: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [currentTab, setCurrentTab] = useState<number>(0);
  const [refreshInterval, setRefreshInterval] = useState<number>(300000); // 5 minutes
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
    cameras: [],
    objectTypes: [],
    eventTypes: [],
    timeGranularity: 'day',
  });
  const [availableCameras, setAvailableCameras] = useState<{id: string, name: string}[]>([]);
  const [availableObjectTypes, setAvailableObjectTypes] = useState<string[]>([]);
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Fetch analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiGatewayUrl = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3000';
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('start', filterOptions.startDate.toISOString());
      params.append('end', filterOptions.endDate.toISOString());
      params.append('granularity', filterOptions.timeGranularity);
      
      if (filterOptions.cameras.length > 0) {
        filterOptions.cameras.forEach(camera => params.append('cameras', camera));
      }
      
      if (filterOptions.objectTypes.length > 0) {
        filterOptions.objectTypes.forEach(type => params.append('objectTypes', type));
      }
      
      if (filterOptions.eventTypes.length > 0) {
        filterOptions.eventTypes.forEach(type => params.append('eventTypes', type));
      }
      
      const response = await axios.get(`${apiGatewayUrl}/analytics?${params.toString()}`, {
        timeout: 10000,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      setAnalyticsData(response.data);
      setLastUpdated(new Date());
      
      // Also update available filter options if needed
      if (availableCameras.length === 0) {
        const camerasResponse = await axios.get(`${apiGatewayUrl}/cameras`);
        setAvailableCameras(camerasResponse.data.map((camera: any) => ({
          id: camera.id,
          name: camera.name
        })));
      }
      
      if (availableObjectTypes.length === 0) {
        const objectTypesResponse = await axios.get(`${apiGatewayUrl}/detection/object-types`);
        setAvailableObjectTypes(objectTypesResponse.data);
      }
      
      if (availableEventTypes.length === 0) {
        const eventTypesResponse = await axios.get(`${apiGatewayUrl}/events/types`);
        setAvailableEventTypes(eventTypesResponse.data);
      }
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to fetch analytics data. Please try again later.');
      
      // For development/demo purposes, generate sample data if API fails
      setAnalyticsData(generateSampleData());
    } finally {
      setLoading(false);
    }
  }, [filterOptions, availableCameras.length, availableObjectTypes.length, availableEventTypes.length]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchAnalyticsData();
    
    const interval = setInterval(() => {
      fetchAnalyticsData();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [fetchAnalyticsData, refreshInterval]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Handle filter changes
  const handleFilterChange = (filterName: keyof FilterOptions, value: any) => {
    setFilterOptions(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Toggle filters visibility
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Export data as CSV
  const exportCSV = () => {
    if (!analyticsData) return;
    
    let csvContent = '';
    
    // Choose what to export based on current tab
    switch (currentTab) {
      case 0: // Overview
        csvContent = 'Date,Events,Detections,Recordings\n';
        // Combine data from different sources
        const dates = new Set<string>();
        analyticsData.events.byTime.forEach(item => dates.add(item.date));
        analyticsData.detections.byTime.forEach(item => dates.add(item.date));
        analyticsData.recordings.byTime.forEach(item => dates.add(item.date));
        
        Array.from(dates).sort().forEach(date => {
          const events = analyticsData.events.byTime.find(e => e.date === date)?.count || 0;
          const detections = analyticsData.detections.byTime.find(d => d.date === date)?.count || 0;
          const recordings = analyticsData.recordings.byTime.find(r => r.date === date)?.count || 0;
          csvContent += `${date},${events},${detections},${recordings}\n`;
        });
        break;
        
      case 1: // Camera Analytics
        csvContent = 'Camera,Events,Recordings\n';
        availableCameras.forEach(camera => {
          const events = analyticsData.events.byCamera[camera.id] || 0;
          const recordings = analyticsData.recordings.byCamera[camera.id] || 0;
          csvContent += `${camera.name},${events},${recordings}\n`;
        });
        break;
        
      case 2: // Detection Analytics
        csvContent = 'Object Type,Count\n';
        Object.entries(analyticsData.detections.byObject).forEach(([objectType, count]) => {
          csvContent += `${objectType},${count}\n`;
        });
        break;
        
      case 3: // Performance
        csvContent = 'Timestamp,CPU Usage,Memory Usage,Disk Usage,Network In,Network Out\n';
        analyticsData.performance.resources.forEach(item => {
          csvContent += `${item.timestamp},${item.cpuUsage},${item.memoryUsage},${item.diskUsage},${item.networkIn},${item.networkOut}\n`;
        });
        break;
        
      case 4: // Predictive
        csvContent = 'Date,Predicted Storage Growth,Actual Storage Growth\n';
        analyticsData.predictions.storageGrowth.forEach(item => {
          csvContent += `${item.date},${item.predicted},${item.actual || ''}\n`;
        });
        break;
    }
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `omnisight-analytics-${currentTab}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render system overview
  const renderOverview = () => {
    if (!analyticsData) return null;
    
    return (
      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} md={6} lg={3}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Cameras</Typography>
              <Tooltip title="Total number of cameras in the system">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <Typography variant="h3" color="primary">
                  {analyticsData.cameras.total}
                </Typography>
              </Box>
              <Box mt={1} display="flex" justifyContent="space-around">
                <Typography variant="body2" color="textSecondary">
                  Active: {analyticsData.cameras.active}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Online: {analyticsData.cameras.byStatus.online}
                </Typography>
              </Box>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Events</Typography>
              <Tooltip title="Total number of events detected during selected period">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <Typography variant="h3" color="primary">
                  {analyticsData.events.total}
                </Typography>
              </Box>
              <Box mt={1} display="flex" justifyContent="center">
                <Typography variant="body2" color="textSecondary">
                  In selected time period
                </Typography>
              </Box>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Detections</Typography>
              <Tooltip title="Total number of objects detected during selected period">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <Typography variant="h3" color="primary">
                  {analyticsData.detections.total}
                </Typography>
              </Box>
              <Box mt={1} display="flex" justifyContent="center">
                <Typography variant="body2" color="textSecondary">
                  Most common: {Object.entries(analyticsData.detections.byObject)
                    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'}
                </Typography>
              </Box>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Storage</Typography>
              <Tooltip title="Total storage used by recordings">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <Typography variant="h3" color="primary">
                  {analyticsData.recordings.sizeGB.toFixed(1)} GB
                </Typography>
              </Box>
              <Box mt={1} display="flex" justifyContent="center">
                <Typography variant="body2" color="textSecondary">
                  {analyticsData.recordings.total} recordings
                </Typography>
              </Box>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Time Series Chart */}
        <Grid item xs={12}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Activity Timeline</Typography>
              <Box>
                <IconButton size="small" onClick={fetchAnalyticsData}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={exportCSV}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Box>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={analyticsData.events.byTime.map(event => {
                    const detections = analyticsData.detections.byTime.find(d => d.date === event.date)?.count || 0;
                    const recordings = analyticsData.recordings.byTime.find(r => r.date === event.date)?.count || 0;
                    return {
                      date: event.date,
                      events: event.count,
                      detections,
                      recordings
                    };
                  })}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      try {
                        return format(parseISO(value), 'MM/dd');
                      } catch (e) {
                        return value;
                      }
                    }}
                  />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                    labelFormatter={(label) => {
                      try {
                        return format(parseISO(label), 'MMM dd, yyyy');
                      } catch (e) {
                        return label;
                      }
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="events" 
                    name="Events"
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="detections" 
                    name="Detections"
                    stroke="#82ca9d" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="recordings" 
                    name="Recordings"
                    stroke="#ffc658" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Distribution Charts */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Event Types Distribution</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(analyticsData.events.byType).map(([type, count], index) => ({
                      name: type,
                      value: count
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.entries(analyticsData.events.byType).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Object Detections by Type</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(analyticsData.detections.byObject).map(([type, count]) => ({
                    name: type,
                    count
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Count']} />
                  <Bar dataKey="count" name="Count" fill="#8884d8">
                    {Object.entries(analyticsData.detections.byObject).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Camera Status Distribution */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Camera Status Distribution</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Online', value: analyticsData.cameras.byStatus.online },
                      { name: 'Offline', value: analyticsData.cameras.byStatus.offline },
                      { name: 'Error', value: analyticsData.cameras.byStatus.error }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell key="cell-0" fill="#4CAF50" />
                    <Cell key="cell-1" fill="#9E9E9E" />
                    <Cell key="cell-2" fill="#F44336" />
                  </Pie>
                  <RechartsTooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Detection Confidence */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Detection Confidence Distribution</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.detections.byConfidence}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Count']} />
                  <Bar dataKey="count" name="Count" fill="#8884d8">
                    <Cell key="cell-0" fill="#FF8042" />
                    <Cell key="cell-1" fill="#FFBB28" />
                    <Cell key="cell-2" fill="#00C49F" />
                    <Cell key="cell-3" fill="#0088FE" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
      </Grid>
    );
  };

  // Render camera analytics
  const renderCameraAnalytics = () => {
    if (!analyticsData) return null;
    
    return (
      <Grid container spacing={3}>
        {/* Camera Event Distribution */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Events by Camera</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(analyticsData.events.byCamera).map(([cameraId, count]) => ({
                    name: availableCameras.find(c => c.id === cameraId)?.name || cameraId,
                    events: count
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Events']} />
                  <Bar dataKey="events" name="Events" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Camera Recording Distribution */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Recordings by Camera</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(analyticsData.recordings.byCamera).map(([cameraId, count]) => ({
                    name: availableCameras.find(c => c.id === cameraId)?.name || cameraId,
                    recordings: count
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Recordings']} />
                  <Bar dataKey="recordings" name="Recordings" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Camera Type Distribution */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Camera Types</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(analyticsData.cameras.byType).map(([type, count], index) => ({
                      name: type,
                      value: count
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.entries(analyticsData.cameras.byType).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Detection Hotspots */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Detection Hotspots</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.predictions.detectionHotspots.map((hotspot) => ({
                    name: availableCameras.find(c => c.id === hotspot.cameraId)?.name || hotspot.cameraId,
                    frequency: hotspot.frequency
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Detection Frequency']} />
                  <Bar dataKey="frequency" name="Frequency" fill="#ff7300" />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Activity Pattern */}
        <Grid item xs={12}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Camera Activity Pattern</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={analyticsData.predictions.eventFrequency.map((item) => ({
                    hour: item.hour,
                    frequency: item.frequency
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(hour) => `${hour}:00`}
                  />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Frequency']} labelFormatter={(hour) => `${hour}:00`} />
                  <Area type="monotone" dataKey="frequency" stroke="#8884d8" fill="#8884d8" />
                </AreaChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
      </Grid>
    );
  };

  // Render detection analytics
  const renderDetectionAnalytics = () => {
    if (!analyticsData) return null;
    
    return (
      <Grid container spacing={3}>
        {/* Top Detected Objects */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Top Detected Objects</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(analyticsData.detections.byObject)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([type, count], index) => ({
                        name: type,
                        value: count
                      }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.entries(analyticsData.detections.byObject)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Detection Confidence Distribution */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Detection Confidence</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.detections.byConfidence}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Count']} />
                  <Bar dataKey="count" name="Count" fill="#8884d8">
                    <Cell key="cell-0" fill="#FF8042" />
                    <Cell key="cell-1" fill="#FFBB28" />
                    <Cell key="cell-2" fill="#00C49F" />
                    <Cell key="cell-3" fill="#0088FE" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Detection Trend Over Time */}
        <Grid item xs={12}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Detection Trend</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={analyticsData.detections.byTime}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      try {
                        return format(parseISO(value), 'MM/dd');
                      } catch (e) {
                        return value;
                      }
                    }}
                  />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value: number) => [value, 'Detections']}
                    labelFormatter={(label) => {
                      try {
                        return format(parseISO(label), 'MMM dd, yyyy');
                      } catch (e) {
                        return label;
                      }
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Radar Chart for Object Detection Comparison */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Object Detection Profile</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart outerRadius={90} data={Object.entries(analyticsData.detections.byObject)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([type, count]) => ({
                    subject: type,
                    A: count,
                    fullMark: Math.max(...Object.values(analyticsData.detections.byObject))
                  }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis />
                  <Radar name="Objects" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Detection Scatter Plot */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Detection Scatter Analysis</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid />
                  <XAxis 
                    type="number" 
                    dataKey="hour" 
                    name="Hour" 
                    tickFormatter={(hour) => `${hour}:00`}
                    domain={[0, 24]}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="confidence" 
                    name="Confidence" 
                    unit="%" 
                    domain={[0, 100]}
                  />
                  <RechartsTooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    formatter={(value: number, name: string) => [
                      name === 'Hour' ? `${value}:00` : `${value}%`, 
                      name
                    ]}
                  />
                  <Scatter 
                    name="Detections" 
                    data={
                      // Generate sample scatter data based on our analytics
                      [...Array(50)].map((_, i) => {
                        const hour = Math.floor(Math.random() * 24);
                        return {
                          hour,
                          confidence: Math.floor(Math.random() * 40) + 60, // 60-100% confidence
                          count: Math.floor(Math.random() * 10) + 1
                        };
                      })
                    } 
                    fill="#8884d8"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
      </Grid>
    );
  };

  // Render performance analytics
  const renderPerformanceAnalytics = () => {
    if (!analyticsData) return null;
    
    return (
      <Grid container spacing={3}>
        {/* API Response Times */}
        <Grid item xs={12}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">API Response Times</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.performance.apiResponseTimes}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="endpoint" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="avgResponseTime" name="Avg Response Time (ms)" fill="#8884d8" />
                  <Bar dataKey="p95ResponseTime" name="P95 Response Time (ms)" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Processing Times */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Processing Times</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.performance.processingTimes}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="operation" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [`${value} ms`, 'Processing Time']} />
                  <Bar dataKey="avgTime" name="Average Time (ms)" fill="#8884d8">
                    {analyticsData.performance.processingTimes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Error Rates */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">API Error Rates</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.performance.apiResponseTimes}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="endpoint" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Error Rate']} />
                  <Bar dataKey="errorRate" name="Error Rate (%)" fill="#FF8042">
                    {analyticsData.performance.apiResponseTimes.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.errorRate > 5 ? '#FF5252' : entry.errorRate > 1 ? '#FFC107' : '#4CAF50'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Resource Usage Over Time */}
        <Grid item xs={12}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Resource Usage Over Time</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={analyticsData.performance.resources}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => {
                      try {
                        return format(parseISO(value), 'HH:mm');
                      } catch (e) {
                        return value;
                      }
                    }}
                  />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                    labelFormatter={(label) => {
                      try {
                        return format(parseISO(label), 'MMM dd, yyyy HH:mm:ss');
                      } catch (e) {
                        return label;
                      }
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cpuUsage" name="CPU Usage" stroke="#8884d8" />
                  <Line type="monotone" dataKey="memoryUsage" name="Memory Usage" stroke="#82ca9d" />
                  <Line type="monotone" dataKey="diskUsage" name="Disk Usage" stroke="#ffc658" />
                </LineChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Network Traffic */}
        <Grid item xs={12}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Network Traffic</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={analyticsData.performance.resources}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => {
                      try {
                        return format(parseISO(value), 'HH:mm');
                      } catch (e) {
                        return value;
                      }
                    }}
                  />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [`${value} KB/s`, name]}
                    labelFormatter={(label) => {
                      try {
                        return format(parseISO(label), 'MMM dd, yyyy HH:mm:ss');
                      } catch (e) {
                        return label;
                      }
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="networkIn" name="Network In" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="networkOut" name="Network Out" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
      </Grid>
    );
  };

  // Render predictive analytics
  const renderPredictiveAnalytics = () => {
    if (!analyticsData) return null;
    
    return (
      <Grid container spacing={3}>
        {/* Storage Growth Prediction */}
        <Grid item xs={12}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Storage Growth Prediction</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={analyticsData.predictions.storageGrowth}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      try {
                        return format(parseISO(value), 'MM/dd');
                      } catch (e) {
                        return value;
                      }
                    }}
                  />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value: number) => [`${value.toFixed(1)} GB`, 'Storage']}
                    labelFormatter={(label) => {
                      try {
                        return format(parseISO(label), 'MMM dd, yyyy');
                      } catch (e) {
                        return label;
                      }
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="predicted" name="Predicted Growth" stroke="#8884d8" />
                  <Line type="monotone" dataKey="actual" name="Actual Growth" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Event Frequency by Hour */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Event Frequency by Hour</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.predictions.eventFrequency}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value: number) => [value, 'Event Frequency']}
                    labelFormatter={(hour) => `${hour}:00`}
                  />
                  <Bar dataKey="frequency" name="Frequency" fill="#8884d8">
                    {analyticsData.predictions.eventFrequency.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.frequency > 75 ? '#FF5252' : entry.frequency > 50 ? '#FFC107' : '#4CAF50'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Detection Hotspots */}
        <Grid item xs={12} md={6}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Detection Hotspots</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.predictions.detectionHotspots.map((hotspot) => ({
                    name: availableCameras.find(c => c.id === hotspot.cameraId)?.name || hotspot.cameraId,
                    frequency: hotspot.frequency
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => [value, 'Detection Frequency']} />
                  <Bar dataKey="frequency" name="Frequency" fill="#FF8042">
                    {analyticsData.predictions.detectionHotspots.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        {/* Predictive Insights Cards */}
        <Grid item xs={12} md={4}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Storage Prediction</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={2}>
                <Typography variant="h3" color="primary">
                  {(analyticsData.recordings.sizeGB * 1.5).toFixed(1)} GB
                </Typography>
                <Typography variant="body1" align="center" mt={1}>
                  Estimated storage requirement in 30 days
                </Typography>
                <Typography variant="body2" color="textSecondary" align="center" mt={2}>
                  Based on current growth patterns
                </Typography>
              </Box>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Peak Activity</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={2}>
                <Typography variant="h3" color="primary">
                  {analyticsData.predictions.eventFrequency.sort((a, b) => b.frequency - a.frequency)[0]?.hour}:00
                </Typography>
                <Typography variant="body1" align="center" mt={1}>
                  Peak activity hour
                </Typography>
                <Typography variant="body2" color="textSecondary" align="center" mt={2}>
                  {analyticsData.predictions.eventFrequency.sort((a, b) => b.frequency - a.frequency)[0]?.frequency.toFixed(1)}% more events than average
                </Typography>
              </Box>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <AnalyticsCard>
            <AnalyticsCardHeader>
              <Typography variant="h6">Anomaly Detection</Typography>
            </AnalyticsCardHeader>
            <AnalyticsCardContent>
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={2}>
                <Typography variant="h3" color={Math.random() > 0.5 ? "primary" : "error"}>
                  {Math.random() > 0.5 ? "Normal" : "Detected"}
                </Typography>
                <Typography variant="body1" align="center" mt={1}>
                  System behavior pattern
                </Typography>
                <Typography variant="body2" color="textSecondary" align="center" mt={2}>
                  {Math.random() > 0.5 
                    ? "All metrics within expected ranges" 
                    : "Unusual event pattern detected in Camera 3"}
                </Typography>
              </Box>
            </AnalyticsCardContent>
          </AnalyticsCard>
        </Grid>
      </Grid>
    );
  };

  // Render date range filters
  const renderDateFilters = () => (
    <Box mt={2} mb={3} p={2} bgcolor="background.paper" borderRadius={1} display={showFilters ? 'block' : 'none'}>
      <Typography variant="h6" gutterBottom>
        Filters
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={3}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Start Date"
              value={filterOptions.startDate}
              onChange={(newValue: Date | null) => {
                if (newValue) {
                  handleFilterChange('startDate', newValue);
                }
              }}
              slotProps={{ textField: { fullWidth: true, variant: 'outlined', size: 'small' } }}
            />
          </LocalizationProvider>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="End Date"
              value={filterOptions.endDate}
              onChange={(newValue: Date | null) => {
                if (newValue) {
                  handleFilterChange('endDate', newValue);
                }
              }}
              slotProps={{ textField: { fullWidth: true, variant: 'outlined', size: 'small' } }}
            />
          </LocalizationProvider>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Time Granularity</InputLabel>
            <Select
              value={filterOptions.timeGranularity}
              label="Time Granularity"
              onChange={(event) => handleFilterChange('timeGranularity', event.target.value)}
            >
              <MenuItem value="hour">Hourly</MenuItem>
              <MenuItem value="day">Daily</MenuItem>
              <MenuItem value="week">Weekly</MenuItem>
              <MenuItem value="month">Monthly</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Cameras</InputLabel>
            <Select
              multiple
              value={filterOptions.cameras}
              label="Cameras"
              onChange={(event) => handleFilterChange('cameras', event.target.value)}
              renderValue={(selected: string[]) => 
                selected.length === 0 
                  ? 'All Cameras' 
                  : `${selected.length} selected`
              }
            >
              {availableCameras.map(camera => (
                <MenuItem key={camera.id} value={camera.id}>
                  {camera.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={12} lg={12} display="flex" justifyContent="flex-end">
          <Button variant="contained" color="primary" onClick={fetchAnalyticsData}>
            Apply Filters
          </Button>
        </Grid>
      </Grid>
    </Box>
  );

  // Function to generate sample data for development/demo
  const generateSampleData = (): AnalyticsData => {
    // Generate dates for the past week
    const dates = Array(7).fill(0).map((_, i) => 
      format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    );
    
    // Generate camera types
    const cameraTypes = {
      'RTSP': Math.floor(Math.random() * 5) + 5,
      'ONVIF': Math.floor(Math.random() * 5) + 3,
      'HLS': Math.floor(Math.random() * 3) + 1,
      'MJPEG': Math.floor(Math.random() * 2) + 1,
    };
    
    // Generate objects
    const objects = {
      'person': Math.floor(Math.random() * 200) + 100,
      'car': Math.floor(Math.random() * 150) + 50,
      'bicycle': Math.floor(Math.random() * 50) + 10,
      'dog': Math.floor(Math.random() * 30) + 5,
      'cat': Math.floor(Math.random() * 20) + 5,
      'truck': Math.floor(Math.random() * 40) + 20,
      'bus': Math.floor(Math.random() * 20) + 5,
      'motorcycle': Math.floor(Math.random() * 15) + 5,
    };
    
    // Generate events
    const events = {
      'motion_detected': Math.floor(Math.random() * 300) + 200,
      'object_detected': Math.floor(Math.random() * 250) + 150,
      'line_crossed': Math.floor(Math.random() * 100) + 50,
      'area_entered': Math.floor(Math.random() * 80) + 40,
      'camera_disconnected': Math.floor(Math.random() * 10) + 1,
    };
    
    // Generate camera IDs
    const cameraIds = ['camera1', 'camera2', 'camera3', 'camera4', 'camera5', 'camera6', 'camera7', 'camera8'];
    
    // Generate event distribution by camera
    const eventsByCamera: Record<string, number> = {};
    cameraIds.forEach(cameraId => {
      eventsByCamera[cameraId] = Math.floor(Math.random() * 100) + 20;
    });
    
    // Generate recording distribution by camera
    const recordingsByCamera: Record<string, number> = {};
    cameraIds.forEach(cameraId => {
      recordingsByCamera[cameraId] = Math.floor(Math.random() * 50) + 10;
    });
    
    // Generate event distribution by time
    const eventsByTime = dates.map(date => ({
      date,
      count: Math.floor(Math.random() * 50) + 10,
    }));
    
    // Generate detection distribution by time
    const detectionsByTime = dates.map(date => ({
      date,
      count: Math.floor(Math.random() * 80) + 20,
    }));
    
    // Generate recording distribution by time
    const recordingsByTime = dates.map(date => ({
      date,
      count: Math.floor(Math.random() * 30) + 5,
      sizeGB: parseFloat((Math.random() * 5 + 1).toFixed(1)),
    }));
    
    // Generate API response times
    const apiEndpoints = [
      '/api/cameras', 
      '/api/events', 
      '/api/recordings', 
      '/api/detection',
      '/api/users', 
      '/api/system', 
      '/api/analytics'
    ];
    
    const apiResponseTimes = apiEndpoints.map(endpoint => ({
      endpoint,
      avgResponseTime: Math.floor(Math.random() * 200) + 50,
      p95ResponseTime: Math.floor(Math.random() * 400) + 200,
      errorRate: parseFloat((Math.random() * 5).toFixed(1)),
    }));
    
    // Generate processing times
    const processingOperations = [
      { service: 'object-detection', operation: 'Frame Analysis' },
      { service: 'object-detection', operation: 'Object Classification' },
      { service: 'recording', operation: 'Video Encoding' },
      { service: 'recording', operation: 'Segment Processing' },
      { service: 'stream-ingestion', operation: 'Stream Decoding' },
      { service: 'metadata-events', operation: 'Event Processing' },
      { service: 'metadata-events', operation: 'Database Write' },
    ];
    
    const processingTimes = processingOperations.map(op => ({
      ...op,
      avgTime: Math.floor(Math.random() * 300) + 50,
    }));
    
    // Generate resource usage over time
    const timestamps = Array(24).fill(0).map((_, i) => 
      format(new Date(new Date().setHours(i, 0, 0, 0)), 'yyyy-MM-dd\'T\'HH:mm:ss')
    );
    
    const resources = timestamps.map(timestamp => {
      // Create some patterns in the data
      const hour = parseInt(timestamp.slice(11, 13), 10);
      let cpuFactor = 1;
      let memoryFactor = 1;
      let networkFactor = 1;
      
      // Simulate higher load during business hours
      if (hour >= 9 && hour <= 17) {
        cpuFactor = 1.5;
        memoryFactor = 1.3;
        networkFactor = 1.8;
      }
      
      // Simulate peak at lunch time
      if (hour >= 12 && hour <= 14) {
        cpuFactor = 1.8;
        networkFactor = 2;
      }
      
      // Simulate overnight processing
      if (hour >= 2 && hour <= 4) {
        cpuFactor = 1.3;
        memoryFactor = 1.2;
      }
      
      return {
        timestamp,
        cpuUsage: parseFloat((Math.random() * 30 * cpuFactor + 20).toFixed(1)),
        memoryUsage: parseFloat((Math.random() * 20 * memoryFactor + 40).toFixed(1)),
        diskUsage: parseFloat((Math.random() * 10 + 50).toFixed(1)),
        networkIn: parseFloat((Math.random() * 500 * networkFactor + 100).toFixed(1)),
        networkOut: parseFloat((Math.random() * 200 * networkFactor + 50).toFixed(1)),
      };
    });
    
    // Generate confidence distribution
    const confidenceRanges = [
      { range: '90-100%', count: Math.floor(Math.random() * 150) + 100 },
      { range: '80-90%', count: Math.floor(Math.random() * 100) + 50 },
      { range: '70-80%', count: Math.floor(Math.random() * 50) + 20 },
      { range: '< 70%', count: Math.floor(Math.random() * 30) + 10 },
    ];
    
    // Generate storage growth prediction
    const futureDates = Array(14).fill(0).map((_, i) => 
      format(new Date(new Date().setDate(new Date().getDate() - 7 + i)), 'yyyy-MM-dd')
    );
    
    const storageGrowth = futureDates.map(date => {
      const dateObj = new Date(date);
      const isActual = isBefore(dateObj, new Date()) || dateObj.setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0);
      
      return {
        date,
        predicted: parseFloat((Math.random() * 2 + 10 + (new Date(date).getDate() - new Date().getDate() + 7) * 0.5).toFixed(1)),
        ...(isActual ? { actual: parseFloat((Math.random() * 2 + 10 + (new Date(date).getDate() - new Date().getDate() + 7) * 0.5).toFixed(1)) } : {}),
      };
    });
    
    // Generate event frequency by hour
    const eventFrequency = Array(24).fill(0).map((_, i) => ({
      hour: i,
      frequency: Math.floor(Math.random() * 50) + 10 + (i >= 9 && i <= 17 ? 30 : 0) + (i >= 12 && i <= 14 ? 20 : 0),
    }));
    
    // Generate detection hotspots
    const detectionHotspots = cameraIds.map(cameraId => ({
      cameraId,
      frequency: Math.floor(Math.random() * 80) + 20,
    })).sort((a, b) => b.frequency - a.frequency);
    
    return {
      status: 'ok',
      cameras: {
        total: Object.values(cameraTypes).reduce((acc, val) => acc + val, 0),
        active: Math.floor(Object.values(cameraTypes).reduce((acc, val) => acc + val, 0) * 0.8),
        byType: cameraTypes,
        byStatus: {
          online: Math.floor(Object.values(cameraTypes).reduce((acc, val) => acc + val, 0) * 0.7),
          offline: Math.floor(Object.values(cameraTypes).reduce((acc, val) => acc + val, 0) * 0.2),
          error: Math.floor(Object.values(cameraTypes).reduce((acc, val) => acc + val, 0) * 0.1),
        },
      },
      events: {
        total: Object.values(events).reduce((acc, val) => acc + val, 0),
        byType: events,
        byTime: eventsByTime,
        byCamera: eventsByCamera,
      },
      detections: {
        total: Object.values(objects).reduce((acc, val) => acc + val, 0),
        byObject: objects,
        byTime: detectionsByTime,
        byConfidence: confidenceRanges,
      },
      recordings: {
        total: recordingsByTime.reduce((acc, val) => acc + val.count, 0),
        sizeGB: recordingsByTime.reduce((acc, val) => acc + val.sizeGB, 0),
        byCamera: recordingsByCamera,
        byTime: recordingsByTime,
      },
      performance: {
        apiResponseTimes,
        processingTimes,
        resources,
      },
      predictions: {
        storageGrowth,
        eventFrequency,
        detectionHotspots,
      },
    };
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Advanced Analytics Dashboard</Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Toggle Filters">
            <IconButton onClick={toggleFilters}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Data">
            <IconButton onClick={exportCSV}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Button 
            startIcon={<RefreshIcon />}
            variant="contained"
            onClick={fetchAnalyticsData}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </Box>
      </Box>
      
      <Typography variant="body2" color="textSecondary" mb={2}>
        Last updated: {format(lastUpdated, 'MMM dd, yyyy HH:mm:ss')}
      </Typography>
      
      {renderDateFilters()}
      
      {error && (
        <Box mb={3}>
          <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        </Box>
      )}
      
      <Tabs 
        value={currentTab} 
        onChange={handleTabChange}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Overview" />
        <Tab label="Camera Analytics" />
        <Tab label="Detection Analytics" />
        <Tab label="Performance" />
        <Tab label="Predictive" />
      </Tabs>
      
      {loading ? (
        <Box display="flex" justifyContent="center" my={5}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {currentTab === 0 && renderOverview()}
          {currentTab === 1 && renderCameraAnalytics()}
          {currentTab === 2 && renderDetectionAnalytics()}
          {currentTab === 3 && renderPerformanceAnalytics()}
          {currentTab === 4 && renderPredictiveAnalytics()}
        </>
      )}
    </Box>
  );
};

export default AdvancedAnalytics;