import { BrandMarkComponent } from './brand-mark.component';
import { BrandingService } from '../core/branding.service';
import { inject } from '@angular/core';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';

/** Pied de page des pages publiques : navigation, aide, informations legales. */
@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, BrandMarkComponent],
  template: `
    <footer class="site-foot">
      <div class="sf-grid">
        <div class="sf-brand">
          <a class="brand" routerLink="/"><app-brand-mark /></a>
          <p class="small muted">{{ b().tagline || 'Des formations courtes et certifiantes, en ligne et sans connexion.' }}</p>
          @if (b().organization) { <p class="xs muted">Une initiative de {{ b().organization }}</p> }
        </div>
        <nav aria-label="Apprendre">
          <strong>Apprendre</strong>
          <a routerLink="/catalogue">Catalogue</a>
          <a routerLink="/catalogue" [queryParams]="{ prix: 'gratuit' }">Formations gratuites</a>
          <a routerLink="/inscription">Créer un compte</a>
          <a routerLink="/login">Se connecter</a>
        </nav>
        <nav aria-label="Aide">
          <strong>Aide</strong>
          <a routerLink="/aide">Questions fréquentes</a>
          <a routerLink="/aide" fragment="hors-ligne">Apprendre sans connexion</a>
          <a routerLink="/aide" fragment="certificats">Certificats</a>
          <a routerLink="/a-propos" fragment="contact">Contact</a>
        </nav>
        <nav aria-label="Informations">
          <strong>Informations</strong>
          <a routerLink="/a-propos">À propos</a>
          <a routerLink="/confidentialite">Confidentialité</a>
          <a routerLink="/mentions-legales">Mentions légales</a>
        </nav>
      </div>
      <div class="sf-bottom xs muted">
        <span>© {{ year }} {{ b().organization || b().name }}@if (b().footerNote) { · {{ b().footerNote }} }</span>
        <span><app-icon name="wifi-off" [size]="13" /> Fonctionne sans connexion · <app-icon name="globe" [size]="13" /> Français, English</span>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  protected b = inject(BrandingService).brand;
  protected year = new Date().getFullYear();
}
