#!/usr/bin/env node
// scripts/rename-parsing_shared.js
//
// Safely rename directory "parsing_shared" -> "parsing_shared" and update all import paths
// across the repository. Excludes node_modules, .git, and common binary directories.
// Usage:
//   node scripts/rename-parsing_shared.js
//
// This script:
// 1) Renames directories if present (fs.renameSync).
// 2) Scans files for the literal token `parsing_shared` and replaces with `parsing_shared`.
// 3) Writes files back with the replacement and prints a summary.
// NOTE: This modifies files in-place. Run under git and review the diff after running.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FROM = "parsing_shared";
const TO = "parsing_shared";
const IGNORES = new Set(["node_modules", ".git", ".next", "dist", "build", "venv", ".venv"]);

function isBinaryFile(filePath) {
  const binExts = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".gz", ".tgz", ".pdf"];
  return binExts.includes(path.extname(filePath).toLowerCase());
}

function walkDir(dir, cb) {
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of list) {
    if (IGNORES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      cb(full, true);
      walkDir(full, cb);
    } else if (ent.isFile()) {
      cb(full, false);
    }
  }
}

function replaceInFiles(root) {
  const modified = [];
  walkDir(root, (fullPath, isDir) => {
    if (isDir) return;
    if (isBinaryFile(fullPath)) return;
    const ext = path.extname(fullPath).toLowerCase();
    if (![".ts", ".tsx", ".js", ".jsx", ".json", ".md"].includes(ext)) return;
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes(FROM)) {
        const updated = content.split(FROM).join(TO);
        fs.writeFileSync(fullPath, updated, "utf8");
        modified.push(fullPath);
      }
    } catch (err) {
      console.error("Skipped file (read/write failed):", fullPath, err.message);
    }
  });
  return modified;
}

function renameDirs(root) {
  const moves = [];
  walkDir(root, (fullPath, isDir) => {
    if (!isDir) return;
    const base = path.basename(fullPath);
    if (base === FROM) {
      const target = path.join(path.dirname(fullPath), TO);
      try {
        if (fs.existsSync(target)) {
          console.warn("Target already exists, skipping rename:", fullPath, "->", target);
        } else {
          fs.renameSync(fullPath, target);
          moves.push({ from: fullPath, to: target });
        }
      } catch (err) {
        console.error("Failed to rename directory:", fullPath, err.message);
      }
    }
  });
  return moves;
}

function main() {
  console.log("Starting rename:", FROM, "->", TO);
  console.log("Root:", ROOT);

  // 1) Rename directories first (so subsequent file replacements hit new paths)
  const moves = renameDirs(ROOT);
  if (moves.length) {
    console.log("Renamed directories:");
    moves.forEach(m => console.log("  ", m.from, "->", m.to));
  } else {
    console.log("No directories renamed.");
  }

  // 2) Replace occurrences in files
  const modifiedFiles = replaceInFiles(ROOT);
  console.log("Files modified:", modifiedFiles.length);
  modifiedFiles.slice(0, 50).forEach(f => console.log("  ", path.relative(ROOT, f)));
  if (modifiedFiles.length > 50) console.log("  ... (more files modified)");

  // Summary & next steps
  console.log("\nDone. Review changes with git:");
  console.log("  git status --porcelain");
  console.log("  git diff");
  console.log("\nIf everything looks good commit the changes, e.g.:");
  console.log("  git add .");
  console.log(`  git commit -m "Rename ${FROM} -> ${TO} and update imports"`);
  console.log("Then re-run your Convex push / deploy.");
}

main();