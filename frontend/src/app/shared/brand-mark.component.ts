import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { BrandingService } from '../core/branding.service';
import { IconComponent } from './icon.component';

/** Logo et nom de la plateforme, selon la charte graphique parametree. */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { style: 'display:contents' },
  template: `
    @let b = branding.brand();
    @if (b.logoUrl) {
      <img class="brand-logo" [src]="b.logoUrl" [alt]="showName() ? '' : b.name" />
    } @else {
      <span class="brand-mark" [style.background]="onDark() ? 'rgba(255,255,255,.15)' : null"><app-icon name="sprout" [size]="22" /></span>
    }
    @if (showName()) { <span class="brand-name">{{ b.name }}</span> }
  `,
})
export class BrandMarkComponent {
  protected branding = inject(BrandingService);
  readonly showName = input(true);
  readonly onDark = input(false);
}
