import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  date: {
    type: Date,
    required: [true, 'Exam date is required']
  },
  startTime: String,
  endTime: String,
  duration: String,
  room: String,
  maxMarks: {
    type: Number,
    default: 100
  },
  passingMarks: {
    type: Number,
    default: 35
  },
  type: {
    type: String,
    enum: ['midterm', 'final', 'unit_test', 'quarterly', 'half_yearly', 'annual', 'class_test'],
    default: 'class_test'
  },
  name: String,
  gradingSystem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GradingSystem'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isStarted: {
    type: Boolean,
    default: false
  },
  startedAt: Date,
  startedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

examSchema.index({ school: 1, session: 1, subject: 1, date: 1 });

const Exam = mongoose.model('Exam', examSchema);

export default Exam;
