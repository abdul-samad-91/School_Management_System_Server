import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  section: {
    type: String,
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true
    },
    periods: [{
      periodNumber: {
        type: Number,
        required: true
      },
      subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
      },
      teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher'
      },
      startTime: {
        type: String,
        required: true
      },
      endTime: {
        type: String,
        required: true
      },
      room: String,
      type: {
        type: String,
        enum: ['lecture', 'lab', 'break', 'activity'],
        default: 'lecture'
      }
    }]
  }],
  effectiveFrom: {
    type: Date,
    required: true
  },
  effectiveTo: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;

