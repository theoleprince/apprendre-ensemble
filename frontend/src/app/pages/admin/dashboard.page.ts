import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { CountStat, Dashboard, LEVELS, ROLE_LABELS, Role } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { AdminFiles, query } from './admin-api';

const DATASETS = [
  { key: 'learners', label: 'Apprenants (profils pseudonymisés)' },
  { key: 'progress', label: 'Progression par leçon' },
  { key: 'quiz', label: 'Évaluations (réponses détaillées)' },
  { key: 'feedback', label: 'Retours d’expérience' },
  { key: 'certificates', label: 'Certifications' },
];

/**
 * Tableau de bord du programme. Graphiques a une seule serie (couleur de marque, contraste >= 3:1 valide),
 * valeurs affichees, infobulle au survol / focus clavier ; le tableau par module sert de vue tabulaire.
 */
@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, IconComponent, DecimalPipe],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Pilotage du programme</h1>
      <button class="primary" (click)="pdf()"><app-icon name="file" /> Rapport PDF</button>
    </div>

    <div class="row card flat" style="padding:.6rem .8rem">
      <app-icon name="search" />
      <select [(ngModel)]="country" (change)="load()" aria-label="Pays" style="width:auto;margin:0"><option value="">Tous les pays</option><option value="BJ">Bénin</option><option value="CI">Côte d'Ivoire</option><option value="CH">Suisse</option></select>
      <select [(ngModel)]="region" (change)="load()" aria-label="Zone" style="width:auto;margin:0"><option value="">Toutes les zones</option>
        @for (r of regions(); track r) { <option [value]="r">{{ r }}</option> }</select>
      <select [(ngModel)]="cohort" (change)="load()" aria-label="Groupe RCT" style="width:auto;margin:0"><option value="">Tous les groupes</option><option value="TRAITEMENT">Traitement</option><option value="CONTROLE">Contrôle</option></select>
    </div>
    @if (error()) { <p class="error">{{ error() }}</p> }

    @if (d(); as d) {
      <section class="tiles section">
        <div class="tile"><span class="value">{{ d.learners }}</span><span class="label">Apprenant·es</span></div>
        <div class="tile"><span class="value">{{ d.active7d }}</span><span class="label">Actifs sur 7 jours</span><div class="hint">{{ pct(d.active7d, d.learners) }} % des inscrits</div></div>
        <div class="tile"><span class="value">{{ d.loginsPerLearnerPerWeek | number: '1.1-1' }}</span><span class="label">Connexions / apprenant / semaine</span></div>
        <div class="tile"><span class="value">{{ d.lessonsCompleted }}</span><span class="label">Leçons terminées</span></div>
        <div class="tile"><span class="value">{{ round(d.offlineShare * 100) }} %</span><span class="label">Suivies hors ligne</span></div>
        <div class="tile"><span class="value">{{ d.certificates }}</span><span class="label">Certifications</span></div>
        <div class="tile"><span class="value">{{ d.avgRating ? (d.avgRating | number: '1.1-1') : '—' }}</span><span class="label">Satisfaction /5</span></div>
      </section>

      <div class="grid cols-2">
        <section class="card">
          <h2>Leçons terminées par jour</h2>
          <p class="xs muted">14 derniers jours · survolez une barre pour le détail</p>
          <div class="chart-cols" role="img" [attr.aria-label]="'Leçons terminées par jour, total ' + total(d.activityLast14Days)">
            @for (p of d.activityLast14Days; track p.label) {
              <div class="col" tabindex="0" [attr.aria-label]="day(p.label) + ' : ' + p.count + ' leçon(s)'">
                <span class="tip">{{ day(p.label) }} · {{ p.count }} leçon(s)</span>
                <div class="bar" [style.height.%]="scale(p.count, maxOf(d.activityLast14Days))"></div>
              </div>
            }
          </div>
          <div class="chart-x">@for (p of d.activityLast14Days; track p.label; let i = $index) {<span>{{ i % 2 === 0 ? p.label.slice(8) : '' }}</span>}</div>
        </section>

        <section class="card">
          <h2>Certifications par niveau</h2>
          <p class="xs muted">Total {{ d.certificates }}</p>
          <div class="hbars">
            @for (c of d.certificatesByLevel; track c.label) {
              <div class="hbar"><span>{{ levelShort(c.label) }}</span>
                <div class="track"><div class="fill" [style.width.%]="scale(c.count, maxOf(d.certificatesByLevel))"></div></div><span class="v">{{ c.count }}</span></div>
            } @empty { <p class="muted small">Aucune certification.</p> }
          </div>
          <h2 class="section">Apprenant·es par groupe</h2>
          <div class="hbars">
            @for (c of d.learnersByCohort; track c.label) {
              <div class="hbar"><span>{{ c.label }}</span><div class="track"><div class="fill" [style.width.%]="scale(c.count, maxOf(d.learnersByCohort))"></div></div><span class="v">{{ c.count }}</span></div>
            }
          </div>
        </section>
      </div>

      <section class="card section">
        <div class="section-head"><h2>Indicateurs par module</h2><a routerLink="/admin/modules" class="small">Gérer les modules</a></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Module</th><th class="num">Démarré</th><th class="num">Terminé</th><th>Complétion</th><th class="num">Score moy.</th>
              <th class="num">Temps moy. / méd.</th><th class="num">Abandons</th><th class="num">Hors ligne</th><th class="num">Avis</th><th></th></tr></thead>
            <tbody>
              @for (c of d.courses; track c.courseId) {
                <tr>
                  <td><strong>{{ c.title }}</strong></td>
                  <td class="num">{{ c.started }}</td>
                  <td class="num">{{ c.completed }}</td>
                  <td style="min-width:120px"><div class="row" style="gap:.4rem;flex-wrap:nowrap"><div class="progress" style="flex:1"><div [style.width.%]="c.completionRate * 100"></div></div><span class="small" style="font-variant-numeric:tabular-nums">{{ round(c.completionRate * 100) }} %</span></div></td>
                  <td class="num">{{ c.avgScore ? round(c.avgScore) + ' %' : '—' }}</td>
                  <td class="num">{{ c.completed ? round(c.avgMinutes) + ' / ' + round(c.medianMinutes) + ' min' : '—' }}</td>
                  <td class="num">@if (c.dropouts) {<span class="tag clay">{{ c.dropouts }}</span>} @else {0}</td>
                  <td class="num">{{ round(c.offlineShare * 100) }} %</td>
                  <td class="num">{{ c.feedbackCount ? (c.avgRating | number: '1.1-1') : '—' }}</td>
                  <td><a class="btn ghost" [routerLink]="['/admin/modules', c.courseId, 'analyse']" title="Analyse des erreurs et suggestions IA"><app-icon name="lightbulb" [size]="18" /></a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="xs muted">Abandon : module commencé, non terminé, sans activité depuis 14 jours. Temps : temps actif mesuré sur l'appareil.</p>
      </section>

      <div class="grid cols-2 section">
        <section class="card">
          <h2>Apprenant·es par zone</h2>
          <div class="hbars">
            @for (c of d.learnersByRegion; track c.label) {
              <div class="hbar"><span>{{ c.label }}</span><div class="track"><div class="fill" [style.width.%]="scale(c.count, maxOf(d.learnersByRegion))"></div></div><span class="v">{{ c.count }}</span></div>
            }
          </div>
          <h2 class="section">Par public</h2>
          <div class="hbars">
            @for (c of d.learnersByRole; track c.label) {
              <div class="hbar"><span>{{ roleLabel(c.label) }}</span><div class="track"><div class="fill" [style.width.%]="scale(c.count, maxOf(d.learnersByRole))"></div></div><span class="v">{{ c.count }}</span></div>
            }
          </div>
        </section>
        <section class="card">
          <h2><app-icon name="download" /> Exports pour l'évaluation d'impact</h2>
          <p class="small muted">Formats ouverts CSV et JSON. Données pseudonymisées (identifiant technique, groupe RCT, zone) : aucun nom ni email.</p>
          <table>
            @for (ds of datasets; track ds.key) {
              <tr><td>{{ ds.label }}</td>
                <td class="num" style="white-space:nowrap"><button class="ghost" (click)="exp(ds.key, 'csv')">CSV</button><button class="ghost" (click)="exp(ds.key, 'json')">JSON</button></td></tr>
            }
          </table>
        </section>
      </div>
    } @else if (!error()) {
      <div class="skeleton section" style="height:300px"></div>
    }
  `,
})
export class DashboardPage implements OnInit {
  private http = inject(HttpClient);
  private files = inject(AdminFiles);

  datasets = DATASETS;
  d = signal<Dashboard | null>(null);
  error = signal('');
  country = '';
  region = '';
  cohort = '';
  private allRegions = signal<string[]>([]);
  regions = computed(() => this.allRegions());

  async ngOnInit(): Promise<void> {
    await this.load();
    this.allRegions.set((this.d()?.learnersByRegion ?? []).map((r) => r.label).filter((r) => r !== '-'));
  }

  async load(): Promise<void> {
    try {
      this.d.set(await firstValueFrom(this.http.get<Dashboard>('/api/admin/dashboard' + this.q())));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private q(): string {
    return query({ country: this.country, region: this.region, cohort: this.cohort });
  }

  pdf(): void {
    void this.files.open('/api/admin/report.pdf' + this.q());
  }

  exp(ds: string, fmt: string): void {
    void this.files.download(`/api/admin/export/${ds}.${fmt}`, `${ds}.${fmt}`);
  }

  maxOf(l: CountStat[]): number {
    return Math.max(1, ...l.map((x) => x.count));
  }

  scale(v: number, max: number): number {
    return v === 0 ? 0 : Math.max(2, (v * 100) / max);
  }

  total(l: CountStat[]): number {
    return l.reduce((s, x) => s + x.count, 0);
  }

  pct(a: number, b: number): number {
    return b ? Math.round((a * 100) / b) : 0;
  }

  round(n: number): number {
    return Math.round(n);
  }

  day(iso: string): string {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  levelShort(label: string): string {
    const l = LEVELS.find((x) => x.label.toLowerCase() === label.toLowerCase());
    return l ? l.short : label;
  }

  roleLabel(r: string): string {
    return ROLE_LABELS[r as Role] ?? r;
  }
}
