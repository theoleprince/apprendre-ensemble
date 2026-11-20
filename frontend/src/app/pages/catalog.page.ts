import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { Catalog, CatalogCourse, CatalogProgram, ROLE_LABELS, Role, courseStatus, durationLabel, priceLabel } from '../core/models';
import { AudienceService } from '../core/audience.service';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent } from '../shared/visuals';

type Tab = 'formations' | 'cours';
type PriceFilter = 'all' | 'free' | 'paid';

/** Catalogue consultable sans compte : on cherche, on filtre, on ouvre la fiche, on s'inscrit. */
@Component({
  selector: 'app-catalog',
  imports: [FormsModule, RouterLink, IconComponent, CoverComponent],
  template: `
    <section class="cat-head">
      <h1>Catalogue</h1>
      <p class="muted">Des formations certifiantes et des cours courts, à suivre à votre rythme, même sans connexion.</p>
      <div class="search">
        <app-icon name="search" [size]="20" />
        <input type="search" [(ngModel)]="q" name="q" placeholder="Rechercher un cours, une compétence…" aria-label="Rechercher" />
      </div>
    </section>

    @if (error()) { <p class="error">{{ error() }}</p> }

    <nav class="tabs">
      <button [class.active]="tab() === 'formations'" (click)="tab.set('formations')"><app-icon name="graduation" [size]="18" /> Formations ({{ programs().length }})</button>
      <button [class.active]="tab() === 'cours'" (click)="tab.set('cours')"><app-icon name="book-open" [size]="18" /> Cours ({{ courses().length }})</button>
    </nav>

    <div class="filters">
      <div class="chips">
        <button [class.active]="price() === 'all'" (click)="price.set('all')">Tous</button>
        <button [class.active]="price() === 'free'" (click)="price.set('free')">Gratuits</button>
        <button [class.active]="price() === 'paid'" (click)="price.set('paid')">Payants</button>
      </div>
      <select [(ngModel)]="role" name="role" aria-label="Public">
        <option value="">Tous les publics</option>
        @for (a of aud.list(); track a.code) { <option [value]="a.code">{{ a.label }}</option> }
      </select>
      @if (tab() === 'cours') {
        <select [(ngModel)]="domain" name="domain" aria-label="Domaine">
          <option [ngValue]="0">Tous les domaines</option>
          @for (d of cat()?.domains ?? []; track d.id) { <option [ngValue]="d.id">{{ d.name }}</option> }
        </select>
      }
    </div>

    @if (auth.isLoggedIn() && !auth.isStaff()) {
      <a class="card flat orient" routerLink="/bienvenue">
        <app-icon name="compass" [size]="26" />
        <div style="flex:1"><strong>Vous ne savez pas par où commencer ?</strong><div class="small muted">Répondez à 4 questions : nous vous conseillons un parcours.</div></div>
        <app-icon name="arrow" />
      </a>
    }

    @if (!cat()) {
      <div class="grid cols-3">@for (i of [1, 2, 3]; track i) {<div class="skeleton" style="height:260px"></div>}</div>
    } @else if (tab() === 'formations') {
      <div class="grid cols-3 section">
        @for (p of programs(); track p.id) {
          <a class="card course-card cat-card" [routerLink]="['/formations', p.id]">
            <app-cover class="card-cover" [icon]="p.icon" [seed]="p.id + 3" [height]="110" [label]="p.title" />
            <div class="row" style="justify-content:space-between">
              <span class="tag sun">Formation</span>
              @if (forMe(p.targetRoles)) { <span class="tag">Pour vous</span> }
            </div>
            <h3>{{ p.title }}</h3>
            <p class="small muted clamp">{{ p.description }}</p>
            <div class="meta"><span><app-icon name="book" [size]="14" /> {{ p.courseCount }} cours</span><span><app-icon name="clock" [size]="14" /> {{ dur(p.totalMinutes) }}</span><span><app-icon name="award" [size]="14" /> Certifiante</span></div>
            <div class="cat-foot">
              @if (enrolledProgram(p.id); as me) {
                <span class="small"><strong>{{ me.percent }} %</strong> · inscrit·e</span>
              } @else {
                <span class="price-tag" [class.free]="!p.price">{{ priceLabel(p.price) }}</span>
              }
              <span class="link small">Voir <app-icon name="arrow" [size]="14" /></span>
            </div>
          </a>
        } @empty { <p class="muted">Aucune formation ne correspond à votre recherche.</p> }
      </div>
    } @else {
      <div class="grid cols-3 section">
        @for (c of courses(); track c.id) {
          <a class="card course-card cat-card" [routerLink]="['/cours', c.id]">
            <app-cover class="card-cover" [icon]="c.icon" [seed]="c.id" [height]="96" [label]="c.title" />
            <div class="row" style="justify-content:space-between">
              <span class="xs muted">{{ c.domainName }}</span>
              @if (forMe(c.targetRoles)) { <span class="tag">Pour vous</span> }
            </div>
            <h3>{{ c.title }}</h3>
            <div class="meta"><span><app-icon name="book-open" [size]="14" /> {{ c.lessonCount }} leçons</span><span><app-icon name="clock" [size]="14" /> {{ dur(c.totalMinutes) }}</span>
              @if (c.hasVideo) {<span><app-icon name="video" [size]="14" /></span>} @if (c.hasAudio) {<span><app-icon name="headphones" [size]="14" /></span>}</div>
            <div class="cat-foot">
              @if (enrolledCourse(c.id); as me) {
                @let st = status(me);
                <span class="small"><strong>{{ st.percent }} %</strong> · {{ st.label }}</span>
              } @else {
                <span class="price-tag" [class.free]="!c.price">{{ priceLabel(c.price) }}</span>
              }
              <span class="link small">Voir <app-icon name="arrow" [size]="14" /></span>
            </div>
          </a>
        } @empty { <p class="muted">Aucun cours ne correspond à votre recherche.</p> }
      </div>
    }
  `,
})
export class CatalogPage implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(CatalogApi);

  cat = signal<Catalog | null>(null);
  error = signal('');
  tab = signal<Tab>('formations');
  price = signal<PriceFilter>('all');
  private qs = signal('');
  private roleS = signal('');
  private domainS = signal(0);
  protected aud = inject(AudienceService);

  get q(): string { return this.qs(); }
  set q(v: string) { this.qs.set(v); }
  get role(): string { return this.roleS(); }
  set role(v: string) { this.roleS.set(v); }
  get domain(): number { return this.domainS(); }
  set domain(v: number) { this.domainS.set(Number(v)); }

  programs = computed(() => this.sorted((this.cat()?.programs ?? []).filter((p) => this.keep(p.title + ' ' + p.description + ' ' + p.domains.join(' '), p.price, p.targetRoles))));
  courses = computed(() => this.sorted((this.cat()?.courses ?? []).filter((c) =>
    this.keep(c.title + ' ' + c.description + ' ' + (c.domainName ?? ''), c.price, c.targetRoles) && (!this.domainS() || c.domainId === this.domainS()))));

  async ngOnInit(): Promise<void> {
    void this.aud.load();
    try {
      this.cat.set((await this.api.catalog()).data);
      if (this.auth.isLoggedIn()) await this.api.myLearning().catch(() => undefined);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private keep(text: string, price: number, roles: string[]): boolean {
    const q = norm(this.qs());
    if (q && !q.split(/\s+/).every((w) => norm(text).includes(w))) return false;
    if (this.price() === 'free' && price > 0) return false;
    if (this.price() === 'paid' && price === 0) return false;
    if (this.roleS() && roles.length && !roles.includes(this.roleS())) return false;
    return true;
  }

  /** Les contenus pour le public de l'utilisateur d'abord. */
  private sorted<T extends CatalogCourse | CatalogProgram>(list: T[]): T[] {
    return [...list].sort((a, b) => Number(this.forMe(b.targetRoles)) - Number(this.forMe(a.targetRoles)));
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

  status = courseStatus;
  priceLabel = priceLabel;
  dur = durationLabel;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}
