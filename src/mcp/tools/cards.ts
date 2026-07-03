import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { profileField, toolEnvelopeSchema, withClient } from "../handlers.ts";

export function registerCardTools(server: McpServer): void {
  const outputSchema = toolEnvelopeSchema;

  server.registerTool(
    "trello_card_get",
    {
      description: "Get a card by id or short link.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        fields: z
          .string()
          .default("id,name,desc,due,dueComplete,idList,shortUrl,labels")
          .describe('comma-separated fields, "all" for everything'),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({ profile, cardId, fields }) =>
      withClient(profile, (client) => client.cardGet(cardId, { fields })),
  );

  server.registerTool(
    "trello_card_create",
    {
      description: "Create a card on a list.",
      inputSchema: {
        profile: profileField,
        listId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        due: z.string().optional(),
        position: z.string().optional(),
      },
      outputSchema,
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
      description: "Update card fields (name, desc, due, closed, idList, etc.).",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        fields: z.record(z.string(), z.string()),
      },
      outputSchema,
    },
    async ({ profile, cardId, fields }) =>
      withClient(profile, (client) => client.cardUpdate(cardId, fields)),
  );

  server.registerTool(
    "trello_card_move",
    {
      description: "Move a card to another list.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        listId: z.string().min(1),
        position: z.string().optional(),
      },
      outputSchema,
    },
    async ({ profile, cardId, listId, position }) =>
      withClient(profile, (client) =>
        client.cardUpdate(cardId, { idList: listId, pos: position }),
      ),
  );

  server.registerTool(
    "trello_card_comments",
    {
      description: "List comments on a card.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({ profile, cardId, limit }) =>
      withClient(profile, (client) => client.cardComments(cardId, { limit })),
  );

  server.registerTool(
    "trello_card_comment",
    {
      description: "Add a comment to a card.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        text: z.string().min(1),
      },
      outputSchema,
    },
    async ({ profile, cardId, text }) =>
      withClient(profile, (client) => client.cardComment(cardId, text)),
  );

  server.registerTool(
    "trello_card_archive",
    {
      description: "Close (archive) a card. Reversible in the Trello UI.",
      inputSchema: { profile: profileField, cardId: z.string().min(1) },
      annotations: { destructiveHint: true },
      outputSchema,
    },
    async ({ profile, cardId }) =>
      withClient(profile, (client) => client.cardArchive(cardId)),
  );

  server.registerTool(
    "trello_card_delete",
    {
      description:
        "Permanently delete a card. Irreversible — prefer trello_card_archive to close.",
      inputSchema: { profile: profileField, cardId: z.string().min(1) },
      annotations: { destructiveHint: true },
      outputSchema,
    },
    async ({ profile, cardId }) =>
      withClient(profile, (client) => client.cardDelete(cardId)),
  );
}
