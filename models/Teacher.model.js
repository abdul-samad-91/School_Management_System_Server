import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    uppercase: true
  },
  profile: {
    firstName: {
      type: String,
      required: [true, 'First name is required']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required']
    },
    middleName: String,
    dateOfBirth: {
      type: Date,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    },
    photo: String,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    },
    alternatePhone: String,
    address: {
      current: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
      },
      permanent: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
      }
    }
  },
  employment: {
    designation: {
      type: String,
      required: true
    },
    department: String,
    type: {
      type: String,
      enum: ['teaching', 'non_teaching'],
      default: 'teaching'
    },
    joiningDate: {
      type: Date,
      required: true
    },
    contractType: {
      type: String,
      enum: ['permanent', 'contract', 'temporary'],
      default: 'permanent'
    },
    contractEndDate: Date
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number,
    specialization: String,
    certificate: String
  }],
  experience: [{
    institution: String,
    designation: String,
    from: Date,
    to: Date,
    responsibilities: String
  }],
  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  classes: [{
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class'
    },
    sections: [String],
    subjects: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    }],
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession'
    }
  }],
  salary: {
    basic: Number,
    allowances: [{
      name: String,
      amount: Number
    }],
    deductions: [{
      name: String,
      amount: Number
    }],
    total: Number,
    paymentMode: {
      type: String,
      enum: ['bank_transfer', 'cash', 'cheque']
    },
    bankDetails: {
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      branch: String
    }
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'resigned', 'terminated'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Virtual for full name
teacherSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.middleName || ''} ${this.profile.lastName}`.trim();
});

teacherSchema.set('toJSON', { virtuals: true });
teacherSchema.set('toObject', { virtuals: true });

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;

