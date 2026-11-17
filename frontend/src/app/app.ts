import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AssistantService } from './core/assistant.service';
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
          <a class="brand" [routerLink]="auth.homeUrl()"><span class="brand-mark">🌱</span><span class="brand-name">Apprendre Ensemble</span></a>
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
          <div class="lang-switch" role="group" aria-label="Langue">
            <button [class.active]="prefs.prefs().lang === 'fr'" (click)="prefs.update({ lang: 'fr' })">FR</button>
            <button [class.active]="prefs.prefs().lang === 'en'" (click)="prefs.update({ lang: 'en' })">EN</button>
          </div>
        </header>
        <div class="layout">
          <nav class="sidenav" aria-label="Navigation principale">
            @for (n of nav(); track n.path) {
              <a [routerLink]="n.path" routerLinkActive="active"><app-icon [name]="n.icon" /> {{ n.key | t }}</a>
            }
            <div class="foot">
              <div><strong>{{ auth.user()?.fullName }}</strong></div>
              <div>{{ auth.user()?.region || auth.user()?.countryCode }}</div>
            </div>
          </nav>
          <main class="main" id="main">
            <router-outlet />
          </main>
        </div>
        <nav class="tabbar" aria-label="Navigation">
          @for (n of nav().slice(0, 5); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="active"><app-icon [name]="n.icon" [size]="22" />{{ n.key | t }}</a>
          }
        </nav>
        @if (!auth.isStaff()) {
          <app-assistant-panel />
        }
      </div>
    } @else {
      <router-outlet />
    }

    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class.celebrate]="t.celebrate" (click)="toast.dismiss(t.id)">
          <span class="ti">{{ t.icon }}</span>
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

  private url = signal(location.pathname);
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
        { path: '/admin/modules', icon: 'book', key: 'nav.courses' },
        { path: '/admin/apprenants', icon: 'shuffle', key: 'Groupes RCT' },
        { path: '/mentorat', icon: 'eye', key: 'nav.mentor' },
        { path: '/admin/ia', icon: 'shield', key: 'Supervision IA' },
        { path: '/communaute', icon: 'users', key: 'nav.community' },
        { path: '/profil', icon: 'user', key: 'nav.profile' },
      ];
    }
    const items: NavItem[] = [
      { path: '/accueil', icon: 'home', key: 'nav.home' },
      { path: '/modules', icon: 'book', key: 'nav.courses' },
      { path: '/communaute', icon: 'users', key: 'nav.community' },
      { path: '/certificats', icon: 'award', key: 'nav.certificates' },
      { path: '/profil', icon: 'user', key: 'nav.profile' },
    ];
    if (this.auth.isMentor()) items.splice(1, 0, { path: '/mentorat', icon: 'eye', key: 'nav.mentor' });
    return items;
  });

  protected showShell = computed(() => this.auth.isLoggedIn() && !this.routeIsBare());
  private routeIsBare = () => /^\/(login|inscription|verifier|bienvenue)/.test(this.currentUrl());
  private currentUrl = () => this.url();

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.url.set((e as NavigationEnd).urlAfterRedirects);
      // le contexte de l'assistant est fixe par les pages de module / lecon
      if (!/^\/modules\/\d+/.test(this.url())) this.assistant.setContext({});
    });
    effect(() => {
      if (this.auth.user()) {
        void this.learning.start().then(() => this.learning.reloadLocalState()).then(() => this.learning.sync());
      }
    });
  }
}
