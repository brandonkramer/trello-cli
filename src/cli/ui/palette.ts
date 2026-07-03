export const TRELLO_LABEL_HEX: Record<string, string> = {
  green: "#61bd4f",
  yellow: "#f2d600",
  orange: "#ff9f1a",
  red: "#eb5a46",
  purple: "#c377e0",
  blue: "#0079bf",
  sky: "#00c2e0",
  lime: "#51e898",
  pink: "#ff78cb",
  black: "#344563",
};

const FALLBACK_HEX = "#6b778c";

/** Trello sends shades like "green_dark" — map them to the base color. */
export function labelHex(color: string | null | undefined): string {
  const base = (color ?? "").split("_")[0] ?? "";
  return TRELLO_LABEL_HEX[base] ?? FALLBACK_HEX;
}

export type DueStatus = "none" | "complete" | "overdue" | "soon" | "later";

const SOON_MS = 24 * 60 * 60 * 1000;

export function dueStatus(
  due: string | null | undefined,
  dueComplete: boolean | undefined,
  now: Date = new Date(),
): DueStatus {
  if (!due) return "none";
  if (dueComplete) return "complete";
  const t = Date.parse(due);
  if (Number.isNaN(t)) return "none";
  if (t < now.getTime()) return "overdue";
  if (t - now.getTime() <= SOON_MS) return "soon";
  return "later";
}

export function dueHex(status: DueStatus): string | undefined {
  switch (status) {
    case "complete":
      return TRELLO_LABEL_HEX.green;
    case "overdue":
      return TRELLO_LABEL_HEX.red;
    case "soon":
      return TRELLO_LABEL_HEX.yellow;
    default:
      return undefined;
  }
}

export function formatDue(due: string): string {
  return new Date(due).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
