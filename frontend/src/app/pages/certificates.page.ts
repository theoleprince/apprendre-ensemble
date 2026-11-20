import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { Certificate, LEVELS, ProgramCert, ordinal } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { IconComponent } from '../shared/icon.component';
import { MedalComponent } from '../shared/visuals';

@Component({
  selector: 'app-certificates',
  imports: [DatePipe, RouterLink, IconComponent, MedalComponent],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Mes certificats</h1>
      <button (click)="transcript()" [disabled]="!learning.online() || busy()"><app-icon name="file" /> Relevé de formation (PDF)</button>
    </div>
    @if (fromCache()) { <p class="notice"><app-icon name="wifi-off" /> Liste enregistrée sur l'appareil.</p> }
    @if (error()) { <p class="error">{{ error() }}</p> }

    <section class="tiles section">
      @for (lv of levels; track lv.key) {
        <div class="tile center"><app-medal [level]="lv.key" [earned]="count(lv.key) > 0" [size]="44" />
          <span class="value">{{ count(lv.key) }}</span><span class="label">{{ lv.short }}</span></div>
      }
    </section>

    @if (programCerts().length) {
      <h2 class="section">Certificats de parcours</h2>
      <div class="stack">
        @for (c of programCerts(); track c.code) {
          <article class="card cert-card" [class.laureate]="!!c.rank">
            <app-medal [level]="c.rank ? 'EXPERTISE' : 'MAITRISE'" [size]="64" />
            <div class="grow" style="flex:1;min-width:0">
              <div class="xs muted" style="text-transform:uppercase;letter-spacing:.05em">Certificat de parcours @if (c.rank) {· Lauréat·e}</div>
              <h3 style="margin:.1rem 0">{{ c.programTitle }}</h3>
              <div class="small muted">@if (c.rank) {{{ rankLabel(c.rank) }} sur {{ c.classSize }} · {{ c.points }} points · }@if (c.classroomName) {{{ c.classroomName }} · }code <span class="kbd">{{ c.code }}</span></div>
              @if (c.revokedAt) {
                <p class="tag clay" style="margin-top:.5rem">Certificat révoqué</p>
              } @else {
                <div class="row" style="margin-top:.6rem">
                  <a class="btn primary" [href]="'/api/public/certificates/' + c.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" /> PDF</a>
                  <a class="btn" [href]="linkedInProgram(c.programTitle, c.code, c.issuedAt)" target="_blank" rel="noopener"><app-icon name="linkedin" /> LinkedIn</a>
                </div>
              }
            </div>
          </article>
        }
      </div>
      <h2 class="section">Certificats de module</h2>
    }
    <div class="stack">
      @for (c of sorted(); track c.code) {
        <article class="card cert-card">
          <app-medal [level]="c.level || 'MAITRISE'" [size]="60" />
          <div class="grow" style="flex:1;min-width:0">
            <div class="xs muted" style="text-transform:uppercase;letter-spacing:.05em">{{ c.levelLabel }}</div>
            <h3 style="margin:.1rem 0">{{ c.courseTitle }}</h3>
            <div class="small muted">Délivré le {{ c.issuedAt | date: 'dd/MM/yyyy' }} @if (c.level !== 'ATTESTATION') {· score {{ c.scorePercent }} %} · code <span class="kbd">{{ c.code }}</span></div>
            @if (c.revokedAt) {
              <p class="tag clay" style="margin-top:.5rem">Certificat révoqué @if (c.revokedReason) {: {{ c.revokedReason }}}</p>
            } @else {
              <div class="row" style="margin-top:.6rem">
                <a class="btn primary" [href]="'/api/public/certificates/' + c.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" /> PDF</a>
                <a class="btn" [href]="linkedIn(c)" target="_blank" rel="noopener"><app-icon name="linkedin" /> LinkedIn</a>
                <a class="btn ghost" [routerLink]="['/verifier', c.code]"><app-icon name="shield" /> Vérifier</a>
              </div>
            }
          </div>
        </article>
      } @empty {
        @if (!loading()) {
          <div class="empty"><app-medal level="ATTESTATION" [earned]="false" [size]="64" /><br />Pas encore de certificat.<br />Terminez les leçons d'un module pour obtenir votre première attestation.
            <p><a class="btn primary" routerLink="/catalogue">Parcourir le catalogue</a></p></div>
        }
      }
    </div>
  `,
})
export class CertificatesPage implements OnInit {
  protected learning = inject(LearningService);
  private http = inject(HttpClient);
  private programs = inject(ProgramApi);

  levels = LEVELS;
  list = signal<Certificate[]>([]);
  fromCache = signal(false);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  sorted = computed(() =>
    [...this.list()].sort((a, b) => LEVELS.findIndex((l) => l.key === b.level) - LEVELS.findIndex((l) => l.key === a.level)),
  );

  programCerts = signal<ProgramCert[]>([]);

  rankLabel(n: number): string {
    return ordinal(n);
  }

  linkedInProgram(title: string, code: string, issuedAt: string): string {
    const d = new Date(issuedAt);
    const p = new URLSearchParams({ startTask: 'CERTIFICATION_NAME', name: 'Certificat de parcours - ' + title, issueYear: String(d.getFullYear()),
      issueMonth: String(d.getMonth() + 1), certId: code, certUrl: `${location.origin}/verifier/${code}` });
    return `https://www.linkedin.com/profile/add?${p.toString()}`;
  }

  async ngOnInit(): Promise<void> {
    void this.programs.programCertificates().then((r) => this.programCerts.set(r.data)).catch(() => undefined);
    try {
      const { list, fromCache } = await this.learning.certificates();
      this.list.set(list);
      this.fromCache.set(fromCache);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  count(l: string): number {
    return this.list().filter((c) => c.level === l).length;
  }


  /** Formulaire LinkedIn "Ajouter une certification", pre-rempli avec le lien de verification public. */
  linkedIn(c: Certificate): string {
    const d = new Date(c.issuedAt);
    const p = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: `${c.levelLabel} - ${c.courseTitle}`,
      issueYear: String(d.getFullYear()),
      issueMonth: String(d.getMonth() + 1),
      certId: c.code,
      certUrl: `${location.origin}/verifier/${c.code}`,
    });
    return `https://www.linkedin.com/profile/add?${p.toString()}`;
  }

  async transcript(): Promise<void> {
    this.busy.set(true);
    try {
      const blob = await firstValueFrom(this.http.get('/api/me/transcript.pdf', { responseType: 'blob' }));
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
