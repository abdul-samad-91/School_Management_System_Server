import mongoose from 'mongoose';

const createTimetableValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const parseTimeStringToMinutes = (value) => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const validateSchedule = (schedule = []) => {
  const normalizedDays = new Set();

  for (const daySchedule of schedule) {
    if (normalizedDays.has(daySchedule.day)) {
      throw createTimetableValidationError(
        `Duplicate timetable entry found for ${daySchedule.day}`
      );
    }

    normalizedDays.add(daySchedule.day);
    const periodNumbers = new Set();
    const sortedPeriods = [...(daySchedule.periods || [])].sort(
      (left, right) => left.periodNumber - right.periodNumber
    );

    for (const period of sortedPeriods) {
      if (periodNumbers.has(period.periodNumber)) {
        throw createTimetableValidationError(
          `Duplicate period number ${period.periodNumber} found on ${daySchedule.day}`
        );
      }

      periodNumbers.add(period.periodNumber);

      const startMinutes = parseTimeStringToMinutes(period.startTime);
      const endMinutes = parseTimeStringToMinutes(period.endTime);

      if (startMinutes === null || endMinutes === null) {
        throw createTimetableValidationError(
          `Invalid time format found on ${daySchedule.day}`
        );
      }

      if (endMinutes <= startMinutes) {
        throw createTimetableValidationError(
          `End time must be after start time on ${daySchedule.day}`
        );
      }

      if (
        ['lecture', 'lab'].includes(period.type) &&
        (!period.subject || !period.teacher)
      ) {
        throw createTimetableValidationError(
          `Subject and teacher are required for ${period.type} periods on ${daySchedule.day}`
        );
      }
    }

    for (let index = 1; index < sortedPeriods.length; index += 1) {
      const previousPeriod = sortedPeriods[index - 1];
      const currentPeriod = sortedPeriods[index];
      const previousEnd = parseTimeStringToMinutes(previousPeriod.endTime);
      const currentStart = parseTimeStringToMinutes(currentPeriod.startTime);

      if (previousEnd > currentStart) {
        throw createTimetableValidationError(`Periods overlap on ${daySchedule.day}`);
      }
    }
  }
};

const timetableSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School is required']
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

timetableSchema.index(
  { school: 1, session: 1, class: 1, section: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

timetableSchema.pre('validate', function(next) {
  try {
    validateSchedule(this.schedule);

    if (this.effectiveTo && this.effectiveTo <= this.effectiveFrom) {
      throw createTimetableValidationError('effectiveTo must be after effectiveFrom');
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;
