import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { Leaderboard, STATUS_LABELS, frDate, ordinal } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/visuals';

/** Une classe : calendrier, animateur·rice, visio, podium et classement (public, anonyme ou desactive). */
@Component({
  selector: 'app-classroom',
  imports: [RouterLink, IconComponent, AvatarComponent],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (lb(); as lb) {
      @let c = lb.classroom;
      <a [routerLink]="backLink()" class="back"><app-icon name="back" [size]="18" /> {{ auth.isStaff() ? 'Classes' : c.programTitle }}</a>
      <section class="hero" style="padding-bottom:1.2rem">
        <span class="hero-emoji"><app-icon name="users" [size]="150" [stroke]="1.2" /></span>
        <div class="tags"><span class="tag sun">{{ statusLabel(c.status) }}</span>
          @if (c.inviteCode) { <span class="tag" style="background:rgba(255,255,255,.18);color:#fff">Code : {{ c.inviteCode }}</span> }</div>
        <h1>{{ c.name }}</h1>
        <p>{{ c.programTitle }} · {{ date(c.startDate) }} → {{ date(c.endDate) }} · {{ c.memberCount }} participant·es @if (c.facilitatorName) {· animée par {{ c.facilitatorName }}}</p>
        @if (c.status === 'ACTIVE') {
          <div class="weeks light">@for (w of weeks(c.totalWeeks); track w) {<span [class.on]="w <= c.week"></span>}</div>
          <p class="small" style="margin-top:.4rem">Semaine {{ c.week }} sur {{ c.totalWeeks }}</p>
        }
        <div class="row" style="margin-top:.6rem">
          <a class="btn sun" [routerLink]="['/parcours', c.programId]"><app-icon name="book-open" /> Le parcours</a>
          @if (c.meetingUrl && c.status !== 'CLOSED') { <a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" [href]="c.meetingUrl" target="_blank" rel="noopener"><app-icon name="video" /> Visio de la classe</a> }
        </div>
      </section>

      @if (lb.mode === 'DISABLED') {
        <section class="card section center">
          <div class="empty-icon"><app-icon name="target" [size]="30" /></div>
          <h2>Pas de classement dans cette classe</h2>
          <p class="muted small">Chacun avance à son rythme. @if (lb.myRow) {Vous avez {{ lb.myRow.points }} points.}</p>
        </section>
      } @else {
        @if (podium().length) {
          <section class="section">
            <h2 class="row" style="gap:.4rem"><app-icon name="trophy" /> {{ c.status === 'CLOSED' ? 'Podium final' : 'En tête' }}</h2>
            <div class="podium">
              @for (r of podium(); track r.rank) {
                <div class="podium-step" [class]="'p' + r.rank" [class.me]="r.me">
                  <app-avatar [name]="r.name" [size]="r.rank === 1 ? 64 : 52" />
                  <strong class="podium-name">{{ r.name }}</strong>
                  <span class="small">{{ r.points }} pts</span>
                  <div class="podium-block"><span>{{ r.rank }}</span></div>
                </div>
              }
            </div>
            @if (c.status === 'CLOSED') { <p class="xs muted center">Les lauréat·es ayant terminé le parcours reçoivent un certificat avec mention.</p> }
          </section>
        }

        @if (lb.myRow; as me) {
          <section class="card my-rank section">
            <div class="rank-pill big"><strong>{{ rank(me.rank) }}</strong><span>sur {{ c.memberCount }}</span></div>
            <div style="flex:1">
              <strong>{{ me.points }} points</strong>
              <div class="small muted">{{ me.lessons }} leçons · {{ me.quizPoints }} pts de quiz · {{ me.portfolios }} portfolio(s) validé(s) · {{ me.posts }} message(s)</div>
              @if (gapToNext(); as g) { <div class="small" style="margin-top:.3rem"><app-icon name="target" [size]="14" /> Plus que <strong>{{ g }} points</strong> pour gagner une place</div> }
            </div>
          </section>
        }

        <section class="card section">
          <h2>Classement @if (lb.mode === 'ANONYMOUS') {<span class="tag grey">anonyme</span>}</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Participant·e</th><th class="num opt">Leçons</th><th class="num opt">Quiz</th><th class="num opt">Portfolio</th><th class="num">Points</th></tr></thead>
              <tbody>
                @for (r of lb.rows; track r.rank + r.name) {
                  <tr [class.me-row]="r.me">
                    <td><strong>{{ r.rank }}</strong></td>
                    <td><div class="row" style="flex-wrap:nowrap;gap:.5rem"><app-avatar [name]="r.name" [size]="28" /> {{ r.name }} @if (r.completed) {<app-icon name="badge-check" [size]="16" style="color:var(--brand)" />}</div></td>
                    <td class="num opt">{{ r.lessons }}</td><td class="num opt">{{ r.quizPoints }}</td><td class="num opt">{{ r.portfolios }}</td>
                    <td class="num"><strong>{{ r.points }}</strong></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="xs muted">Points : leçon terminée, meilleur score à chaque évaluation, portfolio validé, messages dans la communauté. Barème fixé par l'animateur·rice.</p>
        </section>
      }
    } @else if (!error()) {
      <div class="skeleton" style="height:320px"></div>
    }
  `,
})
export class ClassroomPage implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(ProgramApi);
  readonly id = input.required<string>();
  lb = signal<Leaderboard | null>(null);
  error = signal('');

  /** Ordre visuel du podium : 2e, 1er, 3e. */
  podium = computed(() => {
    const top = (this.lb()?.rows ?? []).filter((r) => r.rank <= 3);
    return [top.find((r) => r.rank === 2), top.find((r) => r.rank === 1), top.find((r) => r.rank === 3)].filter((r) => !!r);
  });
  gapToNext = computed(() => {
    const lb = this.lb();
    const me = lb?.myRow;
    if (!lb || !me || me.rank <= 1) return null;
    const above = lb.rows.find((r) => r.rank === me.rank - 1);
    return above ? Math.max(1, above.points - me.points + 1) : null;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.lb.set((await this.api.leaderboard(Number(this.id()))).data);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  backLink(): unknown[] {
    return this.auth.isStaff() ? ['/admin/classes'] : ['/parcours', this.lb()?.classroom.programId];
  }

  weeks(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  date(d: string): string {
    return frDate(d);
  }

  rank(n: number): string {
    return ordinal(n);
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }
}
