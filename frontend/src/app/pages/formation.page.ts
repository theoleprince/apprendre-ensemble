import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { LEVELS, LEVEL_LABELS, MyCourse, ProgramPublicDetail, ROLE_LABELS, STATUS_LABELS, courseStatus, durationLabel, frDate, ordinal, priceLabel } from '../core/models';
import { ToastService } from '../core/toast.service';
import { AudienceService } from '../core/audience.service';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent, MedalComponent } from '../shared/visuals';
import { DetailBlocksComponent } from '../shared/detail-blocks.component';
import { SiteFooterComponent } from '../shared/site-footer.component';
import { StarsComponent } from '../shared/stars.component';

/**
 * Une formation (parcours certifiant) : suite de cours a suivre dans l'ordre.
 * Visiteur : presentation et inscription. Inscrit : ou j'en suis, le cours a suivre maintenant, ma classe, mon certificat.
 */
@Component({
  selector: 'app-formation',
  imports: [RouterLink, IconComponent, CoverComponent, MedalComponent, DetailBlocksComponent, SiteFooterComponent, StarsComponent],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (d(); as d) {
      @let p = d.program;
      <section class="dhero">
        <div class="dhero-in">
          <nav class="crumbs small" aria-label="Fil d'Ariane"><a routerLink="/catalogue">Catalogue</a> <app-icon name="arrow" [size]="12" /> <span>Formations certifiantes</span></nav>
          <span class="tag sun">Formation certifiante</span>
          <h1>{{ p.title }}</h1>
          <p class="lead">{{ p.description }}</p>
          <div class="dhero-facts">
            <app-stars [value]="p.rating" [count]="p.ratingCount" [showEmpty]="true" />
            @if (p.learners) { <span><app-icon name="users" [size]="15" /> {{ p.learners }} inscrit·es</span> }
            <span><app-icon name="signal" [size]="15" /> {{ levelLabel(p.level) }}</span>
            <span><app-icon name="book" [size]="15" /> {{ p.courseCount }} cours</span>
            <span><app-icon name="clock" [size]="15" /> {{ dur(p.totalMinutes) }} de contenu</span>
            @if (p.durationLabel) { <span><app-icon name="calendar" [size]="15" /> {{ p.durationLabel }}</span> }
          </div>
          @if (d.presentation.authorName) { <p class="small dhero-by">Conçue par <strong>{{ d.presentation.authorName }}</strong></p> }
          @if (p.targetRoles.length) { <p class="small dhero-by">Pour : {{ roles(p.targetRoles) }}</p> }
        </div>
      </section>
      <div class="detail">
        <div class="detail-main">
          @if (d.presentation.objectives.length) {
            <section class="card learn-box">
              <h2>Ce que vous saurez faire</h2>
              <ul class="obj-list">@for (o of d.presentation.objectives; track $index) { <li><app-icon name="check" [size]="18" /> {{ o }}</li> }</ul>
            </section>
          }
          @if (enrolled(); as me) {
            @if (me.classroom; as c) {
              <a class="card class-banner section" [routerLink]="['/classes', c.id]">
                <div class="class-icon"><app-icon name="users" [size]="24" /></div>
                <div style="flex:1;min-width:0">
                  <div class="xs muted" style="text-transform:uppercase;letter-spacing:.04em">Ma classe · {{ statusLabel(c.status) }}</div>
                  <strong>{{ c.name }}</strong>
                  <div class="small muted">{{ date(c.startDate) }} → {{ date(c.endDate) }} · {{ c.memberCount }} participant·es</div>
                </div>
                @if (c.myRank) { <div class="rank-pill"><strong>{{ rank(c.myRank) }}</strong><span>{{ c.myPoints }} pts</span></div> }
                <app-icon name="arrow" />
              </a>
            }
            @if (me.certificate; as cert) {
              <section class="card cert-card section">
                <app-medal [level]="cert.rank ? 'EXPERTISE' : 'MAITRISE'" [size]="60" />
                <div style="flex:1">
                  <div class="xs muted" style="text-transform:uppercase">Certificat de formation obtenu</div>
                  <strong>{{ cert.rank ? 'Lauréat·e : ' + rank(cert.rank) + ' sur ' + cert.classSize : p.title }}</strong>
                  <div class="row" style="margin-top:.5rem"><a class="btn primary" [href]="'/api/public/certificates/' + cert.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" /> PDF</a></div>
                </div>
              </section>
            }
          }

          <section class="section">
            <h2>Les cours, dans l'ordre</h2>
            <p class="small muted">Chaque cours s'ouvre quand le précédent est validé (évaluation finale réussie).</p>
            <ol class="timeline">
              @for (c of d.courses; track c.id; let i = $index) {
                @let my = myCourse(c.id);
                @let st = my ? status(my) : null;
                <li [class]="'tl-' + (st ? (st.key === 'DONE' ? 'done' : st.key === 'LOCKED' ? 'locked' : st.key === 'TODO' ? 'todo' : 'in_progress') : 'todo')">
                  <span class="tl-dot">
                    @if (st?.key === 'DONE') { <app-icon name="check" [size]="18" /> }
                    @else if (st?.key === 'LOCKED') { <app-icon name="lock" [size]="15" /> }
                    @else { {{ i + 1 }} }
                  </span>
                  <a class="tl-card" [class.locked]="st?.key === 'LOCKED'" [routerLink]="st && st.key !== 'LOCKED' ? ['/apprendre', c.id] : ['/cours', c.id]">
                    <div class="row" style="flex-wrap:nowrap;gap:.6rem">
                      <span class="course-icon" style="width:40px;height:40px"><app-icon [name]="c.icon || 'book-open'" [size]="20" /></span>
                      <div style="flex:1;min-width:0">
                        <strong>{{ c.title }}</strong>
                        <div class="xs muted">{{ c.lessonCount }} leçons · {{ dur(c.totalMinutes) }} @if (c.questionCount) {· évaluation finale}</div>
                      </div>
                      @if (st) { <span class="tag" [class.grey]="st.key === 'LOCKED' || st.key === 'TODO'" [class.sun]="st.key === 'EXAM'">{{ st.label }}</span> }
                    </div>
                    @if (st && st.key !== 'TODO' && st.key !== 'DONE') {
                      <div class="progress" style="margin-top:.5rem"><div [style.width.%]="st.percent"></div></div>
                      <div class="xs muted" style="margin-top:.2rem">{{ st.next }}</div>
                    }
                  </a>
                </li>
              }
              <li class="tl-todo"><span class="tl-dot"><app-icon name="award" [size]="16" /></span>
                <div class="tl-card"><strong>Certificat de formation</strong><div class="xs muted">Délivré quand tous les cours sont validés</div></div></li>
            </ol>
          </section>

          <section class="section">
            <h2>Prérequis</h2>
            <p [class.muted]="!d.presentation.prerequisites">{{ d.presentation.prerequisites || 'Aucun. Cette formation est accessible à toutes et tous.' }}</p>
          </section>

          <app-detail-blocks [presentation]="d.presentation" [reviews]="d.reviews" />
        </div>

        <aside class="detail-side">
          <div class="card buy-box">
            <app-cover [icon]="p.icon" [seed]="p.id + 3" [height]="150" [label]="p.title" />
            <div class="price" [class.free]="!p.price">{{ price(p.price) }}</div>
            @if (enrolled(); as me) {
              <div class="progress"><div [style.width.%]="me.percent"></div></div>
              <p class="small" style="margin:.3rem 0 .8rem"><strong>{{ me.doneCourses }}/{{ me.courseIds.length }}</strong> cours validés</p>
              @if (nextCourse(); as n) {
                <a class="btn primary block lg" [routerLink]="['/apprendre', n.courseId]">{{ me.doneCourses || n.doneLessons ? 'Continuer' : 'Commencer' }} <app-icon name="arrow" /></a>
                <p class="xs muted center">{{ n.title }}</p>
              } @else {
                <a class="btn block lg" routerLink="/certificats"><app-icon name="award" /> Mes certificats</a>
              }
            } @else {
              <button class="primary block lg" (click)="enroll()" [disabled]="busy()">{{ busy() ? 'Inscription…' : p.price ? "S'inscrire à la formation" : "S'inscrire gratuitement" }}</button>
              <p class="xs muted center">{{ p.price ? 'Mobile Money, carte ou code de licence' : 'Financée par le programme' }}</p>
            }
            <ul class="buy-list small">
              <li><app-icon name="check" [size]="14" /> {{ p.courseCount }} cours à suivre dans l'ordre</li>
              <li><app-icon name="check" [size]="14" /> Un quiz après chaque notion</li>
              <li><app-icon name="check" [size]="14" /> Certificat de formation vérifiable</li>
              <li><app-icon name="check" [size]="14" /> Utilisable sans connexion</li>
            </ul>
          </div>
        </aside>
      </div>
      <div class="mobile-cta">
        <div><strong>{{ price(p.price) }}</strong>@if (enrolled(); as me) {<div class="xs muted">{{ me.doneCourses }}/{{ me.courseIds.length }} cours validés</div>}</div>
        @if (enrolled()) {
          @if (nextCourse(); as n) { <a class="btn primary" [routerLink]="['/apprendre', n.courseId]">Continuer <app-icon name="arrow" /></a> }
        } @else {
          <button class="primary" (click)="enroll()" [disabled]="busy()">S'inscrire</button>
        }
      </div>
      @if (!auth.isLoggedIn()) { <app-site-footer /> }
    } @else if (!error()) {
      <div class="skeleton" style="height:220px"></div>
      <div class="skeleton" style="height:420px;margin-top:1rem"></div>
    }
  `,
})
export class FormationPage implements OnInit {
  protected aud = inject(AudienceService);
  protected auth = inject(AuthService);
  private api = inject(CatalogApi);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly id = input.required<string>();

  d = signal<ProgramPublicDetail | null>(null);
  error = signal('');
  busy = signal(false);
  levels = LEVELS;

  enrolled = computed(() => this.api.mine()?.programs.find((p) => p.programId === Number(this.id())) ?? null);
  nextCourse = computed(() => {
    const me = this.enrolled();
    if (!me) return null;
    return me.courseIds.map((id) => this.myCourse(id)).find((c) => c && courseStatus(c).key !== 'DONE') ?? null;
  });

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
      this.d.set((await this.api.program(id)).data);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  myCourse(id: number): MyCourse | null {
    return this.api.mine()?.courses.find((c) => c.courseId === id) ?? null;
  }

  async enroll(): Promise<void> {
    const p = this.d()!.program;
    const checkout = `/paiement/formation/${p.id}`;
    if (!this.auth.isLoggedIn()) return void this.router.navigate(['/inscription'], { queryParams: { redirect: checkout } });
    if (p.price) return void this.router.navigateByUrl(checkout);
    this.busy.set(true);
    try {
      await this.api.enroll({ programId: p.id, method: 'GRATUIT' });
      this.toast.show({ icon: 'check-circle', title: 'Inscription confirmée', text: p.title }, 3000);
      const first = this.d()!.courses[0];
      if (first) await this.router.navigate(['/apprendre', first.id]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  status = courseStatus;
  price = priceLabel;
  dur = durationLabel;
  date = frDate;
  rank = ordinal;

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }

  roles(r: string[]): string {
    return this.aud.labels(r);
  }

  levelLabel(l: string | null | undefined): string {
    return LEVEL_LABELS[(l ?? 'DEBUTANT') as keyof typeof LEVEL_LABELS] ?? 'Débutant';
  }
}
