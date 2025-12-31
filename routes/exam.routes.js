import express from 'express';
import {
  getExams,
  getExam,
  createExam,
  updateExam,
  publishExam,
  getResults,
  createResult,
  updateResult,
  publishResults
} from '../controllers/exam.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// Exams
router.get('/', protect, checkPermission('academics', 'view'), getExams);
router.get('/:id', protect, checkPermission('academics', 'view'), getExam);
router.post('/', protect, checkPermission('academics', 'create'), createExam);
router.put('/:id', protect, checkPermission('academics', 'update'), updateExam);
router.put('/:id/publish', protect, checkPermission('academics', 'update'), publishExam);

// Results
router.get('/results/all', protect, checkPermission('academics', 'view'), getResults);
router.post('/results', protect, checkPermission('academics', 'create'), createResult);
router.put('/results/:id', protect, checkPermission('academics', 'update'), updateResult);
router.post('/results/publish', protect, checkPermission('academics', 'update'), publishResults);

export default router;

