import type { Command } from "commander";
import {
  applyInstallPlan,
  availableHosts,
  buildInstallPlan,
  formatInstallPlan,
  formatInstallReport,
  hasInstallFailures,
} from "../../install.ts";
import type { PluginHost } from "../../update.ts";
import { readLine } from "../../util/runtime.ts";
import { failure, printResult, success } from "../context.ts";
import { rootOpts } from "./run.ts";

type InstallOptions = {
  cursor?: boolean;
  claude?: boolean;
  codex?: boolean;
  all?: boolean;
  yes?: boolean;
  check?: boolean;
  force?: boolean;
};

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Install Trelly plugins for Cursor, Claude Code, and Codex")
    .option("--cursor", "Install the Cursor plugin")
    .option("--claude", "Install the Claude Code plugin")
    .option("--codex", "Install the Codex plugin")
    .option("--all", "Install plugins for every available host")
    .option("-y, --yes", "Install without prompting")
    .option("--check", "Check plugin installation status without changing anything")
    .option("--force", "Reinstall plugins that are already current")
    .action(async (options: InstallOptions, command) => {
      const root = rootOpts(command);
      try {
        const requested = selectedFlags(options);
        if (options.all && requested.length > 0) {
          throw new Error("--all cannot be combined with individual host flags");
        }
        if (options.check && options.yes) {
          throw new Error("--check and --yes cannot be combined");
        }
        if (options.check && options.force) {
          throw new Error("--check and --force cannot be combined");
        }
        if (root.json && !options.check && !options.yes) {
          throw new Error("JSON installation requires --yes");
        }

        const plan = await buildInstallPlan();
        const selected = options.all
          ? availableHosts(plan)
          : requested.length > 0
            ? requested
            : options.check
              ? (["cursor", "claude", "codex"] satisfies PluginHost[])
              : availableHosts(plan);

        if (options.check) {
          if (root.json) {
            printResult(
              success("local", {
                ...plan,
                plugins: plan.plugins.filter((plugin) =>
                  selected.includes(plugin.host),
                ),
              }),
              root,
            );
          } else {
            console.log(formatInstallPlan(plan, selected));
          }
          return;
        }

        if (requested.length === 0 && !options.all && !process.stdin.isTTY) {
          throw new Error("Non-interactive installation requires --all or a host flag");
        }
        if (selected.length === 0) {
          throw new Error("No supported agent hosts were detected");
        }
        if (!options.yes && !process.stdin.isTTY) {
          throw new Error("Installation requires confirmation; rerun with --yes");
        }

        if (!options.yes) {
          process.stderr.write(
            `${formatInstallPlan(plan, selected)}\n\nInstall selected plugins? [Y/n] `,
          );
          const answer = (await readLine()).toLowerCase();
          if (answer && answer !== "y" && answer !== "yes") {
            console.log("Installation cancelled");
            return;
          }
        }

        const report = await applyInstallPlan(plan, selected, {
          force: options.force,
        });
        if (root.json) {
          if (hasInstallFailures(report)) {
            printResult(
              failure("One or more plugin installations failed", {
                details: report,
              }),
              root,
            );
          } else {
            printResult(success("local", report), root);
          }
        } else {
          console.log(formatInstallReport(report));
        }
        if (hasInstallFailures(report)) process.exitCode = 1;
      } catch (error) {
        printResult(
          failure(error instanceof Error ? error.message : String(error)),
          root,
        );
        process.exitCode = 1;
      }
    });
}

function selectedFlags(options: InstallOptions): PluginHost[] {
  const selected: PluginHost[] = [];
  if (options.cursor) selected.push("cursor");
  if (options.claude) selected.push("claude");
  if (options.codex) selected.push("codex");
  return selected;
}
