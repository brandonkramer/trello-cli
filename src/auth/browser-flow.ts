import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { openInBrowser } from "../util/runtime.ts";
import { type AuthScope, authLoginUrl } from "./profiles.ts";

export type BrowserAuthResult = {
  token: string;
  port: number;
  returnUrl: string;
};

export type BrowserAuthError = {
  error: string;
  port: number;
};

const DEFAULT_PORT = 14189;

function callbackCaptureHtml(state: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>trelly</title></head>
<body style="font-family: system-ui; max-width: 32rem; margin: 4rem auto; text-align: center;">
  <p id="status">Finishing authorization…</p>
  <script>
    (function () {
      var state = ${JSON.stringify(state)};
      var params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      var token = params.get("token");
      var error = params.get("error");
      var status = document.getElementById("status");

      function post(path, body) {
        return fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      if (error) {
        post("/callback/error", { error: error, state: state }).finally(function () {
          status.textContent = "Authorization denied: " + error;
        });
        return;
      }

      if (!token) {
        status.textContent = "No token in callback URL. Check allowed origins in trelly auth setup.";
        post("/callback/error", {
          error: "No token in callback fragment — add http://127.0.0.1:${DEFAULT_PORT} to allowed origins",
          state: state
        });
        return;
      }

      post("/callback/token", { token: token, state: state })
        .then(function (res) { return res.json(); })
        .then(function () {
          status.textContent = "Connected! Return to your terminal.";
        })
        .catch(function () {
          status.textContent = "Could not send token to trelly.";
        });
    })();
  </script>
</body>
</html>`;
}

export function browserAuthorizeUrl(
  apiKey: string,
  port: number,
  scope: AuthScope[] = ["read", "write"],
): string {
  return authLoginUrl(apiKey, {
    returnUrl: `http://127.0.0.1:${port}/callback`,
    scope,
    expiration: "30days",
  });
}

async function readJsonBody(
  req: import("node:http").IncomingMessage,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export async function captureTokenViaBrowser(
  apiKey: string,
  opts: {
    port?: number;
    timeoutMs?: number;
    openBrowser?: boolean;
    scope?: AuthScope[];
  } = {},
): Promise<BrowserAuthResult | BrowserAuthError> {
  const port = opts.port ?? DEFAULT_PORT;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const returnUrl = `http://127.0.0.1:${port}/callback`;
  const state = randomBytes(16).toString("hex");
  const authorizeUrl = browserAuthorizeUrl(apiKey, port, opts.scope);

  return new Promise((resolve) => {
    let settled = false;
    let httpServer: Server | undefined;

    const finish = (result: BrowserAuthResult | BrowserAuthError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      httpServer?.close();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        error: "Timed out waiting for browser authorization",
        port,
      });
    }, timeoutMs);

    httpServer = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

      if (url.pathname === "/callback" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(callbackCaptureHtml(state));
        return;
      }

      if (url.pathname === "/callback/token" && req.method === "POST") {
        try {
          const body = (await readJsonBody(req)) as { token?: string; state?: string };
          if (body.state !== state) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "invalid state" }));
            return;
          }
          if (!body.token) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false }));
            finish({ error: "Empty token in callback", port });
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          finish({ token: body.token, port, returnUrl });
        } catch {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
          finish({ error: "Failed to read callback token", port });
        }
        return;
      }

      if (url.pathname === "/callback/error" && req.method === "POST") {
        try {
          const body = (await readJsonBody(req)) as { error?: string; state?: string };
          if (body.state !== state) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
          finish({ error: body.error ?? "Authorization denied", port });
        } catch {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
          finish({ error: "Authorization failed", port });
        }
        return;
      }

      if (url.pathname === "/" || url.pathname === "/start") {
        res.writeHead(302, { Location: authorizeUrl });
        res.end();
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    });

    httpServer.listen(port, "127.0.0.1", () => {
      if (opts.openBrowser !== false) {
        openInBrowser(`http://127.0.0.1:${port}/start`).catch(() => {
          process.stderr.write(
            `Open this URL in your browser:\nhttp://127.0.0.1:${port}/start\n`,
          );
        });
      } else {
        process.stderr.write(
          `Open this URL in your browser:\nhttp://127.0.0.1:${port}/start\n`,
        );
      }
    });

    httpServer.on("error", (err) => {
      finish({
        error:
          err instanceof Error
            ? `Local callback server failed on port ${port}: ${err.message}`
            : `Local callback server failed on port ${port}`,
        port,
      });
    });
  });
}

export const SETUP_ALLOWED_ORIGIN = `http://127.0.0.1:${DEFAULT_PORT}`;
