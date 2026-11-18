import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Catalog, CourseDetail, EnrollResult, MyLearning, PayMethod, ProgramPublicDetail } from './models';
import { OfflineStore } from './offline-store';

/**
 * Catalogue (consultable sans compte), inscriptions et "Mes formations".
 * Les lectures sont gardees sur l'appareil : on retrouve ses cours meme sans reseau.
 */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private http = inject(HttpClient);
  private store = inject(OfflineStore);

  /** Derniere vue de "Mes formations" (partagee entre l'accueil, le catalogue et le lecteur). */
  readonly mine = signal<MyLearning | null>(null);

  private async cached<T>(key: string, url: string): Promise<{ data: T; fromCache: boolean }> {
    try {
      const data = await firstValueFrom(this.http.get<T>(url));
      await this.store.set('kv', key, data).catch(() => undefined);
      return { data, fromCache: false };
    } catch (e) {
      const c = await this.store.get<T>('kv', key).catch(() => undefined);
      if (c !== undefined) return { data: c, fromCache: true };
      throw e;
    }
  }

  catalog() {
    return this.cached<Catalog>('catalog', '/api/public/catalog');
  }

  course(id: number) {
    return this.cached<CourseDetail>('course-' + id, `/api/public/courses/${id}`);
  }

  program(id: number) {
    return this.cached<ProgramPublicDetail>('formation-' + id, `/api/public/programs/${id}`);
  }

  async myLearning(): Promise<MyLearning> {
    const { data } = await this.cached<MyLearning>('my-learning', '/api/me/learning');
    this.mine.set(data);
    return data;
  }

  async enroll(req: { courseId?: number; programId?: number; method: PayMethod; phone?: string; code?: string }): Promise<EnrollResult> {
    const r = await firstValueFrom(this.http.post<EnrollResult>('/api/enrollments', req));
    await this.myLearning().catch(() => undefined);
    return r;
  }
}
