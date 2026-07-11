import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  deleteAnnotations,
  freshField,
  profileField,
  readAnnotations,
  runApi,
  toolEnvelopeSchemaFor,
} from "../handlers.ts";

export function registerApiTools(server: McpServer): void {
  const outputSchema = toolEnvelopeSchemaFor(z.json());

  server.registerTool(
    "trello_api_get",
    {
      title: "Read Trello REST API",
      description:
        "Read-only Trello REST escape hatch. Prefer a specific read tool when available.",
      inputSchema: {
        profile: profileField,
        fresh: freshField,
        path: z.string().min(1),
        query: z.record(z.string(), z.string()).optional(),
      },
      annotations: readAnnotations,
      outputSchema,
    },
    async ({ profile, fresh, path, query }) =>
      runApi(profile, "GET", path, query, undefined, fresh),
  );

  server.registerTool(
    "trello_api_mutate",
    {
      title: "Mutate Trello REST API",
      description:
        "Write-capable Trello REST escape hatch. Prefer a specific mutation tool when available.",
      inputSchema: {
        profile: profileField,
        method: z.enum(["POST", "PUT", "DELETE"]),
        path: z.string().min(1),
        query: z.record(z.string(), z.string()).optional(),
        body: z.json().optional(),
      },
      annotations: deleteAnnotations,
      outputSchema,
    },
    async ({ profile, method, path, query, body }) =>
      runApi(profile, method, path, query, body, false),
  );
}
