import type { Command } from "commander";
import {
  applyUpdatePlan,
  buildUpdatePlan,
  formatUpdatePlan,
  formatUpdateReport,
  hasUpdateFailures,
} from "../../update.ts";
import { readLine } from "../../util/runtime.ts";
import { failure, printResult, success } from "../context.ts";
import { rootOpts } from "./run.ts";

type UpdateOptions = {
  check?: boolean;
  yes?: boolean;
  cliOnly?: boolean;
  pluginsOnly?: boolean;
};

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Check for updates and refresh installed agent plugins")
    .option("--check", "Check without changing anything")
    .option("-y, --yes", "Apply updates without prompting")
    .option("--cli-only", "Only update the CLI")
    .option("--plugins-only", "Only refresh detected plugins")
    .action(async (options: UpdateOptions, command) => {
      const root = rootOpts(command);
      try {
        if (options.cliOnly && options.pluginsOnly) {
          throw new Error("--cli-only and --plugins-only cannot be used together");
        }
        if (options.check && options.yes) {
          throw new Error("--check and --yes cannot be used together");
        }

        const plan = await buildUpdatePlan();
        if (options.check) {
          if (root.json) printResult(success("local", plan), root);
          else console.log(formatUpdatePlan(plan, options));
          return;
        }

        if (!options.yes) {
          if (!process.stdin.isTTY) {
            throw new Error("Update requires confirmation; rerun with --yes");
          }
          process.stderr.write(
            `${formatUpdatePlan(plan, options)}\n\nApply these updates? [y/N] `,
          );
          const answer = (await readLine()).toLowerCase();
          if (answer !== "y" && answer !== "yes") {
            if (root.json) {
              printResult(success("local", { plan, cancelled: true }), root);
            } else {
              console.log("Update cancelled");
            }
            return;
          }
        }

        const report = await applyUpdatePlan(plan, options);
        if (root.json) {
          if (hasUpdateFailures(report)) {
            printResult(
              failure("One or more updates failed", { details: report }),
              root,
            );
          } else {
            printResult(success("local", report), root);
          }
        } else {
          console.log(formatUpdateReport(report));
        }
        if (hasUpdateFailures(report)) process.exitCode = 1;
      } catch (error) {
        printResult(
          failure(error instanceof Error ? error.message : String(error)),
          root,
        );
        process.exitCode = 1;
      }
    });
}
