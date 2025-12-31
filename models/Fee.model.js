import mongoose from 'mongoose';

const feeStructureSchema = new mongoose.Schema({
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
      enum: ['tuition', 'admission', 'transport', 'exam', 'library', 'sports', 'lab', 'activity', 'other']
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
    gracePeriod: Number // days
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Calculate total before saving
feeStructureSchema.pre('save', function(next) {
  if (this.feeTypes && this.feeTypes.length > 0) {
    this.totalAmount = this.feeTypes.reduce((sum, fee) => sum + fee.amount, 0);
  }
  next();
});

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

export default FeeStructure;

