import express from 'express';
import {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  updateStudentStatus,
  approveAdmission,
  promoteStudents
} from '../controllers/student.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, checkPermission('students', 'view'), getStudents);
router.get('/:id', protect, checkPermission('students', 'view'), getStudent);
router.post('/', protect, checkPermission('students', 'create'), createStudent);
router.put('/:id', protect, checkPermission('students', 'update'), updateStudent);
router.delete('/:id', protect, checkPermission('students', 'delete'), deleteStudent);
router.put('/:id/status', protect, checkPermission('students', 'update'), updateStudentStatus);
router.put('/:id/approve', protect, checkPermission('students', 'update'), approveAdmission);
router.post('/promote', protect, checkPermission('students', 'update'), promoteStudents);

export default router;

