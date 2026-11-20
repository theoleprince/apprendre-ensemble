import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
fs.mkdirSync('./resultats', { recursive: true });
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const res = [];
const ok = (n, c, d = '') => { res.push(!!c); console.log(c ? 'OK  ' : 'ECHEC', n, d); };
for (const lang of ['en', 'wo']) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && /Content Security Policy|CSP/.test(m.text()) && errors.push(m.text()));
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto('http://localhost:8088/catalogue', { waitUntil: 'networkidle0' });
  await p.evaluate((l) => localStorage.setItem('formation.prefs', JSON.stringify({ lang: l, textScale: 1, highContrast: false, dataSaver: true, voiceRate: 0.95 })), lang);
  await p.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const text = await p.evaluate(() => document.body.innerText);
  const ph = await p.$eval('.search input', (i) => i.placeholder).catch(() => '');
  await p.screenshot({ path: `./resultats/i18n-${lang}.png` });
  if (lang === 'en') {
    ok('EN : titres traduits', text.includes('Programmes (') && text.includes('Courses ('), text.slice(0, 0));
    ok('EN : texte d\'attribut traduit', ph === 'Search a course, a skill…', ph);
    ok('EN : motif avec nombre traduit', /\d+ courses/.test(text));
    await p.click('.tabs button:nth-child(2)'); await new Promise((r) => setTimeout(r, 800));
    const t2 = await p.evaluate(() => document.body.innerText);
    ok('EN : contenu ajoute dynamiquement traduit', /\d+ lessons/.test(t2));
  } else {
    ok('WO : pack administre applique', text.includes('Katalog (test)'));
    ok('WO : repli francais pour les textes non traduits', text.includes('Tous les publics'));
  }
  ok(`${lang} : aucune erreur (CSP, script)`, errors.length === 0, errors.join(' | ').slice(0, 120));
  await ctx.close();
}
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} verifications reussies`);
