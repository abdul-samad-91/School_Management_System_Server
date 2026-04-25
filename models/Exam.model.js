import mongoose from 'mongoose';

const createExamValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const examSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
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

examSchema.index({ school: 1, session: 1, name: 1 }, { unique: true });

examSchema.pre('validate', function(next) {
  try {
    if (this.startDate && this.endDate && this.endDate < this.startDate) {
      throw createExamValidationError('End date must be greater than or equal to start date');
    }

    (this.schedule || []).forEach((entry, index) => {
      if (
        entry?.passingMarks !== undefined &&
        entry?.maxMarks !== undefined &&
        entry.passingMarks > entry.maxMarks
      ) {
        throw createExamValidationError(
          `Schedule entry ${index + 1} has passing marks greater than max marks`
        );
      }

      if (
        entry?.date &&
        this.startDate &&
        this.endDate &&
        (entry.date < this.startDate || entry.date > this.endDate)
      ) {
        throw createExamValidationError(
          `Schedule entry ${index + 1} must fall within the exam date range`
        );
      }
    });

    next();
  } catch (error) {
    next(error);
  }
});

const Exam = mongoose.model('Exam', examSchema);

export default Exam;
