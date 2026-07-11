import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  freshField,
  profileField,
  readAnnotations,
  toolEnvelopeSchemaFor,
  withClient,
} from "../handlers.ts";

const resolvedItemSchema = z.object({
  type: z.enum(["card", "board", "list"]),
  id: z.string(),
  name: z.string().optional(),
  url: z.string().optional(),
  boardId: z.string().optional(),
});

type ResourceType = "auto" | "card" | "board" | "list";
type ResolvedItem = z.infer<typeof resolvedItemSchema>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function resolvedItem(value: unknown, type: ResolvedItem["type"]): ResolvedItem | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") return null;
  return {
    type,
    id: record.id,
    ...(typeof record.name === "string" ? { name: record.name } : {}),
    ...(typeof record.shortUrl === "string"
      ? { url: record.shortUrl }
      : typeof record.url === "string"
        ? { url: record.url }
        : {}),
    ...(typeof record.idBoard === "string" ? { boardId: record.idBoard } : {}),
  };
}

function arrayField(value: unknown, field: string): unknown[] {
  const record = asRecord(value);
  const items = record?.[field];
  return Array.isArray(items) ? items : [];
}

function trelloUrlReference(reference: string) {
  const match = reference.match(/trello\.com\/(c|b)\/([^/?#]+)/i);
  if (!match) return null;
  return {
    type: match[1]?.toLowerCase() === "c" ? ("card" as const) : ("board" as const),
    id: match[2] ?? "",
  };
}

function resolution(reference: string, matches: ResolvedItem[]) {
  const exact = matches.filter(
    (item) =>
      item.name?.localeCompare(reference, undefined, { sensitivity: "base" }) === 0,
  );
  const selected = exact.length > 0 ? exact : matches;
  return {
    status:
      selected.length === 0
        ? ("not_found" as const)
        : selected.length === 1
          ? ("exact" as const)
          : ("ambiguous" as const),
    matches: selected,
  };
}

export function registerResolveTools(server: McpServer): void {
  server.registerTool(
    "trello_resolve",
    {
      title: "Resolve Trello name or URL",
      description:
        "Resolve a Trello card, board, or list name/URL to canonical IDs. Ambiguous names return candidates instead of guessing.",
      inputSchema: {
        profile: profileField,
        fresh: freshField,
        reference: z.string().min(1),
        resourceType: z.enum(["auto", "card", "board", "list"]).default("auto"),
        boardId: z
          .string()
          .min(1)
          .optional()
          .describe("Required when resolving a list name"),
        limit: z.number().int().positive().max(50).default(10),
      },
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(
        z.object({
          status: z.enum(["exact", "ambiguous", "not_found"]),
          matches: z.array(resolvedItemSchema),
        }),
      ),
    },
    async ({ profile, fresh, reference, resourceType, boardId, limit }) =>
      withClient(
        profile,
        async (client) => {
          const urlReference = trelloUrlReference(reference);
          if (
            urlReference &&
            (resourceType === "auto" || resourceType === urlReference.type)
          ) {
            const value =
              urlReference.type === "card"
                ? await client.cardGet(urlReference.id, {
                    fields: "id,name,idBoard,idList,shortUrl",
                  })
                : await client.boardGet(urlReference.id, {
                    fields: "id,name,shortUrl",
                  });
            const item = resolvedItem(value, urlReference.type);
            return resolution(reference, item ? [item] : []);
          }

          if (resourceType === "list") {
            if (!boardId) {
              throw new Error("boardId is required when resolving a list name");
            }
            const lists = await client.boardLists(boardId, {
              filter: "all",
              fields: "id,name,idBoard,closed",
            });
            const matches = (Array.isArray(lists) ? lists : [])
              .map((item) => resolvedItem(item, "list"))
              .filter((item): item is ResolvedItem => item !== null)
              .filter((item) =>
                item.name?.toLocaleLowerCase().includes(reference.toLocaleLowerCase()),
              )
              .slice(0, limit);
            return resolution(reference, matches);
          }

          const modelTypes: ResourceType = resourceType;
          const search = await client.search(reference, {
            modelTypes:
              modelTypes === "auto"
                ? "cards,boards"
                : modelTypes === "card"
                  ? "cards"
                  : "boards",
            cards_limit: resourceType === "board" ? 0 : limit,
            boards_limit: resourceType === "card" ? 0 : limit,
            card_fields: "id,name,idBoard,idList,shortUrl",
            board_fields: "id,name,shortUrl",
          });
          const matches = [
            ...arrayField(search, "cards").map((item) => resolvedItem(item, "card")),
            ...arrayField(search, "boards").map((item) => resolvedItem(item, "board")),
          ].filter((item): item is ResolvedItem => item !== null);
          return resolution(reference, matches.slice(0, limit));
        },
        fresh,
      ),
  );
}
