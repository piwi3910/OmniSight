import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Checkbox,
  FormControlLabel,
  Alert,
  AlertTitle,
  Snackbar,
  Tab,
  Tabs,
  Switch,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Extension as ExtensionIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Webhook as WebhookIcon,
  Code as CodeIcon,
  Send as SendIcon,
  SettingsRemote as SettingsRemoteIcon,
  VpnKey as VpnKeyIcon,
  ContentCopy as ContentCopyIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

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
      id={`extension-tabpanel-${index}`}
      aria-labelledby={`extension-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

interface Extension {
  id: string;
  name: string;
  description: string;
  developer: string;
  email: string;
  scopes: string[];
  callbackUrl?: string;
  active: boolean;
  created: Date;
  updated: Date;
  lastUsed?: Date;
}

interface Webhook {
  id: string;
  extensionId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created: Date;
  updated: Date;
  lastTriggered?: Date;
  failureCount?: number;
}

interface Capability {
  scope: string;
  description: string;
}

interface EventType {
  event: string;
  description: string;
}

const ExtensionManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [capabilities, setCapabilities] = useState<{ scopes: Capability[], events: EventType[] }>({
    scopes: [],
    events: []
  });
  const [loading, setLoading] = useState(false);
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'extension' | 'webhook', id: string } | null>(null);
  const [regenerateConfirmationOpen, setRegenerateConfirmationOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ apiKey: string, apiSecret: string } | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);

  // Form state
  const [extensionForm, setExtensionForm] = useState({
    name: '',
    description: '',
    developer: '',
    email: '',
    callbackUrl: '',
    scopes: [] as string[],
    active: true,
    isEditing: false
  });
  
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    active: true,
    isEditing: false
  });

  // Load extensions and capabilities on component mount
  useEffect(() => {
    fetchExtensions();
    fetchCapabilities();
  }, []);

  // Load webhooks when extension is selected
  useEffect(() => {
    if (selectedExtension) {
      fetchWebhooks(selectedExtension.id);
    } else {
      setWebhooks([]);
    }
  }, [selectedExtension]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Fetch extensions
  const fetchExtensions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/extensions`);
      setExtensions(response.data.extensions);
    } catch (error) {
      console.error('Error fetching extensions:', error);
      showSnackbar('Failed to fetch extensions', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch webhooks for an extension
  const fetchWebhooks = async (extensionId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/extensions/${extensionId}/webhooks`);
      setWebhooks(response.data.webhooks);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      showSnackbar('Failed to fetch webhooks', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch capabilities
  const fetchCapabilities = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extensions/capabilities`);
      setCapabilities(response.data);
    } catch (error) {
      console.error('Error fetching capabilities:', error);
    }
  };

  // Show snackbar message
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  // Handle extension selection
  const handleSelectExtension = (extension: Extension) => {
    setSelectedExtension(extension);
    setActiveTab(0); // Switch to extension details tab
  };

  // Open extension dialog for creating/editing
  const openExtensionDialog = (extension?: Extension) => {
    if (extension) {
      // Editing existing extension
      setExtensionForm({
        name: extension.name,
        description: extension.description,
        developer: extension.developer,
        email: extension.email,
        callbackUrl: extension.callbackUrl || '',
        scopes: extension.scopes,
        active: extension.active,
        isEditing: true
      });
    } else {
      // Creating new extension
      setExtensionForm({
        name: '',
        description: '',
        developer: '',
        email: '',
        callbackUrl: '',
        scopes: [],
        active: true,
        isEditing: false
      });
    }
    setExtensionDialogOpen(true);
  };

  // Open webhook dialog for creating/editing
  const openWebhookDialog = (webhook?: Webhook) => {
    if (!selectedExtension) {
      showSnackbar('Please select an extension first', 'error');
      return;
    }
    
    if (webhook) {
      // Editing existing webhook
      setWebhookForm({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
        active: webhook.active,
        isEditing: true
      });
      setSelectedWebhook(webhook);
    } else {
      // Creating new webhook
      setWebhookForm({
        name: '',
        url: '',
        events: [],
        secret: '',
        active: true,
        isEditing: false
      });
      setSelectedWebhook(null);
    }
    setWebhookDialogOpen(true);
  };

  // Handle saving extension
  const handleSaveExtension = async () => {
    try {
      setLoading(true);
      
      const extensionData = {
        name: extensionForm.name,
        description: extensionForm.description,
        developer: extensionForm.developer,
        email: extensionForm.email,
        callbackUrl: extensionForm.callbackUrl || undefined,
        scopes: extensionForm.scopes,
        active: extensionForm.active
      };
      
      let response;
      
      if (extensionForm.isEditing && selectedExtension) {
        // Update existing extension
        response = await axios.put(`${API_BASE_URL}/extensions/${selectedExtension.id}`, extensionData);
        showSnackbar('Extension updated successfully', 'success');
      } else {
        // Create new extension
        response = await axios.post(`${API_BASE_URL}/extensions`, extensionData);
        
        // Show credentials dialog
        if (response.data.credentials) {
          setNewCredentials(response.data.credentials);
          setCredentialsDialogOpen(true);
        }
        
        showSnackbar('Extension created successfully', 'success');
      }
      
      // Refresh extensions list
      fetchExtensions();
      
      // Update selected extension if editing
      if (extensionForm.isEditing && selectedExtension) {
        setSelectedExtension({
          ...selectedExtension,
          ...extensionData
        });
      }
      
      // Close dialog
      setExtensionDialogOpen(false);
    } catch (error) {
      console.error('Error saving extension:', error);
      showSnackbar('Failed to save extension', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle saving webhook
  const handleSaveWebhook = async () => {
    if (!selectedExtension) {
      showSnackbar('No extension selected', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      const webhookData = {
        name: webhookForm.name,
        url: webhookForm.url,
        events: webhookForm.events,
        secret: webhookForm.secret || undefined,
        active: webhookForm.active
      };
      
      let response;
      
      if (webhookForm.isEditing && selectedWebhook) {
        // Update existing webhook
        response = await axios.put(
          `${API_BASE_URL}/extensions/${selectedExtension.id}/webhooks/${selectedWebhook.id}`, 
          webhookData
        );
        showSnackbar('Webhook updated successfully', 'success');
      } else {
        // Create new webhook
        response = await axios.post(
          `${API_BASE_URL}/extensions/${selectedExtension.id}/webhooks`, 
          webhookData
        );
        showSnackbar('Webhook created successfully', 'success');
      }
      
      // Refresh webhooks list
      fetchWebhooks(selectedExtension.id);
      
      // Close dialog
      setWebhookDialogOpen(false);
    } catch (error) {
      console.error('Error saving webhook:', error);
      showSnackbar('Failed to save webhook', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteConfirmation = (type: 'extension' | 'webhook', id: string) => {
    setItemToDelete({ type, id });
    setDeleteConfirmationOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    try {
      setLoading(true);
      
      if (itemToDelete.type === 'extension') {
        await axios.delete(`${API_BASE_URL}/extensions/${itemToDelete.id}`);
        
        // Refresh extensions list
        fetchExtensions();
        
        // Clear selected extension if it was deleted
        if (selectedExtension && selectedExtension.id === itemToDelete.id) {
          setSelectedExtension(null);
        }
        
        showSnackbar('Extension deleted successfully', 'success');
      } else {
        // Delete webhook
        if (!selectedExtension) return;
        
        await axios.delete(`${API_BASE_URL}/extensions/${selectedExtension.id}/webhooks/${itemToDelete.id}`);
        
        // Refresh webhooks list
        fetchWebhooks(selectedExtension.id);
        
        showSnackbar('Webhook deleted successfully', 'success');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showSnackbar(`Failed to delete ${itemToDelete.type}`, 'error');
    } finally {
      setLoading(false);
      setDeleteConfirmationOpen(false);
      setItemToDelete(null);
    }
  };

  // Open regenerate credentials confirmation dialog
  const openRegenerateConfirmation = () => {
    if (!selectedExtension) return;
    setRegenerateConfirmationOpen(true);
  };

  // Handle regenerate credentials confirmation
  const handleRegenerateConfirm = async () => {
    if (!selectedExtension) return;
    
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/extensions/${selectedExtension.id}/regenerate`);
      
      // Show credentials dialog
      if (response.data.credentials) {
        setNewCredentials(response.data.credentials);
        setCredentialsDialogOpen(true);
      }
      
      showSnackbar('Credentials regenerated successfully', 'success');
    } catch (error) {
      console.error('Error regenerating credentials:', error);
      showSnackbar('Failed to regenerate credentials', 'error');
    } finally {
      setLoading(false);
      setRegenerateConfirmationOpen(false);
    }
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        showSnackbar('Copied to clipboard', 'success');
      },
      (err) => {
        console.error('Could not copy text: ', err);
        showSnackbar('Failed to copy to clipboard', 'error');
      }
    );
  };

  // Test webhook
  const handleTestWebhook = async (webhookId: string) => {
    if (!selectedExtension) return;
    
    try {
      setTestingWebhook(webhookId);
      
      const response = await axios.post(
        `${API_BASE_URL}/extensions/${selectedExtension.id}/webhooks/${webhookId}/test`
      );
      
      setTestResult({
        success: response.data.success,
        message: response.data.message
      });
      
      showSnackbar(
        response.data.success ? 'Webhook test successful' : 'Webhook test failed', 
        response.data.success ? 'success' : 'error'
      );
    } catch (error) {
      console.error('Error testing webhook:', error);
      showSnackbar('Failed to test webhook', 'error');
      setTestResult({
        success: false,
        message: 'Failed to test webhook'
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          <ExtensionIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Extension Management
        </Typography>
        
        <Grid container spacing={3}>
          {/* Extensions List */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
                <Typography variant="h6">
                  Extensions
                </Typography>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => openExtensionDialog()}
                >
                  New Extension
                </Button>
              </Box>
              
              <Divider />
              
              {loading && extensions.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : extensions.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    No extensions found. Create your first extension to get started.
                  </Typography>
                </Box>
              ) : (
                <List sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 600, overflow: 'auto' }}>
                  {extensions.map((extension) => (
                    <ListItem 
                      key={extension.id}
                      button
                      selected={selectedExtension?.id === extension.id}
                      onClick={() => handleSelectExtension(extension)}
                    >
                      <ListItemAvatar>
                        <CodeIcon fontSize="large" color={extension.active ? "primary" : "disabled"} />
                      </ListItemAvatar>
                      <ListItemText
                        primary={extension.name}
                        secondary={
                          <>
                            <Typography component="span" variant="body2">
                              {extension.developer}
                            </Typography>
                            <br />
                            <Typography component="span" variant="body2" color="text.secondary">
                              {extension.description.slice(0, 50)}{extension.description.length > 50 ? '...' : ''}
                            </Typography>
                          </>
                        }
                      />
                      {selectedExtension?.id === extension.id && (
                        <ListItemSecondaryAction>
                          <IconButton 
                            edge="end" 
                            onClick={() => openExtensionDialog(extension)}
                            size="small"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton 
                            edge="end" 
                            onClick={() => openDeleteConfirmation('extension', extension.id)}
                            size="small"
                            sx={{ ml: 1 }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
          
          {/* Extension Details */}
          <Grid item xs={12} md={8}>
            {selectedExtension ? (
              <Paper sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={activeTab} onChange={handleTabChange} aria-label="extension tabs">
                    <Tab label="Details" id="extension-tab-0" aria-controls="extension-tabpanel-0" />
                    <Tab label="Webhooks" id="extension-tab-1" aria-controls="extension-tabpanel-1" />
                    <Tab label="API Keys" id="extension-tab-2" aria-controls="extension-tabpanel-2" />
                  </Tabs>
                </Box>
                
                {/* Details Tab */}
                <TabPanel value={activeTab} index={0}>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        {selectedExtension.name}
                      </Typography>
                      <Typography variant="body1" paragraph>
                        {selectedExtension.description}
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2">Developer</Typography>
                          <Typography variant="body2" gutterBottom>{selectedExtension.developer}</Typography>
                          
                          <Typography variant="subtitle2" sx={{ mt: 2 }}>Contact Email</Typography>
                          <Typography variant="body2" gutterBottom>{selectedExtension.email}</Typography>
                          
                          {selectedExtension.callbackUrl && (
                            <>
                              <Typography variant="subtitle2" sx={{ mt: 2 }}>Callback URL</Typography>
                              <Typography variant="body2" gutterBottom>{selectedExtension.callbackUrl}</Typography>
                            </>
                          )}
                          
                          <Typography variant="subtitle2" sx={{ mt: 2 }}>Status</Typography>
                          <Chip 
                            label={selectedExtension.active ? 'Active' : 'Inactive'} 
                            color={selectedExtension.active ? 'success' : 'default'}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2">Created</Typography>
                          <Typography variant="body2" gutterBottom>
                            {new Date(selectedExtension.created).toLocaleString()}
                          </Typography>
                          
                          <Typography variant="subtitle2" sx={{ mt: 2 }}>Last Updated</Typography>
                          <Typography variant="body2" gutterBottom>
                            {new Date(selectedExtension.updated).toLocaleString()}
                          </Typography>
                          
                          {selectedExtension.lastUsed && (
                            <>
                              <Typography variant="subtitle2" sx={{ mt: 2 }}>Last Used</Typography>
                              <Typography variant="body2" gutterBottom>
                                {new Date(selectedExtension.lastUsed).toLocaleString()}
                              </Typography>
                            </>
                          )}
                          
                          <Typography variant="subtitle2" sx={{ mt: 2 }}>Scopes</Typography>
                          <Box sx={{ mt: 1 }}>
                            {selectedExtension.scopes.map((scope) => (
                              <Chip 
                                key={scope} 
                                label={scope} 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                                sx={{ mr: 1, mb: 1 }}
                              />
                            ))}
                          </Box>
                        </Grid>
                      </Grid>
                      
                      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="outlined"
                          color="primary"
                          startIcon={<EditIcon />}
                          onClick={() => openExtensionDialog(selectedExtension)}
                          sx={{ mr: 1 }}
                        >
                          Edit Extension
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => openDeleteConfirmation('extension', selectedExtension.id)}
                        >
                          Delete Extension
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </TabPanel>
                
                {/* Webhooks Tab */}
                <TabPanel value={activeTab} index={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">
                      Webhooks
                    </Typography>
                    
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AddIcon />}
                      onClick={() => openWebhookDialog()}
                    >
                      New Webhook
                    </Button>
                  </Box>
                  
                  {loading && webhooks.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <CircularProgress />
                    </Box>
                  ) : webhooks.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="body1" color="text.secondary">
                        No webhooks found. Create a webhook to receive event notifications.
                      </Typography>
                    </Box>
                  ) : (
                    <List>
                      {webhooks.map((webhook) => (
                        <Paper key={webhook.id} sx={{ mb: 2, p: 2 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle1">
                                {webhook.name}
                                {webhook.active ? (
                                  <Chip 
                                    label="Active" 
                                    color="success" 
                                    size="small" 
                                    sx={{ ml: 1 }}
                                  />
                                ) : (
                                  <Chip 
                                    label="Inactive" 
                                    color="default" 
                                    size="small" 
                                    sx={{ ml: 1 }}
                                  />
                                )}
                              </Typography>
                              <Typography variant="body2" gutterBottom>
                                {webhook.url}
                              </Typography>
                              
                              <Typography variant="subtitle2" sx={{ mt: 1 }}>Events</Typography>
                              <Box sx={{ mt: 0.5 }}>
                                {webhook.events.map((event) => (
                                  <Chip 
                                    key={event} 
                                    label={event} 
                                    size="small" 
                                    color="info" 
                                    variant="outlined"
                                    sx={{ mr: 1, mb: 1 }}
                                  />
                                ))}
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  startIcon={testingWebhook === webhook.id ? <CircularProgress size={20} /> : <SendIcon />}
                                  onClick={() => handleTestWebhook(webhook.id)}
                                  sx={{ mr: 1 }}
                                  disabled={testingWebhook !== null}
                                >
                                  Test
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  startIcon={<EditIcon />}
                                  onClick={() => openWebhookDialog(webhook)}
                                  sx={{ mr: 1 }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="error"
                                  startIcon={<DeleteIcon />}
                                  onClick={() => openDeleteConfirmation('webhook', webhook.id)}
                                >
                                  Delete
                                </Button>
                              </Box>
                              
                              {webhook.lastTriggered && (
                                <Typography variant="body2" sx={{ mt: 2, textAlign: 'right' }}>
                                  Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                                </Typography>
                              )}
                              
                              {webhook.failureCount !== undefined && webhook.failureCount > 0 && (
                                <Alert severity="warning" sx={{ mt: 2 }}>
                                  Failed delivery attempts: {webhook.failureCount}
                                </Alert>
                              )}
                              
                              {testResult && testingWebhook === webhook.id && (
                                <Alert 
                                  severity={testResult.success ? 'success' : 'error'}
                                  sx={{ mt: 2 }}
                                >
                                  {testResult.message}
                                </Alert>
                              )}
                            </Grid>
                          </Grid>
                        </Paper>
                      ))}
                    </List>
                  )}
                </TabPanel>
                
                {/* API Keys Tab */}
                <TabPanel value={activeTab} index={2}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      API Credentials
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      API keys are used to authenticate API requests from your extension.
                      The API key is shown here, but the API secret is only displayed once when created or regenerated.
                    </Typography>
                    
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <AlertTitle>Security Warning</AlertTitle>
                      Regenerating API credentials will invalidate the current credentials and require updating your application.
                    </Alert>
                    
                    <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2">API Key</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, mb: 2 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', mr: 1 }}>
                          {selectedExtension.apiKey || '[HIDDEN]'}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => handleCopyToClipboard(selectedExtension.apiKey)}
                          disabled={!selectedExtension.apiKey}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      <Typography variant="subtitle2">API Secret</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                        [HIDDEN]
                      </Typography>
                      
                      <Box sx={{ mt: 3 }}>
                        <Button
                          variant="contained"
                          color="warning"
                          startIcon={<VpnKeyIcon />}
                          onClick={openRegenerateConfirmation}
                        >
                          Regenerate Credentials
                        </Button>
                      </Box>
                    </Paper>
                  </Box>
                </TabPanel>
              </Paper>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <SettingsRemoteIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.5 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                  Select an extension to view its details
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Or create a new extension using the button on the left
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
        
        {/* Extension Dialog */}
        <Dialog 
          open={extensionDialogOpen} 
          onClose={() => setExtensionDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {extensionForm.isEditing ? 'Edit Extension' : 'Create New Extension'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  fullWidth
                  value={extensionForm.name}
                  onChange={(e) => setExtensionForm({ ...extensionForm, name: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={extensionForm.description}
                  onChange={(e) => setExtensionForm({ ...extensionForm, description: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Developer Name"
                  fullWidth
                  value={extensionForm.developer}
                  onChange={(e) => setExtensionForm({ ...extensionForm, developer: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Contact Email"
                  fullWidth
                  type="email"
                  value={extensionForm.email}
                  onChange={(e) => setExtensionForm({ ...extensionForm, email: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Callback URL (Optional)"
                  fullWidth
                  value={extensionForm.callbackUrl}
                  onChange={(e) => setExtensionForm({ ...extensionForm, callbackUrl: e.target.value })}
                  placeholder="https://example.com/callback"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Permissions (Scopes)
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Select the permissions this extension will have
                </Typography>
                
                <Grid container spacing={1}>
                  {capabilities.scopes.map((scope) => (
                    <Grid item xs={12} md={6} key={scope.scope}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={extensionForm.scopes.includes(scope.scope)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExtensionForm({
                                  ...extensionForm,
                                  scopes: [...extensionForm.scopes, scope.scope]
                                });
                              } else {
                                setExtensionForm({
                                  ...extensionForm,
                                  scopes: extensionForm.scopes.filter(s => s !== scope.scope)
                                });
                              }
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{scope.scope}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {scope.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={extensionForm.active}
                      onChange={(e) => setExtensionForm({ ...extensionForm, active: e.target.checked })}
                    />
                  }
                  label="Extension Active"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExtensionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveExtension} 
              variant="contained" 
              disabled={loading || !extensionForm.name || !extensionForm.description || !extensionForm.developer || !extensionForm.email || extensionForm.scopes.length === 0}
              startIcon={loading ? <CircularProgress size={24} /> : null}
            >
              {extensionForm.isEditing ? 'Update Extension' : 'Create Extension'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Webhook Dialog */}
        <Dialog 
          open={webhookDialogOpen} 
          onClose={() => setWebhookDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {webhookForm.isEditing ? 'Edit Webhook' : 'Create New Webhook'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  fullWidth
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="URL"
                  fullWidth
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Secret (Optional)"
                  fullWidth
                  value={webhookForm.secret}
                  onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                  placeholder="Leave blank to generate automatically"
                  helperText="Used to verify webhook requests with HMAC signatures"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Events
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Select the events this webhook will receive
                </Typography>
                
                <Grid container spacing={1}>
                  {capabilities.events.map((event) => (
                    <Grid item xs={12} md={6} key={event.event}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={webhookForm.events.includes(event.event)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWebhookForm({
                                  ...webhookForm,
                                  events: [...webhookForm.events, event.event]
                                });
                              } else {
                                setWebhookForm({
                                  ...webhookForm,
                                  events: webhookForm.events.filter(s => s !== event.event)
                                });
                              }
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{event.event}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {event.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={webhookForm.active}
                      onChange={(e) => setWebhookForm({ ...webhookForm, active: e.target.checked })}
                    />
                  }
                  label="Webhook Active"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWebhookDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveWebhook} 
              variant="contained" 
              disabled={loading || !webhookForm.name || !webhookForm.url || webhookForm.events.length === 0}
              startIcon={loading ? <CircularProgress size={24} /> : null}
            >
              {webhookForm.isEditing ? 'Update Webhook' : 'Create Webhook'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmationOpen}
          onClose={() => setDeleteConfirmationOpen(false)}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Warning</AlertTitle>
              This action cannot be undone.
            </Alert>
            <Typography variant="body1">
              Are you sure you want to delete this {itemToDelete?.type}?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmationOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteConfirm} 
              variant="contained" 
              color="error"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={24} /> : null}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Regenerate Credentials Confirmation Dialog */}
        <Dialog
          open={regenerateConfirmationOpen}
          onClose={() => setRegenerateConfirmationOpen(false)}
        >
          <DialogTitle>Confirm Regenerate Credentials</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Warning</AlertTitle>
              Regenerating API credentials will invalidate the current credentials.
              Any applications using the current credentials will stop working.
            </Alert>
            <Typography variant="body1">
              Are you sure you want to regenerate the API credentials?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRegenerateConfirmationOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRegenerateConfirm} 
              variant="contained" 
              color="warning"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={24} /> : null}
            >
              Regenerate
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Credentials Display Dialog */}
        <Dialog
          open={credentialsDialogOpen}
          onClose={() => setCredentialsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>API Credentials</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>Important</AlertTitle>
              These credentials will only be shown once. Please save them securely.
            </Alert>
            
            {newCredentials && (
              <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2">API Key</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, mb: 2 }}>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                    {newCredentials.apiKey}
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => handleCopyToClipboard(newCredentials.apiKey)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                
                <Typography variant="subtitle2">API Secret</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                    {newCredentials.apiSecret}
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => handleCopyToClipboard(newCredentials.apiSecret)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            )}
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setCredentialsDialogOpen(false)}
              variant="contained"
            >
              I've Saved These Credentials
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
};

export default ExtensionManagement;