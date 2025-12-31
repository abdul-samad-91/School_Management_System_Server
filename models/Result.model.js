import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  section: String,
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  subjects: [{
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    marksObtained: {
      type: Number,
      required: true,
      min: 0
    },
    maxMarks: {
      type: Number,
      required: true
    },
    grade: String,
    remarks: String,
    isPassed: Boolean
  }],
  totalMarks: Number,
  totalMaxMarks: Number,
  percentage: Number,
  overallGrade: String,
  rank: Number,
  attendance: {
    total: Number,
    present: Number,
    percentage: Number
  },
  remarks: String,
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Calculate totals before saving
resultSchema.pre('save', function(next) {
  if (this.subjects && this.subjects.length > 0) {
    this.totalMarks = this.subjects.reduce((sum, sub) => sum + sub.marksObtained, 0);
    this.totalMaxMarks = this.subjects.reduce((sum, sub) => sum + sub.maxMarks, 0);
    this.percentage = (this.totalMarks / this.totalMaxMarks) * 100;
  }
  next();
});

const Result = mongoose.model('Result', resultSchema);

export default Result;

