import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { CourseInput, Domain, LessonInput, MediaUpload, ROLE_LABELS, Referentiel, Role, formatBytes } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AudienceService } from '../../core/audience.service';
import { IconComponent } from '../../shared/icon.component';
import { CoverComponent } from '../../shared/visuals';
import { PresentationEditorComponent, emptyPresentation } from '../../shared/presentation-editor.component';
import { QUESTION_KINDS, QuestionInput, QuestionKind } from '../../core/models';


@Component({
  selector: 'app-course-editor',
  imports: [FormsModule, RouterLink, IconComponent, CoverComponent, PresentationEditorComponent],
  template: `
    <a routerLink="/admin/modules" class="back"><app-icon name="back" [size]="18" /> Modules</a>
    <h1>{{ isNew() ? 'Nouveau module' : 'Modifier le module' }}</h1>
    @if (!isNew()) { <p class="notice info small">Chaque enregistrement publie une nouvelle version : les appareils hors ligne la téléchargent à la prochaine connexion. La progression existante est conservée.</p> }
    @if (error()) { <p class="error">{{ error() }}</p> }

    @if (ref(); as r) {
      <form (ngSubmit)="save()" #f="ngForm">
        <section class="card">
          <div class="field-row">
            <label style="flex:0 0 220px">Pictogramme
              <select name="icon" [(ngModel)]="c.icon">@for (i of courseIcons; track i) {<option [value]="i">{{ i }}</option>}</select></label>
            <app-cover [icon]="c.icon" [seed]="isNew() ? 0 : +id()" [height]="70" style="width:140px;border-radius:12px;align-self:flex-end;margin-bottom:.85rem" />
            <label>Titre <input name="title" [(ngModel)]="c.title" required /></label>
          </div>
          <label>Description <textarea name="desc" rows="2" [(ngModel)]="c.description"></textarea></label>
          <label>Prix d'inscription (FCFA, 0 = gratuit) <input type="number" name="price" min="0" step="500" [(ngModel)]="c.price" /></label>
          <label>Domaine de compétences <select name="dom" [(ngModel)]="c.domainId"><option [ngValue]="null">—</option>@for (d of domains(); track d.id) {<option [ngValue]="d.id">{{ d.name }}</option>}</select></label>
          <div class="field-row">
            <label>Parcours <select name="type" [(ngModel)]="c.type"><option value="THEORIQUE">Théorique (LMS)</option><option value="PRATIQUE">Pratique (LXP)</option></select></label>
            <label>Pays <select name="country" [(ngModel)]="c.countryCode"><option [ngValue]="null">Tous</option>@for (x of r.countries; track x.code) {<option [ngValue]="x.code">{{ x.name }}</option>}</select></label>
            <label>Langue <select name="lang" [(ngModel)]="c.languageCode"><option [ngValue]="null">Toutes</option>@for (x of r.languages; track x.code) {<option [ngValue]="x.code">{{ x.name }}</option>}</select></label>
          </div>
          <fieldset><legend>Publics</legend>
            @for (role of roles(); track role) {
              <label class="check inline"><input type="checkbox" [checked]="c.targetRoles.includes(role)" (change)="toggleRole(role)" /> {{ aud.label(role) }}</label>
            }
          </fieldset>
          <fieldset><legend>Droits d'accès fins</legend>
            <div class="field-row">
              <label>Groupes RCT autorisés <input name="coh" [(ngModel)]="cohorts" placeholder="vide = tous · ex. TRAITEMENT" /></label>
              <label>Zones autorisées <input name="reg" [(ngModel)]="regions" placeholder="vide = toutes · ex. Borgou, Alibori" /></label>
            </div>
          </fieldset>
          <fieldset><legend>Critères de certification</legend>
            <div class="field-row">
              <label>Badge : score ≥ (%) <input type="number" name="pass" min="0" max="100" [(ngModel)]="c.passScore" /></label>
              <label>Maîtrise : score ≥ (%) <input type="number" name="mast" min="0" max="100" [(ngModel)]="c.masteryScore" /></label>
            </div>
            <label class="check"><input type="checkbox" name="exp" [(ngModel)]="c.expertiseEnabled" /> Certification d'expertise sur portfolio validé par un mentor</label>
          </fieldset>
          <label class="check"><input type="checkbox" name="pub" [(ngModel)]="c.published" /> Publié</label>
        </section>

        <h2 class="section">Leçons</h2>
        @for (l of c.lessons; track $index; let i = $index) {
          <section class="card" style="margin-bottom:1rem">
            <div class="section-head"><strong>Leçon {{ i + 1 }}</strong>
              <div class="row">
                <button type="button" class="ghost icon-btn" [disabled]="i === 0" (click)="move(i, -1)" title="Monter">↑</button>
                <button type="button" class="ghost icon-btn danger" (click)="c.lessons.splice(i, 1)" title="Supprimer"><app-icon name="trash" [size]="18" /></button>
              </div></div>
            <label>Titre <input [name]="'lt' + i" [(ngModel)]="l.title" required /></label>
            <div class="chips" style="margin-bottom:.8rem">
              @for (t of types; track t.v) { <button type="button" [class.active]="l.mediaType === t.v" (click)="l.mediaType = t.v"><app-icon [name]="t.icon" [size]="16" /> {{ t.l }}</button> }
            </div>
            @if (l.mediaType !== 'TEXT') {
              <div class="field-row">
                <label>{{ l.mediaType === 'VIDEO' ? 'Vidéo (MP4, 480p conseillé)' : 'Audio (MP3 mono 32-64 kbit/s)' }}
                  <input type="file" [accept]="l.mediaType === 'VIDEO' ? 'video/mp4,video/webm' : 'audio/*'" (change)="upload($event, l, 'media')" /></label>
                @if (l.mediaType === 'VIDEO') {
                  <label>Sous-titres (WebVTT) <input type="file" accept=".vtt,text/vtt" (change)="upload($event, l, 'vtt')" /></label>
                }
              </div>
              @if (uploading()) { <p class="small muted">Envoi en cours…</p> }
              @if (l.mediaUrl) { <p class="small"><app-icon name="check" [size]="14" /> {{ l.mediaUrl }} · {{ size(l.mediaSizeBytes) }} @if (l.subtitlesUrl) {· sous-titres ajoutés}</p> }
            }
            <label>{{ l.mediaType === 'TEXT' ? 'Contenu (texte, **gras**, listes « - »)' : 'Transcription (obligatoire pour l’accessibilité et le hors ligne léger)' }}
              <textarea [name]="'lc' + i" rows="6" [(ngModel)]="l.content"></textarea></label>
            <div class="field-row">
              <label>Mise en pratique (portfolio, facultatif) <textarea [name]="'lp' + i" rows="2" [(ngModel)]="l.practiceTask"></textarea></label>
              <label style="flex:0 0 130px">Durée (min) <input type="number" min="0" [name]="'ld' + i" [(ngModel)]="l.durationMinutes" /></label>
            </div>
          </section>
        }
        <button type="button" (click)="addLesson()"><app-icon name="plus" /> Ajouter une leçon</button>

        <h2 class="section">Quiz et évaluation finale</h2>
        <p class="small muted">Chaque question peut servir de quiz juste après une leçon (l'apprenant doit la réussir pour continuer). Toutes les questions composent l'évaluation finale.</p>
        @for (q of c.questions; track $index; let i = $index) {
          <section class="card" style="margin-bottom:1rem">
            <div class="section-head"><strong>Question {{ i + 1 }}</strong>
              <button type="button" class="ghost icon-btn danger" (click)="c.questions.splice(i, 1)"><app-icon name="trash" [size]="18" /></button></div>
            <div class="field-row">
              <label style="flex:0 0 240px">Type d'exercice
                <select [name]="'qk' + i" [ngModel]="q.kind || 'SINGLE'" (ngModelChange)="setKind(q, $event)">
                  @for (k of kinds; track k.key) { <option [value]="k.key">{{ k.label }}</option> }
                </select></label>
              <label>Énoncé <input [name]="'q' + i" [(ngModel)]="q.question" required [placeholder]="q.kind === 'FILL_BLANK' ? 'Ex. : Je reste ___ face à la colère' : ''" /></label>
            </div>
            <p class="xs muted" style="margin-top:-.4rem">{{ kindHint(q.kind) }}</p>
            @if (q.kind === 'SCENARIO') {
              <label>Mise en situation <textarea [name]="'qx' + i" rows="2" [(ngModel)]="q.context" maxlength="2000"></textarea></label>
            }
            <label>Quiz après la leçon
              <select [name]="'ql' + i" [(ngModel)]="q.lessonPosition">
                <option [ngValue]="null">Aucune (évaluation finale seulement)</option>
                @for (l of c.lessons; track $index; let k = $index) { <option [ngValue]="k + 1">Leçon {{ k + 1 }} · {{ l.title || 'sans titre' }}</option> }
              </select></label>
            @for (o of q.options; track $index; let j = $index) {
              <div class="row" style="flex-wrap:nowrap;margin-bottom:.4rem">
                @if (q.kind === 'ORDER' || q.kind === 'MATCH') { <span class="sy-n" style="width:28px;height:28px">{{ j + 1 }}</span> }
                @else { <input type="radio" [name]="'qc' + i" [value]="j" [(ngModel)]="q.correctIndex" title="Bonne réponse" /> }
                <input [name]="'qo' + i + '_' + j" [(ngModel)]="q.options[j]" required style="margin:0" [readonly]="q.kind === 'TRUE_FALSE'"
                       [placeholder]="q.kind === 'MATCH' ? 'élément de gauche :: élément de droite' : ''" />
                @if (q.options.length > 2 && q.kind !== 'TRUE_FALSE') { <button type="button" class="ghost icon-btn" (click)="removeOption(i, j)"><app-icon name="x" [size]="16" /></button> }
              </div>
            }
            @if (q.kind !== 'TRUE_FALSE' && q.options.length < 9) { <button type="button" class="link" (click)="q.options.push('')">+ {{ q.kind === 'ORDER' ? 'élément' : q.kind === 'MATCH' ? 'paire' : 'option' }}</button> }
            <label class="section">Explication affichée après correction <input [name]="'qe' + i" [(ngModel)]="q.explanation" /></label>
          </section>
        }
        <button type="button" (click)="addQuestion()"><app-icon name="plus" /> Ajouter une question</button>

        <app-presentation-editor [value]="c.presentation!" />

        <div class="lesson-nav">
          <button class="primary grow lg" type="submit" [disabled]="f.invalid || saving() || !c.targetRoles.length">{{ saving() ? 'Enregistrement…' : 'Enregistrer et publier' }}</button>
        </div>
      </form>
    }
  `,
})
export class CourseEditorPage implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly id = input.required<string>();
  labels = ROLE_LABELS;
  courseIcons = ['book-open', 'cloud-sun', 'handshake', 'family', 'smartphone', 'school', 'heart', 'compass', 'graduation', 'sprout', 'lightbulb', 'users', 'target', 'shield', 'globe', 'wrench'];
  protected aud = inject(AudienceService);
  roles = computed(() => this.aud.list().filter((a) => a.active).map((a) => a.code));
  types = [
    { v: 'TEXT' as const, l: 'Texte', icon: 'text' },
    { v: 'AUDIO' as const, l: 'Audio', icon: 'headphones' },
    { v: 'VIDEO' as const, l: 'Vidéo', icon: 'video' },
  ];
  ref = signal<Referentiel | null>(null);
  domains = signal<Domain[]>([]);
  error = signal('');
  saving = signal(false);
  uploading = signal(false);
  isNew = signal(true);
  cohorts = '';
  regions = '';
  c: CourseInput = {
    title: '', description: '', icon: 'book-open', type: 'THEORIQUE', countryCode: null, languageCode: 'fr', targetRoles: ['ENSEIGNANT'],
    allowedCohorts: [], allowedRegions: [], passScore: 70, masteryScore: 85, expertiseEnabled: true, published: false, lessons: [], questions: [], domainId: null, price: 0,
    presentation: emptyPresentation(),
  };
  kinds = QUESTION_KINDS;

  kindHint(k: QuestionKind | undefined): string {
    return QUESTION_KINDS.find((x) => x.key === (k ?? 'SINGLE'))?.hint ?? '';
  }

  setKind(q: QuestionInput, k: QuestionKind): void {
    q.kind = k;
    if (k === 'TRUE_FALSE') {
      q.options = ['Vrai', 'Faux'];
      if (q.correctIndex > 1) q.correctIndex = 0;
    }
    if (k === 'MATCH') q.options = q.options.map((o) => (o.includes('::') ? o : o + ' :: '));
    if (k !== 'SCENARIO') q.context = null;
  }

  async ngOnInit(): Promise<void> {
    this.isNew.set(this.id() === 'nouveau');
    try {
      this.ref.set(await firstValueFrom(this.http.get<Referentiel>('/api/referentiel')));
      this.domains.set(await firstValueFrom(this.http.get<Domain[]>('/api/admin/domains')));
      if (!this.isNew()) {
        this.c = await firstValueFrom(this.http.get<CourseInput>(`/api/admin/courses/${this.id()}`));
        this.c.presentation ??= emptyPresentation();
        this.cohorts = (this.c.allowedCohorts ?? []).join(', ');
        this.regions = (this.c.allowedRegions ?? []).join(', ');
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  toggleRole(r: string): void {
    this.c.targetRoles = this.c.targetRoles.includes(r) ? this.c.targetRoles.filter((x) => x !== r) : [...this.c.targetRoles, r];
  }

  addLesson(): void {
    this.c.lessons.push({ title: '', mediaType: 'TEXT', mediaUrl: null, mediaSizeBytes: 0, subtitlesUrl: null, content: '', practiceTask: null, durationMinutes: 10 });
  }

  addQuestion(): void {
    this.c.questions.push({ question: '', options: ['', ''], correctIndex: 0, explanation: null, lessonPosition: null, kind: 'SINGLE', context: null });
  }

  move(i: number, d: number): void {
    const l = this.c.lessons;
    [l[i], l[i + d]] = [l[i + d], l[i]];
  }

  removeOption(qi: number, oi: number): void {
    const q = this.c.questions[qi];
    q.options.splice(oi, 1);
    if (q.correctIndex >= q.options.length) q.correctIndex = 0;
  }

  size(b: number): string {
    return formatBytes(b);
  }

  async upload(ev: Event, l: LessonInput, kind: 'media' | 'vtt'): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await firstValueFrom(this.http.post<MediaUpload>('/api/media', fd));
      if (kind === 'media') {
        l.mediaUrl = r.url;
        l.mediaSizeBytes = r.sizeBytes;
      } else {
        l.subtitlesUrl = r.url;
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.uploading.set(false);
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const body = {
      ...this.c,
      allowedCohorts: split(this.cohorts),
      allowedRegions: split(this.regions),
      questions: this.c.questions.map((q) => ({ ...q, correctIndex: Number(q.correctIndex) })),
    };
    try {
      if (this.isNew()) {
        const created = await firstValueFrom(this.http.post<{ id: number }>('/api/admin/courses', body));
        await this.router.navigate(['/admin/modules', created.id]);
        this.isNew.set(false);
      } else {
        await firstValueFrom(this.http.put(`/api/admin/courses/${this.id()}`, body));
      }
      this.toast.show({ icon: 'check-circle', title: 'Module enregistré', text: 'Nouvelle version publiée' });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
