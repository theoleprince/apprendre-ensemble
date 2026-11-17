import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { CoursePackage, LEVELS, QuizResult } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { SpeakButtonComponent } from '../shared/speak-button.component';

/** Evaluation formative : une question par ecran, correction expliquee, niveaux de certification obtenus. */
@Component({
  selector: 'app-quiz',
  imports: [RouterLink, IconComponent, SpeakButtonComponent],
  template: `
    @if (pkg(); as p) {
      <a [routerLink]="['/modules', p.id]" class="back"><app-icon name="back" [size]="18" /> {{ p.title }}</a>
      @if (result(); as r) {
        <section class="card center">
          <div style="font-size:3rem">{{ r.mastery ? '🏆' : r.passed ? '🎉' : '💪' }}</div>
          <div class="score-big" [style.color]="r.passed ? 'var(--ok)' : 'var(--clay)'">{{ r.scorePercent }} %</div>
          <p>{{ r.mastery ? 'Maîtrise atteinte, bravo !' : r.passed ? 'Évaluation réussie !' : 'Pas encore : relisez les leçons et réessayez.' }}</p>
          @if (!r.allLessonsCompleted) { <p class="notice">Terminez toutes les leçons pour obtenir l'attestation et la maîtrise.</p> }
          @if (r.newCertificates.length) {
            <div class="levels section">
              @for (c of r.newCertificates; track c.code) {
                <div class="level got"><div class="medal">{{ medal(c.level) }}</div><div class="name">{{ c.levelLabel }}</div></div>
              }
            </div>
            <a class="btn primary" routerLink="/certificats"><app-icon name="award" /> Voir mes certificats</a>
          }
        </section>
        <h2 class="section">Correction</h2>
        @for (q of p.questions; track q.id; let i = $index) {
          <div class="card flat" style="margin-bottom:.75rem">
            <strong>{{ i + 1 }}. {{ q.question }}</strong>
            <div style="margin-top:.6rem">
              @for (o of q.options; track $index; let j = $index) {
                <div class="option-card" [class.right]="j === r.corrections[i].correctIndex" [class.wrong]="j === answers()[i] && !r.corrections[i].correct" style="pointer-events:none">
                  <span class="letter">{{ letters[j] }}</span>{{ o }}
                </div>
              }
            </div>
            @if (r.corrections[i].explanation) { <div class="notice info small">💡 {{ r.corrections[i].explanation }}</div> }
          </div>
        }
        <button class="primary block lg" (click)="restart()">Recommencer</button>
      } @else {
        <div class="quiz-progress">@for (q of p.questions; track q.id; let i = $index) {<span [class.on]="i <= index()"></span>}</div>
        <p class="small muted">Question {{ index() + 1 }} / {{ p.questions.length }} · badge à {{ p.passScore }} %, maîtrise à {{ p.masteryScore }} %</p>
        @if (current(); as q) {
          <div class="row" style="align-items:flex-start">
            <h1 class="grow">{{ q.question }}</h1>
            <app-speak [text]="q.question + '. ' + q.options.join('. ')" />
          </div>
          @for (o of q.options; track $index; let j = $index) {
            <button class="option-card" [class.selected]="answers()[index()] === j" (click)="choose(j)">
              <span class="letter">{{ letters[j] }}</span>{{ o }}
            </button>
          }
        }
        @if (!learning.online()) { <p class="notice"><app-icon name="wifi-off" /> La correction se fait en ligne : vos réponses seront envoyées dès le retour du réseau.</p> }
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="lesson-nav">
          <button [disabled]="index() === 0" (click)="index.set(index() - 1)" aria-label="Précédente"><app-icon name="back" /></button>
          @if (index() < p.questions.length - 1) {
            <button class="primary grow lg" [disabled]="answers()[index()] === undefined" (click)="index.set(index() + 1)">Suivante <app-icon name="arrow" /></button>
          } @else {
            <button class="sun grow lg" [disabled]="!allAnswered() || sending() || !learning.online()" (click)="submit()">
              {{ sending() ? 'Correction…' : 'Valider mes réponses' }}
            </button>
          }
        </div>
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
  readonly id = input.required<string>();

  letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  pkg = signal<CoursePackage | null>(null);
  index = signal(0);
  answers = signal<(number | undefined)[]>([]);
  result = signal<QuizResult | null>(null);
  sending = signal(false);
  error = signal('');
  current = computed(() => this.pkg()?.questions[this.index()] ?? null);
  allAnswered = computed(() => this.answers().length === this.pkg()?.questions.length && this.answers().every((a) => a !== undefined));

  async ngOnInit(): Promise<void> {
    try {
      const { pkg } = await this.learning.coursePackage(Number(this.id()));
      this.pkg.set(pkg);
      this.answers.set(new Array(pkg.questions.length).fill(undefined));
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
    if (this.index() < this.pkg()!.questions.length - 1) setTimeout(() => this.index.update((i) => i + 1), 250);
  }

  async submit(): Promise<void> {
    this.sending.set(true);
    this.error.set('');
    try {
      this.result.set(await this.learning.submitQuiz(this.pkg()!.id, this.answers().map((a) => a ?? -1)));
      window.scrollTo({ top: 0 });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

  restart(): void {
    this.result.set(null);
    this.index.set(0);
    this.answers.set(new Array(this.pkg()!.questions.length).fill(undefined));
  }

  medal(l: string): string {
    return LEVELS.find((x) => x.key === l)?.icon ?? '🏅';
  }
}
