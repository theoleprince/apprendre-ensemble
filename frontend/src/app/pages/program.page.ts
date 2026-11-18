import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { LEVELS, ProgramDetail, STATUS_LABELS, frDate, ordinal } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent, MedalComponent } from '../shared/visuals';

/** Un parcours : frise des modules (fait, en cours, a faire, ferme jusqu'au...), classe, certificat de parcours. */
@Component({
  selector: 'app-program',
  imports: [RouterLink, IconComponent, CoverComponent, MedalComponent],
  template: `
    <a routerLink="/parcours" class="back"><app-icon name="back" [size]="18" /> Mes parcours</a>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (p(); as p) {
      <section class="program-hero card">
        <app-cover class="program-cover" [icon]="p.icon" [seed]="p.id + 3" [height]="140" [label]="p.title" />
        <div class="program-body">
          <div class="tags">@for (d of p.domains; track d) { <span class="tag grey">{{ d }}</span> }</div>
          <h1 style="margin:.4rem 0 .3rem">{{ p.title }}</h1>
          <p class="muted" style="margin:0">{{ p.description }}</p>
          <div class="row" style="margin-top:.8rem;flex-wrap:nowrap">
            <div class="progress" style="flex:1"><div [style.width.%]="percent()"></div></div>
            <span class="small nowrap"><strong>{{ done() }}/{{ p.modules.length }}</strong> modules</span>
          </div>
          <p class="xs muted">Certificat de parcours : niveau « {{ levelLabel(p.requiredLevel) }} » dans chaque module.</p>
          @if (next(); as n) {
            <a class="btn primary lg" [routerLink]="['/modules', n.courseId, 'reprendre']"><app-icon name="play" /> {{ done() || inProgress() ? 'Continuer' : 'Commencer' }} : {{ n.title }}</a>
          }
        </div>
      </section>

      @if (p.classroom; as c) {
        <a class="card class-banner section" [routerLink]="['/classes', c.id]">
          <div class="class-icon"><app-icon name="users" [size]="24" /></div>
          <div style="flex:1;min-width:0">
            <div class="xs muted" style="text-transform:uppercase;letter-spacing:.04em">Ma classe · {{ statusLabel(c.status) }}</div>
            <strong>{{ c.name }}</strong>
            <div class="small muted">{{ date(c.startDate) }} → {{ date(c.endDate) }} · {{ c.memberCount }} participant·es @if (c.facilitatorName) {· animée par {{ c.facilitatorName }}}</div>
            @if (c.status === 'ACTIVE') {
              <div class="weeks">@for (w of weeks(c.totalWeeks); track w) {<span [class.on]="w <= c.week"></span>}</div>
            }
          </div>
          @if (c.myRank) { <div class="rank-pill"><strong>{{ rank(c.myRank) }}</strong><span>{{ c.myPoints }} pts</span></div> }
          <app-icon name="arrow" />
        </a>
      }

      @if (p.certificate; as cert) {
        <section class="card cert-card section">
          <app-medal [level]="cert.rank ? 'EXPERTISE' : 'MAITRISE'" [size]="60" />
          <div style="flex:1">
            <div class="xs muted" style="text-transform:uppercase">Certificat de parcours @if (cert.rank) {· Lauréat·e}</div>
            <strong>{{ cert.rank ? rank(cert.rank) + ' sur ' + cert.classSize + ' · ' + cert.points + ' points' : 'Parcours terminé' }}</strong>
            <div class="row" style="margin-top:.5rem">
              <a class="btn primary" [href]="'/api/public/certificates/' + cert.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" /> PDF</a>
              <a class="btn ghost" [routerLink]="['/verifier', cert.code]"><app-icon name="shield" /> Vérifier</a>
            </div>
          </div>
        </section>
      }

      <h2 class="section">Les modules</h2>
      <ol class="timeline">
        @for (m of p.modules; track m.courseId; let i = $index) {
          <li [class]="'tl-' + m.state.toLowerCase()">
            <span class="tl-dot">
              @switch (m.state) {
                @case ('DONE') { <app-icon name="check" [size]="18" /> }
                @case ('LOCKED') { <app-icon name="clock" [size]="16" /> }
                @default { {{ i + 1 }} }
              }
            </span>
            @if (m.state === 'LOCKED') {
              <div class="tl-card locked">
                <strong>{{ m.title }}</strong>
                <div class="small muted">Ouvre le {{ date(m.unlockDate) }} pour votre classe</div>
              </div>
            } @else {
              <a class="tl-card" [routerLink]="['/modules', m.courseId]">
                <div class="row" style="flex-wrap:nowrap;gap:.6rem">
                  <span class="course-icon" style="width:40px;height:40px"><app-icon [name]="m.icon || 'book-open'" [size]="20" /></span>
                  <div style="flex:1;min-width:0">
                    <strong>{{ m.title }}</strong>
                    <div class="xs muted">{{ m.domainName }} · {{ m.lessonCount }} leçons · {{ m.totalMinutes }} min @if (m.type === 'PRATIQUE') {· pratique}</div>
                  </div>
                </div>
                @if (m.state === 'IN_PROGRESS') {
                  <div class="progress" style="margin-top:.5rem"><div [style.width.%]="(m.completedLessons * 100) / m.lessonCount"></div></div>
                }
                @if (m.levels.length) {
                  <div class="tags" style="margin-top:.4rem">@for (l of m.levels; track l) { <span class="tag sun"><app-icon [name]="levelIcon(l)" [size]="12" /> {{ levelShort(l) }}</span> }</div>
                }
              </a>
            }
          </li>
        }
      </ol>
    } @else if (!error()) {
      <div class="skeleton" style="height:320px"></div>
    }
  `,
})
export class ProgramPage implements OnInit {
  private api = inject(ProgramApi);
  readonly id = input.required<string>();
  p = signal<ProgramDetail | null>(null);
  error = signal('');

  done = computed(() => this.p()?.modules.filter((m) => m.state === 'DONE').length ?? 0);
  inProgress = computed(() => this.p()?.modules.some((m) => m.state === 'IN_PROGRESS') ?? false);
  percent = computed(() => (this.p()?.modules.length ? Math.round((this.done() * 100) / this.p()!.modules.length) : 0));
  next = computed(() => this.p()?.modules.find((m) => m.state === 'IN_PROGRESS' || m.state === 'TODO') ?? null);

  async ngOnInit(): Promise<void> {
    try {
      this.p.set((await this.api.program(Number(this.id()))).data);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  weeks(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  date(d: string | null): string {
    return frDate(d);
  }

  rank(n: number): string {
    return ordinal(n);
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }

  levelLabel(l: string): string {
    return LEVELS.find((x) => x.key === l)?.label.toLowerCase() ?? l;
  }

  levelShort(l: string): string {
    return LEVELS.find((x) => x.key === l)?.short ?? l;
  }

  levelIcon(l: string): string {
    return LEVELS.find((x) => x.key === l)?.icon ?? 'award';
  }
}
