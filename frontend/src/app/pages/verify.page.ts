import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { errorMessage } from '../core/auth.interceptor';
import { LearningService } from '../core/learning.service';
import { Certificate } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { MedalComponent } from '../shared/visuals';

/** Page publique : un recruteur ou une autorite verifie l'authenticite d'un certificat (QR code, LinkedIn). */
@Component({
  selector: 'app-verify',
  imports: [DatePipe, IconComponent, MedalComponent],
  template: `
    <section class="card narrow center" style="max-width:520px">
      <div class="brand" style="justify-content:center;margin-bottom:1rem"><span class="brand-mark"><app-icon name="sprout" [size]="22" /></span> Apprendre Ensemble</div>
      @if (cert(); as c) {
        <app-medal [level]="c.level || 'EXPERTISE'" [size]="84" [earned]="!c.revokedAt" />
        @if (c.revokedAt) {
          <p class="pill off" style="margin:0 auto"><app-icon name="alert" [size]="16" /> Certificat révoqué le {{ c.revokedAt | date: 'dd/MM/yyyy' }}</p>
          <p class="error">Ce certificat n'est plus valide. @if (c.revokedReason) {Motif : {{ c.revokedReason }}}</p>
        } @else {
          <p class="pill" style="margin:0 auto"><app-icon name="check-circle" [size]="16" /> Certificat authentique</p>
        }
        <h1 style="margin-top:1rem">{{ c.learnerName }}</h1>
        <p>a obtenu le / la <strong>{{ c.levelLabel.toLowerCase() }}</strong> @if (c.level) {du module} @else {du parcours}</p>
        <h2>« {{ c.courseTitle }} »</h2>
        <p class="muted">le {{ c.issuedAt | date: 'dd/MM/yyyy' }} @if (c.level !== 'ATTESTATION') {· score {{ c.scorePercent }} %}</p>
        <p class="small muted">Code <span class="kbd">{{ c.code }}</span></p>
        @if (!c.revokedAt) { <a class="btn primary" [href]="'/api/public/certificates/' + c.code + '/pdf'" target="_blank" rel="noopener"><app-icon name="download" /> Télécharger le PDF</a> }
      } @else if (error()) {
        <div class="empty-icon clay"><app-icon name="alert" [size]="34" /></div>
        <p class="error">{{ error() }}</p>
      } @else {
        <div class="skeleton"></div>
      }
    </section>
  `,
})
export class VerifyPage implements OnInit {
  private learning = inject(LearningService);
  readonly code = input.required<string>();
  cert = signal<Certificate | null>(null);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.cert.set(await this.learning.verifyCertificate(this.code()));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

}
