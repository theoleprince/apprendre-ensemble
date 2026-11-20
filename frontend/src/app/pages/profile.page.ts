import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { TranslatePipe } from '../core/i18n';
import { LearningService } from '../core/learning.service';
import { MediaCacheService } from '../core/media-cache.service';
import { ROLE_ICONS, ROLE_LABELS, formatBytes } from '../core/models';
import { PrefsService } from '../core/prefs.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/visuals';

@Component({
  selector: 'app-profile',
  imports: [IconComponent, TranslatePipe, AvatarComponent, FormsModule],
  template: `
    @if (auth.user(); as u) {
      <section class="card row">
        <app-avatar [name]="u.fullName" [size]="64" />
        <div class="grow" style="flex:1"><h1 style="margin:0">{{ u.fullName }}</h1>
          <div class="muted small">{{ labels[u.role] }} · {{ u.countryCode }} @if (u.region) {· {{ u.region }}}</div>
          <div class="muted xs">{{ u.email }}</div></div>
      </section>
    }

    <section class="card section">
      <h2><app-icon name="eye" /> Accessibilité</h2>
      <div class="row" style="justify-content:space-between">
        <span><app-icon name="type" /> Taille du texte</span>
        <div class="speed">
          @for (s of scales; track s.v) { <button [class.active]="prefs.prefs().textScale === s.v" (click)="prefs.update({ textScale: s.v })" [style.font-size.px]="12 * s.v">{{ s.l }}</button> }
        </div>
      </div>
      <label class="check section"><input type="checkbox" [checked]="prefs.prefs().highContrast" (change)="prefs.update({ highContrast: !prefs.prefs().highContrast })" />
        <span><strong>Contraste renforcé</strong><br /><span class="small muted">Pour une meilleure lisibilité au soleil ou en cas de vue faible.</span></span></label>
      <label class="check"><input type="checkbox" [checked]="prefs.prefs().dataSaver" (change)="prefs.update({ dataSaver: !prefs.prefs().dataSaver })" />
        <span><strong>Économie de données</strong><br /><span class="small muted">Les vidéos et audios ne se chargent que sur votre demande, avec leur poids affiché.</span></span></label>
      <div class="row" style="justify-content:space-between">
        <span><app-icon name="volume" /> Vitesse de lecture à voix haute</span>
        <div class="speed">@for (r of [0.8, 0.95, 1.1]; track r) { <button [class.active]="prefs.prefs().voiceRate === r" (click)="prefs.update({ voiceRate: r })">{{ r === 0.8 ? 'Lente' : r === 0.95 ? 'Normale' : 'Rapide' }}</button> }</div>
      </div>
    </section>

    <section class="card section">
      <h2><app-icon name="download" /> Stockage sur l'appareil</h2>
      <p class="small muted">{{ learning.downloaded().size }} module(s) téléchargé(s) · {{ usage() }}</p>
      <div class="row">
        <button (click)="sync()" [disabled]="!learning.online() || learning.syncing()"><app-icon name="sync" /> Synchroniser maintenant</button>
        <button class="danger" (click)="clearMedia()"><app-icon name="trash" /> Libérer l'espace des vidéos</button>
      </div>
      @if (learning.lastSync(); as d) { <p class="xs muted">Dernière synchronisation : {{ d.toLocaleString() }}</p> }
    </section>

    <section class="card section">
      <h2><app-icon name="shield" /> Mes données</h2>
      <p class="small">Vos données sont hébergées en Suisse / Union européenne (RGPD, nLPD). Votre progression est utilisée pour votre suivi
        et, sans nom ni email, pour l'évaluation du programme. Les données de cet appareil sont effacées à la déconnexion.</p>
      <div class="row">
        <button (click)="exportData()"><app-icon name="download" /> Télécharger mes données</button>
        <button (click)="logoutEverywhere()"><app-icon name="shield" /> Me déconnecter de tous les appareils</button>
        <button class="danger" (click)="logout()"><app-icon name="logout" /> {{ 'action.logout' | t }}</button>
      </div>
      <details class="section">
        <summary class="small" style="cursor:pointer;min-height:36px">Supprimer mon compte</summary>
        <p class="small">Vos données personnelles (nom, e-mail, portfolio, vidéos, messages, certificats) seront effacées définitivement.
          Votre progression est conservée sans aucun moyen de vous identifier, pour les statistiques du programme.</p>
        <div class="row">
          <input type="password" [(ngModel)]="deletePwd" name="dp" placeholder="Votre mot de passe" autocomplete="current-password" style="max-width:260px" />
          <button class="danger" (click)="deleteAccount()" [disabled]="!deletePwd">Supprimer définitivement</button>
        </div>
      </details>
    </section>
  `,
})
export class ProfilePage implements OnInit {
  protected auth = inject(AuthService);
  protected learning = inject(LearningService);
  protected prefs = inject(PrefsService);
  private media = inject(MediaCacheService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  deletePwd = '';

  labels = ROLE_LABELS;
  icons = ROLE_ICONS;
  scales = [{ v: 1, l: 'A' }, { v: 1.15, l: 'A' }, { v: 1.3, l: 'A' }];
  usage = signal('');

  async ngOnInit(): Promise<void> {
    const e = await this.media.estimate();
    this.usage.set(e ? `${formatBytes(e.usage)} utilisés` : '');
  }

  async sync(): Promise<void> {
    await this.learning.sync();
    this.toast.show({ icon: 'sync', title: 'Synchronisation terminée' }, 2500);
  }

  async clearMedia(): Promise<void> {
    await this.media.clear();
    await this.ngOnInit();
    this.toast.show({ icon: 'trash', title: 'Vidéos et audios supprimés de l’appareil' }, 3000);
  }

  async exportData(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get('/api/me/export'));
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mes-donnees.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Export impossible', text: errorMessage(e) }, 4000);
    }
  }

  async logoutEverywhere(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/me/logout-everywhere', {}));
      await this.media.clear();
      await this.auth.logout();
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Action impossible', text: errorMessage(e) }, 4000);
    }
  }

  async deleteAccount(): Promise<void> {
    if (!window.confirm('Supprimer définitivement votre compte et vos données personnelles ?')) return;
    try {
      await firstValueFrom(this.http.post('/api/me/delete', { password: this.deletePwd }));
      await this.media.clear();
      await this.auth.logout();
    } catch (e) {
      this.toast.show({ icon: 'alert', title: 'Suppression refusée', text: errorMessage(e) }, 5000);
    }
  }

  async logout(): Promise<void> {
    if (this.learning.pending() > 0) await this.learning.sync();
    if (this.learning.pending() > 0) {
      this.toast.show({ icon: 'alert', title: 'Progression non envoyée', text: 'Connectez-vous à Internet avant de vous déconnecter, sinon elle serait perdue.' }, 7000);
      return;
    }
    await this.media.clear();
    await this.auth.logout();
  }
}
