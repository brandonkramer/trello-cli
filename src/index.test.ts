import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTrelloResponse, trelloErrorMessage } from "./api/http.ts";
import { authLoginUrl } from "./auth/profiles.ts";
import { parseKvPairs } from "./cli/context.ts";
import { dueStatus, labelHex } from "./cli/ui/palette.ts";

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

  it("classifies due status", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    assert.equal(dueStatus(null, false, now), "none");
    assert.equal(dueStatus("2026-07-01T00:00:00Z", true, now), "complete");
    assert.equal(dueStatus("2026-07-01T00:00:00Z", false, now), "overdue");
    assert.equal(dueStatus("2026-07-03T18:00:00Z", false, now), "soon");
    assert.equal(dueStatus("2026-08-01T00:00:00Z", false, now), "later");
  });
});
