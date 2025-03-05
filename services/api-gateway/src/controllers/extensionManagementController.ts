import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config/config';
import { ExtensionService } from '../services/extensionService';
import { WebhookService } from '../services/webhookService';
import { Logger } from '../utils/logger';

const logger = new Logger('ExtensionManagementController');
const extensionService = new ExtensionService();
const webhookService = new WebhookService();

/**
 * Register a new extension
 */
export const registerExtension = async (req: Request, res: Response) => {
  try {
    const { name, description, developer, email, scopes, callbackUrl } = req.body;
    
    // Validate required fields
    if (!name || !description || !developer || !email || !scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Generate unique extension ID and API key
    const extensionId = uuidv4();
    const apiKey = uuidv4();
    const apiSecret = uuidv4();
    
    // Hash API secret for storage
    const hashedSecret = await bcrypt.hash(apiSecret, 10);
    
    // Create extension record
    const extension = await extensionService.createExtension({
      id: extensionId,
      name,
      description,
      developer,
      email,
      scopes,
      callbackUrl,
      apiKey,
      apiSecret: hashedSecret,
      active: true,
      created: new Date(),
      updated: new Date()
    });
    
    logger.info('Extension registered', { extensionId, name });
    
    // Return extension information and credentials (only shown once)
    return res.status(201).json({
      extension: {
        id: extension.id,
        name: extension.name,
        description: extension.description,
        developer: extension.developer,
        scopes: extension.scopes,
        callbackUrl: extension.callbackUrl,
        active: extension.active,
        created: extension.created
      },
      credentials: {
        apiKey,
        apiSecret
      },
      message: 'Save these credentials securely. The API secret will not be shown again.'
    });
  } catch (error) {
    logger.error('Error registering extension', { error });
    return res.status(500).json({ error: 'Failed to register extension' });
  }
};

/**
 * List all extensions
 */
export const listExtensions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    
    const parsedPage = parseInt(page as string) || 1;
    const parsedLimit = parseInt(limit as string) || 20;
    
    const filter: any = {};
    if (active !== undefined) {
      filter.active = active === 'true';
    }
    
    const extensions = await extensionService.findExtensions(
      filter,
      parsedPage,
      parsedLimit
    );
    
    // Remove sensitive information
    const sanitizedExtensions = extensions.data.map(ext => ({
      id: ext.id,
      name: ext.name,
      description: ext.description,
      developer: ext.developer,
      scopes: ext.scopes,
      callbackUrl: ext.callbackUrl,
      active: ext.active,
      created: ext.created,
      updated: ext.updated
    }));
    
    return res.status(200).json({
      extensions: sanitizedExtensions,
      pagination: {
        total: extensions.total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(extensions.total / parsedLimit)
      }
    });
  } catch (error) {
    logger.error('Error listing extensions', { error });
    return res.status(500).json({ error: 'Failed to list extensions' });
  }
};

/**
 * Get extension details
 */
export const getExtension = async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    
    const extension = await extensionService.findExtensionById(extensionId);
    
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    // Remove sensitive information
    const sanitizedExtension = {
      id: extension.id,
      name: extension.name,
      description: extension.description,
      developer: extension.developer,
      email: extension.email,
      scopes: extension.scopes,
      callbackUrl: extension.callbackUrl,
      active: extension.active,
      created: extension.created,
      updated: extension.updated,
      lastUsed: extension.lastUsed
    };
    
    return res.status(200).json(sanitizedExtension);
  } catch (error) {
    logger.error('Error getting extension details', { error, extensionId: req.params.extensionId });
    return res.status(500).json({ error: 'Failed to get extension details' });
  }
};

/**
 * Update extension
 */
export const updateExtension = async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    const { name, description, developer, email, scopes, callbackUrl, active } = req.body;
    
    const extension = await extensionService.findExtensionById(extensionId);
    
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    // Update fields
    const updatedFields: any = { updated: new Date() };
    
    if (name !== undefined) updatedFields.name = name;
    if (description !== undefined) updatedFields.description = description;
    if (developer !== undefined) updatedFields.developer = developer;
    if (email !== undefined) updatedFields.email = email;
    if (scopes !== undefined && Array.isArray(scopes)) updatedFields.scopes = scopes;
    if (callbackUrl !== undefined) updatedFields.callbackUrl = callbackUrl;
    if (active !== undefined) updatedFields.active = active;
    
    const updatedExtension = await extensionService.updateExtension(extensionId, updatedFields);
    
    if (!updatedExtension) {
      return res.status(500).json({ error: 'Failed to update extension' });
    }
    
    logger.info('Extension updated', { extensionId });
    
    // Remove sensitive information
    const sanitizedExtension = {
      id: updatedExtension.id,
      name: updatedExtension.name,
      description: updatedExtension.description,
      developer: updatedExtension.developer,
      email: updatedExtension.email,
      scopes: updatedExtension.scopes,
      callbackUrl: updatedExtension.callbackUrl,
      active: updatedExtension.active,
      created: updatedExtension.created,
      updated: updatedExtension.updated
    };
    
    return res.status(200).json(sanitizedExtension);
  } catch (error) {
    logger.error('Error updating extension', { error, extensionId: req.params.extensionId });
    return res.status(500).json({ error: 'Failed to update extension' });
  }
};

/**
 * Delete extension
 */
export const deleteExtension = async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    
    const extension = await extensionService.findExtensionById(extensionId);
    
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    // Delete extension
    await extensionService.deleteExtension(extensionId);
    
    // Delete associated webhooks
    await webhookService.deleteWebhooksByExtensionId(extensionId);
    
    logger.info('Extension deleted', { extensionId });
    
    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting extension', { error, extensionId: req.params.extensionId });
    return res.status(500).json({ error: 'Failed to delete extension' });
  }
};

/**
 * Regenerate API credentials
 */
export const regenerateCredentials = async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    
    const extension = await extensionService.findExtensionById(extensionId);
    
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    // Generate new credentials
    const apiKey = uuidv4();
    const apiSecret = uuidv4();
    
    // Hash API secret for storage
    const hashedSecret = await bcrypt.hash(apiSecret, 10);
    
    // Update extension with new credentials
    await extensionService.updateExtension(extensionId, {
      apiKey,
      apiSecret: hashedSecret,
      updated: new Date()
    });
    
    logger.info('Extension credentials regenerated', { extensionId });
    
    // Return new credentials (only shown once)
    return res.status(200).json({
      credentials: {
        apiKey,
        apiSecret
      },
      message: 'Save these credentials securely. The API secret will not be shown again.'
    });
  } catch (error) {
    logger.error('Error regenerating credentials', { error, extensionId: req.params.extensionId });
    return res.status(500).json({ error: 'Failed to regenerate credentials' });
  }
};

/**
 * List extension webhooks
 */
export const listWebhooks = async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    
    const extension = await extensionService.findExtensionById(extensionId);
    
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    const webhooks = await webhookService.findWebhooksByExtensionId(extensionId);
    
    return res.status(200).json({ webhooks });
  } catch (error) {
    logger.error('Error listing webhooks', { error, extensionId: req.params.extensionId });
    return res.status(500).json({ error: 'Failed to list webhooks' });
  }
};

/**
 * Create webhook
 */
export const createWebhook = async (req: Request, res: Response) => {
  try {
    const { extensionId } = req.params;
    const { name, url, events, secret, active = true } = req.body;
    
    // Validate required fields
    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const extension = await extensionService.findExtensionById(extensionId);
    
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    // Create webhook
    const webhook = await webhookService.createWebhook({
      id: uuidv4(),
      extensionId,
      name,
      url,
      events,
      secret: secret || uuidv4(), // Generate a secret if not provided
      active,
      created: new Date(),
      updated: new Date()
    });
    
    logger.info('Webhook created', { extensionId, webhookId: webhook.id });
    
    return res.status(201).json(webhook);
  } catch (error) {
    logger.error('Error creating webhook', { error, extensionId: req.params.extensionId });
    return res.status(500).json({ error: 'Failed to create webhook' });
  }
};

/**
 * Update webhook
 */
export const updateWebhook = async (req: Request, res: Response) => {
  try {
    const { extensionId, webhookId } = req.params;
    const { name, url, events, secret, active } = req.body;
    
    const webhook = await webhookService.findWebhookById(webhookId);
    
    if (!webhook || webhook.extensionId !== extensionId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    // Update fields
    const updatedFields: any = { updated: new Date() };
    
    if (name !== undefined) updatedFields.name = name;
    if (url !== undefined) updatedFields.url = url;
    if (events !== undefined && Array.isArray(events)) updatedFields.events = events;
    if (secret !== undefined) updatedFields.secret = secret;
    if (active !== undefined) updatedFields.active = active;
    
    const updatedWebhook = await webhookService.updateWebhook(webhookId, updatedFields);
    
    logger.info('Webhook updated', { extensionId, webhookId });
    
    return res.status(200).json(updatedWebhook);
  } catch (error) {
    logger.error('Error updating webhook', { 
      error, 
      extensionId: req.params.extensionId,
      webhookId: req.params.webhookId 
    });
    return res.status(500).json({ error: 'Failed to update webhook' });
  }
};

/**
 * Delete webhook
 */
export const deleteWebhook = async (req: Request, res: Response) => {
  try {
    const { extensionId, webhookId } = req.params;
    
    const webhook = await webhookService.findWebhookById(webhookId);
    
    if (!webhook || webhook.extensionId !== extensionId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    // Delete webhook
    await webhookService.deleteWebhook(webhookId);
    
    logger.info('Webhook deleted', { extensionId, webhookId });
    
    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting webhook', { 
      error, 
      extensionId: req.params.extensionId,
      webhookId: req.params.webhookId 
    });
    return res.status(500).json({ error: 'Failed to delete webhook' });
  }
};

/**
 * Test webhook
 */
export const testWebhook = async (req: Request, res: Response) => {
  try {
    const { extensionId, webhookId } = req.params;
    
    const webhook = await webhookService.findWebhookById(webhookId);
    
    if (!webhook || webhook.extensionId !== extensionId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    // Send test event
    const testResult = await webhookService.sendTestEvent(webhook);
    
    return res.status(200).json({
      success: testResult.success,
      statusCode: testResult.statusCode,
      message: testResult.message,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error testing webhook', { 
      error, 
      extensionId: req.params.extensionId,
      webhookId: req.params.webhookId 
    });
    return res.status(500).json({ error: 'Failed to test webhook' });
  }
};

/**
 * Get extension capabilities
 */
export const getCapabilities = async (req: Request, res: Response) => {
  try {
    // Return available scopes and event types
    return res.status(200).json({
      scopes: [
        { scope: 'read:cameras', description: 'Read camera information' },
        { scope: 'write:cameras', description: 'Create and modify cameras' },
        { scope: 'read:events', description: 'Read events and alerts' },
        { scope: 'write:events', description: 'Create and modify events' },
        { scope: 'read:recordings', description: 'Access camera recordings' },
        { scope: 'read:detection', description: 'Access object detection data' },
        { scope: 'read:analytics', description: 'Access analytics data' },
        { scope: 'write:settings', description: 'Modify system settings' }
      ],
      events: [
        { event: 'camera.created', description: 'Camera added to the system' },
        { event: 'camera.updated', description: 'Camera information updated' },
        { event: 'camera.deleted', description: 'Camera removed from the system' },
        { event: 'camera.status', description: 'Camera status changed' },
        { event: 'event.created', description: 'New event detected' },
        { event: 'object.detected', description: 'Object detected' },
        { event: 'recording.started', description: 'Recording started' },
        { event: 'recording.stopped', description: 'Recording stopped' },
        { event: 'system.alert', description: 'System alert triggered' }
      ]
    });
  } catch (error) {
    logger.error('Error getting capabilities', { error });
    return res.status(500).json({ error: 'Failed to get capabilities' });
  }
};