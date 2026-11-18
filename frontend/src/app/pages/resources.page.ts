import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { ResourceItem } from '../core/models';
import { ProgramApi } from '../core/program.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { MarkdownPipe } from '../shared/markdown.pipe';
import { SpeakButtonComponent } from '../shared/speak-button.component';

/** Fiches pratiques : consultables hors ligne, lisibles a voix haute, imprimables et partageables. */
@Component({
  selector: 'app-resources',
  imports: [RouterLink, IconComponent, MarkdownPipe, SpeakButtonComponent],
  template: `
    @if (current(); as r) {
      <a routerLink="/fiches" class="back"><app-icon name="back" [size]="18" /> Fiches pratiques</a>
      <article class="card fiche">
        <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
          <span class="course-icon"><app-icon [name]="r.icon || 'file'" [size]="26" /></span>
          <div style="flex:1">
            <div class="xs muted" style="text-transform:uppercase;letter-spacing:.04em">{{ r.domainName }}</div>
            <h1 style="margin:.2rem 0">{{ r.title }}</h1>
            <p class="muted small" style="margin:0">{{ r.summary }}</p>
          </div>
        </div>
        <div class="row section no-print">
          <app-speak [text]="r.title + '. ' + (r.content || '')" [label]="true" />
          <button (click)="print()"><app-icon name="file" /> Imprimer</button>
          @if (canShare) { <button (click)="share(r)"><app-icon name="send" /> Partager</button> }
        </div>
        <div class="content reading" [innerHTML]="r.content | markdown"></div>
      </article>
    } @else {
      <h1>Fiches pratiques</h1>
      <p class="muted">À garder sur votre téléphone, à imprimer ou à partager. Elles restent disponibles sans connexion.</p>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <div class="chips section">
        <button [class.active]="!domain()" (click)="domain.set(null)">Toutes</button>
        @for (d of domains(); track d) { <button [class.active]="domain() === d" (click)="domain.set(d)">{{ d }}</button> }
      </div>
      <div class="grid cols-3">
        @for (r of shown(); track r.id) {
          <a class="card fiche-card" [routerLink]="['/fiches', r.id]">
            <span class="course-icon"><app-icon [name]="r.icon || 'file'" [size]="24" /></span>
            <div>
              <strong>{{ r.title }}</strong>
              <div class="small muted">{{ r.summary }}</div>
              <div class="xs muted" style="margin-top:.3rem">{{ r.domainName }}</div>
            </div>
          </a>
        } @empty {
          @if (!loading()) { <div class="empty"><div class="empty-icon"><app-icon name="file" [size]="30" /></div>Aucune fiche pour le moment.</div> }
        }
      </div>
    }
  `,
})
export class ResourcesPage implements OnInit {
  private api = inject(ProgramApi);
  private toast = inject(ToastService);
  readonly id = input<string | undefined>(undefined);
  readonly canShare = typeof navigator.share === 'function';

  items = signal<ResourceItem[]>([]);
  loading = signal(true);
  error = signal('');
  domain = signal<string | null>(null);
  domains = computed(() => [...new Set(this.items().map((r) => r.domainName).filter((d): d is string => !!d))]);
  shown = computed(() => this.items().filter((r) => !this.domain() || r.domainName === this.domain()));
  current = computed(() => (this.id() ? (this.items().find((r) => r.id === Number(this.id())) ?? null) : null));

  async ngOnInit(): Promise<void> {
    try {
      this.items.set((await this.api.resources()).data);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  print(): void {
    window.print();
  }

  async share(r: ResourceItem): Promise<void> {
    try {
      await navigator.share({ title: r.title, text: `${r.title}\n\n${(r.content ?? '').replace(/\*\*/g, '')}` });
    } catch {
      this.toast.show({ icon: 'alert', title: 'Partage annulé' }, 2000);
    }
  }
}
