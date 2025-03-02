import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * Create proxy middleware for a service
 */
export const createServiceProxy = (
  serviceName: keyof typeof config.services,
  pathRewrite?: { [key: string]: string }
): any => {
  const service = config.services[serviceName];
  
  if (!service) {
    throw new Error(`Service ${serviceName} not found in configuration`);
  }
  
  const options: Options = {
    target: service.url,
    changeOrigin: true,
    pathRewrite,
    timeout: service.timeout,
    logLevel: 'silent', // We'll handle logging ourselves
    onProxyReq: (proxyReq, req, res) => {
      // Add user info to headers if available
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      
      // Log proxy request
      logger.debug(`Proxying request to ${serviceName}: ${req.method} ${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Log proxy response
      logger.debug(`Proxy response from ${serviceName}: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}:`, err);
      
      // Send error response
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: `Error connecting to ${serviceName} service`
        });
      }
    }
  };
  
  return createProxyMiddleware(options);
};

/**
 * Metadata & Events Service proxy
 */
export const metadataEventsProxy = createServiceProxy('metadataEvents', {
  '^/api/v1/metadata': '/api',
  '^/api/v1/events': '/api/events',
  '^/api/v1/cameras': '/api/cameras',
  '^/api/v1/recordings': '/api/recordings',
  '^/api/v1/segments': '/api/segments',
  '^/api/v1/users': '/api/users'
});

/**
 * Stream Ingestion Service proxy
 */
export const streamIngestionProxy = createServiceProxy('streamIngestion', {
  '^/api/v1/streams': '/api/streams'
});

/**
 * Recording Service proxy
 */
export const recordingProxy = createServiceProxy('recording', {
  '^/api/v1/recordings': '/api/recordings',
  '^/api/v1/segments': '/api/segments'
});

/**
 * Object Detection Service proxy
 */
export const objectDetectionProxy = createServiceProxy('objectDetection', {
  '^/api/v1/detection': '/api/detection'
});

/**
 * WebSocket proxy for real-time events
 */
export const websocketProxy = createProxyMiddleware({
  target: config.services.metadataEvents.url,
  ws: true,
  changeOrigin: true,
  pathRewrite: {
    '^/ws': '/socket.io'
  },
  logLevel: 'silent',
  onError: (err, req, res) => {
    logger.error('WebSocket proxy error:', err);
    
    // For WebSocket connections, we can't send a response
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end('WebSocket proxy error');
    }
  }
});