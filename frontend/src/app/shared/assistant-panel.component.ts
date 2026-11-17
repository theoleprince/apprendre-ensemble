import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssistantService } from '../core/assistant.service';
import { TranslatePipe } from '../core/i18n';
import { LearningService } from '../core/learning.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-assistant-panel',
  imports: [FormsModule, IconComponent, TranslatePipe],
  template: `
    @if (!ai.open()) {
      <button class="fab" (click)="ai.open.set(true)" [attr.aria-label]="'assistant.title' | t" title="Mentor IA">
        <app-icon name="sparkles" [size]="26" />
      </button>
    } @else {
      <section class="assistant" role="dialog" aria-label="Assistant IA">
        <header>
          <div class="avatar"><app-icon name="sparkles" /></div>
          <div class="grow" style="flex:1">
            <strong>{{ 'assistant.title' | t }}</strong>
            <div class="ctx">
              @if (!learning.online()) { {{ 'assistant.offline' | t }} }
              @else if (ai.context().label) { À propos de : {{ ai.context().label }} }
              @else { Assistant pédagogique · vérifiez les informations importantes }
            </div>
          </div>
          <button class="icon-btn ghost" (click)="ai.reset()" title="Nouvelle conversation"><app-icon name="sync" /></button>
          <button class="icon-btn ghost" (click)="ai.open.set(false)" aria-label="Fermer"><app-icon name="x" /></button>
        </header>
        <div class="msgs" #msgs aria-live="polite">
          <div class="bubble bot">{{ 'assistant.hello' | t }}</div>
          @for (m of ai.messages(); track $index; let last = $last) {
            <div class="bubble" [class.user]="m.role === 'user'" [class.bot]="m.role === 'assistant'" [class.flag]="m.flagged"
                 [class.typing]="last && ai.busy() && m.role === 'assistant'">{{ m.content }}</div>
            @if (m.flagged) {
              <div class="xs muted">🛡️ Ce message est transmis de façon confidentielle à l'équipe pour un suivi humain.</div>
            }
          }
        </div>
        @if (ai.messages().length === 0) {
          <div class="suggests">
            @for (s of suggestions(); track s) {
              <button (click)="send(s)">{{ s }}</button>
            }
          </div>
        }
        <form (ngSubmit)="send(q)">
          <input name="q" [(ngModel)]="q" [placeholder]="'assistant.placeholder' | t" autocomplete="off" maxlength="2000" />
          <button class="primary icon-btn" type="submit" [disabled]="!q.trim() || ai.busy()" aria-label="Envoyer"><app-icon name="send" /></button>
        </form>
      </section>
    }
  `,
})
export class AssistantPanelComponent {
  protected ai = inject(AssistantService);
  protected learning = inject(LearningService);
  private msgs = viewChild<ElementRef<HTMLElement>>('msgs');
  q = '';

  constructor() {
    effect(() => {
      this.ai.messages();
      const el = this.msgs()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  suggestions(): string[] {
    return this.ai.context().lessonId
      ? ['Explique-moi cette leçon simplement', 'Donne-moi un exemple en classe', 'Comment me préparer à l’évaluation ?']
      : ['Par quel module commencer ?', 'Comment obtenir un certificat ?', 'Comment apprendre sans connexion ?'];
  }

  send(text: string): void {
    this.q = '';
    void this.ai.ask(text);
  }
}
