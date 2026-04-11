const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");

const requiredFiles = [
  ".gitignore",
  "DEPLOYMENT-NOTES.md",
  "HOSTINGER-VPS-DEPLOY.md",
  "deploy/ecosystem.config.example.cjs",
  "server/.env.example",
  "client/.env.example",
  "server/src/server.js",
  "server/src/config/db.js",
  "client/src/services/api.js"
];

const requiredIgnoreEntries = [
  ".env",
  ".env.*",
  "node_modules/",
  "server/src/uploads/",
  "*.log",
  "dist/",
  "build/",
  ".mysql-test/",
  "server/.mongo-data/"
];

const ensureFileExists = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
};

const ensureGitignoreEntries = () => {
  const gitignore = fs.readFileSync(path.join(rootDir, ".gitignore"), "utf8");

  for (const entry of requiredIgnoreEntries) {
    if (!gitignore.includes(entry)) {
      throw new Error(`Missing .gitignore entry: ${entry}`);
    }
  }
};

const runBuildChecks = () => {
  console.log("Building client for repository verification...");
  execSync("npm run build --prefix client", {
    cwd: rootDir,
    stdio: "inherit"
  });
};

const main = () => {
  console.log("Checking repository safety files...");
  requiredFiles.forEach(ensureFileExists);
  ensureGitignoreEntries();
  runBuildChecks();
  console.log("");
  console.log("Repository verification passed.");
};

try {
  main();
} catch (error) {
  console.error("");
  console.error("Repository verification failed.");
  console.error(error.message);
  process.exit(1);
}
