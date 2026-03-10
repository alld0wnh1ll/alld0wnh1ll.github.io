#!/usr/bin/env node
/**
 * Copy lab docs from docs/ to frontend/public/docs/ so they can be served and displayed in the GUI.
 * Run before build (prebuild) or manually.
 */
const fs = require('fs');
const path = require('path');

const docsSrc = path.join(__dirname, '..', '..', 'docs');
const docsDest = path.join(__dirname, '..', 'public', 'docs');

if (!fs.existsSync(docsSrc)) {
  console.warn('copy-docs: docs/ folder not found, skipping');
  process.exit(0);
}

fs.mkdirSync(docsDest, { recursive: true });
const files = fs.readdirSync(docsSrc).filter((f) => f.endsWith('.md'));
files.forEach((f) => {
  fs.copyFileSync(path.join(docsSrc, f), path.join(docsDest, f));
});
console.log(`copy-docs: Copied ${files.length} markdown files to public/docs/`);
