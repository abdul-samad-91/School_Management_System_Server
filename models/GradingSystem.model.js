import mongoose from 'mongoose';

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
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
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

// Method to get grade based on percentage
gradingSystemSchema.methods.getGrade = function(percentage) {
  const grade = this.grades.find(g => 
    percentage >= g.minPercentage && percentage <= g.maxPercentage
  );
  return grade || null;
};

const GradingSystem = mongoose.model('GradingSystem', gradingSystemSchema);

export default GradingSystem;

