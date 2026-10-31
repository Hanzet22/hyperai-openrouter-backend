import test from "node:test";
import assert from "node:assert/strict";

const [major, minor, patch] = process.versions.node.split(".").map(Number);

const minimumPatched = new Map([
  [24, [22, 1]],
  [26, [12, 1]]
]);

test("runtime uses a supported, security-patched Node.js release", () => {
  assert.ok(
    minimumPatched.has(major),
    `Unsupported Node.js major version: ${process.versions.node}. Use Node.js 24.22.1 LTS or 26.12.1 Current.`
  );

  const [minimumMinor, minimumPatch] = minimumPatched.get(major);
  const isPatched =
    minor > minimumMinor ||
    (minor === minimumMinor && patch >= minimumPatch);

  assert.ok(
    isPatched,
    `Node.js ${process.versions.node} is below the patched release for this major. Upgrade to at least ${major}.${minimumMinor}.${minimumPatch}.`
  );
});
