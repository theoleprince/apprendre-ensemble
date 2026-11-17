import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthResponse, Role, User } from './models';
import { OfflineStore } from './offline-store';

const TOKEN_KEY = 'formation.token';
const USER_KEY = 'formation.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private store = inject(OfflineStore);

  /** Session conservee localement : l'apprenant reste connecte hors ligne. */
  readonly user = signal<User | null>(readUser());
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly isLoggedIn = computed(() => !!this.token() && !!this.user());
  readonly isStaff = computed(() => {
    const r = this.user()?.role;
    return r === 'ADMIN' || r === 'FORMATEUR';
  });

  readonly isMentor = computed(() => this.isStaff() || this.user()?.role === 'CONSEILLER_PEDAGOGIQUE');
  readonly needsPlacement = computed(() => {
    const u = this.user();
    return !!u && !u.placementDone && !this.isMentor();
  });

  /** Recharge le profil (apres le test d'entree, changement de groupe...). Silencieux hors ligne. */
  async refreshMe(): Promise<void> {
    try {
      const u = await firstValueFrom(this.http.get<User>('/api/me'));
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      this.user.set(u);
    } catch {
      /* hors ligne */
    }
  }

  homeUrl(): string {
    if (this.isStaff()) return '/admin';
    if (this.user()?.role === 'CONSEILLER_PEDAGOGIQUE') return '/mentorat';
    return this.needsPlacement() ? '/bienvenue' : '/accueil';
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(this.http.post<AuthResponse>('/api/auth/login', { email, password }));
    await this.setSession(res);
  }

  async register(payload: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
    countryCode: string;
    languageCode: string;
    region: string;
    dataConsent: boolean;
  }): Promise<void> {
    const res = await firstValueFrom(this.http.post<AuthResponse>('/api/auth/register', payload));
    await this.setSession(res);
  }

  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    await this.store.clearAll();
    await this.router.navigateByUrl('/login');
  }

  private async setSession(res: AuthResponse): Promise<void> {
    const previous = this.user();
    if (previous && previous.id !== res.user.id) {
      // Autre utilisateur sur le meme appareil : on ne melange pas les donnees.
      await this.store.clearAll();
    }
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.token.set(res.token);
    this.user.set(res.user);
  }
}

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
