import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { AssistantLog } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/** Supervision humaine de l'assistant IA : revue des echanges, signalements de protection, suivi des couts. */
@Component({
  selector: 'app-ai-supervision',
  imports: [DatePipe, IconComponent],
  template: `
    <h1>Supervision de l'IA</h1>
    <p class="muted">Échanges pseudonymisés (identifiant technique). Les messages évoquant une situation de protection de l'enfance sont signalés pour un suivi humain.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <section class="tiles section">
      <div class="tile"><span class="value">{{ logs().length }}</span><span class="label">Échanges récents</span></div>
      <div class="tile"><span class="value" [style.color]="flagged() ? 'var(--clay)' : ''">{{ flagged() }}</span><span class="label">Signalés</span></div>
      <div class="tile"><span class="value">{{ tokens() }}</span><span class="label">Jetons consommés</span><div class="hint">suivi du coût des modèles</div></div>
      <div class="tile"><span class="value">{{ localShare() }} %</span><span class="label">Réponses en mode local</span></div>
    </section>
    <div class="chips"><button [class.active]="!onlyFlagged()" (click)="onlyFlagged.set(false)">Tous</button><button [class.active]="onlyFlagged()" (click)="onlyFlagged.set(true)">🛡️ Signalés</button></div>
    <div class="stack section">
      @for (l of shown(); track l.id) {
        <article class="card flat" [style.border-left]="l.flagged ? '5px solid var(--clay)' : ''">
          <div class="row xs muted"><span>#{{ l.userId }}</span><span>{{ l.at | date: 'dd/MM HH:mm' }}</span><span>{{ l.model }}</span>
            @if (l.flagged) { <span class="tag clay"><app-icon name="flag" [size]="12" /> À revoir</span> }</div>
          <p><strong>Q :</strong> {{ l.question }}</p>
          <p class="small" style="white-space:pre-wrap"><strong>R :</strong> {{ l.answer }}</p>
        </article>
      } @empty { <div class="empty">Aucun échange.</div> }
    </div>
  `,
})
export class AiSupervisionPage implements OnInit {
  private http = inject(HttpClient);
  logs = signal<AssistantLog[]>([]);
  onlyFlagged = signal(false);
  error = signal('');
  shown = computed(() => (this.onlyFlagged() ? this.logs().filter((l) => l.flagged) : this.logs()));
  flagged = computed(() => this.logs().filter((l) => l.flagged).length);
  tokens = computed(() => this.logs().reduce((s, l) => s + l.inputTokens + l.outputTokens, 0).toLocaleString('fr-FR'));
  localShare = computed(() => (this.logs().length ? Math.round((this.logs().filter((l) => l.model === 'local').length * 100) / this.logs().length) : 0));

  async ngOnInit(): Promise<void> {
    try {
      this.logs.set(await firstValueFrom(this.http.get<AssistantLog[]>('/api/admin/assistant/logs')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
