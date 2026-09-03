import assert from "node:assert/strict";
import test from "node:test";

import { validateNativeE2eStability } from "../validate-native-e2e-stability.mjs";

const revision = "a".repeat(40);
const successfulRun = (number) => ({
  revision,
  conclusion: "success",
  url: `https://github.com/kvalle/trene/actions/runs/${number}`,
});

test("accepts complete unchanged-revision stability evidence", () => {
  assert.doesNotThrow(() =>
    validateNativeE2eStability({
      revision,
      focusedAndroidStandaloneRuns: [successfulRun(1), successfulRun(2)],
      completeNativeRuns: Array.from({ length: 10 }, (_, index) => successfulRun(index + 3)),
      negativeControl: { conclusion: "failure", url: "https://github.com/kvalle/trene/actions/runs/13" },
    }),
  );
});

test("rejects incomplete, mixed-revision, and green negative evidence", () => {
  assert.throws(
    () =>
      validateNativeE2eStability({
        revision,
        focusedAndroidStandaloneRuns: [successfulRun(1)],
        completeNativeRuns: [],
      }),
    /two focused Android standalone runs/,
  );
  assert.throws(
    () =>
      validateNativeE2eStability({
        revision,
        focusedAndroidStandaloneRuns: [successfulRun(1), successfulRun(2)],
        completeNativeRuns: [
          ...Array.from({ length: 9 }, (_, index) => successfulRun(index + 3)),
          { ...successfulRun(12), revision: "b".repeat(40) },
        ],
        negativeControl: { conclusion: "success", url: "https://example.test/run" },
      }),
    /recorded revision/,
  );
});
