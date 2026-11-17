import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CertificateLevel } from '../core/models';
import { PATHS } from './icon.component';

/** Palette des couvertures (teintes de la charte, texte blanc lisible : contraste >= 4.5:1). */
const COVERS = [
  ['#2f7d4f', '#1d5634'],
  ['#5b4bc4', '#3b2f96'],
  ['#c8553d', '#8f3524'],
  ['#1f7a8c', '#12515d'],
  ['#9a6b00', '#6b4a00'],
  ['#3d6b2f', '#23421a'],
];

/**
 * Couverture de module generee en SVG (aucune image a telecharger : ~1 Ko, nette sur tous les ecrans,
 * disponible hors ligne). Couleur stable par module, motif decoratif, pictogramme du module.
 */
@Component({
  selector: 'app-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 400 ' + h()" preserveAspectRatio="xMidYMid slice" role="img" [attr.aria-label]="label()">
      <defs>
        <linearGradient [attr.id]="gid()" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" [attr.stop-color]="colors()[0]" />
          <stop offset="1" [attr.stop-color]="colors()[1]" />
        </linearGradient>
      </defs>
      <rect width="400" [attr.height]="h()" [attr.fill]="'url(#' + gid() + ')'" />
      <circle [attr.cx]="330 - seed() % 40" [attr.cy]="h() * 0.2" [attr.r]="h() * 0.9" fill="#fff" opacity=".07" />
      <circle [attr.cx]="40 + seed() % 60" [attr.cy]="h()" [attr.r]="h() * 0.55" fill="#fff" opacity=".06" />
      <circle cx="360" [attr.cy]="h() - 10" r="26" fill="#f5c400" opacity=".9" />
      @for (d of dots(); track $index) { <circle [attr.cx]="d[0]" [attr.cy]="d[1]" r="2.2" fill="#fff" opacity=".35" /> }
      <g [attr.transform]="'translate(' + (200 - iconSize() / 2) + ' ' + (h() / 2 - iconSize() / 2) + ') scale(' + iconSize() / 24 + ')'"
         fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path [attr.d]="path()" />
      </g>
    </svg>
  `,
  styles: `:host{display:block;overflow:hidden;border-radius:inherit;line-height:0} svg{width:100%;height:100%;display:block}`,
})
export class CoverComponent {
  readonly icon = input<string | null>(null);
  readonly seed = input(0);
  readonly height = input(120);
  readonly label = input('');

  protected h = computed(() => this.height());
  protected colors = computed(() => COVERS[Math.abs(this.seed()) % COVERS.length]);
  protected gid = computed(() => `cg${this.seed()}-${this.height()}`);
  protected path = computed(() => PATHS[this.icon() ?? ''] ?? PATHS['book-open']);
  protected iconSize = computed(() => Math.round(this.h() * 0.46));
  protected dots = computed(() => {
    const out: number[][] = [];
    for (let i = 0; i < 18; i++) out.push([20 + ((i * 37 + this.seed() * 13) % 360), 10 + ((i * 53 + this.seed() * 7) % (this.h() - 20))]);
    return out;
  });
}

const MEDALS: Record<CertificateLevel, { from: string; to: string; ribbon: string; icon: string }> = {
  ATTESTATION: { from: '#3f9a65', to: '#1d5634', ribbon: '#2f7d4f', icon: 'scroll' },
  BADGE: { from: '#7a6be0', to: '#3b2f96', ribbon: '#5b4bc4', icon: 'badge-check' },
  MAITRISE: { from: '#f2cf4a', to: '#b8860b', ribbon: '#c8553d', icon: 'medal' },
  EXPERTISE: { from: '#e8835f', to: '#8f3524', ribbon: '#1d5634', icon: 'trophy' },
};

/** Medaille de certification (un visuel par niveau). Grisee tant que le niveau n'est pas obtenu. */
@Component({
  selector: 'app-medal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 64 72" [attr.width]="size()" [attr.height]="size() * 1.125" [class.off]="!earned()" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="'m' + level()" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" [attr.stop-color]="m().from" /><stop offset="1" [attr.stop-color]="m().to" />
        </linearGradient>
      </defs>
      <path d="M20 40 L12 70 L24 63 L30 72 L32 44 Z" [attr.fill]="m().ribbon" />
      <path d="M44 40 L52 70 L40 63 L34 72 L32 44 Z" [attr.fill]="m().ribbon" opacity=".85" />
      <circle cx="32" cy="28" r="26" [attr.fill]="'url(#m' + level() + ')'" />
      <circle cx="32" cy="28" r="21" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="3 3" />
      <g transform="translate(20 16)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path [attr.d]="iconPath()" />
      </g>
    </svg>
  `,
  styles: `:host{display:inline-flex;line-height:0} svg.off{filter:grayscale(1);opacity:.35}`,
})
export class MedalComponent {
  readonly level = input.required<CertificateLevel>();
  readonly earned = input(true);
  readonly size = input(56);
  protected m = computed(() => MEDALS[this.level()]);
  protected iconPath = computed(() => PATHS[this.m().icon]);
}

/** Avatar a initiales (pas de photo : protection des donnees, appareils partages). */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [style.background]="bg()" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.38">{{ initials() }}</span>`,
  styles: `:host{display:inline-flex;flex:none} span{display:grid;place-items:center;border-radius:50%;color:#fff;font-weight:700;letter-spacing:.02em}`,
})
export class AvatarComponent {
  readonly name = input('');
  readonly size = input(38);
  protected initials = computed(() =>
    this.name()
      .split(/[\s·-]+/)
      .filter((w) => /[A-Za-zÀ-ÿ]/.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(''),
  );
  protected bg = computed(() => {
    let h = 0;
    for (const c of this.name()) h = (h * 31 + c.charCodeAt(0)) | 0;
    return COVERS[Math.abs(h) % COVERS.length][0];
  });
}

/** Illustration de la page de connexion : telephone, lecon video, hors ligne, certificat. SVG vectoriel (~2 Ko). */
@Component({
  selector: 'app-hero-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 420 300" role="img" aria-label="Téléphone affichant une leçon vidéo disponible hors connexion">
      <circle cx="210" cy="150" r="130" fill="#fff" opacity=".06" />
      <circle cx="330" cy="70" r="34" fill="#f5c400" opacity=".9" />
      <!-- feuilles -->
      <path d="M60 250c0-50 30-80 70-90-5 45-30 80-70 90z" fill="#8fd19e" opacity=".55" />
      <path d="M95 262c10-38 40-58 75-60-12 35-40 55-75 60z" fill="#5fb378" opacity=".6" />
      <!-- telephone -->
      <rect x="150" y="40" width="130" height="235" rx="20" fill="#13261b" />
      <rect x="158" y="52" width="114" height="211" rx="12" fill="#f7f5ef" />
      <rect x="166" y="64" width="98" height="62" rx="8" fill="#2f7d4f" />
      <circle cx="215" cy="95" r="15" fill="#fff" opacity=".95" />
      <path d="M210 87v16l13-8z" fill="#2f7d4f" />
      <rect x="166" y="136" width="70" height="7" rx="3.5" fill="#17231c" opacity=".75" />
      <rect x="166" y="150" width="96" height="5" rx="2.5" fill="#6d7a72" opacity=".4" />
      <rect x="166" y="160" width="84" height="5" rx="2.5" fill="#6d7a72" opacity=".4" />
      <rect x="166" y="178" width="98" height="8" rx="4" fill="#e5e9e2" />
      <rect x="166" y="178" width="64" height="8" rx="4" fill="#2f7d4f" />
      <rect x="166" y="200" width="98" height="30" rx="10" fill="#f5c400" />
      <rect x="190" y="212" width="50" height="6" rx="3" fill="#2b2200" opacity=".7" />
      <!-- pastille hors ligne -->
      <g transform="translate(262 120)">
        <rect width="104" height="34" rx="17" fill="#fff8d6" />
        <g transform="translate(10 7) scale(.83)" fill="none" stroke="#6b5300" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="paths.wifiOff" /></g>
        <text x="38" y="22" font-size="12" font-weight="700" fill="#6b5300" font-family="system-ui, sans-serif">Hors ligne</text>
      </g>
      <!-- medaille -->
      <g transform="translate(92 70)">
        <path d="M14 30 L8 54 L17 49 L22 56 L24 34 Z" fill="#c8553d" />
        <path d="M34 30 L40 54 L31 49 L26 56 L24 34 Z" fill="#c8553d" opacity=".85" />
        <circle cx="24" cy="22" r="20" fill="#f2cf4a" stroke="#b8860b" stroke-width="2" />
        <g transform="translate(14 12) scale(.85)" fill="none" stroke="#7a5a00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="paths.medal" /></g>
      </g>
      <!-- bulle IA -->
      <g transform="translate(284 196)">
        <rect width="92" height="44" rx="14" fill="#5b4bc4" />
        <path d="M16 44 l-2 12 14-12z" fill="#5b4bc4" />
        <g transform="translate(12 10)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="paths.sparkles" /></g>
        <rect x="42" y="14" width="38" height="5" rx="2.5" fill="#fff" opacity=".85" />
        <rect x="42" y="25" width="28" height="5" rx="2.5" fill="#fff" opacity=".6" />
      </g>
    </svg>
  `,
  styles: `:host{display:block} svg{width:100%;height:auto;max-width:460px}`,
})
export class HeroArtComponent {
  protected paths = { wifiOff: PATHS['wifi-off'], medal: PATHS['award'], sparkles: PATHS['sparkles'] };
}
