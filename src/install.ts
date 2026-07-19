import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  atomicCopy,
  type CommandResult,
  type CommandRunner,
  defaultPackageRoot,
  defaultRunCommand,
  type PluginHost,
} from "./update.ts";
import { findExecutable, isExecutableFile } from "./util/exec-path.ts";

export type InstallStatus = {
  host: PluginHost;
  available: boolean;
  installed: boolean;
  valid: boolean;
  currentVersion?: string;
  targetVersion: string;
  id?: string;
  scope?: string;
  path?: string;
  issue?: string;
  blockedReason?: string;
  warnings?: string[];
};

export type InstallPlan = {
  packageRoot: string;
  version: string;
  plugins: InstallStatus[];
};

export type InstallAction = {
  host: PluginHost;
  status:
    | "installed"
    | "repaired"
    | "current"
    | "skipped"
    | "unavailable"
    | "blocked"
    | "failed";
  message: string;
};

export type InstallReport = {
  version: string;
  actions: InstallAction[];
  restart: string[];
  warnings: Array<{ host: PluginHost; message: string }>;
};

export type InstallDependencies = {
  packageRoot: string;
  home: string;
  run: CommandRunner;
  hasExecutable: (command: string) => boolean;
  platform: NodeJS.Platform;
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

const HOSTS: PluginHost[] = ["cursor", "claude", "codex"];

export function defaultInstallDependencies(): InstallDependencies {
  return {
    packageRoot: defaultPackageRoot(),
    home: homedir(),
    run: defaultRunCommand,
    hasExecutable: (command) => Boolean(findExecutable(command)),
    platform: process.platform,
  };
}

export async function buildInstallPlan(
  dependencies: InstallDependencies = defaultInstallDependencies(),
): Promise<InstallPlan> {
  const version = readPackageVersion(dependencies.packageRoot);
  const [claude, codex] = await Promise.all([
    detectClaude(dependencies, version),
    detectCodex(dependencies, version),
  ]);
  return {
    packageRoot: realpathOrSelf(dependencies.packageRoot),
    version,
    plugins: [detectCursor(dependencies, version), claude, codex],
  };
}

export async function applyInstallPlan(
  plan: InstallPlan,
  selectedHosts: PluginHost[],
  options: { force?: boolean } = {},
  dependencies: InstallDependencies = defaultInstallDependencies(),
): Promise<InstallReport> {
  const actions: InstallAction[] = [];

  for (const host of selectedHosts) {
    const plugin = plan.plugins.find((item) => item.host === host);
    if (!plugin) {
      actions.push({ host, status: "unavailable", message: "host was not detected" });
      continue;
    }
    if (!plugin.available) {
      actions.push({
        host,
        status: "unavailable",
        message: plugin.blockedReason ?? `${hostLabel(host)} is not installed`,
      });
      continue;
    }
    if (plugin.blockedReason) {
      actions.push({ host, status: "blocked", message: plugin.blockedReason });
      continue;
    }
    if (!options.force && isCurrent(plugin)) {
      actions.push({ host, status: "current", message: plugin.targetVersion });
      continue;
    }

    try {
      const issue = validateBundle(
        dependencies.packageRoot,
        host,
        plugin.targetVersion,
      );
      if (issue) throw new Error(`packaged ${hostLabel(host)} plugin: ${issue}`);
      if (host === "cursor") await installCursor(plugin, dependencies);
      else if (host === "claude") await installClaude(plugin, dependencies);
      else await installCodex(plugin, dependencies);
      actions.push({
        host,
        status: plugin.installed ? "repaired" : "installed",
        message: plan.version,
      });
    } catch (error) {
      actions.push({
        host,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    version: plan.version,
    actions,
    restart: restartInstructions(actions),
    warnings: selectedHosts.flatMap((host) => {
      const plugin = plan.plugins.find((item) => item.host === host);
      return (plugin?.warnings ?? []).map((message) => ({ host, message }));
    }),
  };
}

export function availableHosts(plan: InstallPlan): PluginHost[] {
  return plan.plugins.filter((plugin) => plugin.available).map((plugin) => plugin.host);
}

export function formatInstallPlan(
  plan: InstallPlan,
  selectedHosts: PluginHost[] = HOSTS,
): string {
  const rows = plan.plugins
    .filter((plugin) => selectedHosts.includes(plugin.host))
    .map((plugin): [string, string, string] => {
      if (!plugin.available) {
        return [
          hostLabel(plugin.host),
          "unavailable",
          plugin.blockedReason ?? "not found",
        ];
      }
      if (!plugin.installed) return [hostLabel(plugin.host), "not installed", "ready"];
      if (!plugin.valid) {
        return [
          hostLabel(plugin.host),
          plugin.currentVersion ?? "unknown",
          `repair needed: ${plugin.issue ?? "invalid plugin"}`,
        ];
      }
      if (plugin.currentVersion !== plugin.targetVersion) {
        return [
          hostLabel(plugin.host),
          `${plugin.currentVersion ?? "unknown"} → ${plugin.targetVersion}`,
          "update needed",
        ];
      }
      return [hostLabel(plugin.host), plugin.targetVersion, "current"];
    });
  const warnings = plan.plugins
    .filter((plugin) => selectedHosts.includes(plugin.host))
    .flatMap((plugin) =>
      (plugin.warnings ?? []).map(
        (warning) => `- ${hostLabel(plugin.host)}: ${warning}`,
      ),
    );
  return [
    formatRows(rows),
    warnings.length > 0 ? `Warnings:\n${warnings.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatInstallReport(report: InstallReport): string {
  const rows = report.actions.map((action): [string, string, string] => [
    hostLabel(action.host),
    action.status,
    action.message,
  ]);
  const sections = [formatRows(rows)];
  if (report.restart.length > 0) {
    sections.push(`Next:\n${report.restart.map((item) => `- ${item}`).join("\n")}`);
  }
  if (report.warnings.length > 0) {
    sections.push(
      `Warnings:\n${report.warnings
        .map((warning) => `- ${hostLabel(warning.host)}: ${warning.message}`)
        .join("\n")}`,
    );
  }
  return sections.join("\n\n");
}

export function hasInstallFailures(report: InstallReport): boolean {
  return report.actions.some((action) =>
    ["unavailable", "blocked", "failed"].includes(action.status),
  );
}

function detectCursor(
  dependencies: InstallDependencies,
  targetVersion: string,
): InstallStatus {
  const path = join(dependencies.home, ".cursor", "plugins", "local", "trelly");
  const installed = existsSync(path);
  const available =
    dependencies.hasExecutable("cursor") ||
    dependencies.hasExecutable("agent") ||
    dependencies.hasExecutable("cursor-agent") ||
    existsSync(join(dependencies.home, ".cursor")) ||
    (dependencies.platform === "darwin" &&
      (existsSync("/Applications/Cursor.app") ||
        existsSync(join(dependencies.home, "Applications", "Cursor.app")))) ||
    (dependencies.platform === "win32" &&
      (existsSync(
        join(
          process.env.LOCALAPPDATA ?? join(dependencies.home, "AppData", "Local"),
          "Programs",
          "cursor",
          "Cursor.exe",
        ),
      ) ||
        existsSync(
          join(
            process.env.LOCALAPPDATA ?? join(dependencies.home, "AppData", "Local"),
            "Programs",
            "Cursor",
            "Cursor.exe",
          ),
        )));
  const issue = installed ? validateBundle(path, "cursor") : undefined;
  return {
    host: "cursor",
    available,
    installed,
    valid: installed && !issue,
    currentVersion: installed ? readPluginVersion(path, ".cursor-plugin") : undefined,
    targetVersion,
    path,
    issue,
    warnings: standaloneMcpWarnings(dependencies, "cursor"),
  };
}

async function detectClaude(
  dependencies: InstallDependencies,
  targetVersion: string,
): Promise<InstallStatus> {
  if (!dependencies.hasExecutable("claude")) {
    return unavailable("claude", targetVersion, "Claude Code executable not found");
  }
  const result = await dependencies.run("claude", ["plugin", "list", "--json"]);
  if (result.code !== 0) {
    return unavailable(
      "claude",
      targetVersion,
      commandError(result, "could not list Claude plugins"),
      true,
    );
  }
  let plugins: ClaudePlugin[];
  try {
    plugins = parseJson<ClaudePlugin[]>(result.stdout, "Claude plugin list");
  } catch (error) {
    return unavailable("claude", targetVersion, errorMessage(error), true);
  }
  const plugin = plugins.find(
    (item) => typeof item.id === "string" && item.id.startsWith("trelly@"),
  );
  if (!plugin) {
    return {
      ...fresh("claude", targetVersion),
      warnings: standaloneMcpWarnings(dependencies, "claude"),
    };
  }
  const path = stringValue(plugin.installPath);
  const issue = path ? validateBundle(path, "claude") : "install path is missing";
  return {
    host: "claude",
    available: true,
    installed: true,
    valid: !issue,
    currentVersion: stringValue(plugin.version),
    targetVersion,
    id: stringValue(plugin.id),
    scope: stringValue(plugin.scope) ?? "user",
    path,
    issue,
    warnings: standaloneMcpWarnings(dependencies, "claude"),
  };
}

async function detectCodex(
  dependencies: InstallDependencies,
  targetVersion: string,
): Promise<InstallStatus> {
  if (!dependencies.hasExecutable("codex")) {
    return unavailable("codex", targetVersion, "Codex executable not found");
  }
  const result = await dependencies.run("codex", ["plugin", "list", "--json"]);
  if (result.code !== 0) {
    return unavailable(
      "codex",
      targetVersion,
      commandError(result, "could not list Codex plugins"),
      true,
    );
  }
  let payload: { installed?: CodexPlugin[] };
  try {
    payload = parseJson<{ installed?: CodexPlugin[] }>(
      result.stdout,
      "Codex plugin list",
    );
  } catch (error) {
    return unavailable("codex", targetVersion, errorMessage(error), true);
  }
  const plugin = payload.installed?.find(
    (item) => item.name === "trelly" && item.installed !== false,
  );
  if (!plugin) {
    return {
      ...fresh("codex", targetVersion),
      warnings: standaloneMcpWarnings(dependencies, "codex"),
    };
  }
  const path = stringValue(plugin.source?.path);
  const issue = path ? validateBundle(path, "codex") : "plugin source is missing";
  const marketplace = stringValue(plugin.marketplaceName);
  return {
    host: "codex",
    available: true,
    installed: true,
    valid: !issue,
    currentVersion: stringValue(plugin.version),
    targetVersion,
    id:
      stringValue(plugin.pluginId) ??
      (marketplace ? `trelly@${marketplace}` : undefined),
    path,
    issue,
    warnings: standaloneMcpWarnings(dependencies, "codex"),
  };
}

async function installCursor(
  plugin: InstallStatus,
  dependencies: InstallDependencies,
): Promise<void> {
  if (!plugin.path) throw new Error("Cursor plugin destination is missing");
  atomicCopy(dependencies.packageRoot, plugin.path);
  const issue = validateBundle(plugin.path, "cursor", plugin.targetVersion);
  if (issue) throw new Error(`Cursor verification failed: ${issue}`);
}

async function installClaude(
  plugin: InstallStatus,
  dependencies: InstallDependencies,
): Promise<void> {
  const marketplaceRoot = join(dependencies.home, ".claude", "trelly-marketplace");
  const pluginLink = join(marketplaceRoot, "trelly");
  writeClaudeMarketplace(marketplaceRoot);
  replaceLink(pluginLink, dependencies.packageRoot);

  const marketplace = await dependencies.run("claude", [
    "plugin",
    "marketplace",
    "add",
    marketplaceRoot,
    "--scope",
    "user",
  ]);
  if (marketplace.code !== 0 && !alreadyConfigured(marketplace)) {
    throw new Error(commandError(marketplace, "could not add Claude marketplace"));
  }
  if (plugin.installed && plugin.id) {
    const uninstall = await dependencies.run("claude", [
      "plugin",
      "uninstall",
      plugin.id,
      "--scope",
      plugin.scope ?? "user",
      "--keep-data",
    ]);
    if (uninstall.code !== 0) {
      throw new Error(
        commandError(uninstall, "could not remove existing Claude plugin"),
      );
    }
  }
  const install = await dependencies.run("claude", [
    "plugin",
    "install",
    "trelly@trelly-local",
    "--scope",
    "user",
  ]);
  if (install.code !== 0) {
    throw new Error(commandError(install, "could not install Claude plugin"));
  }
  const verified = await dependencies.run("claude", ["plugin", "list", "--json"]);
  if (verified.code !== 0 || !hasClaudePlugin(verified.stdout, plugin.targetVersion)) {
    throw new Error(commandError(verified, "Claude plugin verification failed"));
  }
}

async function installCodex(
  plugin: InstallStatus,
  dependencies: InstallDependencies,
): Promise<void> {
  const marketplaceFile = join(
    dependencies.home,
    ".agents",
    "plugins",
    "marketplace.json",
  );
  const marketplaceName = writeCodexMarketplace(marketplaceFile);
  replaceLink(
    join(dependencies.home, ".agents", "plugins", "trelly-managed"),
    dependencies.packageRoot,
  );

  const marketplace = await dependencies.run("codex", [
    "plugin",
    "marketplace",
    "add",
    dependencies.home,
    "--json",
  ]);
  if (marketplace.code !== 0 && !alreadyConfigured(marketplace)) {
    throw new Error(commandError(marketplace, "could not add Codex marketplace"));
  }
  if (plugin.installed && plugin.id) {
    const remove = await dependencies.run("codex", ["plugin", "remove", plugin.id]);
    if (remove.code !== 0) {
      throw new Error(commandError(remove, "could not remove existing Codex plugin"));
    }
  }
  const install = await dependencies.run("codex", [
    "plugin",
    "add",
    `trelly@${marketplaceName}`,
    "--json",
  ]);
  if (install.code !== 0) {
    throw new Error(commandError(install, "could not install Codex plugin"));
  }
  const verified = await dependencies.run("codex", ["plugin", "list", "--json"]);
  if (verified.code !== 0 || !hasCodexPlugin(verified.stdout, plugin.targetVersion)) {
    throw new Error(commandError(verified, "Codex plugin verification failed"));
  }
}

function writeClaudeMarketplace(root: string): void {
  const path = join(root, ".claude-plugin", "marketplace.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        name: "trelly-local",
        owner: { name: "brandonkramer" },
        metadata: { description: "Local Trelly plugin managed by trelly install" },
        plugins: [
          {
            name: "trelly",
            description: "Trello CLI and MCP tools",
            source: "./trelly",
            category: "productivity",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

function writeCodexMarketplace(path: string): string {
  const existing = readObject(path);
  const marketplaceName = stringValue(existing.name) ?? "local-trelly";
  const plugins = Array.isArray(existing.plugins)
    ? existing.plugins.filter(
        (plugin) => !isObject(plugin) || stringValue(plugin.name) !== "trelly",
      )
    : [];
  plugins.push({
    name: "trelly",
    source: { source: "local", path: "./.agents/plugins/trelly-managed" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Productivity",
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        ...existing,
        name: marketplaceName,
        interface: isObject(existing.interface)
          ? existing.interface
          : { displayName: "Local plugins" },
        plugins,
      },
      null,
      2,
    )}\n`,
  );
  return marketplaceName;
}

function validateBundle(
  root: string,
  host: PluginHost,
  expectedVersion?: string,
): string | undefined {
  const manifestDirectory =
    host === "cursor"
      ? ".cursor-plugin"
      : host === "claude"
        ? ".claude-plugin"
        : ".codex-plugin";
  const manifestPath = join(root, manifestDirectory, "plugin.json");
  if (!existsSync(manifestPath)) return `${manifestDirectory}/plugin.json is missing`;
  let manifest: Record<string, unknown>;
  try {
    manifest = parseJson<Record<string, unknown>>(
      readFileSync(manifestPath, "utf8"),
      `${hostLabel(host)} manifest`,
    );
  } catch (error) {
    return errorMessage(error);
  }
  if (manifest.name !== "trelly") return "manifest name is not trelly";
  if (typeof manifest.version !== "string") return "manifest version is missing";
  if (expectedVersion && manifest.version !== expectedVersion) {
    return `manifest version ${manifest.version} does not match ${expectedVersion}`;
  }
  if (!existsSync(join(root, "skills", "trelly", "SKILL.md"))) {
    return "trelly skill is missing";
  }
  if (!existsSync(join(root, "skills", "trelly-mcp", "SKILL.md"))) {
    return "trelly-mcp skill is missing";
  }
  const executable = join(root, "bin", "trelly-mcp");
  if (!isExecutableFile(executable)) {
    return "bin/trelly-mcp is missing or not executable";
  }

  if (host === "cursor") {
    if (!existsSync(join(root, "bin", "launch-cursor-mcp.mjs"))) {
      return "bin/launch-cursor-mcp.mjs is missing";
    }
    if (manifest.mcpServers !== "mcp.json") {
      return "manifest must reference root mcp.json";
    }
    const mcpPath = join(root, "mcp.json");
    if (!existsSync(mcpPath)) return "root mcp.json is missing";
    try {
      const mcp = parseJson<Record<string, unknown>>(
        readFileSync(mcpPath, "utf8"),
        "Cursor MCP config",
      );
      if (!isObject(mcp.mcpServers) || !isObject(mcp.mcpServers.trelly)) {
        return "root mcp.json has no trelly server";
      }
    } catch (error) {
      return errorMessage(error);
    }
  } else if (!isObject(manifest.mcpServers) || !isObject(manifest.mcpServers.trelly)) {
    return "manifest has no inline trelly MCP server";
  }
  return undefined;
}

function replaceLink(path: string, target: string): void {
  mkdirSync(dirname(path), { recursive: true });
  rmSync(path, { recursive: true, force: true });
  const resolved = realpathOrSelf(target);
  try {
    symlinkSync(resolved, path, "dir");
  } catch {
    // Windows without Developer Mode / admin can't create symlinks.
    atomicCopy(resolved, path);
  }
}

function readPackageVersion(root: string): string {
  const payload = parseJson<{ version?: unknown }>(
    readFileSync(join(root, "package.json"), "utf8"),
    "package.json",
  );
  if (typeof payload.version !== "string")
    throw new Error("package version is missing");
  return payload.version;
}

function readPluginVersion(
  root: string,
  manifestDirectory: string,
): string | undefined {
  try {
    const payload = parseJson<{ version?: unknown }>(
      readFileSync(join(root, manifestDirectory, "plugin.json"), "utf8"),
      "plugin manifest",
    );
    return stringValue(payload.version);
  } catch {
    return undefined;
  }
}

function hasClaudePlugin(text: string, expectedVersion: string): boolean {
  try {
    return parseJson<ClaudePlugin[]>(text, "Claude plugin list").some(
      (plugin) =>
        typeof plugin.id === "string" &&
        plugin.id.startsWith("trelly@") &&
        plugin.version === expectedVersion,
    );
  } catch {
    return false;
  }
}

function hasCodexPlugin(text: string, expectedVersion: string): boolean {
  try {
    return Boolean(
      parseJson<{ installed?: CodexPlugin[] }>(
        text,
        "Codex plugin list",
      ).installed?.some(
        (plugin) =>
          plugin.name === "trelly" &&
          plugin.installed !== false &&
          plugin.version === expectedVersion,
      ),
    );
  } catch {
    return false;
  }
}

function fresh(host: PluginHost, targetVersion: string): InstallStatus {
  return {
    host,
    available: true,
    installed: false,
    valid: false,
    targetVersion,
  };
}

function unavailable(
  host: PluginHost,
  targetVersion: string,
  reason: string,
  available = false,
): InstallStatus {
  return {
    host,
    available,
    installed: false,
    valid: false,
    targetVersion,
    blockedReason: reason,
  };
}

function isCurrent(plugin: InstallStatus): boolean {
  return (
    plugin.installed && plugin.valid && plugin.currentVersion === plugin.targetVersion
  );
}

function restartInstructions(actions: InstallAction[]): string[] {
  const changed = (host: PluginHost): boolean =>
    actions.some(
      (action) =>
        action.host === host &&
        (action.status === "installed" || action.status === "repaired"),
    );
  const restart: string[] = [];
  if (changed("cursor")) restart.push("Reload Cursor with Developer: Reload Window");
  if (changed("claude")) restart.push("Restart Claude Code or run /reload-plugins");
  if (changed("codex")) restart.push("Start a new Codex thread");
  return restart;
}

function alreadyConfigured(result: CommandResult): boolean {
  return /already|exists|configured/i.test(`${result.stdout}\n${result.stderr}`);
}

function readObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isObject(value) ? value : {};
  } catch {
    throw new Error(`${path} contains invalid JSON`);
  }
}

function standaloneMcpWarnings(
  dependencies: InstallDependencies,
  host: PluginHost,
): string[] | undefined {
  const paths =
    host === "cursor"
      ? [join(dependencies.home, ".cursor", "mcp.json")]
      : host === "claude"
        ? [
            join(dependencies.home, ".claude.json"),
            join(dependencies.home, ".claude", "settings.json"),
          ]
        : [join(dependencies.home, ".codex", "config.toml")];
  const matched = paths.filter((path) => hasStandaloneTrellyMcp(path, host));
  if (matched.length === 0) return undefined;
  return matched.map(
    (path) =>
      `standalone Trelly MCP also exists in ${path}; remove it if tools duplicate`,
  );
}

function hasStandaloneTrellyMcp(path: string, host: PluginHost): boolean {
  if (!existsSync(path)) return false;
  try {
    const text = readFileSync(path, "utf8");
    if (host === "codex") {
      return /^\s*\[mcp_servers\.(?:"trelly"|trelly)\]\s*$/m.test(text);
    }
    const payload = JSON.parse(text) as unknown;
    return (
      isObject(payload) &&
      isObject(payload.mcpServers) &&
      isObject(payload.mcpServers.trelly)
    );
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function hostLabel(host: PluginHost): string {
  if (host === "claude") return "Claude Code";
  return host[0]?.toUpperCase() + host.slice(1);
}

function formatRows(rows: Array<[string, string, string]>): string {
  if (rows.length === 0) return "No matching agent hosts found";
  const first = Math.max(...rows.map((row) => row[0].length));
  const second = Math.max(...rows.map((row) => row[1].length));
  return rows
    .map(
      ([name, version, status]) =>
        `${name.padEnd(first)}  ${version.padEnd(second)}  ${status}`,
    )
    .join("\n");
}
