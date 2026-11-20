import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AudienceService } from '../core/audience.service';
import { CatalogApi } from '../core/catalog.service';
import { EngagementApi } from '../core/engagement.service';
import { Catalog, PublicStats } from '../core/models';
import { CourseCardComponent } from '../shared/course-card.component';
import { IconComponent } from '../shared/icon.component';
import { SiteFooterComponent } from '../shared/site-footer.component';
import { StarsComponent } from '../shared/stars.component';
import { AvatarComponent, HeroArtComponent } from '../shared/visuals';

/** Accueil public : la promesse, la recherche, les chiffres reels, par public, a la une, avis, comment ca marche. */
@Component({
  selector: 'app-landing',
  imports: [FormsModule, RouterLink, IconComponent, HeroArtComponent, CourseCardComponent, SiteFooterComponent, StarsComponent, AvatarComponent],
  template: `
    <section class="land-hero">
      <div class="land-copy">
        <span class="tag sun"><app-icon name="wifi-off" [size]="13" /> En ligne et sans connexion</span>
        <h1>Apprenez à votre rythme.<br /><span class="hl">Obtenez un certificat reconnu.</span></h1>
        <p class="lead">Des formations courtes et pratiques pour les enseignant·es, les parents, les jeunes et les travailleur·ses sociaux : leçons en texte, audio ou vidéo, un quiz après chaque notion, un certificat vérifiable à la fin.</p>
        <form class="hero-search" (ngSubmit)="search()" role="search">
          <app-icon name="search" [size]="20" />
          <input type="search" name="q" [(ngModel)]="q" placeholder="Que voulez-vous apprendre ? Ex. : émotions, conflits…" aria-label="Rechercher une formation" />
          <button class="primary" type="submit">Rechercher</button>
        </form>
        <div class="hero-trust small">
          @if (stats(); as s) {
            @if (s.ratings) { <app-stars [value]="s.rating" [count]="s.ratings" /> }
            <span><app-icon name="users" [size]="15" /> {{ fmt(s.learners) }} apprenant·es</span>
          }
          <span><app-icon name="check-circle" [size]="15" /> Inscription gratuite</span>
        </div>
      </div>
      <div class="land-art"><app-hero-art /></div>
    </section>

    @if (stats(); as s) {
      <section class="stat-band" aria-label="La plateforme en chiffres">
        <div><strong>{{ fmt(s.learners) }}</strong><span>apprenant·es inscrit·es</span></div>
        <div><strong>{{ fmt(s.certificates) }}</strong><span>certificats délivrés</span></div>
        <div><strong>{{ s.courses }}</strong><span>cours disponibles</span></div>
        <div><strong>{{ s.rating ? s.rating.toLocaleString('fr-FR') + ' / 5' : '—' }}</strong><span>satisfaction moyenne</span></div>
      </section>
    }

    <section class="section">
      <div class="section-head"><h2>Pour qui ?</h2></div>
      <div class="aud-grid">
        @for (a of audiences(); track a.code) {
          <a class="aud-tile" routerLink="/catalogue" [queryParams]="{ public: a.code }">
            <span class="aud-ic"><app-icon [name]="a.icon || 'user'" [size]="24" /></span>
            <strong>{{ a.label }}</strong>
            <span class="xs muted">{{ countFor(a.code) }} formation{{ countFor(a.code) > 1 ? 's' : '' }}</span>
          </a>
        }
      </div>
    </section>

    @if (featured().length) {
      <section class="section">
        <div class="section-head"><h2>Formations certifiantes</h2><a routerLink="/catalogue" class="link-strong">Tout le catalogue <app-icon name="arrow" [size]="16" /></a></div>
        <div class="card-grid">
          @for (p of featured(); track p.id) { <app-course-card [item]="p" kind="program" [popularFrom]="popular()" /> }
        </div>
      </section>
    }

    <section class="section how-band">
      <h2>Comment ça marche</h2>
      <ol class="steps4">
        <li><span class="s4-n">1</span><span class="s4-ic"><app-icon name="user" [size]="24" /></span><strong>Créez votre compte</strong><span class="small muted">Gratuit, en une minute.</span></li>
        <li><span class="s4-n">2</span><span class="s4-ic"><app-icon name="search" [size]="24" /></span><strong>Choisissez une formation</strong><span class="small muted">Gratuite, par licence de votre institution ou par Mobile Money.</span></li>
        <li><span class="s4-n">3</span><span class="s4-ic"><app-icon name="book-open" [size]="24" /></span><strong>Apprenez pas à pas</strong><span class="small muted">Une notion, un quiz, puis la suivante. Même hors connexion.</span></li>
        <li><span class="s4-n">4</span><span class="s4-ic"><app-icon name="award" [size]="24" /></span><strong>Obtenez votre certificat</strong><span class="small muted">Vérifiable en ligne et partageable sur LinkedIn.</span></li>
      </ol>
    </section>

    @if (stats()?.testimonials?.length) {
      <section class="section">
        <div class="section-head"><h2>Ce qu'en disent les apprenant·es</h2></div>
        <div class="testi-grid">
          @for (t of stats()!.testimonials.slice(0, 3); track $index) {
            <figure class="testi">
              <app-icon name="quote" [size]="22" />
              <blockquote>{{ t.comment }}</blockquote>
              <figcaption>
                <app-avatar [name]="t.author" [size]="36" />
                <div><strong>{{ t.author }}</strong><div class="xs muted">{{ t.courseTitle }}</div></div>
                <span class="testi-stars" [attr.aria-label]="t.rating + ' sur 5'">{{ '★'.repeat(t.rating) }}</span>
              </figcaption>
            </figure>
          }
        </div>
      </section>
    }

    <section class="section feat4">
      <div><app-icon name="wifi-off" [size]="26" /><strong>Sans connexion</strong><span class="small muted">Téléchargez un cours, apprenez partout. La progression part au retour du réseau.</span></div>
      <div><app-icon name="headphones" [size]="26" /><strong>Texte, audio, vidéo</strong><span class="small muted">Sous-titres, transcriptions et lecture à voix haute.</span></div>
      <div><app-icon name="sparkles" [size]="26" /><strong>Mentor IA</strong><span class="small muted">Une question sur une leçon ? Réponse immédiate, à chaque étape.</span></div>
      <div><app-icon name="users" [size]="26" /><strong>Classes et mentorat</strong><span class="small muted">Suivez une formation en groupe, avec un·e conseiller·ère.</span></div>
    </section>

    <section class="cta-band">
      <div>
        <h2>Prêt·e à commencer ?</h2>
        <p>Créez votre compte gratuit et suivez votre première leçon dès aujourd'hui.</p>
      </div>
      <div class="row">
        <a class="btn sun lg" routerLink="/inscription">Créer mon compte gratuit</a>
        <a class="btn lg ghost-light" routerLink="/catalogue">Voir le catalogue</a>
      </div>
    </section>

    <app-site-footer />
  `,
})
export class LandingPage implements OnInit {
  private api = inject(CatalogApi);
  private engagement = inject(EngagementApi);
  private router = inject(Router);
  protected aud = inject(AudienceService);

  cat = signal<Catalog | null>(null);
  stats = signal<PublicStats | null>(null);
  q = '';

  featured = computed(() => [...(this.cat()?.programs ?? [])].sort((a, b) => b.learners - a.learners).slice(0, 6));
  audiences = computed(() => this.aud.list().filter((a) => this.countFor(a.code) > 0));
  /** Populaire : le quart le plus suivi. */
  popular = computed(() => {
    const l = (this.cat()?.programs ?? []).map((p) => p.learners).sort((a, b) => b - a);
    return l.length >= 4 ? Math.max(1, l[Math.floor(l.length / 4)]) : Number.MAX_SAFE_INTEGER;
  });

  async ngOnInit(): Promise<void> {
    void this.aud.load();
    void this.engagement.stats().then((s) => this.stats.set(s)).catch(() => undefined);
    try {
      this.cat.set((await this.api.catalog()).data);
    } catch {
      /* hors ligne : la page reste utile sans la liste */
    }
  }

  countFor(code: string): number {
    const c = this.cat();
    if (!c) return 0;
    return c.programs.filter((p) => p.targetRoles.includes(code)).length + c.courses.filter((x) => x.targetRoles.includes(code)).length;
  }

  search(): void {
    void this.router.navigate(['/catalogue'], { queryParams: this.q.trim() ? { q: this.q.trim() } : {} });
  }

  fmt(n: number): string {
    return n.toLocaleString('fr-FR');
  }
}
