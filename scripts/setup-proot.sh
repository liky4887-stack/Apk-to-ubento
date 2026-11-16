#!/bin/bash
# setup-proot.sh — builds REA inside proot Ubuntu on Termux
set -e

echo "Installing dependencies..."
apt update && apt install -y curl git openjdk-21-jdk
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

echo "Cloning REA..."
git clone --depth 1 https://github.com/morluto/rea.git /root/rea
cd /root/rea

echo "Patching TypeScript..."
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json","utf8"));
p.devDependencies = p.devDependencies || {};
p.devDependencies.typescript = "6.0.3";
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
'

cat > scripts/run-typescript.mjs <<'MJS'
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const resolveTypeScriptCompiler = () => {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("typescript/package.json");
  const metadata = JSON.parse(readFileSync(packagePath, "utf8"));
  return {
    name: "typescript",
    identity: `typescript@${metadata.version}`,
    launcher: resolve(dirname(packagePath), metadata.bin["tsc"]),
  };
};

const main = async () => {
  const compiler = resolveTypeScriptCompiler();
  if (process.env.TURBO_HASH !== undefined && process.env.REA_TYPESCRIPT_COMPILER !== compiler.identity) {
    throw new Error("Compiler identity is missing or stale. Run Turbo through scripts/run-turbo.mjs.");
  }
  await import(pathToFileURL(compiler.launcher).href);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
MJS

echo "Installing packages (long)..."
npm install --no-audit --no-fund
rm -rf node_modules/tsrs node_modules/@tsrs
npm install --no-audit --no-fund

echo "Building..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build
echo "Done. REA is native at /root/rea."
