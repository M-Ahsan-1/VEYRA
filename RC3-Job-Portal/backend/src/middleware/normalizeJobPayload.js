const importanceValue = { high: 5, medium: 3, low: 1 };

module.exports = (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== 'object') return next();

  if (typeof body.type === 'string') body.type = body.type.trim().toLowerCase();
  if (Array.isArray(body.skills)) {
    const toSkill = (skill) => ({
      name: String(skill.skill || skill.name || '').trim(),
      importance: importanceValue[String(skill.importance || 'medium').toLowerCase()] || 3,
    });
    body.requirements = {
      ...(body.requirements || {}),
      requiredSkills: body.skills.filter((skill) => skill.requirement !== 'preferred').map(toSkill),
      preferredSkills: body.skills.filter((skill) => skill.requirement === 'preferred').map(toSkill),
    };
    delete body.skills;
  }
  if (body.experienceYears !== undefined) {
    body.requirements = body.requirements || {};
    body.requirements.minExperienceYears = Number(body.experienceYears);
    delete body.experienceYears;
  }
  if (typeof body.qualifications === 'string') {
    body.requirements = body.requirements || {};
    body.requirements.qualifications = body.qualifications.split(/\s*[,;]\s*/).filter(Boolean);
    delete body.qualifications;
  }
  if (typeof body.salary === 'string') {
    const amounts = [...body.salary.matchAll(/\d[\d,]*/g)].map((match) => Number(match[0].replace(/,/g, '')));
    if (amounts.length) {
      body.salary = { min: amounts[0], ...(amounts[1] !== undefined ? { max: amounts[1] } : {}), currency: /\bUSD\b/i.test(body.salary) ? 'USD' : 'PKR' };
    } else {
      delete body.salary;
    }
  }
  next();
};