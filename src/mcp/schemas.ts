import { z } from "zod";

export const trelloBoardSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  desc: z.string().optional(),
  shortUrl: z.string().optional(),
  url: z.string().optional(),
  closed: z.boolean().optional(),
});

export const trelloListSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  idBoard: z.string().optional(),
  closed: z.boolean().optional(),
  pos: z.number().optional(),
});

export const trelloLabelSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  idBoard: z.string().optional(),
});

export const trelloCardSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  desc: z.string().optional(),
  idBoard: z.string().optional(),
  idList: z.string().optional(),
  shortUrl: z.string().optional(),
  url: z.string().optional(),
  due: z.string().nullable().optional(),
  dueComplete: z.boolean().optional(),
  closed: z.boolean().optional(),
  pos: z.number().optional(),
  labels: z.array(trelloLabelSchema).optional(),
  badges: z
    .looseObject({
      comments: z.number().optional(),
      attachments: z.number().optional(),
      checkItems: z.number().optional(),
      checkItemsChecked: z.number().optional(),
    })
    .optional(),
});

export const trelloCommentSchema = z.looseObject({
  id: z.string(),
  type: z.string().optional(),
  date: z.string().optional(),
  data: z.looseObject({ text: z.string().optional() }).optional(),
});

export const trelloAttachmentSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  url: z.string().optional(),
  date: z.string().optional(),
  mimeType: z.string().optional(),
  bytes: z.number().nullable().optional(),
});

export const trelloChecklistSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  idCard: z.string().optional(),
  checkItems: z.array(z.looseObject({ id: z.string() })).optional(),
});

export const trelloMemberSchema = z.looseObject({
  id: z.string(),
  fullName: z.string().optional(),
  username: z.string().optional(),
  url: z.string().optional(),
  email: z.string().optional(),
});

export const trelloWebhookSchema = z.looseObject({
  id: z.string(),
  description: z.string().optional(),
  callbackURL: z.string().optional(),
  idModel: z.string().optional(),
  active: z.boolean().optional(),
});
