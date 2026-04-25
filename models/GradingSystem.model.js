import mongoose from 'mongoose';

const createGradingSystemError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const normalizeGrades = (grades = []) => {
  return [...grades].sort((left, right) => left.minPercentage - right.minPercentage);
};

const validateGrades = (grades = []) => {
  if (!Array.isArray(grades) || grades.length === 0) {
    throw createGradingSystemError('At least one grade range is required');
  }

  const normalizedGrades = normalizeGrades(grades);

  normalizedGrades.forEach((grade, index) => {
    if (grade.minPercentage > grade.maxPercentage) {
      throw createGradingSystemError(`Grade ${grade.name} has an invalid percentage range`);
    }

    if (index === 0) {
      return;
    }

    const previousGrade = normalizedGrades[index - 1];
    if (grade.minPercentage <= previousGrade.maxPercentage) {
      throw createGradingSystemError('Grade percentage ranges must not overlap');
    }
  });
};

const clearDefaultForScope = async (model, gradingSystemId, schoolId, sessionId) => {
  const query = {
    _id: { $ne: gradingSystemId },
    isDefault: true
  };

  if (schoolId) {
    query.school = schoolId;
  }

  if (sessionId) {
    query.session = sessionId;
  }

  await model.updateMany(query, { $set: { isDefault: false } });
};

const gradingSystemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Grading system name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['percentage', 'gpa', 'letter'],
    required: true
  },
  grades: [{
    name: {
      type: String,
      required: true
    },
    minPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    maxPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    gradePoint: Number,
    description: String
  }],
  passingGrade: String,
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School is required']
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: [true, 'Session is required']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

gradingSystemSchema.index(
  { school: 1, session: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

gradingSystemSchema.pre('validate', function(next) {
  try {
    validateGrades(this.grades);

    if (
      this.passingGrade &&
      !this.grades.some((grade) => grade.name === this.passingGrade)
    ) {
      throw createGradingSystemError('Passing grade must exist in grades');
    }

    next();
  } catch (error) {
    next(error);
  }
});

gradingSystemSchema.pre('save', async function(next) {
  try {
    if (this.isDefault) {
      await clearDefaultForScope(this.constructor, this._id, this.school, this.session);
    }

    next();
  } catch (error) {
    next(error);
  }
});

gradingSystemSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const currentSystem = await this.model
      .findOne(this.getQuery())
      .select('school session grades passingGrade');

    if (!currentSystem) {
      return next();
    }

    const updates = this.getUpdate()?.$set || this.getUpdate() || {};
    validateGrades(updates.grades || currentSystem.grades);

    const passingGrade =
      updates.passingGrade !== undefined ? updates.passingGrade : currentSystem.passingGrade;
    const grades = updates.grades || currentSystem.grades;

    if (passingGrade && !grades.some((grade) => grade.name === passingGrade)) {
      throw createGradingSystemError('Passing grade must exist in grades');
    }

    if (updates.isDefault === true) {
      await clearDefaultForScope(
        this.model,
        currentSystem._id,
        updates.school || currentSystem.school,
        updates.session || currentSystem.session
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Method to get grade based on percentage
gradingSystemSchema.methods.getGrade = function(percentage) {
  const grade = this.grades.find(g => 
    percentage >= g.minPercentage && percentage <= g.maxPercentage
  );
  return grade || null;
};

const GradingSystem = mongoose.model('GradingSystem', gradingSystemSchema);

export default GradingSystem;
