import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../core/assistant.service';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { MediaCacheService } from '../core/media-cache.service';
import { CoursePackage, Lesson, formatBytes } from '../core/models';
import { PrefsService } from '../core/prefs.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { MarkdownPipe } from '../shared/markdown.pipe';
import { SpeakButtonComponent } from '../shared/speak-button.component';

/**
 * Lecteur de lecon en mode focus : une seule action principale ("Terminer et continuer"),
 * progression visible, mise en pratique et portfolio sur la meme page.
 */
@Component({
  selector: 'app-lesson',
  imports: [RouterLink, FormsModule, IconComponent, MarkdownPipe, SpeakButtonComponent],
  template: `
    @if (pkg(); as p) {
      @if (lesson(); as l) {
        <header class="focus-bar">
          <a [routerLink]="['/modules', p.id]" class="icon-btn btn ghost" aria-label="Quitter la leçon"><app-icon name="x" /></a>
          <div class="focus-progress" role="progressbar" [attr.aria-valuenow]="l.position" aria-valuemin="1" [attr.aria-valuemax]="p.lessons.length">
            @for (x of p.lessons; track x.id) {
              <a [routerLink]="['/modules', p.id, 'lecon', x.id]" [class.done]="learning.isDone(x.id)" [class.current]="x.id === l.id"
                 [attr.aria-label]="'Leçon ' + x.position + ' : ' + x.title"></a>
            }
            @if (p.questions.length) { <span class="quiz-step" title="Évaluation"><app-icon name="target" [size]="14" /></span> }
          </div>
          <span class="small muted nowrap">{{ l.position }}/{{ p.lessons.length }}</span>
        </header>

        <article class="lesson-body">
          <div class="lesson-kicker">
            <app-icon [name]="l.mediaType === 'VIDEO' ? 'video' : l.mediaType === 'AUDIO' ? 'headphones' : 'text'" [size]="16" />
            {{ l.mediaType === 'VIDEO' ? 'Vidéo' : l.mediaType === 'AUDIO' ? 'Audio' : 'Lecture' }} · {{ l.durationMinutes }} min
            @if (learning.isDone(l.id)) { <span class="tag"><app-icon name="check" [size]="12" /> Terminée</span> }
          </div>
          <div class="row" style="align-items:flex-start">
            <h1 class="grow" style="flex:1">{{ l.title }}</h1>
            @if (l.mediaType === 'TEXT') { <app-speak [text]="l.title + '. ' + l.content" [label]="true" /> }
          </div>

          @if (l.mediaType === 'VIDEO' && l.mediaUrl) {
            @if (src()) {
              <div class="player">
                <video #video [src]="src()" controls playsinline preload="metadata" (ended)="onEnded()">
                  @if (vtt()) { <track kind="subtitles" srclang="fr" label="Français" [src]="vtt()" default /> }
                </video>
              </div>
              <div class="row media-tools">
                <span class="small muted">Vitesse</span>
                <div class="speed">@for (s of speeds; track s) {<button [class.active]="rate() === s" (click)="setRate(s)">{{ s }}×</button>}</div>
              </div>
            } @else {
              <button class="media-gate" (click)="load()" [disabled]="!learning.online()">
                <span class="play-circle"><app-icon [name]="learning.online() ? 'play' : 'wifi-off'" [size]="30" /></span>
                @if (learning.online()) {
                  <strong>Lancer la vidéo</strong><span class="xs">{{ size(l.mediaSizeBytes) }} · économie de données activée</span>
                } @else {
                  <strong>Vidéo non téléchargée</strong><span class="xs">Lisez ou écoutez la transcription ci-dessous</span>
                }
              </button>
            }
          }

          @if (l.mediaType === 'AUDIO' && l.mediaUrl) {
            <div class="audio-player">
              @if (src()) {
                <audio #audio [src]="src()" preload="metadata" (timeupdate)="onTime()" (loadedmetadata)="onTime()" (ended)="onEnded()" (pause)="playing.set(false)" (play)="playing.set(true)"></audio>
              }
              <button class="big-play" (click)="src() ? togglePlay() : loadAndPlay()" [disabled]="!src() && !learning.online()"
                      [attr.aria-label]="playing() ? 'Pause' : 'Lecture'"><app-icon [name]="playing() ? 'pause' : 'play'" [size]="30" /></button>
              <div style="flex:1;min-width:0">
                <div class="row" style="font-weight:700;gap:.4rem"><app-icon name="headphones" [size]="18" /> Leçon audio
                  @if (!src()) { <span class="xs" style="opacity:.8;font-weight:400">· {{ size(l.mediaSizeBytes) }}</span> }</div>
                <input type="range" min="0" [max]="duration()" step="0.5" [value]="time()" (input)="seek($event)" aria-label="Position" style="width:100%" [disabled]="!src()" />
                <div class="row small" style="justify-content:space-between"><span>{{ fmt(time()) }} / {{ fmt(duration()) }}</span>
                  <div class="speed">@for (s of speeds; track s) {<button [class.active]="rate() === s" (click)="setRate(s)">{{ s }}×</button>}</div></div>
              </div>
            </div>
          }

          @if (l.mediaType === 'TEXT') {
            <div class="content reading" [innerHTML]="l.content | markdown"></div>
          } @else if (l.content) {
            <details class="transcript card flat">
              <summary><app-icon name="text" /> &nbsp;Transcription</summary>
              <div class="row" style="justify-content:flex-end"><app-speak [text]="l.content" [label]="true" /></div>
              <div class="content" [innerHTML]="l.content | markdown"></div>
            </details>
          }

          @if (l.practiceTask) {
            <section class="practice">
              <h3 class="row" style="gap:.4rem"><app-icon name="wrench" /> Mise en pratique</h3>
              <p>{{ l.practiceTask }}</p>
              @if (sent()) {
                <p class="notice info small"><app-icon name="check-circle" [size]="16" /> {{ sent() }}</p>
              } @else {
                <label>Ce que j'ai fait et observé <textarea rows="3" [(ngModel)]="pfText" name="pft" maxlength="4000" placeholder="Décrivez votre activité en classe…"></textarea></label>
                <div class="row">
                  <label class="btn ghost file-btn" [class.disabled]="!learning.online()">
                    <app-icon name="camera" /> {{ pfFile ? pfFile.name : 'Ajouter une vidéo' }}
                    <input type="file" accept="video/*" capture="environment" (change)="pickVideo($event)" [disabled]="!learning.online()" hidden />
                  </label>
                  <button class="sun" (click)="sendPortfolio()" [disabled]="(!pfText.trim() && !pfFile) || sending()"><app-icon name="send" /> {{ sending() ? 'Envoi…' : 'Envoyer au mentor' }}</button>
                </div>
                <p class="xs muted">Facultatif pour continuer. Une vidéo validée par un mentor débloque la certification d'expertise.</p>
              }
            </section>
          }
        </article>

        <div class="focus-cta">
          @if (prev(); as pr) { <a class="btn icon-btn" [routerLink]="['/modules', p.id, 'lecon', pr.id]" aria-label="Leçon précédente"><app-icon name="back" /></a> }
          <button class="primary grow lg" (click)="completeAndContinue()" [disabled]="busy()">
            {{ ctaLabel() }} <app-icon name="arrow" />
          </button>
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
  private router = inject(Router);
  private http = inject(HttpClient);

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
  busy = signal(false);
  sending = signal(false);
  sent = signal('');
  pfText = '';
  pfFile: File | null = null;
  private startedAt = Date.now();
  private blobUrls: string[] = [];

  lesson = computed(() => this.pkg()?.lessons.find((l) => l.id === Number(this.lessonId())) ?? null);
  prev = computed(() => this.neighbour(-1));
  next = computed(() => this.neighbour(1));
  ctaLabel = computed(() => {
    const l = this.lesson();
    const done = !!l && this.learning.isDone(l.id);
    if (this.next()) return done ? 'Leçon suivante' : 'Terminer et continuer';
    if (this.pkg()?.questions.length) return done ? "Passer à l'évaluation" : "Terminer et passer à l'évaluation";
    return 'Terminer le module';
  });

  constructor() {
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
    this.time.set(0);
    this.sent.set('');
    this.pfText = '';
    this.pfFile = null;
    window.scrollTo({ top: 0 });
    const p = this.pkg()!;
    this.assistant.setContext({ courseId: p.id, lessonId: l.id, label: l.title });
    void this.learning.setLastLesson({ courseId: p.id, lessonId: l.id, courseTitle: p.title, lessonTitle: l.title, icon: p.icon });
    // media deja sur l'appareil, ou economie de donnees desactivee : chargement immediat
    if (l.mediaUrl && (this.media.has(l.mediaUrl) || !this.prefs.prefs().dataSaver)) await this.load();
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
    if (l.mediaType === 'VIDEO') setTimeout(() => void this.videoEl()?.nativeElement.play().catch(() => undefined), 50);
  }

  async loadAndPlay(): Promise<void> {
    await this.load();
    setTimeout(() => this.togglePlay(), 50);
  }

  private neighbour(delta: number): Lesson | null {
    const p = this.pkg();
    const l = this.lesson();
    if (!p || !l) return null;
    return p.lessons.find((x) => x.position === l.position + delta) ?? null;
  }

  /** Action principale unique : enregistre la lecon puis enchaine sur l'etape suivante. */
  async completeAndContinue(): Promise<void> {
    const p = this.pkg();
    const l = this.lesson();
    if (!p || !l) return;
    this.busy.set(true);
    try {
      if (!this.learning.isDone(l.id)) {
        await this.learning.completeLesson(l.id, (Date.now() - this.startedAt) / 1000);
      }
      const nx = this.next();
      if (nx) {
        await this.router.navigate(['/modules', p.id, 'lecon', nx.id]);
      } else if (p.questions.length) {
        await this.router.navigate(['/modules', p.id, 'evaluation']);
      } else {
        this.toast.show({ icon: 'party', title: 'Module terminé !', text: p.title, celebrate: true });
        await this.router.navigate(['/modules', p.id]);
      }
    } finally {
      this.busy.set(false);
    }
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

  /** Fin du media : la lecon est enregistree, l'apprenant choisit quand continuer. */
  async onEnded(): Promise<void> {
    const l = this.lesson();
    if (l && !this.learning.isDone(l.id)) {
      await this.learning.completeLesson(l.id, (Date.now() - this.startedAt) / 1000);
      this.toast.show({ icon: 'check-circle', title: 'Leçon terminée', text: this.next() ? 'Continuez quand vous voulez' : undefined }, 2500);
    }
  }

  pickVideo(ev: Event): void {
    this.pfFile = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  async sendPortfolio(): Promise<void> {
    const p = this.pkg()!;
    const l = this.lesson()!;
    this.sending.set(true);
    try {
      let mediaUrl: string | null = null;
      if (this.pfFile) {
        const fd = new FormData();
        fd.append('file', this.pfFile);
        mediaUrl = (await firstValueFrom(this.http.post<{ url: string }>('/api/media', fd))).url;
      }
      const r = await this.learning.submitPortfolio(p.id, l.id, this.pfText, mediaUrl);
      this.sent.set(r === 'sent' ? 'Envoyé à votre mentor. Vous serez notifié·e de son retour.' : 'Enregistré : sera envoyé au retour du réseau.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

  fmt(s: number): string {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  size(b: number): string {
    return formatBytes(b);
  }

  private revoke(): void {
    this.blobUrls.forEach((u) => URL.revokeObjectURL(u));
    this.blobUrls = [];
  }

  ngOnDestroy(): void {
    this.revoke();
  }
}
