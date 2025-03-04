/**
 * Types and interfaces for the Extension API
 */

/**
 * Available permission scopes for extensions
 */
export type ExtensionScope = 
  | 'read:cameras' 
  | 'read:events' 
  | 'read:recordings' 
  | 'read:detection'
  | 'write:cameras' 
  | 'write:events' 
  | 'write:recordings';

/**
 * Extension status
 */
export type ExtensionStatus = 'active' | 'inactive';

/**
 * Extension registration request
 */
export interface ExtensionRegistration {
  name: string;
  description: string;
  developer: string;
  callbackUrl: string;
  scopes: ExtensionScope[];
}

/**
 * Extension model
 */
export interface Extension {
  id: string;
  name: string;
  description: string;
  developer: string;
  callbackUrl: string;
  scopes: ExtensionScope[];
  apiKey: string;
  apiSecret: string;
  createdAt: Date;
  status: ExtensionStatus;
}

/**
 * Extension webhook event types
 */
export type WebhookEventType = 
  | 'camera.created' 
  | 'camera.updated' 
  | 'camera.deleted'
  | 'event.created'
  | 'recording.created'
  | 'detection.created';

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  data: any;
}