import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Presentation } from '../core/models';
import { IconComponent } from './icon.component';

export function emptyPresentation(): Presentation {
  return { level: 'DEBUTANT', objectives: [], prerequisites: null, authorName: null, authorTitle: null, authorBio: null, faq: [] };
}

/** Saisie de la presentation publique d'un cours ou d'une formation : niveau, objectifs, prerequis, equipe, FAQ. */
@Component({
  selector: 'app-presentation-editor',
  imports: [FormsModule, IconComponent],
  template: `
    @let p = value();
    <section class="card section">
      <h2>Page de présentation</h2>
      <p class="small muted">Ce que voit un visiteur avant de s'inscrire. Des objectifs concrets et une équipe identifiée augmentent fortement les inscriptions.</p>
      <div class="field-row">
        <label>Niveau
          <select [(ngModel)]="p.level" [ngModelOptions]="{ standalone: true }">
            <option value="DEBUTANT">Débutant</option><option value="INTERMEDIAIRE">Intermédiaire</option><option value="AVANCE">Avancé</option>
          </select></label>
        <label>Prérequis <input [(ngModel)]="p.prerequisites" [ngModelOptions]="{ standalone: true }" placeholder="vide = aucun prérequis" maxlength="1000" /></label>
      </div>
      <fieldset><legend>Ce que l'apprenant saura faire (3 à 6 objectifs)</legend>
        @for (o of p.objectives; track $index; let i = $index) {
          <div class="row" style="flex-wrap:nowrap;margin-bottom:.4rem">
            <input [(ngModel)]="p.objectives[i]" [ngModelOptions]="{ standalone: true }" maxlength="300" placeholder="Ex. : Mener une médiation entre élèves" style="margin:0" />
            <button type="button" class="ghost icon-btn" (click)="p.objectives.splice(i, 1)" aria-label="Retirer l'objectif"><app-icon name="x" [size]="16" /></button>
          </div>
        }
        @if (p.objectives.length < 12) { <button type="button" class="link" (click)="p.objectives.push('')">+ objectif</button> }
      </fieldset>
      <fieldset><legend>Équipe pédagogique</legend>
        <div class="field-row">
          <label>Nom <input [(ngModel)]="p.authorName" [ngModelOptions]="{ standalone: true }" maxlength="255" /></label>
          <label>Fonction <input [(ngModel)]="p.authorTitle" [ngModelOptions]="{ standalone: true }" maxlength="255" /></label>
        </div>
        <label>Présentation <textarea rows="2" [(ngModel)]="p.authorBio" [ngModelOptions]="{ standalone: true }" maxlength="1000"></textarea></label>
      </fieldset>
      <fieldset><legend>Questions fréquentes propres à ce contenu</legend>
        @for (f of p.faq; track $index; let i = $index) {
          <div class="card flat" style="margin-bottom:.5rem">
            <div class="row" style="flex-wrap:nowrap">
              <input [(ngModel)]="f.question" [ngModelOptions]="{ standalone: true }" placeholder="Question" maxlength="500" style="margin:0" />
              <button type="button" class="ghost icon-btn" (click)="p.faq.splice(i, 1)" aria-label="Retirer la question"><app-icon name="x" [size]="16" /></button>
            </div>
            <textarea rows="2" [(ngModel)]="f.answer" [ngModelOptions]="{ standalone: true }" placeholder="Réponse" maxlength="2000"></textarea>
          </div>
        }
        <button type="button" class="link" (click)="p.faq.push({ question: '', answer: '' })">+ question fréquente</button>
        <p class="xs muted">Les questions générales (gratuité, hors connexion, certificat…) sont ajoutées automatiquement.</p>
      </fieldset>
    </section>
  `,
})
export class PresentationEditorComponent {
  readonly value = input.required<Presentation>();
}
