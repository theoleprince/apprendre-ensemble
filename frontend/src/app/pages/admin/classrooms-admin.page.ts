import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { ClassroomAdmin, ProgramAdmin, ROLE_LABELS, STATUS_LABELS, School, UserBrief, frDate } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/visuals';

/** Liste des classes (sessions) : en cours, a venir, terminees. */
@Component({
  selector: 'app-classrooms-admin',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="section-head">
      <h1 style="margin:0">Classes</h1>
      <a class="btn primary" routerLink="/admin/classes/nouvelle"><app-icon name="plus" /> Lancer une classe</a>
    </div>
    <p class="muted">Une classe lance un programme pour un groupe : dates, animateur·rice, ouverture progressive des modules, barème de points et classement.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <div class="stack section">
      @for (c of list(); track c.id) {
        <div class="card class-admin">
          <div class="class-icon"><app-icon name="users" [size]="22" /></div>
          <div style="flex:1;min-width:0">
            <div class="row" style="gap:.4rem"><strong>{{ c.name }}</strong>
              <span class="tag" [class.sun]="c.status === 'ACTIVE'" [class.grey]="c.status === 'CLOSED'" [class.violet]="c.status === 'UPCOMING'">{{ statusLabel(c.status) }}</span>
              <span class="tag grey">classement {{ lbLabel(c.leaderboardMode) }}</span></div>
            <div class="small muted">{{ c.programTitle }} · {{ date(c.startDate) }} → {{ date(c.endDate) }} · {{ c.memberIds.length }} membres @if (c.facilitatorName) {· {{ c.facilitatorName }}}</div>
            <div class="small">Code d'invitation : <span class="kbd">{{ c.inviteCode }}</span></div>
          </div>
          <div class="row">
            <a class="btn" [routerLink]="['/classes', c.id]"><app-icon name="trophy" /> Classement</a>
            <a class="btn primary" [routerLink]="['/admin/classes', c.id]"><app-icon name="edit" /> Gérer</a>
          </div>
        </div>
      }
    </div>
  `,
})
export class ClassroomsAdminPage implements OnInit {
  private http = inject(HttpClient);
  list = signal<ClassroomAdmin[]>([]);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.list.set(await firstValueFrom(this.http.get<ClassroomAdmin[]>('/api/admin/classrooms')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }

  lbLabel(m: string): string {
    return m === 'PUBLIC' ? 'public' : m === 'ANONYMOUS' ? 'anonyme' : 'désactivé';
  }

  date(d: string): string {
    return frDate(d);
  }
}

/** Editeur de classe : reglages, membres (ajout en masse par filtres), cloture. */
@Component({
  selector: 'app-classroom-editor',
  imports: [FormsModule, RouterLink, IconComponent, AvatarComponent],
  template: `
    <a routerLink="/admin/classes" class="back"><app-icon name="back" [size]="18" /> Classes</a>
    <h1>{{ isNew() ? 'Lancer une classe' : c.name }}</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (saved(); as s) {
      <div class="row section">
        <span class="tag" [class.sun]="s.status === 'ACTIVE'">{{ statusLabel(s.status) }}</span>
        <span class="small">Code d'invitation : <span class="kbd">{{ s.inviteCode }}</span></span>
        <a class="btn" [routerLink]="['/classes', s.id]"><app-icon name="trophy" /> Classement</a>
        @if (!s.closed) { <button class="danger" (click)="close()"><app-icon name="flag" /> Clôturer et délivrer les certificats</button> }
      </div>
    }

    <form (ngSubmit)="save()" #f="ngForm">
      <section class="card">
        <label>Nom de la classe <input name="name" [(ngModel)]="c.name" required placeholder="ex. Promo Borgou · janvier 2027" /></label>
        <div class="field-row">
          <label>Programme <select name="prog" [(ngModel)]="c.programId" required>@for (p of programs(); track p.id) {<option [ngValue]="p.id">{{ p.title }}</option>}</select></label>
          <label>Animateur·rice <select name="fac" [(ngModel)]="c.facilitatorId"><option [ngValue]="null">—</option>@for (u of facilitators(); track u.id) {<option [ngValue]="u.id">{{ u.fullName }} · {{ u.region }}</option>}</select></label>
        </div>
        <div class="field-row">
          <label>Début <input type="date" name="start" [(ngModel)]="c.startDate" required /></label>
          <label>Fin <input type="date" name="end" [(ngModel)]="c.endDate" required /></label>
          <label>Visio récurrente <input name="meet" [(ngModel)]="c.meetingUrl" placeholder="https://meet.jit.si/…" /></label>
        </div>
        <fieldset><legend>Ouverture des modules</legend>
          <label class="check inline"><input type="radio" name="unlock" value="WEEKLY" [(ngModel)]="c.unlockMode" /> Progressive</label>
          <label class="check inline"><input type="radio" name="unlock" value="ALL" [(ngModel)]="c.unlockMode" /> Tout ouvert dès le début</label>
          @if (c.unlockMode === 'WEEKLY') { <label style="max-width:260px">Un nouveau module tous les (jours) <input type="number" min="1" max="60" name="int" [(ngModel)]="c.unlockIntervalDays" /></label> }
        </fieldset>
        <fieldset><legend>Classement</legend>
          <label class="check inline"><input type="radio" name="lb" value="PUBLIC" [(ngModel)]="c.leaderboardMode" /> Public (noms visibles)</label>
          <label class="check inline"><input type="radio" name="lb" value="ANONYMOUS" [(ngModel)]="c.leaderboardMode" /> Anonyme (top 3 sans nom + son rang)</label>
          <label class="check inline"><input type="radio" name="lb" value="DISABLED" [(ngModel)]="c.leaderboardMode" /> Désactivé</label>
          <p class="xs muted">Protocole J-PAL : désactivez le classement dans les classes qui ne doivent pas y être exposées (ex. groupe contrôle).</p>
        </fieldset>
        <fieldset><legend>Barème des points</legend>
          <div class="field-row">
            <label>Par leçon <input type="number" min="0" name="pl" [(ngModel)]="c.pointsPerLesson" /></label>
            <label>Par % de score au quiz <input type="number" min="0" name="pq" [(ngModel)]="c.pointsPerQuizPercent" /></label>
            <label>Par portfolio validé <input type="number" min="0" name="pp" [(ngModel)]="c.pointsPerPortfolio" /></label>
            <label>Par message <input type="number" min="0" name="pm" [(ngModel)]="c.pointsPerPost" /></label>
          </div>
        </fieldset>
        <button class="primary lg" type="submit" [disabled]="f.invalid || saving()">{{ saving() ? 'Enregistrement…' : isNew() ? 'Créer la classe' : 'Enregistrer' }}</button>
      </section>
    </form>

    @if (saved(); as s) {
      <section class="card section">
        <h2>Membres ({{ s.memberIds.length }})</h2>
        <p class="small muted">Ajoutez en une fois tous les apprenant·es d'une zone, d'une école ou d'un groupe RCT correspondant au public du programme.</p>
        <div class="field-row">
          <label>Zone <select name="fr" [(ngModel)]="fRegion"><option value="">Toutes</option>@for (r of regions; track r) {<option [value]="r">{{ r }}</option>}</select></label>
          <label>École <select name="fs" [(ngModel)]="fSchool"><option [ngValue]="null">Toutes</option>@for (x of schools(); track x.id) {<option [ngValue]="x.id">{{ x.name }}</option>}</select></label>
          <label>Groupe RCT <select name="fc" [(ngModel)]="fCohort"><option value="">Tous</option><option value="TRAITEMENT">Traitement</option><option value="CONTROLE">Contrôle</option><option value="PILOTE">Pilote</option></select></label>
        </div>
        <button (click)="addFiltered()"><app-icon name="plus" /> Ajouter les personnes correspondantes</button>
        <div class="table-wrap section">
          <table>
            <thead><tr><th>Membre</th><th>Public</th><th>École / zone</th><th>Groupe</th><th></th></tr></thead>
            <tbody>
              @for (u of members(); track u.id) {
                <tr>
                  <td><div class="row" style="flex-wrap:nowrap;gap:.5rem"><app-avatar [name]="u.fullName" [size]="28" /> {{ u.fullName }}</div></td>
                  <td class="small">{{ roleLabel(u.role) }}</td>
                  <td class="small">{{ u.schoolName || u.region }}</td>
                  <td>@if (u.cohort) {<span class="tag grey">{{ u.cohort }}</span>}</td>
                  <td class="num"><button class="ghost icon-btn danger" (click)="remove(u.id)" title="Retirer"><app-icon name="x" [size]="16" /></button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
})
export class ClassroomEditorPage implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly id = input.required<string>();

  regions = ['Alibori', 'Atacora', 'Borgou', 'Donga'];
  programs = signal<ProgramAdmin[]>([]);
  facilitators = signal<UserBrief[]>([]);
  schools = signal<School[]>([]);
  allUsers = signal<UserBrief[]>([]);
  saved = signal<ClassroomAdmin | null>(null);
  error = signal('');
  saving = signal(false);
  isNew = signal(true);
  fRegion = '';
  fSchool: number | null = null;
  fCohort = '';
  c = {
    name: '', programId: null as number | null, facilitatorId: null as number | null,
    startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 56 * 86400_000).toISOString().slice(0, 10),
    unlockMode: 'WEEKLY', unlockIntervalDays: 7, leaderboardMode: 'PUBLIC',
    pointsPerLesson: 10, pointsPerQuizPercent: 1, pointsPerPortfolio: 50, pointsPerPost: 5, meetingUrl: '',
  };
  members = computed(() => {
    const ids = new Set(this.saved()?.memberIds ?? []);
    return this.allUsers().filter((u) => ids.has(u.id));
  });

  async ngOnInit(): Promise<void> {
    this.isNew.set(this.id() === 'nouvelle');
    try {
      const [progs, cons, forms, schools, users] = await Promise.all([
        firstValueFrom(this.http.get<ProgramAdmin[]>('/api/admin/programs')),
        firstValueFrom(this.http.get<UserBrief[]>('/api/admin/users?role=CONSEILLER_PEDAGOGIQUE')),
        firstValueFrom(this.http.get<UserBrief[]>('/api/admin/users?role=FORMATEUR')),
        firstValueFrom(this.http.get<School[]>('/api/admin/schools')),
        firstValueFrom(this.http.get<UserBrief[]>('/api/admin/users')),
      ]);
      this.programs.set(progs);
      this.facilitators.set([...cons, ...forms]);
      this.schools.set(schools);
      this.allUsers.set(users);
      if (this.isNew()) {
        this.c.programId = progs[0]?.id ?? null;
      } else {
        const x = await firstValueFrom(this.http.get<ClassroomAdmin>(`/api/admin/classrooms/${this.id()}`));
        this.load(x);
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private load(x: ClassroomAdmin): void {
    this.saved.set(x);
    this.c = { name: x.name, programId: x.programId, facilitatorId: x.facilitatorId, startDate: x.startDate, endDate: x.endDate,
      unlockMode: x.unlockMode, unlockIntervalDays: x.unlockIntervalDays, leaderboardMode: x.leaderboardMode,
      pointsPerLesson: x.pointsPerLesson, pointsPerQuizPercent: x.pointsPerQuizPercent, pointsPerPortfolio: x.pointsPerPortfolio,
      pointsPerPost: x.pointsPerPost, meetingUrl: x.meetingUrl ?? '' };
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      if (this.isNew()) {
        const x = await firstValueFrom(this.http.post<ClassroomAdmin>('/api/admin/classrooms', this.c));
        this.isNew.set(false);
        this.load(x);
        await this.router.navigate(['/admin/classes', x.id], { replaceUrl: true });
      } else {
        this.load(await firstValueFrom(this.http.put<ClassroomAdmin>(`/api/admin/classrooms/${this.saved()!.id}`, this.c)));
      }
      this.toast.show({ icon: 'check-circle', title: 'Classe enregistrée', text: 'Code : ' + this.saved()!.inviteCode });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async addFiltered(): Promise<void> {
    try {
      const before = this.saved()!.memberIds.length;
      this.load(await firstValueFrom(this.http.post<ClassroomAdmin>(`/api/admin/classrooms/${this.saved()!.id}/members`,
        { region: this.fRegion || null, schoolId: this.fSchool, cohort: this.fCohort || null })));
      this.toast.show({ icon: 'users', title: `${this.saved()!.memberIds.length - before} membre(s) ajouté(s)` }, 2500);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async remove(userId: number): Promise<void> {
    try {
      this.load(await firstValueFrom(this.http.delete<ClassroomAdmin>(`/api/admin/classrooms/${this.saved()!.id}/members/${userId}`)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async close(): Promise<void> {
    if (!window.confirm('Clôturer la classe ? Le classement sera figé et les certificats de parcours délivrés.')) return;
    try {
      this.load(await firstValueFrom(this.http.post<ClassroomAdmin>(`/api/admin/classrooms/${this.saved()!.id}/close`, {})));
      this.toast.show({ icon: 'trophy', title: 'Classe clôturée', text: 'Podium figé, certificats délivrés', celebrate: true });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s;
  }

  roleLabel(r: string): string {
    return ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r;
  }
}
