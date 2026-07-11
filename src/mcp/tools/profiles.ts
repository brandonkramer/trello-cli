import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  freshField,
  localReadAnnotations,
  profileField,
  readAnnotations,
  toolEnvelopeSchemaFor,
  withClient,
} from "../handlers.ts";
import { trelloMemberSchema } from "../schemas.ts";

export function registerProfileTools(server: McpServer): void {
  server.registerTool(
    "trello_profiles_list",
    {
      title: "List Trello profiles",
      description: "List saved Trello auth profiles and the active default.",
      annotations: localReadAnnotations,
      outputSchema: toolEnvelopeSchemaFor(
        z.object({
          activeProfile: z.string(),
          defaultProfile: z.string().optional(),
          profiles: z.array(
            z.object({
              name: z.string(),
              label: z.string().optional(),
              isDefault: z.boolean(),
            }),
          ),
        }),
      ),
    },
    async () =>
      withClient(undefined, async (_client, profileName) => {
        const { loadConfig } = await import("../../auth/profiles.ts");
        const config = loadConfig();
        return {
          activeProfile: profileName,
          defaultProfile: config.defaultProfile,
          profiles: Object.entries(config.profiles).map(([name, p]) => ({
            name,
            label: p.label,
            isDefault: name === config.defaultProfile,
          })),
        };
      }),
  );

  server.registerTool(
    "trello_member_me",
    {
      title: "Get current Trello member",
      description: "Get the authenticated Trello member.",
      inputSchema: { profile: profileField, fresh: freshField },
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloMemberSchema),
    },
    async ({ profile, fresh }) =>
      withClient(profile, (client) => client.memberMe(), fresh),
  );
}
