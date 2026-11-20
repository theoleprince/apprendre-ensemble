import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Note sur 5 avec remplissage partiel (ex. 4,3). Le chiffre et le nombre d'avis restent lisibles sans les etoiles. */
@Component({
  selector: 'app-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (count() > 0 || showEmpty()) {
      <span class="stars-line" [attr.aria-label]="label()">
        @if (count() > 0) { <strong class="stars-val">{{ shown() }}</strong> }
        <span class="stars-track" aria-hidden="true" [style.--sz.px]="size()">
          <span class="stars-fill" [style.width.%]="value() * 20"></span>
        </span>
        @if (count() > 0) { <span class="stars-n">({{ count() }})</span> } @else { <span class="stars-n">Pas encore d'avis</span> }
      </span>
    }
  `,
})
export class StarsComponent {
  readonly value = input(0);
  readonly count = input(0);
  readonly size = input(14);
  readonly showEmpty = input(false);
  protected shown = computed(() => this.value().toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  protected label = computed(() => (this.count() ? `Note ${this.shown()} sur 5, ${this.count()} avis` : "Pas encore d'avis"));
}
