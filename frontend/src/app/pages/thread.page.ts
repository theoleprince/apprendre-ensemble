import { LiveJoinComponent } from '../shared/live-join.component';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { ForumPost, ForumThread, ROLE_ICONS, ROLE_LABELS } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/visuals';

@Component({
  selector: 'app-thread',
  imports: [LiveJoinComponent, RouterLink, FormsModule, IconComponent, DatePipe, AvatarComponent],
  template: `
    <a routerLink="/communaute" class="back"><app-icon name="back" [size]="18" /> Communauté</a>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (thread(); as t) {
      <article class="card" [class.live]="!!t.meetingUrl">
        <div class="row"><app-avatar [name]="t.authorName" />
          <div><strong>{{ t.authorName }}</strong><div class="xs muted">{{ labels[t.authorRole] }} · {{ t.createdAt | date: 'dd/MM/yyyy HH:mm' }}</div></div></div>
        <h1 style="margin-top:.8rem">{{ t.title }}</h1>
        @if (t.body) { <p>{{ t.body }}</p> }
        @if (t.meetingUrl) {
          <div class="row"><app-live-join [url]="t.meetingUrl" [title]="t.title" label="Rejoindre la visioconférence" />
            <span class="small muted">{{ t.meetingAt | date: 'EEEE d MMMM, HH:mm' }}</span></div>
        }
      </article>
    }
    <div class="stack section">
      @for (p of posts(); track p.id) {
        <div class="card flat">
          <div class="row"><app-avatar [name]="p.authorName" />
            <div><strong>{{ p.authorName }}</strong><div class="xs muted">{{ labels[p.authorRole] }} · {{ p.createdAt | date: 'dd/MM HH:mm' }}</div></div></div>
          <p style="white-space:pre-wrap">{{ p.body }}</p>
        </div>
      }
    </div>
    <form class="card section" (ngSubmit)="reply()">
      <label>Votre réponse <textarea name="r" rows="3" [(ngModel)]="text" maxlength="4000"></textarea></label>
      <p class="xs muted">Restez bienveillant·e. Ne publiez ni nom, ni photo d'enfant.</p>
      <button class="primary" type="submit" [disabled]="!text.trim() || !learning.online()"><app-icon name="send" /> Répondre</button>
    </form>
  `,
})
export class ThreadPage implements OnInit {
  protected learning = inject(LearningService);
  private http = inject(HttpClient);
  readonly id = input.required<string>();

  labels = ROLE_LABELS;
  icons = ROLE_ICONS;
  thread = signal<ForumThread | null>(null);
  posts = signal<ForumPost[]>([]);
  error = signal('');
  text = '';

  async ngOnInit(): Promise<void> {
    try {
      const all = await firstValueFrom(this.http.get<ForumThread[]>('/api/community/threads'));
      this.thread.set(all.find((t) => t.id === Number(this.id())) ?? null);
      this.posts.set(await firstValueFrom(this.http.get<ForumPost[]>(`/api/community/threads/${this.id()}/posts`)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async reply(): Promise<void> {
    try {
      const p = await firstValueFrom(this.http.post<ForumPost>(`/api/community/threads/${this.id()}/posts`, { body: this.text }));
      this.posts.update((l) => [...l, p]);
      this.text = '';
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
