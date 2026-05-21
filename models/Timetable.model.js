import mongoose from 'mongoose';

const periodSchema = new mongoose.Schema({
  slotId: { type: String },
  time: { type: String, default: '' },
  subject: { type: String, default: '' },
  teacher: { type: String, default: '' },
  room: { type: String, default: '' },
  type: { type: String, enum: ['period', 'break'], default: 'period' },
  breakLabel: { type: String, default: '' }
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
  day: { type: String, required: true },
  periods: [periodSchema]
}, { _id: false });

const timetableSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  days: [dayScheduleSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Unique index: one label per school
timetableSchema.index({ school: 1, label: 1 }, { unique: true });

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;
