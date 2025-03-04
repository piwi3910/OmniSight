import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import logger from '../utils/logger';
import { ExtensionScope } from '../models/extension';

/**
 * Interface for decoded JWT token from extensions
 */
interface ExtensionJwtPayload {
  extensionId: string;
  scopes: ExtensionScope[];
  aud?: string | string[];
  iat: number;
  exp: number;
}

/**
 * Augment Express Request interface to include extension data
 */
declare global {
  namespace Express {
    interface Request {
      extension?: {
        id: string;
        scopes: ExtensionScope[];
      };
    }
  }
}

/**
 * Authenticate extension API requests using JWT token
 * This middleware validates the JWT token and ensures the extension has proper permissions
 */
export const authenticateExtensionApi = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required'
        }
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const decoded = jwt.verify(token, config.jwt.secret, {
      audience: 'extension-api'
    }) as ExtensionJwtPayload;
    
    // Add extension data to request object
    req.extension = {
      id: decoded.extensionId,
      scopes: decoded.scopes
    };
    
    next();
  } catch (error) {
    // Handle various JWT errors
    if (error instanceof Error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid token'
          }
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: {
            code: 'EXPIRED_TOKEN',
            message: 'Token has expired'
          }
        });
      }
    }
    
    logger.error('Extension auth error:', error);
    return res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error'
      }
    });
  }
};

/**
 * Authorize extension based on required scopes
 * This middleware ensures the extension has the necessary permissions for the requested operation
 */
export const authorizeExtension = (requiredScopes: ExtensionScope[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Make sure authentication middleware has been run
      if (!req.extension) {
        return res.status(500).json({
          error: {
            code: 'MISSING_AUTH',
            message: 'Authentication middleware must be run before authorization'
          }
        });
      }
      
      // Check if extension has all required scopes
      const hasAllScopes = requiredScopes.every(scope => 
        req.extension!.scopes.includes(scope)
      );
      
      if (!hasAllScopes) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Extension does not have required permissions',
            requiredScopes,
            grantedScopes: req.extension.scopes
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Extension authorization error:', error);
      return res.status(500).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Authorization error'
        }
      });
    }
  };
};