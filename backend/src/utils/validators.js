import { z } from 'zod';

const text = (min, max) => z.string().trim().min(min).max(max);
export const schemas = {
  login: z.object({ email: z.email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) }),
  register: z.object({ name: text(2, 120), email: z.email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(8).max(128), target: z.enum(['JEE Main', 'JEE Advanced', 'NEET UG']).default('JEE Main') }),
  examRegistration: z.object({ examId: text(1, 80) }),
  attemptStart: z.object({ examId: text(1, 80) }),
  attemptSave: z.object({ attemptId: text(1, 80), answers: z.record(z.string(), z.number().int().min(0).max(3).nullable()).default({}), marked: z.array(z.union([z.string(), z.number().int()])).max(200).default([]) }),
  attemptSubmit: z.object({ attemptId: text(1, 80), answers: z.record(z.string(), z.number().int().min(0).max(3).nullable()).default({}) }),
  paper: z.object({ title: text(2, 120), subject: z.enum(['Physics', 'Chemistry', 'Mathematics', 'Biology']), questions: z.number().int().min(1).max(180) }),
  paperApproval: z.object({ id: text(1, 80) }),
  examStatus: z.object({ id: text(1, 80), status: z.enum(['upcoming', 'published', 'cancelled']) }),
  support: z.object({ subject: text(2, 100), message: text(10, 1000) }),
};
