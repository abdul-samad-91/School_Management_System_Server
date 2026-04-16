import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  section: {
    type: String,
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'leave', 'half_day'],
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
    ref: 'AcademicSession',
    required: true
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

// Compound index to ensure unique attendance per student per subject per day
attendanceSchema.index(
  { school: 1, student: 1, subject: 1, date: 1 },
  { unique: true }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
