import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EngagementApi } from '../core/engagement.service';
import { Badge, Engagement } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Serie de jours, objectif de la semaine, niveau et derniers badges : ce qui donne envie de revenir. */
@Component({
  selector: 'app-engagement-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    @let e = data();
    <section class="eng" aria-label="Ma progression">
      <div class="eng-card streak" [class.cold]="!e.activeToday">
        <div class="eng-flame"><app-icon name="flame" [size]="28" /></div>
        <div>
          <div class="eng-big">{{ e.streak }} <span>jour{{ e.streak > 1 ? 's' : '' }}</span></div>
          <div class="xs">{{ e.activeToday ? 'Série en cours, bravo !' : e.streak ? 'Apprenez aujourd\\'hui pour garder votre série' : 'Commencez une série aujourd\\'hui' }}</div>
          <div class="xs muted">Record : {{ e.bestStreak }} jour{{ e.bestStreak > 1 ? 's' : '' }}</div>
        </div>
      </div>

      <div class="eng-card goal">
        <div class="ring" [style.--p]="goalPct()" role="img" [attr.aria-label]="e.weekMinutes + ' minutes sur ' + e.weeklyGoalMinutes + ' cette semaine'">
          <span><strong>{{ e.weekMinutes }}</strong><small>/{{ e.weeklyGoalMinutes }} min</small></span>
        </div>
        <div style="flex:1;min-width:0">
          <strong class="small">Objectif de la semaine</strong>
          <div class="week-dots">
            @for (d of e.week; track d.date; let i = $index) {
              <span [class.on]="d.minutes > 0" [class.today]="d.date === today" [title]="d.minutes + ' min'">{{ days[i] }}</span>
            }
          </div>
          @if (editing()) {
            <div class="row goal-edit">
              <select [value]="'' + e.weeklyGoalMinutes" (change)="goal = +$any($event.target).value" aria-label="Objectif hebdomadaire">
                @for (g of goals; track g) { <option [value]="'' + g" [selected]="g === e.weeklyGoalMinutes">{{ g }} min / semaine</option> }
              </select>
              <button class="primary small-btn" (click)="saveGoal()">OK</button>
            </div>
          } @else {
            <button class="link xs" (click)="goal = e.weeklyGoalMinutes; editing.set(true)">Modifier l'objectif</button>
          }
        </div>
      </div>

      <div class="eng-card level">
        <div class="lvl-badge">{{ e.level }}</div>
        <div style="flex:1;min-width:0">
          <strong class="small">Niveau {{ e.level }}</strong> <span class="xs muted">· {{ e.xp }} points</span>
          <div class="progress" style="margin:.35rem 0"><div [style.width.%]="levelPct()"></div></div>
          <div class="xs muted">Encore {{ e.nextLevelXp - e.xp }} points pour le niveau {{ e.level + 1 }}</div>
        </div>
      </div>
    </section>

    <section class="badges-strip">
      <div class="section-head"><h2>Mes badges <span class="muted small">{{ earned().length }}/{{ e.badges.length }}</span></h2><a routerLink="/profil" fragment="badges" class="small">Tous les badges</a></div>
      <div class="badge-row">
        @for (b of shown(); track b.code) {
          <div class="badge" [class.off]="!b.earned" [title]="b.description">
            <span class="badge-ic"><app-icon [name]="b.icon" [size]="22" /></span>
            <strong class="xs">{{ b.label }}</strong>
            @if (!b.earned && b.target > 1) { <span class="xs muted">{{ b.progress }}/{{ b.target }}</span> }
          </div>
        }
      </div>
    </section>

    @if (!e.remindersEnabled && !reminderDismissed()) {
      <div class="notice reminder">
        <app-icon name="bell" [size]="20" />
        <div style="flex:1"><strong>Un petit rappel quand vous oubliez ?</strong><div class="small">Un e-mail après 3 jours sans leçon, au plus une fois par semaine. Désactivable à tout moment.</div></div>
        <button class="primary small-btn" (click)="enableReminders()">Activer</button>
        <button class="icon-btn ghost" (click)="dismiss()" aria-label="Plus tard"><app-icon name="x" [size]="18" /></button>
      </div>
    }
  `,
})
export class EngagementPanelComponent {
  readonly data = input.required<Engagement>();
  private api = inject(EngagementApi);
  private toast = inject(ToastService);

  protected days = DAYS;
  protected goals = [30, 60, 90, 120, 180, 300];
  protected goal = 60;
  protected editing = signal(false);
  protected reminderDismissed = signal(localStorage.getItem('formation.reminder-dismissed') === '1');
  protected today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  protected goalPct = computed(() => Math.min(100, Math.round((this.data().weekMinutes * 100) / Math.max(1, this.data().weeklyGoalMinutes))));
  protected levelPct = computed(() => {
    const e = this.data();
    return Math.round(((e.xp - e.levelStartXp) * 100) / Math.max(1, e.nextLevelXp - e.levelStartXp));
  });
  protected earned = computed(() => this.data().badges.filter((b) => b.earned));
  /** Les badges obtenus d'abord (les plus recents), puis les plus proches d'etre obtenus. */
  protected shown = computed<Badge[]>(() => {
    const b = this.data().badges;
    const got = b.filter((x) => x.earned).sort((x, y) => Date.parse(y.earnedAt ?? '') - Date.parse(x.earnedAt ?? ''));
    const next = b.filter((x) => !x.earned).sort((x, y) => y.progress / y.target - x.progress / x.target);
    return [...got, ...next].slice(0, 6);
  });

  async saveGoal(): Promise<void> {
    await this.api.saveGoals(this.goal, this.data().remindersEnabled).catch(() => undefined);
    this.editing.set(false);
  }

  async enableReminders(): Promise<void> {
    try {
      await this.api.saveGoals(this.data().weeklyGoalMinutes, true);
      this.toast.show({ icon: 'bell', title: 'Rappels activés', text: 'Désactivables depuis votre profil.' }, 2500);
    } catch {
      this.toast.show({ icon: 'wifi-off', title: 'Impossible pour le moment', text: 'Réessayez avec une connexion.' }, 2500);
    }
  }

  dismiss(): void {
    localStorage.setItem('formation.reminder-dismissed', '1');
    this.reminderDismissed.set(true);
  }
}
