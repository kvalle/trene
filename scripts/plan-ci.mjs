import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MODES = ["none", "representative", "full"];

function maxMode(left, right) {
  return MODES[Math.max(MODES.indexOf(left), MODES.indexOf(right))];
}

function routeForPath(path) {
  if (
    /^(docs\/|.*\.md$|AGENTS\.md$|\.agents\/|\.claude\/|\.opencode\/)/i.test(path) ||
    /^(\.github\/(ISSUE_TEMPLATE\/|pull_request_template\.md$)|\.gitignore$)/i.test(path)
  ) {
    return ["none", "none"];
  }

  if (path === ".github/workflows/ci.yml") return ["full", "full"];
  if (path === ".github/workflows/ios-runtime.yml") return ["none", "full"];
  if (/^\.github\/workflows\/(release-qualification|cross-platform-(android|ios))\.yml$/.test(path)) {
    return ["full", "full"];
  }
  if (path.startsWith(".github/workflows/")) return ["full", "full"];

  if (/^\.maestro\/e2e\/ios\//.test(path)) return ["none", "full"];
  if (/^\.maestro\/e2e\/android\//.test(path)) return ["full", "none"];
  if (path.startsWith(".maestro/")) return ["full", "full"];

  if (path.startsWith("android/")) return ["full", "none"];
  if (path.startsWith("ios/")) return ["none", "full"];
  if (path === "scripts/create-ios-smoke-fixtures.mjs") return ["full", "full"];
  if (/^scripts\/.*android/i.test(path)) return ["full", "none"];
  if (/^scripts\/.*ios/i.test(path)) return ["none", "full"];
  if (path.startsWith("scripts/")) return ["full", "full"];

  if (/^src\/(backup|database|persistence|storage)\//.test(path)) return ["full", "full"];
  if (path === "src/screens/DataScreen.tsx" || path === "src/StartupGate.tsx") {
    return ["full", "full"];
  }
  if (
    /^(package(-lock)?\.json|app\.json|eas\.json|\.nvmrc|app\.config\.(js|mjs|ts)|metro\.config\.(js|mjs)|babel\.config\.(js|mjs)|plugins\/)/.test(
      path,
    )
  ) {
    return ["full", "full"];
  }

  return ["representative", "representative"];
}

export function classifyPaths(paths) {
  const normalizedPaths = paths
    .map((path) => path.trim().replaceAll("\\", "/").replace(/^\.\//, ""))
    .filter(Boolean);
  let android = "none";
  let ios = "none";

  for (const path of normalizedPaths) {
    const [pathAndroid, pathIos] = routeForPath(path);
    android = maxMode(android, pathAndroid);
    ios = maxMode(ios, pathIos);
  }

  return {
    has_changes: normalizedPaths.length > 0,
    native: android !== "none" || ios !== "none",
    android,
    ios,
  };
}

export function formatGithubOutput(plan) {
  return [
    `has_changes=${plan.has_changes}`,
    `native=${plan.native}`,
    `android=${plan.android}`,
    `ios=${plan.ios}`,
  ].join("\n");
}

async function readCliPaths(args) {
  const paths = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--file") {
      const file = args[index + 1];
      if (!file) throw new Error("--file requires a path");
      paths.push(...(await readFile(file, "utf8")).split(/\r?\n/));
      index += 1;
    } else {
      paths.push(args[index]);
    }
  }

  if (paths.length === 0 && !process.stdin.isTTY) {
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    paths.push(...input.split(/\r?\n/));
  }

  return paths;
}

async function main() {
  const paths = await readCliPaths(process.argv.slice(2));
  process.stdout.write(`${formatGithubOutput(classifyPaths(paths))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
