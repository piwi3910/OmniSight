declare module 'ws' {
  import { EventEmitter } from 'events';
  import * as http from 'http';
  import * as net from 'net';

  class WebSocket extends EventEmitter {
    static createWebSocketStream(ws: WebSocket, options?: any): any;
    static Server: typeof WebSocketServer;
    
    // WebSocket readyState constants
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;

    constructor(address: string, options?: WebSocket.ClientOptions);
    constructor(address: string, protocols?: string | string[], options?: WebSocket.ClientOptions);

    CONNECTING: number;
    OPEN: number;
    CLOSING: number;
    CLOSED: number;

    binaryType: string;
    bufferedAmount: number;
    extensions: string;
    protocol: string;
    readyState: number;
    url: string;

    close(code?: number, reason?: string): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    send(data: any, cb?: (err?: Error) => void): void;
    send(data: any, options: { mask?: boolean; binary?: boolean; compress?: boolean; fin?: boolean }, cb?: (err?: Error) => void): void;
    terminate(): void;

    on(event: 'close', listener: (code: number, reason: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'message', listener: (data: WebSocket.Data) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'ping' | 'pong', listener: (data: Buffer) => void): this;
    on(event: 'unexpected-response', listener: (request: http.ClientRequest, response: http.IncomingMessage) => void): this;
    on(event: 'upgrade', listener: (response: http.IncomingMessage) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  namespace WebSocket {
    type Data = string | Buffer | ArrayBuffer | Buffer[];

    interface ClientOptions {
      protocol?: string;
      perMessageDeflate?: boolean | PerMessageDeflateOptions;
      handshakeTimeout?: number;
      protocolVersion?: number;
      origin?: string;
      host?: string;
      family?: number;
      checkServerIdentity?(servername: string, cert: { subject: { CN: string } }): boolean;
      rejectUnauthorized?: boolean;
      maxPayload?: number;
      followRedirects?: boolean;
      maxRedirects?: number;
    }

    interface PerMessageDeflateOptions {
      serverNoContextTakeover?: boolean;
      clientNoContextTakeover?: boolean;
      serverMaxWindowBits?: number;
      clientMaxWindowBits?: number;
      zlibDeflateOptions?: {
        flush?: number;
        finishFlush?: number;
        chunkSize?: number;
        windowBits?: number;
        level?: number;
        memLevel?: number;
        strategy?: number;
        dictionary?: Buffer | Buffer[] | DataView;
        info?: boolean;
      };
      zlibInflateOptions?: {
        chunkSize?: number;
        windowBits?: number;
        to?: string;
        raw?: boolean;
        inflate?: boolean;
      };
      threshold?: number;
      concurrencyLimit?: number;
    }

    interface ServerOptions {
      host?: string;
      port?: number;
      backlog?: number;
      server?: http.Server;
      verifyClient?: VerifyClientCallbackAsync | VerifyClientCallbackSync;
      handleProtocols?: (protocols: string[], request: http.IncomingMessage) => string | false;
      path?: string;
      noServer?: boolean;
      clientTracking?: boolean;
      perMessageDeflate?: boolean | PerMessageDeflateOptions;
      maxPayload?: number;
    }

    interface AddressInfo {
      address: string;
      family: string;
      port: number;
    }

    interface VerifyClientCallbackAsync {
      (info: { origin: string; secure: boolean; req: http.IncomingMessage }): Promise<boolean>;
    }

    interface VerifyClientCallbackSync {
      (info: { origin: string; secure: boolean; req: http.IncomingMessage }, callback: (result: boolean, code?: number, message?: string) => void): void;
    }
  }

  class WebSocketServer extends EventEmitter {
    constructor(options?: WebSocket.ServerOptions, callback?: () => void);

    options: WebSocket.ServerOptions;
    path: string;
    clients: Set<WebSocket>;

    address(): WebSocket.AddressInfo | string;
    close(cb?: (err?: Error) => void): void;
    handleUpgrade(request: http.IncomingMessage, socket: net.Socket, upgradeHead: Buffer, callback: (client: WebSocket, request: http.IncomingMessage) => void): void;
    shouldHandle(request: http.IncomingMessage): boolean;

    on(event: 'close', listener: () => void): this;
    on(event: 'connection', listener: (socket: WebSocket, request: http.IncomingMessage) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'headers', listener: (headers: string[], request: http.IncomingMessage) => void): this;
    on(event: 'listening', listener: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  // Add WebSocket constants
  namespace Constants {
    const CONNECTING: number;
    const OPEN: number;
    const CLOSING: number;
    const CLOSED: number;
  }

  export = WebSocket;
}