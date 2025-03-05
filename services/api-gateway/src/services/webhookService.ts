import axios from 'axios';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import Logger from '../utils/logger';

const prisma = new PrismaClient();
const logger = new Logger('WebhookService');

export interface Webhook {
  id: string;
  extensionId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created: Date;
  updated: Date;
  lastTriggered?: Date;
  failureCount?: number;
}

export class WebhookService {
  /**
   * Create a new webhook
   */
  async createWebhook(webhook: Webhook): Promise<Webhook> {
    try {
      const result = await prisma.webhook.create({
        data: {
          id: webhook.id,
          extensionId: webhook.extensionId,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret,
          active: webhook.active,
          created: webhook.created,
          updated: webhook.updated,
          failureCount: 0
        }
      });
      
      return result as Webhook;
    } catch (error) {
      logger.error('Error creating webhook', { error, webhookId: webhook.id });
      throw error;
    }
  }

  /**
   * Find webhook by ID
   */
  async findWebhookById(id: string): Promise<Webhook | null> {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id }
      });
      
      return webhook as Webhook | null;
    } catch (error) {
      logger.error('Error finding webhook by ID', { error, webhookId: id });
      throw error;
    }
  }

  /**
   * Find webhooks by extension ID
   */
  async findWebhooksByExtensionId(extensionId: string): Promise<Webhook[]> {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { extensionId }
      });
      
      return webhooks as Webhook[];
    } catch (error) {
      logger.error('Error finding webhooks by extension ID', { error, extensionId });
      throw error;
    }
  }

  /**
   * Find webhooks by event type
   */
  async findWebhooksByEventType(eventType: string): Promise<Webhook[]> {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: {
          active: true,
          events: {
            has: eventType
          }
        }
      });
      
      return webhooks as Webhook[];
    } catch (error) {
      logger.error('Error finding webhooks by event type', { error, eventType });
      throw error;
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(id: string, data: Partial<Webhook>): Promise<Webhook | null> {
    try {
      const webhook = await prisma.webhook.update({
        where: { id },
        data
      });
      
      return webhook as Webhook;
    } catch (error) {
      logger.error('Error updating webhook', { error, webhookId: id });
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string): Promise<void> {
    try {
      await prisma.webhook.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Error deleting webhook', { error, webhookId: id });
      throw error;
    }
  }

  /**
   * Delete webhooks by extension ID
   */
  async deleteWebhooksByExtensionId(extensionId: string): Promise<void> {
    try {
      await prisma.webhook.deleteMany({
        where: { extensionId }
      });
    } catch (error) {
      logger.error('Error deleting webhooks by extension ID', { error, extensionId });
      throw error;
    }
  }

  /**
   * Send test event to webhook
   */
  async sendTestEvent(webhook: Webhook): Promise<{ 
    success: boolean; 
    statusCode?: number; 
    message: string 
  }> {
    try {
      const payload = {
        id: crypto.randomUUID(),
        event: 'test.event',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test event from OmniSight',
          webhookId: webhook.id,
          extensionId: webhook.extensionId
        }
      };
      
      const signature = this.generateSignature(webhook.secret, JSON.stringify(payload));
      
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-OmniSight-Signature': signature,
          'X-OmniSight-Event': 'test.event',
          'X-OmniSight-Delivery': crypto.randomUUID()
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      await this.updateWebhook(webhook.id, {
        lastTriggered: new Date(),
        failureCount: 0
      });
      
      return {
        success: true,
        statusCode: response.status,
        message: `Webhook test successful with status code ${response.status}`
      };
    } catch (error) {
      logger.error('Error sending test event to webhook', { error, webhookId: webhook.id });
      
      // Increment failure count
      await this.incrementFailureCount(webhook.id);
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          statusCode: error.response?.status,
          message: error.response?.data?.message || error.message
        };
      }
      
      return {
        success: false,
        message: (error as Error).message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Trigger event to all subscribed webhooks
   */
  async triggerEvent(
    eventType: string, 
    data: any, 
    filters?: { extensionId?: string }
  ): Promise<void> {
    try {
      // Find all webhooks subscribed to this event
      const webhooks = await this.findWebhooksByEventType(eventType);
      
      // Filter webhooks if needed
      const filteredWebhooks = filters?.extensionId 
        ? webhooks.filter(webhook => webhook.extensionId === filters.extensionId)
        : webhooks;
      
      if (filteredWebhooks.length === 0) {
        return;
      }
      
      // Prepare event payload
      const payload = {
        id: crypto.randomUUID(),
        event: eventType,
        timestamp: new Date().toISOString(),
        data
      };
      
      // Send event to all webhooks
      const promises = filteredWebhooks.map(webhook => this.sendEventToWebhook(webhook, payload));
      
      // Wait for all webhooks to be processed
      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Error triggering event', { error, eventType });
    }
  }

  /**
   * Send event to a specific webhook
   */
  private async sendEventToWebhook(webhook: Webhook, payload: any): Promise<void> {
    try {
      const signature = this.generateSignature(webhook.secret, JSON.stringify(payload));
      
      await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-OmniSight-Signature': signature,
          'X-OmniSight-Event': payload.event,
          'X-OmniSight-Delivery': crypto.randomUUID()
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      await this.updateWebhook(webhook.id, {
        lastTriggered: new Date(),
        failureCount: 0
      });
    } catch (error) {
      logger.error('Error sending event to webhook', { 
        error, 
        webhookId: webhook.id, 
        event: payload.event 
      });
      
      // Increment failure count
      await this.incrementFailureCount(webhook.id);
    }
  }

  /**
   * Increment webhook failure count
   */
  private async incrementFailureCount(webhookId: string): Promise<void> {
    try {
      const webhook = await this.findWebhookById(webhookId);
      
      if (!webhook) {
        return;
      }
      
      const failureCount = (webhook.failureCount || 0) + 1;
      
      // Disable webhook after too many failures
      if (failureCount >= 5) {
        await this.updateWebhook(webhookId, {
          active: false,
          failureCount
        });
        
        logger.warn('Webhook disabled due to too many failures', { webhookId });
      } else {
        await this.updateWebhook(webhookId, {
          failureCount
        });
      }
    } catch (error) {
      logger.error('Error incrementing webhook failure count', { error, webhookId });
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(secret: string, payload: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
}