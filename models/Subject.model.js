import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
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

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject;

