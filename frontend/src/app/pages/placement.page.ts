import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { LearningService } from '../core/learning.service';
import { PlacementQuestion, PlacementResult } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { SpeakButtonComponent } from '../shared/speak-button.component';

/** Test d'entree : une question par ecran, gros pictogrammes, lecture a voix haute. */
@Component({
  selector: 'app-placement',
  imports: [RouterLink, IconComponent, SpeakButtonComponent],
  template: `
    <section class="card narrow" style="max-width:640px">
      @if (result(); as r) {
        <div class="center">
          <div class="empty-icon"><app-icon name="target" [size]="34" /></div>
          <h1>Votre parcours est prêt</h1>
          <p class="muted">{{ r.message }}</p>
        </div>
        <div class="stack section">
          @for (c of r.recommended; track c.id; let i = $index) {
            <a class="lesson-item" [routerLink]="['/modules', c.id]">
              <span class="course-icon"><app-icon [name]="c.icon || 'book-open'" [size]="26" /></span>
              <span class="grow"><span class="title">{{ c.title }}</span><br /><span class="small muted">{{ c.lessonCount }} leçons · {{ c.totalMinutes }} min</span></span>
              @if (i === 0) { <span class="tag sun">Conseillé</span> }
            </a>
          }
        </div>
        <button class="primary block lg" (click)="finish()">Aller à mon accueil <app-icon name="arrow" /></button>
      } @else if (questions().length) {
        <p class="small muted">Test d'entrée · question {{ index() + 1 }} / {{ questions().length }}</p>
        <div class="dots">@for (q of questions(); track q.id; let i = $index) {<span [class.on]="i === index()"></span>}</div>
        <div class="row" style="align-items:flex-start">
          <h1 class="grow" style="margin:0 0 1rem">{{ current()!.question }}</h1>
          <app-speak [text]="speakText()" />
        </div>
        <div class="placement-options">
          @for (o of current()!.options; track $index; let j = $index) {
            <button class="placement-opt" [class.selected]="answers()[current()!.id] === j" (click)="choose(j)">
              <span class="emoji"><app-icon [name]="o.icon || 'circle'" [size]="36" [stroke]="1.6" /></span>{{ o.label }}
            </button>
          }
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="row section">
          <button [disabled]="index() === 0" (click)="index.set(index() - 1)"><app-icon name="back" /> Retour</button>
          <span class="grow"></span>
          <button class="link" (click)="skip()">Passer le test</button>
        </div>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <div class="skeleton"></div>
      }
    </section>
  `,
})
export class PlacementPage implements OnInit {
  private learning = inject(LearningService);
  private auth = inject(AuthService);
  private router = inject(Router);

  questions = signal<PlacementQuestion[]>([]);
  index = signal(0);
  answers = signal<Record<number, number>>({});
  result = signal<PlacementResult | null>(null);
  error = signal('');
  current = computed(() => this.questions()[this.index()] ?? null);
  speakText = computed(() => {
    const q = this.current();
    return q ? q.question + '. ' + q.options.map((o) => o.label).join('. ') : '';
  });

  async ngOnInit(): Promise<void> {
    try {
      this.questions.set(await this.learning.placementQuestions());
      if (!this.questions().length) await this.submit();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async choose(j: number): Promise<void> {
    const q = this.current()!;
    this.answers.update((a) => ({ ...a, [q.id]: j }));
    if (this.index() < this.questions().length - 1) {
      setTimeout(() => this.index.update((i) => i + 1), 220);
    } else {
      await this.submit();
    }
  }

  async skip(): Promise<void> {
    await this.submit();
  }

  private async submit(): Promise<void> {
    try {
      this.result.set(await this.learning.submitPlacement(this.answers()));
      await this.auth.refreshMe();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  finish(): void {
    void this.router.navigateByUrl('/accueil');
  }
}
