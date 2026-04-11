const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourceHook = path.join(rootDir, "scripts", "githooks", "pre-push");
const targetHook = path.join(rootDir, ".git", "hooks", "pre-push");

if (!fs.existsSync(path.join(rootDir, ".git"))) {
  console.error("No .git directory found. Run this script from the repository root.");
  process.exit(1);
}

if (!fs.existsSync(sourceHook)) {
  console.error("Source hook template not found.");
  process.exit(1);
}

fs.copyFileSync(sourceHook, targetHook);

try {
  fs.chmodSync(targetHook, 0o755);
} catch {
  // Best effort only on platforms that support chmod.
}

console.log(`Installed pre-push hook at ${targetHook}`);
