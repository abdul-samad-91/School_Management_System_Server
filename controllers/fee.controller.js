import mongoose from 'mongoose';
import FeeStructure from '../models/Fee.model.js';
import FeePayment from '../models/FeePayment.model.js';

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ success: false, message: error.message });
};

const resolveSchoolId = (req, explicit) => {
  if (explicit && mongoose.Types.ObjectId.isValid(explicit)) return explicit;
  return req.user?.school ? req.user.school.toString() : null;
};

// Fee Structures
export const getFeeStructures = async (req, res) => {
  try {
    const { school, session, classId, isActive, search, page = 1, limit = 20 } = req.query;
    const query = {};
    const schoolId = resolveSchoolId(req, school);
    if (schoolId) query.school = schoolId;
    if (session) query.session = session;
    if (classId) query.class = classId;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { className: { $regex: search, $options: 'i' } },
        { feeType: { $regex: search, $options: 'i' } }
      ];
    }

    const currentPage = Number(page) || 1;
    const perPage = Number(limit) || 20;

    const structures = await FeeStructure.find(query)
      .populate('class', 'name level')
      .populate('session', 'name')
      .limit(perPage)
      .skip((currentPage - 1) * perPage)
      .sort({ createdAt: -1 });

    const count = await FeeStructure.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / perPage),
      currentPage,
      data: structures
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getFeeStructure = async (req, res) => {
  try {
    const structure = await FeeStructure.findById(req.params.id)
      .populate('class', 'name level')
      .populate('session', 'name');

    if (!structure) {
      return res.status(404).json({ success: false, message: 'Fee structure not found' });
    }

    res.status(200).json({ success: true, data: structure });
  } catch (error) {
    handleError(res, error);
  }
};

export const createFeeStructure = async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, req.body.school);
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School context is required' });
    }

    const { className, feeType, amount, monthYear, session, class: classRef, finePerDay } = req.body;

    if (!feeType) {
      return res.status(400).json({ success: false, message: 'feeType is required' });
    }
    if (amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'amount is required' });
    }

    // Parse monthYear into month and year if provided
    let month, year;
    if (monthYear) {
      const parts = monthYear.trim().split(/\s+/);
      month = parts[0] || '';
      year = parts[1] || '';
    }

    const structure = await FeeStructure.create({
      school: schoolId,
      session: session || undefined,
      class: classRef || undefined,
      className: className || undefined,
      feeType,
      amount: parseFloat(amount),
      month,
      year,
      monthYear: monthYear || undefined,
      finePerDay: finePerDay ? parseFloat(finePerDay) : 0,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Fee structure created successfully',
      data: structure
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateFeeStructure = async (req, res) => {
  try {
    const structure = await FeeStructure.findById(req.params.id);
    if (!structure) {
      return res.status(404).json({ success: false, message: 'Fee structure not found' });
    }

    const allowed = ['className', 'feeType', 'amount', 'monthYear', 'month', 'year', 'finePerDay', 'isActive', 'class', 'session'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        structure[field] = req.body[field];
      }
    });

    // Re-parse monthYear if updated
    if (req.body.monthYear) {
      const parts = req.body.monthYear.trim().split(/\s+/);
      structure.month = parts[0] || '';
      structure.year = parts[1] || '';
    }

    await structure.save();

    res.status(200).json({
      success: true,
      message: 'Fee structure updated successfully',
      data: structure
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteFeeStructure = async (req, res) => {
  try {
    const structure = await FeeStructure.findByIdAndDelete(req.params.id);
    if (!structure) {
      return res.status(404).json({ success: false, message: 'Fee structure not found' });
    }
    res.status(200).json({ success: true, message: 'Fee structure deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

// Fee Payments
export const getPayments = async (req, res) => {
  try {
    const { school, studentId, session, status, month, page = 1, limit = 20 } = req.query;
    const query = {};
    const schoolId = resolveSchoolId(req, school);
    if (schoolId) query.school = schoolId;
    if (studentId) query.student = studentId;
    if (session) query.session = session;
    if (status) query.status = status;
    if (month) query.month = month;

    const currentPage = Number(page) || 1;
    const perPage = Number(limit) || 20;

    const payments = await FeePayment.find(query)
      .populate('student', 'admissionNumber rollNumber profile.firstName profile.lastName')
      .populate('class', 'name level')
      .populate('session', 'name')
      .populate('feeStructure', 'feeType amount className')
      .limit(perPage)
      .skip((currentPage - 1) * perPage)
      .sort({ createdAt: -1 });

    const count = await FeePayment.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / perPage),
      currentPage,
      data: payments
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getPayment = async (req, res) => {
  try {
    const payment = await FeePayment.findById(req.params.id)
      .populate('student', 'admissionNumber rollNumber profile.firstName profile.lastName')
      .populate('class', 'name level')
      .populate('session', 'name');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    handleError(res, error);
  }
};

export const createPayment = async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, req.body.school);
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School context is required' });
    }

    const payment = await FeePayment.create({
      school: schoolId,
      student: req.body.student,
      class: req.body.class || undefined,
      session: req.body.session || undefined,
      feeStructure: req.body.feeStructure || undefined,
      rollNo: req.body.rollNo || undefined,
      month: req.body.month || undefined,
      totalAmount: req.body.totalAmount || req.body.amount,
      paidAmount: req.body.paidAmount || 0,
      dueDate: req.body.dueDate || undefined,
      fineAmount: req.body.fineAmount || 0,
      paymentMethod: req.body.paymentMethod || 'cash',
      status: req.body.status || 'Unpaid',
      remarks: req.body.remarks || undefined,
      collectedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: payment
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updatePayment = async (req, res) => {
  try {
    const payment = await FeePayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const allowed = ['status', 'paidAmount', 'totalAmount', 'dueDate', 'fineAmount', 'paymentMethod', 'remarks', 'month'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        payment[field] = req.body[field];
      }
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: payment
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getPaymentSummary = async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, req.query.school);
    const { studentId, session } = req.query;
    const query = {};
    if (schoolId) query.school = schoolId;
    if (studentId) query.student = studentId;
    if (session) query.session = session;

    const payments = await FeePayment.find(query);

    const totalAmount = payments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const totalPending = payments.reduce((sum, p) => sum + (p.pendingAmount || 0), 0);
    const totalFine = payments.reduce((sum, p) => sum + (p.fineAmount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalAmount,
        totalPaid,
        totalPending,
        totalFine,
        paymentCount: payments.length
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const deletePayment = async (req, res) => {
  try {
    const payment = await FeePayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    await FeePayment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    handleError(res, error);
  }
};
