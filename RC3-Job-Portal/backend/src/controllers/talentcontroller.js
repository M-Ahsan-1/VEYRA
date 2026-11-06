const z = require('zod');
const Application = require('../models/application');
const Job = require('../models/job');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/AsyncHandler');
const { normalizeSkill } = require('../services/skillNormalizer');

const searchSchema = z.object({
  query: z.string().trim().min(2, 'Search with at least 2 characters.').max(200),
});

function searchTerms(query) {
  return [...new Set(query.toLocaleLowerCase().match(/[a-z0-9+#.]+/g) || [])]
    .filter((term) => term.length > 1)
    .map((term) => ({ original: term, normalized: normalizeSkill(term).toLocaleLowerCase() }));
}

function evidenceFor(application) {
  const entries = [];
  const profile = application.parsedResume || {};
  for (const skill of profile.skills || []) {
    entries.push({ skill: skill.skill, text: skill.evidence || 'Listed under skills on the parsed resume.' });
  }
  for (const item of application.score_json?.matched_skills || []) {
    entries.push({ skill: item.skill, text: item.excerpt });
  }
  for (const [label, items] of Object.entries({
    headline: [profile.headline],
    education: profile.education,
    experience: profile.experience,
    projects: profile.projects,
  })) {
    for (const text of items || []) {
      if (text) entries.push({ skill: label, text });
    }
  }
  return entries;
}

function rankApplication(application, terms) {
  const evidence = evidenceFor(application);
  const excerpts = [];
  let hits = 0;
  for (const term of terms) {
    const match = evidence.find((item) => {
      const skill = item.skill.toLocaleLowerCase();
      const normalizedSkill = normalizeSkill(item.skill).toLocaleLowerCase();
      const text = item.text.toLocaleLowerCase();
      return skill.includes(term.original)
        || normalizedSkill.includes(term.normalized)
        || text.includes(term.original)
        || text.includes(term.normalized);
    });
    if (match) {
      hits += 1;
      excerpts.push({ skill: match.skill, excerpt: match.text, term: term.original });
    }
  }
  if (!hits) return null;

  return {
    applicationId: String(application._id),
    candidateId: String(application.candidate._id),
    candidateName: application.candidate.name,
    jobId: String(application.job._id),
    jobTitle: application.job.title,
    score: application.overrideScore ?? application.score,
    status: application.status,
    similarity: Math.round(hits / terms.length * 100) / 100,
    excerpts: excerpts.slice(0, 3),
  };
}

const searchTalent = asyncHandler(async (req, res) => {
  const { query } = searchSchema.parse(req.body);
  const terms = searchTerms(query);
  if (!terms.length) throw new AppError('Include at least one skill or experience term.', 400);

  const jobs = await Job.find({ recruiter: req.user._id }).select('_id');
  if (!jobs.length) return res.json({ success: true, query, count: 0, results: [] });

  const applications = await Application.find({ job: { $in: jobs.map((job) => job._id) } })
    .populate('candidate', 'name')
    .populate('job', 'title')
    .sort({ appliedAt: -1 });
  const results = applications
    .filter((application) => application.candidate && application.job)
    .map((application) => rankApplication(application, terms))
    .filter(Boolean)
    .sort((left, right) => (right.similarity - left.similarity) || ((right.score ?? -1) - (left.score ?? -1)));

  res.json({ success: true, query, count: results.length, results });
});

module.exports = { searchTalent, searchTerms, rankApplication };