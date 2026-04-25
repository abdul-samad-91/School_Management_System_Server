import mongoose from 'mongoose';

const createSubjectValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const validateClassMappings = (classes = []) => {
  const assignmentKeys = new Set();

  for (const classConfig of classes) {
    if (
      classConfig?.maxMarks !== undefined &&
      classConfig?.passingMarks !== undefined &&
      classConfig.passingMarks > classConfig.maxMarks
    ) {
      return false;
    }

    const classId = classConfig?.classId ? String(classConfig.classId) : '';
    const sections = Array.isArray(classConfig?.sections)
      ? [...classConfig.sections].sort().join('|')
      : '';
    const assignmentKey = `${classId}:${sections}`;

    if (assignmentKeys.has(assignmentKey)) {
      return false;
    }

    assignmentKeys.add(assignmentKey);
  }

  return true;
};

const subjectSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['theory', 'practical', 'elective'],
    default: 'theory'
  },
  priority: {
    type: String,
    enum: ['core', 'optional'],
    default: 'core'
  },
  classes: [{
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    sections: [String],
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    maxMarks: {
      type: Number,
      default: 100
    },
    passingMarks: {
      type: Number,
      default: 40
    }
  }],
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School is required']
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

subjectSchema.pre('validate', function(next) {
  if (!validateClassMappings(this.classes)) {
    return next(
      createSubjectValidationError(
        'Each class-section subject mapping must be unique and passing marks cannot exceed max marks'
      )
    );
  }

  return next();
});

subjectSchema.index({ school: 1, session: 1, code: 1 }, { unique: true });

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject;
