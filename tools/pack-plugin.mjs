#!/usr/bin/env node
/**
 * Packs a plugin folder into a `.runeslate` archive (ZIP with manifest.json at the root).
 * Usage: node tools/pack-plugin.mjs <pluginDir> [outFile]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { zipSync } from 'fflate';

const [, , dirArg, outArg] = process.argv;
if (!dirArg) {
  console.error('Usage: node tools/pack-plugin.mjs <pluginDir> [outFile]');
  process.exit(1);
}

const dir = resolve(dirArg);
const out = resolve(outArg ?? join(dirname(dir), `${basename(dir)}.runeslate`));
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

/** @type {Record<string, Uint8Array>} */
const files = {};
function walk(current) {
  for (const name of readdirSync(current).sort()) {
    if (name.startsWith('.')) continue;
    const full = join(current, name);
    if (statSync(full).isDirectory()) walk(full);
    else files[relative(dir, full).split(sep).join('/')] = new Uint8Array(readFileSync(full));
  }
}
walk(dir);

if (!files[manifest.main]) {
  console.error(`manifest.main not found: ${manifest.main}`);
  process.exit(1);
}

// Fixed mtime keeps the archive reproducible.
const zipped = zipSync(files, { level: 9, mtime: new Date('2020-01-01T00:00:00Z') });
writeFileSync(out, zipped);
console.log(`Packed ${manifest.id}@${manifest.version} (${Object.keys(files).length} files) -> ${relative(process.cwd(), out)}`);
