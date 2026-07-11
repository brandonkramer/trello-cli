import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createAnnotations,
  deleteAnnotations,
  freshField,
  profileField,
  readAnnotations,
  slimCards,
  toolEnvelopeSchemaFor,
  updateAnnotations,
  withClient,
} from "../handlers.ts";
import {
  trelloAttachmentSchema,
  trelloBoardSchema,
  trelloCardSchema,
  trelloChecklistSchema,
  trelloCommentSchema,
  trelloListSchema,
} from "../schemas.ts";

const cardPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    due: z.string().nullable().optional(),
    dueComplete: z.boolean().optional(),
    position: z.union([z.enum(["top", "bottom"]), z.number()]).optional(),
  })
  .refine((fields) => Object.values(fields).some((value) => value !== undefined), {
    message: "Provide at least one card field to update",
  });

type CardPatch = z.infer<typeof cardPatchSchema>;

function cardPatchQuery(fields: CardPatch) {
  return {
    name: fields.name,
    desc: fields.description,
    due: fields.due === null ? "null" : fields.due,
    dueComplete: fields.dueComplete,
    pos: fields.position,
  };
}

export function registerCardTools(server: McpServer): void {
  const cardOutputSchema = toolEnvelopeSchemaFor(trelloCardSchema);

  server.registerTool(
    "trello_card_create",
    {
      title: "Create Trello card",
      description: "Create a card on a list.",
      inputSchema: {
        profile: profileField,
        listId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        due: z.string().optional(),
        position: z.string().optional(),
      },
      annotations: createAnnotations,
      outputSchema: cardOutputSchema,
    },
    async ({ profile, listId, name, description, due, position }) =>
      withClient(profile, (client) =>
        client.cardCreate({
          idList: listId,
          name,
          desc: description,
          due,
          pos: position,
        }),
      ),
  );

  server.registerTool(
    "trello_card_update",
    {
      title: "Update Trello card",
      description:
        "Update card content and scheduling fields. Use trello_card_move or trello_card_archive for state changes.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        fields: cardPatchSchema,
      },
      annotations: updateAnnotations,
      outputSchema: cardOutputSchema,
    },
    async ({ profile, cardId, fields }) =>
      withClient(profile, (client) =>
        client.cardUpdate(cardId, cardPatchQuery(fields)),
      ),
  );

  server.registerTool(
    "trello_card_move",
    {
      title: "Move Trello card",
      description: "Move a card to another list.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        listId: z.string().min(1),
        position: z.string().optional(),
      },
      annotations: updateAnnotations,
      outputSchema: cardOutputSchema,
    },
    async ({ profile, cardId, listId, position }) =>
      withClient(profile, (client) =>
        client.cardUpdate(cardId, { idList: listId, pos: position }),
      ),
  );

  server.registerTool(
    "trello_card_comment_create",
    {
      title: "Add Trello card comment",
      description: "Add a comment to a card.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        text: z.string().min(1),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloCommentSchema),
    },
    async ({ profile, cardId, text }) =>
      withClient(profile, (client) => client.cardComment(cardId, text)),
  );

  server.registerTool(
    "trello_card_comment_update",
    {
      title: "Edit Trello card comment",
      description: "Edit an existing comment on a card.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        commentId: z.string().min(1),
        text: z.string().min(1),
      },
      annotations: updateAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloCommentSchema),
    },
    async ({ profile, cardId, commentId, text }) =>
      withClient(profile, (client) => client.cardEditComment(cardId, commentId, text)),
  );

  server.registerTool(
    "trello_card_comment_delete",
    {
      title: "Delete Trello card comment",
      description: "Permanently delete a comment from a card. Irreversible.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        commentId: z.string().min(1),
      },
      annotations: deleteAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.json()),
    },
    async ({ profile, cardId, commentId }) =>
      withClient(profile, (client) => client.cardDeleteComment(cardId, commentId)),
  );

  server.registerTool(
    "trello_card_archive",
    {
      title: "Archive Trello card",
      description: "Close (archive) a card. Reversible in the Trello UI.",
      inputSchema: { profile: profileField, cardId: z.string().min(1) },
      annotations: updateAnnotations,
      outputSchema: cardOutputSchema,
    },
    async ({ profile, cardId }) =>
      withClient(profile, (client) => client.cardArchive(cardId)),
  );

  server.registerTool(
    "trello_card_delete",
    {
      title: "Delete Trello card",
      description:
        "Permanently delete a card. Irreversible — prefer trello_card_archive to close.",
      inputSchema: { profile: profileField, cardId: z.string().min(1) },
      annotations: deleteAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.json()),
    },
    async ({ profile, cardId }) =>
      withClient(profile, (client) => client.cardDelete(cardId)),
  );

  server.registerTool(
    "trello_card_context",
    {
      title: "Get Trello card context",
      description:
        "Get a card plus selected board, list, comments, attachments, and checklists in one call.",
      inputSchema: {
        profile: profileField,
        fresh: freshField,
        cardId: z.string().min(1),
        include: z
          .array(z.enum(["board", "list", "comments", "attachments", "checklists"]))
          .default([]),
        cardFields: z
          .string()
          .default(
            "id,name,desc,due,dueComplete,idBoard,idList,shortUrl,closed,labels,badges",
          )
          .describe('comma-separated card fields, "all" for everything'),
        commentsLimit: z.number().int().positive().max(1000).default(20),
        attachmentFields: z
          .string()
          .default("id,name,url,date,mimeType,bytes")
          .describe('comma-separated attachment fields, "all" for everything'),
      },
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(
        z.object({
          card: trelloCardSchema,
          board: trelloBoardSchema.optional(),
          list: trelloListSchema.optional(),
          comments: z.array(trelloCommentSchema).optional(),
          attachments: z.array(trelloAttachmentSchema).optional(),
          checklists: z.array(trelloChecklistSchema).optional(),
        }),
      ),
    },
    async ({
      profile,
      fresh,
      cardId,
      include,
      cardFields,
      commentsLimit,
      attachmentFields,
    }) =>
      withClient(
        profile,
        async (client) => {
          const requested = new Set(include);
          const [card, board, list, comments, attachments, checklists] =
            await Promise.all([
              client.cardGet(cardId, { fields: cardFields }),
              requested.has("board")
                ? client.cardBoard(cardId, {
                    fields: "id,name,shortUrl,closed",
                  })
                : undefined,
              requested.has("list")
                ? client.cardList(cardId, {
                    fields: "id,name,idBoard,closed,pos",
                  })
                : undefined,
              requested.has("comments")
                ? client.cardComments(cardId, { limit: commentsLimit })
                : undefined,
              requested.has("attachments")
                ? client.cardAttachments(cardId, { fields: attachmentFields })
                : undefined,
              requested.has("checklists") ? client.cardChecklists(cardId) : undefined,
            ]);
          return {
            card: slimCards(card),
            ...(board === undefined ? {} : { board }),
            ...(list === undefined ? {} : { list }),
            ...(comments === undefined ? {} : { comments }),
            ...(attachments === undefined ? {} : { attachments }),
            ...(checklists === undefined ? {} : { checklists }),
          };
        },
        fresh,
      ),
  );

  server.registerTool(
    "trello_card_attachment_add",
    {
      title: "Add Trello card attachment",
      description: "Attach a URL to a card, optionally with a display name.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        url: z.string().url(),
        name: z.string().min(1).optional(),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloAttachmentSchema),
    },
    async ({ profile, cardId, url, name }) =>
      withClient(profile, (client) => client.cardAddAttachment(cardId, { url, name })),
  );

  server.registerTool(
    "trello_card_attachment_delete",
    {
      title: "Delete Trello card attachment",
      description: "Permanently delete an attachment from a card. Irreversible.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        attachmentId: z.string().min(1),
      },
      annotations: deleteAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.json()),
    },
    async ({ profile, cardId, attachmentId }) =>
      withClient(profile, (client) =>
        client.cardDeleteAttachment(cardId, attachmentId),
      ),
  );
}
