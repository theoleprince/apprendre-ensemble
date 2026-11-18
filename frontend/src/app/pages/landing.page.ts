import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '../core/catalog.service';
import { CatalogProgram, durationLabel, priceLabel } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent, HeroArtComponent } from '../shared/visuals';

/** Accueil public : ce que c'est, comment ca marche en 4 etapes, les formations a la une. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, IconComponent, CoverComponent, HeroArtComponent],
  template: `
    <section class="land-hero">
      <div class="land-copy">
        <span class="tag sun">Formation en ligne et hors connexion</span>
        <h1>Apprenez à votre rythme.<br />Obtenez un certificat reconnu.</h1>
        <p class="lead">Des formations courtes pour les enseignant·es, les parents, les jeunes et les éducateur·trices : leçons en texte, audio ou vidéo, un quiz après chaque notion, un certificat à la fin. Même sans réseau.</p>
        <div class="row">
          <a class="btn primary lg" routerLink="/catalogue"><app-icon name="search" /> Découvrir les formations</a>
          <a class="btn lg" routerLink="/inscription">Créer un compte gratuit</a>
        </div>
        <p class="small muted">Déjà inscrit·e ? <a routerLink="/login">Se connecter</a></p>
      </div>
      <div class="land-art"><app-hero-art /></div>
    </section>

    <section class="section">
      <h2 class="center">Comment ça marche</h2>
      <ol class="steps4">
        <li><span class="s4-ic"><app-icon name="user" [size]="26" /></span><strong>1. Créez votre compte</strong><span class="small muted">Gratuit, en 1 minute.</span></li>
        <li><span class="s4-ic"><app-icon name="search" [size]="26" /></span><strong>2. Choisissez une formation</strong><span class="small muted">Gratuite ou payante, inscription en un clic.</span></li>
        <li><span class="s4-ic"><app-icon name="book-open" [size]="26" /></span><strong>3. Suivez les leçons dans l'ordre</strong><span class="small muted">Un quiz valide chaque notion avant la suivante.</span></li>
        <li><span class="s4-ic"><app-icon name="award" [size]="26" /></span><strong>4. Obtenez votre certificat</strong><span class="small muted">Après l'évaluation finale. Vérifiable et partageable sur LinkedIn.</span></li>
      </ol>
    </section>

    @if (featured().length) {
      <section class="section">
        <div class="section-head"><h2>Formations à la une</h2><a routerLink="/catalogue" class="small">Tout le catalogue</a></div>
        <div class="grid cols-3">
          @for (p of featured(); track p.id) {
            <a class="card course-card cat-card" [routerLink]="['/formations', p.id]">
              <app-cover class="card-cover" [icon]="p.icon" [seed]="p.id + 3" [height]="110" [label]="p.title" />
              <h3>{{ p.title }}</h3>
              <p class="small muted clamp">{{ p.description }}</p>
              <div class="meta"><span><app-icon name="book" [size]="14" /> {{ p.courseCount }} cours</span><span><app-icon name="clock" [size]="14" /> {{ dur(p.totalMinutes) }}</span></div>
              <div class="cat-foot"><span class="price-tag" [class.free]="!p.price">{{ price(p.price) }}</span><span class="link small">Voir <app-icon name="arrow" [size]="14" /></span></div>
            </a>
          }
        </div>
      </section>
    }

    <section class="section feat4">
      <div><app-icon name="wifi-off" [size]="26" /><strong>Sans connexion</strong><span class="small muted">Téléchargez un cours, apprenez partout. La progression s'envoie au retour du réseau.</span></div>
      <div><app-icon name="headphones" [size]="26" /><strong>Texte, audio, vidéo</strong><span class="small muted">Sous-titres, transcriptions et lecture à voix haute.</span></div>
      <div><app-icon name="sparkles" [size]="26" /><strong>Mentor IA</strong><span class="small muted">Une question sur une leçon ? Réponse immédiate, à chaque étape.</span></div>
      <div><app-icon name="users" [size]="26" /><strong>Classes et mentorat</strong><span class="small muted">Suivez une formation en groupe, avec un·e conseiller·ère.</span></div>
    </section>

    <footer class="land-foot small muted">
      <span>Apprendre Ensemble · plateforme de démonstration</span>
      <a routerLink="/catalogue">Catalogue</a>
      <a routerLink="/login">Connexion</a>
    </footer>
  `,
})
export class LandingPage implements OnInit {
  private api = inject(CatalogApi);
  featured = signal<CatalogProgram[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.featured.set((await this.api.catalog()).data.programs.slice(0, 6));
    } catch {
      /* hors ligne : la page reste utile sans la liste */
    }
  }

  price = priceLabel;
  dur = durationLabel;
}
