import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { AuthProvider } from './contexts/AuthContext';

// Lazy loading utilities
import { 
  lazyLoadCritical, 
  lazyLoadStandard, 
  lazyLoadHeavyweight,
  prefetchComponent 
} from './utils/lazyLoad';

// Critical components (load first, minimal delay)
const Layout = lazyLoadCritical(() => import('./components/Layout'));
const Login = lazyLoadCritical(() => import('./pages/Login'));
const Dashboard = lazyLoadCritical(() => import('./pages/Dashboard'));

// Standard components (regular priority)
const Cameras = lazyLoadStandard(() => import('./pages/Cameras'));
const Recordings = lazyLoadStandard(() => import('./pages/Recordings'));
const Events = lazyLoadStandard(() => import('./pages/Events'));

// Heavyweight components (load last, can tolerate delay)
const Settings = lazyLoadHeavyweight(() => import('./pages/Settings'));
const SystemMonitoring = lazyLoadHeavyweight(() => import('./pages/SystemMonitoring'));
const NotFound = lazyLoadHeavyweight(() => import('./pages/NotFound'));

// Loading fallbacks
const LoadingFallback = () => (
  <Box 
    sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      bgcolor: 'background.default'
    }}
  >
    <CircularProgress />
  </Box>
);

const ContentLoadingFallback = () => (
  <Box 
    sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      height: 'calc(100vh - 64px)',
      width: '100%',
      bgcolor: 'background.default'
    }}
  >
    <CircularProgress />
  </Box>
);

// Define the theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
  },
});

// Protected route component
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

// Prefetch components that might be needed soon
const prefetchImportantComponents = () => {
  // When user is authenticated, prefetch common components
  if (localStorage.getItem('token') !== null) {
    prefetchComponent(() => import('./pages/Cameras'));
    prefetchComponent(() => import('./pages/Events'));
    prefetchComponent(() => import('./pages/Recordings'));
  }
};

function App() {
  // Start prefetching components
  React.useEffect(() => {
    prefetchImportantComponents();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={
                  <Suspense fallback={<ContentLoadingFallback />}>
                    <Dashboard />
                  </Suspense>
                } />
                <Route path="cameras" element={
                  <Suspense fallback={<ContentLoadingFallback />}>
                    <Cameras />
                  </Suspense>
                } />
                <Route path="recordings" element={
                  <Suspense fallback={<ContentLoadingFallback />}>
                    <Recordings />
                  </Suspense>
                } />
                <Route path="events" element={
                  <Suspense fallback={<ContentLoadingFallback />}>
                    <Events />
                  </Suspense>
                } />
                <Route path="settings" element={
                  <Suspense fallback={<ContentLoadingFallback />}>
                    <Settings />
                  </Suspense>
                } />
                <Route path="monitoring" element={
                  <Suspense fallback={<ContentLoadingFallback />}>
                    <SystemMonitoring />
                  </Suspense>
                } />
                <Route path="*" element={
                  <Suspense fallback={<ContentLoadingFallback />}>
                    <NotFound />
                  </Suspense>
                } />
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;