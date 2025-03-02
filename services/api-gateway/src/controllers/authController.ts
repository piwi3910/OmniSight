import { Request, Response } from 'express';
import axios from 'axios';
import bcrypt from 'bcrypt';
import config from '../config/config';
import logger from '../utils/logger';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';

/**
 * User login
 * 
 * @route POST /api/v1/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    // Validate request
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    // Get user from metadata service
    try {
      const response = await axios.get(`${config.services.metadataEvents.url}/api/users`, {
        params: { email },
        timeout: config.services.metadataEvents.timeout
      });
      
      const users = response.data.users;
      
      if (!users || users.length === 0) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      
      const user = users[0];
      
      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      
      // Create token payload
      const payload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
      // Generate tokens
      const token = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);
      
      // Update last login
      await axios.put(`${config.services.metadataEvents.url}/api/users/${user.id}`, {
        lastLogin: new Date()
      });
      
      // Return tokens
      res.status(200).json({
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Error getting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * User registration
 * 
 * @route POST /api/v1/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;
    
    // Validate request
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }
    
    // Check if user already exists
    try {
      const response = await axios.get(`${config.services.metadataEvents.url}/api/users`, {
        params: { email },
        timeout: config.services.metadataEvents.timeout
      });
      
      const users = response.data.users;
      
      if (users && users.length > 0) {
        res.status(400).json({ error: 'User already exists' });
        return;
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create user
      const createResponse = await axios.post(`${config.services.metadataEvents.url}/api/users`, {
        username,
        email,
        password: hashedPassword,
        role: 'user' // Default role
      });
      
      const newUser = createResponse.data;
      
      // Create token payload
      const payload = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      };
      
      // Generate tokens
      const token = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);
      
      // Return tokens
      res.status(201).json({
        token,
        refreshToken,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        }
      });
    } catch (error) {
      logger.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Refresh token
 * 
 * @route POST /api/v1/auth/refresh
 */
export const refresh = (req: Request, res: Response): void => {
  try {
    const { refreshToken } = req.body;
    
    // Validate request
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    if (!decoded) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    
    // Create token payload
    const payload = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role
    };
    
    // Generate new tokens
    const token = generateToken(payload);
    const newRefreshToken = generateRefreshToken(payload);
    
    // Return tokens
    res.status(200).json({
      token,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get current user
 * 
 * @route GET /api/v1/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // User should be set by auth middleware
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Get user from metadata service
    try {
      const response = await axios.get(`${config.services.metadataEvents.url}/api/users/${req.user.id}`, {
        timeout: config.services.metadataEvents.timeout
      });
      
      const user = response.data;
      
      // Return user info
      res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
          settings: user.settings
        }
      });
    } catch (error) {
      logger.error('Error getting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};