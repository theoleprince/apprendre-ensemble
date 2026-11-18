import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { CoursePackage, CourseSummary, LEVELS, QuizResult } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { SpeakButtonComponent } from '../shared/speak-button.component';
import { CoverComponent, MedalComponent } from '../shared/visuals';

type Step = 'intro' | 'questions' | 'bilan';

/**
 * Evaluation finale en trois temps : introduction (regles, seuils) -> questions (une par ecran,
 * validation explicite) -> bilan (score, certifications obtenues, avis, module suivant).
 */
@Component({
  selector: 'app-quiz',
  imports: [RouterLink, IconComponent, SpeakButtonComponent, MedalComponent, CoverComponent],
  template: `
    @if (pkg(); as p) {
      <header class="focus-bar">
        <a [routerLink]="['/modules', p.id]" class="icon-btn btn ghost" aria-label="Quitter l'évaluation"><app-icon name="x" /></a>
        <div class="focus-progress">
          @for (q of p.questions; track q.id; let i = $index) {
            <a [class.done]="step() === 'bilan' || i < index()" [class.current]="step() === 'questions' && i === index()"></a>
          }
        </div>
        <span class="small muted nowrap">Évaluation</span>
      </header>

      @switch (step()) {
        @case ('intro') {
          <section class="lesson-body center">
            <div class="empty-icon sunbg" style="width:84px;height:84px"><app-icon name="target" [size]="40" /></div>
            <h1>Évaluation finale</h1>
            <p class="muted">{{ p.title }}</p>
            <div class="intro-facts">
              <div><strong>{{ p.questions.length }}</strong><span>questions</span></div>
              <div><strong>{{ p.passScore }} %</strong><span>pour le badge</span></div>
              <div><strong>{{ p.masteryScore }} %</strong><span>pour la maîtrise</span></div>
            </div>
            <p class="small muted">Prenez votre temps. Vous verrez la correction expliquée à la fin et pourrez recommencer autant de fois que vous voulez.</p>
            @if (!learning.online()) { <p class="notice"><app-icon name="wifi-off" /> La correction se fait en ligne. Vous pouvez répondre maintenant et valider au retour du réseau.</p> }
          </section>
          <div class="focus-cta"><button class="primary grow lg" (click)="step.set('questions')">Commencer <app-icon name="arrow" /></button></div>
        }

        @case ('questions') {
          @if (current(); as q) {
            <section class="lesson-body">
              <div class="lesson-kicker">Question {{ index() + 1 }} sur {{ p.questions.length }}</div>
              <div class="row" style="align-items:flex-start">
                <h1 class="grow" style="flex:1">{{ q.question }}</h1>
                <app-speak [text]="q.question + '. ' + q.options.join('. ')" />
              </div>
              <div role="radiogroup">
                @for (o of q.options; track $index; let j = $index) {
                  <button class="option-card" role="radio" [attr.aria-checked]="answers()[index()] === j" [class.selected]="answers()[index()] === j" (click)="choose(j)">
                    <span class="letter">{{ letters[j] }}</span>{{ o }}
                  </button>
                }
              </div>
              @if (error()) { <p class="error">{{ error() }}</p> }
            </section>
            <div class="focus-cta">
              <button class="icon-btn" (click)="back()" aria-label="Question précédente"><app-icon name="back" /></button>
              @if (index() < p.questions.length - 1) {
                <button class="primary grow lg" [disabled]="answers()[index()] === undefined" (click)="index.set(index() + 1)">Suivante <app-icon name="arrow" /></button>
              } @else {
                <button class="sun grow lg" [disabled]="!allAnswered() || sending() || !learning.online()" (click)="submit()">
                  {{ sending() ? 'Correction…' : 'Voir mon résultat' }}
                </button>
              }
            </div>
          }
        }

        @case ('bilan') {
          @if (result(); as r) {
            <section class="lesson-body center">
              <div class="score-ring" [style.--p]="r.scorePercent" [class.pass]="r.passed"><span>{{ r.scorePercent }} %</span></div>
              <h1>{{ r.mastery ? 'Maîtrise atteinte, bravo !' : r.passed ? 'Évaluation réussie !' : 'Encore un petit effort' }}</h1>
              <p class="muted">{{ r.passed ? 'Vos nouvelles compétences sont reconnues.' : 'Relisez les leçons et retentez : vous pouvez recommencer autant de fois que nécessaire.' }}</p>
              @if (!r.allLessonsCompleted) { <p class="notice">Terminez toutes les leçons pour obtenir l'attestation et la maîtrise.</p> }

              @if (r.newCertificates.length) {
                <div class="earned">
                  @for (c of r.newCertificates; track c.code) {
                    <div class="earned-item">
                      <app-medal [level]="c.level || 'MAITRISE'" [size]="64" />
                      <strong>{{ c.levelLabel }}</strong>
                      <div class="row" style="justify-content:center">
                        <a class="btn" [href]="'/api/public/certificates/' + c.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" [size]="16" /> PDF</a>
                        <a class="btn ghost" [href]="linkedIn(c.levelLabel, c.courseTitle, c.code, c.issuedAt)" target="_blank" rel="noopener"><app-icon name="linkedin" [size]="16" /></a>
                      </div>
                    </div>
                  }
                </div>
              }

              <div class="card flat rate-box">
                <strong>Ce module vous a-t-il aidé·e ?</strong>
                <div class="stars" style="justify-content:center">@for (n of [1, 2, 3, 4, 5]; track n) {
                  <button [class.on]="rating() >= n" (click)="rate(n)" [attr.aria-label]="n + ' sur 5'"><app-icon name="star" [size]="30" /></button>
                }</div>
                @if (rated()) { <span class="xs muted">Merci, votre avis améliore le module.</span> }
              </div>
            </section>

            @if (nextCourse(); as n) {
              <section class="lesson-body">
                <h2>Et maintenant ?</h2>
                <a class="card course-card next-card" [routerLink]="['/modules', n.id, 'reprendre']" style="text-decoration:none;color:inherit">
                  <app-cover class="card-cover" [icon]="n.icon" [seed]="n.id" [height]="96" [label]="n.title" />
                  <span class="xs muted">{{ n.recommended ? 'Recommandé pour vous' : 'Module suivant' }}</span>
                  <h3 style="margin:0">{{ n.title }}</h3>
                  <span class="small muted">{{ n.lessonCount }} leçons · {{ n.totalMinutes }} min</span>
                </a>
              </section>
            }

            <section class="lesson-body">
              <details class="card flat">
                <summary class="row" style="min-height:44px;cursor:pointer"><app-icon name="check-circle" /> <strong>Voir la correction ({{ goodCount() }}/{{ p.questions.length }})</strong></summary>
                @for (q of p.questions; track q.id; let i = $index) {
                  <div style="margin-top:1rem">
                    <strong>{{ i + 1 }}. {{ q.question }}</strong>
                    <div style="margin-top:.5rem">
                      @for (o of q.options; track $index; let j = $index) {
                        <div class="option-card" [class.right]="j === r.corrections[i].correctIndex" [class.wrong]="j === answers()[i] && !r.corrections[i].correct" style="pointer-events:none">
                          <span class="letter">{{ letters[j] }}</span>{{ o }}
                        </div>
                      }
                    </div>
                    @if (r.corrections[i].explanation) { <div class="notice info small"><app-icon name="lightbulb" [size]="16" /> {{ r.corrections[i].explanation }}</div> }
                  </div>
                }
              </details>
            </section>

            <div class="focus-cta">
              <button class="icon-btn" (click)="restart()" title="Recommencer l'évaluation" aria-label="Recommencer"><app-icon name="sync" /></button>
              @if (nextCourse(); as n) {
                <a class="btn primary grow lg" [routerLink]="['/modules', n.id, 'reprendre']">Module suivant <app-icon name="arrow" /></a>
              } @else {
                <a class="btn primary grow lg" routerLink="/certificats">Mes certificats <app-icon name="arrow" /></a>
              }
            </div>
          }
        }
      }
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else {
      <div class="skeleton"></div>
    }
  `,
})
export class QuizPage implements OnInit {
  protected learning = inject(LearningService);
  private toast = inject(ToastService);
  readonly id = input.required<string>();

  letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  step = signal<Step>('intro');
  pkg = signal<CoursePackage | null>(null);
  courses = signal<CourseSummary[]>([]);
  index = signal(0);
  answers = signal<(number | undefined)[]>([]);
  result = signal<QuizResult | null>(null);
  sending = signal(false);
  rating = signal(0);
  rated = signal(false);
  error = signal('');

  current = computed(() => this.pkg()?.questions[this.index()] ?? null);
  allAnswered = computed(() => this.answers().length === this.pkg()?.questions.length && this.answers().every((a) => a !== undefined));
  goodCount = computed(() => this.result()?.corrections.filter((c) => c.correct).length ?? 0);
  /** Module suivant : d'abord les recommandations du test d'entree, puis les modules non termines. */
  nextCourse = computed(() => {
    const id = this.pkg()?.id;
    const open = this.courses().filter((c) => c.id !== id && c.completedLessons < c.lessonCount);
    return open.find((c) => c.recommended) ?? open[0] ?? null;
  });

  async ngOnInit(): Promise<void> {
    try {
      const { pkg } = await this.learning.coursePackage(Number(this.id()));
      this.pkg.set(pkg);
      this.answers.set(new Array(pkg.questions.length).fill(undefined));
      this.courses.set((await this.learning.courses()).list);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  choose(j: number): void {
    this.answers.update((a) => {
      const c = [...a];
      c[this.index()] = j;
      return c;
    });
  }

  back(): void {
    if (this.index() === 0) this.step.set('intro');
    else this.index.update((i) => i - 1);
  }

  async submit(): Promise<void> {
    this.sending.set(true);
    this.error.set('');
    try {
      this.result.set(await this.learning.submitQuiz(this.pkg()!.id, this.answers().map((a) => a ?? -1)));
      this.step.set('bilan');
      // celebration discrete (confettis) quand un niveau est obtenu
      if (this.result()!.newCertificates.length) this.toast.show({ icon: 'party', title: 'Félicitations !', celebrate: true }, 2500);
      window.scrollTo({ top: 0 });
      this.courses.set((await this.learning.courses()).list);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

  async rate(n: number): Promise<void> {
    this.rating.set(n);
    try {
      await this.learning.saveFeedback(this.pkg()!.id, { rating: n, clarity: n, usefulness: n, comment: null });
      this.rated.set(true);
    } catch {
      this.toast.show({ icon: 'wifi-off', title: 'Avis non envoyé', text: 'Réessayez avec une connexion' }, 3000);
    }
  }

  restart(): void {
    this.result.set(null);
    this.index.set(0);
    this.answers.set(new Array(this.pkg()!.questions.length).fill(undefined));
    this.step.set('intro');
  }

  linkedIn(level: string, course: string, code: string, issuedAt: string): string {
    const d = new Date(issuedAt);
    const p = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: `${level} - ${course}`,
      issueYear: String(d.getFullYear()),
      issueMonth: String(d.getMonth() + 1),
      certId: code,
      certUrl: `${location.origin}/verifier/${code}`,
    });
    return `https://www.linkedin.com/profile/add?${p.toString()}`;
  }

  protected readonly levels = LEVELS;
}
