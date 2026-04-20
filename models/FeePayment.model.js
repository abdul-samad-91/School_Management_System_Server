import mongoose from 'mongoose';

const createFeePaymentValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const roundCurrency = (value) => Number(Number(value).toFixed(2));

const calculatePaymentTotal = (amount = 0, discountAmount = 0, lateFine = 0) =>
  roundCurrency(Number(amount || 0) - Number(discountAmount || 0) + Number(lateFine || 0));

const derivePaymentStatus = (status, amountPaid, totalAmount) => {
  if (status === 'cancelled' || status === 'refunded') {
    return status;
  }

  if (amountPaid >= totalAmount) {
    return 'paid';
  }

  if (amountPaid > 0) {
    return 'partial';
  }

  return 'pending';
};

const validateDiscount = (discount = {}, amount = 0) => {
  if (!discount || discount.amount === undefined || discount.amount === null) {
    return;
  }

  if (Number(discount.amount) < 0) {
    throw createFeePaymentValidationError('discount.amount cannot be negative');
  }

  if (Number(discount.amount) > Number(amount || 0)) {
    throw createFeePaymentValidationError('discount.amount cannot exceed the base amount');
  }
};

const validateFeePaymentDoc = (doc) => {
  validateDiscount(doc.discount, doc.amount);

  if (Number(doc.lateFine || 0) < 0) {
    throw createFeePaymentValidationError('lateFine cannot be negative');
  }

  doc.totalAmount = calculatePaymentTotal(
    doc.amount,
    doc.discount?.amount,
    doc.lateFine
  );

  if (doc.totalAmount < 0) {
    throw createFeePaymentValidationError('totalAmount cannot be negative');
  }

  if (Number(doc.amountPaid || 0) < 0) {
    throw createFeePaymentValidationError('amountPaid cannot be negative');
  }

  if (Number(doc.amountPaid || 0) > doc.totalAmount) {
    throw createFeePaymentValidationError('amountPaid cannot exceed totalAmount');
  }

  doc.status = derivePaymentStatus(doc.status, Number(doc.amountPaid || 0), doc.totalAmount);
};

const getNormalizedUpdatePayload = (update = {}) => {
  if (!update || typeof update !== 'object') {
    return {};
  }

  if (update.$set && typeof update.$set === 'object') {
    return update.$set;
  }

  return update;
};

const setDerivedPaymentFieldsOnUpdate = (update, totalAmount, status) => {
  if (update.$set && typeof update.$set === 'object') {
    update.$set.totalAmount = totalAmount;
    update.$set.status = status;
    return update;
  }

  update.totalAmount = totalAmount;
  update.status = status;
  return update;
};

const feePaymentSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  receiptNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  feeStructure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: {
      type: String,
      enum: ['scholarship', 'sibling', 'merit', 'staff', 'other']
    },
    amount: {
      type: Number,
      default: 0
    },
    reason: String
  },
  lateFine: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: Number,
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'cheque', 'bank_transfer'],
    required: true
  },
  paymentDetails: {
    transactionId: String,
    chequeNumber: String,
    bankName: String,
    paymentDate: Date
  },
  status: {
    type: String,
    enum: ['paid', 'partial', 'pending', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paidDate: {
    type: Date,
    default: Date.now
  },
  installment: {
    number: Number,
    name: String
  },
  remarks: String,
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

feePaymentSchema.index({ school: 1, session: 1, student: 1, paidDate: -1 });
feePaymentSchema.index({ school: 1, feeStructure: 1, student: 1 });

feePaymentSchema.pre('validate', function(next) {
  try {
    validateFeePaymentDoc(this);
    next();
  } catch (error) {
    next(error);
  }
});

feePaymentSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const currentPayment = await this.model.findOne(this.getQuery());

    if (!currentPayment) {
      return next();
    }

    const update = this.getUpdate() || {};
    const normalizedUpdate = getNormalizedUpdatePayload(update);

    const amount =
      normalizedUpdate.amount !== undefined ? normalizedUpdate.amount : currentPayment.amount;
    const discount =
      normalizedUpdate.discount !== undefined
        ? normalizedUpdate.discount
        : currentPayment.discount;
    const lateFine =
      normalizedUpdate.lateFine !== undefined ? normalizedUpdate.lateFine : currentPayment.lateFine;
    const amountPaid =
      normalizedUpdate.amountPaid !== undefined
        ? normalizedUpdate.amountPaid
        : currentPayment.amountPaid;
    const status =
      normalizedUpdate.status !== undefined ? normalizedUpdate.status : currentPayment.status;

    validateDiscount(discount, amount);

    if (Number(lateFine || 0) < 0) {
      throw createFeePaymentValidationError('lateFine cannot be negative');
    }

    const totalAmount = calculatePaymentTotal(amount, discount?.amount, lateFine);

    if (Number(amountPaid || 0) > totalAmount) {
      throw createFeePaymentValidationError('amountPaid cannot exceed totalAmount');
    }

    const derivedStatus = derivePaymentStatus(status, Number(amountPaid || 0), totalAmount);

    this.setUpdate(setDerivedPaymentFieldsOnUpdate(update, totalAmount, derivedStatus));
    next();
  } catch (error) {
    next(error);
  }
});

const FeePayment = mongoose.model('FeePayment', feePaymentSchema);

export default FeePayment;
