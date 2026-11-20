import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AssistantService } from './core/assistant.service';
import { MediaCacheService } from './core/media-cache.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AudienceService } from './core/audience.service';
import { I18nRuntimeService } from './core/i18n-runtime.service';
import { AuthService } from './core/auth.service';
import { TranslatePipe } from './core/i18n';
import { LearningService } from './core/learning.service';
import { PrefsService } from './core/prefs.service';
import { ToastService } from './core/toast.service';
import { AssistantPanelComponent } from './shared/assistant-panel.component';
import { IconComponent } from './shared/icon.component';

interface NavItem {
  path: string;
  icon: string;
  key: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, TranslatePipe, AssistantPanelComponent],
  template: `
    @if (showShell()) {
      <div class="shell">
        <header class="topbar">
          <a class="brand" [routerLink]="auth.homeUrl()"><span class="brand-mark"><app-icon name="sprout" [size]="22" /></span><span class="brand-name">Apprendre Ensemble</span></a>
          <span class="spacer"></span>
          @if (learning.online()) {
            <span class="pill" [title]="'status.online' | t">
              <app-icon name="wifi" [size]="14" />
              @if (learning.syncing()) { {{ 'status.syncing' | t }} }
              @else if (learning.pending() > 0) { {{ learning.pending() }} {{ 'status.pending' | t }} }
              @else { {{ 'status.synced' | t }} }
            </span>
          } @else {
            <span class="pill off" [title]="'status.offlineHint' | t">
              <app-icon name="wifi-off" [size]="14" /> {{ 'status.offline' | t }}
              @if (learning.pending() > 0) { · {{ learning.pending() }} }
            </span>
          }
          <select class="lang-select" [value]="prefs.prefs().lang" (change)="setLang($event)" aria-label="Langue de l'interface"
                  [title]="i18n.coverage() !== null && i18n.coverage()! < 0.9 ? 'Traduction partielle : les textes non traduits restent en français' : ''">
            @for (l of langs(); track l.code) { <option [value]="l.code" [selected]="l.code === prefs.prefs().lang">{{ l.code.toUpperCase() }} · {{ l.name }}</option> }
          </select>
          <button class="icon-btn ghost theme-btn" (click)="toggleTheme()" [attr.aria-label]="dark() ? 'Passer en mode clair' : 'Passer en mode sombre'" [title]="dark() ? 'Mode clair' : 'Mode sombre'"><app-icon [name]="dark() ? 'sun' : 'moon'" [size]="18" /></button>
          <button class="icon-btn ghost" (click)="logout()" [title]="'action.logout' | t" [attr.aria-label]="'action.logout' | t"><app-icon name="logout" /></button>
        </header>
        <div class="layout" [class.focus]="focus()">
          <nav class="sidenav" aria-label="Navigation principale">
            @for (n of nav(); track n.path) {
              <a [routerLink]="n.path" routerLinkActive="active"><app-icon [name]="n.icon" /> {{ n.key | t }}</a>
            }
            <div class="foot">
              <div><strong>{{ auth.user()?.fullName }}</strong></div>
              <div>{{ auth.user()?.region || auth.user()?.countryCode }}</div>
              <button class="link" style="margin-top:.5rem;display:inline-flex;gap:.3rem;align-items:center" (click)="logout()"><app-icon name="logout" [size]="16" /> {{ 'action.logout' | t }}</button>
            </div>
          </nav>
          <main class="main" id="main">
            <router-outlet />
          </main>
        </div>
        <nav class="tabbar" aria-label="Navigation" [hidden]="focus()">
          @for (n of nav().slice(0, 5); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="active"><app-icon [name]="n.icon" [size]="22" />{{ n.key | t }}</a>
          }
        </nav>
        @if (!auth.isStaff()) {
          <app-assistant-panel />
        }
      </div>
    } @else if (publicChrome()) {
      <div class="pub">
        <header class="pub-top">
          <a class="brand" routerLink="/" aria-label="Apprendre Ensemble, accueil"><span class="brand-mark"><app-icon name="sprout" [size]="22" /></span><span class="brand-name">Apprendre Ensemble</span></a>
          <nav class="pub-nav"><a routerLink="/catalogue" routerLinkActive="active">Catalogue</a></nav>
          <span class="spacer"></span>
          <button class="icon-btn ghost theme-btn" (click)="toggleTheme()" [attr.aria-label]="dark() ? 'Passer en mode clair' : 'Passer en mode sombre'" [title]="dark() ? 'Mode clair' : 'Mode sombre'"><app-icon [name]="dark() ? 'sun' : 'moon'" [size]="18" /></button>
          <select class="lang-select" [value]="prefs.prefs().lang" (change)="setLang($event)" aria-label="Langue de l'interface">
            @for (l of langs(); track l.code) { <option [value]="l.code" [selected]="l.code === prefs.prefs().lang">{{ l.code.toUpperCase() }}</option> }
          </select>
          <a class="btn ghost" routerLink="/login" [queryParams]="{ redirect: url() }">Se connecter</a>
          <a class="btn primary" routerLink="/inscription" [queryParams]="{ redirect: url() }">Créer un compte</a>
        </header>
        <main class="pub-main"><router-outlet /></main>
      </div>
    } @else {
      <router-outlet />
    }

    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class.celebrate]="t.celebrate" (click)="toast.dismiss(t.id)">
          <span class="ti"><app-icon [name]="t.icon" [size]="26" /></span>
          <div><strong>{{ t.title }}</strong>@if (t.text) {<div class="small">{{ t.text }}</div>}</div>
        </div>
      }
    </div>
    @if (celebrating()) {
      <div class="confetti" aria-hidden="true">
        @for (c of confetti; track $index) {
          <i [style.left.%]="c.x" [style.background]="c.color" [style.animation-delay.s]="c.delay"></i>
        }
      </div>
    }
  `,
})
export class App {
  protected auth = inject(AuthService);
  protected learning = inject(LearningService);
  protected prefs = inject(PrefsService);
  protected toast = inject(ToastService);
  private assistant = inject(AssistantService);
  private router = inject(Router);
  private media = inject(MediaCacheService);
  private audiences = inject(AudienceService);
  protected i18n = inject(I18nRuntimeService);
  private http = inject(HttpClient);
  protected langs = signal<{ code: string; name: string }[]>([{ code: 'fr', name: 'Français' }, { code: 'en', name: 'English' }]);

  protected url = signal(location.pathname);
  protected dark = computed(() => this.prefs.isDark());

  toggleTheme(): void {
    this.prefs.update({ theme: this.prefs.isDark() ? 'light' : 'dark' });
  }
  protected readonly confetti = Array.from({ length: 60 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    color: ['#f5c400', '#2f7d4f', '#c8553d', '#5b4bc4', '#ffffff'][i % 5],
  }));
  protected celebrating = computed(() => this.toast.toasts().some((t) => t.celebrate));

  protected nav = computed<NavItem[]>(() => {
    const u = this.auth.user();
    if (!u) return [];
    if (this.auth.isStaff()) {
      return [
        { path: '/admin', icon: 'chart', key: 'nav.admin' },
        { path: '/admin/classes', icon: 'users', key: 'Classes' },
        { path: '/admin/programmes', icon: 'graduation', key: 'Programmes' },
        { path: '/admin/modules', icon: 'book', key: 'nav.courses' },
        { path: '/admin/referentiels', icon: 'book-open', key: 'Référentiels' },
        { path: '/admin/parametres', icon: 'settings', key: 'Paramètres' },
        { path: '/admin/comptes', icon: 'user', key: 'Comptes' },
        { path: '/admin/certificats', icon: 'award', key: 'Certificats' },
        { path: '/admin/apprenants', icon: 'shuffle', key: 'Groupes RCT' },
        { path: '/mentorat', icon: 'eye', key: 'nav.mentor' },
        { path: '/admin/ia', icon: 'shield', key: 'Supervision IA' },
        { path: '/communaute', icon: 'message-heart', key: 'nav.community' },
        { path: '/profil', icon: 'user', key: 'nav.profile' },
      ];
    }
    const items: NavItem[] = [
      { path: '/accueil', icon: 'home', key: 'Mes cours' },
      { path: '/catalogue', icon: 'search', key: 'Catalogue' },
      { path: '/certificats', icon: 'award', key: 'nav.certificates' },
      { path: '/communaute', icon: 'users', key: 'nav.community' },
      { path: '/profil', icon: 'user', key: 'nav.profile' },
      { path: '/fiches', icon: 'file', key: 'Fiches pratiques' },
    ];
    if (u.role === 'DIRECTION_ECOLE') items.splice(1, 0, { path: '/mon-ecole', icon: 'school', key: 'Mon école' });
    if (this.auth.isMentor()) items.splice(1, 0, { path: '/mentorat', icon: 'eye', key: 'nav.mentor' });
    return items;
  });

  /** Mode focus (lecon, evaluation) : pas de menus, toute l'attention sur l'apprentissage. */
  protected focus = computed(() => /^\/apprendre\//.test(this.url()));

  protected showShell = computed(() => this.auth.isLoggedIn() && !this.routeIsBare());
  /** Visiteur sans compte sur une page publique : en-tete simple (catalogue, connexion, inscription). */
  protected publicChrome = computed(() => !this.auth.isLoggedIn() && /^\/(catalogue|cours|formations|verifier|a-propos|aide|confidentialite|mentions-legales)?(\/|$|\?|#)/.test(this.url()));
  private routeIsBare = () => /^\/(login|inscription|verifier|bienvenue|mot-de-passe-oublie|reinitialiser|sso)/.test(this.currentUrl());
  private currentUrl = () => this.url();

  setLang(ev: Event): void {
    this.prefs.update({ lang: (ev.target as HTMLSelectElement).value });
  }

  /** Deconnexion : envoie d'abord la progression en attente (sinon elle serait perdue), puis efface l'appareil. */
  async logout(): Promise<void> {
    if (this.learning.pending() > 0) await this.learning.sync();
    if (this.learning.pending() > 0) {
      this.toast.show({ icon: 'alert', title: 'Progression non envoyée', text: 'Connectez-vous à Internet avant de vous déconnecter, sinon elle serait perdue.' }, 7000);
      return;
    }
    await this.media.clear();
    this.assistant.reset();
    await this.auth.logout();
  }

  constructor() {
    void this.audiences.load();
    this.i18n.start();
    void firstValueFrom(this.http.get<{ languages: { code: string; name: string }[] }>('/api/referentiel'))
      .then((r) => r.languages?.length && this.langs.set(r.languages)).catch(() => undefined);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.url.set((e as NavigationEnd).urlAfterRedirects);
      // le contexte de l'assistant est fixe par les pages de module / lecon
      if (!/^\/apprendre\//.test(this.url())) this.assistant.setContext({});
    });
    effect(() => {
      if (this.auth.user()) {
        void this.learning.start().then(() => this.learning.reloadLocalState()).then(() => this.learning.sync());
      }
    });
  }
}
