import express from 'express';
import {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  assignSubjects,
  assignClasses
} from '../controllers/teacher.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, checkPermission('teachers', 'view'), getTeachers);
router.get('/:id', protect, checkPermission('teachers', 'view'), getTeacher);
router.post('/', protect, checkPermission('teachers', 'create'), createTeacher);
router.put('/:id', protect, checkPermission('teachers', 'update'), updateTeacher);
router.delete('/:id', protect, checkPermission('teachers', 'delete'), deleteTeacher);
router.put('/:id/assign-subjects', protect, checkPermission('teachers', 'update'), assignSubjects);
router.put('/:id/assign-classes', protect, checkPermission('teachers', 'update'), assignClasses);

export default router;

