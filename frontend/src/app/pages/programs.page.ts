import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { ProgramSummary, STATUS_LABELS, ordinal } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent } from '../shared/visuals';

/** Mes parcours : programmes du profil, classe suivie, progression ; rejoindre une classe par code. */
@Component({
  selector: 'app-programs',
  imports: [RouterLink, FormsModule, IconComponent, CoverComponent],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Mes parcours</h1>
      <a routerLink="/modules" class="small">Tous les modules</a>
    </div>
    @if (fromCache()) { <p class="notice"><app-icon name="wifi-off" /> Parcours enregistrés sur l'appareil.</p> }
    @if (error()) { <p class="error">{{ error() }}</p> }

    <div class="stack section">
      @for (p of programs(); track p.id) {
        <a class="card program-card" [routerLink]="['/parcours', p.id]">
          <app-cover class="program-cover" [icon]="p.icon" [seed]="p.id + 3" [height]="120" [label]="p.title" />
          <div class="program-body">
            <div class="tags">
              @if (p.classroom; as c) {
                <span class="tag" [class.sun]="c.status === 'ACTIVE'" [class.grey]="c.status !== 'ACTIVE'"><app-icon name="users" [size]="12" /> {{ c.name }}</span>
              } @else { <span class="tag grey">En autonomie</span> }
              @if (p.certificate) { <span class="tag violet"><app-icon name="trophy" [size]="12" /> Certifié·e</span> }
            </div>
            <h2 style="margin:.35rem 0 .2rem">{{ p.title }}</h2>
            <p class="small muted" style="margin:0">{{ p.durationLabel }}</p>
            <div class="row" style="margin-top:.6rem;flex-wrap:nowrap">
              <div class="progress" style="flex:1"><div [style.width.%]="p.percent"></div></div>
              <span class="small nowrap"><strong>{{ p.completedModules }}/{{ p.moduleCount }}</strong> modules</span>
            </div>
            @if (p.classroom; as c) {
              <div class="class-strip">
                <span><app-icon name="calendar" [size]="14" /> {{ statusLabel(c.status) }}@if (c.status === 'ACTIVE') { · semaine {{ c.week }}/{{ c.totalWeeks }}}</span>
                @if (c.myRank) { <span><app-icon name="award" [size]="14" /> {{ rank(c.myRank) }} sur {{ c.memberCount }}</span> }
              </div>
            }
          </div>
        </a>
      } @empty {
        @if (!loading()) { <div class="empty"><div class="empty-icon"><app-icon name="book-open" [size]="30" /></div>Aucun parcours pour votre profil pour le moment.</div> }
        @else { <div class="skeleton" style="height:220px"></div> }
      }
    </div>

    <section class="card section">
      <h2 class="row" style="gap:.4rem"><app-icon name="users" /> Rejoindre une classe</h2>
      <p class="small muted">Votre animateur·rice vous a donné un code ? Saisissez-le pour rejoindre votre promotion.</p>
      <form class="row" (ngSubmit)="join()">
        <input name="code" [(ngModel)]="code" placeholder="Code de classe (ex. NW72VH)" maxlength="12" style="flex:1;margin:0;text-transform:uppercase" />
        <button class="primary" type="submit" [disabled]="!code.trim() || !learning.online()">Rejoindre</button>
      </form>
    </section>
  `,
})
export class ProgramsPage implements OnInit {
  protected learning = inject(LearningService);
  private api = inject(ProgramApi);
  private toast = inject(ToastService);
  private router = inject(Router);

  programs = signal<ProgramSummary[]>([]);
  loading = signal(true);
  fromCache = signal(false);
  error = signal('');
  code = '';

  async ngOnInit(): Promise<void> {
    try {
      const r = await this.api.myPrograms();
      this.programs.set(r.data);
      this.fromCache.set(r.fromCache);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }

  rank(n: number): string {
    return ordinal(n);
  }

  async join(): Promise<void> {
    try {
      const c = await this.api.join(this.code.trim().toUpperCase());
      this.toast.show({ icon: 'users', title: 'Bienvenue dans la classe', text: c.name });
      await this.router.navigate(['/parcours', c.programId]);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
