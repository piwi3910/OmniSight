declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: any;
    iat?: number;
    exp?: number;
  }

  export interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    issuer?: string;
    jwtid?: string;
    subject?: string;
    noTimestamp?: boolean;
    header?: object;
    keyid?: string;
    mutatePayload?: boolean;
    encoding?: string;
  }

  export type Secret = string | Buffer | { key: string; passphrase: string };

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: Secret,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: Secret,
    options?: object,
    callback?: (err: any, decoded: any) => void
  ): any;

  export function decode(
    token: string,
    options?: { complete?: boolean; json?: boolean }
  ): null | { [key: string]: any } | string;
}