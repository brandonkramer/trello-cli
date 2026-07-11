import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CardDisplayInput } from "../../util/card-display.ts";
import {
  cardListDisplay,
  createAnnotations,
  freshField,
  profileField,
  readAnnotations,
  slimCards,
  toolEnvelopeSchemaFor,
  updateAnnotations,
  withClient,
  withClientEnvelope,
} from "../handlers.ts";
import {
  trelloBoardSchema,
  trelloCardSchema,
  trelloLabelSchema,
  trelloListSchema,
} from "../schemas.ts";

type BoardContextParts = {
  board: unknown;
  lists?: unknown;
  labels?: unknown;
  cards?: unknown;
  displayHeading?: string;
};

export function boardContextEnvelope(parts: BoardContextParts) {
  const slimmedCards = parts.cards === undefined ? undefined : slimCards(parts.cards);
  const cardArray = Array.isArray(slimmedCards)
    ? (slimmedCards as CardDisplayInput[])
    : [];
  return {
    data: {
      board: parts.board,
      ...(parts.lists === undefined ? {} : { lists: parts.lists }),
      ...(parts.labels === undefined ? {} : { labels: parts.labels }),
      ...(parts.cards === undefined ? {} : { cards: cardArray }),
    },
    ...(parts.cards === undefined
      ? {}
      : cardListDisplay(cardArray, parts.displayHeading)),
  };
}

export function registerBoardTools(server: McpServer): void {
  server.registerTool(
    "trello_boards_list",
    {
      title: "List Trello boards",
      description: "List boards visible to the authenticated member.",
      inputSchema: {
        profile: profileField,
        fresh: freshField,
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
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.array(trelloBoardSchema)),
    },
    async ({ profile, fresh, filter, fields }) =>
      withClient(
        profile,
        (client) => client.memberBoards("me", { filter, fields }),
        fresh,
      ),
  );

  server.registerTool(
    "trello_board_create",
    {
      title: "Create Trello board",
      description: "Create a board.",
      inputSchema: {
        profile: profileField,
        name: z.string().min(1),
        description: z.string().optional(),
        organizationId: z.string().optional(),
        defaultLists: z.boolean().optional(),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloBoardSchema),
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
      title: "Archive Trello board",
      description: "Close (archive) a board. Reversible in the Trello UI.",
      inputSchema: { profile: profileField, boardId: z.string().min(1) },
      annotations: updateAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloBoardSchema),
    },
    async ({ profile, boardId }) =>
      withClient(profile, (client) => client.boardArchive(boardId)),
  );

  server.registerTool(
    "trello_board_context",
    {
      title: "Get Trello board context",
      description:
        "Get a board plus selected lists, labels, and cards. When cards are included, response `display` contains the formatted card list for users.",
      inputSchema: {
        profile: profileField,
        fresh: freshField,
        boardId: z.string().min(1),
        include: z.array(z.enum(["lists", "labels", "cards"])).default([]),
        boardFields: z
          .string()
          .default("id,name,desc,shortUrl,closed")
          .describe('comma-separated board fields, "all" for everything'),
        listFilter: z.string().default("open"),
        listFields: z
          .string()
          .default("id,name,closed,pos,idBoard")
          .describe('comma-separated list fields, "all" for everything'),
        cardFields: z
          .string()
          .default("id,name,idList,due,dueComplete,shortUrl,closed,badges,labels")
          .describe(
            'comma-separated card fields, "all" for everything; badges,labels included by default for display',
          ),
        displayHeading: z.string().optional(),
      },
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(
        z.object({
          board: trelloBoardSchema,
          lists: z.array(trelloListSchema).optional(),
          labels: z.array(trelloLabelSchema).optional(),
          cards: z.array(trelloCardSchema).optional(),
        }),
      ),
    },
    async ({
      profile,
      fresh,
      boardId,
      include,
      boardFields,
      listFilter,
      listFields,
      cardFields,
      displayHeading,
    }) =>
      withClientEnvelope(
        profile,
        async (client) => {
          const requested = new Set(include);
          const [board, lists, labels, cards] = await Promise.all([
            client.boardGet(boardId, { fields: boardFields }),
            requested.has("lists")
              ? client.boardLists(boardId, {
                  filter: listFilter,
                  fields: listFields,
                })
              : undefined,
            requested.has("labels")
              ? client.boardLabels(boardId, { limit: 1000 })
              : undefined,
            requested.has("cards")
              ? client.boardCards(boardId, { fields: cardFields })
              : undefined,
          ]);
          return boardContextEnvelope({
            board,
            lists,
            labels,
            cards,
            displayHeading,
          });
        },
        fresh,
      ),
  );
}
