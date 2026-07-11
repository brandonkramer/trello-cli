import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  applyInstallPlan,
  buildInstallPlan,
  type InstallDependencies,
  type InstallPlan,
} from "./install.ts";
import type { CommandResult } from "./update.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("plugin installation planning", () => {
  it("keeps every shipped plugin manifest aligned with the package version", () => {
    const packageVersion = (
      JSON.parse(
        readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
      ) as {
        version: string;
      }
    ).version;
    for (const manifest of [
      ".cursor-plugin/plugin.json",
      ".claude-plugin/plugin.json",
      ".codex-plugin/plugin.json",
      ".antigravity-plugin/plugin.json",
    ]) {
      const payload = JSON.parse(
        readFileSync(join(import.meta.dirname, "..", manifest), "utf8"),
      ) as { version?: unknown };
      assert.equal(payload.version, packageVersion, manifest);
    }
  });

  it("detects available hosts and a broken same-version Cursor plugin", async () => {
    const root = makePackage("0.3.5");
    const home = makeDirectory();
    const cursor = join(home, ".cursor", "plugins", "local", "trelly");
    copyBundle(root, cursor, false);
    writeFileSync(
      join(home, ".cursor", "mcp.json"),
      JSON.stringify({ mcpServers: { trelly: { command: "trelly-mcp" } } }),
    );

    const plan = await buildInstallPlan(
      makeDependencies(root, home, async (command) => {
        if (command === "claude") return ok("[]");
        if (command === "codex") return ok('{"installed":[]}');
        return ok();
      }),
    );

    assert.deepEqual(
      plan.plugins.map((plugin) => [plugin.host, plugin.available, plugin.installed]),
      [
        ["cursor", true, true],
        ["claude", true, false],
        ["codex", true, false],
      ],
    );
    const cursorStatus = plan.plugins[0];
    assert.equal(cursorStatus?.currentVersion, "0.3.5");
    assert.equal(cursorStatus?.valid, false);
    assert.match(cursorStatus?.issue ?? "", /root mcp\.json is missing/);
    assert.match(cursorStatus?.warnings?.[0] ?? "", /standalone Trelly MCP/);
  });

  it("resolves Cursor's bundled MCP launcher outside the plugin directory", () => {
    const home = makeDirectory();
    const workingDirectory = makeDirectory();
    const launcher = join(
      home,
      ".cursor",
      "plugins",
      "local",
      "trelly",
      "bin",
      "trelly-mcp",
    );
    mkdirSync(join(launcher, ".."), { recursive: true });
    writeFileSync(launcher, '#!/bin/sh\nprintf resolved > "$HOME/resolved"\n');
    chmodSync(launcher, 0o755);
    const config = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "mcp.json"), "utf8"),
    ) as {
      mcpServers: { trelly: { command: string; args: string[] } };
    };

    const result = spawnSync(
      config.mcpServers.trelly.command,
      config.mcpServers.trelly.args,
      {
        cwd: workingDirectory,
        env: { ...process.env, HOME: home, PATH: "/usr/bin:/bin" },
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(home, "resolved"), "utf8"), "resolved");
  });
});

describe("applying plugin installations", () => {
  it("repairs a broken Cursor plugin with an atomic package copy", async () => {
    const root = makePackage("0.3.5");
    const home = makeDirectory();
    const destination = join(home, ".cursor", "plugins", "local", "trelly");
    copyBundle(root, destination, false);
    const plan = installPlan(root, {
      host: "cursor",
      available: true,
      installed: true,
      valid: false,
      currentVersion: "0.3.5",
      targetVersion: "0.3.5",
      path: destination,
      issue: "root mcp.json is missing",
    });

    const report = await applyInstallPlan(
      plan,
      ["cursor"],
      {},
      makeDependencies(root, home),
    );

    assert.equal(report.actions[0]?.status, "repaired");
    assert.equal(existsSync(join(destination, "mcp.json")), true);
    assert.deepEqual(report.restart, ["Reload Cursor with Developer: Reload Window"]);
  });

  it("installs Claude through a managed local marketplace", async () => {
    const root = makePackage("0.3.5");
    const home = makeDirectory();
    const calls: Array<[string, string[]]> = [];
    const plan = installPlan(root, {
      host: "claude",
      available: true,
      installed: false,
      valid: false,
      targetVersion: "0.3.5",
    });
    const dependencies = makeDependencies(root, home, async (command, args) => {
      calls.push([command, args]);
      if (args[0] === "plugin" && args[1] === "list") {
        return ok('[{"id":"trelly@trelly-local","version":"0.3.5"}]');
      }
      return ok();
    });

    const report = await applyInstallPlan(plan, ["claude"], {}, dependencies);

    assert.equal(report.actions[0]?.status, "installed");
    assert.deepEqual(calls[0], [
      "claude",
      [
        "plugin",
        "marketplace",
        "add",
        join(home, ".claude", "trelly-marketplace"),
        "--scope",
        "user",
      ],
    ]);
    assert.deepEqual(calls[1], [
      "claude",
      ["plugin", "install", "trelly@trelly-local", "--scope", "user"],
    ]);
    assert.equal(
      readlinkSync(join(home, ".claude", "trelly-marketplace", "trelly")),
      realpathSync(root),
    );
  });

  it("installs Codex while preserving unrelated marketplace entries", async () => {
    const root = makePackage("0.3.5");
    const home = makeDirectory();
    const marketplace = join(home, ".agents", "plugins", "marketplace.json");
    mkdirSync(join(home, ".agents", "plugins"), { recursive: true });
    writeFileSync(
      marketplace,
      JSON.stringify({
        name: "personal",
        plugins: [{ name: "other", source: { source: "local", path: "./other" } }],
      }),
    );
    const calls: Array<[string, string[]]> = [];
    const plan = installPlan(root, {
      host: "codex",
      available: true,
      installed: false,
      valid: false,
      targetVersion: "0.3.5",
    });
    const dependencies = makeDependencies(root, home, async (command, args) => {
      calls.push([command, args]);
      if (args[0] === "plugin" && args[1] === "list") {
        return ok(
          '{"installed":[{"pluginId":"trelly@personal","name":"trelly","version":"0.3.5","installed":true}]}',
        );
      }
      return ok();
    });

    const report = await applyInstallPlan(plan, ["codex"], {}, dependencies);

    assert.equal(report.actions[0]?.status, "installed");
    assert.deepEqual(calls[1], [
      "codex",
      ["plugin", "add", "trelly@personal", "--json"],
    ]);
    const saved = JSON.parse(readFileSync(marketplace, "utf8")) as {
      plugins: Array<{ name: string; source?: { path?: string } }>;
    };
    assert.deepEqual(
      saved.plugins.map((plugin) => plugin.name),
      ["other", "trelly"],
    );
    assert.equal(saved.plugins[1]?.source?.path, "./.agents/plugins/trelly-managed");
    assert.equal(
      readlinkSync(join(home, ".agents", "plugins", "trelly-managed")),
      realpathSync(root),
    );
  });

  it("leaves a valid current plugin unchanged unless forced", async () => {
    const root = makePackage("0.3.5");
    const home = makeDirectory();
    let calls = 0;
    const plan = installPlan(root, {
      host: "claude",
      available: true,
      installed: true,
      valid: true,
      currentVersion: "0.3.5",
      targetVersion: "0.3.5",
      id: "trelly@trelly-local",
    });

    const report = await applyInstallPlan(
      plan,
      ["claude"],
      {},
      makeDependencies(root, home, async () => {
        calls += 1;
        return ok();
      }),
    );

    assert.equal(report.actions[0]?.status, "current");
    assert.equal(calls, 0);
    assert.deepEqual(report.restart, []);
  });
});

function installPlan(
  packageRoot: string,
  plugin: InstallPlan["plugins"][number],
): InstallPlan {
  return { packageRoot, version: "0.3.5", plugins: [plugin] };
}

function makeDependencies(
  packageRoot: string,
  home: string,
  run: InstallDependencies["run"] = async () => ok(),
): InstallDependencies {
  return {
    packageRoot,
    home,
    run,
    hasExecutable: () => true,
    platform: "darwin",
  };
}

function makePackage(version: string): string {
  const root = makeDirectory();
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "trelly", version }),
  );
  for (const directory of [".cursor-plugin", ".claude-plugin", ".codex-plugin"]) {
    mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(
      join(root, directory, "plugin.json"),
      JSON.stringify({
        name: "trelly",
        version,
        mcpServers:
          directory === ".cursor-plugin"
            ? "mcp.json"
            : { trelly: { command: "./bin/trelly-mcp" } },
      }),
    );
  }
  for (const skill of ["trelly", "trelly-mcp"]) {
    mkdirSync(join(root, "skills", skill), { recursive: true });
    writeFileSync(join(root, "skills", skill, "SKILL.md"), `# ${skill}\n`);
  }
  mkdirSync(join(root, "bin"), { recursive: true });
  writeFileSync(join(root, "bin", "trelly-mcp"), "#!/bin/sh\n");
  chmodSync(join(root, "bin", "trelly-mcp"), 0o755);
  writeFileSync(
    join(root, "mcp.json"),
    JSON.stringify({ mcpServers: { trelly: { command: "bash" } } }),
  );
  return root;
}

function copyBundle(source: string, destination: string, includeMcp: boolean): void {
  const version = (
    JSON.parse(readFileSync(join(source, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
  mkdirSync(join(destination, ".cursor-plugin"), { recursive: true });
  writeFileSync(
    join(destination, ".cursor-plugin", "plugin.json"),
    JSON.stringify({ name: "trelly", version, mcpServers: "mcp.json" }),
  );
  for (const skill of ["trelly", "trelly-mcp"]) {
    mkdirSync(join(destination, "skills", skill), { recursive: true });
    writeFileSync(join(destination, "skills", skill, "SKILL.md"), "# skill\n");
  }
  mkdirSync(join(destination, "bin"), { recursive: true });
  writeFileSync(join(destination, "bin", "trelly-mcp"), "#!/bin/sh\n");
  chmodSync(join(destination, "bin", "trelly-mcp"), 0o755);
  if (includeMcp) {
    writeFileSync(
      join(destination, "mcp.json"),
      JSON.stringify({ mcpServers: { trelly: { command: "bash" } } }),
    );
  }
}

function makeDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "trelly-install-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function ok(stdout = ""): CommandResult {
  return { code: 0, stdout, stderr: "" };
}
