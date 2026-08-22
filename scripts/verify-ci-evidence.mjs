import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function verifyCiRun({ candidateCommit, run, artifacts }) {
  required(/^[0-9a-f]{40}$/u.test(candidateCommit), "candidate commit must be a full Git SHA");
  required(run.name === "CI", "evidence must come from the CI workflow");
  required(run.path === ".github/workflows/ci.yml", "evidence must come from ci.yml");
  required(run.event === "workflow_dispatch", "candidate CI must be intentionally dispatched");
  required(run.head_sha === candidateCommit, "CI run commit does not match the candidate");
  required(run.status === "completed" && run.conclusion === "success", "CI run must succeed");
  required(
    artifacts.artifacts?.some(
      (artifact) => artifact.name === "trene-android-apk" && artifact.expired === false,
    ),
    "CI run has no available Android APK artifact",
  );
}

export function verifyQualificationRun({ candidateCommit, run }) {
  required(/^[0-9a-f]{40}$/u.test(candidateCommit), "candidate commit must be a full Git SHA");
  required(run.name === "Backup release qualification", "evidence must come from release qualification");
  required(
    run.path === ".github/workflows/release-qualification.yml",
    "evidence must come from release-qualification.yml",
  );
  required(run.head_sha === candidateCommit, "qualification commit does not match the candidate");
  required(run.status === "completed" && run.conclusion === "success", "qualification must succeed");
}

export function verifyApk({ candidateCommit, runId, identity, apk }) {
  required(identity.commit === candidateCommit, "APK commit does not match the candidate");
  required(String(identity.ciRunId) === String(runId), "APK run ID does not match CI evidence");
  const actual = createHash("sha256").update(apk).digest("hex");
  required(identity.sha256 === actual, "APK SHA-256 does not match its identity record");
}

function required(condition, message) {
  if (!condition) throw new Error(message);
}

function main(args) {
  const [mode, candidateCommit, runId, firstPath, secondPath] = args;
  if (mode === "run") {
    verifyCiRun({
      candidateCommit,
      run: JSON.parse(readFileSync(firstPath, "utf8")),
      artifacts: JSON.parse(readFileSync(secondPath, "utf8")),
    });
  } else if (mode === "qualification") {
    verifyQualificationRun({
      candidateCommit,
      run: JSON.parse(readFileSync(firstPath, "utf8")),
    });
  } else if (mode === "apk") {
    verifyApk({
      candidateCommit,
      runId,
      identity: JSON.parse(readFileSync(firstPath, "utf8")),
      apk: readFileSync(secondPath),
    });
  } else {
    throw new Error(
      "usage: verify-ci-evidence.mjs <run|qualification|apk> <candidate> <run-id> <json> [json|apk]",
    );
  }
  process.stdout.write("CI evidence is valid.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
