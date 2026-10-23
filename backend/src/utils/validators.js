import { z } from 'zod';

const text = (min, max) => z.string().trim().min(min).max(max);
const imageValue = z.string().trim().max(1_900_000).refine(
  (value) => !value || /^https?:\/\//i.test(value) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(value),
  'Image must be an HTTPS URL or an uploaded JPG, PNG, or WebP file',
).nullable().optional();
export const schemas = {
  login: z.object({ email: z.email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) }),
  register: z.object({ name: text(2, 120), email: z.email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(8).max(128), target: z.enum(['JEE Main', 'JEE Advanced', 'NEET UG']).default('JEE Main') }),
  examRegistration: z.object({ examId: text(1, 80) }),
  attemptStart: z.object({ examId: text(1, 80), acceptedInstructions: z.literal(true) }),
  attemptSave: z.object({ attemptId: text(1, 80), answers: z.record(z.string(), z.union([z.number().int().min(0).max(7), z.string().trim().max(80), z.array(z.number().int().min(0).max(7)).max(8), z.null()])).default({}), marked: z.array(z.union([z.string(), z.number().int()])).max(500).default([]) }),
  attemptSubmit: z.object({ attemptId: text(1, 80), answers: z.record(z.string(), z.union([z.number().int().min(0).max(7), z.string().trim().max(80), z.array(z.number().int().min(0).max(7)).max(8), z.null()])).default({}) }),
  paper: z.object({ title: text(2, 120), subject: z.enum(['Physics', 'Chemistry', 'Mathematics', 'Biology']), questions: z.number().int().min(1).max(180) }),
  paperApproval: z.object({ id: text(1, 80) }),
  bankQuestion: z.object({
    id: z.string().max(80).optional(), externalQuestionId: z.string().trim().max(160).nullable().optional(), text: z.string().trim().max(10000),
    options: z.array(z.string().trim().max(2000)).max(8), correctOption: z.number().int().min(0).max(7).nullable().optional(),
    correctOptions: z.array(z.number().int().min(0).max(7)).max(8).optional(), questionType: z.enum(['single_correct', 'multiple_correct', 'numerical', 'matching_list', 'linked_numerical']).default('single_correct'),
    sourceRow: z.number().int().min(1).nullable().optional(), sourceQuestionType: z.string().trim().max(60).nullable().optional(), paperNumber: z.number().int().min(1).max(10).nullable().optional(), sectionNumber: z.number().int().min(1).max(20).nullable().optional(), numericalAnswer: z.number().nullable().optional(), numericalPrecision: z.number().int().min(0).max(8).nullable().optional(), questionStemId: z.string().trim().max(160).nullable().optional(), matchingListData: z.unknown().nullable().optional(),
    explanation: z.string().trim().max(10000).default(''), subject: text(1, 80),
    chapter: z.string().trim().max(120).default(''), topic: z.string().trim().max(120).default(''),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'), imageUrl: z.string().trim().max(2000).refine((value) => !value || /^https?:\/\//i.test(value), 'Image URL must use http or https').nullable().optional(),
    optionImageUrls: z.array(z.string().trim().max(2000).nullable()).max(8).default([]), reference: z.string().trim().max(2000).nullable().optional(),
  }),
  questionBankUpdate: z.object({
    title: text(2, 160), subject: text(1, 80),
    questions: z.array(z.lazy(() => schemas.bankQuestion)).min(1).max(500),
  }),
  questionBankAction: z.object({ id: text(1, 80) }),
  questionBankApproval: z.object({ id: text(1, 80) }),
  questionBankReject: z.object({ id: text(1, 80), reason: text(3, 1000) }),
  questionBankPublish: z.object({ id: text(1, 80), patternId: text(1, 100), courseId: z.string().trim().max(100).nullable().optional(), durationMinutes: z.number().int().min(1).max(600).optional(), isFree: z.boolean().default(true), price: z.number().min(0).max(100000).default(0), description: z.string().trim().max(2000).default(''), startsAt: z.iso.datetime().nullable().optional(), endsAt: z.iso.datetime().nullable().optional(), registrationOpen: z.boolean().default(true), importMode: z.enum(['compatible_practice','strict_standard']).default('compatible_practice') }),
  examPattern: z.object({ code: text(2, 80).regex(/^[a-z0-9-]+$/), name: text(2, 160), officialYear: z.number().int().min(2020).max(2100).nullable().optional(), configuration: z.record(z.string(), z.unknown()), status: z.enum(['draft','active']).default('draft') }),
  course: z.object({ slug: text(2, 180).regex(/^[a-z0-9-]+$/), name: text(2, 160), category: text(2, 100), examType: text(2, 100), shortDescription: z.string().trim().max(300).default(''), fullDescription: z.string().trim().max(10000).default(''), imageUrl: imageValue, bannerImageUrl: imageValue, fee: z.number().min(0).max(100000).default(0), discountPercent: z.number().min(0).max(100).default(0), durationDays: z.number().int().min(0).max(5000).default(0), mockTestCount: z.number().int().min(0).max(1000).default(0), status: z.enum(['draft','published','archived']).default('draft'), visible: z.boolean().default(true), featured: z.boolean().default(false), displayOrder: z.number().int().min(-10000).max(10000).default(0) }),
  examCatalog: z.object({
    title: text(2, 180), type: text(2, 120), subject: text(2, 300),
    date: z.iso.date(), duration: z.number().int().min(1).max(720),
    fee: z.number().min(0).max(100000).default(0), discountPercent: z.number().min(0).max(100).default(0),
    imageUrl: imageValue, description: z.string().trim().max(2000).default(''),
    tag: z.string().trim().max(80).default(''), status: z.enum(['upcoming', 'published', 'cancelled']),
    registrationOpen: z.boolean().default(true),
  }),
  landingContent: z.record(z.string(), z.union([z.string().max(5000), z.number(), z.boolean(), z.null()])),
  examStatus: z.object({ id: text(1, 80), status: z.enum(['upcoming', 'published', 'cancelled']) }),
  support: z.object({ subject: text(2, 100), message: text(10, 1000) }),
};
