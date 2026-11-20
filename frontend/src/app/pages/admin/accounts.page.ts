import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/auth.interceptor';
import { ROLE_LABELS, Role, School } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';

interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  countryCode: string | null;
  languageCode: string | null;
  region: string | null;
  schoolId: number | null;
  schoolName: string | null;
  cohort: string | null;
  enabled: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

const ROLES: Role[] = ['ENSEIGNANT', 'CONSEILLER_PEDAGOGIQUE', 'DIRECTION_ECOLE', 'PARENT', 'TRAVAILLEUR_SOCIAL', 'JEUNE', 'FORMATEUR', 'ADMIN'];

/** Gestion des comptes : recherche, creation, modification, desactivation, lien de reinitialisation, effacement. */
@Component({
  selector: 'app-accounts',
  imports: [FormsModule, DatePipe, IconComponent],
  template: `
    <h1>Comptes</h1>
    <p class="muted">Créer les comptes des mentors et de l'équipe, corriger un profil, désactiver un accès, remettre un lien de mot de passe, effacer un compte (droit à l'effacement).</p>
    @if (error()) { <p class="error">{{ error() }}</p> }

    <div class="filters">
      <div class="search" style="flex:1;margin:0"><app-icon name="search" [size]="18" />
        <input type="search" [(ngModel)]="q" name="q" placeholder="Nom ou e-mail" (keyup.enter)="load(0)" /></div>
      <select [(ngModel)]="role" name="role" (change)="load(0)"><option value="">Tous les rôles</option>@for (r of roles; track r) {<option [value]="r">{{ labels[r] }}</option>}</select>
      <select [(ngModel)]="status" name="status" (change)="load(0)"><option value="">Tous</option><option value="true">Actifs</option><option value="false">Désactivés</option></select>
      <button class="primary" (click)="startNew()"><app-icon name="plus" /> Nouveau compte</button>
    </div>

    @if (link(); as l) {
      <div class="notice info section">
        <strong>Lien de réinitialisation</strong> (valable jusqu'au {{ l.expiresAt | date: 'dd/MM HH:mm' }}) à remettre à la personne :
        <div class="row" style="margin-top:.4rem"><input readonly [value]="l.url" style="flex:1" /><button (click)="copy(l.url)"><app-icon name="link" /> Copier</button></div>
      </div>
    }

    @if (form) {
      <form class="card section" (ngSubmit)="save()">
        <h3>{{ editId ? 'Modifier le compte' : 'Nouveau compte' }}</h3>
        <div class="field-row">
          <label>Nom complet <input name="fn" [(ngModel)]="form.fullName" required /></label>
          <label>E-mail <input type="email" name="em" [(ngModel)]="form.email" required /></label>
          <label>Rôle <select name="ro" [(ngModel)]="form.role">@for (r of roles; track r) {<option [value]="r">{{ labels[r] }}</option>}</select></label>
        </div>
        <div class="field-row">
          <label>Zone <input name="rg" [(ngModel)]="form.region" placeholder="ex. Borgou" /></label>
          <label>Établissement <select name="sc" [(ngModel)]="form.schoolId"><option [ngValue]="null">—</option>@for (s of schools(); track s.id) {<option [ngValue]="s.id">{{ s.name }}</option>}</select></label>
          <label>Groupe (RCT) <input name="co" [(ngModel)]="form.cohort" placeholder="TRAITEMENT / CONTROLE" /></label>
        </div>
        @if (!editId) {
          <label>Mot de passe initial (facultatif : sinon, remettez un lien de réinitialisation)
            <input type="password" name="pw" [(ngModel)]="form.password" minlength="8" autocomplete="new-password" /></label>
        }
        <div class="row"><button class="primary" type="submit">Enregistrer</button><button type="button" class="ghost" (click)="form = null">Annuler</button></div>
      </form>
    }

    <div class="table-wrap card flat section">
      <table>
        <thead><tr><th>Personne</th><th>Rôle</th><th class="opt">Zone / école</th><th class="opt">Dernière activité</th><th>État</th><th></th></tr></thead>
        <tbody>
          @for (u of items(); track u.id) {
            <tr>
              <td><strong>{{ u.fullName }}</strong><div class="xs muted">{{ u.email }}</div></td>
              <td class="small">{{ labels[u.role] }}</td>
              <td class="small opt">{{ u.region }} @if (u.schoolName) {· {{ u.schoolName }}}</td>
              <td class="small muted opt">{{ u.lastActiveAt ? (u.lastActiveAt | date: 'dd/MM/yyyy') : '—' }}</td>
              <td><span class="tag" [class.grey]="!u.enabled">{{ u.enabled ? 'Actif' : 'Désactivé' }}</span></td>
              <td class="nowrap">
                <button class="ghost icon-btn" title="Modifier" (click)="edit(u)"><app-icon name="edit" [size]="18" /></button>
                <button class="ghost icon-btn" title="Lien de réinitialisation du mot de passe" (click)="resetLink(u)" [disabled]="!u.enabled"><app-icon name="link" [size]="18" /></button>
                <button class="ghost icon-btn" [title]="u.enabled ? 'Désactiver' : 'Réactiver'" (click)="toggle(u)"><app-icon [name]="u.enabled ? 'lock' : 'check-circle'" [size]="18" /></button>
                <button class="ghost icon-btn danger" title="Effacer le compte" (click)="erase(u)"><app-icon name="trash" [size]="18" /></button>
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="muted center">Aucun compte.</td></tr> }
        </tbody>
      </table>
    </div>
    <div class="row" style="justify-content:space-between">
      <span class="small muted">{{ total() }} compte(s)</span>
      <div class="row">
        <button (click)="load(page() - 1)" [disabled]="page() === 0"><app-icon name="back" /></button>
        <span class="small">Page {{ page() + 1 }} / {{ pages() }}</span>
        <button (click)="load(page() + 1)" [disabled]="page() + 1 >= pages()"><app-icon name="arrow" /></button>
      </div>
    </div>
  `,
})
export class AccountsPage implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  labels = ROLE_LABELS;
  roles = ROLES;
  items = signal<AdminUser[]>([]);
  total = signal(0);
  page = signal(0);
  pages = signal(1);
  schools = signal<School[]>([]);
  error = signal('');
  link = signal<{ url: string; expiresAt: string } | null>(null);
  q = '';
  role = '';
  status = '';
  form: { email: string; fullName: string; role: Role; region: string; schoolId: number | null; cohort: string; password: string } | null = null;
  editId: number | null = null;

  async ngOnInit(): Promise<void> {
    await this.load(0);
    this.schools.set(await firstValueFrom(this.http.get<School[]>('/api/admin/schools')).catch(() => []));
  }

  async load(p: number): Promise<void> {
    let params = new HttpParams().set('page', p).set('size', 30);
    if (this.q.trim()) params = params.set('q', this.q.trim());
    if (this.role) params = params.set('role', this.role);
    if (this.status) params = params.set('enabled', this.status);
    try {
      const r = await firstValueFrom(this.http.get<{ items: AdminUser[]; total: number; page: number; size: number }>('/api/admin/accounts', { params }));
      this.items.set(r.items);
      this.total.set(r.total);
      this.page.set(r.page);
      this.pages.set(Math.max(1, Math.ceil(r.total / r.size)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  startNew(): void {
    this.editId = null;
    this.form = { email: '', fullName: '', role: 'CONSEILLER_PEDAGOGIQUE', region: '', schoolId: null, cohort: '', password: '' };
  }

  edit(u: AdminUser): void {
    this.editId = u.id;
    this.form = { email: u.email, fullName: u.fullName, role: u.role, region: u.region ?? '', schoolId: u.schoolId, cohort: u.cohort ?? '', password: '' };
  }

  async save(): Promise<void> {
    if (!this.form) return;
    const body = { ...this.form, countryCode: 'BJ', languageCode: 'fr', password: this.form.password || null };
    await this.run(() => (this.editId
      ? firstValueFrom(this.http.put(`/api/admin/accounts/${this.editId}`, body))
      : firstValueFrom(this.http.post('/api/admin/accounts', body))), 'Compte enregistré');
    this.form = null;
  }

  async toggle(u: AdminUser): Promise<void> {
    await this.run(() => firstValueFrom(this.http.post(`/api/admin/accounts/${u.id}/${u.enabled ? 'disable' : 'enable'}`, {})),
      u.enabled ? 'Compte désactivé : sessions fermées' : 'Compte réactivé');
  }

  async resetLink(u: AdminUser): Promise<void> {
    try {
      this.link.set(await firstValueFrom(this.http.post<{ url: string; expiresAt: string }>(`/api/admin/accounts/${u.id}/reset-link`, {})));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async erase(u: AdminUser): Promise<void> {
    if (!window.confirm(`Effacer définitivement les données personnelles de ${u.fullName} ? Cette action est irréversible.`)) return;
    await this.run(() => firstValueFrom(this.http.delete(`/api/admin/accounts/${u.id}`)), 'Compte effacé');
  }

  copy(url: string): void {
    void navigator.clipboard?.writeText(url);
    this.toast.show({ icon: 'check-circle', title: 'Lien copié' }, 2000);
  }

  private async run(fn: () => Promise<unknown>, ok: string): Promise<void> {
    this.error.set('');
    try {
      await fn();
      this.toast.show({ icon: 'check-circle', title: ok }, 2500);
      await this.load(this.page());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
