import express from 'express';
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAsRead
} from '../controllers/communication.controller.js';
import { protect, checkPermission, checkPermissionOrRole } from '../middleware/auth.js';

const router = express.Router();

router.get(
  '/announcements',
  protect,
  checkPermissionOrRole(
    'communication',
    'view',
    'admin',
    'teacher',
    'fee_editor',
    'exam_controller',
    'exam_officer',
    'exam_leader'
  ),
  getAnnouncements
);
router.get(
  '/announcements/:id',
  protect,
  checkPermissionOrRole(
    'communication',
    'view',
    'admin',
    'teacher',
    'fee_editor',
    'exam_controller',
    'exam_officer',
    'exam_leader'
  ),
  getAnnouncement
);
router.post('/announcements', protect, checkPermission('communication', 'create'), createAnnouncement);
router.put('/announcements/:id', protect, checkPermission('communication', 'update'), updateAnnouncement);
router.delete('/announcements/:id', protect, checkPermission('communication', 'delete'), deleteAnnouncement);
router.put(
  '/announcements/:id/read',
  protect,
  checkPermissionOrRole(
    'communication',
    'view',
    'admin',
    'teacher',
    'fee_editor',
    'exam_controller',
    'exam_officer',
    'exam_leader'
  ),
  markAsRead
);

export default router;
