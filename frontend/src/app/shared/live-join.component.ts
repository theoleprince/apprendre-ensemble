import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../core/auth.service';
import { IconComponent } from './icon.component';

/** Fournisseurs de visioconference integrables dans la plateforme (autorises par la politique de securite du contenu). */
const EMBEDDABLE = ['meet.jit.si'];

/**
 * Bouton "Rejoindre" d'une seance en direct.
 * Jitsi : la seance s'ouvre dans la plateforme, nom de l'apprenant pre-rempli, sans compte ni installation.
 * Autre outil (BigBlueButton, Teams...) : ouverture dans un nouvel onglet.
 */
@Component({
  selector: 'app-live-join',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (embeddable()) {
      <button type="button" class="primary" (click)="open.set(true)"><app-icon name="video" /> {{ label() }}</button>
      <a class="btn ghost" [href]="url()" target="_blank" rel="noopener" title="Ouvrir dans un nouvel onglet"><app-icon name="link" [size]="16" /></a>
    } @else {
      <a class="btn primary" [href]="url()" target="_blank" rel="noopener"><app-icon name="video" /> {{ label() }}</a>
    }
    @if (open()) {
      <div class="modal-scrim live-scrim">
        <div class="modal live-modal" role="dialog" aria-modal="true" [attr.aria-label]="title() || 'Séance en direct'">
          <div class="row" style="justify-content:space-between">
            <div><span class="xs muted">Séance en direct</span><h3 style="margin:0">{{ title() || 'Visioconférence' }}</h3></div>
            <button class="primary" (click)="open.set(false)"><app-icon name="x" /> Quitter</button>
          </div>
          <iframe [src]="safe()" allow="camera; microphone; fullscreen; display-capture; autoplay" title="Visioconférence"></iframe>
          <p class="xs muted">Connexion faible ? Coupez votre caméra : le son seul consomme beaucoup moins de données.</p>
        </div>
      </div>
    }
  `,
})
export class LiveJoinComponent {
  private sanitizer = inject(DomSanitizer);
  private auth = inject(AuthService);
  readonly url = input.required<string>();
  readonly title = input<string | null>(null);
  readonly label = input('Rejoindre');
  protected open = signal(false);

  protected embeddable = computed(() => {
    try {
      const u = new URL(this.url());
      return u.protocol === 'https:' && EMBEDDABLE.includes(u.hostname);
    } catch {
      return false;
    }
  });

  /** Nom affiche pre-rempli, page d'attente sautee : on arrive directement dans la salle. */
  protected safe = computed<SafeResourceUrl>(() => {
    const name = (this.auth.user()?.fullName ?? '').replace(/"/g, '');
    const u = new URL(this.url());
    u.hash = `config.prejoinPageEnabled=false&config.startWithVideoMuted=true&userInfo.displayName="${encodeURIComponent(name)}"`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(u.toString());
  });
}
