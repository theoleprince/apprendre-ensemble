import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { CheckQuestion, Question, QuestionKind } from '../core/models';
import { IconComponent } from './icon.component';
import { SpeakButtonComponent } from './speak-button.component';

type AnyQuestion = Question | CheckQuestion;

export function kindOf(q: AnyQuestion): QuestionKind {
  return q.kind ?? 'SINGLE';
}

export function isArrangement(q: AnyQuestion): boolean {
  const k = kindOf(q);
  return k === 'ORDER' || k === 'MATCH';
}

/** Code "chiffres" d'un arrangement : [2,0,1] -> 312 (meme codage que le serveur). */
export function encode(indices: number[]): number {
  return indices.reduce((acc, i) => acc * 10 + i + 1, 0);
}

export function decode(code: number | undefined, n: number): number[] | null {
  if (code === undefined || code < 0) return null;
  const s = String(code);
  if (s.length !== n) return null;
  return [...s].map((c) => Number(c) - 1);
}

/** Solution d'un quiz de lecon (options recues dans l'ordre d'origine) : index, ou 1..n pour un arrangement. */
export function checkSolution(q: CheckQuestion): number {
  return isArrangement(q) ? encode(q.options.map((_, i) => i)) : q.correctIndex;
}

export function left(o: string): string {
  const i = o.indexOf('::');
  return i < 0 ? o : o.slice(0, i).trim();
}

export function right(o: string): string {
  const i = o.indexOf('::');
  return i < 0 ? '' : o.slice(i + 2).trim();
}

/** Melange stable (graine = id de la question), jamais l'identite. */
function shuffled(n: number, seed: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  let x = seed * 9301 + 49297;
  for (let i = n - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (n > 1 && a.every((v, i) => v === i)) a.push(a.shift()!);
  return a;
}

/**
 * Affiche un exercice, quel que soit son type, et renvoie une reponse entiere unique
 * (index choisi, ou code d'arrangement pour "remettre dans l'ordre" et "associer").
 * clientShuffle : les options arrivent dans l'ordre d'origine (quiz de lecon) et doivent etre melangees ici.
 */
@Component({
  selector: 'app-question',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpeakButtonComponent],
  template: `
    @let q = question();
    @if (q.context) {
      <div class="q-context"><app-icon name="quote" [size]="18" /><div><span class="xs">Mise en situation</span><p>{{ q.context }}</p></div></div>
    }
    <div class="q-head">
      @if (kind() === 'FILL_BLANK') {
        <p class="q-title">
          @for (part of blankParts(); track $index; let last = $last) {
            {{ part }}@if (!last) {<span class="q-blank" [class.filled]="value() !== undefined">{{ value() !== undefined ? q.options[value()!] : '      ' }}</span>}
          }
        </p>
      } @else {
        <p class="q-title">{{ number() ? number() + '. ' : '' }}{{ q.question }}</p>
      }
      <app-speak [text]="speech()" />
    </div>
    <p class="xs muted q-hint">{{ hint() }}</p>

    @switch (kind()) {
      @case ('TRUE_FALSE') {
        <div class="q-tf">
          @for (o of q.options; track $index; let j = $index) {
            <button type="button" class="option-card tf" [class.selected]="value() === j" [class.right]="reveal() && j === solution()"
                    [class.wrong]="reveal() && value() === j && j !== solution()" [disabled]="disabled()" (click)="pick(j)">
              <app-icon [name]="j === 0 ? 'check' : 'x'" [size]="22" /> {{ o }}
            </button>
          }
        </div>
      }
      @case ('ORDER') {
        <ol class="q-order">
          @for (idx of arrangement(); track idx; let p = $index; let first = $first; let last = $last) {
            <li [class.right]="reveal() && solutionOrder()?.[p] === idx" [class.wrong]="reveal() && solutionOrder()?.[p] !== idx"
                draggable="true" (dragstart)="drag = p" (dragover)="$event.preventDefault()" (drop)="dropAt(p)">
              <span class="q-pos">{{ p + 1 }}</span>
              <span class="q-txt">{{ q.options[idx] }}</span>
              <span class="q-move">
                <button type="button" class="icon-btn ghost" [disabled]="disabled() || first" (click)="move(p, -1)" [attr.aria-label]="'Monter : ' + q.options[idx]"><app-icon name="arrow-up" [size]="18" /></button>
                <button type="button" class="icon-btn ghost" [disabled]="disabled() || last" (click)="move(p, 1)" [attr.aria-label]="'Descendre : ' + q.options[idx]"><app-icon name="arrow-down" [size]="18" /></button>
              </span>
            </li>
          }
        </ol>
        @if (reveal() && solutionOrder(); as so) {
          <div class="notice info small"><strong>Bon ordre :</strong> @for (i of so; track i; let p = $index) { <span>{{ p + 1 }}. {{ q.options[i] }}&nbsp; </span> }</div>
        }
      }
      @case ('MATCH') {
        <div class="q-match">
          @for (o of q.options; track $index; let i = $index) {
            <div class="q-pair" [class.right]="reveal() && pairs()[i] === solutionPairs()?.[i]" [class.wrong]="reveal() && pairs()[i] !== solutionPairs()?.[i]">
              <span class="q-left">{{ leftOf(o) }}</span>
              <app-icon name="arrow" [size]="16" />
              <select [disabled]="disabled()" (change)="pair(i, $event)" [attr.aria-label]="'Associer : ' + leftOf(o)">
                <option value="" [selected]="pairs()[i] === undefined">Choisir…</option>
                @for (j of rightOrder(); track j) {
                  <option [value]="j" [selected]="pairs()[i] === j">{{ rightOf(q.options[j]) }}</option>
                }
              </select>
            </div>
            @if (reveal() && pairs()[i] !== solutionPairs()?.[i] && solutionPairs(); as sp) {
              <div class="xs q-fix">Bonne réponse : {{ rightOf(q.options[sp[i]]) }}</div>
            }
          }
        </div>
      }
      @default {
        <div [class.q-chips]="kind() === 'FILL_BLANK'">
          @for (o of q.options; track $index; let j = $index) {
            <button type="button" class="option-card" [class.chip]="kind() === 'FILL_BLANK'" [class.selected]="value() === j"
                    [class.right]="reveal() && j === solution()" [class.wrong]="reveal() && value() === j && j !== solution()"
                    [disabled]="disabled()" (click)="pick(j)">
              @if (kind() !== 'FILL_BLANK') { <span class="letter">{{ letters[j] }}</span> }{{ o }}
            </button>
          }
        </div>
      }
    }
  `,
})
export class QuestionComponent {
  readonly question = input.required<AnyQuestion>();
  readonly value = input<number | undefined>(undefined);
  readonly number = input<number | null>(null);
  readonly disabled = input(false);
  readonly reveal = input(false);
  /** Bonne reponse (index ou code d'arrangement, dans l'ordre recu). */
  readonly solution = input<number | undefined>(undefined);
  readonly clientShuffle = input(false);
  readonly valueChange = output<number | undefined>();

  protected letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  protected kind = computed(() => kindOf(this.question()));
  protected arrangement = signal<number[]>([]);
  protected pairs = signal<(number | undefined)[]>([]);
  protected rightOrder = signal<number[]>([]);
  protected drag = -1;

  constructor() {
    // nouvelle question : arrangement de depart (melange local pour un quiz de lecon, ordre recu pour l'evaluation)
    effect(() => {
      const q = this.question();
      const shuffle = this.clientShuffle();
      untracked(() => {
        const n = q.options.length;
        const base = shuffle ? shuffled(n, q.id) : Array.from({ length: n }, (_, i) => i);
        if (this.kind() === 'ORDER') {
          const fromValue = decode(this.value(), n);
          this.arrangement.set(fromValue ?? base);
          if (!fromValue) this.valueChange.emit(encode(base));
        }
        if (this.kind() === 'MATCH') {
          this.rightOrder.set(base);
          const fromValue = decode(this.value(), n);
          this.pairs.set(fromValue ?? new Array(n).fill(undefined));
        }
      });
    });
  }

  /** Apres "Reessayer", la reponse est effacee : l'ordre affiche redevient la reponse courante. */
  private prevValue: number | undefined;
  private readonly resync = effect(() => {
    const v = this.value();
    const q = this.question();
    untracked(() => {
      const cleared = v === undefined && this.prevValue !== undefined && this.lastQuestion === q.id;
      this.prevValue = v;
      this.lastQuestion = q.id;
      if (v === undefined && this.kind() === 'ORDER' && this.arrangement().length) this.valueChange.emit(encode(this.arrangement()));
      // reponse complete effacee (bouton "Reessayer") : on vide aussi les associations
      if (cleared && this.kind() === 'MATCH') this.pairs.set(new Array(q.options.length).fill(undefined));
    });
  });
  private lastQuestion = -1;

  protected blankParts = computed(() => this.question().question.split('___'));
  protected solutionOrder = computed(() => decode(this.solution(), this.question().options.length));
  protected solutionPairs = computed(() => decode(this.solution(), this.question().options.length));

  protected hint = computed(() => {
    switch (this.kind()) {
      case 'ORDER': return 'Remettez les éléments dans le bon ordre (flèches ou glisser-déposer).';
      case 'MATCH': return 'Associez chaque élément de gauche à l\'élément qui lui correspond.';
      case 'FILL_BLANK': return 'Choisissez le mot qui complète la phrase.';
      case 'TRUE_FALSE': return 'Vrai ou faux ?';
      case 'SCENARIO': return 'Choisissez la réaction la plus adaptée.';
      default: return 'Une seule bonne réponse.';
    }
  });

  protected speech = computed(() => {
    const q = this.question();
    const opts = this.kind() === 'MATCH' ? q.options.map((o) => left(o)) : q.options;
    return [q.context, q.question.replaceAll('___', '…'), ...opts].filter(Boolean).join('. ');
  });

  protected leftOf = left;
  protected rightOf = right;

  pick(j: number): void {
    if (!this.disabled()) this.valueChange.emit(j);
  }

  move(p: number, d: number): void {
    const a = [...this.arrangement()];
    [a[p], a[p + d]] = [a[p + d], a[p]];
    this.setArrangement(a);
  }

  dropAt(p: number): void {
    if (this.drag < 0 || this.drag === p || this.disabled()) return;
    const a = [...this.arrangement()];
    const [x] = a.splice(this.drag, 1);
    a.splice(p, 0, x);
    this.drag = -1;
    this.setArrangement(a);
  }

  pair(i: number, ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    const p = [...this.pairs()];
    p[i] = v === '' ? undefined : Number(v);
    this.pairs.set(p);
    this.valueChange.emit(p.every((x) => x !== undefined) ? encode(p as number[]) : undefined);
  }

  private setArrangement(a: number[]): void {
    this.arrangement.set(a);
    this.valueChange.emit(encode(a));
  }
}
