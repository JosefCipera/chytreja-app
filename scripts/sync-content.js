#!/usr/bin/env node
// =============================================================
// scripts/sync-content.js
// Sync MD soubory z app/content/longevity/clanky/ → Supabase
//
// Použití:  npm run sync-content
//
// Funguje BEZ frontmatteru (title z # nadpisu, summary z prvního odstavce).
// Volitelný YAML frontmatter pro extra metadata:
//
//   ---
//   title: Marginální dekáda – Peter Attia
//   url: https://www.youtube.com/watch?v=xxx    # originál (YouTube/Spotify apod.)
//   tags: [prevence, medicina30, attia]
//   source: The Drive Podcast
//   ---
//
// Pokud url chybí, soubor je dostupný přes Vercel staticky:
//   /content/longevity/clanky/[node-id]/[soubor].md
// =============================================================

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLANKY_DIR  = join(process.cwd(), 'app/content/longevity/clanky');
const STATIC_BASE = '/content/longevity/clanky'; // Vercel static path

// ── UUID v5 (deterministické z názvu souboru, bez externích deps) ────
const UUID_NS = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
function slugToUuid(slug) {
  const hash = createHash('sha1').update(UUID_NS).update(slug).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant
  return [
    hash.slice(0, 4).toString('hex'),
    hash.slice(4, 6).toString('hex'),
    hash.slice(6, 8).toString('hex'),
    hash.slice(8, 10).toString('hex'),
    hash.slice(10, 16).toString('hex'),
  ].join('-');
}

// ── Parsování frontmatteru ────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep < 1) continue;
    const key = line.slice(0, sep).trim();
    const raw = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    if (raw.startsWith('[')) {
      try { meta[key] = JSON.parse(raw.replace(/'/g, '"')); } catch { meta[key] = raw; }
    } else {
      meta[key] = raw;
    }
  }
  return { meta, body: match[2] };
}

// ── Extrakce titulku z prvního # nadpisu ─────────────────────
function extractTitle(body) {
  const m = body.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : null;
}

// ── Extrakce shrnutí z prvního odstavce ──────────────────────
function extractSummary(body, maxLen = 300) {
  const lines = body.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('---')
                   && !l.startsWith('*') && !l.startsWith('>') && !l.startsWith('-'));
  return lines.slice(0, 3).join(' ').slice(0, maxLen);
}

// ── Sync jednoho node-adresáře ────────────────────────────────
async function syncNode(nodeId, dir) {
  const files = readdirSync(dir).filter(f => extname(f) === '.md');
  let ok = 0, fail = 0;

  for (const file of files) {
    const content  = readFileSync(join(dir, file), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    const slug    = basename(file, '.md');
    const id      = slugToUuid(`${nodeId}/${slug}`);
    const title   = meta.title   || extractTitle(body) || slug.replace(/-/g, ' ');
    const summary = meta.summary || extractSummary(body);
    const url     = meta.url     || `${STATIC_BASE}/${nodeId}/${file}`;
    const tags    = Array.isArray(meta.tags) ? meta.tags
                    : meta.tags ? [meta.tags] : [];

    const { error } = await supabase
      .from('longevity_articles')
      .upsert({ id, node_id: nodeId, title, url, summary, tags }, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ ${file}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✅ ${file}`);
      console.log(`     → "${title}"`);
      ok++;
    }
  }
  return { ok, fail };
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔄  Sync obsahu → Supabase longevity_articles\n');

  let totalOk = 0, totalFail = 0;

  const entries = readdirSync(CLANKY_DIR);
  for (const entry of entries) {
    const fullPath = join(CLANKY_DIR, entry);
    if (!statSync(fullPath).isDirectory()) {
      console.log(`⚠️  Přeskočen (není složka): ${entry}`);
      continue;
    }
    console.log(`📁 ${entry}/`);
    const { ok, fail } = await syncNode(entry, fullPath);
    totalOk   += ok;
    totalFail += fail;
    console.log('');
  }

  console.log(`─────────────────────────────────────────`);
  console.log(`✅  Hotovo: ${totalOk} upserted, ${totalFail} failed`);
  if (totalOk > 0) {
    console.log('💡  Zdroje jsou dostupné v Mediátéce pro daný uzel.');
  }
}

main().catch(err => {
  console.error('❌  Sync selhal:', err);
  process.exit(1);
});
