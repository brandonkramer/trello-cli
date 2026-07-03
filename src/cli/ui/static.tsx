import { Box, render, Text } from "ink";
import type { ReactNode } from "react";
import type { CliError, CliResult } from "../context.ts";
import { dueHex, dueStatus, formatDue, labelHex, listAccentHex } from "./palette.ts";
import {
  isAction,
  isBoard,
  isCard,
  isChecklist,
  isLabel,
  isList,
  isMember,
  isMessagePayload,
  isProfilesPayload,
  isRecord,
  isSearchResult,
  isWebhook,
  type Rec,
} from "./shapes.ts";

const TRELLO_BLUE = "#0079bf";
const GREEN = "#61bd4f";
const RED = "#eb5a46";
const YELLOW = "#f2d600";

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Render a result as a one-shot ink frame (colors auto-disable when piped). */
export async function renderResult(result: CliResult | CliError): Promise<void> {
  const instance = render(<ResultView result={result} />, {
    exitOnCtrlC: false,
    patchConsole: false,
  });
  instance.unmount();
  await instance.waitUntilExit();
}

function ResultView({ result }: { result: CliResult | CliError }) {
  if (!result.ok) {
    return (
      <Box flexDirection="column">
        <Text color={RED}>
          ✗ {result.error}
          {result.status ? <Text dimColor> (HTTP {result.status})</Text> : null}
        </Text>
        {result.details && isRecord(result.details) ? (
          <Text dimColor>{clip(JSON.stringify(result.details), 120)}</Text>
        ) : null}
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <ResultData data={result.data} />
      {result.profile !== "default" ? (
        <Text dimColor>profile: {result.profile}</Text>
      ) : null}
    </Box>
  );
}

function ResultData({ data }: { data: unknown }) {
  if (Array.isArray(data)) return <ArrayView items={data} />;
  if (isSearchResult(data)) return <SearchView data={data} />;
  if (isProfilesPayload(data)) return <ProfilesView data={data} />;
  if (isMessagePayload(data)) return <MessageView data={data} />;
  if (isCard(data)) return <CardDetail card={data} />;
  if (isChecklist(data)) return <ChecklistView checklist={data} />;
  if (isMember(data)) return <MemberRow member={data} />;
  if (isBoard(data)) return <BoardRow board={data} />;
  if (isRecord(data)) return <KeyValue obj={data} />;
  if (data === null || data === undefined) return <Text dimColor>(no data)</Text>;
  return <Text>{String(data)}</Text>;
}

function ArrayView({ items }: { items: unknown[] }) {
  if (items.length === 0) return <Text dimColor>(none)</Text>;
  const first = items[0];
  let rows: ReactNode;
  if (isCard(first)) {
    rows = items.filter(isCard).map((c) => <CardRow key={String(c.id)} card={c} />);
  } else if (isList(first)) {
    rows = items.filter(isList).map((l) => <ListRow key={String(l.id)} list={l} />);
  } else if (isLabel(first)) {
    rows = items.filter(isLabel).map((l) => <LabelRow key={String(l.id)} label={l} />);
  } else if (isBoard(first)) {
    rows = items.filter(isBoard).map((b) => <BoardRow key={String(b.id)} board={b} />);
  } else if (isWebhook(first)) {
    rows = items
      .filter(isWebhook)
      .map((w) => <WebhookRow key={String(w.id)} webhook={w} />);
  } else if (isAction(first)) {
    rows = items
      .filter(isAction)
      .map((a) => <ActionRow key={String(a.id)} action={a} />);
  } else {
    rows = items.map((item, i) => (
      <GenericRow key={isRecord(item) ? String(item.id ?? i) : i} item={item} />
    ));
  }
  return (
    <Box flexDirection="column">
      {rows}
      <Text dimColor>{items.length} total</Text>
    </Box>
  );
}

function LabelDots({ labels }: { labels: unknown }) {
  if (!Array.isArray(labels) || labels.length === 0) return null;
  return (
    <>
      {labels.filter(isRecord).map((label) => (
        <Text key={String(label.id)} color={labelHex(label.color as string | null)}>
          ●{" "}
        </Text>
      ))}
    </>
  );
}

function DueBadge({ card }: { card: Rec }) {
  const due = card.due as string | null | undefined;
  if (!due) return null;
  const status = dueStatus(due, card.dueComplete as boolean | undefined);
  return (
    <Text color={dueHex(status)} dimColor={status === "later"}>
      {formatDue(due)}
      {status === "complete" ? " ✓" : ""}{" "}
    </Text>
  );
}

function CardRow({ card }: { card: Rec }) {
  const badges = isRecord(card.badges) ? card.badges : undefined;
  const checkItems = (badges?.checkItems as number | undefined) ?? 0;
  const checked = (badges?.checkItemsChecked as number | undefined) ?? 0;
  const comments = (badges?.comments as number | undefined) ?? 0;
  const attachments = (badges?.attachments as number | undefined) ?? 0;
  return (
    <Text wrap="truncate">
      <LabelDots labels={card.labels} />
      {card.dueComplete === true ? <Text color={GREEN}>✓ </Text> : null}
      {String(card.name)} <DueBadge card={card} />
      {checkItems > 0 ? (
        <Text dimColor>
          ✓{checked}/{checkItems}{" "}
        </Text>
      ) : null}
      {card.desc ? <Text dimColor>≡ </Text> : null}
      {comments > 0 ? <Text dimColor>💬{comments} </Text> : null}
      {attachments > 0 ? <Text dimColor>📎{attachments} </Text> : null}
      <Text dimColor>{String(card.shortLink ?? card.id ?? "")}</Text>
    </Text>
  );
}

function CardDetail({ card }: { card: Rec }) {
  const labels = Array.isArray(card.labels) ? card.labels.filter(isRecord) : [];
  const desc = typeof card.desc === "string" ? card.desc : "";
  return (
    <Box flexDirection="column">
      <Text bold wrap="truncate">
        {String(card.name)}
      </Text>
      {labels.length > 0 ? (
        <Box gap={1}>
          {labels.map((label) => (
            <Text
              key={String(label.id)}
              backgroundColor={labelHex(label.color as string | null)}
              color="#1d2125"
            >
              {` ${String(label.name || label.color || "label")} `}
            </Text>
          ))}
        </Box>
      ) : null}
      {card.due ? (
        <Text>
          Due: <DueBadge card={card} />
        </Text>
      ) : null}
      {desc ? <Text>{clip(desc, 600)}</Text> : null}
      <Text dimColor>{String(card.shortUrl ?? card.url ?? card.id ?? "")}</Text>
    </Box>
  );
}

function BoardRow({ board }: { board: Rec }) {
  return (
    <Text wrap="truncate">
      <Text color={TRELLO_BLUE}>● </Text>
      {String(board.name)}
      {board.closed === true ? <Text color={RED}> (closed)</Text> : null}{" "}
      <Text dimColor>{String(board.shortUrl ?? board.id ?? "")}</Text>
    </Text>
  );
}

function ListRow({ list }: { list: Rec }) {
  return (
    <Text wrap="truncate">
      <Text color={listAccentHex(list.color as string | null | undefined)}>▍</Text>{" "}
      {String(list.name)}
      {list.closed === true ? <Text color={RED}> (archived)</Text> : null}{" "}
      <Text dimColor>{String(list.id ?? "")}</Text>
    </Text>
  );
}

function LabelRow({ label }: { label: Rec }) {
  return (
    <Text wrap="truncate">
      <Text backgroundColor={labelHex(label.color as string | null)} color="#1d2125">
        {` ${String(label.name || label.color || "label")} `}
      </Text>{" "}
      <Text dimColor>{String(label.id ?? "")}</Text>
    </Text>
  );
}

function WebhookRow({ webhook }: { webhook: Rec }) {
  return (
    <Text wrap="truncate">
      <Text color={webhook.active === false ? RED : GREEN}>● </Text>
      {String(webhook.description || webhook.callbackURL)}{" "}
      <Text dimColor>
        model {String(webhook.idModel ?? "")} · {String(webhook.id ?? "")}
      </Text>
    </Text>
  );
}

function ActionRow({ action }: { action: Rec }) {
  const date = String(action.date ?? "")
    .slice(0, 16)
    .replace("T", " ");
  return (
    <Text wrap="truncate">
      <Text dimColor>{date} </Text>
      {String(action.type)}
    </Text>
  );
}

function ChecklistView({ checklist }: { checklist: Rec }) {
  const items = (checklist.checkItems as unknown[]).filter(isRecord);
  return (
    <Box flexDirection="column">
      <Text bold>{String(checklist.name)}</Text>
      {items.map((item) => {
        const done = item.state === "complete";
        return (
          <Text key={String(item.id)}>
            {done ? <Text color={GREEN}>☑ </Text> : "☐ "}
            <Text dimColor={done} strikethrough={done}>
              {String(item.name)}
            </Text>
          </Text>
        );
      })}
    </Box>
  );
}

function MemberRow({ member }: { member: Rec }) {
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color={TRELLO_BLUE}>
          @{String(member.username)}
        </Text>
        {member.fullName ? <Text> {String(member.fullName)}</Text> : null}
      </Text>
      {member.url ? <Text dimColor>{String(member.url)}</Text> : null}
    </Box>
  );
}

function ProfilesView({ data }: { data: Rec }) {
  const profiles = (data.profiles as unknown[]).filter(isRecord);
  return (
    <Box flexDirection="column">
      {profiles.length === 0 ? (
        <Text dimColor>No profiles. Run: trelly auth login</Text>
      ) : (
        profiles.map((p) => (
          <Text key={String(p.name)}>
            {p.isDefault === true ? <Text color={YELLOW}>★ </Text> : "  "}
            <Text bold={p.isDefault === true}>{String(p.name)}</Text>
            {p.label ? <Text dimColor> {String(p.label)}</Text> : null}
          </Text>
        ))
      )}
      <Text dimColor>app key: {data.hasAppApiKey === true ? "✓" : "not set"}</Text>
    </Box>
  );
}

function MessageView({ data }: { data: Rec }) {
  const { message, ...rest } = data;
  return (
    <Box flexDirection="column">
      <Text color={GREEN}>✓ {String(message)}</Text>
      {Object.keys(rest).length > 0 ? <KeyValue obj={rest} dim /> : null}
    </Box>
  );
}

function SearchView({ data }: { data: Rec }) {
  const boards = Array.isArray(data.boards) ? data.boards : [];
  const cards = Array.isArray(data.cards) ? data.cards : [];
  return (
    <Box flexDirection="column">
      {boards.length > 0 ? (
        <Box flexDirection="column" marginBottom={cards.length > 0 ? 1 : 0}>
          <Text bold dimColor>
            Boards
          </Text>
          {boards.filter(isBoard).map((b) => (
            <BoardRow key={String(b.id)} board={b} />
          ))}
        </Box>
      ) : null}
      {cards.length > 0 ? (
        <Box flexDirection="column">
          <Text bold dimColor>
            Cards
          </Text>
          {cards.filter(isCard).map((c) => (
            <CardRow key={String(c.id)} card={c} />
          ))}
        </Box>
      ) : null}
      {boards.length === 0 && cards.length === 0 ? (
        <Text dimColor>(no results)</Text>
      ) : null}
    </Box>
  );
}

function GenericRow({ item }: { item: unknown }) {
  if (isRecord(item) && typeof item.name === "string") {
    return (
      <Text wrap="truncate">
        {item.name} <Text dimColor>{String(item.id ?? "")}</Text>
      </Text>
    );
  }
  return <Text wrap="truncate">{clip(JSON.stringify(item) ?? "", 100)}</Text>;
}

function KeyValue({ obj, dim = false }: { obj: Rec; dim?: boolean }) {
  return (
    <Box flexDirection="column">
      {Object.entries(obj).map(([key, value]) => (
        <Box key={key}>
          <Text dimColor>{key}: </Text>
          <ValueText value={value} dim={dim} />
        </Box>
      ))}
    </Box>
  );
}

function ValueText({ value, dim }: { value: unknown; dim: boolean }) {
  if (value === null || value === undefined) return <Text dimColor>—</Text>;
  if (typeof value === "boolean") {
    return <Text color={value ? GREEN : RED}>{String(value)}</Text>;
  }
  if (typeof value === "string" || typeof value === "number") {
    return (
      <Text dimColor={dim} wrap="truncate">
        {String(value)}
      </Text>
    );
  }
  return <Text dimColor>{clip(JSON.stringify(value) ?? "", 80)}</Text>;
}
