import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  type: {
    type: String,
    enum: ['student', 'teacher'],
    default: 'student'
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  section: String,
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'leave', 'half_day', 'holiday'],
    required: true
  },
  remarks: String,
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
  },
  corrections: [{
    previousStatus: String,
    newStatus: String,
    reason: String,
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    correctionDate: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Compound index for student attendance per day
attendanceSchema.index(
  { school: 1, type: 1, student: 1, date: 1 },
  { unique: true, partialFilterExpression: { type: 'student', student: { $exists: true } } }
);

// Compound index for teacher attendance per day
attendanceSchema.index(
  { school: 1, type: 1, teacher: 1, date: 1 },
  { unique: true, partialFilterExpression: { type: 'teacher', teacher: { $exists: true } } }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
