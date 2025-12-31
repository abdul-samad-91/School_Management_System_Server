import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Exam name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['midterm', 'final', 'unit_test', 'quarterly', 'half_yearly', 'annual'],
    required: true
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
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  weightage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  schedule: [{
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class'
    },
    sections: [String],
    date: {
      type: Date,
      required: true
    },
    startTime: String,
    endTime: String,
    maxMarks: {
      type: Number,
      required: true
    },
    passingMarks: {
      type: Number,
      required: true
    },
    room: String,
    invigilator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    }
  }],
  gradingSystem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GradingSystem'
  },
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Exam = mongoose.model('Exam', examSchema);

export default Exam;

