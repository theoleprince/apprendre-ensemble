import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { AudienceService } from '../core/audience.service';
import { Catalog, CatalogCourse, CatalogProgram, LEVEL_LABELS, Level, courseStatus } from '../core/models';
import { CourseCardComponent } from '../shared/course-card.component';
import { IconComponent } from '../shared/icon.component';

type Tab = 'formations' | 'cours';
type Sort = 'pertinence' | 'populaires' | 'notes' | 'recents' | 'courts';
type Duration = '' | 'court' | 'moyen' | 'long';

const LANGS: Record<string, string> = { fr: 'Français', en: 'English', fon: 'Fongbe', bba: 'Baatonum', ddn: 'Dendi', wo: 'Wolof' };

/**
 * Catalogue consultable sans compte : recherche, filtres (public, niveau, duree, langue, domaine, prix), tri.
 * Les filtres sont dans l'adresse : une recherche se partage et survit au retour arriere.
 */
@Component({
  selector: 'app-catalog',
  imports: [FormsModule, NgTemplateOutlet, RouterLink, IconComponent, CourseCardComponent],
  template: `
    <section class="cat-head">
      <h1>Catalogue</h1>
      <p class="muted">Des formations certifiantes et des cours courts, à suivre à votre rythme, même sans connexion.</p>
      <div class="search">
        <app-icon name="search" [size]="20" />
        <input type="search" [ngModel]="q()" (ngModelChange)="set('q', $event)" name="q" placeholder="Rechercher un cours, une compétence…" aria-label="Rechercher" />
        @if (q()) { <button class="icon-btn ghost" (click)="set('q', '')" aria-label="Effacer la recherche"><app-icon name="x" [size]="18" /></button> }
      </div>
    </section>

    @if (error()) { <p class="error">{{ error() }}</p> }

    <nav class="tabs" role="tablist">
      <button role="tab" [attr.aria-selected]="tab() === 'formations'" [class.active]="tab() === 'formations'" (click)="set('onglet', 'formations')"><app-icon name="graduation" [size]="18" /> Formations <span class="tab-n">{{ programs().length }}</span></button>
      <button role="tab" [attr.aria-selected]="tab() === 'cours'" [class.active]="tab() === 'cours'" (click)="set('onglet', 'cours')"><app-icon name="book-open" [size]="18" /> Cours <span class="tab-n">{{ courses().length }}</span></button>
    </nav>

    <div class="cat-toolbar">
      <button class="btn filters-toggle" (click)="filtersOpen.set(!filtersOpen())" [attr.aria-expanded]="filtersOpen()">
        <app-icon name="filter" [size]="16" /> Filtres @if (activeCount()) { <span class="tab-n">{{ activeCount() }}</span> }
      </button>
      <span class="small muted results">{{ results() }} résultat{{ results() > 1 ? 's' : '' }}</span>
      <label class="sort"><app-icon name="sort" [size]="16" /><span class="sr-only">Trier par</span>
        <select [ngModel]="sort()" (ngModelChange)="set('tri', $event)" name="tri" aria-label="Trier par">
          <option value="pertinence">Pertinence</option>
          <option value="populaires">Les plus suivis</option>
          <option value="notes">Les mieux notés</option>
          <option value="recents">Les plus récents</option>
          <option value="courts">Les plus courts</option>
        </select>
      </label>
    </div>

    <div class="filters" [class.open]="filtersOpen()">
      <div class="chips" role="group" aria-label="Prix">
        <button [class.active]="!price()" (click)="set('prix', '')">Tous</button>
        <button [class.active]="price() === 'gratuit'" (click)="set('prix', 'gratuit')">Gratuits</button>
        <button [class.active]="price() === 'payant'" (click)="set('prix', 'payant')">Payants</button>
      </div>
      <select [ngModel]="audience()" (ngModelChange)="set('public', $event)" name="public" aria-label="Public">
        <option value="">Tous les publics</option>
        @for (a of aud.list(); track a.code) { <option [value]="a.code">{{ a.label }}</option> }
      </select>
      <select [ngModel]="level()" (ngModelChange)="set('niveau', $event)" name="niveau" aria-label="Niveau">
        <option value="">Tous les niveaux</option>
        @for (l of levels; track l.key) { <option [value]="l.key">{{ l.label }}</option> }
      </select>
      <select [ngModel]="duration()" (ngModelChange)="set('duree', $event)" name="duree" aria-label="Durée">
        <option value="">Toutes les durées</option>
        <option value="court">Moins d'une heure</option>
        <option value="moyen">1 à 3 heures</option>
        <option value="long">Plus de 3 heures</option>
      </select>
      @if (languages().length > 1) {
        <select [ngModel]="lang()" (ngModelChange)="set('langue', $event)" name="langue" aria-label="Langue">
          <option value="">Toutes les langues</option>
          @for (l of languages(); track l) { <option [value]="l">{{ langLabel(l) }}</option> }
        </select>
      }
      @if (tab() === 'cours') {
        <select [ngModel]="domain()" (ngModelChange)="set('domaine', $event)" name="domaine" aria-label="Domaine">
          <option value="">Tous les domaines</option>
          @for (d of cat()?.domains ?? []; track d.id) { <option [value]="'' + d.id">{{ d.name }}</option> }
        </select>
      }
      @if (activeCount()) { <button class="btn ghost" (click)="clear()"><app-icon name="x" [size]="16" /> Effacer les filtres</button> }
    </div>

    @if (auth.isLoggedIn() && !auth.isStaff()) {
      <a class="card flat orient" routerLink="/bienvenue">
        <app-icon name="compass" [size]="26" />
        <div style="flex:1"><strong>Vous ne savez pas par où commencer ?</strong><div class="small muted">Répondez à 4 questions : nous vous conseillons un parcours.</div></div>
        <app-icon name="arrow" />
      </a>
    }

    @if (!cat()) {
      <div class="card-grid">@for (i of [1, 2, 3, 4, 5, 6]; track i) {<div class="skeleton cc-skel"></div>}</div>
    } @else if (tab() === 'formations') {
      <div class="card-grid section">
        @for (p of programs(); track p.id) {
          @let me = enrolledProgram(p.id);
          <app-course-card [item]="p" kind="program" [forMe]="forMe(p.targetRoles)" [popularFrom]="popular()"
                           [progress]="me ? me.percent : null" [status]="me ? me.percent + ' % · inscrit·e' : null" />
        }
      </div>
      @if (!programs().length) { <ng-container *ngTemplateOutlet="empty" /> }
    } @else {
      <div class="card-grid section">
        @for (c of courses(); track c.id) {
          @let me = enrolledCourse(c.id);
          <app-course-card [item]="c" [forMe]="forMe(c.targetRoles)" [popularFrom]="popular()"
                           [progress]="me ? status(me).percent : null" [status]="me ? status(me).percent + ' % · ' + status(me).label : null" />
        }
      </div>
      @if (!courses().length) { <ng-container *ngTemplateOutlet="empty" /> }
    }

    <ng-template #empty>
      <div class="empty-state">
        <app-icon name="search" [size]="36" />
        <h3>Aucun résultat</h3>
        <p class="muted">Essayez un autre mot ou retirez des filtres.</p>
        <button class="btn" (click)="clear()">Effacer la recherche et les filtres</button>
      </div>
    </ng-template>
  `,
})
export class CatalogPage implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(CatalogApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected aud = inject(AudienceService);

  cat = signal<Catalog | null>(null);
  error = signal('');
  filtersOpen = signal(false);
  levels = (Object.keys(LEVEL_LABELS) as Level[]).map((k) => ({ key: k, label: LEVEL_LABELS[k] }));

  /** Etat = parametres de l'adresse. */
  private params = signal<Record<string, string>>({});
  q = computed(() => this.params()['q'] ?? '');
  tab = computed<Tab>(() => (this.params()['onglet'] === 'cours' ? 'cours' : 'formations'));
  price = computed(() => this.params()['prix'] ?? '');
  audience = computed(() => this.params()['public'] ?? '');
  level = computed(() => this.params()['niveau'] ?? '');
  duration = computed(() => (this.params()['duree'] ?? '') as Duration);
  lang = computed(() => this.params()['langue'] ?? '');
  domain = computed(() => this.params()['domaine'] ?? '');
  sort = computed(() => (this.params()['tri'] ?? 'pertinence') as Sort);
  activeCount = computed(() => ['prix', 'public', 'niveau', 'duree', 'langue', 'domaine'].filter((k) => this.params()[k]).length);

  languages = computed(() => [...new Set((this.cat()?.courses ?? []).map((c) => c.languageCode).filter((l): l is string => !!l))]);

  programs = computed(() => this.sorted((this.cat()?.programs ?? []).filter((p) =>
    this.keep(p.title + ' ' + p.description + ' ' + p.domains.join(' '), p.price, p.targetRoles, p.level, p.totalMinutes, null))));
  courses = computed(() => this.sorted((this.cat()?.courses ?? []).filter((c) =>
    this.keep(c.title + ' ' + c.description + ' ' + (c.domainName ?? ''), c.price, c.targetRoles, c.level, c.totalMinutes, c.languageCode)
    && (!this.domain() || String(c.domainId) === this.domain()))));
  results = computed(() => (this.tab() === 'cours' ? this.courses() : this.programs()).length);

  popular = computed(() => {
    const l = [...(this.cat()?.courses ?? []), ...(this.cat()?.programs ?? [])].map((x) => x.learners).sort((a, b) => b - a);
    return l.length >= 4 ? Math.max(1, l[Math.floor(l.length / 5)]) : Number.MAX_SAFE_INTEGER;
  });

  constructor() {
    this.route.queryParamMap.subscribe((m) => {
      const o: Record<string, string> = {};
      m.keys.forEach((k) => (o[k] = m.get(k) ?? ''));
      this.params.set(o);
    });
    // un filtre actif ouvre le panneau sur mobile
    effect(() => {
      const n = this.activeCount();
      untracked(() => n && this.filtersOpen.set(true));
    });
  }

  async ngOnInit(): Promise<void> {
    void this.aud.load();
    try {
      this.cat.set((await this.api.catalog()).data);
      if (this.auth.isLoggedIn()) await this.api.myLearning().catch(() => undefined);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  set(key: string, value: string): void {
    const p = { ...this.params(), [key]: value };
    if (key === 'onglet' && value === 'formations') delete p['domaine'];
    Object.keys(p).forEach((k) => !p[k] && delete p[k]);
    void this.router.navigate([], { queryParams: p, replaceUrl: true });
  }

  clear(): void {
    const keep = this.tab() === 'cours' ? { onglet: 'cours' } : {};
    void this.router.navigate([], { queryParams: keep, replaceUrl: true });
  }

  private keep(text: string, price: number, roles: string[], level: string, minutes: number, lang: string | null): boolean {
    const q = norm(this.q());
    if (q && !q.split(/\s+/).every((w) => norm(text).includes(w))) return false;
    if (this.price() === 'gratuit' && price > 0) return false;
    if (this.price() === 'payant' && price === 0) return false;
    if (this.audience() && roles.length && !roles.includes(this.audience())) return false;
    if (this.level() && level !== this.level()) return false;
    const d = this.duration();
    if (d === 'court' && minutes >= 60) return false;
    if (d === 'moyen' && (minutes < 60 || minutes > 180)) return false;
    if (d === 'long' && minutes <= 180) return false;
    if (this.lang() && lang && lang !== this.lang()) return false;
    return true;
  }

  private sorted<T extends CatalogCourse | CatalogProgram>(list: T[]): T[] {
    const s = this.sort();
    const by = (f: (x: T) => number) => [...list].sort((a, b) => f(b) - f(a));
    switch (s) {
      case 'populaires': return by((x) => x.learners);
      case 'notes': return by((x) => x.rating * 1000 + x.ratingCount);
      case 'recents': return by((x) => Date.parse((x as CatalogCourse).updatedAt ?? '') || x.id);
      case 'courts': return [...list].sort((a, b) => a.totalMinutes - b.totalMinutes);
      default: return [...list].sort((a, b) => Number(this.forMe(b.targetRoles)) - Number(this.forMe(a.targetRoles)) || b.learners - a.learners);
    }
  }

  forMe(roles: string[]): boolean {
    const u = this.auth.user();
    const me = u?.audience || u?.role;
    return !!me && roles.includes(me);
  }

  enrolledCourse(id: number) {
    return this.api.mine()?.courses.find((c) => c.courseId === id) ?? null;
  }

  enrolledProgram(id: number) {
    return this.api.mine()?.programs.find((p) => p.programId === id) ?? null;
  }

  langLabel(code: string): string {
    return LANGS[code] ?? code.toUpperCase();
  }

  status = courseStatus;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}
