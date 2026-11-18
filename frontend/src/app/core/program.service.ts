import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClassroomBrief, Leaderboard, MentorDashboard, ProgramCert, ProgramDetail, ProgramSummary, ResourceItem, SchoolDashboard } from './models';
import { OfflineStore } from './offline-store';

/**
 * Programmes, classes, classement, fiches et suivi. Les vues apprenant sont gardees sur l'appareil
 * (lecture hors ligne de son parcours et des fiches telechargees).
 */
@Injectable({ providedIn: 'root' })
export class ProgramApi {
  private http = inject(HttpClient);
  private store = inject(OfflineStore);

  private async cached<T>(key: string, url: string): Promise<{ data: T; fromCache: boolean }> {
    try {
      const data = await firstValueFrom(this.http.get<T>(url));
      await this.store.set('kv', key, data);
      return { data, fromCache: false };
    } catch (e) {
      const c = await this.store.get<T>('kv', key);
      if (c !== undefined) return { data: c, fromCache: true };
      throw e;
    }
  }

  myPrograms() {
    return this.cached<ProgramSummary[]>('programs', '/api/me/programs');
  }

  program(id: number) {
    return this.cached<ProgramDetail>('program-' + id, `/api/programs/${id}`);
  }

  leaderboard(classroomId: number) {
    return this.cached<Leaderboard>('leaderboard-' + classroomId, `/api/classrooms/${classroomId}/leaderboard`);
  }

  resources() {
    return this.cached<ResourceItem[]>('resources', '/api/resources');
  }

  programCertificates() {
    return this.cached<ProgramCert[]>('program-certs', '/api/me/program-certificates');
  }

  join(code: string): Promise<ClassroomBrief> {
    return firstValueFrom(this.http.post<ClassroomBrief>('/api/classrooms/join', { code }));
  }

  school(): Promise<SchoolDashboard> {
    return firstValueFrom(this.http.get<SchoolDashboard>('/api/school/dashboard'));
  }

  mentor(): Promise<MentorDashboard> {
    return firstValueFrom(this.http.get<MentorDashboard>('/api/mentor/dashboard'));
  }
}
