import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Presentation, Reviews } from '../core/models';
import { PLATFORM_FAQ } from '../pages/info.page';
import { IconComponent } from './icon.component';
import { StarsComponent } from './stars.component';
import { AvatarComponent } from './visuals';

/** Blocs communes aux pages cours et formation : equipe pedagogique, avis des apprenant·es, questions frequentes. */
@Component({
  selector: 'app-detail-blocks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StarsComponent, AvatarComponent],
  template: `
    @let p = presentation();
    @if (p.authorName) {
      <section class="section">
        <h2>Équipe pédagogique</h2>
        <div class="author-card">
          <app-avatar [name]="p.authorName" [size]="64" />
          <div>
            <strong>{{ p.authorName }}</strong>
            @if (p.authorTitle) { <div class="small muted">{{ p.authorTitle }}</div> }
            @if (p.authorBio) { <p class="small">{{ p.authorBio }}</p> }
          </div>
        </div>
      </section>
    }

    <section class="section" id="avis">
      <h2>Avis des apprenant·es</h2>
      @let r = reviews();
      @if (r.count) {
        <div class="reviews">
          <div class="rev-summary">
            <div class="rev-avg">{{ avg() }}</div>
            <app-stars [value]="r.average" [count]="r.count" [size]="18" />
            <span class="xs muted">Avis laissés après avoir terminé le cours</span>
          </div>
          <div class="rev-hist" aria-label="Répartition des notes">
            @for (n of [5, 4, 3, 2, 1]; track n) {
              <div class="rev-row"><span class="xs">{{ n }} ★</span><div class="rev-bar"><div [style.width.%]="pct(n)"></div></div><span class="xs muted">{{ pct(n) }} %</span></div>
            }
          </div>
        </div>
        @if (r.latest.length) {
          <div class="rev-list">
            @for (x of r.latest; track $index) {
              <figure class="rev-card">
                <figcaption><app-avatar [name]="x.author" [size]="34" /><div><strong>{{ x.author }}</strong><div class="xs muted">{{ date(x.createdAt) }}@if (x.courseTitle) { · {{ x.courseTitle }} }</div></div>
                  <span class="testi-stars" [attr.aria-label]="x.rating + ' sur 5'">{{ '★'.repeat(x.rating) }}<span class="off">{{ '★'.repeat(5 - x.rating) }}</span></span></figcaption>
                <blockquote>{{ x.comment }}</blockquote>
              </figure>
            }
          </div>
        }
      } @else {
        <p class="muted">Pas encore d'avis : les apprenant·es donnent leur avis à la fin du cours.</p>
      }
    </section>

    <section class="section">
      <h2>Questions fréquentes</h2>
      <div class="faq">
        @for (f of faq(); track f.q) {
          <details><summary>{{ f.q }}<app-icon name="chevron-down" [size]="18" /></summary><p>{{ f.a }}</p></details>
        }
      </div>
    </section>
  `,
})
export class DetailBlocksComponent {
  readonly presentation = input.required<Presentation>();
  readonly reviews = input.required<Reviews>();

  protected avg = computed(() => this.reviews().average.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  protected faq = computed(() => [
    ...this.presentation().faq.map((f) => ({ q: f.question, a: f.answer })),
    ...PLATFORM_FAQ.slice(0, 5).map((f) => ({ q: f.q, a: f.a })),
  ]);

  pct(n: number): number {
    const r = this.reviews();
    return r.count ? Math.round((r.histogram[n - 1] * 100) / r.count) : 0;
  }

  date(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
}
