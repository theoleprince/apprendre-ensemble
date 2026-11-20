import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/icon.component';

interface Integration { key: string; label: string; configured: boolean; mode: string; howTo: string }

/** Ce qui est reellement branche sur cette instance (aucun secret affiche). */
@Component({
  selector: 'app-integrations',
  imports: [IconComponent],
  template: `
    <section class="card">
      <h2><app-icon name="settings" /> État des intégrations</h2>
      <p class="small muted">Services externes de cette instance. Les clés se configurent sur le serveur (variables d'environnement) et ne sont jamais affichées.</p>
      <table>
        @for (i of list(); track i.key) {
          <tr>
            <td><app-icon [name]="i.configured ? 'check-circle' : 'alert'" [size]="18" [style.color]="i.configured ? 'var(--ok)' : 'var(--muted)'" /></td>
            <td><strong>{{ i.label }}</strong><div class="xs muted">{{ i.mode }}</div></td>
            <td class="xs muted">{{ i.configured ? 'Configuré' : i.howTo }}</td>
          </tr>
        }
      </table>
    </section>
  `,
})
export class IntegrationsComponent {
  private http = inject(HttpClient);
  protected list = signal<Integration[]>([]);

  constructor() {
    void firstValueFrom(this.http.get<Integration[]>('/api/admin/integrations')).then((l) => this.list.set(l)).catch(() => undefined);
  }
}
