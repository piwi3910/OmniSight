import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import HeatMap from 'react-heatmap-grid';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DownloadIcon from '@mui/icons-material/Download';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// Tab Panel Component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

interface AnalyticsDashboardProps {
  period?: 'day' | 'week' | 'month' | 'year';
  startDate?: Date;
  endDate?: Date;
  cameraIds?: string[];
  eventTypes?: string[];
  objectTypes?: string[];
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  period = 'week',
  startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  endDate = new Date(),
  cameraIds = [],
  eventTypes = [],
  objectTypes = []
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>(period);
  const [dateRange, setDateRange] = useState({ start: startDate, end: endDate });
  const [selectedCameras, setSelectedCameras] = useState<string[]>(cameraIds);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(eventTypes);
  const [selectedObjectTypes, setSelectedObjectTypes] = useState<string[]>(objectTypes);
  const [cameras, setCameras] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Analytics data
  const [eventData, setEventData] = useState<any[]>([]);
  const [detectionData, setDetectionData] = useState<any[]>([]);
  const [storageData, setStorageData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<number[][]>([]);
  const [heatmapXLabels, setHeatmapXLabels] = useState<string[]>([]);
  const [heatmapYLabels, setHeatmapYLabels] = useState<string[]>([]);

  // Fetch cameras on component mount
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/cameras`);
        setCameras(response.data.map((camera: any) => ({
          id: camera.id,
          name: camera.name
        })));
      } catch (error) {
        console.error('Error fetching cameras:', error);
      }
    };

    fetchCameras();
  }, []);

  // Fetch analytics data when filter parameters change
  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedPeriod, dateRange, selectedCameras, selectedEventTypes, selectedObjectTypes]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle period change
  const handlePeriodChange = (event: SelectChangeEvent<string>) => {
    setSelectedPeriod(event.target.value as 'day' | 'week' | 'month' | 'year');
    
    // Adjust date range based on period
    const end = new Date();
    let start = new Date();
    
    switch (event.target.value) {
      case 'day':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());
        break;
      case 'year':
        start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
        break;
    }
    
    setDateRange({ start, end });
  };

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    setLoading(true);
    
    try {
      // Prepare query parameters
      const params = new URLSearchParams();
      params.append('startDate', dateRange.start.toISOString());
      params.append('endDate', dateRange.end.toISOString());
      
      if (selectedCameras.length > 0) {
        selectedCameras.forEach(cameraId => params.append('cameraId', cameraId));
      }
      
      if (selectedEventTypes.length > 0) {
        selectedEventTypes.forEach(eventType => params.append('eventType', eventType));
      }
      
      if (selectedObjectTypes.length > 0) {
        selectedObjectTypes.forEach(objectType => params.append('objectType', objectType));
      }
      
      // Fetch event analytics
      const eventResponse = await axios.get(`${API_BASE_URL}/analytics/events?${params.toString()}`);
      setEventData(eventResponse.data);
      
      // Fetch detection analytics
      const detectionResponse = await axios.get(`${API_BASE_URL}/analytics/detections?${params.toString()}`);
      setDetectionData(detectionResponse.data);
      
      // Fetch storage analytics
      const storageResponse = await axios.get(`${API_BASE_URL}/analytics/storage?${params.toString()}`);
      setStorageData(storageResponse.data);
      
      // Fetch performance analytics
      const performanceResponse = await axios.get(`${API_BASE_URL}/analytics/performance?${params.toString()}`);
      setPerformanceData(performanceResponse.data);
      
      // Fetch heatmap data
      const heatmapResponse = await axios.get(`${API_BASE_URL}/analytics/heatmap?${params.toString()}`);
      setHeatmapData(heatmapResponse.data.data);
      setHeatmapXLabels(heatmapResponse.data.xLabels);
      setHeatmapYLabels(heatmapResponse.data.yLabels);
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Export analytics data as CSV
  const exportCSV = async () => {
    try {
      // Prepare query parameters
      const params = new URLSearchParams();
      params.append('startDate', dateRange.start.toISOString());
      params.append('endDate', dateRange.end.toISOString());
      
      if (selectedCameras.length > 0) {
        selectedCameras.forEach(cameraId => params.append('cameraId', cameraId));
      }
      
      if (selectedEventTypes.length > 0) {
        selectedEventTypes.forEach(eventType => params.append('eventType', eventType));
      }
      
      if (selectedObjectTypes.length > 0) {
        selectedObjectTypes.forEach(objectType => params.append('objectType', objectType));
      }
      
      // Get export type based on active tab
      let exportType = 'events';
      switch (activeTab) {
        case 0:
          exportType = 'events';
          break;
        case 1:
          exportType = 'detections';
          break;
        case 2:
          exportType = 'storage';
          break;
        case 3:
          exportType = 'performance';
          break;
      }
      
      // Fetch CSV data
      const response = await axios.get(`${API_BASE_URL}/analytics/export/${exportType}?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportType}-analytics-${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting analytics data:', error);
    }
  };

  // Generate sample data for charts (replace with actual data when API is ready)
  const getSampleEventData = () => {
    const data = [];
    const categories = ['Motion', 'Person', 'Vehicle', 'Pet', 'Package'];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const entry: any = {
        date: date.toLocaleDateString(),
      };
      
      categories.forEach(category => {
        entry[category] = Math.floor(Math.random() * 50);
      });
      
      data.unshift(entry);
    }
    
    return data;
  };
  
  const getSampleDetectionData = () => {
    const data = [];
    const categories = ['Person', 'Car', 'Truck', 'Bicycle', 'Dog', 'Cat'];
    
    categories.forEach(category => {
      data.push({
        name: category,
        value: Math.floor(Math.random() * 1000)
      });
    });
    
    return data;
  };
  
  const getSampleStorageData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      data.unshift({
        date: date.toLocaleDateString(),
        used: Math.floor(Math.random() * 50) + 50,
        available: 100
      });
    }
    
    return data;
  };
  
  const getSamplePerformanceData = () => {
    const data = [];
    const metrics = ['CPU', 'Memory', 'Disk', 'Network'];
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() - i);
      
      const entry: any = {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      metrics.forEach(metric => {
        entry[metric] = Math.floor(Math.random() * 100);
      });
      
      data.unshift(entry);
    }
    
    return data;
  };
  
  const getSampleHeatmapData = () => {
    const xLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    const yLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    
    for (let i = 0; i < yLabels.length; i++) {
      const row = [];
      for (let j = 0; j < xLabels.length; j++) {
        row.push(Math.floor(Math.random() * 100));
      }
      data.push(row);
    }
    
    return { data, xLabels, yLabels };
  };

  // Sample data (replace with actual API data)
  const sampleEventData = getSampleEventData();
  const sampleDetectionData = getSampleDetectionData();
  const sampleStorageData = getSampleStorageData();
  const samplePerformanceData = getSamplePerformanceData();
  const sampleHeatmap = getSampleHeatmapData();

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardHeader
          title="Analytics Dashboard"
          subheader="Comprehensive system analytics and statistics"
          avatar={<AssessmentIcon />}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {loading && <CircularProgress size={24} sx={{ mr: 2 }} />}
            </Box>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={3}>
            {/* Filters */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth>
                      <InputLabel id="period-select-label">Time Period</InputLabel>
                      <Select
                        labelId="period-select-label"
                        id="period-select"
                        value={selectedPeriod}
                        label="Time Period"
                        onChange={handlePeriodChange}
                      >
                        <MenuItem value="day">Last 24 Hours</MenuItem>
                        <MenuItem value="week">Last 7 Days</MenuItem>
                        <MenuItem value="month">Last 30 Days</MenuItem>
                        <MenuItem value="year">Last Year</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="Start Date"
                      value={dateRange.start}
                      onChange={(newValue) => newValue && setDateRange({ ...dateRange, start: newValue })}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="End Date"
                      value={dateRange.end}
                      onChange={(newValue) => newValue && setDateRange({ ...dateRange, end: newValue })}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth>
                      <InputLabel id="camera-select-label">Cameras</InputLabel>
                      <Select
                        labelId="camera-select-label"
                        id="camera-select"
                        multiple
                        value={selectedCameras}
                        label="Cameras"
                        onChange={(e) => setSelectedCameras(e.target.value as string[])}
                        renderValue={(selected) => 
                          selected.length === 0 
                            ? 'All Cameras' 
                            : selected.length === 1 
                              ? cameras.find(c => c.id === selected[0])?.name || selected[0]
                              : `${selected.length} cameras selected`
                        }
                      >
                        <MenuItem value="">
                          <em>All Cameras</em>
                        </MenuItem>
                        {cameras.map((camera) => (
                          <MenuItem key={camera.id} value={camera.id}>
                            {camera.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            
            {/* Tabs */}
            <Grid item xs={12}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="analytics tabs">
                  <Tab label="Events" id="analytics-tab-0" aria-controls="analytics-tabpanel-0" />
                  <Tab label="Detections" id="analytics-tab-1" aria-controls="analytics-tabpanel-1" />
                  <Tab label="Storage" id="analytics-tab-2" aria-controls="analytics-tabpanel-2" />
                  <Tab label="Performance" id="analytics-tab-3" aria-controls="analytics-tabpanel-3" />
                  <Tab label="Heatmap" id="analytics-tab-4" aria-controls="analytics-tabpanel-4" />
                </Tabs>
              </Box>
              
              {/* Event Analytics Tab */}
              <TabPanel value={activeTab} index={0}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    <Typography variant="h6" gutterBottom>
                      Event Trend
                    </Typography>
                    <Paper sx={{ p: 2, height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={sampleEventData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="Motion" stackId="1" stroke="#8884d8" fill="#8884d8" />
                          <Area type="monotone" dataKey="Person" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                          <Area type="monotone" dataKey="Vehicle" stackId="1" stroke="#ffc658" fill="#ffc658" />
                          <Area type="monotone" dataKey="Pet" stackId="1" stroke="#ff8042" fill="#ff8042" />
                          <Area type="monotone" dataKey="Package" stackId="1" stroke="#0088fe" fill="#0088fe" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="h6" gutterBottom>
                      Event Distribution
                    </Typography>
                    <Paper sx={{ p: 2, height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sampleDetectionData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {sampleDetectionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </TabPanel>
              
              {/* Detections Analytics Tab */}
              <TabPanel value={activeTab} index={1}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    <Typography variant="h6" gutterBottom>
                      Object Detections Over Time
                    </Typography>
                    <Paper sx={{ p: 2, height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={sampleEventData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Person" fill="#8884d8" />
                          <Bar dataKey="Vehicle" fill="#82ca9d" />
                          <Bar dataKey="Pet" fill="#ffc658" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="h6" gutterBottom>
                      Detection Counts by Type
                    </Typography>
                    <Paper sx={{ p: 2, height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={sampleDetectionData}
                          margin={{ top: 10, right: 30, left: 50, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </TabPanel>
              
              {/* Storage Analytics Tab */}
              <TabPanel value={activeTab} index={2}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      Storage Utilization
                    </Typography>
                    <Paper sx={{ p: 2, height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={sampleStorageData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="used" stackId="1" stroke="#8884d8" fill="#8884d8" />
                          <Area type="monotone" dataKey="available" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </TabPanel>
              
              {/* Performance Analytics Tab */}
              <TabPanel value={activeTab} index={3}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      System Performance
                    </Typography>
                    <Paper sx={{ p: 2, height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={samplePerformanceData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="CPU" stroke="#8884d8" activeDot={{ r: 8 }} />
                          <Line type="monotone" dataKey="Memory" stroke="#82ca9d" />
                          <Line type="monotone" dataKey="Disk" stroke="#ffc658" />
                          <Line type="monotone" dataKey="Network" stroke="#ff8042" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </TabPanel>
              
              {/* Heatmap Tab */}
              <TabPanel value={activeTab} index={4}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      Activity Heatmap
                    </Typography>
                    <Paper sx={{ p: 2, height: 400 }}>
                      <Box sx={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '100%', height: '350px' }}>
                          <HeatMap
                            xLabels={sampleHeatmap.xLabels}
                            yLabels={sampleHeatmap.yLabels}
                            data={sampleHeatmap.data}
                            cellStyle={(background, value, min, max) => ({
                              background: `rgb(0, 151, 230, ${1 - (max - value) / (max - min)})`,
                              fontSize: '11px',
                              color: 'white'
                            })}
                            cellRender={value => value && `${value}`}
                          />
                        </div>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </TabPanel>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

export default AnalyticsDashboard;