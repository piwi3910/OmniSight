import { Request, Response } from 'express';
import { prisma } from '../prisma/client';
import logger from '../utils/logger';

/**
 * Get all users or filter by email
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.query;
    
    // Filter by email if provided
    if (email) {
      const users = await prisma.user.findMany({
        where: {
          email: email as string
        }
      });
      
      res.status(200).json({ users });
      return;
    }
    
    // Otherwise return all users
    const users = await prisma.user.findMany();
    res.status(200).json({ users });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.status(200).json(user);
  } catch (error) {
    logger.error(`Error fetching user ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/**
 * Create a new user
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, role = 'USER', settings = {} } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });
    
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }
    
    // Create new user
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password,
        role,
        settings,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

/**
 * Update user
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Add updatedAt field
    updateData.updatedAt = new Date();
    
    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });
    
    // Remove password from response if it exists
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    logger.error(`Error updating user ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.user.delete({
      where: { id }
    });
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting user ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};