import mongoose from 'mongoose';

const createClassValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const ensureUniqueSectionNames = (sections = []) => {
  const normalizedNames = sections
    .map((section) => section?.name?.trim().toLowerCase())
    .filter(Boolean);

  return normalizedNames.length === new Set(normalizedNames).size;
};

const ensureUniqueStudentsAcrossSections = (sections = []) => {
  const studentIds = sections.flatMap((section) =>
    Array.isArray(section?.students)
      ? section.students.map((studentId) => String(studentId))
      : []
  );

  return studentIds.length === new Set(studentIds).size;
};

const classSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School is required']
  },
  name: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  },
  level: {
    type: Number,
    required: true
  },
  sections: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    capacity: {
      type: Number,
      default: 40
    },
    students: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    }],
    classTeacher: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required : true
    }],
    Timetable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timetable'
    },

    room: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
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

classSchema.pre('validate', function(next) {
  if (!ensureUniqueSectionNames(this.sections)) {
    return next(createClassValidationError('Section names must be unique within a class'));
  }

  if (!ensureUniqueStudentsAcrossSections(this.sections)) {
    return next(
      createClassValidationError(
        'A student cannot belong to multiple sections in the same class'
      )
    );
  }

  return next();
});

// Compound index to ensure unique class-session combination inside the same branch
classSchema.index({ school: 1, name: 1, session: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);

export default Class;
