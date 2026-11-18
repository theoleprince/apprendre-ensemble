import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { STATUS_LABELS, SchoolDashboard } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { IconComponent } from '../shared/icon.component';
import { TeamTableComponent } from '../shared/team-table.component';

/** Direction d'ecole : suivi de la formation de son equipe (progression, decrochage, classes). */
@Component({
  selector: 'app-school',
  imports: [RouterLink, IconComponent, TeamTableComponent],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (d(); as d) {
      <div class="xs muted" style="text-transform:uppercase;letter-spacing:.04em">Mon école</div>
      <h1 style="margin-top:.2rem">{{ d.school.name }}</h1>
      <p class="muted small">{{ d.school.commune }} · {{ d.school.region }}</p>
      <section class="tiles section">
        <div class="tile"><span class="value">{{ d.staff }}</span><span class="label">Enseignant·es</span></div>
        <div class="tile"><span class="value">{{ d.active7d }}</span><span class="label">Actifs cette semaine</span></div>
        <div class="tile"><span class="value">{{ d.avgProgress }} %</span><span class="label">Progression moyenne</span></div>
        <div class="tile"><span class="value" [style.color]="d.dropouts ? 'var(--clay)' : ''">{{ d.dropouts }}</span><span class="label">Décrochent</span><div class="hint">plus de 14 jours sans activité</div></div>
      </section>
      @if (d.dropouts) {
        <p class="notice"><app-icon name="lightbulb" /> {{ d.dropouts }} collègue(s) n'avancent plus. Un mot d'encouragement ou 30 minutes de formation collective pendant la concertation suffisent souvent.</p>
      }
      @if (d.classrooms.length) {
        <h2 class="section">Classes de formation</h2>
        <div class="stack">
          @for (c of d.classrooms; track c.id) {
            <a class="card class-banner" [routerLink]="['/classes', c.id]">
              <div class="class-icon"><app-icon name="users" [size]="22" /></div>
              <div style="flex:1"><strong>{{ c.name }}</strong><div class="small muted">{{ statusLabel(c.status) }} · {{ c.memberCount }} participant·es</div></div>
              <app-icon name="arrow" />
            </a>
          }
        </div>
      }
      <h2 class="section">Mon équipe</h2>
      <app-team-table [rows]="d.rows" />
    } @else if (!error()) {
      <div class="skeleton" style="height:300px"></div>
    }
  `,
})
export class SchoolPage implements OnInit {
  private api = inject(ProgramApi);
  d = signal<SchoolDashboard | null>(null);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.d.set(await this.api.school());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }
}
