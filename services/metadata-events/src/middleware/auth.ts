import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import logger from '../utils/logger';

interface DecodedToken {
  id: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user information to request
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.debug('No authorization header provided');
    return res.status(401).json({ error: 'No token, authorization denied' });
  }
  
  // Check if auth header starts with Bearer
  if (!authHeader.startsWith('Bearer ')) {
    logger.debug('Invalid authorization format');
    return res.status(401).json({ error: 'Invalid token format' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as DecodedToken;
    
    // Add user from payload to request
    (req as any).user = {
      id: decoded.id,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Role-based authorization middleware
 * Checks if the user has the required role
 */
export const authorize = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (user.role !== requiredRole && user.role !== 'admin') {
      logger.debug(`Authorization failed: User role ${user.role} does not match required role ${requiredRole}`);
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    
    next();
  };
};