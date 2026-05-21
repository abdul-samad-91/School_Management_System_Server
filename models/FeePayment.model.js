import mongoose from 'mongoose';

const feePaymentSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
  },
  feeStructure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure'
  },
  rollNo: String,
  month: String,
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dueDate: Date,
  fineAmount: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'cheque', 'bank_transfer'],
    default: 'cash'
  },
  paymentDetails: {
    transactionId: String,
    chequeNumber: String,
    bankName: String,
    paymentDate: Date
  },
  receiptNumber: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Unpaid', 'Partial'],
    default: 'Unpaid'
  },
  paidDate: Date,
  remarks: String,
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

feePaymentSchema.index({ school: 1, student: 1, month: 1 });
feePaymentSchema.index({ school: 1, session: 1, status: 1 });

// Auto-calculate pendingAmount
feePaymentSchema.pre('save', function(next) {
  this.pendingAmount = Math.max(0, (this.totalAmount || 0) - (this.paidAmount || 0));
  if (this.paidAmount >= this.totalAmount) {
    this.status = 'Paid';
  } else if (this.paidAmount > 0) {
    this.status = 'Partial';
  }
  next();
});

const FeePayment = mongoose.model('FeePayment', feePaymentSchema);

export default FeePayment;
