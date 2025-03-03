declare module 'onvif' {
  export class Cam {
    constructor(options: any, callback: (error: Error | null) => void);
    on(event: string, callback: (data: any) => void): void;
    removeAllListeners(event: string): void;
    getCapabilities(callback: (error: Error | null, capabilities: any) => void): void;
    getProfiles(callback: (error: Error | null, profiles: any[]) => void): void;
    getPresets(options: {profileToken: string}, callback: (error: Error | null, presets: any) => void): void;
    getStreamUri(options: {protocol: string, profileToken: string}, callback: (error: Error | null, stream: any) => void): void;
    getSnapshot(options: {profileToken: string}, callback: (error: Error | null, snapshot: any) => void): void;
    getDeviceInformation(callback: (error: Error | null, info: any) => void): void;
    absoluteMove(options: any, callback: (error: Error | null) => void): void;
    relativeMove(options: any, callback: (error: Error | null) => void): void;
    continuousMove(options: any, callback: (error: Error | null) => void): void;
    gotoPreset(options: {profileToken: string, presetToken: string}, callback: (error: Error | null) => void): void;
    setPreset(options: {profileToken: string, presetName: string}, callback: (error: Error | null, preset: any) => void): void;
  }

  export class Discovery {
    static probe(options: {timeout?: number}, callback: (error: Error | null, result: any) => void): void;
  }
}