import type { Command } from "commander";
import { createClient } from "../../api/client.ts";
import {
  captureTokenViaBrowser,
  SETUP_ALLOWED_ORIGIN,
} from "../../auth/browser-flow.ts";
import {
  type AuthScope,
  authLoginUrl,
  configPath,
  getAppApiKey,
  loadConfig,
  removeProfile,
  setAppApiKey,
  setDefaultProfile,
  upsertProfile,
} from "../../auth/profiles.ts";
import { openInBrowser, readLine } from "../../util/runtime.ts";
import { failure, printResult, success } from "../context.ts";

const POWER_UPS_ADMIN = "https://trello.com/power-ups/admin";

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage Trello credentials");

  auth
    .command("setup")
    .description("One-time app setup: save API key + allowed-origin instructions")
    .option("-k, --api-key <key>", "Trello API key to save")
    .option("--no-open", "Do not open Power-Ups admin in the browser")
    .action(async (opts, cmd) => {
      const root = cmd.parent?.parent as Command;
      try {
        if (opts.open !== false) {
          process.stderr.write(`Opening ${POWER_UPS_ADMIN}\n`);
          await openInBrowser(POWER_UPS_ADMIN).catch(() => {
            process.stderr.write(`Open manually: ${POWER_UPS_ADMIN}\n`);
          });
        }

        process.stderr.write(`
One-time setup (per Trello account / Power-Up):

1. Create or open a Power-Up → API Key tab → Generate API Key
   (Pick any workspace you admin — personal is fine. This does not
   limit which boards you can use. Never install the app on a board.)
2. Allowed Origins → add: ${SETUP_ALLOWED_ORIGIN}
   (required for automatic browser login)
3. Paste your API key below

`);

        let apiKey = opts.apiKey as string | undefined;
        if (!apiKey) {
          process.stderr.write("API key: ");
          apiKey = (await readLine()).trim();
        }

        if (!apiKey) {
          throw new Error("API key is required");
        }

        setAppApiKey(apiKey);
        printResult(
          success("default", {
            message: "Saved app API key for trello-cli",
            configPath: configPath(),
            allowedOrigin: SETUP_ALLOWED_ORIGIN,
            next: "Run: trello auth login",
          }),
          root.opts().pretty,
        );
      } catch (err) {
        printResult(
          failure(err instanceof Error ? err.message : String(err)),
          root.opts().pretty,
        );
        process.exitCode = 1;
      }
    });

  auth
    .command("login")
    .description("Authorize a profile via browser (default) or manual token paste")
    .option("-p, --profile <name>", "Profile name", "default")
    .option("-k, --api-key <key>", "Override app API key for this login")
    .option("-t, --token <token>", "Token (skips browser flow)")
    .option(
      "--manual",
      "Skip browser callback; paste token after opening authorize URL",
    )
    .option("--no-open", "Do not open a browser automatically")
    .option("--default", "Set as default profile")
    .option("--label <label>", "Human label for this profile")
    .option(
      "--full-access",
      "Request read,write,account scope and never-expiring token",
    )
    .action(async (opts, cmd) => {
      const root = cmd.parent?.parent as Command;
      try {
        let apiKey = (opts.apiKey as string | undefined) ?? getAppApiKey() ?? undefined;
        let token = opts.token as string | undefined;

        if (!apiKey) {
          process.stderr.write("No app API key saved. Running guided setup...\n\n");
          if (opts.open !== false) {
            await openInBrowser(POWER_UPS_ADMIN).catch(() => undefined);
          }
          process.stderr.write(
            `Create a Power-Up API key at ${POWER_UPS_ADMIN}\n` +
              `Add allowed origin: ${SETUP_ALLOWED_ORIGIN}\n` +
              "API key: ",
          );
          apiKey = (await readLine()).trim();
          if (!apiKey) throw new Error("API key is required");
          setAppApiKey(apiKey);
        }

        const authScope: AuthScope[] = opts.fullAccess
          ? ["read", "write", "account"]
          : ["read", "write"];
        const authExpiration = opts.fullAccess
          ? ("never" as const)
          : ("30days" as const);

        if (!token) {
          if (opts.manual) {
            const url = authLoginUrl(apiKey, {
              scope: authScope,
              expiration: authExpiration,
            });
            process.stderr.write(`Authorize in browser:\n${url}\n`);
            if (opts.open !== false) {
              await openInBrowser(url).catch(() => undefined);
            }
            process.stderr.write("Paste token: ");
            token = (await readLine()).trim();
          } else {
            process.stderr.write("Opening browser for Trello authorization...\n");
            const result = await captureTokenViaBrowser(apiKey, {
              openBrowser: opts.open !== false,
              scope: authScope,
            });
            if ("error" in result) {
              throw new Error(
                `${result.error}\n` +
                  `If redirect was blocked, run:\n` +
                  `  trello auth setup   # add ${SETUP_ALLOWED_ORIGIN} to allowed origins\n` +
                  `  trello auth login --manual`,
              );
            }
            token = result.token;
          }
        }

        if (!token) {
          throw new Error("Token is required");
        }

        upsertProfile(opts.profile, { apiKey, token, label: opts.label }, opts.default);

        const client = createClient(apiKey, token);
        const me = await client.memberMe("fullName,username,url");

        printResult(
          success(opts.profile, {
            message: `Saved profile "${opts.profile}"`,
            configPath: configPath(),
            member: me,
          }),
          root.opts().pretty,
        );
      } catch (err) {
        printResult(
          failure(err instanceof Error ? err.message : String(err)),
          root.opts().pretty,
        );
        process.exitCode = 1;
      }
    });

  auth
    .command("list")
    .description("List saved profiles")
    .action((_opts, cmd) => {
      const root = cmd.parent?.parent as Command;
      const config = loadConfig();
      printResult(
        success(config.defaultProfile, {
          defaultProfile: config.defaultProfile,
          hasAppApiKey: Boolean(config.appApiKey ?? process.env.TRELLO_APP_API_KEY),
          profiles: Object.entries(config.profiles).map(([name, p]) => ({
            name,
            label: p.label,
            isDefault: name === config.defaultProfile,
          })),
        }),
        root.opts().pretty,
      );
    });

  auth
    .command("use <profile>")
    .description("Set default profile")
    .action((profile, _opts, cmd) => {
      const root = cmd.parent?.parent as Command;
      try {
        setDefaultProfile(profile);
        printResult(
          success(profile, { message: `Default profile is now "${profile}"` }),
          root.opts().pretty,
        );
      } catch (err) {
        printResult(
          failure(err instanceof Error ? err.message : String(err)),
          root.opts().pretty,
        );
        process.exitCode = 1;
      }
    });

  auth
    .command("logout")
    .description("Remove a saved profile")
    .option("-p, --profile <name>", "Profile to remove")
    .action((opts, cmd) => {
      const root = cmd.parent?.parent as Command;
      const config = loadConfig();
      const profile = opts.profile ?? config.defaultProfile;
      try {
        removeProfile(profile);
        printResult(
          success(profile, { message: `Removed profile "${profile}"` }),
          root.opts().pretty,
        );
      } catch (err) {
        printResult(
          failure(err instanceof Error ? err.message : String(err)),
          root.opts().pretty,
        );
        process.exitCode = 1;
      }
    });

  auth
    .command("url")
    .description("Print browser authorization URL")
    .option("-k, --api-key <key>", "Trello API key")
    .action(async (opts, cmd) => {
      const root = cmd.parent?.parent as Command;
      let apiKey = (opts.apiKey as string | undefined) ?? getAppApiKey() ?? undefined;
      if (!apiKey) {
        process.stderr.write("API key: ");
        apiKey = (await readLine()).trim();
      }
      printResult(success("env", { url: authLoginUrl(apiKey) }), root.opts().pretty);
    });
}
