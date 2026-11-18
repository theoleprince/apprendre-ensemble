import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Page reservee aux connectes : apres connexion, on revient exactement ou l'on etait. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).parseUrl('/login?redirect=' + encodeURIComponent(state.url));
};

/** Accueil public : un utilisateur connecte va directement a son espace. */
export const landingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).parseUrl(auth.homeUrl()) : true;
};

/** Adresse de retour sure (meme site uniquement). */
export function safeRedirect(url: string | null | undefined, fallback: string): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : fallback;
}

export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) return inject(Router).parseUrl('/login');
  return auth.isStaff() ? true : inject(Router).parseUrl(auth.homeUrl());
};

export const mentorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) return inject(Router).parseUrl('/login');
  return auth.isMentor() ? true : inject(Router).parseUrl(auth.homeUrl());
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).parseUrl(auth.homeUrl()) : true;
};
