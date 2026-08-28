// =====================================================
// SUPABASE STORAGE UPLOAD - Automatický nahrávač
// =====================================================
// Tento skript nahraje všechny soubory z lokální složky
// do Supabase Storage bucketu "sokrates-content"
// =====================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// =====================================================
// 🔐 KONFIGURACE
// =====================================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pionxzqtxcughvfbgadi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY není nastaven v .env.local'); process.exit(1); }
const BUCKET_NAME = 'sokrates-content';

// Cesty k souborům na disku
const BASE_PATH = 'C:/projekty/chytreja-app';

const UPLOAD_SOURCES = [
  {
    local: path.join(BASE_PATH, 'data/universes/longevity/content/docs/dlouhovekost'),
    remote: 'docs/dlouhovekost'
  },
  {
    local: path.join(BASE_PATH, 'app/content/longevity/media'),
    remote: 'media'
  }
];

// =====================================================
// 🚀 INICIALIZACE
// =====================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================================================
// 📁 FUNKCE PRO PROCHÁZENÍ SOUBORŮ
// =====================================================
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// =====================================================
// ⬆️ FUNKCE PRO UPLOAD SOUBORU
// =====================================================
async function uploadFile(localPath, remotePath) {
  try {
    const fileBuffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);

    // Určení MIME typu
    const ext = path.extname(localPath).toLowerCase();
    const mimeTypes = {
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Upload do Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(remotePath, fileBuffer, {
        contentType,
        upsert: true // Přepiš pokud existuje
      });

    if (error) {
      console.error(`❌ Chyba při uploadu ${remotePath}:`, error.message);
      return false;
    }

    console.log(`✅ Nahráno: ${remotePath}`);
    return true;

  } catch (error) {
    console.error(`❌ Chyba při čtení souboru ${localPath}:`, error.message);
    return false;
  }
}

// =====================================================
// 🎯 HLAVNÍ FUNKCE
// =====================================================
async function main() {
  console.log('🚀 Začínám upload do Supabase Storage...\n');

  let totalFiles = 0;
  let uploadedFiles = 0;
  let failedFiles = 0;

  for (const source of UPLOAD_SOURCES) {
    console.log(`\n📂 Procházím: ${source.local}`);
    console.log(`   → Cíl: ${source.remote}\n`);

    // Kontrola existence složky
    if (!fs.existsSync(source.local)) {
      console.warn(`⚠️  Složka neexistuje: ${source.local}`);
      continue;
    }

    // Získej všechny soubory
    const files = getAllFiles(source.local);
    totalFiles += files.length;

    console.log(`   Nalezeno souborů: ${files.length}\n`);

    // Nahraj každý soubor
    for (const filePath of files) {
      // Vytvoř relativní cestu
      const relativePath = path.relative(source.local, filePath);
      const remotePath = path.join(source.remote, relativePath).replace(/\\/g, '/');

      const success = await uploadFile(filePath, remotePath);

      if (success) {
        uploadedFiles++;
      } else {
        failedFiles++;
      }
    }
  }

  // Výsledný report
  console.log('\n' + '='.repeat(50));
  console.log('📊 VÝSLEDEK UPLOADU:');
  console.log('='.repeat(50));
  console.log(`✅ Úspěšně nahráno: ${uploadedFiles}/${totalFiles}`);
  console.log(`❌ Selhalo: ${failedFiles}`);
  console.log('='.repeat(50) + '\n');

  // Výpis URL pro kontrolu
  console.log('🔗 Testovací URL (zkontroluj v prohlížeči):');
  console.log(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/docs/dlouhovekost/uvod.md`);
  console.log(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/media/pdf/kuchta.pdf`);
  console.log('\n✨ Hotovo!\n');
}

// =====================================================
// 🏃 SPUŠTĚNÍ
// =====================================================
main().catch(error => {
  console.error('💥 Fatální chyba:', error);
  process.exit(1);
});
