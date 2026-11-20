import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PrefsService } from './prefs.service';

export interface Branding {
  name: string;
  organization: string | null;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  supportEmail: string | null;
  footerNote: string | null;
  signatory1: string | null;
  signatory1Role: string | null;
  signatory2: string | null;
  signatory2Role: string | null;
}

const KEY = 'formation.branding';
const DEFAULT: Branding = {
  name: 'Plateforme de formation', organization: null, tagline: null, logoUrl: null,
  primaryColor: '#2f7d4f', accentColor: '#f5c400', supportEmail: null, footerNote: 'plateforme de démonstration',
  signatory1: null, signatory1Role: null, signatory2: null, signatory2Role: null,
};

// ---------- couleurs ----------
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function lum(hex: string): number {
  const c = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Contraste WCAG entre deux couleurs. */
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Variables CSS de la charte : nuances calculees a partir de deux couleurs, en clair et en sombre. */
export function brandCss(b: Branding): string {
  const p = b.primaryColor;
  const a = b.accentColor;
  const darkBg = '#0f1712';
  return `:root{--brand:${p};--brand-600:${mix(p, '#000000', 0.12)};--brand-700:${mix(p, '#000000', 0.3)};`
    + `--brand-50:${mix(p, '#ffffff', 0.9)};--brand-100:${mix(p, '#ffffff', 0.8)};--sun:${a};--sun-50:${mix(a, '#ffffff', 0.85)};}`
    + `html.dark{--brand:${mix(p, '#ffffff', 0.25)};--brand-600:${mix(p, '#ffffff', 0.42)};--brand-700:${mix(p, '#ffffff', 0.58)};`
    + `--brand-50:${mix(p, darkBg, 0.82)};--brand-100:${mix(p, darkBg, 0.68)};--sun-50:${mix(a, darkBg, 0.82)};}`;
}

/**
 * Identite visuelle chargee avant connexion et gardee sur l'appareil (pas de clignement au demarrage, fonctionne hors ligne).
 * Applique le nom, les couleurs et le titre de la page.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private http = inject(HttpClient);
  private prefs = inject(PrefsService);
  readonly brand = signal<Branding>(read());

  constructor() {
    effect(() => {
      const b = this.brand();
      let el = document.getElementById('brand-vars') as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = 'brand-vars';
        document.head.appendChild(el);
      }
      el.textContent = brandCss(b);
      document.title = b.name;
      const dark = this.prefs.isDark();
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1712' : b.primaryColor);
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      this.set(await firstValueFrom(this.http.get<Branding>('/api/public/branding')));
    } catch {
      /* hors ligne : derniere charte connue */
    }
  }

  set(b: Branding): void {
    this.brand.set(b);
    localStorage.setItem(KEY, JSON.stringify(b));
  }
}

function read(): Branding {
  try {
    return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Branding>) };
  } catch {
    return DEFAULT;
  }
}
