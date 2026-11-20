import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Engagement, NoteItem, PublicStats } from './models';
import { OfflineStore } from './offline-store';

interface PendingNote {
  lessonId: number;
  text: string;
  bookmarked: boolean;
}

/**
 * Motivation (serie, objectif, badges) et notes de lecon.
 * Les notes s'enregistrent d'abord sur l'appareil, puis partent au serveur des que le reseau le permet.
 */
@Injectable({ providedIn: 'root' })
export class EngagementApi {
  private http = inject(HttpClient);
  private store = inject(OfflineStore);

  readonly engagement = signal<Engagement | null>(null);

  constructor() {
    window.addEventListener('online', () => void this.flushNotes());
  }

  async load(): Promise<Engagement | null> {
    try {
      const e = await firstValueFrom(this.http.get<Engagement>('/api/me/engagement'));
      this.engagement.set(e);
      await this.store.set('kv', 'engagement', e).catch(() => undefined);
      return e;
    } catch {
      const c = await this.store.get<Engagement>('kv', 'engagement').catch(() => undefined);
      if (c) this.engagement.set(c);
      return c ?? null;
    }
  }

  async saveGoals(weeklyGoalMinutes: number, remindersEnabled: boolean): Promise<Engagement> {
    const e = await firstValueFrom(this.http.put<Engagement>('/api/me/goals', { weeklyGoalMinutes, remindersEnabled }));
    this.engagement.set(e);
    return e;
  }

  stats(): Promise<PublicStats> {
    return firstValueFrom(this.http.get<PublicStats>('/api/public/stats'));
  }

  // ---------- notes ----------
  async notes(courseId: number): Promise<NoteItem[]> {
    const key = 'notes-' + courseId;
    let list: NoteItem[];
    try {
      list = await firstValueFrom(this.http.get<NoteItem[]>('/api/me/notes', { params: { courseId } }));
      await this.store.set('kv', key, list).catch(() => undefined);
    } catch {
      list = (await this.store.get<NoteItem[]>('kv', key).catch(() => undefined)) ?? [];
    }
    // les modifications pas encore envoyees l'emportent
    const pending = await this.pending();
    for (const p of pending) {
      const i = list.findIndex((n) => n.lessonId === p.lessonId);
      if (i >= 0) list[i] = { ...list[i], text: p.text, bookmarked: p.bookmarked };
    }
    return list;
  }

  async allNotes(): Promise<NoteItem[]> {
    return firstValueFrom(this.http.get<NoteItem[]>('/api/me/notes'));
  }

  /** @returns true si la note est enregistree sur le serveur, false si elle attend le reseau. */
  async saveNote(courseId: number, lessonId: number, text: string, bookmarked: boolean): Promise<boolean> {
    const key = 'notes-' + courseId;
    const cached = (await this.store.get<NoteItem[]>('kv', key).catch(() => undefined)) ?? [];
    const others = cached.filter((n) => n.lessonId !== lessonId);
    if (text.trim() || bookmarked) {
      const old = cached.find((n) => n.lessonId === lessonId);
      others.push({ ...(old ?? { lessonId, lessonTitle: '', lessonPosition: 0, courseId, courseTitle: '' }), text, bookmarked, updatedAt: new Date().toISOString() } as NoteItem);
    }
    await this.store.set('kv', key, others).catch(() => undefined);
    try {
      await firstValueFrom(this.http.put('/api/me/notes/' + lessonId, { text, bookmarked }));
      await this.dropPending(lessonId);
      return true;
    } catch {
      const p = (await this.pending()).filter((x) => x.lessonId !== lessonId);
      p.push({ lessonId, text, bookmarked });
      await this.store.set('kv', 'notes-pending', p).catch(() => undefined);
      return false;
    }
  }

  async flushNotes(): Promise<void> {
    for (const p of await this.pending()) {
      try {
        await firstValueFrom(this.http.put('/api/me/notes/' + p.lessonId, { text: p.text, bookmarked: p.bookmarked }));
        await this.dropPending(p.lessonId);
      } catch {
        return;
      }
    }
  }

  private async pending(): Promise<PendingNote[]> {
    return (await this.store.get<PendingNote[]>('kv', 'notes-pending').catch(() => undefined)) ?? [];
  }

  private async dropPending(lessonId: number): Promise<void> {
    const p = (await this.pending()).filter((x) => x.lessonId !== lessonId);
    await this.store.set('kv', 'notes-pending', p).catch(() => undefined);
  }
}
