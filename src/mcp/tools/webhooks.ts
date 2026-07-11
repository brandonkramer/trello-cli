import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createAnnotations,
  deleteAnnotations,
  freshField,
  profileField,
  readAnnotations,
  toolEnvelopeSchemaFor,
  withClient,
} from "../handlers.ts";
import { trelloWebhookSchema } from "../schemas.ts";

export function registerWebhookTools(server: McpServer): void {
  server.registerTool(
    "trello_webhooks_list",
    {
      title: "List Trello webhooks",
      description: "List webhooks registered for the current token.",
      inputSchema: { profile: profileField, fresh: freshField },
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.array(trelloWebhookSchema)),
    },
    async ({ profile, fresh }) =>
      withClient(profile, (client) => client.webhooksForToken(), fresh),
  );

  server.registerTool(
    "trello_webhook_create",
    {
      title: "Create Trello webhook",
      description: "Create a webhook on a board or card model.",
      inputSchema: {
        profile: profileField,
        callbackUrl: z.string().url(),
        modelId: z.string().min(1),
        description: z.string().optional(),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloWebhookSchema),
    },
    async ({ profile, callbackUrl, modelId, description }) =>
      withClient(profile, (client) =>
        client.webhookCreate({
          callbackURL: callbackUrl,
          idModel: modelId,
          description,
        }),
      ),
  );

  server.registerTool(
    "trello_webhook_delete",
    {
      title: "Delete Trello webhook",
      description: "Delete a webhook by id.",
      inputSchema: { profile: profileField, webhookId: z.string().min(1) },
      annotations: deleteAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.json()),
    },
    async ({ profile, webhookId }) =>
      withClient(profile, (client) => client.webhookDelete(webhookId)),
  );
}
