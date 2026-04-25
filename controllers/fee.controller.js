import mongoose from 'mongoose';
import FeeStructure from '../models/Fee.model.js';
import FeePayment from '../models/FeePayment.model.js';
import AcademicSession from '../models/AcademicSession.model.js';
import Class from '../models/Class.model.js';
import Student from '../models/Student.model.js';
import { generateReceiptNumber } from '../utils/generateNumber.js';

const FEE_TYPE_NAMES = [
  'tuition',
  'admission',
  'transport',
  'exam',
  'library',
  'sports',
  'lab',
  'activity',
  'other'
];

const DISCOUNT_TYPES = ['percentage', 'fixed'];
const PAYMENT_DISCOUNT_TYPES = ['scholarship', 'sibling', 'merit', 'staff', 'other'];
const PAYMENT_METHODS = ['cash', 'card', 'online', 'cheque', 'bank_transfer'];

const createFeeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getFeeErrorStatus = (error) => {
  if (error.statusCode) {
    return error.statusCode;
  }

  if (
    error.name === 'ValidationError' ||
    error.name === 'CastError' ||
    error.code === 11000
  ) {
    return 400;
  }

  return 500;
};

const handleFeeError = (res, error) => {
  res.status(getFeeErrorStatus(error)).json({
    success: false,
    message: error.message
  });
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return String(value);
};

const ensureObjectId = (value, fieldName) => {
  if (!value) {
    throw createFeeError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createFeeError(`${fieldName} must be a valid id`);
  }

  return toIdString(value);
};

const parseStructuredField = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const looksLikeJson =
    (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
    (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'));

  if (!looksLikeJson) {
    return value;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    throw createFeeError(`Invalid ${fieldName} JSON`);
  }
};

const normalizeTrimmedString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createFeeError(`${fieldName} is required`);
    }

    return undefined;
  }

  return String(value).trim();
};

const normalizeNullableObjectId = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  return ensureObjectId(value, fieldName);
};

const normalizeNumber = (value, fieldName, options = {}) => {
  const {
    required = false,
    min,
    max,
    integer = false
  } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createFeeError(`${fieldName} is required`);
    }

    return undefined;
  }

  const normalizedNumber = Number(value);

  if (Number.isNaN(normalizedNumber)) {
    throw createFeeError(`${fieldName} must be a valid number`);
  }

  if (integer && !Number.isInteger(normalizedNumber)) {
    throw createFeeError(`${fieldName} must be an integer`);
  }

  if (min !== undefined && normalizedNumber < min) {
    throw createFeeError(`${fieldName} must be greater than or equal to ${min}`);
  }

  if (max !== undefined && normalizedNumber > max) {
    throw createFeeError(`${fieldName} must be less than or equal to ${max}`);
  }

  return normalizedNumber;
};

const normalizeDateValue = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createFeeError(`${fieldName} is required`);
    }

    return undefined;
  }

  const normalizedDate = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    throw createFeeError(`${fieldName} must be a valid date`);
  }

  return normalizedDate;
};

const normalizeBoolean = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return Boolean(value);
};

const normalizeObjectIdArray = (values, fieldName) => {
  if (values === undefined || values === null || values === '') {
    return [];
  }

  const normalizedValues = Array.isArray(values) ? values : [values];

  return [
    ...new Set(normalizedValues.map((value) => ensureObjectId(value, fieldName)))
  ];
};

const normalizePagination = (pageValue, limitValue) => {
  const page = Number.parseInt(pageValue, 10);
  const limit = Number.parseInt(limitValue, 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 10 : limit
  };
};

const roundCurrency = (value) => Number(Number(value).toFixed(2));

const getUserSchoolId = (req) => (req.user?.school ? toIdString(req.user.school) : null);
const isMasterAdmin = (req) => req.user?.role === 'master_admin';

const resolveScopedSchoolId = (req, explicitSchoolId) => {
  const userSchoolId = getUserSchoolId(req);
  const requestedSchoolId = explicitSchoolId
    ? ensureObjectId(explicitSchoolId, 'school')
    : null;

  if (!isMasterAdmin(req) && userSchoolId) {
    if (requestedSchoolId && requestedSchoolId !== userSchoolId) {
      throw createFeeError(
        'You can only access fee records for your assigned branch',
        403
      );
    }

    return userSchoolId;
  }

  return requestedSchoolId || userSchoolId || null;
};

const resolveRequiredSchoolId = (req, explicitSchoolId) => {
  const schoolId = resolveScopedSchoolId(req, explicitSchoolId);

  if (!schoolId) {
    throw createFeeError('school is required');
  }

  return schoolId;
};

const ensureSessionExists = async (sessionId, schoolId) => {
  const query = {
    _id: ensureObjectId(sessionId, 'session')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const session = await AcademicSession.findOne(query).select('_id school name startDate endDate');

  if (!session) {
    throw createFeeError('Academic session not found', 404);
  }

  return session;
};

const ensureClassDocuments = async (classIds = [], schoolId, sessionId) => {
  if (classIds.length === 0) {
    return new Map();
  }

  const query = {
    _id: { $in: classIds }
  };

  if (schoolId) {
    query.school = schoolId;
  }

  if (sessionId) {
    query.session = sessionId;
  }

  const classDocs = await Class.find(query).select('_id name level school session sections');

  if (classDocs.length !== classIds.length) {
    throw createFeeError('One or more classes were not found', 404);
  }

  return new Map(classDocs.map((classDoc) => [toIdString(classDoc._id), classDoc]));
};

const ensureStudentDocument = async (studentId, schoolId) => {
  const query = {
    _id: ensureObjectId(studentId, 'student')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const student = await Student.findOne(query).select(
    '_id school status admissionNumber rollNumber profile.firstName profile.lastName academic'
  );

  if (!student) {
    throw createFeeError('Student not found', 404);
  }

  return student;
};

const ensureFeeStructureDocument = async (feeStructureId, schoolId, sessionId) => {
  const query = {
    _id: ensureObjectId(feeStructureId, 'feeStructure')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  if (sessionId) {
    query.session = sessionId;
  }

  const feeStructure = await FeeStructure.findOne(query);

  if (!feeStructure) {
    throw createFeeError('Fee structure not found', 404);
  }

  return feeStructure;
};

const ensureReceiptNumberIsUnique = async (receiptNumber, excludeId = null) => {
  if (!receiptNumber) {
    return;
  }

  const query = {
    receiptNumber: receiptNumber.toUpperCase()
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingPayment = await FeePayment.findOne(query).select('_id');

  if (existingPayment) {
    throw createFeeError('receiptNumber already exists');
  }
};

const normalizeFeeTypes = (feeTypesInput) => {
  if (!Array.isArray(feeTypesInput) || feeTypesInput.length === 0) {
    throw createFeeError('feeTypes must be a non-empty array');
  }

  const usedNames = new Set();

  return feeTypesInput.map((feeType, index) => {
    if (!isPlainObject(feeType)) {
      throw createFeeError(`feeTypes[${index}] must be a valid object`);
    }

    const name = normalizeTrimmedString(feeType.name, `feeTypes[${index}].name`, {
      required: true
    }).toLowerCase();

    if (!FEE_TYPE_NAMES.includes(name)) {
      throw createFeeError(
        `feeTypes[${index}].name must be one of ${FEE_TYPE_NAMES.join(', ')}`
      );
    }

    if (usedNames.has(name)) {
      throw createFeeError('feeTypes cannot contain duplicate names');
    }

    usedNames.add(name);

    return {
      name,
      amount: normalizeNumber(feeType.amount, `feeTypes[${index}].amount`, {
        required: true,
        min: 0
      }),
      description: normalizeTrimmedString(
        feeType.description,
        `feeTypes[${index}].description`
      ),
      isOptional:
        feeType.isOptional !== undefined ? normalizeBoolean(feeType.isOptional) : false
    };
  });
};

const calculateFeeStructureTotal = (feeTypes = []) =>
  roundCurrency(feeTypes.reduce((sum, feeType) => sum + feeType.amount, 0));

const normalizeInstallments = (installmentsInput, totalAmount) => {
  if (installmentsInput === undefined) {
    return [];
  }

  if (!Array.isArray(installmentsInput)) {
    throw createFeeError('installments must be an array');
  }

  const usedNames = new Set();
  const installments = installmentsInput.map((installment, index) => {
    if (!isPlainObject(installment)) {
      throw createFeeError(`installments[${index}] must be a valid object`);
    }

    const name = normalizeTrimmedString(installment.name, `installments[${index}].name`, {
      required: true
    });

    if (usedNames.has(name.toLowerCase())) {
      throw createFeeError('installments cannot contain duplicate names');
    }

    usedNames.add(name.toLowerCase());

    return {
      name,
      amount: normalizeNumber(installment.amount, `installments[${index}].amount`, {
        required: true,
        min: 0
      }),
      dueDate: normalizeDateValue(installment.dueDate, `installments[${index}].dueDate`, {
        required: true
      }),
      description: normalizeTrimmedString(
        installment.description,
        `installments[${index}].description`
      )
    };
  });

  if (installments.length > 0) {
    const totalInstallmentAmount = roundCurrency(
      installments.reduce((sum, installment) => sum + installment.amount, 0)
    );

    if (Math.abs(totalInstallmentAmount - totalAmount) > 0.01) {
      throw createFeeError('Installment amounts must add up to the total fee amount');
    }
  }

  return installments;
};

const normalizeStructureDiscounts = (discountsInput) => {
  if (discountsInput === undefined) {
    return [];
  }

  if (!Array.isArray(discountsInput)) {
    throw createFeeError('discounts must be an array');
  }

  return discountsInput.map((discount, index) => {
    if (!isPlainObject(discount)) {
      throw createFeeError(`discounts[${index}] must be a valid object`);
    }

    const type = normalizeTrimmedString(discount.type, `discounts[${index}].type`, {
      required: true
    }).toLowerCase();

    if (!DISCOUNT_TYPES.includes(type)) {
      throw createFeeError(
        `discounts[${index}].type must be one of ${DISCOUNT_TYPES.join(', ')}`
      );
    }

    const value = normalizeNumber(discount.value, `discounts[${index}].value`, {
      required: true,
      min: 0
    });

    if (type === 'percentage' && value > 100) {
      throw createFeeError(`discounts[${index}].value cannot exceed 100`);
    }

    return {
      name: normalizeTrimmedString(discount.name, `discounts[${index}].name`, {
        required: true
      }),
      type,
      value,
      description: normalizeTrimmedString(
        discount.description,
        `discounts[${index}].description`
      ),
      conditions: normalizeTrimmedString(
        discount.conditions,
        `discounts[${index}].conditions`
      )
    };
  });
};

const normalizeLateFine = (lateFineInput) => {
  if (lateFineInput === undefined) {
    return {
      enabled: false
    };
  }

  if (!isPlainObject(lateFineInput)) {
    throw createFeeError('lateFine must be a valid object');
  }

  const enabled = normalizeBoolean(lateFineInput.enabled);

  if (!enabled) {
    return {
      enabled: false
    };
  }

  const type = normalizeTrimmedString(lateFineInput.type, 'lateFine.type', {
    required: true
  }).toLowerCase();

  if (!DISCOUNT_TYPES.includes(type)) {
    throw createFeeError(`lateFine.type must be one of ${DISCOUNT_TYPES.join(', ')}`);
  }

  const value = normalizeNumber(lateFineInput.value, 'lateFine.value', {
    required: true,
    min: 0
  });

  if (type === 'percentage' && value > 100) {
    throw createFeeError('lateFine.value cannot exceed 100');
  }

  return {
    enabled: true,
    type,
    value,
    gracePeriod:
      lateFineInput.gracePeriod !== undefined
        ? normalizeNumber(lateFineInput.gracePeriod, 'lateFine.gracePeriod', {
            min: 0,
            integer: true
          })
        : undefined
  };
};

const normalizePaymentDiscount = (discountInput, amount) => {
  if (discountInput === undefined) {
    return undefined;
  }

  if (!isPlainObject(discountInput)) {
    throw createFeeError('discount must be a valid object');
  }

  const type = normalizeTrimmedString(discountInput.type, 'discount.type', {
    required: true
  }).toLowerCase();

  if (!PAYMENT_DISCOUNT_TYPES.includes(type)) {
    throw createFeeError(
      `discount.type must be one of ${PAYMENT_DISCOUNT_TYPES.join(', ')}`
    );
  }

  const discountAmount = normalizeNumber(discountInput.amount, 'discount.amount', {
    required: true,
    min: 0
  });

  if (discountAmount > amount) {
    throw createFeeError('discount.amount cannot exceed the base amount');
  }

  return {
    type,
    amount: discountAmount,
    reason: normalizeTrimmedString(discountInput.reason, 'discount.reason')
  };
};

const normalizePaymentDetails = (paymentDetailsInput) => {
  if (paymentDetailsInput === undefined) {
    return undefined;
  }

  if (!isPlainObject(paymentDetailsInput)) {
    throw createFeeError('paymentDetails must be a valid object');
  }

  return {
    transactionId: normalizeTrimmedString(
      paymentDetailsInput.transactionId,
      'paymentDetails.transactionId'
    ),
    chequeNumber: normalizeTrimmedString(
      paymentDetailsInput.chequeNumber,
      'paymentDetails.chequeNumber'
    ),
    bankName: normalizeTrimmedString(paymentDetailsInput.bankName, 'paymentDetails.bankName'),
    paymentDate: normalizeDateValue(
      paymentDetailsInput.paymentDate,
      'paymentDetails.paymentDate'
    )
  };
};

const normalizeInstallmentSelection = (installmentInput, feeStructure) => {
  if (installmentInput === undefined) {
    return undefined;
  }

  if (!isPlainObject(installmentInput)) {
    throw createFeeError('installment must be a valid object');
  }

  const installmentNumber =
    installmentInput.number !== undefined
      ? normalizeNumber(installmentInput.number, 'installment.number', {
          min: 1,
          integer: true
        })
      : undefined;
  const installmentName = normalizeTrimmedString(
    installmentInput.name,
    'installment.name'
  );

  if (installmentNumber === undefined && !installmentName) {
    throw createFeeError('installment.number or installment.name is required');
  }

  const matchedInstallment = (feeStructure.installments || []).find((installment, index) => {
    if (installmentNumber !== undefined && installmentNumber === index + 1) {
      return true;
    }

    if (
      installmentName &&
      installment?.name &&
      installment.name.toLowerCase() === installmentName.toLowerCase()
    ) {
      return true;
    }

    return false;
  });

  if (!matchedInstallment) {
    throw createFeeError('Selected installment was not found in the fee structure');
  }

  return {
    number:
      installmentNumber !== undefined
        ? installmentNumber
        : (feeStructure.installments || []).findIndex(
            (installment) =>
              installment?.name &&
              installment.name.toLowerCase() === installmentName.toLowerCase()
          ) + 1,
    name: matchedInstallment.name,
    amount: matchedInstallment.amount
  };
};

const ensureFeeStructureAppliesToStudent = (student, feeStructure, sessionId) => {
  if (toIdString(feeStructure.session) !== sessionId) {
    throw createFeeError('Fee structure does not belong to the selected session');
  }

  if (
    student.academic?.session &&
    toIdString(student.academic.session) !== sessionId
  ) {
    throw createFeeError('Student does not belong to the selected session');
  }

  const studentClassId = toIdString(student.academic?.currentClass);
  if (!studentClassId) {
    throw createFeeError('Student is not assigned to a class');
  }

  if (
    Array.isArray(feeStructure.classes) &&
    feeStructure.classes.length > 0 &&
    !feeStructure.classes.some((classId) => toIdString(classId) === studentClassId)
  ) {
    throw createFeeError('Selected fee structure does not apply to the student class');
  }
};

const buildFeeStructureQueryFilter = (req) => {
  const schoolId = resolveScopedSchoolId(req, req.query.school);
  const query = {};

  if (schoolId) {
    query.school = schoolId;
  }

  if (req.query.session) {
    query.session = ensureObjectId(req.query.session, 'session');
  }

  if (req.query.classId) {
    query.classes = ensureObjectId(req.query.classId, 'classId');
  }

  if (req.query.isActive !== undefined) {
    query.isActive = normalizeBoolean(req.query.isActive);
  }

  if (req.query.search) {
    query.name = {
      $regex: String(req.query.search).trim(),
      $options: 'i'
    };
  }

  return query;
};

const buildPaymentQueryFilter = (req) => {
  const schoolId = resolveScopedSchoolId(req, req.query.school);
  const query = {};

  if (schoolId) {
    query.school = schoolId;
  }

  if (req.query.studentId) {
    query.student = ensureObjectId(req.query.studentId, 'studentId');
  }

  if (req.query.session) {
    query.session = ensureObjectId(req.query.session, 'session');
  }

  if (req.query.feeStructureId) {
    query.feeStructure = ensureObjectId(req.query.feeStructureId, 'feeStructureId');
  }

  if (req.query.status) {
    query.status = normalizeTrimmedString(req.query.status, 'status');
  }

  if (req.query.paymentMethod) {
    query.paymentMethod = normalizeTrimmedString(req.query.paymentMethod, 'paymentMethod');
  }

  if (req.query.receiptNumber) {
    query.receiptNumber = normalizeTrimmedString(req.query.receiptNumber, 'receiptNumber')
      .toUpperCase();
  }

  if (req.query.startDate || req.query.endDate) {
    query.paidDate = {};

    if (req.query.startDate) {
      query.paidDate.$gte = normalizeDateValue(req.query.startDate, 'startDate', {
        required: true
      });
    }

    if (req.query.endDate) {
      query.paidDate.$lte = normalizeDateValue(req.query.endDate, 'endDate', {
        required: true
      });
    }
  }

  return query;
};

const populateFeeStructureQuery = (query) =>
  query
    .populate('school', 'name code')
    .populate('session', 'name startDate endDate')
    .populate('classes', 'name level')
    .populate('createdBy', 'username role profile.firstName profile.lastName');

const populatePaymentQuery = (query) =>
  query
    .populate('school', 'name code')
    .populate(
      'student',
      'admissionNumber rollNumber profile.firstName profile.lastName academic.currentClass academic.session'
    )
    .populate('feeStructure', 'name totalAmount feeTypes installments classes')
    .populate('session', 'name startDate endDate')
    .populate('collectedBy', 'username role profile.firstName profile.lastName');

const findScopedFeeStructureById = async (req, feeStructureId) => {
  const schoolId = resolveScopedSchoolId(req, undefined);
  const query = {
    _id: ensureObjectId(feeStructureId, 'feeStructure')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const feeStructure = await FeeStructure.findOne(query);

  if (!feeStructure) {
    throw createFeeError('Fee structure not found', 404);
  }

  return feeStructure;
};

const findScopedPaymentById = async (req, paymentId) => {
  const schoolId = resolveScopedSchoolId(req, undefined);
  const query = {
    _id: ensureObjectId(paymentId, 'payment')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const payment = await FeePayment.findOne(query);

  if (!payment) {
    throw createFeeError('Payment not found', 404);
  }

  return payment;
};

// ========== Fee Structures ==========

export const getFeeStructures = async (req, res) => {
  try {
    const query = buildFeeStructureQueryFilter(req);
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);

    const feeStructures = await populateFeeStructureQuery(
      FeeStructure.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    );

    const count = await FeeStructure.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: feeStructures
    });
  } catch (error) {
    handleFeeError(res, error);
  }
};

export const getFeeStructure = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, undefined);
    const query = {
      _id: ensureObjectId(req.params.id, 'feeStructure')
    };

    if (schoolId) {
      query.school = schoolId;
    }

    const feeStructure = await populateFeeStructureQuery(FeeStructure.findOne(query));

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
    handleFeeError(res, error);
  }
};

export const createFeeStructure = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    const sessionId = ensureObjectId(req.body.session, 'session');
    await ensureSessionExists(sessionId, schoolId);

    const classIds = normalizeObjectIdArray(
      parseStructuredField(req.body.classes, 'classes'),
      'classes'
    );
    await ensureClassDocuments(classIds, schoolId, sessionId);

    const feeTypes = normalizeFeeTypes(parseStructuredField(req.body.feeTypes, 'feeTypes'));
    const totalAmount = calculateFeeStructureTotal(feeTypes);
    const installments = normalizeInstallments(
      parseStructuredField(req.body.installments, 'installments'),
      totalAmount
    );
    const discounts = normalizeStructureDiscounts(
      parseStructuredField(req.body.discounts, 'discounts')
    );
    const lateFine = normalizeLateFine(
      parseStructuredField(req.body.lateFine, 'lateFine')
    );

    const feeStructure = await FeeStructure.create({
      school: schoolId,
      name: normalizeTrimmedString(req.body.name, 'name', { required: true }),
      session: sessionId,
      classes: classIds,
      feeTypes,
      installments,
      discounts,
      lateFine,
      createdBy: req.user?._id,
      isActive:
        req.body.isActive !== undefined ? normalizeBoolean(req.body.isActive) : true
    });

    const populatedFeeStructure = await populateFeeStructureQuery(
      FeeStructure.findById(feeStructure._id)
    );

    res.status(201).json({
      success: true,
      message: 'Fee structure created successfully',
      data: populatedFeeStructure
    });
  } catch (error) {
    handleFeeError(res, error);
  }
};

export const updateFeeStructure = async (req, res) => {
  try {
    const feeStructure = await findScopedFeeStructureById(req, req.params.id);
    const schoolId = resolveScopedSchoolId(req, feeStructure.school);
    const sessionId =
      req.body.session !== undefined
        ? ensureObjectId(req.body.session, 'session')
        : toIdString(feeStructure.session);

    await ensureSessionExists(sessionId, schoolId);

    const classIds = hasOwn(req.body, 'classes')
      ? normalizeObjectIdArray(parseStructuredField(req.body.classes, 'classes'), 'classes')
      : (feeStructure.classes || []).map((classId) => toIdString(classId));
    await ensureClassDocuments(classIds, schoolId, sessionId);

    const feeTypes = hasOwn(req.body, 'feeTypes')
      ? normalizeFeeTypes(parseStructuredField(req.body.feeTypes, 'feeTypes'))
      : (feeStructure.feeTypes || []).map((entry) =>
          typeof entry.toObject === 'function' ? entry.toObject() : entry
        );
    const totalAmount = calculateFeeStructureTotal(feeTypes);
    const installments = hasOwn(req.body, 'installments')
      ? normalizeInstallments(
          parseStructuredField(req.body.installments, 'installments'),
          totalAmount
        )
      : (feeStructure.installments || []).map((entry) =>
          typeof entry.toObject === 'function' ? entry.toObject() : entry
        );
    const discounts = hasOwn(req.body, 'discounts')
      ? normalizeStructureDiscounts(parseStructuredField(req.body.discounts, 'discounts'))
      : (feeStructure.discounts || []).map((entry) =>
          typeof entry.toObject === 'function' ? entry.toObject() : entry
        );
    const lateFine = hasOwn(req.body, 'lateFine')
      ? normalizeLateFine(parseStructuredField(req.body.lateFine, 'lateFine'))
      : feeStructure.lateFine && typeof feeStructure.lateFine.toObject === 'function'
        ? feeStructure.lateFine.toObject()
        : feeStructure.lateFine;

    const updatedFeeStructure = await FeeStructure.findByIdAndUpdate(
      feeStructure._id,
      {
        name:
          req.body.name !== undefined
            ? normalizeTrimmedString(req.body.name, 'name', { required: true })
            : feeStructure.name,
        session: sessionId,
        classes: classIds,
        feeTypes,
        installments,
        discounts,
        lateFine,
        isActive:
          req.body.isActive !== undefined
            ? normalizeBoolean(req.body.isActive)
            : feeStructure.isActive
      },
      { new: true, runValidators: true }
    );

    const populatedFeeStructure = await populateFeeStructureQuery(
      FeeStructure.findById(updatedFeeStructure._id)
    );

    res.status(200).json({
      success: true,
      message: 'Fee structure updated successfully',
      data: populatedFeeStructure
    });
  } catch (error) {
    handleFeeError(res, error);
  }
};

// ========== Fee Payments ==========

export const getPayments = async (req, res) => {
  try {
    const query = buildPaymentQueryFilter(req);
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);

    const payments = await populatePaymentQuery(
      FeePayment.find(query)
        .sort({ paidDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    );

    const count = await FeePayment.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: payments
    });
  } catch (error) {
    handleFeeError(res, error);
  }
};

export const getPayment = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, undefined);
    const query = {
      _id: ensureObjectId(req.params.id, 'payment')
    };

    if (schoolId) {
      query.school = schoolId;
    }

    const payment = await populatePaymentQuery(FeePayment.findOne(query));

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
    handleFeeError(res, error);
  }
};

export const createPayment = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    const sessionId = ensureObjectId(req.body.session, 'session');
    await ensureSessionExists(sessionId, schoolId);

    const student = await ensureStudentDocument(req.body.student, schoolId);
    const feeStructure = await ensureFeeStructureDocument(
      req.body.feeStructure,
      schoolId,
      sessionId
    );

    ensureFeeStructureAppliesToStudent(student, feeStructure, sessionId);

    const installment = normalizeInstallmentSelection(
      parseStructuredField(req.body.installment, 'installment'),
      feeStructure
    );

    const baseAmount = installment
      ? installment.amount
      : req.body.amount !== undefined
        ? normalizeNumber(req.body.amount, 'amount', { required: true, min: 0 })
        : feeStructure.totalAmount;

    const discount = normalizePaymentDiscount(
      parseStructuredField(req.body.discount, 'discount'),
      baseAmount
    );
    const lateFine =
      req.body.lateFine !== undefined
        ? normalizeNumber(req.body.lateFine, 'lateFine', { min: 0 })
        : 0;
    const totalAmount = roundCurrency(baseAmount - (discount?.amount || 0) + lateFine);
    const amountPaid = normalizeNumber(req.body.amountPaid, 'amountPaid', {
      required: true,
      min: 0
    });

    if (amountPaid > totalAmount) {
      throw createFeeError('amountPaid cannot exceed totalAmount');
    }

    const paymentMethod = normalizeTrimmedString(req.body.paymentMethod, 'paymentMethod', {
      required: true
    }).toLowerCase();
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw createFeeError(
        `paymentMethod must be one of ${PAYMENT_METHODS.join(', ')}`
      );
    }

    const receiptNumber = (
      req.body.receiptNumber
        ? normalizeTrimmedString(req.body.receiptNumber, 'receiptNumber', {
            required: true
          })
        : generateReceiptNumber()
    ).toUpperCase();

    await ensureReceiptNumberIsUnique(receiptNumber);

    const payment = await FeePayment.create({
      school: schoolId,
      receiptNumber,
      student: student._id,
      feeStructure: feeStructure._id,
      session: sessionId,
      amount: baseAmount,
      discount,
      lateFine,
      totalAmount,
      amountPaid,
      paymentMethod,
      paymentDetails: normalizePaymentDetails(
        parseStructuredField(req.body.paymentDetails, 'paymentDetails')
      ),
      paidDate:
        req.body.paidDate !== undefined
          ? normalizeDateValue(req.body.paidDate, 'paidDate', { required: true })
          : new Date(),
      installment:
        installment !== undefined
          ? { number: installment.number, name: installment.name }
          : undefined,
      remarks: normalizeTrimmedString(req.body.remarks, 'remarks'),
      collectedBy: req.user?._id
    });

    const populatedPayment = await populatePaymentQuery(FeePayment.findById(payment._id));

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: populatedPayment
    });
  } catch (error) {
    handleFeeError(res, error);
  }
};

export const updatePayment = async (req, res) => {
  try {
    const payment = await findScopedPaymentById(req, req.params.id);
    const schoolId = resolveScopedSchoolId(req, payment.school);
    const sessionId =
      req.body.session !== undefined
        ? ensureObjectId(req.body.session, 'session')
        : toIdString(payment.session);
    await ensureSessionExists(sessionId, schoolId);

    const student = await ensureStudentDocument(
      req.body.student !== undefined ? req.body.student : payment.student,
      schoolId
    );
    const feeStructure = await ensureFeeStructureDocument(
      req.body.feeStructure !== undefined ? req.body.feeStructure : payment.feeStructure,
      schoolId,
      sessionId
    );

    ensureFeeStructureAppliesToStudent(student, feeStructure, sessionId);

    const installment = hasOwn(req.body, 'installment')
      ? normalizeInstallmentSelection(
          parseStructuredField(req.body.installment, 'installment'),
          feeStructure
        )
      : payment.installment && typeof payment.installment.toObject === 'function'
        ? payment.installment.toObject()
        : payment.installment;

    const baseAmount = installment
      ? installment.amount || payment.amount
      : req.body.amount !== undefined
        ? normalizeNumber(req.body.amount, 'amount', { required: true, min: 0 })
        : payment.amount;

    const discount = hasOwn(req.body, 'discount')
      ? normalizePaymentDiscount(parseStructuredField(req.body.discount, 'discount'), baseAmount)
      : payment.discount && typeof payment.discount.toObject === 'function'
        ? payment.discount.toObject()
        : payment.discount;
    const lateFine =
      req.body.lateFine !== undefined
        ? normalizeNumber(req.body.lateFine, 'lateFine', { min: 0 })
        : payment.lateFine;
    const totalAmount = roundCurrency(baseAmount - (discount?.amount || 0) + lateFine);
    const amountPaid =
      req.body.amountPaid !== undefined
        ? normalizeNumber(req.body.amountPaid, 'amountPaid', {
            required: true,
            min: 0
          })
        : payment.amountPaid;

    if (amountPaid > totalAmount) {
      throw createFeeError('amountPaid cannot exceed totalAmount');
    }

    const paymentMethod =
      req.body.paymentMethod !== undefined
        ? normalizeTrimmedString(req.body.paymentMethod, 'paymentMethod', {
            required: true
          }).toLowerCase()
        : payment.paymentMethod;

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw createFeeError(
        `paymentMethod must be one of ${PAYMENT_METHODS.join(', ')}`
      );
    }

    const receiptNumber =
      req.body.receiptNumber !== undefined
        ? normalizeTrimmedString(req.body.receiptNumber, 'receiptNumber', {
            required: true
          }).toUpperCase()
        : payment.receiptNumber;

    await ensureReceiptNumberIsUnique(receiptNumber, payment._id);

    const updatedPayment = await FeePayment.findByIdAndUpdate(
      payment._id,
      {
        school: schoolId,
        receiptNumber,
        student: student._id,
        feeStructure: feeStructure._id,
        session: sessionId,
        amount: baseAmount,
        discount,
        lateFine,
        totalAmount,
        amountPaid,
        paymentMethod,
        paymentDetails: hasOwn(req.body, 'paymentDetails')
          ? normalizePaymentDetails(parseStructuredField(req.body.paymentDetails, 'paymentDetails'))
          : payment.paymentDetails && typeof payment.paymentDetails.toObject === 'function'
            ? payment.paymentDetails.toObject()
            : payment.paymentDetails,
        paidDate:
          req.body.paidDate !== undefined
            ? normalizeDateValue(req.body.paidDate, 'paidDate', { required: true })
            : payment.paidDate,
        installment:
          installment !== undefined
            ? { number: installment.number, name: installment.name }
            : undefined,
        remarks:
          req.body.remarks !== undefined
            ? normalizeTrimmedString(req.body.remarks, 'remarks')
            : payment.remarks
      },
      { new: true, runValidators: true }
    );

    const populatedPayment = await populatePaymentQuery(FeePayment.findById(updatedPayment._id));

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: populatedPayment
    });
  } catch (error) {
    handleFeeError(res, error);
  }
};

export const getPaymentSummary = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.query.school);
    const sessionId = ensureObjectId(req.query.session, 'session');
    await ensureSessionExists(sessionId, schoolId);

    const student = await ensureStudentDocument(req.query.studentId, schoolId);

    if (
      student.academic?.session &&
      toIdString(student.academic.session) !== sessionId
    ) {
      throw createFeeError('Student does not belong to the selected session');
    }

    const studentClassId = toIdString(student.academic?.currentClass);
    if (!studentClassId) {
      throw createFeeError('Student is not assigned to a class');
    }

    const feeStructures = await FeeStructure.find({
      school: schoolId,
      session: sessionId,
      isActive: true
    }).select('_id name totalAmount classes installments');

    const applicableFeeStructures = feeStructures.filter(
      (feeStructure) =>
        !Array.isArray(feeStructure.classes) ||
        feeStructure.classes.length === 0 ||
        feeStructure.classes.some((classId) => toIdString(classId) === studentClassId)
    );

    const payments = await populatePaymentQuery(
      FeePayment.find({
        school: schoolId,
        student: student._id,
        session: sessionId
      }).sort({ paidDate: -1, createdAt: -1 })
    );

    const effectivePayments = payments.filter(
      (payment) => !['cancelled', 'refunded'].includes(payment.status)
    );

    const structureBreakdown = applicableFeeStructures.map((feeStructure) => {
      const structurePayments = effectivePayments.filter(
        (payment) => toIdString(payment.feeStructure?._id || payment.feeStructure) === toIdString(feeStructure._id)
      );
      const totalPaid = roundCurrency(
        structurePayments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0)
      );
      const totalAmount = Number(feeStructure.totalAmount || 0);
      const balance = roundCurrency(Math.max(totalAmount - totalPaid, 0));

      return {
        feeStructureId: feeStructure._id,
        name: feeStructure.name,
        totalAmount,
        totalPaid,
        balance,
        paymentCount: structurePayments.length,
        status: balance <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
      };
    });

    const totalAssigned = roundCurrency(
      structureBreakdown.reduce((sum, structure) => sum + structure.totalAmount, 0)
    );
    const totalPaid = roundCurrency(
      effectivePayments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0)
    );
    const balance = roundCurrency(Math.max(totalAssigned - totalPaid, 0));

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          name: `${student.profile?.firstName || ''} ${student.profile?.lastName || ''}`.trim()
        },
        session: sessionId,
        totalAssigned,
        totalPaid,
        balance,
        paymentCount: effectivePayments.length,
        status: balance <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending',
        structures: structureBreakdown,
        payments: effectivePayments
      }
    });
  } catch (error) {
    handleFeeError(res, error);
  }
};
