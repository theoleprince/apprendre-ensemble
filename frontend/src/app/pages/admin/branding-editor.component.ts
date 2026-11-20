import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/auth.interceptor';
import { Branding, BrandingService, contrast } from '../../core/branding.service';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';

/**
 * Charte graphique sans developpement : nom, organisation, logo, couleurs, signataires des certificats.
 * Apercu en direct et controle d'accessibilite des couleurs (contraste AA) avant enregistrement.
 */
@Component({
  selector: 'app-branding-editor',
  imports: [FormsModule, IconComponent],
  template: `
    <section class="card">
      <h2><app-icon name="styles" /> Identité visuelle</h2>
      <p class="small muted">Appliquée immédiatement au site, aux e-mails, aux certificats PDF et aux badges numériques. Le logo et les couleurs doivent provenir de la charte graphique fournie par le client.</p>
      <div class="field-row">
        <label>Nom de la plateforme <input [(ngModel)]="b.name" name="bn" required maxlength="255" (ngModelChange)="touch()" /></label>
        <label>Organisation éditrice <input [(ngModel)]="b.organization" name="bo" maxlength="255" placeholder="ex. le nom de la fondation" (ngModelChange)="touch()" /></label>
      </div>
      <label>Accroche <input [(ngModel)]="b.tagline" name="bt" maxlength="300" (ngModelChange)="touch()" /></label>
      <div class="field-row">
        <label>Adresse de contact <input type="email" [(ngModel)]="b.supportEmail" name="be" maxlength="255" /></label>
        <label>Mention de bas de page <input [(ngModel)]="b.footerNote" name="bf" maxlength="255" placeholder="ex. plateforme de démonstration" (ngModelChange)="touch()" /></label>
      </div>

      <fieldset><legend>Logo</legend>
        <div class="row">
          @if (b.logoUrl) { <img [src]="b.logoUrl" alt="Logo actuel" class="logo-preview" /> }
          <label class="btn" [class.disabled]="uploading()"><app-icon name="upload" /> {{ uploading() ? 'Envoi…' : b.logoUrl ? 'Changer le logo' : 'Téléverser le logo' }}
            <input type="file" accept="image/png,image/jpeg" hidden (change)="upload($event)" /></label>
          @if (b.logoUrl) { <button type="button" class="btn ghost" (click)="b.logoUrl = null; touch()"><app-icon name="x" /> Retirer</button> }
        </div>
        <p class="xs muted">PNG ou JPEG, fond transparent de préférence, hauteur affichée 36 px.</p>
      </fieldset>

      <fieldset><legend>Couleurs</legend>
        <div class="field-row">
          <label>Couleur principale (boutons, liens, en-têtes)
            <span class="row" style="flex-wrap:nowrap"><input type="color" [(ngModel)]="b.primaryColor" name="bp" (ngModelChange)="touch()" style="width:56px;padding:2px" />
              <input [(ngModel)]="b.primaryColor" name="bp2" pattern="^#[0-9a-fA-F]{6}$" (ngModelChange)="touch()" style="margin:0" /></span></label>
          <label>Couleur d'accent (boutons secondaires, mises en avant)
            <span class="row" style="flex-wrap:nowrap"><input type="color" [(ngModel)]="b.accentColor" name="ba" (ngModelChange)="touch()" style="width:56px;padding:2px" />
              <input [(ngModel)]="b.accentColor" name="ba2" pattern="^#[0-9a-fA-F]{6}$" (ngModelChange)="touch()" style="margin:0" /></span></label>
        </div>
        <div class="row small">
          <span [class.ok-text]="primaryOk()" [class.error]="!primaryOk()"><app-icon [name]="primaryOk() ? 'check-circle' : 'alert'" [size]="16" /> Texte blanc sur la couleur principale : {{ primaryRatio() }}:1</span>
          <span [class.ok-text]="accentOk()" [class.error]="!accentOk()"><app-icon [name]="accentOk() ? 'check-circle' : 'alert'" [size]="16" /> Texte sombre sur l'accent : {{ accentRatio() }}:1</span>
        </div>
        <p class="xs muted">Minimum exigé : 4,5:1 (WCAG AA). Une couleur trop claire est refusée : prenez la variante foncée de la charte.</p>
      </fieldset>

      <fieldset><legend>Signataires des certificats</legend>
        <div class="field-row">
          <label>Signataire 1 <input [(ngModel)]="b.signatory1" name="s1" maxlength="255" /></label>
          <label>Fonction <input [(ngModel)]="b.signatory1Role" name="s1r" maxlength="255" /></label>
        </div>
        <div class="field-row">
          <label>Signataire 2 <input [(ngModel)]="b.signatory2" name="s2" maxlength="255" /></label>
          <label>Fonction <input [(ngModel)]="b.signatory2Role" name="s2r" maxlength="255" /></label>
        </div>
      </fieldset>

      <h3>Aperçu</h3>
      <div class="brand-preview" [style.--pv]="b.primaryColor" [style.--pa]="b.accentColor">
        <div class="bp-top">
          @if (b.logoUrl) { <img [src]="b.logoUrl" alt="" /> } @else { <span class="bp-mark"><app-icon name="sprout" [size]="18" /></span> }
          <strong>{{ b.name || 'Nom de la plateforme' }}</strong>
        </div>
        <div class="bp-body">
          <strong>{{ b.tagline || 'Des formations courtes et certifiantes' }}</strong>
          <div class="row"><span class="bp-btn">S'inscrire</span><span class="bp-btn alt">Découvrir</span></div>
        </div>
      </div>

      <div class="row section">
        <button class="primary" (click)="save()" [disabled]="saving() || !primaryOk() || !accentOk() || !b.name">{{ saving() ? 'Enregistrement…' : 'Enregistrer la charte' }}</button>
        <button class="btn ghost" (click)="reset()">Annuler les modifications</button>
      </div>
    </section>
  `,
})
export class BrandingEditorComponent {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private branding = inject(BrandingService);
  protected b: Branding = { ...this.branding.brand() };
  protected saving = signal(false);
  protected uploading = signal(false);
  private rev = signal(0);

  protected primaryRatio = computed(() => (this.rev(), this.ratio(this.b.primaryColor, '#ffffff')));
  protected accentRatio = computed(() => (this.rev(), this.ratio(this.b.accentColor, '#2b2200')));
  protected primaryOk = computed(() => Number(this.primaryRatio()) >= 4.5);
  protected accentOk = computed(() => Number(this.accentRatio()) >= 4.5);

  constructor() {
    void this.branding.refresh().then(() => this.reset());
  }

  touch(): void {
    this.rev.update((v) => v + 1);
  }

  reset(): void {
    this.b = { ...this.branding.brand() };
    this.touch();
  }

  private ratio(c: string, other: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(c ?? '') ? contrast(c, other).toFixed(1) : '0';
  }

  async upload(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    this.uploading.set(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      this.b.logoUrl = (await firstValueFrom(this.http.post<{ url: string }>('/api/media', fd))).url;
      this.touch();
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Logo non envoyé', text: errorMessage(e) }, 4000);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(this.http.put<Branding>('/api/admin/branding', this.b));
      this.branding.set(saved);
      this.reset();
      this.toast.show({ icon: 'check-circle', title: 'Charte enregistrée', text: 'Appliquée au site, aux certificats et aux badges.' }, 3000);
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Charte refusée', text: errorMessage(e) }, 6000);
    } finally {
      this.saving.set(false);
    }
  }
}
