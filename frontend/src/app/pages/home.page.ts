import { LiveJoinComponent } from '../shared/live-join.component';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../core/assistant.service';
import { AuthService } from '../core/auth.service';
import { CatalogApi } from '../core/catalog.service';
import { LearningService } from '../core/learning.service';
import { ForumThread, MyCourse, MyProgram, ResourceItem, SchoolDashboard, courseStatus, durationLabel, ordinal } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent } from '../shared/visuals';
import { EngagementApi } from '../core/engagement.service';
import { Catalog } from '../core/models';
import { CourseCardComponent } from '../shared/course-card.component';
import { EngagementPanelComponent } from '../shared/engagement-panel.component';

/**
 * "Mes formations" : une seule question a l'ecran, "qu'est-ce que je fais maintenant ?".
 * Le cours a reprendre en grand, puis mes formations et mes cours avec leur avancement.
 */
@Component({
  selector: 'app-home',
  imports: [LiveJoinComponent, RouterLink, IconComponent, DatePipe, CoverComponent, CourseCardComponent, EngagementPanelComponent],
  template: `
    <p class="muted" style="margin:0">{{ greeting() }} {{ firstName() }}</p>
    <h1 style="margin-top:.2rem">Mes formations</h1>

    @if (!learning.online()) {
      <div class="notice"><app-icon name="wifi-off" /> Hors connexion : vos cours téléchargés restent disponibles, votre progression sera envoyée au retour du réseau.</div>
    }

    @if (loaded() && !hasAny()) {
      <section class="card empty-start">
        <div class="empty-icon" style="width:84px;height:84px"><app-icon name="compass" [size]="42" /></div>
        <h2>Bienvenue ! Choisissez votre première formation</h2>
        <p class="muted">Parcourez le catalogue, inscrivez-vous, puis suivez les leçons une à une. Un quiz valide chaque notion, l'évaluation finale vous donne votre certificat.</p>
        <div class="row" style="justify-content:center">
          <a class="btn primary lg" routerLink="/catalogue"><app-icon name="search" /> Parcourir le catalogue</a>
          <a class="btn lg" routerLink="/bienvenue"><app-icon name="compass" /> Faire le test d'orientation</a>
        </div>
      </section>
    }

    @if (eng.engagement(); as e) { @if (hasAny()) { <app-engagement-panel [data]="e" /> } }

    @if (resume(); as r) {
      @let st = status(r);
      <a class="card resume-card" [routerLink]="['/apprendre', r.courseId]">
        <app-cover class="resume-cover" [icon]="r.icon" [seed]="r.courseId" [height]="120" [label]="r.title" />
        <div class="resume-body">
          <span class="xs muted" style="text-transform:uppercase;letter-spacing:.05em">{{ st.key === 'TODO' ? 'À commencer' : 'Reprendre' }}</span>
          <h2 style="margin:.2rem 0">{{ r.title }}</h2>
          @if (r.programTitle) { <div class="small muted">{{ r.programTitle }}</div> }
          <div class="row" style="flex-wrap:nowrap;margin:.6rem 0">
            <div class="progress" style="flex:1"><div [style.width.%]="st.percent"></div></div>
            <span class="small nowrap"><strong>{{ st.percent }} %</strong></span>
          </div>
          <div class="row" style="justify-content:space-between">
            <span class="small"><app-icon name="play" [size]="14" /> Prochaine étape : <strong>{{ st.next }}</strong></span>
            <span class="btn primary">{{ st.key === 'TODO' ? 'Commencer' : 'Continuer' }} <app-icon name="arrow" /></span>
          </div>
        </div>
      </a>
    }

    @if (school(); as s) {
      <a class="card school-card section" routerLink="/mon-ecole">
        <div class="class-icon"><app-icon name="school" [size]="24" /></div>
        <div style="flex:1">
          <div class="xs muted" style="text-transform:uppercase;letter-spacing:.04em">Mon école</div>
          <strong>{{ s.school.name }}</strong>
          <div class="small muted">{{ s.staff }} enseignant·es · {{ s.active7d }} actifs cette semaine · progression moyenne {{ s.avgProgress }} %</div>
        </div>
        <app-icon name="arrow" />
      </a>
    }

    @if (programs().length) {
      <section class="section">
        <h2>Mes formations certifiantes</h2>
        <div class="stack">
          @for (p of programs(); track p.programId) {
            <a class="card program-card" [routerLink]="['/formations', p.programId]">
              <app-cover class="program-cover" [icon]="p.icon" [seed]="p.programId + 3" [height]="96" [label]="p.title" />
              <div class="program-body">
                <strong>{{ p.title }}</strong>
                <div class="row" style="margin-top:.5rem;flex-wrap:nowrap">
                  <div class="progress" style="flex:1"><div [style.width.%]="p.percent"></div></div>
                  <span class="small nowrap"><strong>{{ p.doneCourses }}/{{ p.courseIds.length }}</strong> cours validés</span>
                </div>
                @if (p.certificate) { <div class="small" style="color:var(--brand);margin-top:.3rem"><app-icon name="award" [size]="14" /> Certificat de formation obtenu</div> }
                @if (p.classroom; as c) {
                  <div class="class-strip">
                    <span><app-icon name="users" [size]="14" /> {{ c.name }}</span>
                    @if (c.status === 'ACTIVE') { <span><app-icon name="calendar" [size]="14" /> Semaine {{ c.week }}/{{ c.totalWeeks }}</span> }
                    @if (c.myRank) { <span><app-icon name="trophy" [size]="14" /> {{ rank(c.myRank) }} · {{ c.myPoints }} pts</span> }
                  </div>
                }
              </div>
            </a>
          }
        </div>
      </section>
    }

    @if (courses().length) {
      <section class="section">
        <h2>Mes cours</h2>
        <div class="stack">
          @for (c of courses(); track c.courseId) {
            @let st = status(c);
            <a class="card my-course" [class.is-locked]="st.key === 'LOCKED'" [routerLink]="st.key === 'LOCKED' ? ['/cours', c.courseId] : ['/apprendre', c.courseId]">
              <span class="course-icon"><app-icon [name]="c.icon || 'book-open'" [size]="22" /></span>
              <div style="flex:1;min-width:0">
                <strong>{{ c.title }}</strong>
                <div class="xs muted">{{ c.programTitle ? c.programTitle + ' · ' : '' }}{{ c.lessonCount }} leçons · {{ dur(c.totalMinutes) }}</div>
                @if (st.key !== 'TODO') { <div class="progress" style="margin-top:.4rem"><div [style.width.%]="st.percent"></div></div> }
                <div class="xs" style="margin-top:.25rem" [class.muted]="st.key !== 'LOCKED'">
                  @if (st.key === 'LOCKED') { <app-icon name="lock" [size]="12" /> }
                  {{ st.next }}
                </div>
              </div>
              <span class="tag" [class.grey]="st.key === 'TODO' || st.key === 'LOCKED'" [class.sun]="st.key === 'EXAM'">{{ st.label }}</span>
            </a>
          }
        </div>
        <a class="btn section" routerLink="/catalogue"><app-icon name="plus" /> M'inscrire à un autre cours</a>
      </section>
    }

    @if (recommended().length) {
      <section class="section">
        <div class="section-head"><h2>Recommandé pour vous</h2><a routerLink="/catalogue" class="small">Tout le catalogue</a></div>
        <div class="card-grid">@for (c of recommended(); track c.id) { <app-course-card [item]="c" [forMe]="true" /> }</div>
      </section>
    }

    @if (live(); as t) {
      <section class="card live section">
        <div class="row"><span class="live-dot"></span><strong>Séance en direct</strong><span class="muted small">{{ t.meetingAt | date: 'EEEE d MMMM, HH:mm' }}</span></div>
        <h3>{{ t.title }}</h3>
        <div class="row">
          <app-live-join [url]="t.meetingUrl!" [title]="t.title" />
          <a class="btn" [routerLink]="['/communaute', t.id]">Voir la discussion</a>
        </div>
      </section>
    }

    @if (fiches().length) {
      <section class="section">
        <div class="section-head"><h2>Fiches pratiques</h2><a routerLink="/fiches" class="small">Toutes les fiches</a></div>
        <div class="grid cols-3">
          @for (r of fiches().slice(0, 3); track r.id) {
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
        <div style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--violet),#3b2f96)"><app-icon name="sparkles" /></div>
        <div style="flex:1"><strong>Une question ?</strong><div class="small muted">Le mentor IA vous aide à choisir un cours, comprendre une leçon ou préparer l'évaluation.</div></div>
        <button class="primary" (click)="assistant.open.set(true)">Demander</button>
      </div>
    </section>
  `,
})
export class HomePage implements OnInit {
  protected learning = inject(LearningService);
  protected assistant = inject(AssistantService);
  private auth = inject(AuthService);
  private catalog = inject(CatalogApi);
  private api = inject(ProgramApi);
  private http = inject(HttpClient);

  loaded = signal(false);
  fiches = signal<ResourceItem[]>([]);
  school = signal<SchoolDashboard | null>(null);
  threads = signal<ForumThread[]>([]);
  protected eng = inject(EngagementApi);
  private cat = signal<Catalog | null>(null);

  /** Cours pour mon public, pas encore suivis, les mieux notes et les plus suivis d'abord. */
  recommended = computed(() => {
    const c = this.cat();
    if (!c) return [];
    const u = this.auth.user();
    const me = u?.audience || u?.role || '';
    const mine = new Set((this.catalog.mine()?.courses ?? []).map((x) => x.courseId));
    return c.courses.filter((x) => !mine.has(x.id) && (!x.targetRoles.length || x.targetRoles.includes(me)))
      .sort((a, b) => b.rating * 10 + b.learners / 10 - (a.rating * 10 + a.learners / 10)).slice(0, 3);
  });

  programs = computed<MyProgram[]>(() => this.catalog.mine()?.programs ?? []);
  courses = computed<MyCourse[]>(() => {
    const order = { IN_PROGRESS: 0, EXAM: 0, TODO: 1, LOCKED: 2, DONE: 3 };
    return [...(this.catalog.mine()?.courses ?? [])].sort((a, b) => order[courseStatus(a).key] - order[courseStatus(b).key]);
  });
  hasAny = computed(() => this.courses().length > 0);

  /** Le cours a reprendre : le dernier ouvert s'il n'est pas fini, sinon le premier en cours, sinon le premier a commencer. */
  resume = computed(() => {
    const open = this.courses().filter((c) => !['DONE', 'LOCKED'].includes(courseStatus(c).key));
    const last = this.learning.lastLesson();
    return open.find((c) => c.courseId === last?.courseId) ?? open.find((c) => courseStatus(c).key !== 'TODO') ?? open[0] ?? null;
  });

  firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);
  live = computed(() => this.threads().find((t) => t.meetingUrl && t.meetingAt && Date.parse(t.meetingAt) > Date.now() - 3600_000) ?? null);

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  }

  async ngOnInit(): Promise<void> {
    void this.catalog.myLearning().catch(() => undefined).finally(() => this.loaded.set(true));
    void this.api.resources().then((r) => this.fiches.set(r.data)).catch(() => undefined);
    void this.eng.load();
    void this.catalog.catalog().then((r) => this.cat.set(r.data)).catch(() => undefined);
    if (this.auth.user()?.role === 'DIRECTION_ECOLE') void this.api.school().then((s) => this.school.set(s)).catch(() => undefined);
    void firstValueFrom(this.http.get<ForumThread[]>('/api/community/threads')).then((t) => this.threads.set(t)).catch(() => undefined);
  }

  status = courseStatus;
  dur = durationLabel;
  rank = ordinal;
}
