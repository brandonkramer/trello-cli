import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  profileField,
  slimCards,
  toolEnvelopeSchema,
  withClient,
} from "../handlers.ts";

export function registerBoardTools(server: McpServer): void {
  const outputSchema = toolEnvelopeSchema;

  server.registerTool(
    "trello_boards_list",
    {
      description: "List boards visible to the authenticated member.",
      inputSchema: {
        profile: profileField,
        filter: z
          .enum([
            "all",
            "closed",
            "memberships",
            "open",
            "organization",
            "pinned",
            "public",
            "starred",
            "unpinned",
          ])
          .optional()
          .default("open"),
        fields: z
          .string()
          .default("id,name,shortUrl,closed")
          .describe('comma-separated fields, "all" for everything'),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({ profile, filter, fields }) =>
      withClient(profile, (client) => client.memberBoards("me", { filter, fields })),
  );

  server.registerTool(
    "trello_board_get",
    {
      description: "Get a board by id.",
      inputSchema: {
        profile: profileField,
        boardId: z.string().min(1),
        fields: z
          .string()
          .default("id,name,desc,shortUrl,closed")
          .describe('comma-separated fields, "all" for everything'),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({ profile, boardId, fields }) =>
      withClient(profile, (client) => client.boardGet(boardId, { fields })),
  );

  server.registerTool(
    "trello_board_create",
    {
      description: "Create a board.",
      inputSchema: {
        profile: profileField,
        name: z.string().min(1),
        description: z.string().optional(),
        organizationId: z.string().optional(),
        defaultLists: z.boolean().optional(),
      },
      outputSchema,
    },
    async ({ profile, name, description, organizationId, defaultLists }) =>
      withClient(profile, (client) =>
        client.boardCreate({
          name,
          desc: description,
          idOrganization: organizationId,
          defaultLists,
        }),
      ),
  );

  server.registerTool(
    "trello_board_archive",
    {
      description: "Close (archive) a board. Reversible in the Trello UI.",
      inputSchema: { profile: profileField, boardId: z.string().min(1) },
      annotations: { destructiveHint: true },
      outputSchema,
    },
    async ({ profile, boardId }) =>
      withClient(profile, (client) => client.boardArchive(boardId)),
  );

  server.registerTool(
    "trello_board_lists",
    {
      description: "List lists on a board.",
      inputSchema: {
        profile: profileField,
        boardId: z.string().min(1),
        filter: z.string().optional().default("open"),
        fields: z
          .string()
          .default("id,name,closed,pos")
          .describe('comma-separated fields, "all" for everything'),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({ profile, boardId, filter, fields }) =>
      withClient(profile, (client) => client.boardLists(boardId, { filter, fields })),
  );

  server.registerTool(
    "trello_board_cards",
    {
      description: "List all cards on a board.",
      inputSchema: {
        profile: profileField,
        boardId: z.string().min(1),
        fields: z
          .string()
          .default("id,name,idList,due,dueComplete,shortUrl,closed")
          .describe(
            'comma-separated fields, "all" for everything; add "badges,labels" for rich lists',
          ),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({ profile, boardId, fields }) =>
      withClient(profile, async (client) =>
        slimCards(await client.boardCards(boardId, { fields })),
      ),
  );
}
