import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTrelloResponse, trelloErrorMessage } from "./api/http.ts";
import { authLoginUrl } from "./auth/profiles.ts";
import { parseKvPairs } from "./cli/context.ts";
import { customFieldChips } from "./cli/ui/custom-fields.ts";
import { dueStatus, labelHex, listAccentHex } from "./cli/ui/palette.ts";
import { isBoard, isCard, isLabel, isList } from "./cli/ui/shapes.ts";
import { attachmentMime } from "./util/attachment.ts";
import { formatCardLine, formatCardListMarkdown } from "./util/card-display.ts";

describe("parseKvPairs", () => {
  it("parses key=value pairs", () => {
    assert.deepEqual(parseKvPairs(["name=foo", "closed=true"]), {
      name: "foo",
      closed: "true",
    });
  });

  it("rejects invalid pairs", () => {
    assert.throws(() => parseKvPairs(["invalid"]), /Invalid key=value/);
  });
});

describe("authLoginUrl", () => {
  it("defaults to read,write and 30days", () => {
    const url = new URL(authLoginUrl("test-key"));
    assert.equal(url.searchParams.get("key"), "test-key");
    assert.equal(url.searchParams.get("scope"), "read,write");
    assert.equal(url.searchParams.get("expiration"), "30days");
  });

  it("supports callback return_url", () => {
    const url = new URL(
      authLoginUrl("test-key", {
        returnUrl: "http://127.0.0.1:14189/callback",
      }),
    );
    assert.equal(url.searchParams.get("callback_method"), "fragment");
    assert.equal(url.searchParams.get("return_url"), "http://127.0.0.1:14189/callback");
  });
});

describe("attachmentMime", () => {
  it("maps common extensions and falls back to octet-stream", () => {
    assert.equal(attachmentMime("shot.PNG"), "image/png");
    assert.equal(attachmentMime("doc.pdf"), "application/pdf");
    assert.equal(attachmentMime("archive.zip"), "application/octet-stream");
  });
});

describe("trello HTTP helpers", () => {
  it("parses JSON responses", () => {
    assert.deepEqual(parseTrelloResponse('{"id":"1"}'), { id: "1" });
  });

  it("extracts Trello error messages", () => {
    assert.equal(
      trelloErrorMessage({ message: "invalid token" }, 401),
      "invalid token",
    );
    assert.equal(trelloErrorMessage(null, 500), "Trello API 500");
  });
});

describe("ui palette", () => {
  it("maps Trello label colors including shades", () => {
    assert.equal(labelHex("green"), "#61bd4f");
    assert.equal(labelHex("green_dark"), "#61bd4f");
    assert.equal(labelHex(null), "#6b778c");
    assert.equal(labelHex("mauve"), "#6b778c");
  });

  it("maps list accents, falling back to Trello blue", () => {
    assert.equal(listAccentHex(null), "#0079bf");
    assert.equal(listAccentHex(undefined), "#0079bf");
    assert.equal(listAccentHex("teal"), "#6cc3e0");
    assert.equal(listAccentHex("purple"), "#0079bf");
  });

  it("classifies due status", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    assert.equal(dueStatus(null, false, now), "none");
    assert.equal(dueStatus("2026-07-01T00:00:00Z", true, now), "complete");
    assert.equal(dueStatus("2026-07-01T00:00:00Z", false, now), "overdue");
    assert.equal(dueStatus("2026-07-03T18:00:00Z", false, now), "soon");
    assert.equal(dueStatus("2026-08-01T00:00:00Z", false, now), "later");
  });
});

describe("custom field chips", () => {
  const defs = [
    {
      id: "f1",
      name: "Priority",
      type: "list",
      cardFront: true,
      options: [{ id: "o1", text: "Highest", color: "red" }],
    },
    { id: "f2", name: "Points", type: "number", cardFront: true, options: [] },
  ];

  it("resolves list options and raw values, skipping unknown fields", () => {
    const chips = customFieldChips(defs, [
      { idCustomField: "f1", idValue: "o1" },
      { idCustomField: "f2", value: { number: "5" } },
      { idCustomField: "missing", idValue: "x" },
    ]);
    assert.deepEqual(chips, [
      { id: "f1", label: "Priority: Highest", color: "red" },
      { id: "f2", label: "Points: 5", color: null },
    ]);
  });
});

describe("ui shapes", () => {
  it("distinguishes cards, lists, labels, and boards", () => {
    const card = { id: "c", name: "Card", idList: "l", idBoard: "b", pos: 1 };
    const list = { id: "l", name: "List", idBoard: "b", pos: 2, closed: false };
    const label = { id: "lb", name: "bug", color: "red", idBoard: "b" };
    const board = { id: "b", name: "Board", prefs: {}, idOrganization: "o" };
    assert.ok(isCard(card) && !isCard(list) && !isCard(board));
    assert.ok(isList(list) && !isList(card) && !isList(label));
    assert.ok(isLabel(label) && !isLabel(list) && !isLabel(card));
    assert.ok(isBoard(board) && !isBoard(card) && !isBoard(list));
  });
});

describe("card display markdown", () => {
  it("formats linked title with labels and non-zero badges only", () => {
    const line = formatCardLine({
      name: "Example card",
      shortUrl: "https://trello.com/c/example123",
      labels: [{ name: "Backend", color: "blue" }],
      badges: { comments: 2, attachments: 2, checkItems: 0, checkItemsChecked: 0 },
    });
    assert.match(line, /^\[Example card\]\(https:\/\/trello\.com\/c\/example123\)/);
    assert.match(line, /🔵 `Backend`/);
    assert.match(line, /💬 2/);
    assert.match(line, /📎 2/);
    assert.doesNotMatch(line, /✓/);
  });

  it("builds numbered list with optional heading", () => {
    const md = formatCardListMarkdown(
      [{ name: "A", shortUrl: "https://trello.com/c/a" }],
      "**To do**",
    );
    assert.equal(md, "**To do**\n\n1. [A](https://trello.com/c/a)");
  });
});
