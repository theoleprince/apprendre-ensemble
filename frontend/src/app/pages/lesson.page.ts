import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssistantService } from '../core/assistant.service';
import { errorMessage } from '../core/auth.interceptor';
import { TranslatePipe } from '../core/i18n';
import { LearningService } from '../core/learning.service';
import { MediaCacheService } from '../core/media-cache.service';
import { CoursePackage, Lesson, formatBytes } from '../core/models';
import { PrefsService } from '../core/prefs.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { MarkdownPipe } from '../shared/markdown.pipe';
import { SpeakButtonComponent } from '../shared/speak-button.component';

@Component({
  selector: 'app-lesson',
  imports: [RouterLink, IconComponent, MarkdownPipe, SpeakButtonComponent, TranslatePipe],
  template: `
    @if (pkg(); as p) {
      @if (lesson(); as l) {
        <a [routerLink]="['/modules', p.id]" class="back"><app-icon name="back" [size]="18" /> {{ p.title }}</a>
        <div class="quiz-progress">@for (x of p.lessons; track x.id) {<span [class.on]="learning.isDone(x.id) || x.id === l.id"></span>}</div>
        <p class="small muted" style="margin:0">Leçon {{ l.position }} / {{ p.lessons.length }} · {{ l.durationMinutes }} min</p>
        <div class="row" style="align-items:flex-start">
          <h1 class="grow">{{ l.title }}</h1>
          @if (l.mediaType === 'TEXT') { <app-speak [text]="l.title + '. ' + l.content" [label]="true" /> }
        </div>

        @if (l.mediaType === 'VIDEO' && l.mediaUrl) {
          @if (src()) {
            <div class="player">
              <video #video [src]="src()" controls playsinline preload="metadata" (ended)="onEnded()">
                @if (vtt()) { <track kind="subtitles" srclang="fr" label="Français" [src]="vtt()" default /> }
              </video>
            </div>
            <div class="row" style="margin-top:.5rem">
              <span class="small muted">Vitesse</span>
              <div class="speed">@for (s of speeds; track s) {<button [class.active]="rate() === s" (click)="setRate(s)">{{ s }}×</button>}</div>
            </div>
          } @else {
            <div class="media-gate">
              @if (canLoad()) {
                <app-icon name="video" [size]="40" />
                <div>Vidéo · {{ size(l.mediaSizeBytes) }}</div>
                <button class="sun" (click)="load()"><app-icon name="play" /> Charger la vidéo</button>
                <div class="xs" style="opacity:.75">Mode économie de données : rien n'est chargé sans votre accord.</div>
              } @else {
                <app-icon name="wifi-off" [size]="40" />
                <div>Vidéo non téléchargée. Lisez ou écoutez la transcription ci-dessous.</div>
              }
            </div>
          }
        }

        @if (l.mediaType === 'AUDIO' && l.mediaUrl) {
          <div class="audio-player">
            @if (src()) {
              <audio #audio [src]="src()" preload="metadata" (timeupdate)="onTime()" (loadedmetadata)="onTime()" (ended)="onEnded()" (pause)="playing.set(false)" (play)="playing.set(true)"></audio>
              <button class="big-play" (click)="togglePlay()" [attr.aria-label]="playing() ? 'Pause' : 'Lecture'"><app-icon [name]="playing() ? 'pause' : 'play'" [size]="30" /></button>
              <div class="grow" style="flex:1">
                <div style="font-weight:700">🎧 Leçon audio</div>
                <input type="range" min="0" [max]="duration()" step="0.5" [value]="time()" (input)="seek($event)" aria-label="Position" style="width:100%" />
                <div class="row small" style="justify-content:space-between"><span>{{ fmt(time()) }} / {{ fmt(duration()) }}</span>
                  <div class="speed">@for (s of speeds; track s) {<button [class.active]="rate() === s" (click)="setRate(s)">{{ s }}×</button>}</div></div>
              </div>
            } @else {
              <app-icon name="headphones" [size]="36" />
              <div class="grow" style="flex:1">Audio · {{ size(l.mediaSizeBytes) }}</div>
              @if (canLoad()) { <button class="sun" (click)="load()">Charger</button> } @else { <span class="small">Non téléchargé</span> }
            }
          </div>
        }

        @if (l.mediaType === 'TEXT') {
          <article class="card content" [innerHTML]="l.content | markdown"></article>
        } @else if (l.content) {
          <details class="transcript card flat">
            <summary><app-icon name="text" /> &nbsp;Transcription @if (l.mediaType === 'VIDEO') {(sous-titres)}</summary>
            <div class="row" style="justify-content:flex-end"><app-speak [text]="l.content" [label]="true" /></div>
            <div class="content" [innerHTML]="l.content | markdown"></div>
          </details>
        }

        @if (l.practiceTask) {
          <div class="practice">
            <h3>🛠️ Mise en pratique</h3>
            <p>{{ l.practiceTask }}</p>
            <a class="btn" [routerLink]="['/modules', p.id]" [queryParams]="{ tab: 'portfolio' }"><app-icon name="camera" /> Déposer dans mon portfolio</a>
          </div>
        }

        <div class="lesson-nav">
          @if (prev(); as pr) { <a class="btn" [routerLink]="['/modules', p.id, 'lecon', pr.id]" aria-label="Leçon précédente"><app-icon name="back" /></a> }
          @if (!learning.isDone(l.id)) {
            <button class="primary grow lg" (click)="complete()"><app-icon name="check" /> {{ 'action.done' | t }}</button>
          } @else if (next(); as nx) {
            <a class="btn primary grow lg" [routerLink]="['/modules', p.id, 'lecon', nx.id]">{{ 'action.next' | t }} <app-icon name="arrow" /></a>
          } @else if (p.questions.length) {
            <a class="btn sun grow lg" [routerLink]="['/modules', p.id, 'evaluation']"><app-icon name="target" /> Passer l'évaluation</a>
          } @else {
            <a class="btn primary grow lg" [routerLink]="['/modules', p.id]">Terminer le module</a>
          }
        </div>
      } @else {
        <p class="error">Leçon introuvable.</p>
      }
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else {
      <div class="skeleton" style="height:300px"></div>
    }
  `,
})
export class LessonPage implements OnInit, OnDestroy {
  protected learning = inject(LearningService);
  private media = inject(MediaCacheService);
  private prefs = inject(PrefsService);
  private assistant = inject(AssistantService);
  private toast = inject(ToastService);

  readonly id = input.required<string>();
  readonly lessonId = input.required<string>();
  private videoEl = viewChild<ElementRef<HTMLVideoElement>>('video');
  private audioEl = viewChild<ElementRef<HTMLAudioElement>>('audio');

  speeds = [0.75, 1, 1.25, 1.5];
  pkg = signal<CoursePackage | null>(null);
  error = signal('');
  src = signal<string | null>(null);
  vtt = signal<string | null>(null);
  rate = signal(1);
  playing = signal(false);
  time = signal(0);
  duration = signal(0);
  private startedAt = Date.now();
  private blobUrls: string[] = [];

  lesson = computed(() => this.pkg()?.lessons.find((l) => l.id === Number(this.lessonId())) ?? null);
  prev = computed(() => this.neighbour(-1));
  next = computed(() => this.neighbour(1));
  canLoad = computed(() => this.learning.online());

  constructor() {
    // changement de lecon (navigation suivante/precedente) : on recharge le media
    effect(() => {
      const l = this.lesson();
      if (l) void this.prepare(l);
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const { pkg } = await this.learning.coursePackage(Number(this.id()));
      this.pkg.set(pkg);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private async prepare(l: Lesson): Promise<void> {
    this.startedAt = Date.now();
    this.revoke();
    this.src.set(null);
    this.vtt.set(null);
    this.playing.set(false);
    const p = this.pkg()!;
    this.assistant.setContext({ courseId: p.id, lessonId: l.id, label: l.title });
    void this.learning.setLastLesson({ courseId: p.id, lessonId: l.id, courseTitle: p.title, lessonTitle: l.title, icon: p.icon });
    if (!l.mediaUrl) return;
    // en cache : lecture locale immediate ; sinon, chargement uniquement sur action (economie de donnees)
    if (this.media.has(l.mediaUrl) || !this.prefs.prefs().dataSaver) {
      await this.load();
    }
  }

  async load(): Promise<void> {
    const l = this.lesson();
    if (!l?.mediaUrl) return;
    const url = await this.media.playableUrl(l.mediaUrl);
    if (url.startsWith('blob:')) this.blobUrls.push(url);
    this.src.set(url);
    if (l.subtitlesUrl) {
      const v = await this.media.playableUrl(l.subtitlesUrl);
      if (v.startsWith('blob:')) this.blobUrls.push(v);
      this.vtt.set(v);
    }
  }

  private neighbour(delta: number): Lesson | null {
    const p = this.pkg();
    const l = this.lesson();
    if (!p || !l) return null;
    return p.lessons.find((x) => x.position === l.position + delta) ?? null;
  }

  setRate(r: number): void {
    this.rate.set(r);
    const el = this.videoEl()?.nativeElement ?? this.audioEl()?.nativeElement;
    if (el) el.playbackRate = r;
  }

  togglePlay(): void {
    const a = this.audioEl()?.nativeElement;
    if (!a) return;
    a.playbackRate = this.rate();
    if (a.paused) void a.play();
    else a.pause();
  }

  onTime(): void {
    const a = this.audioEl()?.nativeElement;
    if (!a) return;
    this.time.set(a.currentTime);
    this.duration.set(Number.isFinite(a.duration) ? a.duration : 0);
  }

  seek(ev: Event): void {
    const a = this.audioEl()?.nativeElement;
    if (a) a.currentTime = Number((ev.target as HTMLInputElement).value);
  }

  onEnded(): void {
    const l = this.lesson();
    if (l && !this.learning.isDone(l.id)) void this.complete();
  }

  fmt(s: number): string {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  size(b: number): string {
    return formatBytes(b);
  }

  async complete(): Promise<void> {
    const l = this.lesson();
    if (!l) return;
    await this.learning.completeLesson(l.id, (Date.now() - this.startedAt) / 1000);
    this.toast.show({ icon: '✅', title: 'Leçon terminée', text: navigator.onLine ? undefined : 'Enregistrée sur l’appareil' }, 2500);
  }

  private revoke(): void {
    this.blobUrls.forEach((u) => URL.revokeObjectURL(u));
    this.blobUrls = [];
  }

  ngOnDestroy(): void {
    this.revoke();
  }
}
