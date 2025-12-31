import express from 'express';
import { 
  register, 
  login, 
  getMe, 
  updatePassword, 
  logout 
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/register'
  , protect, authorize('super_admin')
, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);
router.post('/logout', protect, logout);

export default router;

