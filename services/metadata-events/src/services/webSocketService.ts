import WebSocket from 'ws';
import http from 'http';
import logger from '../utils/logger';

export class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number | string) {
    const server = http.createServer();
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      logger.info('New WebSocket client connected');
      
      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client disconnected');
      });
      
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
    
    server.listen(port, () => {
      logger.info(`WebSocket server running on port ${port}`);
    });
  }

  /**
   * Emit an event to all connected clients
   */
  public emitEvent<T>(eventType: string, data: T): void {
    const payload = JSON.stringify({
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Get the count of connected clients
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close the WebSocket server
   */
  public close(): void {
    this.wss.close(() => {
      logger.info('WebSocket server closed');
    });
  }
}