import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { LearningService } from '../core/learning.service';
import { CourseSummary, ForumThread, ROLE_ICONS, ROLE_LABELS } from '../core/models';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-community',
  imports: [RouterLink, FormsModule, IconComponent, DatePipe],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Communauté de pratique</h1>
      <button class="primary" (click)="showForm.set(!showForm())" [disabled]="!learning.online()"><app-icon name="plus" /> Nouvelle discussion</button>
    </div>
    @if (error()) { <p class="error">{{ error() }}</p> }

    @if (showForm()) {
      <form class="card section" (ngSubmit)="create()">
        <label>Sujet <input name="t" [(ngModel)]="form.title" required maxlength="200" /></label>
        <label>Message <textarea name="b" rows="3" [(ngModel)]="form.body" maxlength="4000"></textarea></label>
        <label>Module (facultatif)
          <select name="c" [(ngModel)]="form.courseId"><option [ngValue]="null">Général</option>
            @for (c of courses(); track c.id) { <option [ngValue]="c.id">{{ c.title }}</option> }</select>
        </label>
        @if (auth.isMentor()) {
          <fieldset><legend>🎥 Séance animée (visioconférence)</legend>
            <div class="field-row">
              <label>Lien (Jitsi, BigBlueButton…) <input name="m" [(ngModel)]="form.meetingUrl" placeholder="https://meet.jit.si/…" /></label>
              <label>Date et heure <input type="datetime-local" name="ma" [(ngModel)]="form.meetingAt" /></label>
            </div>
          </fieldset>
        }
        <button class="primary" type="submit" [disabled]="!form.title.trim()">Publier</button>
      </form>
    }

    @if (lives().length) {
      <h2 class="section">Séances en direct</h2>
      @for (t of lives(); track t.id) {
        <div class="card live" style="margin-bottom:.75rem">
          <div class="row"><span class="live-dot"></span><strong>{{ t.meetingAt | date: 'EEEE d MMMM, HH:mm' }}</strong><span class="muted small">animée par {{ t.authorName }}</span></div>
          <h3>{{ t.title }}</h3>
          <div class="row">
            <a class="btn primary" [href]="t.meetingUrl" target="_blank" rel="noopener"><app-icon name="video" /> Rejoindre</a>
            <a class="btn" [routerLink]="['/communaute', t.id]">Discussion ({{ t.replies }})</a>
          </div>
        </div>
      }
    }

    <h2 class="section">Discussions</h2>
    <div class="stack">
      @for (t of others(); track t.id) {
        <a class="card flat thread" [routerLink]="['/communaute', t.id]">
          <span class="avatar-sm" [title]="labels[t.authorRole]">{{ icons[t.authorRole] }}</span>
          <span class="grow" style="flex:1;min-width:0"><strong>{{ t.title }}</strong>
            <br /><span class="xs muted">{{ t.authorName }} · {{ t.lastActivityAt | date: 'dd/MM HH:mm' }} @if (courseName(t.courseId); as cn) {· {{ cn }}}</span></span>
          <span class="tag grey"><app-icon name="chat" [size]="12" /> {{ t.replies }}</span>
        </a>
      } @empty {
        @if (!loading()) { <div class="empty"><div class="big">💬</div>Aucune discussion pour le moment.</div> }
      }
    </div>
  `,
})
export class CommunityPage implements OnInit {
  protected auth = inject(AuthService);
  protected learning = inject(LearningService);
  private http = inject(HttpClient);
  private router = inject(Router);

  labels = ROLE_LABELS;
  icons = ROLE_ICONS;
  threads = signal<ForumThread[]>([]);
  courses = signal<CourseSummary[]>([]);
  loading = signal(true);
  error = signal('');
  showForm = signal(false);
  form = { title: '', body: '', courseId: null as number | null, meetingUrl: '', meetingAt: '' };

  lives = computed(() => this.threads().filter((t) => t.meetingUrl && t.meetingAt && Date.parse(t.meetingAt) > Date.now() - 3600_000));
  others = computed(() => this.threads().filter((t) => !this.lives().includes(t)));

  async ngOnInit(): Promise<void> {
    try {
      this.threads.set(await firstValueFrom(this.http.get<ForumThread[]>('/api/community/threads')));
      this.courses.set((await this.learning.courses()).list);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  courseName(id: number | null): string | null {
    return id == null ? null : (this.courses().find((c) => c.id === id)?.title ?? null);
  }

  async create(): Promise<void> {
    try {
      const t = await firstValueFrom(
        this.http.post<ForumThread>('/api/community/threads', {
          title: this.form.title,
          body: this.form.body,
          courseId: this.form.courseId,
          meetingUrl: this.form.meetingUrl || null,
          meetingAt: this.form.meetingAt ? new Date(this.form.meetingAt).toISOString() : null,
        }),
      );
      await this.router.navigate(['/communaute', t.id]);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
