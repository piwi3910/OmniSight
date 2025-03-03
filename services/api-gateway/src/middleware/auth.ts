import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * User object returned from token verification
 */
export interface JWTUser {
  id: string;
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Authenticate JWT token middleware
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get the token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }
    
    // Verify the token
    const user = verifyToken(token);
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token'
        }
      });
      return;
    }
    
    // Attach user info to request
    req.user = user;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token'
      }
    });
  }
};

/**
 * Authorize based on role middleware
 */
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
      return;
    }
    
    next();
  };
};

/**
 * Verify JWT token and return user info
 */
export const verifyToken = (token: string): JWTUser | null => {
  try {
    // Verify the token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTUser;
    
    return {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (error) {
    logger.error('Token verification error:', error);
    return null;
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (user: Omit<JWTUser, 'iat' | 'exp'>): string => {
  return jwt.sign(user, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (user: Omit<JWTUser, 'iat' | 'exp'>): string => {
  return jwt.sign(user, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JWTUser | null => {
  try {
    // Verify the token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTUser;
    
    return {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (error) {
    logger.error('Refresh token verification error:', error);
    return null;
  }
};

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTUser;
    }
  }
}