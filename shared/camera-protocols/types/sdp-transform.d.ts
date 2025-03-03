declare module 'sdp-transform' {
  export function parse(sdp: string): any;
  export function write(session: any): string;
  export function parseParams(str: string): any;
  export function parsePayloads(str: string): number[];
  export function parseRemoteCandidates(str: string): any[];
  export function parseImageAttributes(str: string): any;
  export function parseFmtp(str: string): any;
  export function parseRtpmap(str: string): any;
  export function parseFormat(str: string): any;
  export function parseSimulcastStreamList(str: string): any[];
}