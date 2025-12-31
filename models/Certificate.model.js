import mongoose from 'mongoose';

const certificateSchema = new mongoose.Schema({
  certificateNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['school_leaving', 'graduation', 'completion', 'character', 'bonafide'],
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  details: {
    studentName: String,
    fatherName: String,
    motherName: String,
    dateOfBirth: Date,
    class: String,
    section: String,
    rollNumber: String,
    admissionNumber: String,
    session: String,
    grades: String,
    conduct: String,
    remarks: String
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertificateTemplate'
  },
  pdfUrl: String,
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verificationCode: String,
  status: {
    type: String,
    enum: ['issued', 'cancelled', 'reissued'],
    default: 'issued'
  }
}, {
  timestamps: true
});

const Certificate = mongoose.model('Certificate', certificateSchema);

export default Certificate;

