import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { AdminCourse, ROLE_LABELS } from '../../core/models';
import { AudienceService } from '../../core/audience.service';
import { IconComponent } from '../../shared/icon.component';
import { CoverComponent } from '../../shared/visuals';

@Component({
  selector: 'app-admin-modules',
  imports: [RouterLink, IconComponent, CoverComponent],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Modules</h1>
      <a class="btn primary" routerLink="/admin/modules/nouveau"><app-icon name="plus" /> Nouveau module</a>
    </div>
    <p class="muted">Ajouter un pays, une langue ou un public = paramétrer un module, sans développement.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <div class="grid cols-3 section">
      @for (c of courses(); track c.id) {
        <article class="card course-card">
          <app-cover class="card-cover" [icon]="c.icon" [seed]="c.id" [height]="84" [label]="c.title" />
          <div class="row">
            <div class="grow" style="flex:1"><h3 style="margin:0">{{ c.title }}</h3><span class="xs muted">v{{ c.contentVersion }} · {{ c.lessonCount }} leçons · {{ c.questionCount }} questions</span></div></div>
          <div class="tags">
            <span class="tag" [class.grey]="!c.published">{{ c.published ? 'Publié' : 'Brouillon' }}</span>
            <span class="tag grey">{{ c.countryCode || 'Tous pays' }} · {{ c.languageCode || 'toutes langues' }}</span>
            @for (g of c.allowedCohorts; track g) { <span class="tag violet">{{ g }}</span> }
          </div>
          <div class="xs muted">{{ roles(c) }}</div>
          <div class="foot">
            <a class="btn" [routerLink]="['/admin/modules', c.id]"><app-icon name="edit" /> Modifier</a>
            <a class="btn ghost" [routerLink]="['/admin/modules', c.id, 'analyse']"><app-icon name="lightbulb" /> Analyse</a>
          </div>
        </article>
      }
    </div>
  `,
})
export class AdminModulesPage implements OnInit {
  protected aud = inject(AudienceService);
  private http = inject(HttpClient);
  courses = signal<AdminCourse[]>([]);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.courses.set(await firstValueFrom(this.http.get<AdminCourse[]>('/api/admin/courses')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  roles(c: AdminCourse): string {
    return this.aud.labels(c.targetRoles);
  }
}
