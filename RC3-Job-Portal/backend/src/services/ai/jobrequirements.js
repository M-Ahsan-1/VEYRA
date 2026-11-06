const { z } = require('zod');
const { generateJSON } = require('./llm');
const { normalizeSkillList } = require('../skillNormalizer');

const skill = z.object({
  name: z.string().trim().min(1).max(60),
  importance: z.coerce.number().int().min(1).max(5).catch(3),
  evidence: z.string().trim().max(500).optional().catch(undefined),
});

const outputSchema = z.object({
  requiredSkills: z.array(skill).max(30).catch([]),
  preferredSkills: z.array(skill).max(30).catch([]),
  minExperienceYears: z.coerce.number().min(0).max(50).catch(0),
  qualifications: z.array(z.string().trim().min(1).max(150)).max(15).catch([]),
});

const SYSTEM = `You extract hiring requirements from job descriptions.
Rules:
- Extract ONLY what the text states or clearly implies. Never invent requirements.
- "requiredSkills": skills the text presents as required or must-have.
- "preferredSkills": skills presented as nice-to-have, bonus or preferred.
- "importance" is 1 to 5 (5 = core to the role, 1 = minor), judged from emphasis in the text.
- "evidence" is a short exact phrase copied from the description that supports the skill.
- "minExperienceYears" is a number; use 0 if no experience is stated.
- "qualifications" are degrees, certifications or similar credentials.
Respond with JSON only, in exactly this shape:
{"requiredSkills":[{"name":"","importance":3,"evidence":""}],"preferredSkills":[{"name":"","importance":2,"evidence":""}],"minExperienceYears":0,"qualifications":[""]}`;

async function extractRequirements(description) {
  const result = await generateJSON({
    system: SYSTEM,
    prompt: `Job description:\n"""\n${description}\n"""`,
    schema: outputSchema,
  });

  return {
    ...result,
    requiredSkills: normalizeSkillList(result.requiredSkills),
    preferredSkills: normalizeSkillList(result.preferredSkills),
  };
}

module.exports = { extractRequirements };