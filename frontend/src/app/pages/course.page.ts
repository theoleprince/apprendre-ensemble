import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { CourseDetail, LEVELS, LEVEL_LABELS, courseStatus, durationLabel, priceLabel } from '../core/models';
import { ToastService } from '../core/toast.service';
import { AudienceService } from '../core/audience.service';
import { CourseCardComponent } from '../shared/course-card.component';
import { IconComponent } from '../shared/icon.component';
import { DetailBlocksComponent } from '../shared/detail-blocks.component';
import { SiteFooterComponent } from '../shared/site-footer.component';
import { StarsComponent } from '../shared/stars.component';
import { CoverComponent } from '../shared/visuals';

/**
 * Page de presentation d'un cours, a la maniere des grandes plateformes : promesse, note, objectifs,
 * programme detaille, extrait video gratuit, equipe pedagogique, avis, FAQ, cours similaires, un seul bouton d'action.
 */
@Component({
  selector: 'app-course',
  imports: [RouterLink, IconComponent, CoverComponent, StarsComponent, CourseCardComponent, DetailBlocksComponent, SiteFooterComponent],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (d(); as d) {
      @let c = d.course;
      <section class="dhero">
        <div class="dhero-in">
          <nav class="crumbs small" aria-label="Fil d'Ariane"><a routerLink="/catalogue">Catalogue</a> <app-icon name="arrow" [size]="12" />
            <a routerLink="/catalogue" [queryParams]="{ onglet: 'cours', domaine: c.domainId }">{{ c.domainName || 'Cours' }}</a></nav>
          <h1>{{ c.title }}</h1>
          <p class="lead">{{ c.description }}</p>
          <div class="dhero-facts">
            <app-stars [value]="c.rating" [count]="c.ratingCount" [showEmpty]="true" />
            @if (c.learners) { <span><app-icon name="users" [size]="15" /> {{ c.learners }} inscrit·es</span> }
            <span><app-icon name="signal" [size]="15" /> {{ levelLabel(c.level) }}</span>
            <span><app-icon name="clock" [size]="15" /> {{ dur(c.totalMinutes) }}</span>
            <span><app-icon name="globe" [size]="15" /> {{ c.languageCode === 'en' ? 'English' : 'Français' }}</span>
            @if (c.updatedAt) { <span><app-icon name="calendar" [size]="15" /> Mis à jour en {{ month(c.updatedAt) }}</span> }
          </div>
          @if (d.presentation.authorName) { <p class="small dhero-by">Conçu par <strong>{{ d.presentation.authorName }}</strong></p> }
          @if (c.targetRoles.length) { <p class="small dhero-by">Pour : {{ roles(c.targetRoles) }}</p> }
        </div>
      </section>

      <div class="detail">
        <div class="detail-main">
          @if (d.presentation.objectives.length) {
            <section class="card learn-box">
              <h2>Ce que vous apprendrez</h2>
              <ul class="obj-list">@for (o of d.presentation.objectives; track $index) { <li><app-icon name="check" [size]="18" /> {{ o }}</li> }</ul>
            </section>
          }

          <section class="section">
            <div class="section-head">
              <h2>Programme du cours</h2>
              <span class="small muted">{{ d.syllabus.length }} leçons · {{ dur(c.totalMinutes) }} @if (c.questionCount) { · évaluation finale }</span>
            </div>
            <ol class="syllabus">
              @for (l of shownSyllabus(); track l.id) {
                <li>
                  <span class="sy-n">{{ l.position }}</span>
                  <div style="flex:1;min-width:0">
                    <strong>{{ l.title }}</strong>
                    <div class="xs muted row" style="gap:.6rem">
                      <span><app-icon [name]="l.mediaType === 'VIDEO' ? 'video' : l.mediaType === 'AUDIO' ? 'headphones' : 'text'" [size]="12" /> {{ l.mediaType === 'VIDEO' ? 'Vidéo' : l.mediaType === 'AUDIO' ? 'Audio' : 'Lecture' }} · {{ l.minutes }} min</span>
                      @if (l.checkCount) { <span><app-icon name="lightbulb" [size]="12" /> Quiz</span> }
                      @if (l.practice) { <span><app-icon name="wrench" [size]="12" /> Exercice pratique</span> }
                    </div>
                  </div>
                  @if (d.preview && l.mediaType === 'VIDEO' && l.title === d.preview.title) {
                    <button class="btn ghost small-btn" (click)="previewOpen.set(true)"><app-icon name="play" [size]="14" /> Aperçu</button>
                  }
                  @if (mine(); as m) { @if (m.doneLessons >= l.position) { <app-icon name="check-circle" [size]="18" style="color:var(--brand)" /> } }
                </li>
              }
              @if (allShown()) {
                @if (c.questionCount) {
                  <li class="sy-exam"><span class="sy-n"><app-icon name="target" [size]="16" /></span>
                    <div><strong>Évaluation finale</strong><div class="xs muted">{{ c.questionCount }} questions · réussite à {{ d.passScore }} %</div></div></li>
                }
                <li class="sy-exam"><span class="sy-n"><app-icon name="award" [size]="16" /></span><div><strong>Certificat</strong></div></li>
              }
            </ol>
            @if (d.syllabus.length > 6) {
              <button class="btn ghost block" (click)="expanded.set(!expanded())">{{ expanded() ? 'Réduire le programme' : 'Voir les ' + d.syllabus.length + ' leçons' }} <app-icon name="chevron-down" [size]="16" /></button>
            }
          </section>

          @if (d.presentation.prerequisites) {
            <section class="section">
              <h2>Prérequis</h2>
              <p>{{ d.presentation.prerequisites }}</p>
            </section>
          } @else {
            <section class="section">
              <h2>Prérequis</h2>
              <p class="muted">Aucun. Ce cours est accessible à toutes et tous.</p>
            </section>
          }

          <section class="section">
            <h2>Comment se déroule ce cours</h2>
            <ol class="how">
              <li><span class="how-n">1</span><div><strong>Leçons courtes</strong><span class="small muted">Texte, audio ou vidéo, à votre rythme, même sans connexion</span></div></li>
              <li><span class="how-n">2</span><div><strong>Un quiz après chaque notion</strong><span class="small muted">Pour valider et passer à la suite</span></div></li>
              <li><span class="how-n">3</span><div><strong>Évaluation finale</strong><span class="small muted">{{ d.passScore }} % pour réussir, autant d'essais que nécessaire</span></div></li>
              <li><span class="how-n">4</span><div><strong>Certificat</strong><span class="small muted">PDF vérifiable, à ajouter sur LinkedIn</span></div></li>
            </ol>
          </section>

          <section class="section">
            <h2>Certification</h2>
            <div class="levels-list">
              @for (l of levels; track l.key) {
                @if (l.key !== 'EXPERTISE' || d.expertiseEnabled) {
                  <div class="row"><app-icon [name]="l.icon" [size]="20" style="color:var(--brand)" /><div><strong>{{ l.label }}</strong><div class="xs muted">{{ rule(l.key, d) }}</div></div></div>
                }
              }
            </div>
          </section>

          <app-detail-blocks [presentation]="d.presentation" [reviews]="d.reviews" />
        </div>

        <aside class="detail-side">
          <div class="card buy-box">
            <div class="buy-cover" [class.has-preview]="!!d.preview">
              <app-cover [icon]="c.icon" [seed]="c.id" [height]="150" [label]="c.title" />
              @if (d.preview) {
                <button class="preview-btn" (click)="previewOpen.set(true)"><span><app-icon name="play" [size]="26" /></span>Aperçu gratuit</button>
              }
            </div>
            <div class="price" [class.free]="!c.price">{{ price(c.price) }}</div>
            @if (mine(); as m) {
              @let st = status(m);
              <div class="progress"><div [style.width.%]="st.percent"></div></div>
              <p class="small" style="margin:.3rem 0 .8rem"><strong>{{ st.percent }} %</strong> · {{ st.next }}</p>
              @if (st.key === 'LOCKED') {
                <button class="primary block lg" disabled><app-icon name="lock" /> Verrouillé</button>
              } @else {
                <a class="btn primary block lg" [routerLink]="['/apprendre', c.id]">{{ st.key === 'TODO' ? 'Commencer le cours' : st.key === 'DONE' ? 'Revoir le cours' : 'Continuer le cours' }} <app-icon name="arrow" /></a>
              }
              @if (m.programTitle) { <p class="xs muted center">Inclus dans « {{ m.programTitle }} »</p> }
            } @else {
              <button class="primary block lg" (click)="enroll()" [disabled]="busy()">
                {{ busy() ? 'Inscription…' : c.price ? "S'inscrire au cours" : "S'inscrire gratuitement" }}
              </button>
              <p class="xs muted center">{{ c.price ? 'Mobile Money, carte, licence ou abonnement' : 'Accès immédiat et illimité' }}</p>
            }
            <strong class="small" style="margin-top:.4rem">Ce cours comprend</strong>
            <ul class="buy-list small">
              <li><app-icon name="book-open" [size]="15" /> {{ c.lessonCount }} leçons · {{ dur(c.totalMinutes) }}</li>
              @if (c.hasVideo) { <li><app-icon name="video" [size]="15" /> Vidéos sous-titrées</li> }
              @if (c.hasAudio) { <li><app-icon name="headphones" [size]="15" /> Leçons audio</li> }
              <li><app-icon name="lightbulb" [size]="15" /> Un quiz après chaque notion</li>
              <li><app-icon name="award" [size]="15" /> Certificat vérifiable</li>
              <li><app-icon name="wifi-off" [size]="15" /> Utilisable sans connexion</li>
              <li><app-icon name="sparkles" [size]="15" /> Mentor IA à chaque étape</li>
            </ul>
            <button class="btn ghost block" (click)="share()"><app-icon name="share" [size]="16" /> Partager ce cours</button>
          </div>
          @if (d.programs.length) {
            <div class="card flat small">
              <strong>Fait partie de la formation</strong>
              @for (p of d.programs; track p.id) { <a class="row" style="margin-top:.4rem" [routerLink]="['/formations', p.id]"><app-icon name="graduation" [size]="16" /> {{ p.title }}</a> }
            </div>
          }
        </aside>
      </div>

      @if (d.related.length) {
        <section class="section">
          <div class="section-head"><h2>Vous aimerez aussi</h2></div>
          <div class="card-grid">@for (r of d.related; track r.id) { <app-course-card [item]="r" /> }</div>
        </section>
      }

      <div class="mobile-cta">
        <div><strong>{{ price(c.price) }}</strong>@if (mine(); as m) {<div class="xs muted">{{ status(m).percent }} % · {{ status(m).next }}</div>}</div>
        @if (mine(); as m) {
          @if (status(m).key !== 'LOCKED') { <a class="btn primary" [routerLink]="['/apprendre', c.id]">{{ status(m).key === 'TODO' ? 'Commencer' : 'Continuer' }} <app-icon name="arrow" /></a> }
        } @else {
          <button class="primary" (click)="enroll()" [disabled]="busy()">S'inscrire</button>
        }
      </div>

      @if (previewOpen() && d.preview; as pv) {
        <div class="modal-scrim" (click)="previewOpen.set(false)">
          <div class="modal video-modal" role="dialog" aria-modal="true" [attr.aria-label]="'Aperçu : ' + pv.title" (click)="$event.stopPropagation()">
            <div class="row" style="justify-content:space-between">
              <div><span class="xs muted">Aperçu gratuit</span><h3 style="margin:0">{{ pv.title }}</h3></div>
              <button class="icon-btn ghost" (click)="previewOpen.set(false)" aria-label="Fermer"><app-icon name="x" /></button>
            </div>
            <video [src]="pv.mediaUrl" controls autoplay playsinline preload="metadata">
              @if (pv.subtitlesUrl) { <track kind="subtitles" srclang="fr" label="Français" [src]="pv.subtitlesUrl" default /> }
            </video>
          </div>
        </div>
      }
      @if (!auth.isLoggedIn()) { <app-site-footer /> }
    } @else if (!error()) {
      <div class="skeleton" style="height:220px"></div>
      <div class="skeleton" style="height:420px;margin-top:1rem"></div>
    }
  `,
  host: { '(document:keydown.escape)': 'previewOpen.set(false)' },
})
export class CoursePage implements OnInit {
  protected aud = inject(AudienceService);
  protected auth = inject(AuthService);
  private api = inject(CatalogApi);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly id = input.required<string>();

  d = signal<CourseDetail | null>(null);
  error = signal('');
  busy = signal(false);
  expanded = signal(false);
  previewOpen = signal(false);
  levels = LEVELS;
  mine = computed(() => this.api.mine()?.courses.find((c) => c.courseId === Number(this.id())) ?? null);
  shownSyllabus = computed(() => {
    const s = this.d()?.syllabus ?? [];
    return this.expanded() || s.length <= 6 ? s : s.slice(0, 5);
  });
  allShown = computed(() => this.shownSyllabus().length === (this.d()?.syllabus.length ?? 0));

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.load(id));
    });
  }

  async ngOnInit(): Promise<void> {
    void this.aud.load();
    if (this.auth.isLoggedIn()) await this.api.myLearning().catch(() => undefined);
  }

  private async load(id: number): Promise<void> {
    this.d.set(null);
    this.expanded.set(false);
    try {
      this.d.set((await this.api.course(id)).data);
      window.scrollTo({ top: 0 });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** Gratuit : inscription en un clic puis premiere lecon. Payant : page de paiement. Sans compte : creation de compte d'abord. */
  async enroll(): Promise<void> {
    const c = this.d()!.course;
    const checkout = `/paiement/cours/${c.id}`;
    if (!this.auth.isLoggedIn()) {
      await this.router.navigate(['/inscription'], { queryParams: { redirect: c.price ? checkout : `/cours/${c.id}` } });
      return;
    }
    if (c.price) {
      await this.router.navigateByUrl(checkout);
      return;
    }
    this.busy.set(true);
    try {
      await this.api.enroll({ courseId: c.id, method: 'GRATUIT' });
      this.toast.show({ icon: 'check-circle', title: 'Inscription confirmée', text: 'Bonne formation !' }, 3000);
      await this.router.navigate(['/apprendre', c.id]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async share(): Promise<void> {
    const url = location.href;
    const title = this.d()?.course.title ?? '';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        this.toast.show({ icon: 'link', title: 'Lien copié', text: 'Collez-le dans un message pour le partager.' }, 2500);
      }
    } catch {
      /* partage annule */
    }
  }

  status = courseStatus;
  price = priceLabel;
  dur = durationLabel;

  levelLabel(l: string | null | undefined): string {
    return LEVEL_LABELS[(l ?? 'DEBUTANT') as keyof typeof LEVEL_LABELS] ?? 'Débutant';
  }

  month(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  roles(r: string[]): string {
    return this.aud.labels(r);
  }

  rule(k: string, d: CourseDetail): string {
    switch (k) {
      case 'ATTESTATION':
        return 'Suivre toutes les leçons';
      case 'BADGE':
        return `Réussir l'évaluation finale (${d.passScore} %)`;
      case 'MAITRISE':
        return `Obtenir ${d.masteryScore} % à l'évaluation finale`;
      default:
        return 'Faire valider un exercice pratique par un mentor';
    }
  }
}
