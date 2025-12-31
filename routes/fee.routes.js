import express from 'express';
import {
  getFeeStructures,
  getFeeStructure,
  createFeeStructure,
  updateFeeStructure,
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  getPaymentSummary
} from '../controllers/fee.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// Fee Structures
router.get('/structures', protect, checkPermission('fees', 'view'), getFeeStructures);
router.get('/structures/:id', protect, checkPermission('fees', 'view'), getFeeStructure);
router.post('/structures', protect, checkPermission('fees', 'create'), createFeeStructure);
router.put('/structures/:id', protect, checkPermission('fees', 'update'), updateFeeStructure);

// Payments
router.get('/payments', protect, checkPermission('fees', 'view'), getPayments);
router.get('/payments/:id', protect, checkPermission('fees', 'view'), getPayment);
router.post('/payments', protect, checkPermission('fees', 'create'), createPayment);
router.put('/payments/:id', protect, checkPermission('fees', 'update'), updatePayment);
router.get('/payments/summary/student', protect, checkPermission('fees', 'view'), getPaymentSummary);

export default router;

