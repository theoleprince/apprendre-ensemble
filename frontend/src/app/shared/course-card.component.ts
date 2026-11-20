import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogCourse, CatalogProgram, LEVEL_LABELS, durationLabel, priceLabel } from '../core/models';
import { IconComponent } from './icon.component';
import { StarsComponent } from './stars.component';
import { CoverComponent } from './visuals';

/**
 * Carte de cours ou de formation, identique partout (accueil, catalogue, suggestions) :
 * couverture, type, titre, promesse, niveau, duree, note, inscrits, prix.
 */
@Component({
  selector: 'app-course-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, StarsComponent, CoverComponent],
  host: { class: 'cc-host' },
  template: `
    <a class="cc" [routerLink]="link()">
      <div class="cc-cover">
        <app-cover [icon]="item().icon" [seed]="seed()" [height]="150" [label]="item().title" />
        @if (badge(); as b) { <span class="cc-badge" [class]="'cc-badge ' + b.cls">{{ b.label }}</span> }
        @if (progress() !== null) { <div class="cc-progress"><div [style.width.%]="progress()"></div></div> }
      </div>
      <div class="cc-body">
        <div class="cc-kicker">
          <span>{{ isProgram() ? 'Formation certifiante' : (course()?.domainName || 'Cours') }}</span>
          @if (forMe()) { <span class="cc-forme">Pour vous</span> }
        </div>
        <h3 class="cc-title">{{ item().title }}</h3>
        <p class="cc-desc">{{ item().description }}</p>
        <app-stars [value]="item().rating" [count]="item().ratingCount" />
        <div class="cc-meta">
          <span><app-icon name="signal" [size]="14" /> {{ level() }}</span>
          <span><app-icon name="clock" [size]="14" /> {{ dur() }}</span>
          @if (isProgram()) { <span><app-icon name="book" [size]="14" /> {{ program()!.courseCount }} cours</span> }
          @else { <span><app-icon name="book-open" [size]="14" /> {{ course()!.lessonCount }} leçons</span> }
          @if (learners() > 0) { <span><app-icon name="users" [size]="14" /> {{ learners() }}</span> }
        </div>
      </div>
      <div class="cc-foot">
        @if (status(); as s) {
          <span class="cc-status">{{ s }}</span>
        } @else {
          <span class="price-tag" [class.free]="!item().price">{{ price() }}</span>
        }
        <span class="cc-cta">{{ status() ? 'Continuer' : 'Découvrir' }} <app-icon name="arrow" [size]="14" /></span>
      </div>
    </a>
  `,
})
export class CourseCardComponent {
  readonly item = input.required<CatalogCourse | CatalogProgram>();
  readonly kind = input<'course' | 'program'>('course');
  /** Avancement (inscrit·e) : affiche une barre de progression et remplace le prix. */
  readonly progress = input<number | null>(null);
  readonly status = input<string | null>(null);
  readonly forMe = input(false);
  /** Seuil d'inscrits a partir duquel le contenu est signale comme populaire. */
  readonly popularFrom = input(Number.MAX_SAFE_INTEGER);

  protected isProgram = computed(() => this.kind() === 'program');
  protected course = computed(() => (this.isProgram() ? null : (this.item() as CatalogCourse)));
  protected program = computed(() => (this.isProgram() ? (this.item() as CatalogProgram) : null));
  protected link = computed(() => [this.isProgram() ? '/formations' : '/cours', this.item().id]);
  protected seed = computed(() => this.item().id + (this.isProgram() ? 3 : 0));
  protected level = computed(() => LEVEL_LABELS[this.item().level ?? 'DEBUTANT'] ?? 'Débutant');
  protected dur = computed(() => durationLabel(this.item().totalMinutes));
  protected price = computed(() => priceLabel(this.item().price));
  protected learners = computed(() => this.item().learners ?? 0);

  protected badge = computed(() => {
    if (this.learners() >= this.popularFrom()) return { label: 'Populaire', cls: 'hot' };
    if (this.item().rating >= 4.5 && this.item().ratingCount >= 5) return { label: 'Très bien noté', cls: 'top' };
    const u = (this.item() as CatalogCourse).updatedAt;
    if (u && Date.now() - Date.parse(u) < 30 * 86400_000 && this.learners() < 3) return { label: 'Nouveau', cls: 'new' };
    return null;
  });
}
