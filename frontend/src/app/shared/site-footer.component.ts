import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';

/** Pied de page des pages publiques : navigation, aide, informations legales. */
@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <footer class="site-foot">
      <div class="sf-grid">
        <div class="sf-brand">
          <a class="brand" routerLink="/"><span class="brand-mark"><app-icon name="sprout" [size]="22" /></span><span>Apprendre Ensemble</span></a>
          <p class="small muted">Des formations courtes et certifiantes pour celles et ceux qui accompagnent les enfants, en ligne et sans connexion.</p>
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
        <span>© {{ year }} Apprendre Ensemble · plateforme de démonstration</span>
        <span><app-icon name="wifi-off" [size]="13" /> Fonctionne sans connexion · <app-icon name="globe" [size]="13" /> Français, English</span>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  protected year = new Date().getFullYear();
}
