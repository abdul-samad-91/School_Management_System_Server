import express from 'express';
import {
  markAttendance,
  getAttendance,
  updateAttendance,
  getAttendanceReport
} from '../controllers/attendance.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, checkPermission('academics', 'create'), markAttendance);
router.get('/', protect, checkPermission('academics', 'view'), getAttendance);
router.put('/:id', protect, checkPermission('academics', 'update'), updateAttendance);
router.get('/report', protect, checkPermission('academics', 'view'), getAttendanceReport);

export default router;

