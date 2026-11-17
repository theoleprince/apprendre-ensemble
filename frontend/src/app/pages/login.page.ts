import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../shared/icon.component';

/** Comptes du jeu de demonstration (seed du serveur de test). */
const DEMO = [
  { icon: '👩🏾‍🏫', label: 'Enseignante', email: 'enseignant@demo.local' },
  { icon: '👪', label: 'Parent', email: 'parent@demo.local' },
  { icon: '🧑🏾', label: 'Jeune', email: 'jeune@demo.local' },
  { icon: '🏫', label: 'Direction', email: 'direction@demo.local' },
  { icon: '🧭', label: 'Mentor', email: 'conseiller@demo.local' },
  { icon: '📊', label: 'Pilotage', email: 'formateur@demo.local' },
];

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="auth-wrap">
      <aside class="auth-art">
        <div class="brand" style="color:#fff"><span class="brand-mark" style="background:rgba(255,255,255,.15)">🌱</span> Apprendre Ensemble</div>
        <h1>Se former partout,<br />même sans réseau.</h1>
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
          <h1>Connexion</h1>
          <form (ngSubmit)="submit()" #f="ngForm" class="card">
            <label>Email
              <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
            </label>
            <label>Mot de passe
              <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
            </label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="primary block lg" type="submit" [disabled]="f.invalid || loading()">
              {{ loading() ? 'Connexion…' : 'Se connecter' }}
            </button>
            <p class="center small">Pas encore de compte ? <a routerLink="/inscription">Créer un compte</a></p>
          </form>
          <div class="section">
            <p class="small muted center">Démonstration : entrer en un clic</p>
            <div class="demo-accounts">
              @for (d of demo; track d.email) {
                <button type="button" (click)="useDemo(d.email)" [disabled]="loading()"><span>{{ d.icon }}</span>{{ d.label }}</button>
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

  demo = DEMO;
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
      await this.router.navigateByUrl(this.auth.homeUrl());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
