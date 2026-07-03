import { dueStatus, formatDue } from "../cli/ui/palette.ts";

/** Markdown emoji for Trello label colors (agent-facing card lists). */
const LABEL_DOT: Record<string, string> = {
  red: "🔴",
  orange: "🟠",
  yellow: "🟡",
  green: "🟢",
  lime: "🟢",
  blue: "🔵",
  sky: "🔵",
  sky_light: "🔵",
  sky_dark: "🔵",
  purple: "🟣",
  pink: "🟣",
  black: "⚫",
  none: "⚪",
};

export type CardDisplayInput = {
  name?: string;
  shortUrl?: string;
  url?: string;
  due?: string | null;
  dueComplete?: boolean;
  badges?: {
    comments?: number;
    attachments?: number;
    checkItems?: number;
    checkItemsChecked?: number;
  };
  labels?: Array<{ name?: string; color?: string | null }>;
};

function labelDot(color: string | null | undefined): string {
  if (!color) return "⚪";
  const base = color.split("_")[0] ?? color;
  return LABEL_DOT[color] ?? LABEL_DOT[base] ?? "⚪";
}

function labelParts(labels: CardDisplayInput["labels"]): string[] {
  if (!labels?.length) return [];
  return labels
    .map((label) => {
      const name = (label.name ?? "").trim();
      const dot = labelDot(label.color);
      return name ? `${dot} \`${name}\`` : dot;
    })
    .filter(Boolean);
}

function badgeParts(badges: CardDisplayInput["badges"]): string[] {
  if (!badges) return [];
  const parts: string[] = [];
  const comments = badges.comments ?? 0;
  const attachments = badges.attachments ?? 0;
  const total = badges.checkItems ?? 0;
  const checked = badges.checkItemsChecked ?? 0;
  if (comments > 0) parts.push(`💬 ${comments}`);
  if (attachments > 0) parts.push(`📎 ${attachments}`);
  if (total > 0) parts.push(`✓ ${checked}/${total}`);
  return parts;
}

function duePart(
  due: string | null | undefined,
  dueComplete: boolean | undefined,
): string {
  if (!due) return "";
  const status = dueStatus(due, dueComplete);
  const label = formatDue(due);
  if (status === "complete") return `⏰ ${label} ✓`;
  if (status === "overdue") return `⏰ ${label} (overdue)`;
  return `⏰ ${label}`;
}

/** One markdown line: `[name](shortUrl)` + labels + non-zero badges + due. */
export function formatCardLine(card: CardDisplayInput, index?: number): string {
  const name = card.name ?? "(untitled)";
  const href = card.shortUrl ?? card.url ?? "";
  const prefix = index === undefined ? "" : `${index}. `;
  const title = href ? `[${name}](${href})` : name;
  const extras = [...labelParts(card.labels), ...badgeParts(card.badges)];
  const due = duePart(card.due, card.dueComplete);
  if (due) extras.push(due);
  if (extras.length === 0) return `${prefix}${title}`;
  return `${prefix}${title} · ${extras.join(" · ")}`;
}

/** Numbered markdown list for agent/user display (`displayFormat: markdown-v1`). */
export function formatCardListMarkdown(
  cards: CardDisplayInput[],
  heading?: string,
): string {
  const lines = cards.map((card, i) => formatCardLine(card, i + 1));
  if (!heading) return lines.join("\n");
  return `${heading}\n\n${lines.join("\n")}`;
}

export const CARD_LIST_DISPLAY_FORMAT = "markdown-v1";
