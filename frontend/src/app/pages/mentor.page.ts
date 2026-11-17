import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { Portfolio, PortfolioStatus } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/visuals';

/** Mentorat : evaluation des portfolios et videos de pratique de classe (debloque la certification d'expertise). */
@Component({
  selector: 'app-mentor',
  imports: [FormsModule, IconComponent, DatePipe, AvatarComponent],
  template: `
    <h1>Mentorat</h1>
    <p class="muted">Portfolios à évaluer dans votre zone. Une validation débloque la certification d'expertise de l'apprenant·e.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <div class="tiles section"><div class="tile"><span class="value">{{ items().length }}</span><span class="label">en attente</span></div>
      <div class="tile"><span class="value">{{ reviewed() }}</span><span class="label">évalués aujourd'hui</span></div></div>
    <div class="stack">
      @for (p of items(); track p.id) {
        <article class="card">
          <div class="row"><app-avatar [name]="p.learnerName" />
            <div class="grow" style="flex:1"><strong>{{ p.learnerName }}</strong>
              <div class="xs muted">{{ p.courseTitle }} @if (p.lessonTitle) {› {{ p.lessonTitle }}} · {{ p.submittedAt | date: 'dd/MM HH:mm' }}</div></div></div>
          @if (p.text) { <p style="white-space:pre-wrap">{{ p.text }}</p> }
          @if (p.mediaUrl) { <video [src]="p.mediaUrl" controls preload="none" style="max-height:320px;border-radius:12px;width:100%;background:#000"></video> }
          <label>Retour au mentoré·e <textarea rows="2" [(ngModel)]="feedback[p.id]" [name]="'f' + p.id" maxlength="4000" placeholder="Points forts, piste d'amélioration…"></textarea></label>
          <div class="row">
            <button class="primary" (click)="review(p, 'VALIDE')"><app-icon name="check" /> Valider</button>
            <button (click)="review(p, 'A_REVOIR')" [disabled]="!feedback[p.id]?.trim()">Demander une révision</button>
          </div>
        </article>
      } @empty {
        @if (!loading()) { <div class="empty"><div class="empty-icon"><app-icon name="check-circle" [size]="30" /></div>Aucun portfolio en attente.</div> }
      }
    </div>
  `,
})
export class MentorPage implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  items = signal<Portfolio[]>([]);
  loading = signal(true);
  reviewed = signal(0);
  error = signal('');
  feedback: Record<number, string> = {};

  async ngOnInit(): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.http.get<Portfolio[]>('/api/mentor/portfolios')));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async review(p: Portfolio, status: PortfolioStatus): Promise<void> {
    try {
      await firstValueFrom(this.http.put(`/api/mentor/portfolios/${p.id}`, { status, feedback: this.feedback[p.id] ?? null }));
      this.items.update((l) => l.filter((x) => x.id !== p.id));
      this.reviewed.update((n) => n + 1);
      this.toast.show({ icon: status === 'VALIDE' ? 'check-circle' : 'edit', title: status === 'VALIDE' ? 'Portfolio validé' : 'Révision demandée', text: p.learnerName }, 2500);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
