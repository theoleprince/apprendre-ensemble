import { IntegrationsComponent } from './integrations.component';
import { BrandingEditorComponent } from './branding-editor.component';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { AudienceItem, ROLE_LABELS, Role, priceLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';

type Tab = 'marque' | 'integrations' | 'publics' | 'pays' | 'langues' | 'traductions' | 'licences' | 'formules';
interface Pack { lang: string; entries: number; updatedAt: string; updatedBy: string }
interface Ref { code: string; name: string; active: boolean }
interface Licence { id: number; code: string; institution: string; seats: number; used: number; validUntil: string | null; programId: number | null; active: boolean }
interface Plan { id: number; name: string; description: string; price: number; durationDays: number; active: boolean }

const BASE_ROLES: Role[] = ['APPRENANT', 'ENSEIGNANT', 'DIRECTION_ECOLE', 'PARENT', 'TRAVAILLEUR_SOCIAL', 'JEUNE', 'CONSEILLER_PEDAGOGIQUE'];

/**
 * Parametrage sans developpement : nouveaux publics, pays et langues (deploiement dans un nouveau pays),
 * licences institutionnelles et formules d'abonnement.
 */
@Component({
  selector: 'app-settings',
  imports: [FormsModule, IconComponent, BrandingEditorComponent, IntegrationsComponent],
  template: `
    <h1>Paramètres</h1>
    <p class="muted">Ajouter un public, un pays ou une langue, gérer les licences et les abonnements : sans développement.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <nav class="tabs">
      <button [class.active]="tab() === 'marque'" (click)="tab.set('marque')">Marque</button>
      <button [class.active]="tab() === 'integrations'" (click)="tab.set('integrations')">Intégrations</button>
      <button [class.active]="tab() === 'publics'" (click)="tab.set('publics')">Publics ({{ audiences().length }})</button>
      <button [class.active]="tab() === 'pays'" (click)="tab.set('pays')">Pays ({{ countries().length }})</button>
      <button [class.active]="tab() === 'langues'" (click)="tab.set('langues')">Langues ({{ languages().length }})</button>
      <button [class.active]="tab() === 'traductions'" (click)="tab.set('traductions')">Traductions</button>
      <button [class.active]="tab() === 'licences'" (click)="tab.set('licences')">Licences ({{ licences().length }})</button>
      <button [class.active]="tab() === 'formules'" (click)="tab.set('formules')">Abonnements ({{ plans().length }})</button>
    </nav>

    @switch (tab()) {
      @case ('marque') { <app-branding-editor /> }
      @case ('integrations') { <app-integrations /> }
      @case ('publics') {
        <div class="table-wrap card flat"><table>
          <thead><tr><th>Code</th><th>Libellé</th><th>Rôle de base</th><th>Inscription libre</th><th>État</th><th></th></tr></thead>
          <tbody>@for (a of audiences(); track a.code) {
            <tr><td class="kbd">{{ a.code }}</td><td><app-icon [name]="a.icon || 'user'" [size]="16" /> {{ a.label }}</td><td class="small">{{ roleLabel(a.baseRole) }}</td>
              <td>{{ a.selfRegistration ? 'Oui' : 'Non' }}</td><td><span class="tag" [class.grey]="!a.active">{{ a.active ? 'Actif' : 'Inactif' }}</span></td>
              <td><button class="ghost icon-btn" (click)="editAudience(a)"><app-icon name="edit" [size]="18" /></button></td></tr>
          }</tbody></table></div>
        <form class="card section" (ngSubmit)="saveAudience()">
          <h3>{{ audEdit ? 'Modifier le public' : 'Nouveau public' }}</h3>
          <div class="field-row">
            <label>Code (majuscules) <input name="ac" [(ngModel)]="aud.code" required pattern="[A-Z0-9_]{2,40}" [readonly]="!!audEdit" placeholder="INFIRMIER" /></label>
            <label>Libellé <input name="al" [(ngModel)]="aud.label" required placeholder="Infirmier·ère scolaire" /></label>
            <label>Pictogramme <input name="ai" [(ngModel)]="aud.icon" placeholder="heart" /></label>
          </div>
          <div class="field-row">
            <label>Rôle de base (permissions) <select name="ar" [(ngModel)]="aud.baseRole">@for (r of baseRoles; track r) {<option [value]="r">{{ roleLabel(r) }}</option>}</select></label>
            <label>Ordre <input type="number" name="ap" [(ngModel)]="aud.position" /></label>
          </div>
          <label class="check"><input type="checkbox" name="as" [(ngModel)]="aud.selfRegistration" /> Proposé à l'inscription</label>
          <label class="check"><input type="checkbox" name="aa" [(ngModel)]="aud.active" /> Actif</label>
          <button class="primary" type="submit">Enregistrer</button>
        </form>
      }
      @case ('pays') {
        <div class="table-wrap card flat"><table><thead><tr><th>Code</th><th>Pays</th><th>État</th></tr></thead>
          <tbody>@for (c of countries(); track c.code) {<tr><td class="kbd">{{ c.code }}</td><td>{{ c.name }}</td><td>
            <label class="check inline"><input type="checkbox" [checked]="c.active" (change)="saveRef('countries', { code: c.code, name: c.name, active: !c.active })" /> Actif</label></td></tr>}</tbody></table></div>
        <form class="card section" (ngSubmit)="saveRef('countries', ref)">
          <h3>Ajouter un pays</h3>
          <div class="field-row"><label>Code ISO (2 lettres) <input name="cc" [(ngModel)]="ref.code" required pattern="[A-Z]{2}" placeholder="SN" /></label>
            <label>Nom <input name="cn" [(ngModel)]="ref.name" required placeholder="Sénégal" /></label></div>
          <button class="primary" type="submit">Ajouter</button>
        </form>
      }
      @case ('langues') {
        <div class="table-wrap card flat"><table><thead><tr><th>Code</th><th>Langue</th><th>État</th></tr></thead>
          <tbody>@for (l of languages(); track l.code) {<tr><td class="kbd">{{ l.code }}</td><td>{{ l.name }}</td><td>
            <label class="check inline"><input type="checkbox" [checked]="l.active" (change)="saveRef('languages', { code: l.code, name: l.name, active: !l.active })" /> Active</label></td></tr>}</tbody></table></div>
        <form class="card section" (ngSubmit)="saveRef('languages', ref)">
          <h3>Ajouter une langue</h3>
          <div class="field-row"><label>Code ISO 639 <input name="lc" [(ngModel)]="ref.code" required pattern="[a-z]{2,3}" placeholder="wo" /></label>
            <label>Nom <input name="ln" [(ngModel)]="ref.name" required placeholder="Wolof" /></label></div>
          <p class="xs muted">La traduction de l'interface se charge dans « Traductions ».</p>
          <button class="primary" type="submit">Ajouter</button>
        </form>
      }
      @case ('traductions') {
        <p class="small muted">L'interface se traduit par « packs » : un fichier JSON qui associe chaque texte français à sa traduction.
          Téléchargez le modèle, faites-le traduire (traducteurs, partenaires locaux), puis chargez-le : la langue est disponible immédiatement, sans développement.
          Les textes non traduits restent en français. Les contenus des cours sont produits séparément, par langue.</p>
        <div class="table-wrap card flat"><table><thead><tr><th>Langue</th><th>Textes traduits</th><th>Couverture</th><th>Mise à jour</th><th></th></tr></thead>
          <tbody>@for (l of languages(); track l.code) {
            @let pk = packOf(l.code);
            <tr><td><strong>{{ l.name }}</strong> <span class="kbd">{{ l.code }}</span></td>
              <td>{{ l.code === 'fr' ? 'langue source' : pk ? pk.entries : (l.code === 'en' ? 'pack livré' : 0) }}</td>
              <td>@if (l.code !== 'fr') {<div class="progress" style="width:120px"><div [style.width.%]="cover(l.code)"></div></div> {{ cover(l.code) }} %}</td>
              <td class="small muted">{{ pk ? pk.updatedBy : '' }}</td>
              <td class="nowrap">@if (l.code !== 'fr') {
                <button class="ghost" (click)="downloadTemplate(l.code)"><app-icon name="download" [size]="16" /> Modèle</button>
                <label class="btn ghost file-btn"><app-icon name="upload" [size]="16" /> Charger
                  <input type="file" accept="application/json,.json" (change)="uploadPack(l.code, $event)" hidden /></label>
              }</td></tr>
          }</tbody></table></div>
      }
      @case ('licences') {
        <div class="table-wrap card flat"><table><thead><tr><th>Code</th><th>Institution</th><th>Places</th><th>Fin</th><th>État</th><th></th></tr></thead>
          <tbody>@for (l of licences(); track l.id) {<tr><td class="kbd">{{ l.code }}</td><td>{{ l.institution }}</td>
            <td>{{ l.used }} / {{ l.seats || '∞' }}</td><td class="small">{{ l.validUntil || '—' }}</td>
            <td><span class="tag" [class.grey]="!l.active">{{ l.active ? 'Active' : 'Inactive' }}</span></td>
            <td><button class="ghost icon-btn" (click)="editLicence(l)"><app-icon name="edit" [size]="18" /></button></td></tr>}</tbody></table></div>
        <form class="card section" (ngSubmit)="saveLicence()">
          <h3>{{ lic.id ? 'Modifier la licence' : 'Nouvelle licence' }}</h3>
          <div class="field-row"><label>Code <input name="lco" [(ngModel)]="lic.code" required minlength="4" /></label>
            <label>Institution <input name="lin" [(ngModel)]="lic.institution" required /></label>
            <label>Places (0 = illimité) <input type="number" name="lse" [(ngModel)]="lic.seats" min="0" /></label>
            <label>Fin de validité <input type="date" name="lva" [(ngModel)]="lic.validUntil" /></label></div>
          <label class="check"><input type="checkbox" name="lac" [(ngModel)]="lic.active" /> Active</label>
          <button class="primary" type="submit">Enregistrer</button>
        </form>
      }
      @case ('formules') {
        <div class="table-wrap card flat"><table><thead><tr><th>Formule</th><th>Prix</th><th>Durée</th><th>État</th><th></th></tr></thead>
          <tbody>@for (p of plans(); track p.id) {<tr><td><strong>{{ p.name }}</strong><div class="xs muted">{{ p.description }}</div></td>
            <td>{{ price(p.price) }}</td><td>{{ p.durationDays }} j</td><td><span class="tag" [class.grey]="!p.active">{{ p.active ? 'Active' : 'Inactive' }}</span></td>
            <td><button class="ghost icon-btn" (click)="editPlan(p)"><app-icon name="edit" [size]="18" /></button></td></tr>}</tbody></table></div>
        <form class="card section" (ngSubmit)="savePlan()">
          <h3>{{ plan.id ? 'Modifier la formule' : 'Nouvelle formule' }}</h3>
          <div class="field-row"><label>Nom <input name="pn" [(ngModel)]="plan.name" required /></label>
            <label>Prix (FCFA) <input type="number" name="pp" [(ngModel)]="plan.price" min="1" required /></label>
            <label>Durée (jours) <input type="number" name="pd" [(ngModel)]="plan.durationDays" min="1" required /></label></div>
          <label>Description <input name="pde" [(ngModel)]="plan.description" /></label>
          <label class="check"><input type="checkbox" name="pac" [(ngModel)]="plan.active" /> Active</label>
          <button class="primary" type="submit">Enregistrer</button>
        </form>
      }
    }
  `,
})
export class SettingsPage implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  tab = signal<Tab>('publics');
  audiences = signal<AudienceItem[]>([]);
  countries = signal<Ref[]>([]);
  languages = signal<Ref[]>([]);
  licences = signal<Licence[]>([]);
  plans = signal<Plan[]>([]);
  packs = signal<Pack[]>([]);
  private keys: string[] = [];
  private bundled: Record<string, number> = {};
  error = signal('');
  baseRoles = BASE_ROLES;
  audEdit: string | null = null;
  aud = this.emptyAudience();
  ref: Ref = { code: '', name: '', active: true };
  lic = this.emptyLicence();
  plan = this.emptyPlan();

  async ngOnInit(): Promise<void> {
    try {
      const [a, c, l, li, p] = await Promise.all([
        firstValueFrom(this.http.get<AudienceItem[]>('/api/admin/audiences')),
        firstValueFrom(this.http.get<Ref[]>('/api/admin/countries')),
        firstValueFrom(this.http.get<Ref[]>('/api/admin/languages')),
        firstValueFrom(this.http.get<Licence[]>('/api/admin/licences')),
        firstValueFrom(this.http.get<Plan[]>('/api/admin/subscription-plans')),
      ]);
      this.audiences.set(a);
      this.countries.set(c);
      this.languages.set(l);
      this.licences.set(li);
      this.plans.set(p);
      this.packs.set(await firstValueFrom(this.http.get<Pack[]>('/api/admin/i18n')).catch(() => []));
      if (!this.keys.length) this.keys = await firstValueFrom(this.http.get<string[]>('/i18n/keys.json')).catch(() => []);
      if (this.bundled['en'] === undefined) {
        const en = await firstValueFrom(this.http.get<Record<string, string>>('/i18n/en.json')).catch(() => ({}));
        this.bundled['en'] = Object.keys(en).length;
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  packOf(lang: string): Pack | undefined {
    return this.packs().find((p) => p.lang === lang);
  }

  cover(lang: string): number {
    const n = this.packOf(lang)?.entries ?? this.bundled[lang] ?? 0;
    return this.keys.length ? Math.min(100, Math.round((n * 100) / this.keys.length)) : 0;
  }

  /** Modele : tous les textes de l'interface, avec les traductions existantes. */
  async downloadTemplate(lang: string): Promise<void> {
    let existing: Record<string, string> = {};
    for (const url of [`/api/public/i18n/${lang}`, `/i18n/${lang}.json`]) {
      try {
        existing = await firstValueFrom(this.http.get<Record<string, string>>(url));
        break;
      } catch {
        /* suivant */
      }
    }
    const tpl: Record<string, string> = {};
    for (const k of this.keys) tpl[k] = existing[k] ?? '';
    const url = URL.createObjectURL(new Blob([JSON.stringify(tpl, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `traduction-${lang}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async uploadPack(lang: string, ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Record<string, string>;
      await this.run(() => firstValueFrom(this.http.put(`/api/admin/i18n/${lang}`, data)));
    } catch (e) {
      this.error.set(e instanceof SyntaxError ? 'Fichier JSON invalide' : errorMessage(e));
    }
  }

  roleLabel(r: string): string {
    return ROLE_LABELS[r as Role] ?? r;
  }

  editAudience(a: AudienceItem): void {
    this.audEdit = a.code;
    this.aud = { ...a, icon: a.icon ?? '' };
  }

  async saveAudience(): Promise<void> {
    await this.run(() => (this.audEdit
      ? firstValueFrom(this.http.put(`/api/admin/audiences/${this.audEdit}`, this.aud))
      : firstValueFrom(this.http.post('/api/admin/audiences', this.aud))));
    this.audEdit = null;
    this.aud = this.emptyAudience();
  }

  async saveRef(kind: 'countries' | 'languages', r: Ref): Promise<void> {
    await this.run(() => firstValueFrom(this.http.put(`/api/admin/${kind}`, r)));
    this.ref = { code: '', name: '', active: true };
  }

  editLicence(l: Licence): void {
    this.lic = { ...l, validUntil: l.validUntil ?? '' } as never;
  }

  async saveLicence(): Promise<void> {
    const body = { ...this.lic, validUntil: this.lic.validUntil || null };
    await this.run(() => (this.lic.id
      ? firstValueFrom(this.http.put(`/api/admin/licences/${this.lic.id}`, body))
      : firstValueFrom(this.http.post('/api/admin/licences', body))));
    this.lic = this.emptyLicence();
  }

  editPlan(p: Plan): void {
    this.plan = { ...p };
  }

  async savePlan(): Promise<void> {
    await this.run(() => (this.plan.id
      ? firstValueFrom(this.http.put(`/api/admin/subscription-plans/${this.plan.id}`, this.plan))
      : firstValueFrom(this.http.post('/api/admin/subscription-plans', this.plan))));
    this.plan = this.emptyPlan();
  }

  price = priceLabel;

  private emptyAudience() {
    return { code: '', label: '', icon: '', position: 10, baseRole: 'APPRENANT' as Role, selfRegistration: true, active: true };
  }

  private emptyLicence() {
    return { id: null as number | null, code: '', institution: '', seats: 0, validUntil: '' as string | null, programId: null as number | null, active: true };
  }

  private emptyPlan() {
    return { id: null as number | null, name: '', description: '', price: 1500, durationDays: 30, active: true };
  }

  private async run(fn: () => Promise<unknown>): Promise<void> {
    this.error.set('');
    try {
      await fn();
      this.toast.show({ icon: 'check-circle', title: 'Enregistré' }, 2000);
      await this.ngOnInit();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
