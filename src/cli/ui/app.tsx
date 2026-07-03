import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useCallback, useEffect, useState } from "react";
import type { TrelloClient } from "../../api/client.ts";
import { dueHex, dueStatus, formatDue, labelHex } from "./palette.ts";

export type UiLabel = { id: string; name: string; color: string | null };

export type UiCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  idList: string;
  pos: number;
  shortUrl: string;
  labels: UiLabel[];
  badges?: {
    checkItems?: number;
    checkItemsChecked?: number;
    comments?: number;
    attachments?: number;
  };
};

export type UiList = { id: string; name: string };

type BoardData = {
  name: string;
  lists: UiList[];
  cardsByList: Map<string, UiCard[]>;
};

const COL_WIDTH = 30;
const CARD_HEIGHT = 4; // borders + name line + badge line

function truncate(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}\n…`;
}

function CardBadges({ card }: { card: UiCard }) {
  const status = dueStatus(card.due, card.dueComplete);
  const checkItems = card.badges?.checkItems ?? 0;
  const checked = card.badges?.checkItemsChecked ?? 0;
  const comments = card.badges?.comments ?? 0;
  return (
    <Text wrap="truncate">
      {card.labels.map((label) => (
        <Text key={label.id} color={labelHex(label.color)}>
          ●{" "}
        </Text>
      ))}
      {card.due ? (
        <Text color={dueHex(status)} dimColor={status === "later"}>
          {formatDue(card.due)}
          {status === "complete" ? " ✓" : ""}{" "}
        </Text>
      ) : null}
      {checkItems > 0 ? (
        <Text dimColor>
          ✓{checked}/{checkItems}{" "}
        </Text>
      ) : null}
      {card.desc ? <Text dimColor>≡ </Text> : null}
      {comments > 0 ? <Text dimColor>💬{comments}</Text> : null}
    </Text>
  );
}

function CardBox({
  card,
  focused,
  width,
}: {
  card: UiCard;
  focused: boolean;
  width: number;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? "cyan" : "gray"}
      width={width}
      height={CARD_HEIGHT}
      paddingX={1}
    >
      <Text bold={focused} wrap="truncate">
        {truncate(card.name, width - 4)}
      </Text>
      <CardBadges card={card} />
    </Box>
  );
}

function Column({
  list,
  cards,
  focused,
  focusedRow,
  width,
  maxCards,
}: {
  list: UiList;
  cards: UiCard[];
  focused: boolean;
  focusedRow: number | null;
  width: number;
  maxCards: number;
}) {
  const total = cards.length;
  let start = 0;
  if (focusedRow !== null && focusedRow >= maxCards) {
    start = focusedRow - maxCards + 1;
  }
  const visible = cards.slice(start, start + maxCards);
  const below = total - (start + visible.length);
  return (
    <Box flexDirection="column" width={width} marginRight={1}>
      <Text bold color={focused ? "cyan" : undefined} wrap="truncate">
        {truncate(list.name, width - 6)} <Text dimColor>({total})</Text>
      </Text>
      {start > 0 ? <Text dimColor> ↑ {start} more</Text> : null}
      {visible.map((card, i) => (
        <CardBox
          key={card.id}
          card={card}
          width={width - 1}
          focused={focusedRow === start + i}
        />
      ))}
      {total === 0 ? <Text dimColor> (empty)</Text> : null}
      {below > 0 ? <Text dimColor> ↓ {below} more</Text> : null}
    </Box>
  );
}

function CardDetail({
  card,
  listName,
  width,
}: {
  card: UiCard;
  listName: string;
  width: number;
}) {
  const status = dueStatus(card.due, card.dueComplete);
  const checkItems = card.badges?.checkItems ?? 0;
  const checked = card.badges?.checkItemsChecked ?? 0;
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold wrap="truncate">
        {card.name}
      </Text>
      <Text dimColor wrap="truncate">
        in {listName} · {card.shortUrl}
      </Text>
      {card.labels.length > 0 ? (
        <Box marginTop={1} gap={1}>
          {card.labels.map((label) => (
            <Text
              key={label.id}
              backgroundColor={labelHex(label.color)}
              color="#1d2125"
            >
              {` ${label.name || label.color || "label"} `}
            </Text>
          ))}
        </Box>
      ) : null}
      {card.due ? (
        <Box marginTop={1}>
          <Text color={dueHex(status)}>
            Due {formatDue(card.due)}
            {status === "complete" ? " ✓" : status === "overdue" ? " (overdue)" : ""}
          </Text>
        </Box>
      ) : null}
      {checkItems > 0 ? (
        <Text dimColor>
          Checklist {checked}/{checkItems}
        </Text>
      ) : null}
      {card.desc ? (
        <Box marginTop={1} width={Math.min(width - 4, 78)}>
          <Text>{truncateLines(card.desc, 18)}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function App({
  client,
  boardId,
  profileName,
}: {
  client: TrelloClient;
  boardId: string;
  profileName: string;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [col, setCol] = useState(0);
  const [row, setRow] = useState(0);
  const [detail, setDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [board, lists, cards] = await Promise.all([
        client.boardGet(boardId, { fields: "name" }) as Promise<{ name: string }>,
        client.boardLists(boardId, { filter: "open", fields: "name,pos" }) as Promise<
          UiList[]
        >,
        client.boardCards(boardId, {
          fields: "name,desc,due,dueComplete,idList,pos,shortUrl,labels,badges",
        }) as Promise<UiCard[]>,
      ]);
      const cardsByList = new Map<string, UiCard[]>();
      for (const list of lists) cardsByList.set(list.id, []);
      for (const card of [...cards].sort((a, b) => a.pos - b.pos)) {
        cardsByList.get(card.idList)?.push(card);
      }
      setData({ name: board.name, lists, cardsByList });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  useInput((input, key) => {
    if (detail) {
      if (key.escape || key.return || input === "q") setDetail(false);
      return;
    }
    if (input === "q") {
      exit();
      return;
    }
    if (input === "r") {
      void load();
      return;
    }
    if (!data || data.lists.length === 0) return;
    const lists = data.lists;
    const safeCol = Math.min(col, lists.length - 1);
    const cards = data.cardsByList.get(lists[safeCol].id) ?? [];
    const safeRow = cards.length === 0 ? -1 : Math.min(row, cards.length - 1);
    if (key.leftArrow || input === "h") {
      setCol(Math.max(0, safeCol - 1));
      setRow(0);
    } else if (key.rightArrow || input === "l") {
      setCol(Math.min(lists.length - 1, safeCol + 1));
      setRow(0);
    } else if (key.upArrow || input === "k") {
      if (safeRow > 0) setRow(safeRow - 1);
    } else if (key.downArrow || input === "j") {
      if (safeRow >= 0 && safeRow < cards.length - 1) setRow(safeRow + 1);
    } else if (key.return && safeRow >= 0) {
      setDetail(true);
    }
  });

  const columns = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;

  if (loading && !data) {
    return <Text> Loading board {boardId}…</Text>;
  }
  if (error && !data) {
    return (
      <Box flexDirection="column">
        <Text color="red"> {error}</Text>
        <Text dimColor> r retry · q quit</Text>
      </Box>
    );
  }
  if (!data) return null;

  const lists = data.lists;
  const safeCol = lists.length > 0 ? Math.min(col, lists.length - 1) : 0;
  const focusedCards =
    lists.length > 0 ? (data.cardsByList.get(lists[safeCol].id) ?? []) : [];
  const safeRow = focusedCards.length > 0 ? Math.min(row, focusedCards.length - 1) : -1;
  const focusedCard = safeRow >= 0 ? focusedCards[safeRow] : undefined;

  const visibleCols = Math.max(1, Math.floor((columns - 2) / (COL_WIDTH + 1)));
  const colStart = Math.min(
    Math.max(0, safeCol - visibleCols + 1),
    Math.max(0, lists.length - visibleCols),
  );
  const shown = lists.slice(colStart, colStart + visibleCols);
  const maxCards = Math.max(1, Math.floor((rows - 7) / CARD_HEIGHT));

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text backgroundColor="#0079bf" color="#ffffff" bold>
          {` ${data.name} `}
        </Text>
        <Text dimColor>
          {"  "}
          {profileName} · {lists.length} lists
          {loading ? " · refreshing…" : ""}
          {error ? ` · ${error}` : ""}
        </Text>
      </Box>
      {detail && focusedCard ? (
        <CardDetail card={focusedCard} listName={lists[safeCol].name} width={columns} />
      ) : (
        <Box>
          {colStart > 0 ? <Text dimColor>‹ </Text> : null}
          {shown.map((list, i) => (
            <Column
              key={list.id}
              list={list}
              cards={data.cardsByList.get(list.id) ?? []}
              focused={colStart + i === safeCol}
              focusedRow={colStart + i === safeCol ? safeRow : null}
              width={COL_WIDTH}
              maxCards={maxCards}
            />
          ))}
          {colStart + visibleCols < lists.length ? <Text dimColor>›</Text> : null}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {detail
            ? "esc/⏎/q back"
            : "←→ lists · ↑↓ cards · ⏎ detail · r refresh · q quit"}
        </Text>
      </Box>
    </Box>
  );
}
