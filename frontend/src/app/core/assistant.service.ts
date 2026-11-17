import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { LearningService } from './learning.service';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  flagged?: boolean;
  mode?: string;
}

/**
 * Assistant IA present sur tout le parcours. Le contexte (module / lecon a l'ecran) est fourni par les pages.
 * Reponse en streaming (SSE via fetch, pour envoyer le jeton). Hors ligne : recherche dans les modules telecharges.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private auth = inject(AuthService);
  private learning = inject(LearningService);

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly messages = signal<ChatMsg[]>([]);
  readonly context = signal<{ courseId?: number; lessonId?: number; label?: string }>({});

  setContext(ctx: { courseId?: number; lessonId?: number; label?: string }): void {
    this.context.set(ctx);
  }

  reset(): void {
    this.messages.set([]);
  }

  async ask(question: string): Promise<void> {
    const q = question.trim();
    if (!q || this.busy()) return;
    this.messages.update((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    this.busy.set(true);
    try {
      if (!navigator.onLine) {
        await this.offlineAnswer(q);
        return;
      }
      const history = this.messages()
        .slice(0, -1)
        .filter((m) => m.content)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      const ctx = this.context();
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.auth.token()}` },
        body: JSON.stringify({ messages: history, courseId: ctx.courseId ?? null, lessonId: ctx.lessonId ?? null }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const event = /^event:(.*)$/m.exec(block)?.[1]?.trim();
          const data = block
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5))
            .join('\n');
          if (!data) continue;
          const payload = JSON.parse(data);
          if (event === 'delta') this.appendLast(payload.t);
          if (event === 'done') this.patchLast({ flagged: payload.flagged, mode: payload.mode });
        }
      }
    } catch {
      await this.offlineAnswer(q);
    } finally {
      this.busy.set(false);
    }
  }

  private async offlineAnswer(q: string): Promise<void> {
    const hits = await this.learning.searchOffline(q);
    const text = hits.length
      ? 'Hors ligne, voici ce que disent vos modules téléchargés :\n' +
        hits.map((h) => `\n• ${h.text}\n  (${h.course} › ${h.lesson})`).join('')
      : 'Je suis hors ligne et je ne trouve rien dans vos modules téléchargés. Votre question pourra être posée dès le retour du réseau.';
    this.patchLast({ content: text, mode: 'offline' });
  }

  private appendLast(t: string): void {
    this.messages.update((m) => {
      const c = [...m];
      c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + t };
      return c;
    });
  }

  private patchLast(p: Partial<ChatMsg>): void {
    this.messages.update((m) => {
      const c = [...m];
      c[c.length - 1] = { ...c[c.length - 1], ...p };
      return c;
    });
  }
}
