import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cacheTtlMs, McpRequestCache } from "./cache.ts";

describe("McpRequestCache", () => {
  it("normalizes query order and field order within a profile", async () => {
    const cache = new McpRequestCache();
    let calls = 0;
    const fetch = async () => ({ call: ++calls });

    const first = await cache.execute(
      "work",
      { method: "GET", path: "/cards/card-1", query: { fields: "name,id" } },
      fetch,
    );
    const second = await cache.execute(
      "work",
      { method: "get", path: "/cards/card-1/", query: { fields: "id, name" } },
      fetch,
    );
    const otherProfile = await cache.execute(
      "personal",
      { method: "GET", path: "/cards/card-1", query: { fields: "id,name" } },
      fetch,
    );

    assert.deepEqual(second, first);
    assert.notDeepEqual(otherProfile, first);
    assert.equal(calls, 2);
  });

  it("expires entries according to their route TTL", async () => {
    let now = 0;
    const cache = new McpRequestCache(200, () => now);
    let calls = 0;
    const fetch = async () => ++calls;

    assert.equal(
      await cache.execute("work", { method: "GET", path: "/cards/1" }, fetch),
      1,
    );
    now = 4_999;
    assert.equal(
      await cache.execute("work", { method: "GET", path: "/cards/1" }, fetch),
      1,
    );
    now = 5_000;
    assert.equal(
      await cache.execute("work", { method: "GET", path: "/cards/1" }, fetch),
      2,
    );
  });

  it("keeps a bounded least-recently-used set", async () => {
    const cache = new McpRequestCache(2);
    let calls = 0;
    const read = (path: string) =>
      cache.execute("work", { method: "GET", path }, async () => ++calls);

    await read("/cards/a");
    await read("/cards/b");
    await read("/cards/a");
    await read("/cards/c");
    await read("/cards/b");

    assert.equal(cache.size, 2);
    assert.equal(calls, 4);
  });

  it("deduplicates simultaneous identical GET requests", async () => {
    const cache = new McpRequestCache();
    let calls = 0;
    let resolveRequest: ((value: { id: string }) => void) | undefined;
    const fetch = () => {
      calls += 1;
      return new Promise<{ id: string }>((resolve) => {
        resolveRequest = resolve;
      });
    };

    const first = cache.execute("work", { method: "GET", path: "/cards/1" }, fetch);
    const second = cache.execute("work", { method: "GET", path: "/cards/1" }, fetch);
    resolveRequest?.({ id: "1" });

    assert.deepEqual(await Promise.all([first, second]), [{ id: "1" }, { id: "1" }]);
    assert.equal(calls, 1);
  });

  it("bypasses and refreshes cached data when fresh is true", async () => {
    const cache = new McpRequestCache();
    let calls = 0;
    const fetch = async () => ++calls;
    const request = { method: "GET", path: "/cards/1" };

    assert.equal(await cache.execute("work", request, fetch), 1);
    assert.equal(await cache.execute("work", request, fetch, true), 2);
    assert.equal(await cache.execute("work", request, fetch), 2);
    assert.equal(calls, 2);
  });

  it("does not cache errors or invalidate after failed mutations", async () => {
    const cache = new McpRequestCache();
    let reads = 0;
    const request = { method: "GET", path: "/cards/1" };

    await assert.rejects(() =>
      cache.execute("work", request, async () => {
        throw new Error("failed read");
      }),
    );
    assert.deepEqual(
      await cache.execute("work", request, async () => ({ read: ++reads })),
      { read: 1 },
    );
    await assert.rejects(() =>
      cache.execute("work", { method: "PUT", path: "/cards/1" }, async () => {
        throw new Error("failed write");
      }),
    );
    assert.deepEqual(
      await cache.execute("work", request, async () => ({ read: ++reads })),
      { read: 1 },
    );
  });

  it("invalidates card-related reads after a successful card mutation", async () => {
    const cache = new McpRequestCache();
    const calls = new Map<string, number>();
    const read = (path: string) =>
      cache.execute("work", { method: "GET", path }, async () => {
        const count = (calls.get(path) ?? 0) + 1;
        calls.set(path, count);
        return count;
      });

    await read("/cards/1");
    await read("/lists/list-1/cards");
    await read("/boards/board-1/cards");
    await read("/boards/board-1");
    await read("/search");
    await cache.execute("work", { method: "PUT", path: "/cards/1" }, async () => ({}));

    assert.equal(await read("/cards/1"), 2);
    assert.equal(await read("/lists/list-1/cards"), 2);
    assert.equal(await read("/boards/board-1/cards"), 2);
    assert.equal(await read("/search"), 2);
    assert.equal(await read("/boards/board-1"), 1);
  });

  it("invalidates badge-bearing reads after comment and attachment mutations", async () => {
    const cache = new McpRequestCache();
    const calls = new Map<string, number>();
    const read = (path: string) =>
      cache.execute("work", { method: "GET", path }, async () => {
        const count = (calls.get(path) ?? 0) + 1;
        calls.set(path, count);
        return count;
      });

    const paths = [
      "/cards/1",
      "/cards/1/actions",
      "/cards/1/attachments",
      "/lists/list-1/cards",
      "/boards/board-1/cards",
    ];
    await Promise.all(paths.map(read));
    await cache.execute(
      "work",
      { method: "POST", path: "/cards/1/actions/comments" },
      async () => ({}),
    );
    for (const path of paths) assert.equal(await read(path), 2);

    await cache.execute(
      "work",
      { method: "POST", path: "/cards/1/attachments" },
      async () => ({}),
    );
    for (const path of paths) assert.equal(await read(path), 3);
  });

  it("invalidates corresponding board and list collections", async () => {
    const cache = new McpRequestCache();
    const calls = new Map<string, number>();
    const read = (path: string) =>
      cache.execute("work", { method: "GET", path }, async () => {
        const count = (calls.get(path) ?? 0) + 1;
        calls.set(path, count);
        return count;
      });

    await read("/members/me/boards");
    await read("/boards/board-1");
    await read("/boards/board-1/lists");
    await cache.execute(
      "work",
      { method: "PUT", path: "/boards/board-1" },
      async () => ({}),
    );
    assert.equal(await read("/members/me/boards"), 2);
    assert.equal(await read("/boards/board-1"), 2);
    assert.equal(await read("/boards/board-1/lists"), 2);

    await read("/lists/list-1");
    await read("/lists/list-1/cards");
    await read("/boards/board-1/cards");
    await cache.execute(
      "work",
      { method: "PUT", path: "/lists/list-1" },
      async () => ({}),
    );
    assert.equal(await read("/lists/list-1"), 2);
    assert.equal(await read("/lists/list-1/cards"), 2);
    assert.equal(await read("/boards/board-1/cards"), 2);
  });

  it("never caches mutation results", async () => {
    const cache = new McpRequestCache();
    let calls = 0;
    const mutate = () =>
      cache.execute("work", { method: "POST", path: "/cards" }, async () => ++calls);

    assert.equal(await mutate(), 1);
    assert.equal(await mutate(), 2);
    assert.equal(cache.size, 0);
  });

  it("can be disabled completely", async () => {
    const cache = new McpRequestCache(200, Date.now, () => false);
    let calls = 0;
    const fetch = async () => ++calls;
    const request = { method: "GET", path: "/boards" };

    assert.equal(await cache.execute("work", request, fetch), 1);
    assert.equal(await cache.execute("work", request, fetch), 2);
    assert.equal(cache.size, 0);
  });
});

describe("cacheTtlMs", () => {
  it("uses route-specific TTLs", () => {
    assert.equal(cacheTtlMs("/boards"), 30_000);
    assert.equal(cacheTtlMs("/boards/1/lists"), 30_000);
    assert.equal(cacheTtlMs("/lists/1/cards"), 5_000);
    assert.equal(cacheTtlMs("/cards/1"), 5_000);
    assert.equal(cacheTtlMs("/cards/1/actions"), 3_000);
    assert.equal(cacheTtlMs("/cards/1/attachments"), 3_000);
    assert.equal(cacheTtlMs("/search"), 7_500);
  });
});
