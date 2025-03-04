import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import { WebhookEvent, WebhookEventType, Extension } from '../models/extension';

// Placeholder for a proper webhook queue implementation
// In production, this would use a persistent queue with a database
const webhookQueue: Array<{
  extensionId: string;
  event: WebhookEvent;
  attempts: number;
  nextAttempt: Date;
}> = [];

// Maximum number of retry attempts
const MAX_RETRY_ATTEMPTS = 5;

// Backoff strategy for retries (in milliseconds)
const RETRY_DELAYS = [
  1000 * 60,      // 1 minute
  1000 * 60 * 5,  // 5 minutes
  1000 * 60 * 15, // 15 minutes
  1000 * 60 * 60, // 1 hour
  1000 * 60 * 60 * 4 // 4 hours
];

/**
 * Queues a webhook event for delivery to an extension
 * 
 * @param extension The extension to send the webhook to
 * @param eventType The type of event
 * @param data The event data
 * @returns The ID of the queued webhook event
 */
export const queueWebhookEvent = async (
  extension: Extension, 
  eventType: WebhookEventType, 
  data: any
): Promise<string> => {
  // Create webhook event
  const eventId = uuidv4();
  const webhookEvent: WebhookEvent = {
    id: eventId,
    type: eventType,
    timestamp: new Date().toISOString(),
    data
  };
  
  // Add to queue
  webhookQueue.push({
    extensionId: extension.id,
    event: webhookEvent,
    attempts: 0,
    nextAttempt: new Date()
  });
  
  logger.info(`Queued webhook event ${eventId} of type ${eventType} for extension ${extension.id}`);
  
  // Schedule immediate processing
  processWebhookQueue();
  
  return eventId;
};

/**
 * Processes the webhook queue, sending any pending events
 */
const processWebhookQueue = async (): Promise<void> => {
  const now = new Date();
  
  // Get ready events and remove them from queue
  const readyEvents = webhookQueue.filter(item => item.nextAttempt <= now);
  
  // Process each ready event
  for (const queueItem of readyEvents) {
    try {
      // Remove from queue
      const index = webhookQueue.indexOf(queueItem);
      if (index !== -1) {
        webhookQueue.splice(index, 1);
      }
      
      // Attempt to deliver the webhook
      await deliverWebhook(queueItem);
    } catch (error) {
      logger.error(`Error processing webhook ${queueItem.event.id}:`, error);
    }
  }
};

/**
 * Attempts to deliver a webhook to an extension
 */
const deliverWebhook = async (queueItem: {
  extensionId: string;
  event: WebhookEvent;
  attempts: number;
  nextAttempt: Date;
}): Promise<void> => {
  try {
    // In a real implementation, we would retrieve extension details from the database
    // For now, let's assume we have access to the extension object
    // This is a placeholder for actual extension lookup
    const extension = { 
      id: queueItem.extensionId, 
      callbackUrl: '', // This would be retrieved from the database
      apiKey: '',      // This would be retrieved from the database
      apiSecret: ''    // This would be retrieved from the database
    } as Extension;
    
    // If the extension doesn't exist or is inactive, drop the webhook
    if (!extension || extension.status === 'inactive') {
      logger.warn(`Dropping webhook for non-existent or inactive extension ${queueItem.extensionId}`);
      return;
    }
    
    // Generate a JWT token for webhook authentication
    const token = jwt.sign(
      {
        extensionId: extension.id,
        eventId: queueItem.event.id,
        eventType: queueItem.event.type
      },
      config.jwt.secret,
      {
        expiresIn: '5m' // Short-lived token for webhook delivery
      }
    );
    
    // Deliver the webhook
    await axios.post(extension.callbackUrl, queueItem.event, {
      headers: {
        'Content-Type': 'application/json',
        'X-OmniSight-Signature': token,
        'X-OmniSight-Event-ID': queueItem.event.id,
        'X-OmniSight-Event-Type': queueItem.event.type
      },
      timeout: 10000 // 10 second timeout
    });
    
    logger.info(`Successfully delivered webhook ${queueItem.event.id} to extension ${extension.id}`);
  } catch (error) {
    // Increment attempt counter
    queueItem.attempts++;
    
    // Log failure
    if (axios.isAxiosError(error)) {
      logger.warn(`Webhook delivery failed for ${queueItem.event.id}: ${error.message} (Status: ${error.response?.status})`);
    } else {
      logger.warn(`Webhook delivery failed for ${queueItem.event.id}: ${error}`);
    }
    
    // Check if we should retry
    if (queueItem.attempts < MAX_RETRY_ATTEMPTS) {
      // Calculate next retry time with exponential backoff
      const delayIndex = Math.min(queueItem.attempts - 1, RETRY_DELAYS.length - 1);
      const delay = RETRY_DELAYS[delayIndex];
      
      // Schedule next attempt
      queueItem.nextAttempt = new Date(Date.now() + delay);
      
      // Re-queue
      webhookQueue.push(queueItem);
      
      logger.info(`Requeued webhook ${queueItem.event.id} for delivery at ${queueItem.nextAttempt.toISOString()} (Attempt ${queueItem.attempts + 1}/${MAX_RETRY_ATTEMPTS})`);
    } else {
      logger.error(`Webhook ${queueItem.event.id} failed after ${MAX_RETRY_ATTEMPTS} attempts, dropping`);
    }
  }
};

/**
 * Initialize the webhook processor, setting up periodic queue processing
 */
export const initializeWebhookProcessor = (): void => {
  // Process the queue every minute
  setInterval(processWebhookQueue, 60 * 1000);
  
  logger.info('Webhook processor initialized');
};