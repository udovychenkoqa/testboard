import { z } from 'zod';

import { AUTOMATION, CASE_STATUSES, PRIORITIES, RESULTS } from './constants';

const id = z.coerce.number().int().positive();
const step = z.object({ action: z.string().max(5000), expected: z.string().max(5000) });

export const projectCreate = z.object({ key: z.string(), name: z.string().max(200), code: z.string() });
export const projectUpdate = z.object({ name: z.string().max(200).optional() });

export const suiteCreate = z.object({ name: z.string().max(200), parentId: id.nullable().optional() });
export const suiteUpdate = z.object({ name: z.string().max(200).optional(), parentId: id.nullable().optional() });

const caseFields = {
  suiteId: id,
  title: z.string().max(500),
  description: z.string().max(20000).optional(),
  preconditions: z.string().max(20000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(CASE_STATUSES).optional(),
  automation: z.enum(AUTOMATION).optional(),
  steps: z.array(step).max(200).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
};

export const caseCreate = z.object(caseFields);
export const caseUpdate = z.object(caseFields).partial();

export const caseFilter = z.object({
  suiteId: id.optional(),
  q: z.string().max(200).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(CASE_STATUSES).optional(),
  automation: z.enum(AUTOMATION).optional(),
  tag: z.string().max(50).optional(),
});

export const caseBulk = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), ids: z.array(id).min(1) }),
  z.object({ action: z.literal('move'), ids: z.array(id).min(1), suiteId: id }),
]);

export const runCreate = z.object({
  name: z.string().max(200),
  assignee: z.string().email().nullable().optional(),
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('all') }),
    z.object({ type: z.literal('suites'), suiteIds: z.array(id).min(1) }),
    z.object({ type: z.literal('tags'), tags: z.array(z.string()).min(1) }),
    z.object({ type: z.literal('cases'), caseIds: z.array(id).min(1) }),
  ]),
});

export const runUpdate = z.object({ status: z.literal('completed') });

export const runCaseUpdate = z.object({
  result: z.enum(RESULTS).optional(),
  comment: z.string().max(5000).optional(),
  assignee: z.string().email().nullable().optional(),
});

export const idParam = id;
