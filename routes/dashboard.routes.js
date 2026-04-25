import express from 'express';
import {
  getDashboardStats,
  getAttendanceChart,
  getFeeChart
} from '../controllers/dashboard.controller.js';
import { protect, checkPermissionOrRole } from '../middleware/auth.js';

const router = express.Router();

router.get(
  '/stats',
  protect,
  checkPermissionOrRole(
    'reports',
    'view',
    'admin',
    'teacher',
    'fee_editor',
    'exam_controller',
    'exam_officer',
    'exam_leader'
  ),
  getDashboardStats
);
router.get(
  '/attendance-chart',
  protect,
  checkPermissionOrRole(
    'reports',
    'view',
    'admin',
    'teacher',
    'fee_editor',
    'exam_controller',
    'exam_officer',
    'exam_leader'
  ),
  getAttendanceChart
);
router.get(
  '/fee-chart',
  protect,
  checkPermissionOrRole(
    'reports',
    'view',
    'admin',
    'teacher',
    'fee_editor',
    'exam_controller',
    'exam_officer',
    'exam_leader'
  ),
  getFeeChart
);

export default router;
