import express from 'express';
import {
  getExams,
  getExam,
  createExam,
  updateExam,
  publishExam,
  startExam,
  getResults,
  createResult,
  updateResult,
  publishResults
} from '../controllers/exam.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Exams
router.get('/', protect, authorize('exam_leader', 'super_admin'), getExams);
router.post('/', protect, authorize('exam_leader', 'super_admin'), createExam);

// Results
router.get('/results/all', protect, authorize('exam_leader', 'super_admin'), getResults);
router.post('/results', protect, authorize('exam_leader', 'super_admin'), createResult);
router.put('/results/:id', protect, authorize('exam_leader', 'super_admin'), updateResult);
router.post('/results/publish', protect, authorize('exam_leader', 'super_admin'), publishResults);
router.get('/:id', protect, authorize('exam_leader', 'super_admin'), getExam);
router.put('/:id', protect, authorize('exam_leader', 'super_admin'), updateExam);
router.put('/:id/publish', protect, authorize('exam_leader', 'super_admin'), publishExam);
router.put(
  '/:id/start',
  protect,
  authorize('exam_officer', 'exam_controller', 'exam_leader', 'super_admin'),
  startExam
);

export default router;
