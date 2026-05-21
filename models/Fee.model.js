import mongoose from 'mongoose';

const feeStructureSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  className: {
    type: String,
    trim: true
  },
  feeType: {
    type: String,
    required: [true, 'Fee type is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0
  },
  month: String,
  year: String,
  monthYear: String,
  finePerDay: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

feeStructureSchema.index({ school: 1, session: 1, class: 1, feeType: 1, monthYear: 1 });

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

export default FeeStructure;
