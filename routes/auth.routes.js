import express from 'express';
import { 
  register, 
  login, 
  getMe, 
  update, 
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword
} from '../controllers/auth.controller.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { upload } from '../utils/CloudnaryUpload.js';

const router = express.Router();

router.post('/register', optionalAuth, register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/me/update', protect, upload.single('photo'), update);
router.post('/logout', protect, logout);

export default router;
