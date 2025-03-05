import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, authorize, refreshToken } from '../auth';
import config from '../../config/config';
import { mockRequest, mockResponse } from '../../test/utils/test-utils';

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn().mockReturnValue('new-token'),
}));

describe('Auth Middleware', () => {
  let nextFunction: NextFunction;
  
  beforeEach(() => {
    jest.clearAllMocks();
    nextFunction = jest.fn();
  });
  
  describe('authenticate', () => {
    it('should set user and continue if token is valid', () => {
      // Arrange
      const mockUserData = { userId: 'test-user', role: 'USER' };
      (jwt.verify as jest.Mock).mockReturnValueOnce(mockUserData);
      
      const req = mockRequest({
        headers: {
          authorization: 'Bearer valid-token'
        }
      });
      const res = mockResponse();
      
      // Act
      authenticate(req, res, nextFunction);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', config.jwt.secret);
      expect(req.user).toEqual(mockUserData);
      expect(nextFunction).toHaveBeenCalled();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
    });
    
    it('should return 401 if no token is provided', () => {
      // Arrange
      const req = mockRequest({
        headers: {}
      });
      const res = mockResponse();
      
      // Act
      authenticate(req, res, nextFunction);
      
      // Assert
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
    
    it('should return 401 if token is invalid', () => {
      // Arrange
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });
      
      const req = mockRequest({
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });
      const res = mockResponse();
      
      // Act
      authenticate(req, res, nextFunction);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('invalid-token', config.jwt.secret);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
    
    it('should handle tokens with Bearer prefix correctly', () => {
      // Arrange
      const mockUserData = { userId: 'test-user', role: 'USER' };
      (jwt.verify as jest.Mock).mockReturnValueOnce(mockUserData);
      
      const req = mockRequest({
        headers: {
          authorization: 'Bearer valid-token'
        }
      });
      const res = mockResponse();
      
      // Act
      authenticate(req, res, nextFunction);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', config.jwt.secret);
      expect(req.user).toEqual(mockUserData);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
  
  describe('authorize', () => {
    it('should continue if user has required role', () => {
      // Arrange
      const authMiddleware = authorize(['ADMIN', 'USER']);
      const req = mockRequest({
        user: { userId: 'test-user', role: 'ADMIN' }
      });
      const res = mockResponse();
      
      // Act
      authMiddleware(req, res, nextFunction);
      
      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
    });
    
    it('should return 403 if user does not have required role', () => {
      // Arrange
      const authMiddleware = authorize(['ADMIN']);
      const req = mockRequest({
        user: { userId: 'test-user', role: 'USER' }
      });
      const res = mockResponse();
      
      // Act
      authMiddleware(req, res, nextFunction);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
    
    it('should return 401 if user is not authenticated', () => {
      // Arrange
      const authMiddleware = authorize(['ADMIN']);
      const req = mockRequest({
        user: null
      });
      const res = mockResponse();
      
      // Act
      authMiddleware(req, res, nextFunction);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
  
  describe('refreshToken', () => {
    it('should issue a new token if refresh token is valid', () => {
      // Arrange
      const mockUserData = { userId: 'test-user', role: 'USER' };
      (jwt.verify as jest.Mock).mockReturnValueOnce(mockUserData);
      
      const req = mockRequest({
        body: { refreshToken: 'valid-refresh-token' }
      });
      const res = mockResponse();
      
      // Act
      refreshToken(req, res);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-refresh-token', config.jwt.refreshSecret);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: mockUserData.userId, role: mockUserData.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
      expect(res.json).toHaveBeenCalledWith({
        token: 'new-token',
        user: mockUserData
      });
    });
    
    it('should return 400 if no refresh token is provided', () => {
      // Arrange
      const req = mockRequest({
        body: {}
      });
      const res = mockResponse();
      
      // Act
      refreshToken(req, res);
      
      // Assert
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token is required' });
    });
    
    it('should return 401 if refresh token is invalid', () => {
      // Arrange
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid refresh token');
      });
      
      const req = mockRequest({
        body: { refreshToken: 'invalid-refresh-token' }
      });
      const res = mockResponse();
      
      // Act
      refreshToken(req, res);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('invalid-refresh-token', config.jwt.refreshSecret);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid refresh token' });
    });
  });
});