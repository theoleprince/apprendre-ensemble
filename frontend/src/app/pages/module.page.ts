import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../core/assistant.service';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { MediaCacheService } from '../core/media-cache.service';
import { Certificate, CoursePackage, Feedback, ForumThread, LEVELS, Portfolio, formatBytes } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { MedalComponent } from '../shared/visuals';

type Tab = 'lecons' | 'certif' | 'portfolio' | 'discussion' | 'avis';

@Component({
  selector: 'app-module',
  imports: [RouterLink, FormsModule, IconComponent, MedalComponent],
  template: `
    <a routerLink="/modules" class="back"><app-icon name="back" [size]="18" /> Modules</a>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (pkg(); as p) {
      <section class="hero" style="padding-bottom:1.1rem">
        <span class="hero-emoji"><app-icon [name]="p.icon || 'book-open'" [size]="150" [stroke]="1.2" /></span>
        <div class="tags"><span class="tag sun">{{ p.type === 'PRATIQUE' ? 'Parcours pratique' : 'Parcours théorique' }}</span>
          @if (fromCache()) { <span class="tag" style="background:rgba(255,255,255,.2);color:#fff"><app-icon name="wifi-off" [size]="12" /> hors ligne</span> }</div>
        <h1>{{ p.title }}</h1>
        <p>{{ p.description }}</p>
        <div class="row">
          <div class="progress grow" style="background:rgba(255,255,255,.25);max-width:320px"><div [style.width.%]="pct()" style="background:var(--sun)"></div></div>
          <span class="small">{{ doneCount() }}/{{ p.lessons.length }} leçons</span>
        </div>
        <div class="row" style="margin-top:.8rem">
          @if (nextLesson(); as n) {
            <a class="btn sun" [routerLink]="['/modules', p.id, 'lecon', n.id]"><app-icon name="play" /> {{ doneCount() ? 'Continuer' : 'Commencer' }}</a>
          } @else if (p.questions.length) {
            <a class="btn sun" [routerLink]="['/modules', p.id, 'evaluation']"><app-icon name="target" /> Passer l'évaluation</a>
          }
          @if (!learning.downloaded().has(p.id) || missingMedia()) {
            <button class="ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" (click)="download()" [disabled]="dl() !== null || !learning.online()">
              <app-icon name="download" /> {{ dl() !== null ? Math.round(dl()! * 100) + ' %' : 'Télécharger (' + size() + ')' }}
            </button>
          }
        </div>
      </section>

      <nav class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" [class.active]="tab() === t.key" (click)="openTab(t.key)">{{ t.label }}</button>
        }
      </nav>

      @switch (tab()) {
        @case ('lecons') {
          <ol class="lesson-list">
            @for (l of p.lessons; track l.id) {
              <li>
                <a class="lesson-item" [class.done]="learning.isDone(l.id)" [routerLink]="['/modules', p.id, 'lecon', l.id]">
                  <span class="lesson-num">@if (learning.isDone(l.id)) {<app-icon name="check" [size]="18" />} @else {{{ l.position }}}</span>
                  <span class="grow"><span class="title">{{ l.title }}</span><br />
                    <span class="xs muted">{{ typeLabel(l.mediaType) }} · {{ l.durationMinutes }} min @if (l.practiceTask) {· mise en pratique}</span></span>
                  <app-icon [name]="typeIcon(l.mediaType)" />
                </a>
              </li>
            }
            @if (p.questions.length) {
              <li>
                <a class="lesson-item" [routerLink]="['/modules', p.id, 'evaluation']">
                  <span class="lesson-num" style="background:var(--sun-50);color:#6b5300"><app-icon name="target" [size]="18" /></span>
                  <span class="grow"><span class="title">Évaluation finale</span><br /><span class="xs muted">{{ p.questions.length }} questions · badge à {{ p.passScore }} %, maîtrise à {{ p.masteryScore }} %</span></span>
                  <app-icon name="arrow" />
                </a>
              </li>
            }
          </ol>
        }
        @case ('certif') {
          <p class="muted">Chaque niveau s'obtient automatiquement. Les critères sont fixés par l'équipe pédagogique.</p>
          <div class="levels">
            @for (lv of levels; track lv.key) {
              @if (lv.key !== 'EXPERTISE' || p.expertiseEnabled) {
                <div class="level" [class.got]="hasLevel(lv.key)">
                  <app-medal [level]="lv.key" [earned]="hasLevel(lv.key)" [size]="48" />
                  <div class="name">{{ lv.short }}</div>
                  <div class="rule">{{ ruleFor(lv.key) }}</div>
                </div>
              }
            }
          </div>
          <p class="section"><a routerLink="/certificats">Voir mes certificats →</a></p>
        }
        @case ('portfolio') {
          <div class="card flat">
            <h3>Déposer une preuve de pratique</h3>
            <p class="small muted">Décrivez ce que vous avez fait en classe. Ajoutez une courte vidéo si possible (sans visage d'enfant reconnaissable). Un mentor vous répondra.</p>
            <label>Leçon concernée
              <select [(ngModel)]="pfLesson" name="pfl">
                <option [ngValue]="null">Module entier</option>
                @for (l of p.lessons; track l.id) { <option [ngValue]="l.id">{{ l.position }}. {{ l.title }}</option> }
              </select>
            </label>
            <label>Ce que j'ai fait et observé <textarea rows="4" [(ngModel)]="pfText" name="pft" maxlength="4000"></textarea></label>
            <label>Vidéo de pratique (facultatif)
              <input type="file" accept="video/*" capture="environment" (change)="pickVideo($event)" [disabled]="!learning.online()" />
            </label>
            @if (!learning.online()) { <p class="notice small">Hors ligne : le texte sera envoyé plus tard. La vidéo nécessite une connexion.</p> }
            <button class="primary" (click)="sendPortfolio()" [disabled]="(!pfText.trim() && !pfFile) || sending()">
              <app-icon name="upload" /> {{ sending() ? 'Envoi…' : 'Envoyer au mentor' }}
            </button>
          </div>
          <div class="section stack">
            @for (it of portfolio(); track it.id) {
              <div class="card flat">
                <div class="row"><strong class="grow">{{ it.lessonTitle || 'Module' }}</strong>
                  <span class="tag" [class.sun]="it.status === 'SOUMIS'" [class.clay]="it.status === 'A_REVOIR'">{{ statusLabel(it.status) }}</span></div>
                <p class="small">{{ it.text }}</p>
                @if (it.mediaUrl) { <video [src]="it.mediaUrl" controls preload="none" style="max-height:220px;border-radius:12px"></video> }
                @if (it.mentorFeedback) { <div class="notice info small"><strong>{{ it.mentorName }} :</strong>&nbsp;{{ it.mentorFeedback }}</div> }
              </div>
            }
          </div>
        }
        @case ('discussion') {
          <div class="stack">
            @for (t of threads(); track t.id) {
              <a class="card flat thread" [routerLink]="['/communaute', t.id]">
                <span class="avatar-sm"><app-icon name="chat" [size]="18" /></span>
                <span class="grow"><strong>{{ t.title }}</strong><br /><span class="xs muted">{{ t.authorName }} · {{ t.replies }} réponse(s)</span></span>
                @if (t.meetingUrl) { <span class="tag sun"><app-icon name="video" [size]="12" /> Live</span> }
              </a>
            } @empty { <div class="empty">Pas encore de discussion. <a routerLink="/communaute">Lancer la première</a></div> }
          </div>
        }
        @case ('avis') {
          <div class="card flat">
            <h3>Votre avis améliore le module</h3>
            <p class="small muted">Les réponses sont analysées (avec l'IA) pour produire de nouvelles versions plus claires.</p>
            @for (q of feedbackQuestions; track q.key) {
              <div style="margin:.6rem 0"><div class="small" style="font-weight:600">{{ q.label }}</div>
                <div class="stars">@for (n of [1,2,3,4,5]; track n) {
                  <button [class.on]="fb[q.key] >= n" (click)="fb[q.key] = n" [attr.aria-label]="n + ' sur 5'"><app-icon name="star" [size]="28" /></button>
                }</div>
              </div>
            }
            <label>Un commentaire ? <textarea rows="3" [(ngModel)]="fb.comment" name="fbc" maxlength="2000"></textarea></label>
            <button class="primary" (click)="sendFeedback()" [disabled]="!fb.rating || !learning.online()">Envoyer mon avis</button>
          </div>
        }
      }
    } @else if (!error()) {
      <div class="skeleton" style="height:220px"></div>
    }
  `,
})
export class ModulePage implements OnInit {
  protected learning = inject(LearningService);
  private assistant = inject(AssistantService);
  private http = inject(HttpClient);
  private media = inject(MediaCacheService);
  private toast = inject(ToastService);
  protected Math = Math;

  readonly id = input.required<string>();
  readonly v = input<string>();
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  tabs: { key: Tab; label: string }[] = [
    { key: 'lecons', label: 'Leçons' },
    { key: 'certif', label: 'Certification' },
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'avis', label: 'Avis' },
  ];
  levels = LEVELS;
  feedbackQuestions = [
    { key: 'rating' as const, label: 'Satisfaction globale' },
    { key: 'clarity' as const, label: 'Clarté des explications' },
    { key: 'usefulness' as const, label: 'Utilité pour ma pratique' },
  ];

  tab = signal<Tab>('lecons');
  pkg = signal<CoursePackage | null>(null);
  fromCache = signal(false);
  error = signal('');
  dl = signal<number | null>(null);
  certs = signal<Certificate[]>([]);
  portfolio = signal<Portfolio[]>([]);
  threads = signal<ForumThread[]>([]);
  sending = signal(false);
  pfLesson: number | null = null;
  pfText = '';
  pfFile: File | null = null;
  fb: Feedback = { rating: 0, clarity: 0, usefulness: 0, comment: '' };

  doneCount = computed(() => (this.pkg()?.lessons ?? []).filter((l) => this.learning.progress().has(l.id)).length);
  pct = computed(() => (this.pkg()?.lessons.length ? Math.round((this.doneCount() * 100) / this.pkg()!.lessons.length) : 0));
  nextLesson = computed(() => this.pkg()?.lessons.find((l) => !this.learning.progress().has(l.id)) ?? null);
  size = computed(() => formatBytes((this.pkg()?.lessons ?? []).reduce((s, l) => s + l.mediaSizeBytes, 0) + 20_000));
  missingMedia = computed(() => (this.pkg()?.lessons ?? []).some((l) => l.mediaUrl?.startsWith('/') && !this.media.has(l.mediaUrl)));

  async ngOnInit(): Promise<void> {
    try {
      const { pkg, fromCache } = await this.learning.coursePackage(Number(this.id()), this.v() ? Number(this.v()) : undefined);
      this.pkg.set(pkg);
      this.fromCache.set(fromCache);
      this.assistant.setContext({ courseId: pkg.id, label: pkg.title });
      const t = this.tabParam();
      if (t && this.tabs.some((x) => x.key === t)) void this.openTab(t as Tab);
      this.learning.certificates().then((r) => this.certs.set(r.list.filter((c) => c.courseId === pkg.id))).catch(() => undefined);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async openTab(t: Tab): Promise<void> {
    this.tab.set(t);
    const p = this.pkg();
    if (!p) return;
    try {
      if (t === 'portfolio') this.portfolio.set((await this.learning.myPortfolio()).filter((x) => x.courseId === p.id));
      if (t === 'discussion') this.threads.set(await firstValueFrom(this.http.get<ForumThread[]>(`/api/community/threads?courseId=${p.id}`)));
      if (t === 'avis') {
        const f = await this.learning.myFeedback(p.id);
        if (f) this.fb = { ...f, comment: f.comment ?? '' };
      }
    } catch {
      /* hors ligne */
    }
  }

  hasLevel(l: string): boolean {
    return this.certs().some((c) => c.level === l);
  }

  ruleFor(l: string): string {
    const p = this.pkg()!;
    switch (l) {
      case 'ATTESTATION': return 'Suivre toutes les leçons';
      case 'BADGE': return `Évaluation ≥ ${p.passScore} %`;
      case 'MAITRISE': return `Toutes les leçons + ≥ ${p.masteryScore} %`;
      default: return 'Maîtrise + portfolio validé par un mentor';
    }
  }

  typeIcon(t: string): string {
    return t === 'VIDEO' ? 'video' : t === 'AUDIO' ? 'headphones' : 'text';
  }

  typeLabel(t: string): string {
    return t === 'VIDEO' ? 'Vidéo' : t === 'AUDIO' ? 'Audio' : 'Lecture';
  }

  statusLabel(s: string): string {
    return s === 'VALIDE' ? 'Validé' : s === 'A_REVOIR' ? 'À revoir' : 'En attente du mentor';
  }

  async download(): Promise<void> {
    this.dl.set(0);
    try {
      const pkg = await this.learning.download(Number(this.id()), (r) => this.dl.set(r));
      this.pkg.set(pkg);
      this.toast.show({ icon: 'download', title: 'Module disponible hors ligne', text: pkg.title });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.dl.set(null);
    }
  }

  pickVideo(ev: Event): void {
    this.pfFile = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  async sendPortfolio(): Promise<void> {
    const p = this.pkg()!;
    this.sending.set(true);
    try {
      let mediaUrl: string | null = null;
      if (this.pfFile) {
        const fd = new FormData();
        fd.append('file', this.pfFile);
        mediaUrl = (await firstValueFrom(this.http.post<{ url: string }>('/api/media', fd))).url;
      }
      const r = await this.learning.submitPortfolio(p.id, this.pfLesson, this.pfText, mediaUrl);
      this.toast.show({ icon: r === 'sent' ? 'send' : 'clock', title: r === 'sent' ? 'Envoyé au mentor' : 'Sera envoyé au retour du réseau' });
      this.pfText = '';
      this.pfFile = null;
      void this.openTab('portfolio');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

  async sendFeedback(): Promise<void> {
    try {
      await this.learning.saveFeedback(this.pkg()!.id, this.fb);
      this.toast.show({ icon: 'heart', title: 'Merci pour votre avis !' });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}

