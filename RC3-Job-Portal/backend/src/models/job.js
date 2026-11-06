const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    importance: { type: Number, min: 1, max: 5, default: 3 },
    evidence: { type: String, trim: true }, // phrase in the description that supports it
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    location: { type: String, required: true, trim: true, maxlength: 100 },
    type: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship'],
      required: true,
    },
    salary: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, default: 'PKR' },
    },
    description: { type: String, required: true, maxlength: 8000 },
    requirements: {
      requiredSkills: { type: [skillSchema], default: [] },
      preferredSkills: { type: [skillSchema], default: [] },
      minExperienceYears: { type: Number, min: 0, default: 0 },
      qualifications: { type: [String], default: [] },
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);