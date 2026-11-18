import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { AdminCourse, CertificateLevel, LEVELS, ProgramAdmin, ROLE_LABELS, Role } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { CoverComponent } from '../../shared/visuals';

const ROLES: Role[] = ['ENSEIGNANT', 'CONSEILLER_PEDAGOGIQUE', 'DIRECTION_ECOLE', 'PARENT', 'TRAVAILLEUR_SOCIAL', 'JEUNE'];
const ICONS = ['graduation', 'compass', 'school', 'family', 'sprout', 'heart', 'book-open', 'users', 'shield', 'target', 'smartphone', 'handshake'];

/** Liste des programmes. */
@Component({
  selector: 'app-programs-admin',
  imports: [RouterLink, IconComponent, CoverComponent],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Programmes</h1>
      <a class="btn primary" routerLink="/admin/programmes/nouveau"><app-icon name="plus" /> Nouveau programme</a>
    </div>
    <p class="muted">Un programme enchaîne des modules dans un ordre donné et délivre un certificat de parcours. Lancez-le en classe depuis « Classes ».</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <div class="grid cols-3 section">
      @for (p of list(); track p.id) {
        <a class="card course-card" [routerLink]="['/admin/programmes', p.id]" style="text-decoration:none;color:inherit">
          <app-cover class="card-cover" [icon]="p.icon" [seed]="p.id + 3" [height]="84" [label]="p.title" />
          <h3 style="margin:0">{{ p.title }}</h3>
          <div class="xs muted">{{ p.courseIds.length }} modules · {{ p.durationLabel }} · {{ p.classroomCount }} classe(s)</div>
          <div class="tags">
            <span class="tag" [class.grey]="!p.published">{{ p.published ? 'Publié' : 'Brouillon' }}</span>
            @for (r of p.targetRoles; track r) { <span class="tag grey">{{ labels[r] }}</span> }
          </div>
        </a>
      }
    </div>
  `,
})
export class ProgramsAdminPage implements OnInit {
  private http = inject(HttpClient);
  labels = ROLE_LABELS;
  list = signal<ProgramAdmin[]>([]);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.list.set(await firstValueFrom(this.http.get<ProgramAdmin[]>('/api/admin/programs')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}

/** Editeur de programme : publics, ordre des modules, niveau requis pour le certificat de parcours. */
@Component({
  selector: 'app-program-editor',
  imports: [FormsModule, RouterLink, IconComponent, CoverComponent],
  template: `
    <a routerLink="/admin/programmes" class="back"><app-icon name="back" [size]="18" /> Programmes</a>
    <h1>{{ isNew() ? 'Nouveau programme' : 'Modifier le programme' }}</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <form (ngSubmit)="save()" #f="ngForm">
      <section class="card">
        <div class="field-row">
          <label style="flex:0 0 200px">Pictogramme <select name="icon" [(ngModel)]="p.icon">@for (i of icons; track i) {<option [value]="i">{{ i }}</option>}</select></label>
          <app-cover [icon]="p.icon" [seed]="(isNew() ? 0 : +id()) + 3" [height]="70" style="width:140px;border-radius:12px;align-self:flex-end;margin-bottom:.85rem" />
          <label>Titre <input name="title" [(ngModel)]="p.title" required /></label>
        </div>
        <label>Description <textarea name="desc" rows="2" [(ngModel)]="p.description"></textarea></label>
        <div class="field-row">
          <label>Durée affichée <input name="dur" [(ngModel)]="p.durationLabel" placeholder="ex. 6 modules · 8 semaines" /></label>
          <label>Prix de la formation (FCFA, 0 = gratuite) <input type="number" name="price" min="0" step="500" [(ngModel)]="p.price" /></label>
          <label>Pays <select name="cc" [(ngModel)]="p.countryCode"><option [ngValue]="null">Tous</option><option value="BJ">Bénin</option><option value="CI">Côte d'Ivoire</option><option value="CH">Suisse</option></select></label>
          <label>Certificat de parcours : niveau requis dans chaque module
            <select name="lvl" [(ngModel)]="p.requiredLevel">@for (l of levels; track l.key) {<option [value]="l.key">{{ l.label }}</option>}</select></label>
        </div>
        <fieldset><legend>Publics</legend>
          @for (r of roles; track r) { <label class="check inline"><input type="checkbox" [checked]="p.targetRoles.includes(r)" (change)="toggleRole(r)" /> {{ labels[r] }}</label> }
        </fieldset>
        <label class="check"><input type="checkbox" name="pub" [(ngModel)]="p.published" /> Publié</label>
      </section>

      <h2 class="section">Modules du parcours (dans l'ordre)</h2>
      <ol class="lesson-list">
        @for (cid of p.courseIds; track cid; let i = $index) {
          <li class="lesson-item">
            <span class="lesson-num">{{ i + 1 }}</span>
            <span class="grow" style="flex:1"><span class="title">{{ courseTitle(cid) }}</span><br /><span class="xs muted">{{ courseDomain(cid) }}</span></span>
            <button type="button" class="ghost icon-btn" [disabled]="i === 0" (click)="move(i, -1)" title="Monter">↑</button>
            <button type="button" class="ghost icon-btn" [disabled]="i === p.courseIds.length - 1" (click)="move(i, 1)" title="Descendre">↓</button>
            <button type="button" class="ghost icon-btn danger" (click)="p.courseIds.splice(i, 1)" title="Retirer"><app-icon name="x" [size]="16" /></button>
          </li>
        }
      </ol>
      <div class="row section">
        <select name="add" [(ngModel)]="toAdd" style="flex:1;margin:0">
          <option [ngValue]="null">Ajouter un module…</option>
          @for (c of available(); track c.id) { <option [ngValue]="c.id">{{ c.title }} @if (c.domainName) {· {{ c.domainName }}}</option> }
        </select>
        <button type="button" (click)="add()" [disabled]="!toAdd"><app-icon name="plus" /> Ajouter</button>
      </div>

      <div class="focus-cta" style="position:sticky">
        <button class="primary grow lg" type="submit" [disabled]="f.invalid || !p.targetRoles.length || !p.courseIds.length || saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
      </div>
    </form>
  `,
})
export class ProgramEditorPage implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly id = input.required<string>();

  labels = ROLE_LABELS;
  roles = ROLES;
  icons = ICONS;
  levels = LEVELS;
  courses = signal<AdminCourse[]>([]);
  error = signal('');
  saving = signal(false);
  isNew = signal(true);
  toAdd: number | null = null;
  p = {
    title: '', description: '', icon: 'graduation', durationLabel: '', countryCode: 'BJ' as string | null,
    targetRoles: ['ENSEIGNANT'] as Role[], courseIds: [] as number[], requiredLevel: 'BADGE' as CertificateLevel, published: true, price: 0,
  };
  available = computed(() => this.courses().filter((c) => !this.p.courseIds.includes(c.id)));

  async ngOnInit(): Promise<void> {
    this.isNew.set(this.id() === 'nouveau');
    try {
      this.courses.set(await firstValueFrom(this.http.get<AdminCourse[]>('/api/admin/courses')));
      if (!this.isNew()) {
        const x = await firstValueFrom(this.http.get<ProgramAdmin>(`/api/admin/programs/${this.id()}`));
        this.p = { title: x.title, description: x.description, icon: x.icon ?? 'graduation', durationLabel: x.durationLabel ?? '', countryCode: x.countryCode,
          targetRoles: [...x.targetRoles], courseIds: [...x.courseIds], requiredLevel: x.requiredLevel, published: x.published, price: x.price ?? 0 };
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  courseTitle(id: number): string {
    return this.courses().find((c) => c.id === id)?.title ?? '#' + id;
  }

  courseDomain(id: number): string {
    return this.courses().find((c) => c.id === id)?.domainName ?? '';
  }

  toggleRole(r: Role): void {
    this.p.targetRoles = this.p.targetRoles.includes(r) ? this.p.targetRoles.filter((x) => x !== r) : [...this.p.targetRoles, r];
  }

  move(i: number, d: number): void {
    const l = this.p.courseIds;
    [l[i], l[i + d]] = [l[i + d], l[i]];
  }

  add(): void {
    if (this.toAdd) this.p.courseIds.push(this.toAdd);
    this.toAdd = null;
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      if (this.isNew()) {
        const x = await firstValueFrom(this.http.post<ProgramAdmin>('/api/admin/programs', this.p));
        await this.router.navigate(['/admin/programmes', x.id]);
        this.isNew.set(false);
      } else {
        await firstValueFrom(this.http.put(`/api/admin/programs/${this.id()}`, this.p));
      }
      this.toast.show({ icon: 'check-circle', title: 'Programme enregistré' });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
