import { Injectable, effect, signal } from '@angular/core';

/** Code de langue ISO (fr, en, bba, fon...) : toute langue active du referentiel. */
export type Lang = string;

interface Prefs {
  lang: Lang;
  textScale: number; // 1 = normal
  highContrast: boolean;
  dataSaver: boolean; // ne jamais charger un media sans action explicite
  voiceRate: number;
}

const KEY = 'formation.prefs';
const DEFAULTS: Prefs = { lang: 'fr', textScale: 1, highContrast: false, dataSaver: true, voiceRate: 0.95 };

/** Preferences d'accessibilite, stockees sur l'appareil (appareils partages : par navigateur). */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly prefs = signal<Prefs>(load());

  constructor() {
    effect(() => {
      const p = this.prefs();
      localStorage.setItem(KEY, JSON.stringify(p));
      const root = document.documentElement;
      root.style.setProperty('--text-scale', String(p.textScale));
      root.classList.toggle('high-contrast', p.highContrast);
      root.lang = p.lang;
    });
  }

  update(patch: Partial<Prefs>): void {
    this.prefs.update((p) => ({ ...p, ...patch }));
  }
}

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}
