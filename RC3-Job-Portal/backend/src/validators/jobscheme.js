const { z } = require('zod');

const skill = z.object({
  name: z.string().trim().min(1).max(60),
  importance: z.number().int().min(1).max(5).default(3),
  evidence: z.string().trim().max(500).optional(),
});

const requirements = z.object({
  requiredSkills: z.array(skill).max(30).default([]),
  preferredSkills: z.array(skill).max(30).default([]),
  minExperienceYears: z.number().min(0).max(50).default(0),
  qualifications: z.array(z.string().trim().min(1).max(150)).max(15).default([]),
});

const salary = z
  .object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.string().trim().min(1).max(5).optional(),
  })
  .refine((s) => s.min === undefined || s.max === undefined || s.max >= s.min, {
    message: 'Maximum salary must be greater than or equal to minimum salary',
  });

const createJobSchema = z.object({
  title: z.string().trim().min(3).max(150),
  department: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(100),
  type: z.enum(['full-time', 'part-time', 'contract', 'internship']),
  salary: salary.optional(),
  description: z.string().trim().min(30, 'Description must be at least 30 characters').max(8000),
  requirements: requirements.optional(),
});

const updateJobSchema = createJobSchema.partial();

const extractSchema = z.object({
  description: z.string().trim().min(30, 'Description must be at least 30 characters').max(8000),
});

module.exports = { createJobSchema, updateJobSchema, extractSchema };