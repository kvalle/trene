import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateNativeE2eStability(evidence) {
  if (!/^[0-9a-f]{40}$/.test(evidence.revision ?? "")) {
    throw new Error("Evidence must identify one full Git revision");
  }
  if ((evidence.focusedAndroidStandaloneRuns ?? []).length < 2) {
    throw new Error("At least two focused Android standalone runs are required");
  }
  if ((evidence.completeNativeRuns ?? []).length < 10) {
    throw new Error("At least ten complete native runs are required");
  }

  const runs = [...evidence.focusedAndroidStandaloneRuns, ...evidence.completeNativeRuns];
  for (const run of runs) {
    if (run.revision !== evidence.revision || run.conclusion !== "success" || !run.url) {
      throw new Error("Every qualifying run must pass on the recorded revision and include a URL");
    }
  }

  if (evidence.negativeControl?.conclusion !== "failure" || !evidence.negativeControl.url) {
    throw new Error("A linked failing negative control is required");
  }
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: validate-native-e2e-stability.mjs <evidence.json>");
  validateNativeE2eStability(JSON.parse(await readFile(path, "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
