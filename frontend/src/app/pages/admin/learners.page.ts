import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { LearnerRow, ROLE_LABELS, RandomizeResult } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';

/** Groupes du protocole d'evaluation randomisee (J-PAL) : tirage stratifie par zone, reproductible par graine. */
@Component({
  selector: 'app-learners',
  imports: [FormsModule, IconComponent, DatePipe],
  template: `
    <h1>Apprenant·es et groupes RCT</h1>
    <p class="muted">Les modules peuvent être réservés à un groupe (ex. traitement) ou à une zone : la gestion des droits suit automatiquement l'affectation.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }

    <section class="card section">
      <h2><app-icon name="shuffle" /> Tirage aléatoire stratifié</h2>
      <div class="field-row">
        <label>Groupes (séparés par des virgules) <input [(ngModel)]="groups" name="g" /></label>
        <label>Public <select [(ngModel)]="role" name="r"><option value="">Tous</option><option value="ENSEIGNANT">Enseignant·es</option><option value="DIRECTION_ECOLE">Directions</option><option value="PARENT">Parents</option></select></label>
        <label>Graine (reproductibilité) <input type="number" [(ngModel)]="seed" name="s" /></label>
      </div>
      <label class="check"><input type="checkbox" [(ngModel)]="onlyUnassigned" name="u" /> Seulement les personnes sans groupe</label>
      <button class="primary" (click)="randomize()"><app-icon name="shuffle" /> Lancer le tirage</button>
      @if (res(); as r) {
        <p class="section"><strong>{{ r.assigned }}</strong> personnes réparties. Équilibre par zone :</p>
        <table><thead><tr><th>Zone</th>@for (g of groupList(); track g) {<th class="num">{{ g }}</th>}</tr></thead>
          <tbody>@for (z of zones(r); track z) {<tr><td>{{ z }}</td>@for (g of groupList(); track g) {<td class="num">{{ r.byRegionAndGroup[z][g] ?? 0 }}</td>}</tr>}</tbody></table>
      }
    </section>

    <section class="card section">
      <div class="section-head"><h2 style="margin:0">Liste ({{ rows().length }})</h2>
        <div class="row">
          <select [(ngModel)]="bulk" name="b" style="width:auto;margin:0"><option value="">— Assigner la sélection à —</option>
            @for (g of groupList(); track g) { <option [value]="g">{{ g }}</option> }<option value="__none">Aucun groupe</option></select>
          <button (click)="assign()" [disabled]="!bulk || !selected().size">Appliquer ({{ selected().size }})</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th><input type="checkbox" (change)="toggleAll($event)" aria-label="Tout sélectionner" /></th><th>Nom</th><th>Public</th><th>Zone</th><th>Groupe</th><th>Dernière activité</th></tr></thead>
          <tbody>
            @for (l of rows(); track l.id) {
              <tr>
                <td><input type="checkbox" [checked]="selected().has(l.id)" (change)="toggle(l.id)" [attr.aria-label]="l.fullName" /></td>
                <td>{{ l.fullName }}</td><td class="small">{{ labels[l.role] }}</td><td>{{ l.region || '—' }}</td>
                <td>@if (l.cohort) {<span class="tag" [class.violet]="l.cohort === 'CONTROLE'">{{ l.cohort }}</span>} @else {<span class="muted">—</span>}</td>
                <td class="small muted">{{ l.lastActiveAt ? (l.lastActiveAt | date: 'dd/MM/yyyy') : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class LearnersPage implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  labels = ROLE_LABELS;
  rows = signal<LearnerRow[]>([]);
  selected = signal<Set<number>>(new Set());
  res = signal<RandomizeResult | null>(null);
  error = signal('');
  groups = 'TRAITEMENT, CONTROLE';
  role = 'ENSEIGNANT';
  seed = 2027;
  onlyUnassigned = false;
  bulk = '';
  groupList = computed(() => this.groupsSig().split(',').map((g) => g.trim()).filter(Boolean));
  private groupsSig = signal(this.groups);

  async ngOnInit(): Promise<void> {
    try {
      this.rows.set(await firstValueFrom(this.http.get<LearnerRow[]>('/api/admin/learners')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  zones(r: RandomizeResult): string[] {
    return Object.keys(r.byRegionAndGroup);
  }

  async randomize(): Promise<void> {
    this.groupsSig.set(this.groups);
    try {
      this.res.set(await firstValueFrom(this.http.post<RandomizeResult>('/api/admin/learners/randomize', {
        groups: this.groupList(), role: this.role || null, countryCode: 'BJ', onlyUnassigned: this.onlyUnassigned, seed: this.seed,
      })));
      await this.ngOnInit();
      this.toast.show({ icon: 'shuffle', title: 'Tirage effectué', text: `graine ${this.seed} (reproductible)` });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  toggle(id: number): void {
    this.selected.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  toggleAll(ev: Event): void {
    this.selected.set((ev.target as HTMLInputElement).checked ? new Set(this.rows().map((r) => r.id)) : new Set());
  }

  async assign(): Promise<void> {
    try {
      await firstValueFrom(this.http.put('/api/admin/learners/cohort', { userIds: [...this.selected()], cohort: this.bulk === '__none' ? null : this.bulk }));
      this.selected.set(new Set());
      await this.ngOnInit();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
