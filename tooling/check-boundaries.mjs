import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const packagesDir = join(repoRoot, "packages");
const appPackageNames = new Set(
  readdirSync(join(repoRoot, "apps"))
    .map((name) => join(repoRoot, "apps", name, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, "utf8")).name),
);

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".cache") {
        continue;
      }
      walk(path);
      continue;
    }

    if (![...sourceExtensions].some((ext) => path.endsWith(ext))) {
      continue;
    }

    const contents = readFileSync(path, "utf8");
    for (const appName of appPackageNames) {
      if (contents.includes(`"${appName}`) || contents.includes(`'${appName}`)) {
        violations.push(`${relative(repoRoot, path)} imports ${appName}`);
      }
    }
    if (contents.includes("apps/")) {
      violations.push(`${relative(repoRoot, path)} imports from apps/`);
    }
  }
}

walk(packagesDir);

if (violations.length > 0) {
  console.error("Package boundary violations found:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}
