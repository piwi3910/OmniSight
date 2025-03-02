declare module 'node-rtsp-stream' {
  import { EventEmitter } from 'events';

  interface StreamOptions {
    name: string;
    streamUrl: string;
    wsPort: number;
    ffmpegOptions?: Record<string, any>;
  }

  class Stream extends EventEmitter {
    constructor(options: StreamOptions);
    on(event: 'data', listener: (data: Buffer) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    stop(): void;
  }

  export = Stream;
}