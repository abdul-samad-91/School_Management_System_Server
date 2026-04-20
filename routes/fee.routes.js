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
import { protect, checkPermissionOrRole } from '../middleware/auth.js';

const router = express.Router();

// Fee Structures
router.get('/structures', protect, checkPermissionOrRole('fees', 'view', 'fee_editor'), getFeeStructures);
router.get('/structures/:id', protect, checkPermissionOrRole('fees', 'view', 'fee_editor'), getFeeStructure);
router.post('/structures', protect, checkPermissionOrRole('fees', 'create', 'fee_editor'), createFeeStructure);
router.put('/structures/:id', protect, checkPermissionOrRole('fees', 'update', 'fee_editor'), updateFeeStructure);

// Payments
router.get('/payments', protect, checkPermissionOrRole('fees', 'view', 'fee_editor'), getPayments);
router.get('/payments/summary/student', protect, checkPermissionOrRole('fees', 'view', 'fee_editor'), getPaymentSummary);
router.get('/payments/:id', protect, checkPermissionOrRole('fees', 'view', 'fee_editor'), getPayment);
router.post('/payments', protect, checkPermissionOrRole('fees', 'create', 'fee_editor'), createPayment);
router.put('/payments/:id', protect, checkPermissionOrRole('fees', 'update', 'fee_editor'), updatePayment);

export default router;
