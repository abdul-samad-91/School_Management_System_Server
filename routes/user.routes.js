import express from 'express';
import {
  getUsers,
  getUser,
  updateUser,
  updateUserPermissions,
  toggleUserStatus,
  deleteUser
} from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, authorize('super_admin'), getUsers);
router.get('/:id', protect, authorize('super_admin'), getUser);
router.put('/:id', protect, authorize('super_admin'), updateUser);
router.put('/:id/permissions', protect, authorize('super_admin'), updateUserPermissions);
router.put('/:id/toggle-status', protect, authorize('super_admin'), toggleUserStatus);
router.delete('/:id', protect, authorize('super_admin'), deleteUser);

export default router;

