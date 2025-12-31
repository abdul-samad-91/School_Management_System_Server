import express from 'express';
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAsRead
} from '../controllers/communication.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/announcements', protect, getAnnouncements);
router.get('/announcements/:id', protect, getAnnouncement);
router.post('/announcements', protect, checkPermission('communication', 'create'), createAnnouncement);
router.put('/announcements/:id', protect, checkPermission('communication', 'update'), updateAnnouncement);
router.delete('/announcements/:id', protect, checkPermission('communication', 'delete'), deleteAnnouncement);
router.put('/announcements/:id/read', protect, markAsRead);

export default router;

