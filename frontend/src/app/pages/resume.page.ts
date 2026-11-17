import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';

/**
 * Point d'entree unique "Commencer / Continuer" : ouvre directement la prochaine etape du module
 * (premiere lecon non terminee, sinon l'evaluation, sinon la fiche du module).
 */
@Component({
  selector: 'app-resume',
  imports: [RouterLink],
  template: `
    @if (error()) {
      <p class="error">{{ error() }}</p>
      <a class="btn" routerLink="/modules">Retour aux modules</a>
    } @else {
      <div class="skeleton" style="height:240px"></div>
    }
  `,
})
export class ResumePage implements OnInit {
  private learning = inject(LearningService);
  private router = inject(Router);
  readonly id = input.required<string>();
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const { pkg } = await this.learning.coursePackage(Number(this.id()));
      const next = pkg.lessons.find((l) => !this.learning.isDone(l.id));
      const target = next
        ? ['/modules', pkg.id, 'lecon', next.id]
        : pkg.questions.length
          ? ['/modules', pkg.id, 'evaluation']
          : ['/modules', pkg.id];
      await this.router.navigate(target, { replaceUrl: true });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
