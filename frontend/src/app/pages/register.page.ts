import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { ROLE_ICONS, ROLE_LABELS, Referentiel, Role } from '../core/models';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card narrow">
      <h1>Créer un compte</h1>
      <div class="dots">@for (s of [1, 2]; track s) {<span [class.on]="step() === s"></span>}</div>
      @if (ref(); as r) {
        <form (ngSubmit)="step() === 1 ? step.set(2) : submit()" #f="ngForm">
          @if (step() === 1) {
            <p class="muted">Qui êtes-vous ?</p>
            <div class="placement-options" style="margin-bottom:1rem">
              @for (role of r.learnerRoles; track role) {
                <button type="button" class="placement-opt" [class.selected]="form.role === role" (click)="form.role = role">
                  <span class="emoji">{{ icons[role] }}</span>{{ labels[role] }}
                </button>
              }
            </div>
            <div class="field-row">
              <label>Pays
                <select name="country" [(ngModel)]="form.countryCode" required>
                  @for (c of r.countries; track c.code) { <option [value]="c.code">{{ c.name }}</option> }
                </select>
              </label>
              <label>Langue
                <select name="language" [(ngModel)]="form.languageCode" required>
                  @for (l of r.languages; track l.code) { <option [value]="l.code">{{ l.name }}</option> }
                </select>
              </label>
            </div>
            <label>Zone (département, commune)
              <input name="region" [(ngModel)]="form.region" placeholder="ex. Borgou" maxlength="120" />
            </label>
            <button class="primary block lg" type="submit">Continuer</button>
          } @else {
            <label>Nom complet <input name="fullName" [(ngModel)]="form.fullName" required maxlength="120" /></label>
            <label>Email <input type="email" name="email" [(ngModel)]="form.email" required email autocomplete="username" /></label>
            <label>Mot de passe (8 caractères minimum)
              <input type="password" name="password" [(ngModel)]="form.password" required minlength="8" autocomplete="new-password" />
            </label>
            <label class="check">
              <input type="checkbox" name="consent" [(ngModel)]="form.dataConsent" required />
              <span class="small">J'accepte que ma progression soit utilisée pour le suivi de ma formation et, de façon
                pseudonymisée (sans nom ni email), pour l'évaluation du programme. Mes données sont hébergées en Suisse/UE.</span>
            </label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <div class="row">
              <button type="button" (click)="step.set(1)">Retour</button>
              <button class="primary grow lg" type="submit" [disabled]="f.invalid || !form.dataConsent || loading()">Créer mon compte</button>
            </div>
          }
        </form>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <div class="skeleton"></div>
      }
      <p class="center small"><a routerLink="/login">J'ai déjà un compte</a></p>
    </section>
  `,
})
export class RegisterPage implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  labels = ROLE_LABELS;
  icons = ROLE_ICONS;
  step = signal(1);
  ref = signal<Referentiel | null>(null);
  loading = signal(false);
  error = signal('');
  form = { fullName: '', email: '', password: '', role: 'ENSEIGNANT' as Role, countryCode: 'BJ', languageCode: 'fr', region: '', dataConsent: false };

  async ngOnInit(): Promise<void> {
    try {
      this.ref.set(await firstValueFrom(this.http.get<Referentiel>('/api/referentiel')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.register(this.form);
      await this.router.navigateByUrl('/bienvenue');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
