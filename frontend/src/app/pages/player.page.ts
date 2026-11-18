import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../core/assistant.service';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { LearningService } from '../core/learning.service';
import { MediaCacheService } from '../core/media-cache.service';
import { Certificate, CoursePackage, Lesson, QuizResult, formatBytes } from '../core/models';
import { OfflineStore } from '../core/offline-store';
import { PrefsService } from '../core/prefs.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { MarkdownPipe } from '../shared/markdown.pipe';
import { SpeakButtonComponent } from '../shared/speak-button.component';
import { MedalComponent } from '../shared/visuals';

type StepKind = 'lesson' | 'check' | 'exam' | 'end';

interface Step {
  key: string;
  kind: StepKind;
  lesson?: Lesson;
  title: string;
}

/**
 * Lecteur de cours lineaire, a la maniere des grandes plateformes :
 * lecon -> quiz de la notion -> lecon suivante ... -> evaluation finale -> certificat.
 * On ne peut pas sauter d'etape : la suivante s'ouvre quand la precedente est validee.
 * Le plan du cours est toujours visible : on sait ou l'on est, d'ou l'on vient et ou l'on va.
 */
@Component({
  selector: 'app-player',
  imports: [RouterLink, FormsModule, IconComponent, MarkdownPipe, SpeakButtonComponent, MedalComponent],
  template: `
    <div class="cp">
      <header class="cp-top">
        <a routerLink="/accueil" class="btn ghost icon-btn" title="Quitter le cours" aria-label="Quitter le cours"><app-icon name="x" /></a>
        <div class="cp-title">
          <span class="xs muted">Cours</span>
          <strong>{{ pkg()?.title || myTitle() || 'Chargement…' }}</strong>
        </div>
        @if (pkg()) {
          <div class="cp-progress" [attr.aria-label]="'Progression ' + percent() + ' %'">
            <div class="progress"><div [style.width.%]="percent()"></div></div>
            <span class="small"><strong>{{ percent() }} %</strong></span>
          </div>
          <button class="btn ghost cp-dl" (click)="download()" [disabled]="downloading() || !learning.online()" [title]="offline() ? 'Disponible hors connexion' : 'Télécharger pour suivre le cours sans connexion'">
            <app-icon [name]="offline() ? 'check-circle' : 'download'" [size]="18" />
            <span class="hide-sm">{{ downloading() ? 'Téléchargement ' + dlPct() + ' %' : offline() ? 'Hors ligne' : 'Télécharger' }}</span>
          </button>
          <button class="btn ghost cp-plan-btn" (click)="planOpen.set(!planOpen())" [attr.aria-expanded]="planOpen()">
            <app-icon name="list" [size]="18" /> Plan · {{ index() + 1 }}/{{ steps().length }}
          </button>
        }
      </header>

      @if (error(); as err) {
        <section class="cp-empty card">
          <div class="empty-icon clay"><app-icon [name]="locked() ? 'lock' : 'alert'" [size]="30" /></div>
          <h2>{{ locked() ? 'Ce cours n\\'est pas encore ouvert' : 'Accès impossible' }}</h2>
          <p class="muted">{{ err }}</p>
          <div class="row" style="justify-content:center">
            <a class="btn primary" [routerLink]="['/cours', id()]">Voir la présentation du cours</a>
            <a class="btn" routerLink="/accueil">Mes formations</a>
          </div>
        </section>
      } @else if (pkg(); as p) {
        <div class="cp-body">
          <aside class="cp-plan" [class.open]="planOpen()">
            <div class="row" style="justify-content:space-between">
              <h3 style="margin:0">Plan du cours</h3>
              <button class="btn ghost icon-btn cp-plan-close" (click)="planOpen.set(false)" aria-label="Fermer le plan"><app-icon name="x" /></button>
            </div>
            <p class="xs muted" style="margin:.2rem 0 .8rem">Les étapes s'ouvrent l'une après l'autre.</p>
            <ol class="cp-steps">
              @for (s of steps(); track s.key; let i = $index) {
                <li [class.sub]="s.kind === 'check'" [class.done]="isDone(s)" [class.current]="i === index()" [class.locked]="i > current()">
                  <button (click)="go(i)" [disabled]="i > current()">
                    <span class="st">
                      @if (isDone(s)) { <app-icon name="check" [size]="14" /> }
                      @else if (i > current()) { <app-icon name="lock" [size]="13" /> }
                      @else { <app-icon [name]="stepIcon(s)" [size]="14" /> }
                    </span>
                    <span class="lbl">
                      <span class="xs muted">{{ stepKicker(s) }}</span>
                      {{ s.title }}
                    </span>
                  </button>
                </li>
              }
            </ol>
          </aside>
          @if (planOpen()) { <div class="cp-scrim" (click)="planOpen.set(false)"></div> }

          <main class="cp-stage">
            @if (step(); as s) {
              @switch (s.kind) {
                <!-- ======================= LECON ======================= -->
                @case ('lesson') {
                  @let l = s.lesson!;
                  <article class="lesson-body">
                    <div class="lesson-kicker">
                      <span class="tag">Leçon {{ l.position }} sur {{ p.lessons.length }}</span>
                      <app-icon [name]="mediaIcon(l)" [size]="16" /> {{ mediaLabel(l) }} · {{ l.durationMinutes }} min
                    </div>
                    <div class="row" style="align-items:flex-start">
                      <h1 style="flex:1">{{ l.title }}</h1>
                      @if (l.mediaType === 'TEXT') { <app-speak [text]="l.title + '. ' + l.content" [label]="true" /> }
                    </div>

                    @if (l.mediaType === 'VIDEO' && l.mediaUrl) {
                      @if (src()) {
                        <div class="player">
                          <video #video [src]="src()" controls playsinline preload="metadata">
                            @if (vtt()) { <track kind="subtitles" srclang="fr" label="Français" [src]="vtt()" default /> }
                          </video>
                        </div>
                        <div class="row media-tools">
                          <span class="small muted">Vitesse</span>
                          <div class="speed">@for (r of speeds; track r) {<button [class.active]="rate() === r" (click)="setRate(r)">{{ r }}×</button>}</div>
                        </div>
                      } @else {
                        <button class="media-gate" (click)="load()" [disabled]="!learning.online()">
                          <span class="play-circle"><app-icon [name]="learning.online() ? 'play' : 'wifi-off'" [size]="30" /></span>
                          @if (learning.online()) { <strong>Lancer la vidéo</strong><span class="xs">{{ size(l.mediaSizeBytes) }}</span> }
                          @else { <strong>Vidéo non téléchargée</strong><span class="xs">Lisez la transcription ci-dessous</span> }
                        </button>
                      }
                    }

                    @if (l.mediaType === 'AUDIO' && l.mediaUrl) {
                      <div class="audio-player">
                        @if (src()) {
                          <audio #audio [src]="src()" preload="metadata" (timeupdate)="onTime()" (loadedmetadata)="onTime()" (pause)="playing.set(false)" (play)="playing.set(true)"></audio>
                        }
                        <button class="big-play" (click)="src() ? togglePlay() : loadAndPlay()" [disabled]="!src() && !learning.online()" [attr.aria-label]="playing() ? 'Pause' : 'Lecture'">
                          <app-icon [name]="playing() ? 'pause' : 'play'" [size]="30" /></button>
                        <div style="flex:1;min-width:0">
                          <div class="row" style="font-weight:700;gap:.4rem"><app-icon name="headphones" [size]="18" /> Leçon audio</div>
                          <input type="range" min="0" [max]="duration()" step="0.5" [value]="time()" (input)="seek($event)" aria-label="Position" style="width:100%" [disabled]="!src()" />
                          <div class="row small" style="justify-content:space-between"><span>{{ fmt(time()) }} / {{ fmt(duration()) }}</span>
                            <div class="speed">@for (r of speeds; track r) {<button [class.active]="rate() === r" (click)="setRate(r)">{{ r }}×</button>}</div></div>
                        </div>
                      </div>
                    }

                    @if (l.mediaType === 'TEXT') {
                      <div class="content reading" [innerHTML]="l.content | markdown"></div>
                    } @else if (l.content) {
                      <details class="transcript card flat">
                        <summary><app-icon name="text" /> &nbsp;Transcription</summary>
                        <div class="content" [innerHTML]="l.content | markdown"></div>
                      </details>
                    }

                    @if (l.practiceTask) {
                      <section class="practice">
                        <h3 class="row" style="gap:.4rem"><app-icon name="wrench" /> Exercice pratique</h3>
                        <p>{{ l.practiceTask }}</p>
                        @if (sent()) {
                          <p class="notice info small"><app-icon name="check-circle" [size]="16" /> {{ sent() }}</p>
                        } @else {
                          <details>
                            <summary class="small" style="cursor:pointer;min-height:36px">Envoyer mon exercice à mon mentor (facultatif)</summary>
                            <label>Ce que j'ai fait et observé <textarea rows="3" [(ngModel)]="pfText" name="pft" maxlength="4000"></textarea></label>
                            <div class="row">
                              <label class="btn ghost file-btn" [class.disabled]="!learning.online()">
                                <app-icon name="camera" /> {{ pfFile ? pfFile.name : 'Ajouter une vidéo' }}
                                <input type="file" accept="video/*" capture="environment" (change)="pickVideo($event)" [disabled]="!learning.online()" hidden />
                              </label>
                              <button class="sun" (click)="sendPortfolio()" [disabled]="(!pfText.trim() && !pfFile) || sending()"><app-icon name="send" /> {{ sending() ? 'Envoi…' : 'Envoyer' }}</button>
                            </div>
                            <p class="xs muted">Un exercice validé par un mentor débloque la certification d'expertise.</p>
                          </details>
                        }
                      </section>
                    }
                  </article>
                }

                <!-- ======================= QUIZ DE LA NOTION ======================= -->
                @case ('check') {
                  @let l = s.lesson!;
                  <section class="lesson-body">
                    <div class="lesson-kicker"><span class="tag sun">Quiz</span> Leçon {{ l.position }} · {{ l.title }}</div>
                    <h1>Testez vos connaissances</h1>
                    <p class="muted">Répondez pour valider la notion et passer à la suite. Vous pouvez réessayer autant de fois que nécessaire.</p>
                    @for (q of l.checks; track q.id; let qi = $index) {
                      <div class="check-q">
                        <div class="row" style="align-items:flex-start"><strong style="flex:1">{{ qi + 1 }}. {{ q.question }}</strong><app-speak [text]="q.question + '. ' + q.options.join('. ')" /></div>
                        @for (o of q.options; track $index; let j = $index) {
                          <button class="option-card" [class.selected]="checkAnswers()[qi] === j"
                                  [class.right]="checked() && j === q.correctIndex" [class.wrong]="checked() && checkAnswers()[qi] === j && j !== q.correctIndex"
                                  [disabled]="checked()" (click)="pickCheck(qi, j)">
                            <span class="letter">{{ letters[j] }}</span>{{ o }}
                          </button>
                        }
                        @if (checked() && q.explanation) { <div class="notice info small"><app-icon name="lightbulb" [size]="16" /> {{ q.explanation }}</div> }
                      </div>
                    }
                    @if (!checked()) {
                      <button class="primary lg" (click)="validateCheck(l)" [disabled]="!checkComplete(l)">Valider mes réponses</button>
                    } @else if (isDone(s)) {
                      <div class="result-banner ok"><app-icon name="check-circle" [size]="26" /><div><strong>Bravo, notion validée !</strong><div class="small">Vous pouvez passer à la suite.</div></div></div>
                    } @else {
                      <div class="result-banner ko"><app-icon name="alert" [size]="26" /><div><strong>Pas tout à fait.</strong><div class="small">Relisez la leçon si besoin, puis réessayez.</div></div></div>
                      <div class="row"><button class="btn" (click)="go(index() - 1)"><app-icon name="back" /> Revoir la leçon</button><button class="primary" (click)="resetCheck()"><app-icon name="sync" /> Réessayer</button></div>
                    }
                  </section>
                }

                <!-- ======================= EVALUATION FINALE ======================= -->
                @case ('exam') {
                  <section class="lesson-body">
                    @switch (examStage()) {
                      @case ('intro') {
                        <div class="center">
                          <div class="empty-icon sunbg" style="width:84px;height:84px"><app-icon name="target" [size]="40" /></div>
                          <h1>Évaluation finale</h1>
                          <p class="muted">Toutes les leçons sont validées. Dernière étape avant votre certificat.</p>
                          <div class="intro-facts">
                            <div><strong>{{ p.questions.length }}</strong><span>questions</span></div>
                            <div><strong>{{ p.passScore }} %</strong><span>pour réussir</span></div>
                            <div><strong>{{ p.masteryScore }} %</strong><span>pour la maîtrise</span></div>
                          </div>
                          @if (examBest() >= 0) { <p class="small">Votre meilleur score : <strong>{{ examBest() }} %</strong></p> }
                          @if (!learning.online()) { <p class="notice"><app-icon name="wifi-off" /> La correction se fait en ligne : connectez-vous pour passer l'évaluation.</p> }
                          <button class="primary lg" (click)="startExam()" [disabled]="!learning.online()">{{ examBest() >= 0 ? 'Repasser l\\'évaluation' : 'Commencer l\\'évaluation' }} <app-icon name="arrow" /></button>
                        </div>
                      }
                      @case ('questions') {
                        @if (examQ(); as q) {
                          <div class="lesson-kicker">Question {{ examIndex() + 1 }} sur {{ p.questions.length }}</div>
                          <div class="progress" style="margin:.4rem 0 1rem"><div [style.width.%]="(examIndex() + 1) * 100 / p.questions.length"></div></div>
                          <div class="row" style="align-items:flex-start"><h2 style="flex:1">{{ q.question }}</h2><app-speak [text]="q.question + '. ' + q.options.join('. ')" /></div>
                          @for (o of q.options; track $index; let j = $index) {
                            <button class="option-card" [class.selected]="examAnswers()[examIndex()] === j" (click)="pickExam(j)"><span class="letter">{{ letters[j] }}</span>{{ o }}</button>
                          }
                          <div class="row" style="margin-top:1rem">
                            <button class="btn" (click)="examIndex() === 0 ? examStage.set('intro') : examIndex.set(examIndex() - 1)"><app-icon name="back" /> Précédente</button>
                            <span style="flex:1"></span>
                            @if (examIndex() < p.questions.length - 1) {
                              <button class="primary" [disabled]="examAnswers()[examIndex()] === undefined" (click)="examIndex.set(examIndex() + 1)">Suivante <app-icon name="arrow" /></button>
                            } @else {
                              <button class="sun" [disabled]="!examComplete() || sending() || !learning.online()" (click)="submitExam()">{{ sending() ? 'Correction…' : 'Voir mon résultat' }}</button>
                            }
                          </div>
                        }
                      }
                      @case ('result') {
                        @if (examResult(); as r) {
                          <div class="center">
                            <div class="score-ring" [style.--p]="r.scorePercent" [class.pass]="r.passed"><span>{{ r.scorePercent }} %</span></div>
                            <h1>{{ r.passed ? (r.mastery ? 'Maîtrise atteinte, bravo !' : 'Évaluation réussie !') : 'Encore un petit effort' }}</h1>
                            <p class="muted">{{ r.passed ? 'Votre certificat vous attend.' : 'Il faut ' + p.passScore + ' % pour réussir. Revoyez les leçons puis réessayez.' }}</p>
                            <div class="row" style="justify-content:center">
                              @if (r.passed) {
                                <button class="primary lg" (click)="go(index() + 1)">Voir mon certificat <app-icon name="arrow" /></button>
                              } @else {
                                <button class="btn" (click)="go(0)"><app-icon name="book-open" /> Revoir les leçons</button>
                                <button class="primary" (click)="startExam()"><app-icon name="sync" /> Réessayer</button>
                              }
                            </div>
                          </div>
                          <details class="card flat section">
                            <summary class="row" style="min-height:44px;cursor:pointer"><app-icon name="check-circle" /> <strong>Voir la correction</strong></summary>
                            @for (q of p.questions; track q.id; let i = $index) {
                              <div style="margin-top:1rem">
                                <strong>{{ i + 1 }}. {{ q.question }}</strong>
                                @for (o of q.options; track $index; let j = $index) {
                                  <div class="option-card" [class.right]="j === r.corrections[i].correctIndex" [class.wrong]="j === examAnswers()[i] && !r.corrections[i].correct" style="pointer-events:none"><span class="letter">{{ letters[j] }}</span>{{ o }}</div>
                                }
                                @if (r.corrections[i].explanation) { <div class="notice info small"><app-icon name="lightbulb" [size]="16" /> {{ r.corrections[i].explanation }}</div> }
                              </div>
                            }
                          </details>
                        }
                      }
                    }
                  </section>
                }

                <!-- ======================= FIN : CERTIFICAT ======================= -->
                @case ('end') {
                  <section class="lesson-body center">
                    <div class="empty-icon sunbg" style="width:84px;height:84px"><app-icon name="trophy" [size]="40" /></div>
                    <h1>Cours terminé, félicitations !</h1>
                    <p class="muted">{{ p.title }}</p>
                    @if (certs().length) {
                      <div class="earned">
                        @for (c of certs(); track c.code) {
                          <div class="earned-item">
                            <app-medal [level]="c.level || 'MAITRISE'" [size]="64" />
                            <strong>{{ c.levelLabel }}</strong>
                            <div class="row" style="justify-content:center">
                              <a class="btn" [href]="'/api/public/certificates/' + c.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" [size]="16" /> PDF</a>
                              <a class="btn ghost" [href]="linkedIn(c)" target="_blank" rel="noopener" title="Ajouter à LinkedIn"><app-icon name="linkedin" [size]="16" /></a>
                            </div>
                          </div>
                        }
                      </div>
                    } @else if (!learning.online()) {
                      <p class="notice"><app-icon name="wifi-off" /> Vos certificats s'afficheront au retour du réseau.</p>
                    }
                    <div class="card flat rate-box">
                      <strong>Ce cours vous a-t-il aidé·e ?</strong>
                      <div class="stars" style="justify-content:center">@for (n of [1, 2, 3, 4, 5]; track n) {
                        <button [class.on]="rating() >= n" (click)="rateCourse(n)" [attr.aria-label]="n + ' sur 5'"><app-icon name="star" [size]="30" /></button>
                      }</div>
                      @if (rated()) { <span class="xs muted">Merci, votre avis améliore le cours.</span> }
                    </div>
                    <div class="row" style="justify-content:center;margin-top:1rem">
                      @if (nextCourse(); as n) {
                        <a class="btn primary lg" [routerLink]="['/apprendre', n.id]">Cours suivant : {{ n.title }} <app-icon name="arrow" /></a>
                      } @else {
                        <a class="btn primary lg" routerLink="/catalogue">Découvrir d'autres cours <app-icon name="arrow" /></a>
                      }
                      <a class="btn" routerLink="/certificats"><app-icon name="award" /> Mes certificats</a>
                    </div>
                  </section>
                }
              }
            }
          </main>
        </div>

        @if (step(); as s) {
          @if (s.kind === 'lesson' || s.kind === 'check') {
            <footer class="cp-nav">
              <button class="btn" (click)="go(index() - 1)" [disabled]="index() === 0"><app-icon name="back" /> <span class="hide-sm">Précédent</span></button>
              <span class="cp-hint small muted">{{ hint() }}</span>
              <button class="primary lg" (click)="next()" [disabled]="busy() || (s.kind === 'check' && !isDone(s))">{{ nextLabel() }} <app-icon name="arrow" /></button>
            </footer>
          }
        }
      } @else {
        <div class="skeleton" style="height:320px;margin:1rem"></div>
      }
    </div>
  `,
})
export class PlayerPage implements OnDestroy {
  protected learning = inject(LearningService);
  private catalog = inject(CatalogApi);
  private media = inject(MediaCacheService);
  private prefs = inject(PrefsService);
  private assistant = inject(AssistantService);
  private toast = inject(ToastService);
  private store = inject(OfflineStore);
  private router = inject(Router);
  private http = inject(HttpClient);

  readonly id = input.required<string>();
  readonly step_ = input<string | undefined>(undefined, { alias: 'step' });

  private videoEl = viewChild<ElementRef<HTMLVideoElement>>('video');
  private audioEl = viewChild<ElementRef<HTMLAudioElement>>('audio');

  letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  speeds = [0.75, 1, 1.25, 1.5];

  pkg = signal<CoursePackage | null>(null);
  error = signal('');
  locked = signal(false);
  planOpen = signal(false);
  busy = signal(false);
  read = signal<Set<number>>(new Set());
  examBest = signal(-1);
  certs = signal<Certificate[]>([]);
  downloading = signal(false);
  dlPct = signal(0);

  // media
  src = signal<string | null>(null);
  vtt = signal<string | null>(null);
  rate = signal(1);
  playing = signal(false);
  time = signal(0);
  duration = signal(0);
  private blobUrls: string[] = [];
  private startedAt = Date.now();
  private prepared = '';

  // exercice / portfolio
  pfText = '';
  pfFile: File | null = null;
  sending = signal(false);
  sent = signal('');

  // quiz de la notion
  checkAnswers = signal<(number | undefined)[]>([]);
  checked = signal(false);

  // evaluation finale
  examStage = signal<'intro' | 'questions' | 'result'>('intro');
  examIndex = signal(0);
  examAnswers = signal<(number | undefined)[]>([]);
  examResult = signal<QuizResult | null>(null);

  rating = signal(0);
  rated = signal(false);

  readonly steps = computed<Step[]>(() => {
    const p = this.pkg();
    if (!p) return [];
    const out: Step[] = [];
    for (const l of p.lessons) {
      out.push({ key: 'lecon-' + l.id, kind: 'lesson', lesson: l, title: l.title });
      if (l.checks?.length) out.push({ key: 'quiz-' + l.id, kind: 'check', lesson: l, title: 'Testez vos connaissances' });
    }
    if (p.questions.length) out.push({ key: 'evaluation', kind: 'exam', title: 'Évaluation finale' });
    out.push({ key: 'fin', kind: 'end', title: 'Certificat' });
    return out;
  });

  /** Premiere etape non validee : c'est la que l'on reprend. */
  readonly current = computed(() => {
    const s = this.steps();
    const i = s.findIndex((x) => !this.isDone(x));
    return i < 0 ? s.length - 1 : i;
  });

  readonly index = computed(() => {
    const i = this.steps().findIndex((s) => s.key === this.step_());
    return i >= 0 && i <= this.current() ? i : this.current();
  });

  readonly step = computed(() => this.steps()[this.index()] ?? null);

  readonly percent = computed(() => {
    const s = this.steps().filter((x) => x.kind !== 'end');
    return s.length ? Math.round((s.filter((x) => this.isDone(x)).length * 100) / s.length) : 0;
  });

  readonly myTitle = computed(() => this.catalog.mine()?.courses.find((c) => c.courseId === Number(this.id()))?.title ?? '');

  readonly offline = computed(() => this.learning.downloaded().has(Number(this.id())));

  readonly nextCourse = computed(() => {
    const mine = this.catalog.mine();
    const cid = Number(this.id());
    const me = mine?.courses.find((c) => c.courseId === cid);
    const prog = me?.programId ? mine?.programs.find((p) => p.programId === me.programId) : null;
    if (!prog) return null;
    const i = prog.courseIds.indexOf(cid);
    const nid = prog.courseIds[i + 1];
    const n = mine?.courses.find((c) => c.courseId === nid);
    return n ? { id: n.courseId, title: n.title } : null;
  });

  readonly nextLabel = computed(() => {
    const s = this.step();
    if (!s) return '';
    const nx = this.steps()[this.index() + 1];
    if (s.kind === 'lesson' && s.lesson?.checks?.length) return 'Passer au quiz';
    if (!nx) return 'Terminer';
    if (nx.kind === 'exam') return "Passer à l'évaluation finale";
    if (nx.kind === 'end') return 'Terminer le cours';
    return 'Leçon suivante';
  });

  readonly hint = computed(() => {
    const s = this.step();
    if (s?.kind === 'check' && !this.isDone(s)) return 'Réussissez le quiz pour continuer';
    return `Étape ${this.index() + 1} sur ${this.steps().length}`;
  });

  examQ = computed(() => this.pkg()?.questions[this.examIndex()] ?? null);
  examComplete = computed(() => this.examAnswers().length === this.pkg()?.questions.length && this.examAnswers().every((a) => a !== undefined));

  constructor() {
    // changement de cours (ex. "cours suivant") : on recharge tout
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.loadCourse(id));
    });
    // changement d'etape : preparation de l'ecran, et l'adresse suit toujours l'etape reellement ouverte
    effect(() => {
      const s = this.step();
      const asked = this.step_();
      untracked(() => {
        if (!s) return;
        if (asked !== s.key) void this.router.navigate(['/apprendre', this.id(), s.key], { replaceUrl: true });
        const k = this.id() + '/' + s.key;
        if (k !== this.prepared) {
          this.prepared = k;
          this.prepare(s);
        }
      });
    });
  }

  private async loadCourse(id: number): Promise<void> {
    this.prepared = '';
    this.examStage.set('intro');
    this.examResult.set(null);
    this.pkg.set(null);
    this.error.set('');
    this.locked.set(false);
    try {
      const mine = this.catalog.mine() ?? (await this.catalog.myLearning().catch(() => null));
      const me = mine?.courses.find((c) => c.courseId === id);
      this.examBest.set(me?.bestScore ?? -1);
      this.read.set(new Set((await this.store.get<number[]>('kv', 'read-' + id).catch(() => undefined)) ?? []));
      const { pkg } = await this.learning.coursePackage(id, me?.contentVersion);
      this.pkg.set(pkg);
      void this.catalog.myLearning().then((m) => {
        const c = m.courses.find((x) => x.courseId === id);
        if (c) this.examBest.update((b) => Math.max(b, c.bestScore));
      }).catch(() => undefined);
    } catch (e) {
      this.locked.set(e instanceof HttpErrorResponse && e.status === 423);
      this.error.set(errorMessage(e));
    }
  }

  isDone(s: Step): boolean {
    const p = this.pkg();
    switch (s.kind) {
      case 'lesson':
        return this.read().has(s.lesson!.id) || this.learning.isDone(s.lesson!.id);
      case 'check':
        return this.learning.isDone(s.lesson!.id);
      case 'exam':
        return !!p && this.examBest() >= p.passScore;
      default:
        return false;
    }
  }

  go(i: number): void {
    const s = this.steps()[i];
    if (!s || i > this.current()) return;
    this.planOpen.set(false);
    void this.router.navigate(['/apprendre', this.id(), s.key]);
  }

  /** Action principale : valide l'etape en cours puis ouvre la suivante. */
  async next(): Promise<void> {
    const s = this.step();
    if (!s) return;
    this.busy.set(true);
    try {
      if (s.kind === 'lesson') {
        const l = s.lesson!;
        await this.markRead(l.id);
        // sans quiz, lire la lecon suffit a la valider
        if (!l.checks?.length && !this.learning.isDone(l.id)) await this.learning.completeLesson(l.id, (Date.now() - this.startedAt) / 1000);
      }
      this.go(this.index() + 1);
    } finally {
      this.busy.set(false);
    }
  }

  private async markRead(lessonId: number): Promise<void> {
    if (this.read().has(lessonId)) return;
    const n = new Set(this.read()).add(lessonId);
    this.read.set(n);
    await this.store.set('kv', 'read-' + this.id(), [...n]).catch(() => undefined);
  }

  private prepare(s: Step): void {
    window.scrollTo({ top: 0 });
    this.revoke();
    this.src.set(null);
    this.vtt.set(null);
    this.playing.set(false);
    this.time.set(0);
    this.sent.set('');
    this.pfText = '';
    this.pfFile = null;
    const p = this.pkg()!;
    if (s.kind === 'lesson') {
      const l = s.lesson!;
      this.startedAt = Date.now();
      this.assistant.setContext({ courseId: p.id, lessonId: l.id, label: l.title });
      void this.learning.setLastLesson({ courseId: p.id, lessonId: l.id, courseTitle: p.title, lessonTitle: l.title, icon: p.icon });
      if (l.mediaUrl && (this.media.has(l.mediaUrl) || !this.prefs.prefs().dataSaver)) void this.load();
    } else {
      this.assistant.setContext({ courseId: p.id, label: p.title });
    }
    if (s.kind === 'check') this.resetCheck();
    if (s.kind === 'exam' && this.examStage() === 'result' && !this.examResult()) this.examStage.set('intro');
    if (s.kind === 'end') void this.loadCerts();
  }

  // ---------- quiz de la notion (corrige sur l'appareil) ----------
  resetCheck(): void {
    const l = this.step()?.lesson;
    this.checkAnswers.set(new Array(l?.checks.length ?? 0).fill(undefined));
    this.checked.set(false);
  }

  pickCheck(qi: number, j: number): void {
    this.checkAnswers.update((a) => a.map((x, i) => (i === qi ? j : x)));
  }

  checkComplete(l: Lesson): boolean {
    const a = this.checkAnswers();
    return a.length === l.checks.length && a.every((x) => x !== undefined);
  }

  async validateCheck(l: Lesson): Promise<void> {
    const good = l.checks.filter((q, i) => this.checkAnswers()[i] === q.correctIndex).length;
    const pct = Math.round((good * 100) / l.checks.length);
    this.checked.set(true);
    if (pct >= this.pkg()!.passScore && !this.learning.isDone(l.id)) {
      await this.learning.completeLesson(l.id, (Date.now() - this.startedAt) / 1000);
    }
  }

  // ---------- evaluation finale (corrigee par le serveur) ----------
  startExam(): void {
    this.examAnswers.set(new Array(this.pkg()!.questions.length).fill(undefined));
    this.examIndex.set(0);
    this.examResult.set(null);
    this.examStage.set('questions');
  }

  pickExam(j: number): void {
    this.examAnswers.update((a) => a.map((x, i) => (i === this.examIndex() ? j : x)));
  }

  async submitExam(): Promise<void> {
    this.sending.set(true);
    try {
      const r = await this.learning.submitQuiz(this.pkg()!.id, this.examAnswers().map((a) => a ?? -1));
      this.examResult.set(r);
      this.examBest.update((b) => Math.max(b, r.scorePercent));
      this.examStage.set('result');
      if (r.passed) this.toast.show({ icon: 'party', title: 'Évaluation réussie !', celebrate: true }, 2500);
      window.scrollTo({ top: 0 });
      void this.catalog.myLearning().catch(() => undefined);
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Évaluation non envoyée', text: errorMessage(e) }, 5000);
    } finally {
      this.sending.set(false);
    }
  }

  private async loadCerts(): Promise<void> {
    try {
      const { list } = await this.learning.certificates();
      this.certs.set(list.filter((c) => c.courseId === Number(this.id())));
    } catch {
      this.certs.set([]);
    }
  }

  async rateCourse(n: number): Promise<void> {
    this.rating.set(n);
    try {
      await this.learning.saveFeedback(this.pkg()!.id, { rating: n, clarity: n, usefulness: n, comment: null });
      this.rated.set(true);
    } catch {
      this.toast.show({ icon: 'wifi-off', title: 'Avis non envoyé', text: 'Réessayez avec une connexion' }, 3000);
    }
  }

  linkedIn(c: Certificate): string {
    const d = new Date(c.issuedAt);
    const p = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: `${c.levelLabel} - ${c.courseTitle}`,
      issueYear: String(d.getFullYear()),
      issueMonth: String(d.getMonth() + 1),
      certId: c.code,
      certUrl: `${location.origin}/verifier/${c.code}`,
    });
    return `https://www.linkedin.com/profile/add?${p.toString()}`;
  }

  // ---------- hors ligne ----------
  async download(): Promise<void> {
    if (this.offline()) return;
    this.downloading.set(true);
    try {
      await this.learning.download(Number(this.id()), (r) => this.dlPct.set(Math.round(r * 100)));
      this.toast.show({ icon: 'check-circle', title: 'Cours disponible hors connexion' }, 3000);
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Téléchargement interrompu', text: errorMessage(e) }, 4000);
    } finally {
      this.downloading.set(false);
    }
  }

  // ---------- medias ----------
  async load(): Promise<void> {
    const l = this.step()?.lesson;
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

  async loadAndPlay(): Promise<void> {
    await this.load();
    setTimeout(() => this.togglePlay(), 50);
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

  pickVideo(ev: Event): void {
    this.pfFile = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  async sendPortfolio(): Promise<void> {
    const p = this.pkg()!;
    const l = this.step()!.lesson!;
    this.sending.set(true);
    try {
      let mediaUrl: string | null = null;
      if (this.pfFile) {
        const fd = new FormData();
        fd.append('file', this.pfFile);
        mediaUrl = (await firstValueFrom(this.http.post<{ url: string }>('/api/media', fd))).url;
      }
      const r = await this.learning.submitPortfolio(p.id, l.id, this.pfText, mediaUrl);
      this.sent.set(r === 'sent' ? 'Envoyé à votre mentor.' : 'Enregistré : sera envoyé au retour du réseau.');
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Envoi impossible', text: errorMessage(e) }, 4000);
    } finally {
      this.sending.set(false);
    }
  }

  // ---------- libelles ----------
  mediaIcon(l: Lesson): string {
    return l.mediaType === 'VIDEO' ? 'video' : l.mediaType === 'AUDIO' ? 'headphones' : 'text';
  }

  mediaLabel(l: Lesson): string {
    return l.mediaType === 'VIDEO' ? 'Vidéo' : l.mediaType === 'AUDIO' ? 'Audio' : 'Lecture';
  }

  stepIcon(s: Step): string {
    return s.kind === 'lesson' ? this.mediaIcon(s.lesson!) : s.kind === 'check' ? 'lightbulb' : s.kind === 'exam' ? 'target' : 'award';
  }

  stepKicker(s: Step): string {
    if (s.kind === 'lesson') return `Leçon ${s.lesson!.position}`;
    if (s.kind === 'check') return 'Quiz';
    if (s.kind === 'exam') return `${this.pkg()?.questions.length ?? 0} questions`;
    return 'Fin du cours';
  }

  fmt(sec: number): string {
    const m = Math.floor(sec / 60);
    return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
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
    this.assistant.setContext({});
  }
}
