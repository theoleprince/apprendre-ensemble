import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';

interface CertAdmin {
  code: string;
  kind: string;
  title: string;
  levelLabel: string;
  learnerName: string;
  learnerId: number;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  revokedBy: string | null;
}

/** Recherche et revocation des certificats (fraude, erreur d'attribution). */
@Component({
  selector: 'app-certificates-admin',
  imports: [FormsModule, DatePipe, RouterLink, IconComponent],
  template: `
    <h1>Certificats</h1>
    <p class="muted">Un certificat révoqué reste vérifiable (avec la mention « révoqué » et le motif) mais n'est plus téléchargeable et ne compte plus pour les certificats de formation.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <div class="search"><app-icon name="search" [size]="18" />
      <input type="search" [(ngModel)]="q" name="q" placeholder="Code du certificat ou nom de la personne" (keyup.enter)="load()" /></div>
    <div class="table-wrap card flat">
      <table>
        <thead><tr><th>Code</th><th>Personne</th><th class="opt">Intitulé</th><th class="opt">Délivré</th><th>État</th><th></th></tr></thead>
        <tbody>
          @for (c of items(); track c.code) {
            <tr>
              <td><a [routerLink]="['/verifier', c.code]" class="kbd">{{ c.code }}</a></td>
              <td>{{ c.learnerName }}</td>
              <td class="small opt">{{ c.levelLabel }} · {{ c.title }}</td>
              <td class="small muted opt">{{ c.issuedAt | date: 'dd/MM/yyyy' }}</td>
              <td>
                @if (c.revokedAt) { <span class="tag clay">Révoqué</span><div class="xs muted">{{ c.revokedReason }}</div> }
                @else { <span class="tag">Valide</span> }
              </td>
              <td class="nowrap">
                @if (c.revokedAt) { <button class="ghost" (click)="restore(c)">Rétablir</button> }
                @else { <button class="ghost danger" (click)="revoke(c)"><app-icon name="x" [size]="16" /> Révoquer</button> }
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="muted center">Aucun certificat trouvé.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class CertificatesAdminPage implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  items = signal<CertAdmin[]>([]);
  error = signal('');
  q = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.http.get<CertAdmin[]>('/api/admin/certificates', { params: { q: this.q.trim() } })));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async revoke(c: CertAdmin): Promise<void> {
    const reason = window.prompt(`Motif de la révocation du certificat ${c.code} (${c.learnerName}) :`);
    if (!reason?.trim()) return;
    await this.run(() => firstValueFrom(this.http.post(`/api/admin/certificates/${c.code}/revoke`, { reason: reason.trim() })), 'Certificat révoqué');
  }

  async restore(c: CertAdmin): Promise<void> {
    await this.run(() => firstValueFrom(this.http.post(`/api/admin/certificates/${c.code}/restore`, {})), 'Certificat rétabli');
  }

  private async run(fn: () => Promise<unknown>, ok: string): Promise<void> {
    try {
      await fn();
      this.toast.show({ icon: 'check-circle', title: ok }, 2500);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
