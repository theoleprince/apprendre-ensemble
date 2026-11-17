import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { Certificate, LEVELS } from '../core/models';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-certificates',
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Mes certificats</h1>
      <button (click)="transcript()" [disabled]="!learning.online() || busy()"><app-icon name="file" /> Relevé de formation (PDF)</button>
    </div>
    @if (fromCache()) { <p class="notice"><app-icon name="wifi-off" /> Liste enregistrée sur l'appareil.</p> }
    @if (error()) { <p class="error">{{ error() }}</p> }

    <section class="tiles section">
      @for (lv of levels; track lv.key) {
        <div class="tile center"><div style="font-size:1.8rem" [style.filter]="count(lv.key) ? 'none' : 'grayscale(1)'" [style.opacity]="count(lv.key) ? 1 : 0.4">{{ lv.icon }}</div>
          <span class="value">{{ count(lv.key) }}</span><span class="label">{{ lv.short }}</span></div>
      }
    </section>

    <div class="stack">
      @for (c of sorted(); track c.code) {
        <article class="card cert-card">
          <div class="medal">{{ icon(c.level) }}</div>
          <div class="grow" style="flex:1;min-width:0">
            <div class="xs muted" style="text-transform:uppercase;letter-spacing:.05em">{{ c.levelLabel }}</div>
            <h3 style="margin:.1rem 0">{{ c.courseTitle }}</h3>
            <div class="small muted">Délivré le {{ c.issuedAt | date: 'dd/MM/yyyy' }} @if (c.level !== 'ATTESTATION') {· score {{ c.scorePercent }} %} · code <span class="kbd">{{ c.code }}</span></div>
            <div class="row" style="margin-top:.6rem">
              <a class="btn primary" [href]="'/api/public/certificates/' + c.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" /> PDF</a>
              <a class="btn" [href]="linkedIn(c)" target="_blank" rel="noopener"><app-icon name="linkedin" /> LinkedIn</a>
              <a class="btn ghost" [routerLink]="['/verifier', c.code]"><app-icon name="shield" /> Vérifier</a>
            </div>
          </div>
        </article>
      } @empty {
        @if (!loading()) {
          <div class="empty"><div class="big">🏅</div>Pas encore de certificat.<br />Terminez les leçons d'un module pour obtenir votre première attestation.
            <p><a class="btn primary" routerLink="/modules">Voir les modules</a></p></div>
        }
      }
    </div>
  `,
})
export class CertificatesPage implements OnInit {
  protected learning = inject(LearningService);
  private http = inject(HttpClient);

  levels = LEVELS;
  list = signal<Certificate[]>([]);
  fromCache = signal(false);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  sorted = computed(() =>
    [...this.list()].sort((a, b) => LEVELS.findIndex((l) => l.key === b.level) - LEVELS.findIndex((l) => l.key === a.level)),
  );

  async ngOnInit(): Promise<void> {
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

  icon(l: string): string {
    return LEVELS.find((x) => x.key === l)?.icon ?? '🏅';
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
