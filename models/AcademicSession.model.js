import mongoose from 'mongoose';

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
  description: String
}, {
  timestamps: true
});

// Ensure only one active session at a time
academicSessionSchema.pre('save', async function(next) {
  if (this.isActive && !this.isModified('isActive')) {
    return next();
  }
  
  if (this.isActive) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { $set: { isActive: false } }
    );
  }
  next();
});

const AcademicSession = mongoose.model('AcademicSession', academicSessionSchema);

export default AcademicSession;

