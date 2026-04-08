import express from 'express';
import { 
  register, 
  login, 
  getMe, 
  update, 
  logout 
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../utils/CloudnaryUpload.js';

const router = express.Router();

router.post('/register'
  // , protect, authorize('super_admin')
, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/me/update', protect, upload.single('photo'), update);
router.post('/logout', protect, logout);

export default router;
