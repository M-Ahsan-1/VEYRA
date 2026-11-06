const { z } = require('zod');
const { generateJSON } = require('./llm');
const { normalizeSkill } = require('../skillNormalizer');

const outputSchema = z.object({
  matchedSkills: z.array(z.object({
    skill: z.string().trim().min(1).max(60),
    similarity: z.coerce.number().min(0).max(1),
    excerpt: z.string().trim().min(1).max(500),
  })).max(60),
  experienceScore: z.coerce.number().int().min(0).max(100),
  projectScore: z.coerce.number().int().min(0).max(100),
  qualificationScore: z.coerce.number().int().min(0).max(100),
  explanation: z.string().trim().min(1).max(1500),
  learningAreas: z.array(z.string().trim().min(1).max(100)).max(12),
});

const system = `You assist a recruiter by comparing resume evidence to stated job requirements.
Use semantic equivalence (for example JS and JavaScript) and the supplied resume text only.
Never infer skill or experience from a person's name, age, gender, nationality, disability, or other protected trait.
For every matched skill, provide a short exact resume excerpt that supports the match. Do not invent excerpts.
Do not treat a skill as confirmed absent. If the resume has no evidence, leave it unmatched; a resume is incomplete evidence.
Score experience, projects, and qualifications from 0 to 100 based only on evidence in the resume and the supplied job.
This is decision support only. Never recommend automatically hiring or rejecting a candidate.
Respond as JSON with exactly: matchedSkills (skill, similarity 0..1, excerpt), experienceScore, projectScore, qualificationScore, explanation, learningAreas.`;

function normalizedKey(value) {
  return normalizeSkill(value).toLocaleLowerCase();
}

function createGaps(jobSkills, matches) {
  const matched = new Set(matches.map((item) => normalizedKey(item.skill)));
  return jobSkills
    .filter((item) => !matched.has(normalizedKey(item.name)))
    .map((item) => ({ skill: item.name, label: 'no_evidence' }));
}

function exactExcerpt(resumeText, excerpt) {
  const normalize = (value) => value.replace(/\s+/g, ' ').toLocaleLowerCase();
  return normalize(excerpt) && normalize(resumeText).includes(normalize(excerpt));
}

async function assessCandidate(job, resumeText, candidateSkills = []) {
  const requiredSkills = (job.requirements?.requiredSkills || []).map((item) => ({ ...item.toObject?.() ?? item, requirement: 'required' }));
  const preferredSkills = (job.requirements?.preferredSkills || []).map((item) => ({ ...item.toObject?.() ?? item, requirement: 'preferred' }));
  const jobSkills = [...requiredSkills, ...preferredSkills];
  const result = await generateJSON({
    system,
    prompt: JSON.stringify({
      job: {
        title: job.title,
        description: job.description,
        minimumExperienceYears: job.requirements?.minExperienceYears || 0,
        qualifications: job.requirements?.qualifications || [],
        skills: jobSkills,
      },
      candidateSkills: candidateSkills.map((item) => item.skill),
      resumeText: resumeText.slice(0, 18000),
    }),
    schema: outputSchema,
  });

  const candidateEvidence = new Map(candidateSkills.map((item) => [normalizedKey(item.skill), item]));
  const matches = result.matchedSkills.filter((item) => exactExcerpt(resumeText, item.excerpt)).map((item) => {
    const profileSkill = candidateEvidence.get(normalizedKey(item.skill));
    return {
      skill: normalizeSkill(item.skill),
      similarity: item.similarity,
      verified: profileSkill?.verified === true,
      excerpt: item.excerpt,
    };
  });
  const matchedBySkill = new Map(matches.map((item) => [normalizedKey(item.skill), item]));
  let possible = 0;
  let earned = 0;
  for (const skill of jobSkills) {
    const importance = Number(skill.importance) || 3;
    const requirementWeight = skill.requirement === 'required' ? 1.5 : 1;
    const weight = importance * requirementWeight;
    possible += weight;
    const match = matchedBySkill.get(normalizedKey(skill.name));
    if (match) earned += weight * match.similarity * (match.verified ? 1 : 0.85);
  }

  const breakdown = {
    skills: possible ? Math.round(earned / possible * 100) : 0,
    experience: result.experienceScore,
    projects: result.projectScore,
    qualifications: result.qualificationScore,
  };
  const total = Math.round(breakdown.skills * 0.5 + breakdown.experience * 0.25 + breakdown.projects * 0.15 + breakdown.qualifications * 0.1);
  const matchedNames = matches.map((item) => item.skill);
  const gapNames = createGaps(jobSkills, matches).map((item) => item.skill);
  const explanation = [
    matchedNames.length ? `Resume excerpts support these skills: ${matchedNames.join(', ')}.` : 'No required skill matches had verifiable resume excerpts.',
    gapNames.length ? `The resume does not provide evidence for: ${gapNames.join(', ')}.` : 'Each listed job skill has supporting resume evidence.',
    'The score is weighted across skills (50%), experience (25%), projects (15%) and qualifications (10%). Recruiter review is required.',
  ].join(' ');

  return {
    total,
    breakdown,
    matched_skills: matches,
    gaps: createGaps(jobSkills, matches),
    explanation,
    learning_areas: result.learningAreas,
    unsupported_claims: [],
  };
}

module.exports = { assessCandidate };