import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { type JsonValue, type TrelloClient, TrelloError } from "../api/client.ts";
import { getClient } from "../cli/context.ts";
import {
  CARD_LIST_DISPLAY_FORMAT,
  type CardDisplayInput,
  formatCardListMarkdown,
} from "../util/card-display.ts";

export const toolEnvelopeSchema = z.object({
  ok: z.boolean(),
  profile: z.string().optional(),
  data: z.unknown().optional(),
  /** Pre-rendered markdown card list — agents MUST show this to users when present. */
  display: z.string().optional(),
  displayFormat: z.string().optional(),
  error: z.string().optional(),
  status: z.number().optional(),
  details: z.unknown().optional(),
});

export type ToolEnvelope = z.infer<typeof toolEnvelopeSchema>;

export const profileField = z.string().optional().describe("Auth profile name");

export function toolResult(envelope: ToolEnvelope): CallToolResult {
  const text =
    envelope.display && envelope.ok
      ? `${envelope.display}\n\n---\n${JSON.stringify(envelope)}`
      : JSON.stringify(envelope);
  return {
    structuredContent: envelope,
    content: [{ type: "text", text }],
    isError: envelope.ok === false,
  };
}

/** Attach markdown-v1 card list for agent display (see skills/trelly-mcp). */
export function cardListDisplay(
  cards: CardDisplayInput[],
  heading?: string,
): Pick<ToolEnvelope, "display" | "displayFormat"> {
  if (cards.length === 0) {
    return {
      display: heading ? `${heading}\n\n(no cards)` : "(no cards)",
      displayFormat: CARD_LIST_DISPLAY_FORMAT,
    };
  }
  return {
    display: formatCardListMarkdown(cards, heading),
    displayFormat: CARD_LIST_DISPLAY_FORMAT,
  };
}

// Trello's badges object is ~400 chars of mostly unused keys; keep the 4 that matter.
const BADGE_KEYS = ["comments", "attachments", "checkItems", "checkItemsChecked"];

function slimCard(card: Record<string, unknown>): Record<string, unknown> {
  const out = { ...card };
  if (out.badges && typeof out.badges === "object" && !Array.isArray(out.badges)) {
    const badges = out.badges as Record<string, unknown>;
    out.badges = Object.fromEntries(
      BADGE_KEYS.filter((key) => badges[key] !== undefined).map((key) => [
        key,
        badges[key],
      ]),
    );
  }
  if (Array.isArray(out.labels)) {
    out.labels = out.labels.map((label) => {
      const { id, name, color } = label as Record<string, unknown>;
      return { id, name, color };
    });
  }
  return out;
}

/** Slim badges/labels on a card or card array returned by Trello. */
export function slimCards(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === "object"
        ? slimCard(item as Record<string, unknown>)
        : item,
    );
  }
  if (data && typeof data === "object") {
    return slimCard(data as Record<string, unknown>);
  }
  return data;
}

export async function withCardListResult(
  profile: string | undefined,
  fn: (client: TrelloClient) => Promise<unknown>,
  heading?: string,
): Promise<CallToolResult> {
  try {
    const { profileName, client } = getClient(profile);
    const raw = await fn(client);
    const cards = slimCards(raw);
    const arr = Array.isArray(cards) ? (cards as CardDisplayInput[]) : [];
    return toolResult({
      ok: true,
      profile: profileName,
      data: arr,
      ...cardListDisplay(arr, heading),
    });
  } catch (err) {
    if (err instanceof TrelloError) {
      return toolResult({
        ok: false,
        error: err.message,
        status: err.status,
        details: err.body,
      });
    }
    return toolResult({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function withClient<T>(
  profile: string | undefined,
  fn: (client: TrelloClient, profileName: string) => Promise<T>,
): Promise<CallToolResult> {
  try {
    const { profileName, client } = getClient(profile);
    const data = await fn(client, profileName);
    return toolResult({ ok: true, profile: profileName, data });
  } catch (err) {
    if (err instanceof TrelloError) {
      return toolResult({
        ok: false,
        error: err.message,
        status: err.status,
        details: err.body,
      });
    }
    return toolResult({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function runApi(
  profile: string | undefined,
  method: string,
  path: string,
  query: Record<string, string> | undefined,
  body: JsonValue | undefined,
): Promise<CallToolResult> {
  return withClient(profile, (client) =>
    client.request(method.toUpperCase(), path, query ?? {}, body),
  );
}
