import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../core/assistant.service';
import { AuthService } from '../core/auth.service';
import { TranslatePipe } from '../core/i18n';
import { LearningService } from '../core/learning.service';
import { ForumThread, Leaderboard, ProgramSummary, ResourceItem, SchoolDashboard, frDate, ordinal } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent, CoverComponent } from '../shared/visuals';

const WEEK_GOAL = 5;

/** Accueil adapte au profil : parcours et classe (tous), fiches (parents), suivi de l'ecole (directions). */
@Component({
  selector: 'app-home',
  imports: [RouterLink, IconComponent, DatePipe, TranslatePipe, CoverComponent, AvatarComponent],
  template: `
    <section class="hero">
      <span class="hero-emoji"><app-icon name="sprout" [size]="150" [stroke]="1.2" /></span>
      <p class="small" style="margin:0">{{ greeting() }}</p>
      <h1>{{ firstName() }}, prêt·e pour 10 minutes de formation ?</h1>
      @if (learning.lastLesson(); as last) {
        <p>Reprenez là où vous vous êtes arrêté·e : <strong style="color:#fff">{{ last.lessonTitle }}</strong></p>
        <a class="btn sun lg" [routerLink]="['/modules', last.courseId, 'reprendre']"><app-icon name="play" /> {{ 'action.continue' | t }}</a>
      } @else if (main()?.nextCourseId; as next) {
        <p>Votre parcours : <strong style="color:#fff">{{ main()!.title }}</strong></p>
        <a class="btn sun lg" [routerLink]="['/modules', next, 'reprendre']"><app-icon name="play" /> {{ 'action.start' | t }}</a>
      }
    </section>

    @if (!learning.online()) {
      <div class="notice section"><app-icon name="wifi-off" /> Vous êtes hors ligne. Les modules téléchargés restent disponibles ; votre progression sera envoyée au retour du réseau.</div>
    }

    @if (school(); as s) {
      <a class="card school-card section" routerLink="/mon-ecole">
        <div class="class-icon"><app-icon name="school" [size]="24" /></div>
        <div style="flex:1">
          <div class="xs muted" style="text-transform:uppercase;letter-spacing:.04em">Mon école</div>
          <strong>{{ s.school.name }}</strong>
          <div class="small muted">{{ s.staff }} enseignant·es · {{ s.active7d }} actifs cette semaine · progression moyenne {{ s.avgProgress }} %</div>
          @if (s.dropouts) { <div class="small" style="color:#8a2f1d;margin-top:.2rem"><app-icon name="alert" [size]="14" /> {{ s.dropouts }} collègue(s) décrochent</div> }
        </div>
        <app-icon name="arrow" />
      </a>
    }

    @if (main(); as p) {
      <section class="section">
        <div class="section-head"><h2>Mon parcours</h2><a routerLink="/parcours" class="small">Tous mes parcours</a></div>
        <a class="card program-card" [routerLink]="['/parcours', p.id]">
          <app-cover class="program-cover" [icon]="p.icon" [seed]="p.id + 3" [height]="96" [label]="p.title" />
          <div class="program-body">
            <strong>{{ p.title }}</strong>
            <div class="row" style="margin-top:.5rem;flex-wrap:nowrap">
              <div class="progress" style="flex:1"><div [style.width.%]="p.percent"></div></div>
              <span class="small nowrap"><strong>{{ p.completedModules }}/{{ p.moduleCount }}</strong> modules</span>
            </div>
            @if (p.classroom; as c) {
              <div class="class-strip">
                <span><app-icon name="users" [size]="14" /> {{ c.name }}</span>
                @if (c.status === 'ACTIVE') { <span><app-icon name="calendar" [size]="14" /> Semaine {{ c.week }}/{{ c.totalWeeks }}</span> }
                @if (c.status === 'UPCOMING') { <span><app-icon name="calendar" [size]="14" /> Début le {{ date(c.startDate) }}</span> }
              </div>
            }
          </div>
        </a>
      </section>
    }

    <section class="tiles section">
      <div class="tile">
        <span class="value row" style="gap:.35rem"><app-icon name="flame" [size]="26" style="color:var(--clay)" /> {{ learning.streak() }}</span>
        <span class="label">jour(s) d'affilée</span>
      </div>
      <div class="tile row" style="gap:.8rem">
        <div class="ring" [style.--p]="weekPct()"><span>{{ learning.weekCount() }}/{{ goal }}</span></div>
        <div><span class="label">Objectif de la semaine</span><div class="hint">{{ goal }} leçons en 7 jours</div></div>
      </div>
      @if (board()?.myRow; as me) {
        <a class="tile" [routerLink]="['/classes', board()!.classroom.id]" style="text-decoration:none;color:inherit">
          <span class="value">{{ rank(me.rank) }}</span>
          <span class="label">de ma classe · {{ me.points }} pts</span>
        </a>
      }
      <div class="tile">
        <span class="value">{{ learning.downloaded().size }}</span>
        <span class="label">module(s) hors ligne</span>
      </div>
    </section>

    @if (board(); as b) {
      @if (b.mode !== 'DISABLED' && b.rows.length) {
        <section class="card section">
          <div class="section-head"><h2 style="margin:0">Ma classe · en tête</h2><a [routerLink]="['/classes', b.classroom.id]" class="small">Classement complet</a></div>
          <div class="mini-board">
            @for (r of b.rows.slice(0, 3); track r.rank) {
              <div class="mini-row" [class.me-row]="r.me">
                <span class="mini-rank" [class]="'r' + r.rank">{{ r.rank }}</span>
                <app-avatar [name]="r.name" [size]="30" />
                <span style="flex:1">{{ r.name }}</span>
                <strong>{{ r.points }} pts</strong>
              </div>
            }
            @if (b.myRow && b.myRow.rank > 3) {
              <div class="mini-row me-row"><span class="mini-rank">{{ b.myRow.rank }}</span><app-avatar [name]="b.myRow.name" [size]="30" /><span style="flex:1">Vous</span><strong>{{ b.myRow.points }} pts</strong></div>
            }
          </div>
        </section>
      }
    }

    @if (live(); as t) {
      <section class="card live section">
        <div class="row">
          <span class="live-dot"></span><strong>Séance en direct</strong>
          <span class="muted small">{{ t.meetingAt | date: 'EEEE d MMMM, HH:mm' }}</span>
        </div>
        <h3>{{ t.title }}</h3>
        <div class="row">
          <a class="btn primary" [href]="t.meetingUrl" target="_blank" rel="noopener"><app-icon name="video" /> Rejoindre</a>
          <a class="btn" [routerLink]="['/communaute', t.id]">Voir la discussion</a>
        </div>
      </section>
    }

    @if (fiches().length) {
      <section class="section">
        <div class="section-head"><h2>Fiches pratiques</h2><a routerLink="/fiches" class="small">Toutes les fiches</a></div>
        <div class="grid cols-3">
          @for (r of fiches().slice(0, isParent() ? 4 : 3); track r.id) {
            <a class="card fiche-card" [routerLink]="['/fiches', r.id]">
              <span class="course-icon"><app-icon [name]="r.icon || 'file'" [size]="24" /></span>
              <div><strong>{{ r.title }}</strong><div class="small muted">{{ r.summary }}</div></div>
            </a>
          }
        </div>
      </section>
    }

    <section class="card section" style="background:var(--violet-50);border-color:transparent">
      <div class="row">
        <div class="avatar" style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--violet),#3b2f96)"><app-icon name="sparkles" /></div>
        <div class="grow" style="flex:1"><strong>Une question ?</strong><div class="small muted">Le mentor IA vous aide à choisir un module, comprendre une leçon ou préparer l'évaluation.</div></div>
        <button class="primary" (click)="assistant.open.set(true)">Demander</button>
      </div>
    </section>
  `,
})
export class HomePage implements OnInit {
  protected learning = inject(LearningService);
  protected assistant = inject(AssistantService);
  private auth = inject(AuthService);
  private api = inject(ProgramApi);
  private http = inject(HttpClient);

  goal = WEEK_GOAL;
  programs = signal<ProgramSummary[]>([]);
  board = signal<Leaderboard | null>(null);
  fiches = signal<ResourceItem[]>([]);
  school = signal<SchoolDashboard | null>(null);
  threads = signal<ForumThread[]>([]);

  firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);
  isParent = computed(() => this.auth.user()?.role === 'PARENT');
  /** Parcours principal : celui de la classe en cours, sinon le premier non termine. */
  main = computed(() => this.programs().find((p) => p.classroom && p.classroom.status !== 'CLOSED') ?? this.programs().find((p) => p.percent < 100) ?? this.programs()[0] ?? null);
  weekPct = computed(() => Math.min(100, Math.round((this.learning.weekCount() * 100) / WEEK_GOAL)));
  live = computed(() => this.threads().find((t) => t.meetingUrl && t.meetingAt && Date.parse(t.meetingAt) > Date.now() - 3600_000) ?? null);

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  }

  async ngOnInit(): Promise<void> {
    void this.api.myPrograms().then(async (r) => {
      this.programs.set(r.data);
      const c = this.main()?.classroom;
      if (c) this.board.set((await this.api.leaderboard(c.id).catch(() => null))?.data ?? null);
    }).catch(() => undefined);
    void this.api.resources().then((r) => this.fiches.set(r.data)).catch(() => undefined);
    if (this.auth.user()?.role === 'DIRECTION_ECOLE') void this.api.school().then((s) => this.school.set(s)).catch(() => undefined);
    void firstValueFrom(this.http.get<ForumThread[]>('/api/community/threads')).then((t) => this.threads.set(t)).catch(() => undefined);
  }

  date(d: string): string {
    return frDate(d);
  }

  rank(n: number): string {
    return ordinal(n);
  }
}
