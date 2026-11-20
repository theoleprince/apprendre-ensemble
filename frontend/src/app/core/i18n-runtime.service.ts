import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OfflineStore } from './offline-store';
import { PrefsService } from './prefs.service';

interface Pattern {
  re: RegExp;
  target: string;
  weight: number;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);

/**
 * Traduction de l'interface a l'execution. Le francais est la langue source : chaque texte affiche est une cle.
 * Les packs de langue (JSON) viennent de l'administration (base de donnees, prioritaire) ou sont livres avec
 * l'application (/i18n/{lang}.json). Ajouter une langue = charger un pack, sans developpement.
 * Les contenus pedagogiques (titres et textes des cours) ne sont pas traduits ici : ils sont produits par langue.
 * Textes absents du pack : affiches en francais (repli).
 */
@Injectable({ providedIn: 'root' })
export class I18nRuntimeService {
  private http = inject(HttpClient);
  private prefs = inject(PrefsService);
  private store = inject(OfflineStore);

  /** Proportion du pack disponible pour la langue courante (0 a 1), pour informer l'utilisateur. */
  readonly coverage = signal<number | null>(null);
  readonly lang = signal('fr');

  private exact = new Map<string, string>();
  private patterns: Pattern[] = [];
  private originals = new WeakMap<Node, string>();
  private written = new WeakMap<Node, string>();
  private observer: MutationObserver | null = null;
  private keyCount = 0;

  start(): void {
    effect(() => {
      const lang = this.prefs.prefs().lang;
      void this.switchTo(lang);
    });
  }

  private async switchTo(lang: string): Promise<void> {
    this.lang.set(lang);
    if (lang === 'fr') {
      this.exact.clear();
      this.patterns = [];
      this.coverage.set(null);
      this.restoreAll();
      return;
    }
    const pack = await this.loadPack(lang);
    this.exact = new Map(Object.entries(pack).filter(([k]) => !/\{\d+\}/.test(k)));
    this.patterns = Object.entries(pack).filter(([k]) => /\{\d+\}/.test(k)).map(([k, v]) => ({ re: toRegex(k), target: v, weight: k.replace(/\{\d+\}/g, '').length }))
      // motifs les plus specifiques d'abord : « Leçon {0} sur {1} » avant « {0} min »
      .sort((a, b) => b.weight - a.weight);
    if (!this.keyCount) {
      const keys = await firstValueFrom(this.http.get<string[]>('/i18n/keys.json')).catch(() => [] as string[]);
      this.keyCount = keys.length;
    }
    this.coverage.set(this.keyCount ? Math.min(1, Object.keys(pack).length / this.keyCount) : null);
    this.translateTree(document.body);
    document.title = this.translate(document.title) ?? document.title;
    this.observe();
  }

  /** Pack de l'administration d'abord, puis pack livre ; garde sur l'appareil pour le hors ligne. */
  private async loadPack(lang: string): Promise<Record<string, string>> {
    const key = 'i18n-' + lang;
    for (const url of [`/api/public/i18n/${lang}`, `/i18n/${lang}.json`]) {
      try {
        const p = await firstValueFrom(this.http.get<Record<string, string>>(url));
        if (p && Object.keys(p).length) {
          await this.store.set('kv', key, p).catch(() => undefined);
          return p;
        }
      } catch {
        /* source suivante */
      }
    }
    return (await this.store.get<Record<string, string>>('kv', key).catch(() => undefined)) ?? {};
  }

  translate(text: string): string | null {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const hit = this.exact.get(t);
    if (hit) return hit;
    for (const p of this.patterns) {
      const m = p.re.exec(t);
      if (m) return p.target.replace(/\{(\d+)\}/g, (_, i) => m[Number(i) + 1] ?? '');
    }
    return null;
  }

  private translateTree(root: Node): void {
    if (this.lang() === 'fr') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 1 && (SKIP.has((n as Element).tagName) || (n as Element).closest('[data-no-i18n]'))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n: Node | null = root;
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) this.translateText(n as Text);
      else if (n.nodeType === Node.ELEMENT_NODE) this.translateAttrs(n as Element);
      n = walker.nextNode();
    }
  }

  private translateText(node: Text): void {
    const current = node.nodeValue ?? '';
    // valeur ecrite par Angular depuis notre derniere traduction : c'est un nouvel original
    if (this.written.get(node) !== current) this.originals.set(node, current);
    const orig = this.originals.get(node) ?? current;
    const tr = this.translate(orig);
    if (tr) {
      const lead = orig.match(/^\s*/)?.[0] ?? '';
      const trail = orig.match(/\s*$/)?.[0] ?? '';
      const out = lead + tr + trail;
      if (out !== current) {
        node.nodeValue = out;
      }
      this.written.set(node, out);
    }
  }

  private translateAttrs(el: Element): void {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const stored = el.getAttribute('data-i18n-' + a);
      const lastOut = el.getAttribute('data-i18n-out-' + a);
      const orig = stored && lastOut === v ? stored : v;
      const tr = this.translate(orig);
      if (tr && tr !== v) {
        el.setAttribute('data-i18n-' + a, orig);
        el.setAttribute('data-i18n-out-' + a, tr);
        el.setAttribute(a, tr);
      }
    }
  }

  private observe(): void {
    if (this.observer) return;
    this.observer = new MutationObserver((muts) => {
      if (this.lang() === 'fr') return;
      for (const m of muts) {
        if (m.type === 'characterData') this.translateText(m.target as Text);
        else if (m.type === 'attributes') this.translateAttrs(m.target as Element);
        else m.addedNodes.forEach((n) => this.translateTree(n));
      }
    });
    this.observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /** Retour au francais : on remet les textes d'origine. */
  private restoreAll(): void {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n: Node | null = walker.currentNode;
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) {
        const orig = this.originals.get(n);
        if (orig !== undefined && this.written.get(n) === n.nodeValue) n.nodeValue = orig;
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        for (const a of ATTRS) {
          const o = el.getAttribute('data-i18n-' + a);
          if (o !== null && el.getAttribute(a) === el.getAttribute('data-i18n-out-' + a)) el.setAttribute(a, o);
        }
      }
      n = walker.nextNode();
    }
  }
}

/** « Leçon {0} sur {1} » -> /^Leçon (.+?) sur (.+?)$/ */
function toRegex(key: string): RegExp {
  const parts = key.split(/(\{\d+\})/);
  const src = parts.map((p) => (/^\{\d+\}$/.test(p) ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
  return new RegExp('^' + src + '$');
}
