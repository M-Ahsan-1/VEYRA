const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    headline: { type: String, trim: true, maxlength: 150, default: '' },
    skills: {
      type: [{ skill: { type: String, trim: true, required: true }, verified: { type: Boolean, default: false } }],
      default: [],
    },
    education: { type: [String], default: [] },
    experience: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    resumeFileName: { type: String, default: null },
    parsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CandidateProfile', profileSchema);