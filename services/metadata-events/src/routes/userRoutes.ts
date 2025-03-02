import express from 'express';
import * as userController from '../controllers/userController';

const router = express.Router();

// GET /api/users - Get all users or filter by email
router.get('/', userController.getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', userController.getUserById);

// POST /api/users - Create a new user
router.post('/', userController.createUser);

// PUT /api/users/:id - Update user
router.put('/:id', userController.updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', userController.deleteUser);

export default router;