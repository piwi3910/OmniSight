import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';
import logger from '../utils/logger';
import { ExtensionRegistration, ExtensionScope, Extension } from '../models/extension';

// In-memory storage for extensions (in production, this would be a database)
const extensions: Record<string, Extension> = {};

/**
 * API key generation settings
 */
const API_KEY_LENGTH = 32;
const API_SECRET_LENGTH = 64;

/**
 * Generate a random string of specified length
 */
const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Register a new third-party extension
 */
export const registerExtension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, developer, callbackUrl, scopes } = req.body as ExtensionRegistration;
    
    // Validate required fields
    if (!name || !description || !developer || !callbackUrl || !scopes || !Array.isArray(scopes)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EXTENSION_DATA',
          message: 'Missing or invalid extension registration data'
        }
      });
    }
    
    // Validate scopes
    const validScopes: ExtensionScope[] = ['read:cameras', 'read:events', 'read:recordings', 
      'read:detection', 'write:cameras', 'write:events', 'write:recordings'];
    
    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope as ExtensionScope));
    if (invalidScopes.length > 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SCOPES',
          message: `Invalid scopes: ${invalidScopes.join(', ')}`,
          validScopes
        }
      });
    }
    
    // Generate extension ID, API key and secret
    const extensionId = uuidv4();
    const apiKey = generateRandomString(API_KEY_LENGTH);
    const apiSecret = generateRandomString(API_SECRET_LENGTH);
    
    // Create extension record
    const extension: Extension = {
      id: extensionId,
      name,
      description,
      developer,
      callbackUrl,
      scopes: scopes as ExtensionScope[],
      apiKey,
      apiSecret,
      createdAt: new Date(),
      status: 'active'
    };
    
    // Save extension (in a real implementation, this would be saved to a database)
    extensions[extensionId] = extension;
    
    logger.info(`Extension registered: ${name} (${extensionId})`);
    
    // Return extension details (without API secret)
    return res.status(201).json({
      id: extension.id,
      name: extension.name,
      description: extension.description,
      developer: extension.developer,
      callbackUrl: extension.callbackUrl,
      scopes: extension.scopes,
      apiKey: extension.apiKey,
      status: extension.status,
      createdAt: extension.createdAt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get extension details
 */
export const getExtension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { extensionId } = req.params;
    
    // Check if extension exists
    const extension = extensions[extensionId];
    if (!extension) {
      return res.status(404).json({
        error: {
          code: 'EXTENSION_NOT_FOUND',
          message: 'Extension not found'
        }
      });
    }
    
    // Return extension details (without API secret)
    return res.status(200).json({
      id: extension.id,
      name: extension.name,
      description: extension.description,
      developer: extension.developer,
      callbackUrl: extension.callbackUrl,
      scopes: extension.scopes,
      apiKey: extension.apiKey,
      status: extension.status,
      createdAt: extension.createdAt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all extensions
 */
export const listExtensions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Return all extensions (without API secrets)
    const extensionList = Object.values(extensions).map(extension => ({
      id: extension.id,
      name: extension.name,
      description: extension.description,
      developer: extension.developer,
      scopes: extension.scopes,
      status: extension.status,
      createdAt: extension.createdAt
    }));
    
    return res.status(200).json(extensionList);
  } catch (error) {
    next(error);
  }
};

/**
 * Update extension
 */
export const updateExtension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { extensionId } = req.params;
    const { name, description, callbackUrl, scopes, status } = req.body;
    
    // Check if extension exists
    const extension = extensions[extensionId];
    if (!extension) {
      return res.status(404).json({
        error: {
          code: 'EXTENSION_NOT_FOUND',
          message: 'Extension not found'
        }
      });
    }
    
    // Validate scopes if provided
    if (scopes) {
      const validScopes: ExtensionScope[] = ['read:cameras', 'read:events', 'read:recordings', 
        'read:detection', 'write:cameras', 'write:events', 'write:recordings'];
      
      const invalidScopes = scopes.filter(scope => !validScopes.includes(scope as ExtensionScope));
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_SCOPES',
            message: `Invalid scopes: ${invalidScopes.join(', ')}`,
            validScopes
          }
        });
      }
    }
    
    // Update extension
    if (name) extension.name = name;
    if (description) extension.description = description;
    if (callbackUrl) extension.callbackUrl = callbackUrl;
    if (scopes) extension.scopes = scopes as ExtensionScope[];
    if (status && (status === 'active' || status === 'inactive')) extension.status = status;
    
    logger.info(`Extension updated: ${extension.name} (${extensionId})`);
    
    // Return updated extension details (without API secret)
    return res.status(200).json({
      id: extension.id,
      name: extension.name,
      description: extension.description,
      developer: extension.developer,
      callbackUrl: extension.callbackUrl,
      scopes: extension.scopes,
      apiKey: extension.apiKey,
      status: extension.status,
      createdAt: extension.createdAt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete extension
 */
export const deleteExtension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { extensionId } = req.params;
    
    // Check if extension exists
    if (!extensions[extensionId]) {
      return res.status(404).json({
        error: {
          code: 'EXTENSION_NOT_FOUND',
          message: 'Extension not found'
        }
      });
    }
    
    // Delete extension
    const extensionName = extensions[extensionId].name;
    delete extensions[extensionId];
    
    logger.info(`Extension deleted: ${extensionName} (${extensionId})`);
    
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate API credentials
 */
export const regenerateCredentials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { extensionId } = req.params;
    
    // Check if extension exists
    const extension = extensions[extensionId];
    if (!extension) {
      return res.status(404).json({
        error: {
          code: 'EXTENSION_NOT_FOUND',
          message: 'Extension not found'
        }
      });
    }
    
    // Generate new API key and secret
    const apiKey = generateRandomString(API_KEY_LENGTH);
    const apiSecret = generateRandomString(API_SECRET_LENGTH);
    
    // Update extension
    extension.apiKey = apiKey;
    extension.apiSecret = apiSecret;
    
    logger.info(`API credentials regenerated for extension: ${extension.name} (${extensionId})`);
    
    // Return updated credentials
    return res.status(200).json({
      id: extension.id,
      apiKey: extension.apiKey,
      apiSecret: extension.apiSecret
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate extension API request
 * This function validates the API key and secret, and generates a short-lived JWT token for API access
 */
export const authenticateExtension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey, apiSecret } = req.body;
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'API key and secret are required'
        }
      });
    }
    
    // Find extension by API key
    const extension = Object.values(extensions).find(ext => ext.apiKey === apiKey);
    if (!extension || extension.apiSecret !== apiSecret) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid API key or secret'
        }
      });
    }
    
    // Check if extension is active
    if (extension.status !== 'active') {
      return res.status(403).json({
        error: {
          code: 'EXTENSION_INACTIVE',
          message: 'This extension is currently inactive'
        }
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        extensionId: extension.id,
        scopes: extension.scopes
      },
      config.jwt.secret,
      {
        expiresIn: '1h', // Short-lived token
        audience: 'extension-api'
      }
    );
    
    return res.status(200).json({
      token,
      expiresIn: 3600, // 1 hour in seconds
      tokenType: 'Bearer',
      scopes: extension.scopes
    });
  } catch (error) {
    next(error);
  }
};