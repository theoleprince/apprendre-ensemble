// Extraction des textes de l'interface (francais = langue source) vers public/i18n/keys.json.
// Usage : node scripts/extract-i18n.mjs
// Chaque texte affiche devient une cle ; les interpolations {{ ... }} deviennent {0}, {1}... (motifs).
// Inclut les messages d'erreur du serveur (Java) affiches tels quels a l'utilisateur.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'src', 'app');
const BACK = path.resolve(ROOT, '..', 'backend', 'src', 'main', 'java');
const OUT = path.join(ROOT, 'public', 'i18n', 'keys.json');

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext) && !p.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const keys = new Set();
const hasLetters = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s);
const looksTechnical = (s) =>
  /^M[\d.\s-]/.test(s) || // traces SVG
  /\$event|\(change\)|\(click\)|="|\.join\(|=>|\bthis\./.test(s) || // fragments de code
  (/^[a-z0-9_./:@#?=&%+-]+$/i.test(s) && !/^[A-ZÀ-Ý][a-zà-ÿ·]+$/.test(s)) || // identifiants, chemins, codes (pas les mots)
  /^(https?:|\/api|\/|#|[.][a-z])/.test(s) ||
  /[{}<>;]/.test(s.replace(/\{\d+\}/g, '')) ||
  /^[A-Z_]{3,}$/.test(s);

function addText(raw) {
  let n = 0;
  const t = raw
    .replace(/\{\{[\s\S]*?\}\}/g, () => `{${n++}}`)
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 2 || !hasLetters(t) || looksTechnical(t)) return;
  if (/^\{\d+\}$/.test(t)) return;
  keys.add(t);
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      // commentaire de fin de ligne hors chaine : on coupe au premier // precede d'un espace
      const i = line.search(/(^|\s)\/\/(?!\/)/);
      return i >= 0 && !/['"`][^'"`]*$/.test(line.slice(0, i)) ? line.slice(0, i) : line;
    })
    .join('\n');
}

for (const f of walk(SRC, '.ts')) {
  const src = fs.readFileSync(f, 'utf8');
  // 1. gabarits Angular
  for (const m of src.matchAll(/template:\s*`([\s\S]*?)`\s*,?\s*\n\s*\}\)/g)) {
    const tpl = m[1]
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/@(if|else if|for|switch|case|let|empty|default)\b[^{]*\{/g, '<x>')
      .replace(/@else\s*\{/g, '<x>')
      .replace(/\}/g, (c, i, s) => (s[i - 1] === '}' || s[i + 1] === '}' ? c : '<x>'));
    for (const t of tpl.matchAll(/>([^<>]+)</g)) addText(t[1]);
    for (const a of tpl.matchAll(/\s(?:placeholder|title|aria-label|alt|label)="([^"]+)"/g)) addText(a[1]);
    for (const e of tpl.matchAll(/'((?:[^'\\]|\\.)*?)'/g)) {
      const s = e[1].replace(/\\'/g, "'");
      if (/\s/.test(s) || /[À-ÿ]/.test(s)) addText(s);
    }
  }
  // 2. chaines du code (libelles, messages, toasts) : au moins un espace ou un accent
  const code = stripComments(src.replace(/template:\s*`[\s\S]*?`/g, ''));
  for (const m of code.matchAll(/(['`"])((?:(?!\1)[^\\\n]|\\.)*?)\1/g)) {
    const s = m[2].replace(/\\'/g, "'");
    if (/^import |from |^\s*$/.test(s)) continue;
    if (m[1] === '`' && s.includes('${')) {
      let n = 0;
      addText(s.replace(/\$\{[^}]*\}/g, () => `{{x${n++}}}`));
      continue;
    }
    if (/\s/.test(s) || /[À-ÿ]/.test(s) || /^[A-ZÀ-Ý][a-zà-ÿ·]+$/.test(s)) addText(s);
  }
}

// 3. messages du serveur affiches a l'utilisateur
for (const f of walk(BACK, '.java')) {
  if (f.includes('DataInitializer')) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/ResponseStatusException\(HttpStatus\.[A-Z_]+,\s*"((?:[^"\\]|\\.)*)"/g)) addText(m[1]);
  for (const m of src.matchAll(/Map\.of\("message",\s*"((?:[^"\\]|\\.)*)"/g)) addText(m[1]);
}

const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'fr'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n');
console.log(`${sorted.length} cles extraites -> ${path.relative(ROOT, OUT)}`);
