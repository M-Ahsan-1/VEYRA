const { z } = require('zod');
const { generateJSON } = require('./llm');
const { normalizeSkill } = require('../skillNormalizer');

const resumeSchema = z.object({
  phone: z.string().trim().max(40).catch(''),
  headline: z.string().trim().max(150).catch(''),
  skills: z.array(z.object({
    skill: z.string().trim().min(1).max(60),
    evidence: z.string().trim().max(500),
  })).max(60).catch([]),
  education: z.array(z.string().trim().min(1).max(500)).max(20).catch([]),
  experience: z.array(z.string().trim().min(1).max(1000)).max(30).catch([]),
  projects: z.array(z.string().trim().min(1).max(1000)).max(30).catch([]),
});

async function extractResumeWithAI(text) {
  const result = await generateJSON({
    system: `Extract candidate profile facts from the supplied resume text only. Do not infer protected characteristics or invent missing details. Each skill needs a short exact evidence excerpt from the resume. If a fact is not present, leave it empty. Return JSON: {"phone":"","headline":"","skills":[{"skill":"","evidence":""}],"education":[],"experience":[],"projects":[]}.`,
    prompt: `Resume text:\n"""\n${text.slice(0, 18000)}\n"""`,
    schema: resumeSchema,
  });
  const normalizedText = text.replace(/\s+/g, ' ').toLocaleLowerCase();
  const skills = result.skills.filter((item) => {
    const evidence = item.evidence.replace(/\s+/g, ' ').toLocaleLowerCase();
    return evidence.length > 0 && normalizedText.includes(evidence);
  }).map((item) => ({
    skill: normalizeSkill(item.skill),
    verified: false,
    evidence: item.evidence,
  }));
  return {
    phone: result.phone,
    headline: result.headline,
    skills,
    education: result.education,
    experience: result.experience,
    projects: result.projects,
  };
}

module.exports = { extractResumeWithAI };