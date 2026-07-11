import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerApiTools } from "./api.ts";
import { registerBoardTools } from "./boards.ts";
import { registerCardTools } from "./cards.ts";
import { registerChecklistTools } from "./checklists.ts";
import { registerLabelTools } from "./labels.ts";
import { registerListTools } from "./lists.ts";
import { registerProfileTools } from "./profiles.ts";
import { registerResolveTools } from "./resolve.ts";
import { registerSearchTools } from "./search.ts";
import { registerWebhookTools } from "./webhooks.ts";

export function registerTrelloTools(server: McpServer): void {
  registerProfileTools(server);
  registerBoardTools(server);
  registerListTools(server);
  registerCardTools(server);
  registerChecklistTools(server);
  registerLabelTools(server);
  registerSearchTools(server);
  registerResolveTools(server);
  registerWebhookTools(server);
  registerApiTools(server);
}
