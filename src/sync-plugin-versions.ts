import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  version?: unknown;
};
if (typeof packageJson.version !== "string") {
  throw new Error("package.json has no version");
}

const manifests = [
  ".cursor-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  ".antigravity-plugin/plugin.json",
];

for (const manifest of manifests) {
  const path = join(root, manifest);
  const source = readFileSync(path, "utf8");
  const matches = source.match(/"version"\s*:\s*"[^"]+"/g);
  if (matches?.length !== 1) {
    throw new Error(`${manifest} must contain exactly one version field`);
  }
  const updated = source.replace(
    /("version"\s*:\s*")[^"]+("\s*)/,
    `$1${packageJson.version}$2`,
  );
  writeFileSync(path, updated);
  console.log(`${manifest} → ${packageJson.version}`);
}
