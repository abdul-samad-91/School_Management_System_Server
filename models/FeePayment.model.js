import mongoose from 'mongoose';

const feePaymentSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
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
    default: 0
  },
  totalAmount: Number,
  amountPaid: {
    type: Number,
    required: true
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

// Calculate total amount before saving
feePaymentSchema.pre('save', function(next) {
  this.totalAmount = this.amount - (this.discount?.amount || 0) + this.lateFine;
  
  if (this.amountPaid >= this.totalAmount) {
    this.status = 'paid';
  } else if (this.amountPaid > 0) {
    this.status = 'partial';
  }
  
  next();
});

const FeePayment = mongoose.model('FeePayment', feePaymentSchema);

export default FeePayment;

