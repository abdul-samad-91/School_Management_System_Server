import express from 'express';
import {
  getSchoolProfile,
  createSchoolProfile,
  updateSchoolProfile
} from '../controllers/school.controller.js';
import { protect, authorize, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/profile', protect, getSchoolProfile);
router.post('/profile', protect, authorize('super_admin'), createSchoolProfile);
router.put('/profile/:id', protect, authorize('super_admin'), updateSchoolProfile);

export default router;

