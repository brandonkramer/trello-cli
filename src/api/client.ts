import {
  type JsonValue,
  parseTrelloResponse,
  type Query,
  type RequestOptions,
  TrelloError,
  trelloErrorMessage,
  trelloFetch,
} from "./http.ts";

export {
  type JsonValue,
  type Query,
  type RequestOptions,
  TrelloError,
} from "./http.ts";

export class TrelloClient {
  private readonly base = "https://api.trello.com/1";

  constructor(
    private readonly apiKey: string,
    private readonly token: string,
    private readonly requestOptions: RequestOptions = {},
  ) {}

  async request<T = JsonValue>(
    method: string,
    path: string,
    query: Query = {},
    body?: JsonValue | FormData,
  ): Promise<T> {
    const url = new URL(`${this.base}${path.startsWith("/") ? path : `/${path}`}`);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `OAuth oauth_consumer_key="${this.apiKey}", oauth_token="${this.token}"`,
    };

    const init: RequestInit = { method, headers };
    if (body instanceof FormData) {
      init.body = body; // fetch sets the multipart boundary
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const res = await trelloFetch(url, init, this.requestOptions);
    const text = await res.text();
    const parsed = parseTrelloResponse(text);

    if (!res.ok) {
      throw new TrelloError(trelloErrorMessage(parsed, res.status), res.status, parsed);
    }

    return parsed as T;
  }

  get<T = JsonValue>(path: string, query?: Query): Promise<T> {
    return this.request("GET", path, query);
  }

  post<T = JsonValue>(
    path: string,
    query?: Query,
    body?: JsonValue | FormData,
  ): Promise<T> {
    return this.request("POST", path, query, body);
  }

  put<T = JsonValue>(path: string, query?: Query, body?: JsonValue): Promise<T> {
    return this.request("PUT", path, query, body);
  }

  delete<T = JsonValue>(path: string, query?: Query): Promise<T> {
    return this.request("DELETE", path, query);
  }

  memberMe(fields = "fullName,username,url,email") {
    return this.get("/members/me", { fields });
  }

  memberBoards(memberId = "me", query: Query = {}) {
    return this.get(`/members/${memberId}/boards`, query);
  }

  boardGet(id: string, query: Query = {}) {
    return this.get(`/boards/${id}`, query);
  }

  boardCreate(query: Query) {
    return this.post("/boards", query);
  }

  boardUpdate(id: string, query: Query) {
    return this.put(`/boards/${id}`, query);
  }

  /** Close (archive) a board — reversible in Trello UI. */
  boardArchive(id: string) {
    return this.put(`/boards/${id}/closed`, { value: true });
  }

  /** Permanently delete a board. Irreversible. */
  boardDelete(id: string) {
    return this.delete(`/boards/${id}`);
  }

  boardLists(id: string, query: Query = {}) {
    return this.get(`/boards/${id}/lists`, query);
  }

  boardCards(id: string, query: Query = {}) {
    return this.get(`/boards/${id}/cards`, query);
  }

  boardLabels(id: string, query: Query = {}) {
    return this.get(`/boards/${id}/labels`, query);
  }

  boardMembers(id: string, query: Query = {}) {
    return this.get(`/boards/${id}/members`, query);
  }

  boardActions(id: string, query: Query = {}) {
    return this.get(`/boards/${id}/actions`, query);
  }

  boardCustomFields(id: string) {
    return this.get(`/boards/${id}/customFields`);
  }

  listGet(id: string, query: Query = {}) {
    return this.get(`/lists/${id}`, query);
  }

  listCreate(query: Query) {
    return this.post("/lists", query);
  }

  listUpdate(id: string, query: Query) {
    return this.put(`/lists/${id}`, query);
  }

  listArchive(id: string) {
    return this.put(`/lists/${id}/closed`, { value: true });
  }

  listCards(id: string, query: Query = {}) {
    return this.get(`/lists/${id}/cards`, query);
  }

  cardGet(id: string, query: Query = {}) {
    return this.get(`/cards/${id}`, query);
  }

  cardBoard(id: string, query: Query = {}) {
    return this.get(`/cards/${id}/board`, query);
  }

  cardList(id: string, query: Query = {}) {
    return this.get(`/cards/${id}/list`, query);
  }

  cardCreate(query: Query) {
    return this.post("/cards", query);
  }

  cardUpdate(id: string, query: Query) {
    return this.put(`/cards/${id}`, query);
  }

  /** Close (archive) a card — reversible in Trello UI. */
  cardArchive(id: string) {
    return this.put(`/cards/${id}/closed`, { value: true });
  }

  /** Permanently delete a card. Irreversible. */
  cardDelete(id: string) {
    return this.delete(`/cards/${id}`);
  }

  cardComment(id: string, text: string) {
    return this.post(`/cards/${id}/actions/comments`, { text });
  }

  cardEditComment(id: string, commentId: string, text: string) {
    return this.put(`/cards/${id}/actions/${commentId}/comments`, { text });
  }

  /** Permanently delete a comment. Irreversible. */
  cardDeleteComment(id: string, commentId: string) {
    return this.delete(`/cards/${id}/actions/${commentId}/comments`);
  }

  cardMembers(id: string, query: Query = {}) {
    return this.get(`/cards/${id}/members`, query);
  }

  cardAddMember(id: string, memberId: string) {
    return this.post(`/cards/${id}/idMembers`, { value: memberId });
  }

  cardRemoveMember(id: string, memberId: string) {
    return this.delete(`/cards/${id}/idMembers/${memberId}`);
  }

  cardLabels(id: string) {
    return this.get(`/cards/${id}/labels`);
  }

  cardAddLabel(id: string, labelId: string) {
    return this.post(`/cards/${id}/idLabels`, { value: labelId });
  }

  cardRemoveLabel(id: string, labelId: string) {
    return this.delete(`/cards/${id}/idLabels/${labelId}`);
  }

  cardActions(id: string, query: Query = {}) {
    return this.get(`/cards/${id}/actions`, query);
  }

  cardComments(id: string, query: Query = {}) {
    return this.get(`/cards/${id}/actions`, {
      filter: "commentCard",
      ...query,
    });
  }

  cardAttachments(id: string, query: Query = {}) {
    return this.get(`/cards/${id}/attachments`, query);
  }

  cardChecklists(id: string) {
    return this.get(`/cards/${id}/checklists`);
  }

  cardAddAttachment(id: string, query: Query) {
    return this.post(`/cards/${id}/attachments`, query);
  }

  /** Upload a local file as a card attachment (multipart). */
  cardUploadAttachment(id: string, form: FormData) {
    return this.post(`/cards/${id}/attachments`, {}, form);
  }

  cardDeleteAttachment(id: string, attachmentId: string) {
    return this.delete(`/cards/${id}/attachments/${attachmentId}`);
  }

  cardCustomFieldItems(id: string) {
    return this.get(`/cards/${id}/customFieldItems`);
  }

  checklistGet(id: string, query: Query = {}) {
    return this.get(`/checklists/${id}`, query);
  }

  checklistCreate(query: Query) {
    return this.post("/checklists", query);
  }

  checklistUpdate(id: string, query: Query) {
    return this.put(`/checklists/${id}`, query);
  }

  checklistDelete(id: string) {
    return this.delete(`/checklists/${id}`);
  }

  checklistAddItem(id: string, query: Query) {
    return this.post(`/checklists/${id}/checkItems`, query);
  }

  async checklistUpdateItem(checklistId: string, itemId: string, query: Query) {
    // Trello has no checklist-scoped update route — check items update via the card route only
    const { idCard } = await this.get<{ idCard: string }>(
      `/checklists/${checklistId}`,
      {
        fields: "idCard",
      },
    );
    return this.put(`/cards/${idCard}/checkItem/${itemId}`, query);
  }

  checklistDeleteItem(checklistId: string, itemId: string) {
    return this.delete(`/checklists/${checklistId}/checkItems/${itemId}`);
  }

  labelGet(id: string, query: Query = {}) {
    return this.get(`/labels/${id}`, query);
  }

  labelCreate(query: Query) {
    return this.post("/labels", query);
  }

  labelUpdate(id: string, query: Query) {
    return this.put(`/labels/${id}`, query);
  }

  labelDelete(id: string) {
    return this.delete(`/labels/${id}`);
  }

  customFieldGet(id: string) {
    return this.get(`/customFields/${id}`);
  }

  customFieldCreate(query: Query) {
    return this.post("/customFields", query);
  }

  customFieldUpdate(id: string, query: Query) {
    return this.put(`/customFields/${id}`, query);
  }

  customFieldDelete(id: string) {
    return this.delete(`/customFields/${id}`);
  }

  customFieldUpdateItem(cardId: string, customFieldId: string, body: JsonValue) {
    // Trello has no customField-scoped item route — items update via the card route only
    return this.put(`/cards/${cardId}/customField/${customFieldId}/item`, {}, body);
  }

  actionGet(id: string, query: Query = {}) {
    return this.get(`/actions/${id}`, query);
  }

  search(query: string, opts: Query = {}) {
    return this.get("/search", { query, ...opts });
  }

  webhooksForToken() {
    return this.get("/tokens/me/webhooks");
  }

  webhookCreate(query: Query) {
    return this.post("/webhooks", query);
  }

  webhookGet(id: string) {
    return this.get(`/webhooks/${id}`);
  }

  webhookDelete(id: string) {
    return this.delete(`/webhooks/${id}`);
  }

  orgGet(id: string, query: Query = {}) {
    return this.get(`/organizations/${id}`, query);
  }

  orgBoards(id: string, query: Query = {}) {
    return this.get(`/organizations/${id}/boards`, query);
  }

  batch(urls: string[]) {
    return this.get("/batch", { urls: urls.join(",") });
  }
}

export function createClient(
  apiKey: string,
  token: string,
  requestOptions?: RequestOptions,
): TrelloClient {
  return new TrelloClient(apiKey, token, requestOptions);
}
