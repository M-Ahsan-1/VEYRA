const normalizeJobPayload = require('./normalizeJobPayload');

describe('normalizeJobPayload', () => {
  test('maps the existing form fields to the validated job schema', () => {
    const req = {
      body: {
        type: 'Full-time',
        salary: 'PKR 250,000 - 350,000',
        experienceYears: 2,
        qualifications: 'BS Computer Science, AWS certification',
        skills: [
          { skill: 'JS', requirement: 'required', importance: 'high' },
          { skill: 'ReactJS', requirement: 'preferred', importance: 'medium' },
        ],
      },
    };

    normalizeJobPayload(req, null, () => {});

    expect(req.body.type).toBe('full-time');
    expect(req.body.salary).toEqual({ min: 250000, max: 350000, currency: 'PKR' });
    expect(req.body.requirements.minExperienceYears).toBe(2);
    expect(req.body.requirements.qualifications).toEqual(['BS Computer Science', 'AWS certification']);
    expect(req.body.requirements.requiredSkills).toEqual([{ name: 'JS', importance: 5 }]);
    expect(req.body.requirements.preferredSkills).toEqual([{ name: 'ReactJS', importance: 3 }]);
  });
});