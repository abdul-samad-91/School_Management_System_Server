import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
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
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
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

// Compound index to ensure unique class-session combination
classSchema.index({ name: 1, session: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);

export default Class;

