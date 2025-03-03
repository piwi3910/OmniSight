import { Server } from 'http';
import { Server as WebSocketServer } from 'socket.io';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { parse } from 'url';
import config from '../config/config';
import logger from '../utils/logger';
import { IncomingMessage } from 'http';

// Define the valid service types to prevent type errors
type ServiceType = 'events' | 'cameras' | 'recordings' | 'detection';

/**
 * Configure WebSocket proxying from API Gateway to backend services
 * 
 * This allows clients to connect to a single WebSocket endpoint,
 * and the API Gateway forwards the connections to the appropriate service.
 */
export class WebSocketProxyManager {
  private io: WebSocketServer;
  private server: Server;
  // Define a properly typed service map
  private serviceMap: Record<ServiceType, string> = {
    'events': config.services.metadataEvents.url,
    'cameras': config.services.streamIngestion.url,
    'recordings': config.services.recording.url,
    'detection': config.services.objectDetection.url
  };

  constructor(server: Server) {
    this.server = server;
    
    // Create Socket.IO server
    this.io = new WebSocketServer(server, {
      path: '/api/v1/ws',
      cors: {
        origin: config.server.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    logger.info('WebSocket proxy initialized');
    
    // Configure the proxy
    this.setupProxy();
  }
  
  /**
   * Set up the WebSocket proxy
   */
  private setupProxy(): void {
    // Add the upgrade handler to the HTTP server
    this.server.on('upgrade', (req: IncomingMessage, socket: any, head: any) => {
      // Parse the URL to get the pathname
      const { pathname } = parse(req.url || '', true);
      
      // Check if this is a WebSocket request we should handle
      if (!pathname || !pathname.startsWith('/api/v1/ws')) {
        // Not a WebSocket request for our endpoint
        socket.destroy();
        return;
      }
      
      // Get the target service from the query parameter
      const url = parse(req.url || '', true);
      const service = url.query.service as string;
      
      // Validate service parameter
      if (!this.isValidService(service)) {
        logger.error(`Invalid service requested: ${service}`);
        socket.destroy();
        return;
      }
      
      const validService = service as ServiceType;
      
      // Select the target WebSocket server
      const targetUrl = this.serviceMap[validService];
      logger.info(`Proxying WebSocket connection to service: ${validService} (${targetUrl})`);
      
      // Create proxy for this connection
      const proxy = createProxyMiddleware({
        target: targetUrl,
        ws: true,
        changeOrigin: true,
        pathRewrite: {
          // Rewrite the path to the target service
          '^/api/v1/ws': '/socket.io'
        },
        logLevel: 'warn',
        onError: (err) => {
          logger.error(`WebSocket proxy error: ${err.message}`);
          if (!socket.destroyed) {
            socket.destroy();
          }
        }
      });
      
      // Use the WebSocket upgrade handler directly
      // This bypasses express middleware chain
      const wsProxy = proxy as any;
      if (wsProxy.upgrade) {
        wsProxy.upgrade(req, socket, head);
      } else {
        logger.error('WebSocket upgrade handler not available');
        socket.destroy();
      }
    });
    
    logger.info('WebSocket proxy routes configured');
  }

  /**
   * Check if a service string is a valid service type
   */
  private isValidService(service: string): service is ServiceType {
    return service === 'events' || 
           service === 'cameras' || 
           service === 'recordings' || 
           service === 'detection';
  }

  /**
   * Get the WebSocket server instance
   */
  public getServer(): WebSocketServer {
    return this.io;
  }
}

// Create and export a WebSocket proxy manager
export const websocketProxy = {
  manager: null as WebSocketProxyManager | null,
  
  // Initialize the WebSocket proxy
  init(server: Server): WebSocketProxyManager {
    this.manager = new WebSocketProxyManager(server);
    return this.manager;
  },
  
  // Proxy upgrade handler for the HTTP server
  upgrade: (req: IncomingMessage, socket: any, head: any) => {
    // This function is called from index.ts to handle WebSocket upgrades
    // The actual implementation is in the WebSocketProxyManager
  }
};