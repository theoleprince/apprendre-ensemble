import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { TranslatePipe } from '../core/i18n';
import { LearningService } from '../core/learning.service';
import { CourseSummary, LEVELS, formatBytes } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';

type Filter = 'all' | 'reco' | 'progress' | 'done' | 'offline';

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <h1>Modules</h1>
    <div class="chips" role="tablist">
      @for (f of filters; track f.key) {
        <button [class.active]="filter() === f.key" (click)="filter.set(f.key)">{{ f.label }}</button>
      }
    </div>
    @if (fromCache()) { <p class="notice section"><app-icon name="wifi-off" /> Liste enregistrée sur l'appareil.</p> }
    @if (error()) { <p class="error">{{ error() }}</p> }

    <div class="grid cols-3 section">
      @for (c of shown(); track c.id) {
        <article class="card course-card">
          <div class="row" style="align-items:flex-start">
            <span class="course-icon">{{ c.icon || '📘' }}</span>
            <div class="grow">
              <div class="tags">
                <span class="tag" [class.sun]="c.type === 'PRATIQUE'">{{ c.type === 'PRATIQUE' ? 'Pratique (LXP)' : 'Théorique (LMS)' }}</span>
                @if (c.recommended) { <span class="tag violet">✨ Pour vous</span> }
              </div>
              <h3><a [routerLink]="['/modules', c.id]" [queryParams]="{ v: c.contentVersion }">{{ c.title }}</a></h3>
            </div>
          </div>
          <p class="small muted" style="margin:0">{{ c.description }}</p>
          <div class="meta">
            <span><app-icon name="book" [size]="14" /> {{ c.lessonCount }} leçons</span>
            <span><app-icon name="clock" [size]="14" /> {{ c.totalMinutes }} min</span>
            @if (c.mediaBytes) { <span><app-icon name="download" [size]="14" /> {{ size(c.mediaBytes) }}</span> }
          </div>
          <div class="progress"><div [style.width.%]="pct(c)"></div></div>
          @if (c.levels.length) {
            <div class="tags">@for (l of c.levels; track l) { <span class="tag sun">{{ medal(l) }}</span> }</div>
          }
          <div class="foot">
            <a class="btn primary" [routerLink]="['/modules', c.id]" [queryParams]="{ v: c.contentVersion }">
              {{ (done(c) > 0 ? 'action.continue' : 'action.start') | t }}
            </a>
            @if (learning.downloaded().has(c.id)) {
              <span class="tag"><app-icon name="check" [size]="12" /> {{ 'action.downloaded' | t }}</span>
              <button class="ghost icon-btn" title="Retirer de l'appareil" (click)="learning.removeDownload(c.id)"><app-icon name="trash" [size]="18" /></button>
            } @else {
              <button class="dl-bar" [style.--dl.%]="(busy()[c.id] ?? 0) * 100" (click)="download(c)" [disabled]="busy()[c.id] !== undefined || !learning.online()">
                <app-icon name="download" [size]="18" />
                {{ busy()[c.id] !== undefined ? Math.round((busy()[c.id] ?? 0) * 100) + ' %' : ('action.download' | t) }}
              </button>
            }
          </div>
        </article>
      } @empty {
        @if (loading()) { <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div> }
        @else { <div class="empty"><div class="big">🔍</div>Aucun module dans cette catégorie.</div> }
      }
    </div>
  `,
})
export class CatalogPage implements OnInit {
  protected learning = inject(LearningService);
  private toast = inject(ToastService);
  protected Math = Math;

  filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'reco', label: '✨ Recommandés' },
    { key: 'progress', label: 'En cours' },
    { key: 'done', label: 'Terminés' },
    { key: 'offline', label: 'Hors ligne' },
  ];
  filter = signal<Filter>('all');
  courses = signal<CourseSummary[]>([]);
  fromCache = signal(false);
  loading = signal(true);
  error = signal('');
  busy = signal<Record<number, number>>({});

  shown = computed(() => {
    const f = this.filter();
    return this.courses().filter((c) => {
      const d = this.done(c);
      switch (f) {
        case 'reco': return c.recommended;
        case 'progress': return d > 0 && d < c.lessonCount;
        case 'done': return c.lessonCount > 0 && d >= c.lessonCount;
        case 'offline': return this.learning.downloaded().has(c.id);
        default: return true;
      }
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      const { list, fromCache } = await this.learning.courses();
      this.courses.set(list);
      this.fromCache.set(fromCache);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  done(c: CourseSummary): number {
    return Math.max(c.completedLessons, this.learning.localDoneCount(c.id));
  }

  pct(c: CourseSummary): number {
    return c.lessonCount ? Math.round((this.done(c) * 100) / c.lessonCount) : 0;
  }

  size(b: number): string {
    return formatBytes(b);
  }

  medal(l: string): string {
    const x = LEVELS.find((v) => v.key === l);
    return x ? `${x.icon} ${x.short}` : l;
  }

  async download(c: CourseSummary): Promise<void> {
    this.busy.update((b) => ({ ...b, [c.id]: 0 }));
    try {
      await this.learning.download(c.id, (r) => this.busy.update((b) => ({ ...b, [c.id]: r })));
      this.toast.show({ icon: '📥', title: 'Disponible hors ligne', text: c.title });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.update((b) => {
        const n = { ...b };
        delete n[c.id];
        return n;
      });
    }
  }
}
