import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { safeRedirect } from '../core/guards';
import { IconComponent } from '../shared/icon.component';
import { HeroArtComponent } from '../shared/visuals';

/** Comptes du jeu de demonstration (seed du serveur de test). */
const DEMO = [
  { icon: 'book-open', label: 'Enseignante', email: 'enseignant@demo.local' },
  { icon: 'family', label: 'Parent', email: 'parent@demo.local' },
  { icon: 'smartphone', label: 'Jeune', email: 'jeune@demo.local' },
  { icon: 'school', label: 'Direction', email: 'direction@demo.local' },
  { icon: 'compass', label: 'Mentor', email: 'conseiller@demo.local' },
  { icon: 'chart', label: 'Pilotage', email: 'formateur@demo.local' },
];

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, IconComponent, HeroArtComponent],
  template: `
    <div class="auth-wrap">
      <aside class="auth-art">
        <div class="brand" style="color:#fff"><span class="brand-mark" style="background:rgba(255,255,255,.15)"><app-icon name="sprout" [size]="22" /></span> Apprendre Ensemble</div>
        <h1>Se former partout,<br />même sans réseau.</h1>
        <app-hero-art />
        <ul>
          <li><app-icon name="wifi-off" /> Leçons téléchargées, consultables hors connexion</li>
          <li><app-icon name="headphones" /> Vidéo, audio et texte, avec transcription</li>
          <li><app-icon name="sparkles" /> Un mentor IA à chaque étape</li>
          <li><app-icon name="award" /> 4 niveaux de certification, partageables sur LinkedIn</li>
          <li><app-icon name="users" /> Communautés de pratique et mentorat</li>
        </ul>
      </aside>
      <section class="auth-form">
        <div style="width:min(420px,100%)">
          <a routerLink="/catalogue" class="back"><app-icon name="back" [size]="18" /> Voir le catalogue</a>
          <h1>Connexion</h1>
          @if (redirect) { <p class="notice info small"><app-icon name="lock" [size]="16" /> Connectez-vous pour continuer : vous reviendrez directement à votre formation.</p> }
          <form (ngSubmit)="submit()" #f="ngForm" class="card">
            <label>Email
              <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
            </label>
            <label>Mot de passe
              <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
            </label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <p class="small" style="margin:-.3rem 0 .6rem;text-align:right"><a routerLink="/mot-de-passe-oublie">Mot de passe oublié ?</a></p>
            <button class="primary block lg" type="submit" [disabled]="f.invalid || loading()">
              {{ loading() ? 'Connexion…' : 'Se connecter' }}
            </button>
            @if (sso(); as s) {
              <a class="btn block lg" [href]="s.url" style="margin-top:.6rem"><app-icon name="shield" /> {{ s.label }}</a>
            }
            @if (ssoError) { <p class="error small">Connexion institutionnelle impossible ({{ ssoError }}).</p> }
            <p class="center small">Pas encore de compte ? <a routerLink="/inscription" [queryParams]="redirect ? { redirect } : {}">Créer un compte gratuit</a></p>
          </form>
          <div class="section">
            <p class="small muted center">Démonstration : entrer en un clic</p>
            <div class="demo-accounts">
              @for (d of demo; track d.email) {
                <button type="button" (click)="useDemo(d.email)" [disabled]="loading()"><app-icon [name]="d.icon" [size]="24" />{{ d.label }}</button>
              }
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected redirect = this.route.snapshot.queryParamMap.get('redirect');

  demo = DEMO;
  private http = inject(HttpClient);
  sso = signal<{ url: string; label: string } | null>(null);
  ssoError = this.route.snapshot.queryParamMap.get('sso');

  constructor() {
    void firstValueFrom(this.http.get<{ enabled: boolean; url: string; label: string }>('/api/public/sso'))
      .then((s) => s.enabled && this.sso.set(s)).catch(() => undefined);
  }
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  useDemo(email: string): void {
    this.email = email;
    this.password = 'Demo1234!';
    void this.submit();
  }

  async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(safeRedirect(this.redirect, this.auth.homeUrl()));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
