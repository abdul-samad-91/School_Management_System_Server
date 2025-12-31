import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  admissionNumber: {
    type: String,
    required: [true, 'Admission number is required'],
    unique: true,
    uppercase: true
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true
  },
  rollNumber: String,
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
      required: [true, 'Date of birth is required']
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
    email: String,
    phone: String,
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
  parents: [{
    relationship: {
      type: String,
      enum: ['father', 'mother', 'guardian'],
      required: true
    },
    firstName: {
      type: String,
      required: true
    },
    lastName: String,
    occupation: String,
    phone: {
      type: String,
      required: true
    },
    whatsappNumber: String,
    email: String,
    address: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  medical: {
    conditions: [String],
    allergies: [String],
    medications: [String],
    specialNeeds: String,
    bloodGroup: String
  },
  academic: {
    currentClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class'
    },
    currentSection: String,
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession'
    },
    admissionDate: {
      type: Date,
      default: Date.now
    },
    previousSchool: {
      name: String,
      board: String,
      lastClass: String,
      graduationYear: Number
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'transferred', 'dropped', 'graduated'],
    default: 'active'
  },
  statusHistory: [{
    status: String,
    reason: String,
    date: {
      type: Date,
      default: Date.now
    },
    remarks: String
  }],
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  admissionStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.middleName || ''} ${this.profile.lastName}`.trim();
});

// Virtual for age
studentSchema.virtual('age').get(function() {
  if (!this.profile.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.profile.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Ensure virtuals are included in JSON
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

const Student = mongoose.model('Student', studentSchema);

export default Student;

