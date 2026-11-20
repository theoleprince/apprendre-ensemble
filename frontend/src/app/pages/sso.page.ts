import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';

/** Retour de l'authentification unique : le jeton est lu dans le fragment puis efface de l'adresse. */
@Component({
  selector: 'app-sso',
  imports: [RouterLink],
  template: `
    <section class="card narrow center">
      @if (error()) { <p class="error">{{ error() }}</p> <a class="btn" routerLink="/login">Retour à la connexion</a> }
      @else { <p>Connexion en cours…</p> <div class="skeleton" style="height:80px"></div> }
    </section>
  `,
})
export class SsoPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  error = signal('');

  async ngOnInit(): Promise<void> {
    const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
    history.replaceState(null, '', '/sso');
    if (!token) return void this.error.set('Connexion institutionnelle interrompue.');
    try {
      await this.auth.loginWithToken(token);
      await this.router.navigateByUrl(this.auth.homeUrl(), { replaceUrl: true });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
