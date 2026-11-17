import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
  celebrate?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(t: Omit<Toast, 'id'>, ms = 5000): void {
    const id = ++this.seq;
    this.toasts.update((l) => [...l, { ...t, id }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number): void {
    this.toasts.update((l) => l.filter((x) => x.id !== id));
  }
}
