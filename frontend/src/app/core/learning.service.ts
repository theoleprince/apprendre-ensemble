import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MediaCacheService } from './media-cache.service';
import {
  Certificate,
  CoursePackage,
  CourseSummary,
  Feedback,
  PlacementQuestion,
  PlacementResult,
  Portfolio,
  ProgressItem,
  QuizResult,
  SyncResponse,
} from './models';
import { OfflineStore } from './offline-store';
import { ToastService } from './toast.service';

const K_COURSES = 'courses';
const K_PROGRESS = 'progress';
const K_QUEUE = 'queue';
const K_CERTS = 'certificates';
const K_LAST = 'lastLesson';
const K_PF_QUEUE = 'portfolioQueue';

export interface LastLesson {
  courseId: number;
  lessonId: number;
  courseTitle: string;
  lessonTitle: string;
  icon: string | null;
}

/**
 * Logique "offline-first" :
 *  - lecture : ce qui est stocke sur l'appareil d'abord, rafraichi si le reseau est la ;
 *  - ecriture : progression enregistree localement + file d'attente, envoyee des que la connexion revient
 *    (synchronisation idempotente cote serveur, conflits resolus par regles deterministes).
 */
@Injectable({ providedIn: 'root' })
export class LearningService {
  private http = inject(HttpClient);
  private store = inject(OfflineStore);
  private media = inject(MediaCacheService);
  private toast = inject(ToastService);

  readonly online = signal(navigator.onLine);
  readonly pending = signal(0);
  readonly syncing = signal(false);
  readonly lastSync = signal<Date | null>(null);
  readonly progress = signal<Map<number, ProgressItem>>(new Map());
  readonly downloaded = signal<Set<number>>(new Set());
  readonly lastLesson = signal<LastLesson | null>(null);
  private readonly lessonIndex = signal<Map<number, number[]>>(new Map());

  /** Jours consecutifs avec au moins une lecon terminee (jusqu'a aujourd'hui ou hier). */
  readonly streak = computed(() => {
    const days = new Set([...this.progress().values()].map((p) => p.completedAt.slice(0, 10)));
    let n = 0;
    const d = new Date();
    if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
    while (days.has(iso(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  });

  /** Lecons terminees sur les 7 derniers jours (objectif hebdomadaire). */
  readonly weekCount = computed(() => {
    const since = Date.now() - 7 * 86400_000;
    return [...this.progress().values()].filter((p) => Date.parse(p.completedAt) >= since).length;
  });

  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    window.addEventListener('online', () => {
      this.online.set(true);
      void this.sync();
    });
    window.addEventListener('offline', () => this.online.set(false));
    setInterval(() => void this.sync(), 60_000);
    await this.media.init();
  }

  async reloadLocalState(): Promise<void> {
    const items = (await this.store.get<ProgressItem[]>('kv', K_PROGRESS)) ?? [];
    const queue = (await this.store.get<ProgressItem[]>('kv', K_QUEUE)) ?? [];
    this.progress.set(toMap([...items, ...queue]));
    this.pending.set(queue.length + ((await this.store.get<unknown[]>('kv', K_PF_QUEUE)) ?? []).length);
    this.lastLesson.set((await this.store.get<LastLesson>('kv', K_LAST)) ?? null);
    const keys = await this.store.keys('packages');
    this.downloaded.set(new Set(keys.map((k) => Number(k))));
    const index = new Map<number, number[]>();
    for (const k of keys) {
      const pkg = await this.store.get<CoursePackage>('packages', k);
      if (pkg) index.set(pkg.id, pkg.lessons.map((l) => l.id));
    }
    this.lessonIndex.set(index);
  }

  localDoneCount(courseId: number): number {
    const ids = this.lessonIndex().get(courseId) ?? [];
    const p = this.progress();
    return ids.filter((id) => p.has(id)).length;
  }

  // ---------- Test d'entree ----------
  placementQuestions(): Promise<PlacementQuestion[]> {
    return firstValueFrom(this.http.get<PlacementQuestion[]>('/api/placement'));
  }

  submitPlacement(answers: Record<number, number>): Promise<PlacementResult> {
    return firstValueFrom(this.http.post<PlacementResult>('/api/placement', { answers }));
  }

  // ---------- Modules ----------
  async courses(): Promise<{ list: CourseSummary[]; fromCache: boolean }> {
    try {
      const list = await firstValueFrom(this.http.get<CourseSummary[]>('/api/courses'));
      await this.store.set('kv', K_COURSES, list);
      return { list, fromCache: false };
    } catch (e) {
      const cached = await this.store.get<CourseSummary[]>('kv', K_COURSES);
      if (cached) return { list: cached, fromCache: true };
      throw e;
    }
  }

  async coursePackage(id: number, expectedVersion?: number): Promise<{ pkg: CoursePackage; fromCache: boolean }> {
    const local = await this.store.get<CoursePackage>('packages', id);
    const stale = local && expectedVersion !== undefined && local.contentVersion < expectedVersion;
    if (local && !stale) return { pkg: local, fromCache: true };
    try {
      const pkg = await firstValueFrom(this.http.get<CoursePackage>(`/api/courses/${id}/package`));
      await this.savePackage(pkg);
      if (stale) {
        // nouvelle version publiee : on remet aussi les medias a jour
        void this.downloadMedia(pkg);
        this.toast.show({ icon: '🔄', title: 'Module mis à jour', text: pkg.title });
      }
      return { pkg, fromCache: false };
    } catch (e) {
      if (local) return { pkg: local, fromCache: true };
      throw e;
    }
  }

  /** Telecharge le module complet : textes, quiz et medias (video, audio, sous-titres). */
  async download(id: number, onProgress?: (ratio: number) => void): Promise<CoursePackage> {
    const pkg = await firstValueFrom(this.http.get<CoursePackage>(`/api/courses/${id}/package`));
    await this.savePackage(pkg);
    await this.downloadMedia(pkg, onProgress);
    return pkg;
  }

  private async downloadMedia(pkg: CoursePackage, onProgress?: (ratio: number) => void): Promise<void> {
    const files = pkg.lessons.flatMap((l) => [l.mediaUrl, l.subtitlesUrl]).filter((u): u is string => !!u && u.startsWith('/'));
    const total = pkg.lessons.reduce((s, l) => s + l.mediaSizeBytes, 0) || 1;
    let done = 0;
    for (const url of files) {
      const size = pkg.lessons.find((l) => l.mediaUrl === url)?.mediaSizeBytes ?? 0;
      await this.media.download(url, (r) => onProgress?.(Math.min(1, (done + r * size) / total)));
      done += size;
    }
    onProgress?.(1);
  }

  private async savePackage(pkg: CoursePackage): Promise<void> {
    await this.store.set('packages', pkg.id, pkg);
    this.downloaded.update((s) => new Set(s).add(pkg.id));
    this.lessonIndex.update((m) => new Map(m).set(pkg.id, pkg.lessons.map((l) => l.id)));
  }

  async removeDownload(id: number): Promise<void> {
    const pkg = await this.store.get<CoursePackage>('packages', id);
    if (pkg) {
      await this.media.remove(pkg.lessons.flatMap((l) => [l.mediaUrl, l.subtitlesUrl]).filter((u): u is string => !!u));
    }
    await this.store.delete('packages', id);
    this.downloaded.update((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  async setLastLesson(l: LastLesson): Promise<void> {
    this.lastLesson.set(l);
    await this.store.set('kv', K_LAST, l);
  }

  // ---------- Progression ----------
  isDone(lessonId: number): boolean {
    return this.progress().has(lessonId);
  }

  async completeLesson(lessonId: number, timeSpentSeconds: number): Promise<void> {
    const existing = this.progress().get(lessonId);
    const item: ProgressItem = {
      lessonId,
      completedAt: existing?.completedAt ?? new Date().toISOString(),
      timeSpentSeconds: Math.min(86400, Math.max(existing?.timeSpentSeconds ?? 0, Math.round(timeSpentSeconds))),
      offline: !navigator.onLine || !!existing?.offline,
    };
    const queue = (await this.store.get<ProgressItem[]>('kv', K_QUEUE)) ?? [];
    queue.push(item);
    await this.store.set('kv', K_QUEUE, queue);
    this.pending.update((n) => n + 1);
    this.progress.update((m) => new Map(m).set(lessonId, item));
    void this.sync();
  }

  async sync(): Promise<void> {
    if (this.syncing() || !navigator.onLine) return;
    this.syncing.set(true);
    try {
      await this.flushPortfolioQueue();
      const queue = (await this.store.get<ProgressItem[]>('kv', K_QUEUE)) ?? [];
      let serverState: ProgressItem[];
      if (queue.length) {
        const sent = queue.slice(0, 500);
        const res = await firstValueFrom(this.http.post<SyncResponse>('/api/sync/progress', { items: sent }));
        serverState = res.serverState;
        const current = (await this.store.get<ProgressItem[]>('kv', K_QUEUE)) ?? [];
        await this.store.set('kv', K_QUEUE, current.slice(sent.length));
        this.celebrate(res.newCertificates);
      } else {
        serverState = await firstValueFrom(this.http.get<ProgressItem[]>('/api/progress'));
      }
      await this.store.set('kv', K_PROGRESS, serverState);
      const remaining = (await this.store.get<ProgressItem[]>('kv', K_QUEUE)) ?? [];
      const pfRemaining = (await this.store.get<unknown[]>('kv', K_PF_QUEUE)) ?? [];
      this.pending.set(remaining.length + pfRemaining.length);
      this.progress.set(toMap([...serverState, ...remaining]));
      this.online.set(true);
      this.lastSync.set(new Date());
    } catch {
      // reseau indisponible : nouvel essai plus tard, rien n'est perdu
    } finally {
      this.syncing.set(false);
    }
  }

  celebrate(certs: Certificate[]): void {
    for (const c of certs) {
      this.toast.show({ icon: '🎉', title: c.levelLabel + ' obtenu·e !', text: c.courseTitle, celebrate: true }, 7000);
    }
  }

  // ---------- Evaluation (corrigee cote serveur) ----------
  async submitQuiz(courseId: number, answers: number[]): Promise<QuizResult> {
    await this.sync();
    const r = await firstValueFrom(this.http.post<QuizResult>(`/api/courses/${courseId}/quiz`, { answers }));
    this.celebrate(r.newCertificates);
    return r;
  }

  // ---------- Portfolio (texte : file d'attente hors ligne ; video : necessite le reseau) ----------
  async submitPortfolio(courseId: number, lessonId: number | null, text: string, mediaUrl: string | null): Promise<'sent' | 'queued'> {
    const body = { courseId, lessonId, text, mediaUrl };
    if (navigator.onLine) {
      try {
        await firstValueFrom(this.http.post<Portfolio>('/api/portfolio', body));
        return 'sent';
      } catch {
        /* file d'attente */
      }
    }
    const q = (await this.store.get<unknown[]>('kv', K_PF_QUEUE)) ?? [];
    q.push(body);
    await this.store.set('kv', K_PF_QUEUE, q);
    this.pending.update((n) => n + 1);
    return 'queued';
  }

  private async flushPortfolioQueue(): Promise<void> {
    const q = (await this.store.get<unknown[]>('kv', K_PF_QUEUE)) ?? [];
    while (q.length) {
      await firstValueFrom(this.http.post<Portfolio>('/api/portfolio', q[0]));
      q.shift();
      await this.store.set('kv', K_PF_QUEUE, q);
    }
  }

  myPortfolio(): Promise<Portfolio[]> {
    return firstValueFrom(this.http.get<Portfolio[]>('/api/portfolio'));
  }

  // ---------- Avis ----------
  async myFeedback(courseId: number): Promise<Feedback | null> {
    return (await firstValueFrom(this.http.get<Feedback | null>(`/api/courses/${courseId}/feedback`))) ?? null;
  }

  saveFeedback(courseId: number, f: Feedback): Promise<unknown> {
    return firstValueFrom(this.http.put(`/api/courses/${courseId}/feedback`, f));
  }

  // ---------- Certificats ----------
  async certificates(): Promise<{ list: Certificate[]; fromCache: boolean }> {
    try {
      const list = await firstValueFrom(this.http.get<Certificate[]>('/api/certificates'));
      await this.store.set('kv', K_CERTS, list);
      return { list, fromCache: false };
    } catch (e) {
      const cached = await this.store.get<Certificate[]>('kv', K_CERTS);
      if (cached) return { list: cached, fromCache: true };
      throw e;
    }
  }

  verifyCertificate(code: string): Promise<Certificate> {
    return firstValueFrom(this.http.get<Certificate>(`/api/public/certificates/${encodeURIComponent(code)}`));
  }

  /** Recherche plein texte dans les modules telecharges (assistant hors ligne). */
  async searchOffline(query: string): Promise<{ course: string; lesson: string; text: string }[]> {
    const words = tokens(query);
    const hits: { course: string; lesson: string; text: string; score: number }[] = [];
    for (const k of await this.store.keys('packages')) {
      const pkg = await this.store.get<CoursePackage>('packages', k);
      if (!pkg) continue;
      for (const l of pkg.lessons) {
        for (const para of (l.content ?? '').split(/\n\s*\n|\n/)) {
          const t = tokens(para + ' ' + l.title);
          const score = [...words].filter((w) => t.has(w)).length;
          if (score > 0 && para.trim().length > 20) hits.push({ course: pkg.title, lesson: l.title, text: para.trim(), score });
        }
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 3);
  }
}

function toMap(items: ProgressItem[]): Map<number, ProgressItem> {
  const m = new Map<number, ProgressItem>();
  for (const it of items) {
    const prev = m.get(it.lessonId);
    m.set(it.lessonId, prev ? { ...prev, timeSpentSeconds: Math.max(prev.timeSpentSeconds, it.timeSpentSeconds) } : it);
  }
  return m;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const STOP = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'en', 'dans', 'pour', 'que', 'qui', 'est', 'comment', 'pourquoi', 'je', 'vous', 'avec', 'sur', 'par', 'pas', 'faire']);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => (w.length > 5 ? w.slice(0, 5) : w)),
  );
}
