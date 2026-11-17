import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../core/assistant.service';
import { AuthService } from '../core/auth.service';
import { TranslatePipe } from '../core/i18n';
import { LearningService } from '../core/learning.service';
import { CourseSummary, ForumThread, LEVELS, formatBytes } from '../core/models';
import { IconComponent } from '../shared/icon.component';

const WEEK_GOAL = 5;

@Component({
  selector: 'app-home',
  imports: [RouterLink, IconComponent, DatePipe, TranslatePipe],
  template: `
    <section class="hero">
      <span class="hero-emoji">🌱</span>
      <p class="small" style="margin:0">{{ greeting() }}</p>
      <h1>{{ firstName() }}, prêt·e pour 10 minutes de formation ?</h1>
      @if (learning.lastLesson(); as last) {
        <p>Reprenez là où vous vous êtes arrêté·e : <strong style="color:#fff">{{ last.lessonTitle }}</strong></p>
        <a class="btn sun lg" [routerLink]="['/modules', last.courseId, 'lecon', last.lessonId]">
          <app-icon name="play" /> {{ 'action.continue' | t }}
        </a>
      } @else if (next(); as n) {
        <p>Nous vous conseillons : <strong style="color:#fff">{{ n.title }}</strong></p>
        <a class="btn sun lg" [routerLink]="['/modules', n.id]"><app-icon name="play" /> {{ 'action.start' | t }}</a>
      }
    </section>

    <section class="tiles section">
      <div class="tile">
        <span class="value">🔥 {{ learning.streak() }}</span>
        <span class="label">jour(s) d'affilée</span>
      </div>
      <div class="tile row" style="gap:.8rem">
        <div class="ring" [style.--p]="weekPct()"><span>{{ learning.weekCount() }}/{{ goal }}</span></div>
        <div><span class="label">Objectif de la semaine</span><div class="hint">{{ goal }} leçons en 7 jours</div></div>
      </div>
      <div class="tile">
        <span class="value">{{ certCount() }}</span>
        <span class="label">certification(s)</span>
      </div>
      <div class="tile">
        <span class="value">{{ learning.downloaded().size }}</span>
        <span class="label">module(s) hors ligne</span>
        @if (storage()) { <div class="hint">{{ storage() }} utilisés</div> }
      </div>
    </section>

    @if (!learning.online()) {
      <div class="notice"><app-icon name="wifi-off" /> Vous êtes hors ligne. Les modules téléchargés restent disponibles ; votre progression sera envoyée au retour du réseau.</div>
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

    <section class="section">
      <div class="section-head">
        <h2>{{ recommended().length ? 'Recommandé pour vous' : 'Vos modules' }}</h2>
        <a routerLink="/modules" class="small">Tout voir</a>
      </div>
      <div class="grid cols-3">
        @for (c of (recommended().length ? recommended() : courses()).slice(0, 3); track c.id) {
          <a class="card course-card" [routerLink]="['/modules', c.id]" style="text-decoration:none;color:inherit">
            <div class="row"><span class="course-icon">{{ c.icon || '📘' }}</span>
              <div class="grow"><h3 style="margin:0">{{ c.title }}</h3><div class="xs muted">{{ c.lessonCount }} leçons · {{ c.totalMinutes }} min @if (c.mediaBytes) {· {{ size(c.mediaBytes) }}}</div></div>
            </div>
            <div class="progress"><div [style.width.%]="pct(c)"></div></div>
            <div class="tags">
              @for (l of c.levels; track l) { <span class="tag sun">{{ medal(l) }}</span> }
              @if (learning.downloaded().has(c.id)) { <span class="tag"><app-icon name="check" [size]="12" /> hors ligne</span> }
            </div>
          </a>
        } @empty {
          <div class="skeleton"></div>
        }
      </div>
    </section>

    <section class="card section" style="background:var(--violet-50);border-color:transparent">
      <div class="row">
        <div class="avatar" style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--violet),#3b2f96)"><app-icon name="sparkles" /></div>
        <div class="grow"><strong>Une question ?</strong><div class="small muted">Le mentor IA vous aide à choisir un module, comprendre une leçon ou préparer l'évaluation.</div></div>
        <button class="primary" (click)="assistant.open.set(true)">Demander</button>
      </div>
    </section>
  `,
})
export class HomePage implements OnInit {
  protected learning = inject(LearningService);
  protected assistant = inject(AssistantService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  goal = WEEK_GOAL;
  courses = signal<CourseSummary[]>([]);
  threads = signal<ForumThread[]>([]);
  storage = signal('');

  firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);
  recommended = computed(() => this.courses().filter((c) => c.recommended));
  next = computed(() => this.recommended()[0] ?? this.courses().find((c) => c.completedLessons < c.lessonCount) ?? null);
  certCount = computed(() => this.courses().reduce((s, c) => s + c.levels.length, 0));
  weekPct = computed(() => Math.min(100, Math.round((this.learning.weekCount() * 100) / WEEK_GOAL)));
  live = computed(() => this.threads().find((t) => t.meetingUrl && t.meetingAt && Date.parse(t.meetingAt) > Date.now() - 3600_000) ?? null);

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  }

  async ngOnInit(): Promise<void> {
    try {
      this.courses.set((await this.learning.courses()).list);
    } catch {
      /* hors ligne sans cache */
    }
    try {
      this.threads.set(await firstValueFrom(this.http.get<ForumThread[]>('/api/community/threads')));
    } catch {
      /* hors ligne */
    }
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      this.storage.set(formatBytes(e.usage ?? 0));
    }
  }

  pct(c: CourseSummary): number {
    const done = Math.max(c.completedLessons, this.learning.localDoneCount(c.id));
    return c.lessonCount ? Math.round((done * 100) / c.lessonCount) : 0;
  }

  size(b: number): string {
    return formatBytes(b);
  }

  medal(l: string): string {
    const x = LEVELS.find((v) => v.key === l);
    return x ? `${x.icon} ${x.short}` : l;
  }
}
