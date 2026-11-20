import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AudienceItem, ROLE_ICONS, ROLE_LABELS, Referentiel, Role } from './models';
import { OfflineStore } from './offline-store';

/**
 * Publics parametrables (ENSEIGNANT, PARENT... et ceux ajoutes en administration).
 * Charges une fois depuis /api/referentiel (public), conserves sur l'appareil pour l'usage hors ligne.
 */
@Injectable({ providedIn: 'root' })
export class AudienceService {
  private http = inject(HttpClient);
  private store = inject(OfflineStore);
  readonly list = signal<AudienceItem[]>([]);
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const r = await firstValueFrom(this.http.get<Referentiel>('/api/referentiel'));
      this.list.set(r.audiences ?? []);
      this.loaded = true;
      await this.store.set('kv', 'audiences', r.audiences ?? []).catch(() => undefined);
    } catch {
      const cached = await this.store.get<AudienceItem[]>('kv', 'audiences').catch(() => undefined);
      if (cached) this.list.set(cached);
    }
  }

  /** Tous les publics, y compris non ouverts a l'inscription (administration). */
  async loadAll(): Promise<AudienceItem[]> {
    const all = await firstValueFrom(this.http.get<AudienceItem[]>('/api/admin/audiences'));
    this.list.set(all);
    this.loaded = true;
    return all;
  }

  label(code: string): string {
    return this.list().find((a) => a.code === code)?.label ?? ROLE_LABELS[code as Role] ?? code;
  }

  icon(code: string): string {
    return this.list().find((a) => a.code === code)?.icon ?? ROLE_ICONS[code as Role] ?? 'user';
  }

  labels(codes: string[]): string {
    return codes.map((c) => this.label(c)).join(', ');
  }
}
