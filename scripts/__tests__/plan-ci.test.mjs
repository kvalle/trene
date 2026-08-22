import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { classifyPaths } from "../plan-ci.mjs";

const none = { has_changes: true, native: false, android: "none", ios: "none" };

test("classifies no changes and documentation or agent configuration", () => {
  assert.deepEqual(classifyPaths([]), { ...none, has_changes: false });
  assert.deepEqual(classifyPaths(["docs/ci.md", "AGENTS.md", ".github/pull_request_template.md"]), none);
});

test("classifies ordinary and unknown product files as representative native coverage", () => {
  const representative = {
    has_changes: true,
    native: true,
    android: "representative",
    ios: "representative",
  };
  assert.deepEqual(classifyPaths(["src/screens/HomeScreen.tsx"]), representative);
  assert.deepEqual(classifyPaths(["locales/nb.json"]), representative);
});

test("classifies shared persistence and native configuration as full on both platforms", () => {
  const full = { has_changes: true, native: true, android: "full", ios: "full" };
  for (const path of [
    "src/backup/createBackup.ts",
    "src/database/schema.ts",
    "src/persistence/store.ts",
    "src/screens/DataScreen.tsx",
    "src/StartupGate.tsx",
    "package-lock.json",
    "app.json",
    "plugins/withNativeBackup.js",
  ]) {
    assert.deepEqual(classifyPaths([path]), full, path);
  }
});

test("classifies platform-owned native and Maestro paths", () => {
  assert.deepEqual(classifyPaths(["android/app/src/main/AndroidManifest.xml"]), {
    has_changes: true,
    native: true,
    android: "full",
    ios: "none",
  });
  assert.deepEqual(classifyPaths([".maestro/android-backup/export.yaml"]), {
    has_changes: true,
    native: true,
    android: "full",
    ios: "none",
  });
  assert.deepEqual(classifyPaths(["ios/Trene/AppDelegate.swift"]), {
    has_changes: true,
    native: true,
    android: "none",
    ios: "full",
  });
  assert.deepEqual(classifyPaths([".maestro/ios/restore-success.yaml"]), {
    has_changes: true,
    native: true,
    android: "none",
    ios: "full",
  });
});

test("classifies scripts by platform ownership", () => {
  const full = { has_changes: true, native: true, android: "full", ios: "full" };
  assert.deepEqual(classifyPaths(["scripts/run-android-smoke.sh"]), {
    has_changes: true,
    native: true,
    android: "full",
    ios: "none",
  });
  assert.deepEqual(classifyPaths(["scripts/run-ios-smoke.sh"]), {
    has_changes: true,
    native: true,
    android: "none",
    ios: "full",
  });
  assert.deepEqual(classifyPaths(["scripts/create-ios-smoke-fixtures.mjs"]), full);
  assert.deepEqual(classifyPaths(["scripts/validate-backup-qualification.mjs"]), full);
  assert.deepEqual(classifyPaths([".maestro/qualification/round-trip.yaml"]), full);
});

test("classifies every workflow by the native jobs it owns", () => {
  assert.deepEqual(classifyPaths([".github/workflows/ci.yml"]), {
    has_changes: true,
    native: true,
    android: "full",
    ios: "full",
  });
  assert.deepEqual(classifyPaths([".github/workflows/ios-runtime.yml"]), {
    has_changes: true,
    native: true,
    android: "none",
    ios: "full",
  });

  for (const workflow of [
    "release-qualification.yml",
    "publish-release.yml",
    "cross-platform-android.yml",
    "cross-platform-ios.yml",
  ]) {
    assert.deepEqual(classifyPaths([`.github/workflows/${workflow}`]), {
      has_changes: true,
      native: true,
      android: "full",
      ios: "full",
    });
  }
});

test("combines routes without allowing weaker paths to reduce coverage", () => {
  assert.deepEqual(classifyPaths(["docs/readme.md", "src/App.tsx", "ios/Trene/AppDelegate.swift"]), {
    has_changes: true,
    native: true,
    android: "representative",
    ios: "full",
  });
});

test("CLI reads newline-delimited stdin and emits GITHUB_OUTPUT values", () => {
  const script = fileURLToPath(new URL("../plan-ci.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    input: "src/App.tsx\nios/Trene/AppDelegate.swift\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    "has_changes=true\nnative=true\nandroid=representative\nios=full\n",
  );
});

test("CLI accepts changed paths from a file", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-ci-"));
  const changedPaths = join(directory, "paths.txt");
  writeFileSync(changedPaths, "docs/ci.md\n");
  const script = fileURLToPath(new URL("../plan-ci.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--file", changedPaths], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "has_changes=true\nnative=false\nandroid=none\nios=none\n");
});
