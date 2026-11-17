import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { AiSuggestions, CourseInsights } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/**
 * Boucle d'amelioration : erreurs les plus frequentes + retours utilisateurs -> propositions de l'IA ->
 * decision humaine -> nouvelle version du module (les appareils hors ligne la recuperent automatiquement).
 */
@Component({
  selector: 'app-insights',
  imports: [RouterLink, IconComponent, DecimalPipe],
  template: `
    <a routerLink="/admin" class="back"><app-icon name="back" [size]="18" /> Pilotage</a>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (ins(); as i) {
      <div class="section-head">
        <div><h1 style="margin:0">{{ i.title }}</h1><p class="muted small">Version {{ i.contentVersion }} · {{ i.attempts }} tentatives à l'évaluation</p></div>
        <a class="btn" [routerLink]="['/admin/modules', i.courseId]"><app-icon name="edit" /> Modifier le module</a>
      </div>

      <ol class="row small card flat" style="list-style:none;padding:.7rem 1rem;gap:1.2rem">
        <li>① Analyse des erreurs</li><li>② Suggestions IA</li><li>③ Décision de l'équipe pédagogique</li><li>④ Nouvelle version publiée</li>
      </ol>

      <section class="tiles section">
        <div class="tile"><span class="value">{{ i.avgRating ? (i.avgRating | number: '1.1-1') : '—' }}</span><span class="label">Satisfaction /5</span></div>
        <div class="tile"><span class="value">{{ i.avgClarity ? (i.avgClarity | number: '1.1-1') : '—' }}</span><span class="label">Clarté /5</span></div>
        <div class="tile"><span class="value">{{ i.avgUsefulness ? (i.avgUsefulness | number: '1.1-1') : '—' }}</span><span class="label">Utilité /5</span></div>
      </section>

      <div class="grid cols-2">
        <section class="card">
          <h2>Erreurs par question</h2>
          @for (q of i.questions; track q.questionId; let n = $index) {
            <div style="margin-bottom:1.1rem">
              <div class="row"><strong class="grow" style="flex:1">Q{{ n + 1 }}. {{ q.question }}</strong>
                <span class="tag" [class.clay]="q.errorRate >= 0.3">{{ round(q.errorRate * 100) }} % d'erreurs</span></div>
              <div class="hbars" style="margin-top:.4rem">
                @for (o of q.distribution; track $index) {
                  <div class="hbar" [class.correct]="o.correct" [class.wrongtop]="!o.correct && o.count === maxWrong(q)">
                    <span class="small row" style="gap:.25rem;flex-wrap:nowrap">@if (o.correct) {<app-icon name="check" [size]="14" style="color:var(--ok)" />}{{ o.option }}</span>
                    <div class="track"><div class="fill" [style.width.%]="q.answers ? (o.count * 100) / q.answers : 0"></div></div>
                    <span class="v">{{ o.count }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </section>
        <section class="card">
          <h2>Commentaires des apprenant·es</h2>
          <div class="stack">
            @for (c of i.comments.slice(0, 12); track $index) { <div class="bubble quote">« {{ c }} »</div> }
            @empty { <p class="muted small">Pas encore de commentaire.</p> }
          </div>
        </section>
      </div>

      <section class="card section" style="background:var(--violet-50);border-color:transparent">
        <div class="section-head">
          <h2 style="margin:0"><app-icon name="sparkles" /> Propositions d'amélioration</h2>
          <button class="primary" (click)="suggest()" [disabled]="busy()">{{ busy() ? 'Analyse en cours…' : (ai() ? 'Relancer l’analyse' : 'Analyser avec l’IA') }}</button>
        </div>
        <p class="small muted">L'IA propose, l'équipe pédagogique décide. Aucune modification n'est publiée automatiquement.</p>
        @if (ai(); as a) {
          <p><strong>{{ a.summary }}</strong></p>
          <p class="xs muted">Moteur : {{ a.model === 'regles' ? 'règles statistiques (IA non configurée)' : a.model }}</p>
          <div class="stack">
            @for (s of a.suggestions; track $index) {
              <div class="card flat" [class]="'prio-' + (s.priority || 'moyenne').toLowerCase()">
                <div class="row"><strong class="grow" style="flex:1">{{ s.target }}</strong><span class="tag grey">priorité {{ s.priority }}</span></div>
                <p class="small"><strong>Constat :</strong> {{ s.problem }}</p>
                <p class="small"><strong>Proposition :</strong> {{ s.proposedChange }}</p>
                <p class="xs muted">{{ s.rationale }}</p>
              </div>
            }
          </div>
        }
      </section>
    } @else if (!error()) {
      <div class="skeleton"></div>
    }
  `,
})
export class InsightsPage implements OnInit {
  private http = inject(HttpClient);
  readonly id = input.required<string>();
  ins = signal<CourseInsights | null>(null);
  ai = signal<AiSuggestions | null>(null);
  busy = signal(false);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.ins.set(await firstValueFrom(this.http.get<CourseInsights>(`/api/admin/courses/${this.id()}/insights`)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async suggest(): Promise<void> {
    this.busy.set(true);
    try {
      this.ai.set(await firstValueFrom(this.http.post<AiSuggestions>(`/api/admin/courses/${this.id()}/ai-suggestions`, {})));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  maxWrong(q: CourseInsights['questions'][number]): number {
    return Math.max(0, ...q.distribution.filter((o) => !o.correct).map((o) => o.count));
  }

  round(n: number): number {
    return Math.round(n);
  }
}
