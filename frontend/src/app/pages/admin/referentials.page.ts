import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { Domain, ROLE_LABELS, ResourceItem, Role, School } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AudienceService } from '../../core/audience.service';
import { IconComponent } from '../../shared/icon.component';

type Tab = 'domaines' | 'ecoles' | 'fiches';
const ICONS = ['cloud-sun', 'handshake', 'shield', 'family', 'smartphone', 'compass', 'heart', 'book-open', 'target', 'users', 'sprout', 'wind', 'message-heart', 'alert', 'file'];

/** Referentiels parametrables : domaines de competences, etablissements, fiches pratiques. */
@Component({
  selector: 'app-referentials',
  imports: [FormsModule, IconComponent],
  template: `
    <h1>Référentiels</h1>
    <p class="muted">Tout se paramètre ici, sans développement : ajouter un domaine, une école ou une fiche est immédiat.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <nav class="tabs">
      <button [class.active]="tab() === 'domaines'" (click)="tab.set('domaines')">Domaines de compétences ({{ domains().length }})</button>
      <button [class.active]="tab() === 'ecoles'" (click)="tab.set('ecoles')">Établissements ({{ schools().length }})</button>
      <button [class.active]="tab() === 'fiches'" (click)="tab.set('fiches')">Fiches pratiques ({{ fiches().length }})</button>
    </nav>

    @switch (tab()) {
      @case ('domaines') {
        <div class="stack">
          @for (d of domains(); track d.id) {
            <div class="card flat row">
              <span class="course-icon"><app-icon [name]="d.icon || 'book-open'" [size]="22" /></span>
              <div style="flex:1"><strong>{{ d.name }}</strong><div class="small muted">{{ d.description }}</div></div>
              <button class="ghost icon-btn" (click)="editDomain(d)" title="Modifier"><app-icon name="edit" [size]="18" /></button>
            </div>
          }
        </div>
        <form class="card section" (ngSubmit)="saveDomain()">
          <h3>{{ dom.id ? 'Modifier le domaine' : 'Nouveau domaine' }}</h3>
          <div class="field-row">
            <label>Nom <input name="dn" [(ngModel)]="dom.name" required /></label>
            <label style="flex:0 0 180px">Pictogramme <select name="di" [(ngModel)]="dom.icon">@for (i of icons; track i) {<option [value]="i">{{ i }}</option>}</select></label>
            <label style="flex:0 0 100px">Ordre <input type="number" name="dp" [(ngModel)]="dom.position" /></label>
          </div>
          <label>Description <input name="dd" [(ngModel)]="dom.description" /></label>
          <button class="primary" type="submit" [disabled]="!dom.name.trim()">Enregistrer</button>
        </form>
      }
      @case ('ecoles') {
        <div class="table-wrap card flat">
          <table>
            <thead><tr><th>Établissement</th><th>Commune</th><th>Zone</th><th class="num">Personnes</th></tr></thead>
            <tbody>@for (s of schools(); track s.id) {<tr><td><strong>{{ s.name }}</strong></td><td>{{ s.commune }}</td><td>{{ s.region }}</td><td class="num">{{ s.staffCount }}</td></tr>}</tbody>
          </table>
        </div>
        <form class="card section" (ngSubmit)="saveSchool()">
          <h3>Nouvel établissement</h3>
          <div class="field-row">
            <label>Nom <input name="sn" [(ngModel)]="sch.name" required /></label>
            <label>Commune <input name="sc" [(ngModel)]="sch.commune" /></label>
            <label>Zone <input name="sr" [(ngModel)]="sch.region" /></label>
          </div>
          <button class="primary" type="submit" [disabled]="!sch.name.trim()">Ajouter</button>
        </form>
      }
      @case ('fiches') {
        <div class="stack">
          @for (r of fiches(); track r.id) {
            <div class="card flat row">
              <span class="course-icon"><app-icon [name]="r.icon || 'file'" [size]="22" /></span>
              <div style="flex:1"><strong>{{ r.title }}</strong><div class="small muted">{{ r.domainName }} · {{ rolesLabel(r.targetRoles) }}</div></div>
              <button class="ghost icon-btn" (click)="editFiche(r)" title="Modifier"><app-icon name="edit" [size]="18" /></button>
              <button class="ghost icon-btn danger" (click)="deleteFiche(r)" title="Supprimer"><app-icon name="trash" [size]="18" /></button>
            </div>
          }
        </div>
        <form class="card section" (ngSubmit)="saveFiche()">
          <h3>{{ fiche.id ? 'Modifier la fiche' : 'Nouvelle fiche' }}</h3>
          <div class="field-row">
            <label>Titre <input name="ft" [(ngModel)]="fiche.title" required /></label>
            <label style="flex:0 0 180px">Pictogramme <select name="fi" [(ngModel)]="fiche.icon">@for (i of icons; track i) {<option [value]="i">{{ i }}</option>}</select></label>
            <label>Domaine <select name="fd" [(ngModel)]="fiche.domainId"><option [ngValue]="null">—</option>@for (d of domains(); track d.id) {<option [ngValue]="d.id">{{ d.name }}</option>}</select></label>
          </div>
          <label>Résumé <input name="fs" [(ngModel)]="fiche.summary" /></label>
          <label>Contenu (texte, **gras**, listes « - » ou « 1. ») <textarea name="fc" rows="6" [(ngModel)]="fiche.content"></textarea></label>
          <fieldset><legend>Publics (aucun = tous)</legend>
            @for (r of roles(); track r) { <label class="check inline"><input type="checkbox" [checked]="fiche.targetRoles.includes(r)" (change)="toggleRole(r)" /> {{ aud.label(r) }}</label> }
          </fieldset>
          <button class="primary" type="submit" [disabled]="!fiche.title.trim()">Enregistrer</button>
        </form>
      }
    }
  `,
})
export class ReferentialsPage implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  icons = ICONS;
  protected aud = inject(AudienceService);
  roles = computed(() => this.aud.list().filter((a) => a.active).map((a) => a.code));
  tab = signal<Tab>('domaines');
  domains = signal<Domain[]>([]);
  schools = signal<School[]>([]);
  fiches = signal<ResourceItem[]>([]);
  error = signal('');
  dom = { id: null as number | null, name: '', description: '', icon: 'book-open', position: 10 };
  sch = { name: '', commune: '', region: '', countryCode: 'BJ' };
  fiche = { id: null as number | null, title: '', summary: '', icon: 'file', content: '', fileUrl: null as string | null, domainId: null as number | null, targetRoles: [] as string[] };

  async ngOnInit(): Promise<void> {
    try {
      const [d, s, f] = await Promise.all([
        firstValueFrom(this.http.get<Domain[]>('/api/admin/domains')),
        firstValueFrom(this.http.get<School[]>('/api/admin/schools')),
        firstValueFrom(this.http.get<ResourceItem[]>('/api/admin/resources')),
      ]);
      this.domains.set(d);
      this.schools.set(s);
      this.fiches.set(f);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  editDomain(d: Domain): void {
    this.dom = { id: d.id, name: d.name, description: d.description ?? '', icon: d.icon ?? 'book-open', position: d.position };
  }

  async saveDomain(): Promise<void> {
    await this.run(() => (this.dom.id ? firstValueFrom(this.http.put(`/api/admin/domains/${this.dom.id}`, this.dom)) : firstValueFrom(this.http.post('/api/admin/domains', this.dom))));
    this.dom = { id: null, name: '', description: '', icon: 'book-open', position: 10 };
  }

  async saveSchool(): Promise<void> {
    await this.run(() => firstValueFrom(this.http.post('/api/admin/schools', this.sch)));
    this.sch = { name: '', commune: '', region: '', countryCode: 'BJ' };
  }

  editFiche(r: ResourceItem): void {
    this.fiche = { id: r.id, title: r.title, summary: r.summary ?? '', icon: r.icon ?? 'file', content: r.content ?? '', fileUrl: r.fileUrl, domainId: r.domainId, targetRoles: [...r.targetRoles] };
  }

  toggleRole(r: string): void {
    this.fiche.targetRoles = this.fiche.targetRoles.includes(r) ? this.fiche.targetRoles.filter((x) => x !== r) : [...this.fiche.targetRoles, r];
  }

  async saveFiche(): Promise<void> {
    await this.run(() => (this.fiche.id ? firstValueFrom(this.http.put(`/api/admin/resources/${this.fiche.id}`, this.fiche)) : firstValueFrom(this.http.post('/api/admin/resources', this.fiche))));
    this.fiche = { id: null, title: '', summary: '', icon: 'file', content: '', fileUrl: null, domainId: null, targetRoles: [] };
  }

  async deleteFiche(r: ResourceItem): Promise<void> {
    if (!window.confirm(`Supprimer la fiche « ${r.title} » ?`)) return;
    await this.run(() => firstValueFrom(this.http.delete(`/api/admin/resources/${r.id}`)));
  }

  rolesLabel(roles: string[]): string {
    return roles.length ? this.aud.labels(roles) : 'Tous les publics';
  }

  private async run(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
      this.toast.show({ icon: 'check-circle', title: 'Enregistré' }, 2000);
      await this.ngOnInit();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
