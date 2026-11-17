import { Component, OnDestroy, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '../core/i18n';
import { PrefsService } from '../core/prefs.service';
import { IconComponent } from './icon.component';

/**
 * Lecture a voix haute (synthese vocale de l'appareil, fonctionne hors ligne) :
 * aide les publics a faible litteratie a utiliser les contenus texte.
 */
@Component({
  selector: 'app-speak',
  imports: [IconComponent, TranslatePipe],
  template: `
    @if (supported) {
      <button type="button" class="icon-btn" [class.sun]="speaking()" (click)="toggle()"
              [attr.aria-label]="(speaking() ? 'action.stop' : 'action.listen') | t" [title]="(speaking() ? 'action.stop' : 'action.listen') | t">
        <app-icon [name]="speaking() ? 'pause' : 'volume'" />
        @if (label()) { <span>{{ (speaking() ? 'action.stop' : 'action.listen') | t }}</span> }
      </button>
    }
  `,
})
export class SpeakButtonComponent implements OnDestroy {
  private prefs = inject(PrefsService);
  readonly text = input.required<string>();
  readonly label = input(false);
  readonly supported = 'speechSynthesis' in window;
  speaking = signal(false);

  toggle(): void {
    if (this.speaking()) {
      speechSynthesis.cancel();
      this.speaking.set(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(this.text().replace(/\*\*/g, '').replace(/^[-*]\s+/gm, ''));
    const lang = this.prefs.prefs().lang === 'en' ? 'en' : 'fr';
    u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    u.rate = this.prefs.prefs().voiceRate;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang));
    if (voice) u.voice = voice;
    u.onend = () => this.speaking.set(false);
    u.onerror = () => this.speaking.set(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    this.speaking.set(true);
  }

  ngOnDestroy(): void {
    if (this.speaking()) speechSynthesis.cancel();
  }
}
