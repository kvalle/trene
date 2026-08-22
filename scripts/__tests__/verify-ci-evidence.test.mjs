import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { verifyApk, verifyCiRun, verifyQualificationRun } from "../verify-ci-evidence.mjs";

const commit = "a".repeat(40);
const run = {
  name: "CI",
  path: ".github/workflows/ci.yml",
  event: "workflow_dispatch",
  head_sha: commit,
  status: "completed",
  conclusion: "success",
};
const artifacts = { artifacts: [{ name: "trene-android-apk", expired: false }] };

test("accepts successful manually dispatched CI for the exact candidate", () => {
  assert.doesNotThrow(() => verifyCiRun({ candidateCommit: commit, run, artifacts }));
});

for (const [name, override] of [
  ["another commit", { head_sha: "b".repeat(40) }],
  ["an unsuccessful run", { conclusion: "failure" }],
  ["an incomplete run", { status: "in_progress", conclusion: null }],
  ["an automatic partial run", { event: "pull_request" }],
  ["another workflow", { name: "Backup release qualification" }],
  ["another workflow path", { path: ".github/workflows/other.yml" }],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => verifyCiRun({ candidateCommit: commit, run: { ...run, ...override }, artifacts }));
  });
}

test("rejects a missing or expired APK artifact", () => {
  assert.throws(() => verifyCiRun({ candidateCommit: commit, run, artifacts: { artifacts: [] } }));
  assert.throws(() =>
    verifyCiRun({
      candidateCommit: commit,
      run,
      artifacts: { artifacts: [{ name: "trene-android-apk", expired: true }] },
    }),
  );
});

test("accepts only successful release qualification for the candidate", () => {
  const qualification = {
    name: "Backup release qualification",
    path: ".github/workflows/release-qualification.yml",
    head_sha: commit,
    status: "completed",
    conclusion: "success",
  };
  assert.doesNotThrow(() => verifyQualificationRun({ candidateCommit: commit, run: qualification }));
  assert.throws(() =>
    verifyQualificationRun({
      candidateCommit: commit,
      run: { ...qualification, path: ".github/workflows/other.yml" },
    }),
  );
});

test("accepts an APK matching candidate, run, and digest", () => {
  const apk = Buffer.from("synthetic apk");
  const identity = {
    commit,
    ciRunId: "42",
    sha256: createHash("sha256").update(apk).digest("hex"),
  };
  assert.doesNotThrow(() => verifyApk({ candidateCommit: commit, runId: "42", identity, apk }));
});

test("rejects mismatched APK identity fields", () => {
  const apk = Buffer.from("synthetic apk");
  const identity = {
    commit,
    ciRunId: "42",
    sha256: createHash("sha256").update(apk).digest("hex"),
  };
  assert.throws(() => verifyApk({ candidateCommit: "b".repeat(40), runId: "42", identity, apk }));
  assert.throws(() => verifyApk({ candidateCommit: commit, runId: "43", identity, apk }));
  assert.throws(() => verifyApk({ candidateCommit: commit, runId: "42", identity, apk: Buffer.from("changed") }));
});
