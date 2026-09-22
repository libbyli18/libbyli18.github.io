// Scans photos/<category>/ for real image files and writes photos-data.js,
// which index.html loads as window.REAL_PHOTOS. Run this after adding or
// removing photos; see photos/README.md for the day-to-day workflow.
//
// Only reads real width/height and a title from each file — never modifies
// or moves the originals. Safe to re-run any time.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATEGORIES = {
  travel: "Travel",
  personal: "Personal",
  bruin: "Bruin",
};
const SUPPORTED = new Set([".jpg", ".jpeg", ".png"]);

// ---- Minimal image-dimension readers (no dependencies) ----
// Just enough of each format's header to pull width/height; real decoding
// (color data, orientation, etc.) is left entirely to the browser.

function readPngSize(buf) {
  if (buf.length < 24) return null;
  const isPng = buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a;
  if (!isPng) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) { offset++; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; } // SOI/EOI
    if (marker >= 0xd0 && marker <= 0xd7) { offset += 2; continue; } // RSTn
    if (offset + 4 > buf.length) break;
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (offset + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    const segLength = buf.readUInt16BE(offset + 2);
    offset += 2 + segLength;
  }
  return null;
}

function readImageSize(filePath, ext) {
  // Headers live in the first few KB; no need to read the whole file.
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(65536);
  const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const head = buf.subarray(0, bytesRead);
  return ext === ".png" ? readPngSize(head) : readJpegSize(head);
}

function titleFromFilename(filename, fallback) {
  const base = filename.replace(/\.[^.]+$/, "");
  const stripped = base.replace(/^\d+[-_.\s]*/, "");
  const words = (stripped || base).replace(/[-_]+/g, " ").trim();
  if (!words) return fallback;
  return words.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Reads one image file into a {src, w, h} triple, relative to the project
// root (what the browser will actually request), or null if it's missing
// dimensions or an unsupported format — the caller decides what to do then.
function readOne(absPath, relSrc) {
  const ext = path.extname(absPath).toLowerCase();
  if (!SUPPORTED.has(ext)) return { skip: relSrc };
  const size = readImageSize(absPath, ext);
  if (!size || !size.width || !size.height) return { skip: `${relSrc} (couldn't read dimensions)` };
  return { src: relSrc, w: size.width, h: size.height };
}

const result = {};
let totalCards = 0, totalPhotos = 0;
const skipped = [];

for (const [key, short] of Object.entries(CATEGORIES)) {
  const dir = path.join(__dirname, "photos", key);
  if (!fs.existsSync(dir)) { result[key] = []; continue; }

  // Files and subfolders sort together, so a numeric prefix on either
  // controls where it lands relative to the other — 01-x.jpg before
  // 02-set/ before 03-y.jpg, in one shared order.
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cards = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // A mini-gallery: every image inside becomes one photo in this card's
      // set, all sharing the folder's name as their title (same as the
      // placeholder sets already do — one title per card, not per photo,
      // since individual filenames inside a shoot are rarely meaningful).
      const t = titleFromFilename(entry.name, `${short} ${cards.length + 1}`);
      const innerFiles = fs.readdirSync(entryPath).filter((f) => !f.startsWith(".")).sort();
      const sets = [];
      for (const file of innerFiles) {
        const filePath = path.join(entryPath, file);
        if (!fs.statSync(filePath).isFile()) continue;
        const read = readOne(filePath, `photos/${key}/${entry.name}/${file}`);
        if (read.skip) { skipped.push(read.skip); continue; }
        sets.push({ ...read, t });
      }
      if (!sets.length) continue; // empty or all-skipped subfolder
      cards.push({ sets });
      continue;
    }

    // A loose file at the top level: a single-photo card, same as every
    // card was before mini-galleries existed.
    if (!entry.isFile()) continue;
    const t = titleFromFilename(entry.name, `${short} ${cards.length + 1}`);
    const read = readOne(entryPath, `photos/${key}/${entry.name}`);
    if (read.skip) { skipped.push(read.skip); continue; }
    cards.push({ sets: [{ ...read, t }] });
  }

  result[key] = cards;
  totalCards += cards.length;
  totalPhotos += cards.reduce((n, c) => n + c.sets.length, 0);
}

const banner =
  "// Generated by build-photos.mjs — do not edit by hand.\n" +
  "// Re-run `node build-photos.mjs` after adding or removing photos.\n";
const body = `window.REAL_PHOTOS = ${JSON.stringify(result, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, "photos-data.js"), banner + body);

console.log(`photos-data.js written — ${totalCards} card(s), ${totalPhotos} photo(s) total`);
for (const [key, cards] of Object.entries(result)) {
  const photos = cards.reduce((n, c) => n + c.sets.length, 0);
  const sets = cards.filter((c) => c.sets.length > 1).length;
  console.log(`  ${key}: ${cards.length} card(s), ${photos} photo(s)${sets ? ` (${sets} mini-galleries)` : ""}`);
}
if (skipped.length) {
  console.log(`\nSkipped ${skipped.length} file(s):`);
  skipped.forEach((s) => console.log(`  - ${s}`));
  console.log("(JPG/JPEG/PNG only — convert anything else first, see photos/README.md)");
}
