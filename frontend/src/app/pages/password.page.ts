import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { IconComponent } from '../shared/icon.component';

/** Demande de reinitialisation : le message est le meme que le compte existe ou non. */
@Component({
  selector: 'app-forgot',
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <section class="card narrow">
      <a routerLink="/login" class="back"><app-icon name="back" [size]="18" /> Connexion</a>
      <h1>Mot de passe oublié</h1>
      @if (sent()) {
        <p class="notice info"><app-icon name="check-circle" /> {{ sent() }}</p>
        <p class="small muted">Pas d'e-mail ? Vérifiez vos courriers indésirables, ou demandez un lien de réinitialisation à votre conseiller·ère ou à l'administration.</p>
      } @else {
        <p class="muted">Indiquez l'adresse e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
        <form (ngSubmit)="submit()" #f="ngForm">
          <label>E-mail <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" /></label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="primary block lg" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Envoi…' : 'Recevoir le lien' }}</button>
        </form>
      }
    </section>
  `,
})
export class ForgotPage {
  private http = inject(HttpClient);
  email = '';
  busy = signal(false);
  sent = signal('');
  error = signal('');

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.post<{ message: string }>('/api/auth/forgot', { email: this.email.trim() }));
      this.sent.set(r.message);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Choix du nouveau mot de passe a partir du lien recu (e-mail ou remis par l'administration). */
@Component({
  selector: 'app-reset',
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <section class="card narrow">
      <h1>Nouveau mot de passe</h1>
      @if (done()) {
        <p class="notice info"><app-icon name="check-circle" /> {{ done() }}</p>
        <a class="btn primary block lg" routerLink="/login">Se connecter</a>
      } @else if (!token) {
        <p class="error">Lien incomplet. Utilisez le lien reçu par e-mail ou remis par l'administration.</p>
      } @else {
        <form (ngSubmit)="submit()" #f="ngForm">
          <label>Nouveau mot de passe (8 caractères minimum)
            <input type="password" name="p1" [(ngModel)]="p1" required minlength="8" autocomplete="new-password" /></label>
          <label>Confirmation <input type="password" name="p2" [(ngModel)]="p2" required autocomplete="new-password" /></label>
          @if (p2 && p1 !== p2) { <p class="error">Les deux mots de passe ne correspondent pas.</p> }
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="primary block lg" type="submit" [disabled]="f.invalid || p1 !== p2 || busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
          <p class="xs muted">Par sécurité, vous serez déconnecté·e de tous vos appareils.</p>
        </form>
      }
    </section>
  `,
})
export class ResetPage {
  private http = inject(HttpClient);
  protected token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  p1 = '';
  p2 = '';
  busy = signal(false);
  done = signal('');
  error = signal('');

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.post<{ message: string }>('/api/auth/reset', { token: this.token, password: this.p1 }));
      this.done.set(r.message);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
