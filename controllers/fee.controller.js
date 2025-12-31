import FeeStructure from '../models/Fee.model.js';
import FeePayment from '../models/FeePayment.model.js';
import { generateReceiptNumber } from '../utils/generateNumber.js';

// ========== Fee Structures ==========

export const getFeeStructures = async (req, res) => {
  try {
    const { session } = req.query;
    const query = session ? { session } : {};

    const feeStructures = await FeeStructure.find(query)
      .populate('session', 'name')
      .populate('classes', 'name level')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: feeStructures
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findById(req.params.id)
      .populate('session', 'name startDate endDate')
      .populate('classes', 'name level');

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    res.status(200).json({
      success: true,
      data: feeStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Fee structure created successfully',
      data: feeStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Fee structure updated successfully',
      data: feeStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========== Fee Payments ==========

export const getPayments = async (req, res) => {
  try {
    const { 
      studentId, 
      session, 
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};
    
    if (studentId) query.student = studentId;
    if (session) query.session = session;
    if (status) query.status = status;
    
    if (startDate && endDate) {
      query.paidDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const payments = await FeePayment.find(query)
      .populate('student', 'admissionNumber rollNumber profile')
      .populate('feeStructure', 'name totalAmount')
      .populate('session', 'name')
      .populate('collectedBy', 'profile.firstName profile.lastName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ paidDate: -1 });

    const count = await FeePayment.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getPayment = async (req, res) => {
  try {
    const payment = await FeePayment.findById(req.params.id)
      .populate('student', 'admissionNumber rollNumber profile parents')
      .populate('feeStructure', 'name feeTypes totalAmount')
      .populate('session', 'name')
      .populate('collectedBy', 'profile username');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createPayment = async (req, res) => {
  try {
    // Generate receipt number if not provided
    if (!req.body.receiptNumber) {
      req.body.receiptNumber = generateReceiptNumber();
    }

    const payment = await FeePayment.create({
      ...req.body,
      collectedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updatePayment = async (req, res) => {
  try {
    const payment = await FeePayment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getPaymentSummary = async (req, res) => {
  try {
    const { studentId, session } = req.query;

    if (!studentId || !session) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and session are required'
      });
    }

    const payments = await FeePayment.find({ student: studentId, session })
      .populate('feeStructure', 'totalAmount');

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
    const totalAmount = payments[0]?.feeStructure?.totalAmount || 0;
    const balance = totalAmount - totalPaid;

    res.status(200).json({
      success: true,
      data: {
        totalAmount,
        totalPaid,
        balance,
        payments: payments.length,
        status: balance <= 0 ? 'paid' : 'pending'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

