import mongoose from 'mongoose';

const createAcademicSessionError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureValidSessionDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    // this starting year and 8 months are greater or equal to the end date
    if (startDate + 8 * 30 * 24 * 60 * 60 * 1000 >= endDate) {
      throw createAcademicSessionError('End date must be 8 months after start date');
    }
    return;
  }

  const normalizedStartDate = startDate instanceof Date ? startDate : new Date(startDate);
  const normalizedEndDate = endDate instanceof Date ? endDate : new Date(endDate);

  if (
    Number.isNaN(normalizedStartDate.getTime()) ||
    Number.isNaN(normalizedEndDate.getTime())
  ) {
    return;
  }

  if (normalizedEndDate <= normalizedStartDate) {
    throw createAcademicSessionError('End date must be after start date');
  }
};

const deactivateOtherActiveSessions = async (model, sessionId) => {
  await model.updateMany(
    { _id: { $ne: sessionId }, isActive: true },
    { $set: { isActive: false } }
  );
};

const getNormalizedUpdatePayload = (update = {}) => {
  if (!update || typeof update !== 'object') {
    return {};
  }

  const normalizedUpdate = { ...update };

  if (normalizedUpdate.$set && typeof normalizedUpdate.$set === 'object') {
    return normalizedUpdate.$set;
  }

  return normalizedUpdate;
};

const academicSessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Session name is required'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

academicSessionSchema.pre('validate', function(next) {
  try {
    ensureValidSessionDateRange(this.startDate, this.endDate);
    return next();
  } catch (error) {
    return next(error);
  }
});

// Ensure only one active session at a time
academicSessionSchema.pre('save', async function(next) {
  try {
    if (this.isActive) {
      await deactivateOtherActiveSessions(this.constructor, this._id);
    }

    next();
  } catch (error) {
    next(error);
  }
});

academicSessionSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const currentSession = await this.model.findOne(this.getQuery()).select('startDate endDate');

    if (!currentSession) {
      return next();
    }

    const updates = getNormalizedUpdatePayload(this.getUpdate());
    const startDate =
      updates.startDate !== undefined ? updates.startDate : currentSession.startDate;
    const endDate = updates.endDate !== undefined ? updates.endDate : currentSession.endDate;

    ensureValidSessionDateRange(startDate, endDate);

    if (updates.isActive === true) {
      await deactivateOtherActiveSessions(this.model, currentSession._id);
    }

    next();
  } catch (error) {
    next(error);
  }
});

const AcademicSession = mongoose.model('AcademicSession', academicSessionSchema);

export default AcademicSession;
