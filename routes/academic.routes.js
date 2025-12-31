import express from 'express';
import {
  getSessions,
  createSession,
  updateSession,
  setActiveSession,
  getClasses,
  getClass,
  createClass,
  updateClass,
  getSubjects,
  createSubject,
  updateSubject,
  getGradingSystems,
  createGradingSystem,
  getTimetables,
  createTimetable,
  updateTimetable
} from '../controllers/academic.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// Academic Sessions
router.get('/sessions', protect, checkPermission('academics', 'view'), getSessions);
router.post('/sessions', protect, checkPermission('academics', 'create'), createSession);
router.put('/sessions/:id', protect, checkPermission('academics', 'update'), updateSession);
router.put('/sessions/:id/activate', protect, checkPermission('academics', 'update'), setActiveSession);

// Classes
router.get('/classes', protect, checkPermission('academics', 'view'), getClasses);
router.get('/classes/:id', protect, checkPermission('academics', 'view'), getClass);
router.post('/classes', protect, checkPermission('academics', 'create'), createClass);
router.put('/classes/:id', protect, checkPermission('academics', 'update'), updateClass);

// Subjects
router.get('/subjects', protect, checkPermission('academics', 'view'), getSubjects);
router.post('/subjects', protect, checkPermission('academics', 'create'), createSubject);
router.put('/subjects/:id', protect, checkPermission('academics', 'update'), updateSubject);

// Grading Systems
router.get('/grading-systems', protect, checkPermission('academics', 'view'), getGradingSystems);
router.post('/grading-systems', protect, checkPermission('academics', 'create'), createGradingSystem);

// Timetables
router.get('/timetables', protect, checkPermission('academics', 'view'), getTimetables);
router.post('/timetables', protect, checkPermission('academics', 'create'), createTimetable);
router.put('/timetables/:id', protect, checkPermission('academics', 'update'), updateTimetable);

export default router;

