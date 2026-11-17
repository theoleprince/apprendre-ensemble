import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authReq = token && req.url.startsWith('/api/') ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq).pipe(
    catchError((err: unknown) => {
      // Jeton expire ou invalide : retour a l'ecran de connexion (sauf pendant la connexion elle-meme).
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith('/api/auth/')) {
        void auth.logout();
      }
      return throwError(() => err);
    }),
  );
};

/** Message lisible a partir d'une erreur HTTP (ProblemDetail du backend) ou d'une absence de reseau. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Pas de connexion au serveur. Réessayez quand le réseau sera disponible.';
    const detail = err.error?.detail;
    if (typeof detail === 'string' && detail) return detail;
    return `Erreur ${err.status}`;
  }
  return 'Erreur inattendue';
}
