import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  applyUpdatePlan,
  buildUpdatePlan,
  type CommandResult,
  classifyInstallation,
  compareVersions,
  formatUpdatePlan,
  type UpdateDependencies,
  type UpdatePlan,
} from "./update.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("update version and installation detection", () => {
  it("compares semantic versions without downgrading stable releases", () => {
    assert.ok(compareVersions("0.3.3", "0.3.4") < 0);
    assert.equal(compareVersions("0.3.4", "0.3.4"), 0);
    assert.ok(compareVersions("0.3.4", "0.3.4-beta.1") > 0);
  });

  it("classifies supported and ephemeral install paths", () => {
    assert.equal(
      classifyInstallation("/opt/homebrew/Cellar/trelly/0.3.4/libexec"),
      "homebrew",
    );
    assert.equal(
      classifyInstallation("/home/me/.bun/install/global/node_modules/trelly"),
      "bun",
    );
    assert.equal(classifyInstallation("/home/me/lib/node_modules/trelly"), "npm");
    assert.equal(
      classifyInstallation("/home/me/.npm/_npx/abc/node_modules/trelly"),
      "ephemeral",
    );
    assert.equal(
      classifyInstallation(
        "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\trelly",
      ),
      "npm",
    );
  });
});

describe("update planning", () => {
  it("detects installed Claude and Codex plugins from JSON inventories", async () => {
    const root = makePackage("0.3.3");
    const home = makeDirectory();
    const dependencies = makeDependencies(
      root,
      home,
      async (command) => {
        if (command === "claude") {
          return ok(
            JSON.stringify([
              {
                id: "trelly@trelly-local",
                version: "0.3.3",
                scope: "user",
                installPath: "/plugins/claude/trelly",
              },
            ]),
          );
        }
        if (command === "codex") {
          return ok(
            JSON.stringify({
              installed: [
                {
                  pluginId: "trelly@local-trelly",
                  name: "trelly",
                  marketplaceName: "local-trelly",
                  version: "0.3.3",
                  installed: true,
                  source: { path: root },
                },
              ],
            }),
          );
        }
        return ok();
      },
      () => true,
    );

    const plan = await buildUpdatePlan(dependencies);

    assert.deepEqual(
      plan.plugins.find((plugin) => plugin.host === "claude"),
      {
        host: "claude",
        installed: true,
        currentVersion: "0.3.3",
        targetVersion: "0.3.4",
        updateAvailable: true,
        id: "trelly@trelly-local",
        scope: "user",
        path: "/plugins/claude/trelly",
      },
    );
    assert.deepEqual(
      plan.plugins.find((plugin) => plugin.host === "codex"),
      {
        host: "codex",
        installed: true,
        currentVersion: "0.3.3",
        targetVersion: "0.3.4",
        updateAvailable: true,
        id: "trelly@local-trelly",
        sourcePath: root,
      },
    );
  });

  it("blocks dirty source checkouts", async () => {
    const root = makePackage("0.3.3");
    mkdirSync(join(root, ".git"));
    const dependencies = makeDependencies(
      root,
      makeDirectory(),
      async (command, args) => {
        if (command === "git" && args[0] === "status") return ok(" M package.json");
        return ok();
      },
    );

    const plan = await buildUpdatePlan(dependencies);

    assert.equal(plan.cli.kind, "source");
    assert.equal(plan.cli.canUpdate, false);
    assert.equal(plan.cli.blockedReason, "source checkout has uncommitted changes");
  });

  it("uses platform manifest versions when the CLI is already current", async () => {
    const root = makePackage("0.3.4");
    writePluginManifest(root, ".cursor-plugin", "0.2.0");
    const home = makeDirectory();
    const destination = join(home, ".cursor", "plugins", "local", "trelly");
    writePluginManifest(destination, ".cursor-plugin", "0.1.0");

    const plan = await buildUpdatePlan(makeDependencies(root, home));

    assert.deepEqual(plan.plugins[0], {
      host: "cursor",
      installed: true,
      currentVersion: "0.1.0",
      targetVersion: "0.2.0",
      updateAvailable: true,
      path: destination,
    });
  });

  it("formats a compact human update table", () => {
    const text = formatUpdatePlan(basePlan());
    assert.match(text, /CLI/);
    assert.match(text, /0\.3\.3 → 0\.3\.4/);
    assert.match(text, /Cursor/);
  });
});

describe("applying updates", () => {
  it("updates npm through the owning package manager", async () => {
    const calls: Array<[string, string[]]> = [];
    const dependencies = makeDependencies(
      makePackage("0.3.3"),
      makeDirectory(),
      async (command, args) => {
        calls.push([command, args]);
        return ok();
      },
    );

    const report = await applyUpdatePlan(basePlan(), { cliOnly: true }, dependencies);

    assert.deepEqual(calls, [["npm", ["install", "-g", "trelly@latest"]]]);
    assert.equal(report.actions[0]?.target, "cli");
    assert.equal(report.actions[0]?.status, "updated");
  });

  it("uses Bun, Homebrew, and Git update commands for their install kinds", async () => {
    const scenarios: Array<{
      kind: "bun" | "homebrew" | "source";
      expected: Array<[string, string[]]>;
    }> = [
      {
        kind: "bun",
        expected: [["bun", ["add", "--global", "trelly@latest"]]],
      },
      {
        kind: "homebrew",
        expected: [["brew", ["upgrade", "trelly"]]],
      },
      {
        kind: "source",
        expected: [
          ["git", ["pull", "--ff-only", "origin", "main"]],
          ["bun", ["install", "--frozen-lockfile"]],
        ],
      },
    ];

    for (const scenario of scenarios) {
      const calls: Array<[string, string[]]> = [];
      const plan = basePlan();
      plan.cli.kind = scenario.kind;
      const dependencies = makeDependencies(
        makePackage("0.3.3"),
        makeDirectory(),
        async (command, args) => {
          calls.push([command, args]);
          return ok();
        },
      );

      const report = await applyUpdatePlan(plan, { cliOnly: true }, dependencies);

      assert.deepEqual(calls, scenario.expected);
      assert.equal(report.actions[0]?.status, "updated");
    }
  });

  it("atomically refreshes an installed Cursor plugin", async () => {
    const root = makePackage("0.3.4");
    writeFileSync(join(root, "new.txt"), "new");
    const home = makeDirectory();
    const destination = join(home, ".cursor", "plugins", "local", "trelly");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "old.txt"), "old");
    const plan = basePlan();
    plan.cli.updateAvailable = false;
    plan.plugins = [
      {
        host: "cursor",
        installed: true,
        currentVersion: "0.3.3",
        targetVersion: "0.3.4",
        updateAvailable: true,
        path: destination,
      },
    ];

    const report = await applyUpdatePlan(
      plan,
      { pluginsOnly: true },
      makeDependencies(root, home),
    );

    assert.equal(readFileSync(join(destination, "new.txt"), "utf8"), "new");
    assert.equal(existsSync(join(destination, "old.txt")), false);
    assert.equal(report.actions[0]?.target, "cursor");
    assert.equal(report.actions[0]?.status, "updated");
  });

  it("refuses to update a dirty Codex plugin source", async () => {
    const root = makePackage("0.3.4");
    const source = makeDirectory();
    mkdirSync(join(source, ".git"));
    const plan = basePlan();
    plan.cli.updateAvailable = false;
    plan.plugins = [
      {
        host: "codex",
        installed: true,
        currentVersion: "0.3.3",
        targetVersion: "0.3.4",
        updateAvailable: true,
        id: "trelly@local-trelly",
        sourcePath: source,
      },
    ];
    const dependencies = makeDependencies(
      root,
      makeDirectory(),
      async (command, args) => {
        if (command === "git" && args[0] === "status") return ok(" M .mcp.json");
        return ok();
      },
    );

    const report = await applyUpdatePlan(plan, { pluginsOnly: true }, dependencies);

    assert.deepEqual(report.actions[0], {
      target: "codex",
      status: "blocked",
      message: "Codex plugin source has uncommitted changes",
    });
  });

  it("force-refreshes same-version Claude plugins with a preserving reinstall", async () => {
    const calls: Array<[string, string[]]> = [];
    const plan = basePlan();
    plan.cli.updateAvailable = false;
    plan.plugins = [
      {
        host: "claude",
        installed: true,
        currentVersion: "0.3.4",
        targetVersion: "0.3.4",
        updateAvailable: false,
        id: "trelly@trelly-local",
        scope: "user",
      },
    ];
    const dependencies = makeDependencies(
      makePackage("0.3.4"),
      makeDirectory(),
      async (command, args) => {
        calls.push([command, args]);
        return ok();
      },
    );

    const report = await applyUpdatePlan(plan, { pluginsOnly: true }, dependencies);

    assert.deepEqual(calls, [
      [
        "claude",
        [
          "plugin",
          "uninstall",
          "trelly@trelly-local",
          "--scope",
          "user",
          "--keep-data",
        ],
      ],
      ["claude", ["plugin", "install", "trelly@trelly-local", "--scope", "user"]],
    ]);
    assert.equal(report.actions[0]?.status, "updated");
  });

  it("uses native Claude and Codex updates for version changes", async () => {
    const root = makePackage("0.3.4");
    const calls: Array<[string, string[]]> = [];
    const plan = basePlan();
    plan.cli.updateAvailable = false;
    plan.plugins = [
      {
        host: "claude",
        installed: true,
        currentVersion: "0.3.3",
        targetVersion: "0.3.4",
        updateAvailable: true,
        id: "trelly@trelly-local",
        scope: "user",
      },
      {
        host: "codex",
        installed: true,
        currentVersion: "0.3.3",
        targetVersion: "0.3.4",
        updateAvailable: true,
        id: "trelly@local-trelly",
        sourcePath: root,
      },
    ];
    const dependencies = makeDependencies(
      root,
      makeDirectory(),
      async (command, args) => {
        calls.push([command, args]);
        return ok();
      },
    );

    const report = await applyUpdatePlan(plan, {}, dependencies);

    assert.deepEqual(calls, [
      ["claude", ["plugin", "update", "trelly@trelly-local", "--scope", "user"]],
      ["codex", ["plugin", "add", "trelly@local-trelly"]],
    ]);
    assert.deepEqual(
      report.actions.map((action) => [action.target, action.status]),
      [
        ["cli", "current"],
        ["claude", "updated"],
        ["codex", "updated"],
      ],
    );
  });
});

function basePlan(): UpdatePlan {
  return {
    cli: {
      kind: "npm",
      root: "/global/trelly",
      currentVersion: "0.3.3",
      latestVersion: "0.3.4",
      updateAvailable: true,
      canUpdate: true,
    },
    plugins: [
      {
        host: "cursor",
        installed: true,
        currentVersion: "0.3.3",
        targetVersion: "0.3.4",
        updateAvailable: true,
      },
    ],
  };
}

function makeDependencies(
  packageRoot: string,
  home: string,
  run: UpdateDependencies["run"] = async () => ok(),
  hasExecutable: UpdateDependencies["hasExecutable"] = () => false,
): UpdateDependencies {
  return {
    packageRoot,
    home,
    run,
    fetchLatestVersion: async () => "0.3.4",
    hasExecutable,
  };
}

function makePackage(version: string): string {
  const root = makeDirectory();
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "trelly", version }),
  );
  return root;
}

function writePluginManifest(root: string, directory: string, version: string): void {
  const manifestDirectory = join(root, directory);
  mkdirSync(manifestDirectory, { recursive: true });
  writeFileSync(
    join(manifestDirectory, "plugin.json"),
    JSON.stringify({ name: "trelly", version }),
  );
}

function makeDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "trelly-update-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function ok(stdout = ""): CommandResult {
  return { code: 0, stdout, stderr: "" };
}
