import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { LearnerProgress, ROLE_LABELS, ordinal } from '../core/models';
import { IconComponent } from './icon.component';
import { AvatarComponent } from './visuals';

/** Tableau de suivi d'une equipe (direction d'ecole, conseiller·ere) avec filtre par statut. */
@Component({
  selector: 'app-team-table',
  imports: [DatePipe, IconComponent, AvatarComponent],
  template: `
    <div class="chips">
      @for (f of filters; track f.key) {
        <button [class.active]="filter() === f.key" (click)="filter.set(f.key)">{{ f.label }} ({{ count(f.key) }})</button>
      }
    </div>
    <div class="table-wrap section">
      <table>
        <thead><tr><th>Personne</th><th>Progression</th><th class="num opt">Leçons</th><th class="num opt">Certif.</th><th class="opt">Dernière activité</th><th>Statut</th></tr></thead>
        <tbody>
          @for (r of shown(); track r.id) {
            <tr>
              <td><div class="row" style="flex-wrap:nowrap;gap:.5rem"><app-avatar [name]="r.name" [size]="30" />
                <div><strong>{{ r.name }}</strong><div class="xs muted">{{ showSchool() ? (r.schoolName || r.region) : roleLabel(r.role) }} @if (r.rank) {· {{ rank(r.rank) }} de sa classe}</div></div></div></td>
              <td style="min-width:130px"><div class="row" style="flex-wrap:nowrap;gap:.4rem"><div class="progress" style="flex:1"><div [style.width.%]="r.programPercent"></div></div><span class="small">{{ r.programPercent }} %</span></div></td>
              <td class="num opt">{{ r.lessonsDone }}</td>
              <td class="num opt">{{ r.certificates }}</td>
              <td class="small muted opt">{{ r.lastActiveAt ? (r.lastActiveAt | date: 'dd/MM') : '—' }}</td>
              <td><span class="tag" [class.sun]="r.status === 'RALENTI'" [class.clay]="r.status === 'DECROCHE'">
                @if (r.status === 'DECROCHE') {<app-icon name="alert" [size]="12" />} {{ statusLabel(r.status) }}</span></td>
            </tr>
          } @empty { <tr><td colspan="6" class="muted center">Personne dans cette catégorie.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class TeamTableComponent {
  readonly rows = input.required<LearnerProgress[]>();
  readonly showSchool = input(false);
  filters = [
    { key: 'ALL', label: 'Tous' },
    { key: 'DECROCHE', label: 'Décrochent' },
    { key: 'RALENTI', label: 'Ralentis' },
    { key: 'ACTIF', label: 'Actifs' },
  ];
  filter = signal('ALL');
  shown = computed(() => this.rows().filter((r) => this.filter() === 'ALL' || r.status === this.filter()));

  count(k: string): number {
    return k === 'ALL' ? this.rows().length : this.rows().filter((r) => r.status === k).length;
  }

  statusLabel(s: string): string {
    return s === 'DECROCHE' ? 'Décroche' : s === 'RALENTI' ? 'Ralenti' : 'Actif';
  }

  roleLabel(r: string): string {
    return ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r;
  }

  rank(n: number): string {
    return ordinal(n);
  }
}
