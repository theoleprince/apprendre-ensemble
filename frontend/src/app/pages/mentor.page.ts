import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { MentorDashboard, Portfolio, PortfolioStatus, STATUS_LABELS } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { TeamTableComponent } from '../shared/team-table.component';
import { AvatarComponent } from '../shared/visuals';

type Tab = 'suivi' | 'portfolios';

/**
 * Espace conseiller·ere : classes animees, suivi des apprenants (decrochage), evaluation des portfolios
 * (une validation debloque la certification d'expertise).
 */
@Component({
  selector: 'app-mentor',
  imports: [FormsModule, RouterLink, IconComponent, DatePipe, AvatarComponent, TeamTableComponent],
  template: `
    <h1>Mentorat</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (d(); as d) {
      <section class="tiles">
        <div class="tile"><span class="value">{{ d.classrooms.length }}</span><span class="label">Classes animées</span></div>
        <div class="tile"><span class="value">{{ d.learners.length }}</span><span class="label">Apprenant·es suivi·es</span></div>
        <div class="tile"><span class="value" [style.color]="d.dropouts ? 'var(--clay)' : ''">{{ d.dropouts }}</span><span class="label">Décrochent</span></div>
        <div class="tile"><span class="value">{{ items().length }}</span><span class="label">Portfolios à évaluer</span></div>
      </section>

      <nav class="tabs" role="tablist">
        <button role="tab" [class.active]="tab() === 'suivi'" (click)="tab.set('suivi')">Mes classes et le suivi</button>
        <button role="tab" [class.active]="tab() === 'portfolios'" (click)="tab.set('portfolios')">Portfolios ({{ items().length }})</button>
      </nav>

      @if (tab() === 'suivi') {
        <div class="grid cols-2">
          @for (c of d.classrooms; track c.id) {
            <a class="card class-banner" [routerLink]="['/classes', c.id]" style="align-items:flex-start">
              <div class="class-icon"><app-icon name="users" [size]="22" /></div>
              <div style="flex:1;min-width:0">
                <strong>{{ c.name }}</strong>
                <div class="small muted">{{ statusLabel(c.status) }} @if (c.status === 'ACTIVE') {· semaine {{ c.week }}/{{ c.totalWeeks }}} · {{ c.memberCount }} participant·es</div>
                @if (c.inviteCode) { <div class="small" style="margin-top:.3rem">Code d'invitation : <span class="kbd">{{ c.inviteCode }}</span></div> }
              </div>
              <app-icon name="arrow" />
            </a>
          } @empty { <p class="muted">Aucune classe animée pour le moment.</p> }
        </div>
        <h2 class="section">Suivi des apprenant·es</h2>
        <app-team-table [rows]="d.learners" [showSchool]="true" />
      } @else {
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
            <div class="empty"><div class="empty-icon"><app-icon name="check-circle" [size]="30" /></div>Aucun portfolio en attente.</div>
          }
        </div>
      }
    } @else if (!error()) {
      <div class="skeleton" style="height:300px"></div>
    }
  `,
})
export class MentorPage implements OnInit {
  private http = inject(HttpClient);
  private api = inject(ProgramApi);
  private toast = inject(ToastService);
  tab = signal<Tab>('suivi');
  d = signal<MentorDashboard | null>(null);
  items = signal<Portfolio[]>([]);
  error = signal('');
  feedback: Record<number, string> = {};

  async ngOnInit(): Promise<void> {
    try {
      const [d, items] = await Promise.all([this.api.mentor(), firstValueFrom(this.http.get<Portfolio[]>('/api/mentor/portfolios'))]);
      this.d.set(d);
      this.items.set(items);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }

  async review(p: Portfolio, status: PortfolioStatus): Promise<void> {
    try {
      await firstValueFrom(this.http.put(`/api/mentor/portfolios/${p.id}`, { status, feedback: this.feedback[p.id] ?? null }));
      this.items.update((l) => l.filter((x) => x.id !== p.id));
      this.toast.show({ icon: status === 'VALIDE' ? 'check-circle' : 'edit', title: status === 'VALIDE' ? 'Portfolio validé' : 'Révision demandée', text: p.learnerName }, 2500);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
