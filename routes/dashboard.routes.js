import express from 'express';
import {
  getDashboardStats,
  getAttendanceChart,
  getFeeChart
} from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', protect, getDashboardStats);
router.get('/attendance-chart', protect, getAttendanceChart);
router.get('/fee-chart', protect, getFeeChart);

export default router;

