import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createAnnotations,
  profileField,
  toolEnvelopeSchemaFor,
  withClient,
} from "../handlers.ts";
import { trelloLabelSchema } from "../schemas.ts";

export function registerLabelTools(server: McpServer): void {
  server.registerTool(
    "trello_label_create",
    {
      title: "Create Trello label",
      description: "Create a board label.",
      inputSchema: {
        profile: profileField,
        boardId: z.string().min(1),
        name: z.string().min(1),
        color: z.string().min(1),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloLabelSchema),
    },
    async ({ profile, boardId, name, color }) =>
      withClient(profile, (client) =>
        client.labelCreate({ idBoard: boardId, name, color }),
      ),
  );

  server.registerTool(
    "trello_card_add_label",
    {
      title: "Add Trello card label",
      description: "Add a label to a card.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        labelId: z.string().min(1),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.json()),
    },
    async ({ profile, cardId, labelId }) =>
      withClient(profile, (client) => client.cardAddLabel(cardId, labelId)),
  );
}
