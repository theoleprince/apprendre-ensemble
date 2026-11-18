import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { CourseDetail, LEVELS, ROLE_LABELS, courseStatus, durationLabel, priceLabel } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent } from '../shared/visuals';

/** Presentation d'un cours (publique) : ce qu'on apprend, le plan, la certification, et un seul bouton d'action. */
@Component({
  selector: 'app-course',
  imports: [RouterLink, IconComponent, CoverComponent],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (d(); as d) {
      @let c = d.course;
      <nav class="crumbs small"><a routerLink="/catalogue">Catalogue</a> <app-icon name="arrow" [size]="12" /> <span>{{ c.domainName || 'Cours' }}</span></nav>
      <div class="detail">
        <div class="detail-main">
          <section class="detail-hero">
            <div class="tags">
              <span class="tag">Cours</span>
              @if (c.domainName) { <span class="tag grey">{{ c.domainName }}</span> }
              @if (c.hasVideo) { <span class="tag grey"><app-icon name="video" [size]="12" /> Vidéo</span> }
              @if (c.hasAudio) { <span class="tag grey"><app-icon name="headphones" [size]="12" /> Audio</span> }
            </div>
            <h1>{{ c.title }}</h1>
            <p class="lead">{{ c.description }}</p>
            <div class="facts">
              <span><app-icon name="book-open" [size]="16" /> {{ c.lessonCount }} leçons</span>
              <span><app-icon name="clock" [size]="16" /> {{ dur(c.totalMinutes) }}</span>
              @if (c.questionCount) { <span><app-icon name="award" [size]="16" /> Certifiant</span> }
              <span><app-icon name="wifi-off" [size]="16" /> Disponible hors connexion</span>
              @if (c.learners) { <span><app-icon name="users" [size]="16" /> {{ c.learners }} inscrit·es</span> }
            </div>
            @if (c.targetRoles.length) { <p class="small muted">Pour : {{ roles(c.targetRoles) }}</p> }
          </section>

          <section class="section">
            <h2>Comment se déroule ce cours</h2>
            <ol class="how">
              <li><span class="how-n">1</span><div><strong>Leçons courtes</strong><span class="small muted">Texte, audio ou vidéo, à votre rythme</span></div></li>
              <li><span class="how-n">2</span><div><strong>Un quiz après chaque notion</strong><span class="small muted">Pour valider et passer à la suite</span></div></li>
              <li><span class="how-n">3</span><div><strong>Évaluation finale</strong><span class="small muted">{{ d.passScore }} % pour réussir, autant d'essais que nécessaire</span></div></li>
              <li><span class="how-n">4</span><div><strong>Certificat</strong><span class="small muted">PDF vérifiable, à ajouter sur LinkedIn</span></div></li>
            </ol>
          </section>

          <section class="section">
            <h2>Plan du cours</h2>
            <ol class="syllabus">
              @for (l of d.syllabus; track l.id) {
                <li>
                  <span class="sy-n">{{ l.position }}</span>
                  <div style="flex:1;min-width:0">
                    <strong>{{ l.title }}</strong>
                    <div class="xs muted row" style="gap:.6rem">
                      <span><app-icon [name]="l.mediaType === 'VIDEO' ? 'video' : l.mediaType === 'AUDIO' ? 'headphones' : 'text'" [size]="12" /> {{ l.mediaType === 'VIDEO' ? 'Vidéo' : l.mediaType === 'AUDIO' ? 'Audio' : 'Lecture' }} · {{ l.minutes }} min</span>
                      @if (l.checkCount) { <span><app-icon name="lightbulb" [size]="12" /> Quiz</span> }
                      @if (l.practice) { <span><app-icon name="wrench" [size]="12" /> Exercice</span> }
                    </div>
                  </div>
                  @if (mine(); as m) { @if (m.doneLessons >= l.position) { <app-icon name="check-circle" [size]="18" style="color:var(--brand)" /> } }
                </li>
              }
              @if (c.questionCount) {
                <li class="sy-exam"><span class="sy-n"><app-icon name="target" [size]="16" /></span>
                  <div><strong>Évaluation finale</strong><div class="xs muted">{{ c.questionCount }} questions · réussite à {{ d.passScore }} %</div></div></li>
              }
              <li class="sy-exam"><span class="sy-n"><app-icon name="award" [size]="16" /></span><div><strong>Certificat</strong></div></li>
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
        </div>

        <aside class="detail-side">
          <div class="card buy-box">
            <app-cover [icon]="c.icon" [seed]="c.id" [height]="120" [label]="c.title" />
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
              <p class="xs muted center">{{ c.price ? 'Mobile Money, carte ou code de licence' : 'Accès immédiat et illimité' }}</p>
            }
            <ul class="buy-list small">
              <li><app-icon name="check" [size]="14" /> {{ c.lessonCount }} leçons et quiz</li>
              <li><app-icon name="check" [size]="14" /> Évaluation finale et certificat</li>
              <li><app-icon name="check" [size]="14" /> Mentor IA disponible à chaque étape</li>
              <li><app-icon name="check" [size]="14" /> Utilisable sans connexion</li>
            </ul>
          </div>
          @if (d.programs.length) {
            <div class="card flat small">
              <strong>Fait partie de la formation</strong>
              @for (p of d.programs; track p.id) { <a class="row" style="margin-top:.4rem" [routerLink]="['/formations', p.id]"><app-icon name="graduation" [size]="16" /> {{ p.title }}</a> }
            </div>
          }
        </aside>
      </div>
      <div class="mobile-cta">
        <div><strong>{{ price(c.price) }}</strong>@if (mine(); as m) {<div class="xs muted">{{ status(m).percent }} % · {{ status(m).next }}</div>}</div>
        @if (mine(); as m) {
          @if (status(m).key !== 'LOCKED') { <a class="btn primary" [routerLink]="['/apprendre', c.id]">{{ status(m).key === 'TODO' ? 'Commencer' : 'Continuer' }} <app-icon name="arrow" /></a> }
        } @else {
          <button class="primary" (click)="enroll()" [disabled]="busy()">S'inscrire</button>
        }
      </div>
    } @else if (!error()) {
      <div class="skeleton" style="height:420px"></div>
    }
  `,
})
export class CoursePage implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(CatalogApi);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly id = input.required<string>();

  d = signal<CourseDetail | null>(null);
  error = signal('');
  busy = signal(false);
  levels = LEVELS;
  mine = computed(() => this.api.mine()?.courses.find((c) => c.courseId === Number(this.id())) ?? null);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.load(id));
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.auth.isLoggedIn()) await this.api.myLearning().catch(() => undefined);
  }

  private async load(id: number): Promise<void> {
    try {
      this.d.set((await this.api.course(id)).data);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** Gratuit : inscription en un clic puis premiere lecon. Payant : page de paiement. Sans compte : creation de compte d'abord. */
  async enroll(): Promise<void> {
    const c = this.d()!.course;
    const checkout = `/paiement/cours/${c.id}`;
    if (!this.auth.isLoggedIn()) {
      await this.router.navigate(['/inscription'], { queryParams: { redirect: checkout } });
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

  status = courseStatus;
  price = priceLabel;
  dur = durationLabel;

  roles(r: string[]): string {
    return r.map((x) => ROLE_LABELS[x as keyof typeof ROLE_LABELS]).join(', ');
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
