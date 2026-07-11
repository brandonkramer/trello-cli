import { spawn } from "node:child_process";
import {
  accessSync,
  constants,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type InstallKind =
  | "npm"
  | "bun"
  | "homebrew"
  | "source"
  | "ephemeral"
  | "unknown";

export type PluginHost = "cursor" | "claude" | "codex";

export type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; stdio?: "capture" | "inherit" },
) => Promise<CommandResult>;

export type CliUpdateStatus = {
  kind: InstallKind;
  root: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  canUpdate: boolean;
  blockedReason?: string;
};

export type PluginStatus = {
  host: PluginHost;
  installed: boolean;
  currentVersion?: string;
  targetVersion: string;
  updateAvailable: boolean;
  id?: string;
  scope?: string;
  path?: string;
  sourcePath?: string;
  blockedReason?: string;
  forceRefresh?: boolean;
};

export type UpdatePlan = {
  cli: CliUpdateStatus;
  plugins: PluginStatus[];
};

export type UpdateAction = {
  target: "cli" | PluginHost;
  status: "updated" | "current" | "skipped" | "blocked" | "failed";
  message: string;
};

export type UpdateReport = {
  before: UpdatePlan;
  actions: UpdateAction[];
  restart: string[];
};

export type UpdateDependencies = {
  packageRoot: string;
  home: string;
  run: CommandRunner;
  fetchLatestVersion: () => Promise<string>;
  hasExecutable: (command: string) => boolean;
};

type ClaudePlugin = {
  id?: unknown;
  version?: unknown;
  scope?: unknown;
  installPath?: unknown;
};

type CodexPlugin = {
  pluginId?: unknown;
  name?: unknown;
  marketplaceName?: unknown;
  version?: unknown;
  installed?: unknown;
  source?: { path?: unknown };
};

const REGISTRY_LATEST = "https://registry.npmjs.org/trelly/latest";

export function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export function classifyInstallation(packageRoot: string): InstallKind {
  const root = realpathOrSelf(packageRoot);
  if (existsSync(join(root, ".git"))) return "source";
  if (root.includes("/Cellar/trelly/") || root.includes("/homebrew/Cellar/trelly/")) {
    return "homebrew";
  }
  if (
    root.includes("/.npm/_npx/") ||
    root.includes("/_npx/") ||
    root.includes("/.bun/install/cache/")
  ) {
    return "ephemeral";
  }
  if (root.includes("/.bun/install/global/node_modules/trelly")) return "bun";
  if (root.includes("/lib/node_modules/trelly")) return "npm";
  return "unknown";
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) {
      return (a.parts[index] ?? 0) - (b.parts[index] ?? 0);
    }
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true });
}

export async function defaultFetchLatestVersion(): Promise<string> {
  const response = await fetch(REGISTRY_LATEST, {
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Registry version check failed with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { version?: unknown };
  if (typeof payload.version !== "string") {
    throw new Error("Registry response did not include a version");
  }
  return payload.version;
}

export async function defaultRunCommand(
  command: string,
  args: string[],
  options: { cwd?: string; stdio?: "capture" | "inherit" } = {},
): Promise<CommandResult> {
  return await new Promise((resolvePromise, reject) => {
    const inherit = options.stdio === "inherit";
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    if (!inherit) {
      child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
      child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    }
    child.on("error", reject);
    child.on("close", (code) =>
      resolvePromise({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
      }),
    );
  });
}

export function defaultUpdateDependencies(): UpdateDependencies {
  return {
    packageRoot: defaultPackageRoot(),
    home: homedir(),
    run: defaultRunCommand,
    fetchLatestVersion: defaultFetchLatestVersion,
    hasExecutable: (command) => Boolean(findExecutable(command)),
  };
}

export async function buildUpdatePlan(
  dependencies: UpdateDependencies = defaultUpdateDependencies(),
): Promise<UpdatePlan> {
  const currentVersion = readPackageVersion(dependencies.packageRoot);
  const latestVersion = await dependencies.fetchLatestVersion();
  const cli = await detectCliStatus(dependencies, currentVersion, latestVersion);
  const plugins = await detectPlugins(dependencies, latestVersion, cli.updateAvailable);
  return { cli, plugins };
}

export async function applyUpdatePlan(
  plan: UpdatePlan,
  options: { cliOnly?: boolean; pluginsOnly?: boolean },
  dependencies: UpdateDependencies = defaultUpdateDependencies(),
): Promise<UpdateReport> {
  const actions: UpdateAction[] = [];
  let cliReady = true;

  if (!options.pluginsOnly) {
    const cliAction = await updateCli(plan.cli, dependencies);
    actions.push(cliAction);
    cliReady = cliAction.status !== "failed" && cliAction.status !== "blocked";
  }

  if (!options.cliOnly) {
    if (!cliReady) {
      for (const plugin of plan.plugins.filter((item) => item.installed)) {
        actions.push({
          target: plugin.host,
          status: "skipped",
          message: "CLI update failed; plugin refresh was skipped",
        });
      }
    } else {
      for (const plugin of plan.plugins) {
        if (!plugin.installed) continue;
        const targetVersion =
          readPlatformPluginVersion(dependencies.packageRoot, plugin.host) ??
          plugin.targetVersion;
        actions.push(
          await updatePlugin(
            {
              ...plugin,
              targetVersion,
              updateAvailable:
                Boolean(options.pluginsOnly) ||
                plugin.updateAvailable ||
                actions.some(
                  (action) => action.target === "cli" && action.status === "updated",
                ),
              forceRefresh: Boolean(options.pluginsOnly),
            },
            dependencies,
          ),
        );
      }
    }
  }

  const restart: string[] = [];
  if (
    actions.some((action) => action.target === "cursor" && action.status === "updated")
  ) {
    restart.push("Reload Cursor with Developer: Reload Window");
  }
  if (
    actions.some((action) => action.target === "claude" && action.status === "updated")
  ) {
    restart.push("Restart Claude Code or run /reload-plugins");
  }
  if (
    actions.some((action) => action.target === "codex" && action.status === "updated")
  ) {
    restart.push("Start a new Codex thread");
  }

  return { before: plan, actions, restart };
}

export function hasUpdateFailures(report: UpdateReport): boolean {
  return report.actions.some(
    (action) => action.status === "failed" || action.status === "blocked",
  );
}

export function formatUpdatePlan(
  plan: UpdatePlan,
  options: { cliOnly?: boolean; pluginsOnly?: boolean } = {},
): string {
  const rows: Array<[string, string, string]> = [];
  const cliStatus = plan.cli.blockedReason
    ? `blocked: ${plan.cli.blockedReason}`
    : plan.cli.updateAvailable
      ? "update available"
      : "current";
  if (!options.pluginsOnly) {
    rows.push([
      "CLI",
      `${plan.cli.currentVersion} → ${plan.cli.latestVersion}`,
      `${cliStatus} (${plan.cli.kind})`,
    ]);
  }
  if (!options.cliOnly) {
    for (const plugin of plan.plugins) {
      rows.push([
        capitalize(plugin.host),
        plugin.installed
          ? `${plugin.currentVersion ?? "unknown"} → ${plugin.targetVersion}`
          : "not installed",
        !plugin.installed
          ? "skipped"
          : plugin.blockedReason
            ? `blocked: ${plugin.blockedReason}`
            : plugin.updateAvailable
              ? "update available"
              : "current",
      ]);
    }
  }
  return formatRows(rows);
}

export function formatUpdateReport(report: UpdateReport): string {
  const rows = report.actions.map((action): [string, string, string] => [
    action.target === "cli" ? "CLI" : capitalize(action.target),
    action.status,
    action.message,
  ]);
  const sections = [formatRows(rows)];
  if (report.restart.length > 0) {
    sections.push(`Next:\n${report.restart.map((item) => `- ${item}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

async function detectCliStatus(
  dependencies: UpdateDependencies,
  currentVersion: string,
  latestVersion: string,
): Promise<CliUpdateStatus> {
  const kind = classifyInstallation(dependencies.packageRoot);
  const status: CliUpdateStatus = {
    kind,
    root: realpathOrSelf(dependencies.packageRoot),
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(currentVersion, latestVersion) < 0,
    canUpdate: ["npm", "bun", "homebrew", "source"].includes(kind),
  };

  if (kind === "source") {
    const dirty = await dependencies.run("git", ["status", "--porcelain"], {
      cwd: dependencies.packageRoot,
    });
    if (dirty.code !== 0) {
      status.canUpdate = false;
      status.blockedReason = commandError(dirty, "could not inspect Git worktree");
      return status;
    }
    if (dirty.stdout) {
      status.canUpdate = false;
      status.blockedReason = "source checkout has uncommitted changes";
      return status;
    }
    const remote = await dependencies.run("git", ["ls-remote", "origin", "HEAD"], {
      cwd: dependencies.packageRoot,
    });
    const head = await dependencies.run("git", ["rev-parse", "HEAD"], {
      cwd: dependencies.packageRoot,
    });
    if (remote.code !== 0 || head.code !== 0) {
      status.canUpdate = false;
      status.blockedReason = commandError(remote, "could not check origin/HEAD");
      return status;
    }
    const remoteSha = remote.stdout.split(/\s+/)[0];
    if (remoteSha && remoteSha !== head.stdout.trim()) {
      const remoteIsAncestor = await dependencies.run(
        "git",
        ["merge-base", "--is-ancestor", remoteSha, "HEAD"],
        { cwd: dependencies.packageRoot },
      );
      status.updateAvailable = remoteIsAncestor.code !== 0;
    } else {
      status.updateAvailable = false;
    }
    status.latestVersion = status.updateAvailable ? "origin/HEAD" : currentVersion;
  } else if (kind === "ephemeral") {
    status.canUpdate = false;
    status.blockedReason = "npx/bunx installs are ephemeral; rerun the launcher";
  } else if (kind === "unknown") {
    status.canUpdate = false;
    status.blockedReason = "installation method could not be determined";
  }

  return status;
}

async function detectPlugins(
  dependencies: UpdateDependencies,
  latestPackageVersion: string,
  cliUpdateAvailable: boolean,
): Promise<PluginStatus[]> {
  const targetVersion = (host: PluginHost): string =>
    cliUpdateAvailable
      ? latestPackageVersion
      : (readPlatformPluginVersion(dependencies.packageRoot, host) ??
        latestPackageVersion);
  return [
    detectCursorPlugin(dependencies, targetVersion("cursor")),
    await detectClaudePlugin(dependencies, targetVersion("claude")),
    await detectCodexPlugin(dependencies, targetVersion("codex")),
  ];
}

function detectCursorPlugin(
  dependencies: UpdateDependencies,
  targetVersion: string,
): PluginStatus {
  const path = join(dependencies.home, ".cursor", "plugins", "local", "trelly");
  const installed = existsSync(path);
  const currentVersion = installed
    ? readPluginVersion(path, ".cursor-plugin")
    : undefined;
  return {
    host: "cursor",
    installed,
    currentVersion,
    targetVersion,
    updateAvailable: installed && currentVersion !== targetVersion,
    path,
  };
}

async function detectClaudePlugin(
  dependencies: UpdateDependencies,
  targetVersion: string,
): Promise<PluginStatus> {
  if (!dependencies.hasExecutable("claude")) {
    return missingPlugin("claude", targetVersion);
  }
  const result = await dependencies.run("claude", ["plugin", "list", "--json"]);
  if (result.code !== 0) {
    return missingPlugin(
      "claude",
      targetVersion,
      commandError(result, "could not list Claude plugins"),
    );
  }
  let plugins: ClaudePlugin[];
  try {
    plugins = parseJson<ClaudePlugin[]>(result.stdout, "Claude plugin list");
  } catch (error) {
    return missingPlugin(
      "claude",
      targetVersion,
      error instanceof Error ? error.message : String(error),
    );
  }
  const plugin = plugins.find(
    (item) => typeof item.id === "string" && item.id.startsWith("trelly@"),
  );
  if (!plugin) return missingPlugin("claude", targetVersion);
  const currentVersion = stringValue(plugin.version);
  return {
    host: "claude",
    installed: true,
    currentVersion,
    targetVersion,
    updateAvailable: currentVersion !== targetVersion,
    id: stringValue(plugin.id),
    scope: stringValue(plugin.scope) ?? "user",
    path: stringValue(plugin.installPath),
  };
}

async function detectCodexPlugin(
  dependencies: UpdateDependencies,
  targetVersion: string,
): Promise<PluginStatus> {
  if (!dependencies.hasExecutable("codex")) {
    return missingPlugin("codex", targetVersion);
  }
  const result = await dependencies.run("codex", ["plugin", "list", "--json"]);
  if (result.code !== 0) {
    return missingPlugin(
      "codex",
      targetVersion,
      commandError(result, "could not list Codex plugins"),
    );
  }
  let payload: { installed?: CodexPlugin[] };
  try {
    payload = parseJson<{ installed?: CodexPlugin[] }>(
      result.stdout,
      "Codex plugin list",
    );
  } catch (error) {
    return missingPlugin(
      "codex",
      targetVersion,
      error instanceof Error ? error.message : String(error),
    );
  }
  const plugin = payload.installed?.find(
    (item) => item.name === "trelly" && item.installed !== false,
  );
  if (!plugin) return missingPlugin("codex", targetVersion);
  const currentVersion = stringValue(plugin.version);
  const marketplace = stringValue(plugin.marketplaceName);
  return {
    host: "codex",
    installed: true,
    currentVersion,
    targetVersion,
    updateAvailable: currentVersion !== targetVersion,
    id:
      stringValue(plugin.pluginId) ??
      (marketplace ? `trelly@${marketplace}` : undefined),
    sourcePath: stringValue(plugin.source?.path),
  };
}

async function updateCli(
  status: CliUpdateStatus,
  dependencies: UpdateDependencies,
): Promise<UpdateAction> {
  if (status.blockedReason) {
    return { target: "cli", status: "blocked", message: status.blockedReason };
  }
  if (!status.updateAvailable) {
    return { target: "cli", status: "current", message: status.currentVersion };
  }
  if (!status.canUpdate) {
    return {
      target: "cli",
      status: "blocked",
      message: status.blockedReason ?? "installation cannot be updated automatically",
    };
  }

  const command = cliUpdateCommand(status.kind);
  if (!command) {
    return { target: "cli", status: "blocked", message: "unsupported installation" };
  }
  process.stderr.write(
    `Updating CLI with ${command.command} ${command.args.join(" ")}\n`,
  );
  let result: CommandResult;
  try {
    result = await dependencies.run(command.command, command.args, {
      cwd: status.kind === "source" ? dependencies.packageRoot : undefined,
      stdio: "inherit",
    });
  } catch (error) {
    return {
      target: "cli",
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (result.code !== 0) {
    return {
      target: "cli",
      status: "failed",
      message: commandError(result, `${command.command} exited with ${result.code}`),
    };
  }
  if (status.kind === "source") {
    const install = await dependencies.run("bun", ["install", "--frozen-lockfile"], {
      cwd: dependencies.packageRoot,
      stdio: "inherit",
    });
    if (install.code !== 0) {
      return {
        target: "cli",
        status: "failed",
        message: commandError(install, "dependency install failed"),
      };
    }
  }
  return {
    target: "cli",
    status: "updated",
    message: `${status.currentVersion} → ${status.latestVersion}`,
  };
}

async function updatePlugin(
  plugin: PluginStatus,
  dependencies: UpdateDependencies,
): Promise<UpdateAction> {
  if (plugin.blockedReason) {
    return { target: plugin.host, status: "blocked", message: plugin.blockedReason };
  }
  if (!plugin.updateAvailable) {
    return {
      target: plugin.host,
      status: "current",
      message: plugin.currentVersion ?? "installed",
    };
  }

  try {
    if (plugin.host === "cursor") {
      if (!plugin.path) throw new Error("Cursor plugin path is missing");
      atomicCopy(dependencies.packageRoot, plugin.path);
    } else if (plugin.host === "claude") {
      if (!plugin.id) throw new Error("Claude plugin identifier is missing");
      if (plugin.forceRefresh) {
        const uninstall = await dependencies.run(
          "claude",
          [
            "plugin",
            "uninstall",
            plugin.id,
            "--scope",
            plugin.scope ?? "user",
            "--keep-data",
          ],
          { stdio: "inherit" },
        );
        if (uninstall.code !== 0)
          throw new Error(`Claude uninstall exited with ${uninstall.code}`);
        const install = await dependencies.run(
          "claude",
          ["plugin", "install", plugin.id, "--scope", plugin.scope ?? "user"],
          { stdio: "inherit" },
        );
        if (install.code !== 0)
          throw new Error(`Claude install exited with ${install.code}`);
      } else {
        const result = await dependencies.run(
          "claude",
          ["plugin", "update", plugin.id, "--scope", plugin.scope ?? "user"],
          { stdio: "inherit" },
        );
        if (result.code !== 0)
          throw new Error(`Claude update exited with ${result.code}`);
      }
    } else {
      if (!plugin.id) throw new Error("Codex plugin identifier is missing");
      const sourceIssue = await prepareCodexSource(plugin, dependencies);
      if (sourceIssue) {
        return { target: "codex", status: "blocked", message: sourceIssue };
      }
      if (plugin.forceRefresh) {
        const remove = await dependencies.run(
          "codex",
          ["plugin", "remove", plugin.id],
          {
            stdio: "inherit",
          },
        );
        if (remove.code !== 0)
          throw new Error(`Codex remove exited with ${remove.code}`);
      }
      const result = await dependencies.run("codex", ["plugin", "add", plugin.id], {
        stdio: "inherit",
      });
      if (result.code !== 0) throw new Error(`Codex update exited with ${result.code}`);
    }
    return {
      target: plugin.host,
      status: "updated",
      message: `${plugin.currentVersion ?? "unknown"} → ${plugin.targetVersion}`,
    };
  } catch (error) {
    return {
      target: plugin.host,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function prepareCodexSource(
  plugin: PluginStatus,
  dependencies: UpdateDependencies,
): Promise<string | undefined> {
  if (!plugin.sourcePath) return undefined;
  const source = realpathOrSelf(plugin.sourcePath);
  if (source === realpathOrSelf(dependencies.packageRoot)) return undefined;
  if (!existsSync(join(source, ".git"))) {
    return "Codex plugin source is not the active package or a Git checkout";
  }
  const dirty = await dependencies.run("git", ["status", "--porcelain"], {
    cwd: source,
  });
  if (dirty.code !== 0) return commandError(dirty, "could not inspect Codex source");
  if (dirty.stdout) return "Codex plugin source has uncommitted changes";
  const pull = await dependencies.run("git", ["pull", "--ff-only", "origin", "main"], {
    cwd: source,
    stdio: "inherit",
  });
  if (pull.code !== 0) return "Codex plugin source could not fast-forward";
  const install = await dependencies.run("bun", ["install", "--frozen-lockfile"], {
    cwd: source,
    stdio: "inherit",
  });
  return install.code === 0 ? undefined : "Codex plugin dependencies failed to install";
}

function cliUpdateCommand(
  kind: InstallKind,
): { command: string; args: string[] } | undefined {
  if (kind === "npm")
    return { command: "npm", args: ["install", "-g", "trelly@latest"] };
  if (kind === "bun")
    return { command: "bun", args: ["add", "--global", "trelly@latest"] };
  if (kind === "homebrew") return { command: "brew", args: ["upgrade", "trelly"] };
  if (kind === "source")
    return { command: "git", args: ["pull", "--ff-only", "origin", "main"] };
  return undefined;
}

export function atomicCopy(source: string, destination: string): void {
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const temporary = join(parent, `.${basename(destination)}.update-${process.pid}`);
  const backup = join(parent, `.${basename(destination)}.backup-${process.pid}`);
  rmSync(temporary, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });
  cpSync(source, temporary, {
    recursive: true,
    filter: (path) => basename(path) !== ".git",
  });
  if (existsSync(destination)) renameSync(destination, backup);
  try {
    renameSync(temporary, destination);
    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(backup) && !existsSync(destination)) renameSync(backup, destination);
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function readPackageVersion(root: string): string {
  const payload = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    version?: unknown;
  };
  if (typeof payload.version !== "string")
    throw new Error("package.json has no version");
  return payload.version;
}

function readPluginVersion(
  root: string,
  manifestDirectory: string,
): string | undefined {
  try {
    const payload = JSON.parse(
      readFileSync(join(root, manifestDirectory, "plugin.json"), "utf8"),
    ) as { version?: unknown };
    return stringValue(payload.version);
  } catch {
    return undefined;
  }
}

function readPlatformPluginVersion(root: string, host: PluginHost): string | undefined {
  const directory =
    host === "cursor"
      ? ".cursor-plugin"
      : host === "claude"
        ? ".claude-plugin"
        : ".codex-plugin";
  return readPluginVersion(root, directory);
}

function missingPlugin(
  host: PluginHost,
  targetVersion: string,
  blockedReason?: string,
): PluginStatus {
  return {
    host,
    installed: false,
    targetVersion,
    updateAvailable: false,
    blockedReason,
  };
}

function parseVersion(version: string): { parts: number[]; prerelease: string } {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?/.exec(version);
  if (!match) throw new Error(`Invalid semantic version: ${version}`);
  return {
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? "",
  };
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function commandError(result: CommandResult, fallback: string): string {
  return result.stderr || result.stdout || fallback;
}

function realpathOrSelf(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function findExecutable(command: string): string | undefined {
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (!directory) continue;
    const candidate = join(directory, command);
    try {
      if (!lstatSync(candidate).isDirectory()) {
        accessSync(candidate, constants.X_OK);
        return candidate;
      }
    } catch {
      // Keep looking.
    }
  }
  return undefined;
}

function capitalize(value: string): string {
  return value[0]?.toUpperCase() + value.slice(1);
}

function formatRows(rows: Array<[string, string, string]>): string {
  const first = Math.max(...rows.map((row) => row[0].length));
  const second = Math.max(...rows.map((row) => row[1].length));
  return rows
    .map(
      ([name, version, status]) =>
        `${name.padEnd(first)}  ${version.padEnd(second)}  ${status}`,
    )
    .join("\n");
}
