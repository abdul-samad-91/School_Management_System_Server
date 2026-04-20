import mongoose from 'mongoose';

const createFeeStructureValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const roundCurrency = (value) => Number(Number(value).toFixed(2));

const calculateFeeStructureTotal = (feeTypes = []) =>
  roundCurrency(
    feeTypes.reduce((sum, feeType) => sum + Number(feeType?.amount || 0), 0)
  );

const validateFeeTypes = (feeTypes = []) => {
  if (!Array.isArray(feeTypes) || feeTypes.length === 0) {
    throw createFeeStructureValidationError('At least one fee type is required');
  }

  const names = feeTypes.map((feeType) => feeType?.name).filter(Boolean);
  if (new Set(names).size !== names.length) {
    throw createFeeStructureValidationError('Fee type names must be unique');
  }
};

const validateInstallments = (installments = [], totalAmount = 0) => {
  if (!Array.isArray(installments) || installments.length === 0) {
    return;
  }

  const installmentNames = installments.map((installment) => installment?.name).filter(Boolean);
  if (new Set(installmentNames).size !== installmentNames.length) {
    throw createFeeStructureValidationError('Installment names must be unique');
  }

  const totalInstallmentAmount = roundCurrency(
    installments.reduce((sum, installment) => sum + Number(installment?.amount || 0), 0)
  );

  if (Math.abs(totalInstallmentAmount - totalAmount) > 0.01) {
    throw createFeeStructureValidationError(
      'Installment amounts must add up to the total fee amount'
    );
  }

  installments.forEach((installment, index) => {
    if (!installment?.dueDate || Number.isNaN(new Date(installment.dueDate).getTime())) {
      throw createFeeStructureValidationError(
        `installments[${index}].dueDate must be a valid date`
      );
    }
  });
};

const validateDiscounts = (discounts = []) => {
  if (!Array.isArray(discounts)) {
    throw createFeeStructureValidationError('discounts must be an array');
  }

  discounts.forEach((discount, index) => {
    if (!discount?.name) {
      throw createFeeStructureValidationError(`discounts[${index}].name is required`);
    }

    if (discount?.value === undefined || Number(discount.value) < 0) {
      throw createFeeStructureValidationError(
        `discounts[${index}].value must be a valid positive number`
      );
    }

    if (discount.type === 'percentage' && Number(discount.value) > 100) {
      throw createFeeStructureValidationError(
        `discounts[${index}].value cannot exceed 100 for percentage discounts`
      );
    }
  });
};

const validateLateFine = (lateFine = {}) => {
  if (!lateFine?.enabled) {
    return;
  }

  if (!lateFine.type) {
    throw createFeeStructureValidationError('lateFine.type is required when lateFine is enabled');
  }

  if (lateFine.value === undefined || Number(lateFine.value) < 0) {
    throw createFeeStructureValidationError(
      'lateFine.value must be a valid positive number when lateFine is enabled'
    );
  }

  if (
    lateFine.type === 'percentage' &&
    lateFine.value !== undefined &&
    Number(lateFine.value) > 100
  ) {
    throw createFeeStructureValidationError(
      'lateFine.value cannot exceed 100 for percentage late fine'
    );
  }
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

const applyDerivedTotalToUpdate = (update, totalAmount) => {
  if (update.$set && typeof update.$set === 'object') {
    update.$set.totalAmount = totalAmount;
    return update;
  }

  update.totalAmount = totalAmount;
  return update;
};

const feeStructureSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Fee structure name is required'],
    trim: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  feeTypes: [{
    name: {
      type: String,
      required: true,
      enum: [
        'tuition',
        'admission',
        'transport',
        'exam',
        'library',
        'sports',
        'lab',
        'activity',
        'other'
      ]
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String,
    isOptional: {
      type: Boolean,
      default: false
    }
  }],
  totalAmount: Number,
  installments: [{
    name: String,
    amount: Number,
    dueDate: Date,
    description: String
  }],
  discounts: [{
    name: String,
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    value: Number,
    description: String,
    conditions: String
  }],
  lateFine: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    value: Number,
    gracePeriod: Number
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

feeStructureSchema.index({ school: 1, session: 1, name: 1 }, { unique: true });
feeStructureSchema.index({ school: 1, session: 1, isActive: 1 });

feeStructureSchema.pre('validate', function(next) {
  try {
    validateFeeTypes(this.feeTypes);
    this.totalAmount = calculateFeeStructureTotal(this.feeTypes);
    validateInstallments(this.installments, this.totalAmount);
    validateDiscounts(this.discounts);
    validateLateFine(this.lateFine);
    next();
  } catch (error) {
    next(error);
  }
});

feeStructureSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const currentStructure = await this.model.findOne(this.getQuery());

    if (!currentStructure) {
      return next();
    }

    const update = this.getUpdate() || {};
    const normalizedUpdate = getNormalizedUpdatePayload(update);

    const feeTypes = normalizedUpdate.feeTypes || currentStructure.feeTypes;
    const installments =
      normalizedUpdate.installments !== undefined
        ? normalizedUpdate.installments
        : currentStructure.installments;
    const discounts =
      normalizedUpdate.discounts !== undefined
        ? normalizedUpdate.discounts
        : currentStructure.discounts;
    const lateFine =
      normalizedUpdate.lateFine !== undefined
        ? normalizedUpdate.lateFine
        : currentStructure.lateFine;

    validateFeeTypes(feeTypes);
    const totalAmount = calculateFeeStructureTotal(feeTypes);
    validateInstallments(installments, totalAmount);
    validateDiscounts(discounts);
    validateLateFine(lateFine);

    this.setUpdate(applyDerivedTotalToUpdate(update, totalAmount));
    next();
  } catch (error) {
    next(error);
  }
});

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

export default FeeStructure;
