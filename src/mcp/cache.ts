import type { JsonValue, Query } from "../api/client.ts";
import { TrelloClient } from "../api/client.ts";

type CacheRequest = {
  method: string;
  path: string;
  query?: Query;
};

type CacheEntry = {
  expiresAt: number;
  path: string;
  profile: string;
  value: unknown;
};

type InFlightEntry = {
  path: string;
  profile: string;
  promise: Promise<unknown>;
};

type NormalizedRequest = {
  key: string;
  path: string;
};

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 5_000;
const STATIC_TTL_MS = 30_000;
const COMMENTS_AND_ATTACHMENTS_TTL_MS = 3_000;
const SEARCH_TTL_MS = 7_500;

function normalizeFieldList(value: string): string {
  return value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

function normalizeRequest(
  profile: string,
  path: string,
  query: Query = {},
): NormalizedRequest {
  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    "https://cache.invalid",
  );
  const params = new Map<string, string>();

  for (const [key, value] of url.searchParams) {
    params.set(key, value);
  }
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const normalizedParams = [...params.entries()]
    .map(([key, value]) => [
      key,
      key.toLowerCase().endsWith("fields") ? normalizeFieldList(value) : value,
    ])
    .sort(([left], [right]) => left.localeCompare(right));
  const normalizedPath =
    url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;

  return {
    key: JSON.stringify([profile, normalizedPath, normalizedParams]),
    path: normalizedPath,
  };
}

export function cacheTtlMs(path: string): number {
  const normalized = path.toLowerCase();

  if (normalized === "/search") return SEARCH_TTL_MS;
  if (/^\/cards\/[^/]+\/(actions|attachments)(?:\/|$)/.test(normalized)) {
    return COMMENTS_AND_ATTACHMENTS_TTL_MS;
  }
  if (/^\/(boards|lists)\/[^/]+\/cards(?:\/|$)/.test(normalized)) {
    return DEFAULT_TTL_MS;
  }
  if (/^\/cards(?:\/|$)/.test(normalized)) return DEFAULT_TTL_MS;
  if (
    /^\/(boards|lists|labels)(?:\/|$)/.test(normalized) ||
    /^\/members\/[^/]+\/boards(?:\/|$)/.test(normalized) ||
    /^\/organizations\/[^/]+\/boards(?:\/|$)/.test(normalized)
  ) {
    return STATIC_TTL_MS;
  }

  return DEFAULT_TTL_MS;
}

function isCardCollection(path: string): boolean {
  return (
    /^\/cards(?:\/|$)/.test(path) ||
    /^\/lists\/[^/]+\/cards(?:\/|$)/.test(path) ||
    /^\/boards\/[^/]+\/cards(?:\/|$)/.test(path) ||
    path === "/search"
  );
}

function isPathOrChild(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}/`);
}

function mutationAffects(mutationPath: string, cachedPath: string): boolean {
  const path = mutationPath.toLowerCase();
  const cached = cachedPath.toLowerCase();

  const cardMatch = path.match(/^\/cards(?:\/([^/]+))?(?:\/|$)/);
  if (cardMatch) {
    const cardId = cardMatch[1];
    return (
      (cardId
        ? isPathOrChild(cached, `/cards/${cardId}`)
        : isPathOrChild(cached, "/cards")) || isCardCollection(cached)
    );
  }

  const boardMatch = path.match(/^\/boards(?:\/([^/]+))?(?:\/|$)/);
  if (boardMatch) {
    const boardId = boardMatch[1];
    return (
      (boardId
        ? isPathOrChild(cached, `/boards/${boardId}`)
        : isPathOrChild(cached, "/boards")) ||
      /^\/members\/[^/]+\/boards(?:\/|$)/.test(cached) ||
      /^\/organizations\/[^/]+\/boards(?:\/|$)/.test(cached) ||
      cached === "/search"
    );
  }

  const listMatch = path.match(/^\/lists(?:\/([^/]+))?(?:\/|$)/);
  if (listMatch) {
    const listId = listMatch[1];
    return (
      (listId
        ? isPathOrChild(cached, `/lists/${listId}`)
        : isPathOrChild(cached, "/lists")) ||
      /^\/boards\/[^/]+\/(lists|cards)(?:\/|$)/.test(cached) ||
      cached === "/search"
    );
  }

  if (/^\/labels(?:\/|$)/.test(path)) {
    return (
      /^\/labels(?:\/|$)/.test(cached) ||
      /^\/boards\/[^/]+\/(labels|cards)(?:\/|$)/.test(cached) ||
      /^\/lists\/[^/]+\/cards(?:\/|$)/.test(cached) ||
      /^\/cards(?:\/|$)/.test(cached) ||
      cached === "/search"
    );
  }

  if (/^\/checklists(?:\/|$)/.test(path)) {
    return cached.startsWith("/checklists") || isCardCollection(cached);
  }

  if (/^\/customfields(?:\/|$)/.test(path)) {
    return (
      cached.startsWith("/customfields") ||
      /^\/boards\/[^/]+\/customfields(?:\/|$)/.test(cached) ||
      isCardCollection(cached)
    );
  }

  if (/^\/webhooks(?:\/|$)/.test(path)) {
    return cached.startsWith("/webhooks") || /^\/tokens\/[^/]+\/webhooks/.test(cached);
  }

  return true;
}

export class McpRequestCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly generations = new Map<string, number>();
  private readonly inFlight = new Map<string, InFlightEntry>();

  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly now: () => number = Date.now,
    private readonly enabled: () => boolean = () => process.env.TRELLO_CACHE !== "0",
  ) {}

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.generations.clear();
    this.inFlight.clear();
  }

  async execute<T>(
    profile: string,
    request: CacheRequest,
    next: () => Promise<T>,
    fresh = false,
  ): Promise<T> {
    const method = request.method.toUpperCase();
    const normalized = normalizeRequest(profile, request.path, request.query);

    if (method !== "GET") {
      const result = await next();
      this.invalidateMutation(profile, normalized.path);
      return result;
    }

    if (!this.enabled()) return next();

    if (!fresh) {
      const cached = this.get(normalized.key);
      if (cached.hit) return cached.value as T;
    }

    const active = this.inFlight.get(normalized.key);
    if (active) return active.promise as Promise<T>;

    const generation = this.generations.get(profile) ?? 0;
    const promise = next().then((value) => {
      if (this.enabled() && (this.generations.get(profile) ?? 0) === generation) {
        this.set(normalized.key, {
          expiresAt: this.now() + cacheTtlMs(normalized.path),
          path: normalized.path,
          profile,
          value,
        });
      }
      return value;
    });
    const pending = { path: normalized.path, profile, promise };
    this.inFlight.set(normalized.key, pending);

    try {
      return await promise;
    } finally {
      if (this.inFlight.get(normalized.key) === pending) {
        this.inFlight.delete(normalized.key);
      }
    }
  }

  invalidateMutation(profile: string, path: string): void {
    this.generations.set(profile, (this.generations.get(profile) ?? 0) + 1);

    for (const [key, entry] of this.entries) {
      if (entry.profile === profile && mutationAffects(path, entry.path)) {
        this.entries.delete(key);
      }
    }
    for (const [key, entry] of this.inFlight) {
      if (entry.profile === profile && mutationAffects(path, entry.path)) {
        this.inFlight.delete(key);
      }
    }
  }

  private get(key: string): { hit: boolean; value?: unknown } {
    const entry = this.entries.get(key);
    if (!entry) return { hit: false };
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return { hit: false };
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return { hit: true, value: entry.value };
  }

  private set(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

export const mcpRequestCache = new McpRequestCache();

export class CachedMcpTrelloClient extends TrelloClient {
  constructor(
    apiKey: string,
    token: string,
    private readonly profileName: string,
    private readonly fresh = false,
  ) {
    super(apiKey, token);
  }

  override request<T = JsonValue>(
    method: string,
    path: string,
    query: Query = {},
    body?: JsonValue | FormData,
  ): Promise<T> {
    return mcpRequestCache.execute(
      this.profileName,
      { method, path, query },
      () => super.request<T>(method, path, query, body),
      this.fresh,
    );
  }
}
