const mongoose = require('mongoose');
const { PDFParse } = require('pdf-parse');
const Application = require('../models/application');
const CandidateProfile = require('../models/candidateProfile');
const Job = require('../models/job');
const Notification = require('../models/notification');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/AsyncHandler');
const { ALIASES, normalizeSkill } = require('../services/skillNormalizer');
const { assessCandidate } = require('../services/ai/candidateAssessment');
const { extractResumeWithAI } = require('../services/ai/resumeParser');

const transitions = {
  Submitted: ['Parsed', 'Rejected'],
  Parsed: ['AI Assessment Available', 'Rejected'],
  'AI Assessment Available': ['Recruiter Review', 'Rejected'],
  'Recruiter Review': ['Shortlisted', 'Rejected'],
  Shortlisted: ['Interview', 'Rejected'],
  Interview: ['Selected', 'Rejected'],
  Selected: [],
  Rejected: [],
};

function sentenceAt(text, index) {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index), 0);
  const candidates = [text.indexOf('.', index), text.indexOf('\n', index)].filter((point) => point >= 0);
  const end = candidates.length ? Math.min(...candidates) + 1 : Math.min(text.length, index + 180);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 500);
}

function extractResumeHeuristically(text) {
  const lower = text.toLowerCase();
  const skills = new Map();

  for (const [alias, canonical] of Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
    const match = new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').exec(lower);
    if (match && !skills.has(canonical.toLowerCase())) {
      const index = match.index + match[1].length;
      skills.set(canonical.toLowerCase(), {
        skill: normalizeSkill(canonical),
        verified: false,
        evidence: sentenceAt(text, index),
      });
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const education = lines.filter((line) => /\b(bachelor|master|ph\.?d|b\.?s\.?|m\.?s\.?|diploma|degree|university|college|certification)\b/i.test(line)).slice(0, 12);
  const experience = lines.filter((line) => /\b(experience|years?\b|worked|employment|developer|engineer|analyst|intern|manager)\b/i.test(line)).slice(0, 20);
  const projects = lines.filter((line) => /\b(project|built|developed|created|designed|implemented)\b/i.test(line)).slice(0, 20);
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() || '';

  return {
    phone,
    headline: '',
    skills: [...skills.values()],
    education,
    experience,
    projects,
  };
}

function serializeProfile(profile, user) {
  return {
    name: user.name,
    email: user.email,
    phone: profile.phone,
    headline: profile.headline,
    skills: profile.skills,
    education: profile.education,
    experience: profile.experience,
    projects: profile.projects,
    resumeFileName: profile.resumeFileName,
    parsedAt: profile.parsedAt,
  };
}

function serializeHistory(history) {
  return history.map((entry) => ({
    from: entry.from,
    to: entry.to,
    changedBy: entry.changedBy,
    at: entry.at,
    ...(entry.reason ? { reason: entry.reason } : {}),
  }));
}

function applicantView(application, candidate, profile) {
  return {
    id: String(application._id),
    jobId: String(application.job._id || application.job),
    candidateId: String(candidate._id),
    candidateName: candidate.name,
    email: candidate.email,
    phone: profile?.phone || application.parsedResume.phone || '',
    status: application.status,
    score: application.score,
    overrideScore: application.overrideScore,
    overrideReason: application.overrideReason,
    effectiveScore: application.overrideScore ?? application.score,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
    resumeFileName: application.resumeFileName,
    score_json: application.score_json,
    parsedResume: application.parsedResume,
    history: serializeHistory(application.history),
    notes: application.notes,
  };
}

async function findOwnedApplication(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid application id', 400);
  const application = await Application.findById(req.params.id).populate('job').populate('candidate');
  if (!application || !application.job || !application.job.recruiter.equals(req.user._id)) {
    throw new AppError('Application not found', 404);
  }
  return application;
}

const createApplication = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please choose your resume PDF.', 400);
  if (!req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new AppError('The uploaded file is not a valid PDF.', 415);
  }
  if (!mongoose.isValidObjectId(req.body.jobId)) throw new AppError('Invalid job id', 400);

  const job = await Job.findOne({ _id: req.body.jobId, status: 'open' });
  if (!job) throw new AppError('This job is closed or unavailable.', 404);

  let parser;
  let resumeText;
  try {
    parser = new PDFParse({ data: req.file.buffer });
    const parsed = await parser.getText();
    resumeText = parsed.text.replace(/\u0000/g, '').trim();
  } catch (error) {
    throw new AppError('We could not read this PDF. Please upload a text-based PDF resume.', 422);
  } finally {
    await parser?.destroy();
  }
  if (!resumeText) throw new AppError('The PDF contains no readable text. Please upload a text-based resume.', 422);

  let parsedResume;
  try {
    parsedResume = await extractResumeWithAI(resumeText);
  } catch (error) {
    parsedResume = extractResumeHeuristically(resumeText);
  }
  const now = new Date();
  const filename = req.file.originalname.replace(/[\\/]/g, '_').slice(-255);
  const application = await Application.create({
    job: job._id,
    candidate: req.user._id,
    status: 'Parsed',
    appliedAt: now,
    resumeFileName: filename,
    resumeContentType: 'application/pdf',
    resumeSize: req.file.size,
    resumeData: req.file.buffer,
    resumeText,
    parsedResume: { ...parsedResume, parsedAt: now },
    history: [
      { from: null, to: 'Submitted', changedBy: req.user.name, at: now },
      { from: 'Submitted', to: 'Parsed', changedBy: 'system', at: now },
    ],
  });

  await CandidateProfile.findOneAndUpdate(
    { user: req.user._id },
    {
      $set: {
        phone: parsedResume.phone,
        skills: parsedResume.skills,
        education: parsedResume.education,
        experience: parsedResume.experience,
        projects: parsedResume.projects,
        resumeFileName: filename,
        parsedAt: now,
      },
      $setOnInsert: { headline: '' },
    },
    { upsert: true, new: true, runValidators: true }
  );

  await Notification.create({ user: req.user._id, message: `Your application for ${job.title} was received.` });
  res.status(201).json({
    success: true,
    application: {
      id: String(application._id),
      status: application.status,
      appliedAt: application.appliedAt,
    },
  });
});

const listCandidateApplications = asyncHandler(async (req, res) => {
  const applications = await Application.find({ candidate: req.user._id })
    .populate('job', 'title')
    .sort({ appliedAt: -1 });
  res.json({
    success: true,
    applications: applications.map((application) => ({
      id: String(application._id),
      jobId: String(application.job?._id || ''),
      jobTitle: application.job?.title || 'Unavailable role',
      status: application.status,
      appliedAt: application.appliedAt,
      timeline: application.history.map((entry) => ({ status: entry.to, at: entry.at })),
    })),
  });
});

const listCandidateRecommendations = asyncHandler(async (req, res) => {
  const profile = await CandidateProfile.findOne({ user: req.user._id });
  const candidateSkills = new Set((profile?.skills || []).map((item) => normalizeSkill(item.skill).toLocaleLowerCase()));
  const jobs = await Job.find({ status: 'open' }).sort({ createdAt: -1 }).select('-recruiter');
  const recommendations = jobs.map((job) => {
    const required = job.requirements.requiredSkills || [];
    const preferred = job.requirements.preferredSkills || [];
    const skills = [...required, ...preferred];
    const matchedSkills = skills.filter((skill) => candidateSkills.has(normalizeSkill(skill.name).toLocaleLowerCase())).map((skill) => skill.name);
    const requiredMatches = required.filter((skill) => candidateSkills.has(normalizeSkill(skill.name).toLocaleLowerCase())).length;
    const score = skills.length ? Math.round(matchedSkills.length / skills.length * 100) : 0;
    return {
      ...job.toObject(),
      id: String(job._id),
      matchScore: score,
      matchedSkills,
      missingRequiredSkills: required.filter((skill) => !candidateSkills.has(normalizeSkill(skill.name).toLocaleLowerCase())).map((skill) => skill.name),
      recommendationExplanation: skills.length
        ? `${requiredMatches} of ${required.length} required skills match the candidate profile. Review the job details and resume before applying.`
        : 'No structured skill requirements are available for this role yet.',
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
  res.json({ success: true, recommendations });
});

const downloadResume = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid application id', 400);
  const application = await Application.findById(req.params.id).select('+resumeData').populate('job');
  if (!application) throw new AppError('Application not found', 404);
  const candidateOwns = application.candidate.equals(req.user._id);
  const recruiterOwns = application.job?.recruiter.equals(req.user._id);
  if (!candidateOwns && !recruiterOwns) throw new AppError('Application not found', 404);
  const filename = application.resumeFileName.replace(/[\r\n"\\]/g, '_');
  res.set({
    'Content-Type': application.resumeContentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(application.resumeData);
});

const listJobApplicants = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.jobId)) throw new AppError('Invalid job id', 400);
  const job = await Job.findOne({ _id: req.params.jobId, recruiter: req.user._id });
  if (!job) throw new AppError('Job not found', 404);

  const applications = await Application.find({ job: job._id }).populate('candidate').sort({ appliedAt: -1 });
  const profiles = await CandidateProfile.find({ user: { $in: applications.map((application) => application.candidate._id) } });
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const applicants = applications.map((application) => applicantView(
    application,
    application.candidate,
    profileByUser.get(String(application.candidate._id))
  ));
  applicants.sort((a, b) => (b.effectiveScore ?? -1) - (a.effectiveScore ?? -1));
  res.json({ success: true, applicants });
});

const getApplicationDetail = asyncHandler(async (req, res) => {
  const application = await findOwnedApplication(req);
  res.json({
    success: true,
    application: {
      ...applicantView(application, application.candidate, null),
      jobTitle: application.job.title,
      jobDescription: application.job.description,
    },
  });
});

const assessApplication = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid application id', 400);
  const application = await Application.findById(req.params.id)
    .select('+resumeText')
    .populate('job')
    .populate('candidate');
  if (!application || !application.job || !application.job.recruiter.equals(req.user._id)) {
    throw new AppError('Application not found', 404);
  }
  if (!application.resumeText) throw new AppError('This application has no readable resume text to assess.', 409);

  application.score_json = await assessCandidate(
    application.job,
    application.resumeText,
    application.parsedResume.skills
  );
  application.score = application.score_json.total;
  if (application.status === 'Parsed') {
    application.history.push({ from: 'Parsed', to: 'AI Assessment Available', changedBy: 'system', at: new Date() });
    application.status = 'AI Assessment Available';
  }
  await application.save();
  res.json({ success: true, application: applicantView(application, application.candidate, null) });
});

const getCandidateProfile = asyncHandler(async (req, res) => {
  let profile = await CandidateProfile.findOne({ user: req.user._id });
  if (!profile) profile = await CandidateProfile.create({ user: req.user._id });
  res.json({ success: true, profile: serializeProfile(profile, req.user) });
});

const saveCandidateProfile = asyncHandler(async (req, res) => {
  const { skills, education, experience, projects } = req.body;
  if (!Array.isArray(skills) || skills.length > 100) throw new AppError('Skills must be a list of at most 100 items.', 400);
  for (const field of [education, experience, projects]) {
    if (!Array.isArray(field) || field.length > 50 || field.some((item) => typeof item !== 'string' || item.length > 1000)) {
      throw new AppError('Education, experience and projects must be lists of up to 50 text items.', 400);
    }
  }

  const cleanSkills = skills.map((item) => {
    const skill = typeof item === 'string' ? item.trim() : String(item?.skill || '').trim();
    if (!skill || skill.length > 60) throw new AppError('Each skill must contain 1 to 60 characters.', 400);
    return { skill: normalizeSkill(skill), verified: typeof item === 'object' && item.verified === true };
  });
  const profile = await CandidateProfile.findOneAndUpdate(
    { user: req.user._id },
    {
      $set: {
        phone: String(req.body.phone || '').trim().slice(0, 40),
        headline: String(req.body.headline || '').trim().slice(0, 150),
        skills: cleanSkills,
        education,
        experience,
        projects,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ success: true, profile: serializeProfile(profile, req.user) });
});

const changeApplicationStatus = asyncHandler(async (req, res) => {
  const application = await findOwnedApplication(req);
  const target = String(req.body.status || '').trim();
  const reason = String(req.body.reason || '').trim();
  if (!(transitions[application.status] || []).includes(target)) {
    throw new AppError(`Cannot move an application from ${application.status} to ${target || 'an empty status'}.`, 400);
  }
  if (['Selected', 'Rejected'].includes(target) && !reason) {
    throw new AppError('A reason is required for a final hiring decision.', 400);
  }
  const now = new Date();
  application.history.push({ from: application.status, to: target, changedBy: req.user.name, at: now, ...(reason ? { reason } : {}) });
  application.status = target;
  await application.save();
  if (target === 'Selected' || target === 'Rejected') {
    const message = target === 'Selected'
      ? `Good news. Your application for ${application.job.title} was successful. Our team will contact you with next steps.`
      : `Thank you for applying to ${application.job.title}. After careful review we will not be moving forward on this occasion.`;
    await Notification.create({ user: application.candidate._id, message });
  }
  res.json({ success: true, application: applicantView(application, application.candidate, null) });
});

const overrideApplicationScore = asyncHandler(async (req, res) => {
  const application = await findOwnedApplication(req);
  const score = Number(req.body.score);
  const reason = String(req.body.reason || '').trim();
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new AppError('Score must be between 0 and 100.', 400);
  if (reason.length < 5 || reason.length > 1000) throw new AppError('Please provide a reason of 5 to 1000 characters.', 400);
  application.overrideScore = Math.round(score);
  application.overrideReason = reason;
  application.history.push({
    from: application.status,
    to: application.status,
    changedBy: req.user.name,
    at: new Date(),
    reason: `Score override to ${Math.round(score)}: ${reason}`,
  });
  await application.save();
  res.json({ success: true, application: applicantView(application, application.candidate, null) });
});

const listApplicationNotes = asyncHandler(async (req, res) => {
  const application = await findOwnedApplication(req);
  res.json({ success: true, notes: application.notes });
});

const addApplicationNote = asyncHandler(async (req, res) => {
  const application = await findOwnedApplication(req);
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 1000) throw new AppError('Notes must contain 1 to 1000 characters.', 400);
  application.notes.push({ text, author: req.user.name, at: new Date() });
  await application.save();
  res.status(201).json({ success: true, note: application.notes[application.notes.length - 1] });
});

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, notifications });
});

const markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

module.exports = {
  createApplication,
  listCandidateApplications,
  listCandidateRecommendations,
  downloadResume,
  listJobApplicants,
  getApplicationDetail,
  assessApplication,
  getCandidateProfile,
  saveCandidateProfile,
  changeApplicationStatus,
  overrideApplicationScore,
  listApplicationNotes,
  addApplicationNote,
  listNotifications,
  markNotificationsRead,
};