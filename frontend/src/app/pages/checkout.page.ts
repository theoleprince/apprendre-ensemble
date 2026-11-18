import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { EnrollResult, PayMethod, durationLabel, priceLabel } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { CoverComponent } from '../shared/visuals';

interface Item {
  id: number;
  title: string;
  icon: string | null;
  price: number;
  lines: string[];
}

/**
 * Inscription a un cours ou a une formation. Gratuit : un clic. Payant : Mobile Money, carte ou code de licence
 * (licence institutionnelle). En demonstration le paiement est simule ; en production il passe par un agregateur
 * (FedaPay, Kkiapay, Stripe...) et l'inscription n'est confirmee qu'a la reception du paiement.
 */
@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, IconComponent, CoverComponent],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (done(); as r) {
      <section class="card narrow center">
        <div class="empty-icon" style="width:84px;height:84px"><app-icon name="check-circle" [size]="42" /></div>
        <h1>Inscription confirmée</h1>
        <p class="muted">{{ r.message }}</p>
        @if (r.amount) { <p class="small">Montant réglé : <strong>{{ price(r.amount) }}</strong> · Référence {{ r.paymentRef }}</p> }
        <a class="btn primary lg" [routerLink]="startLink()">{{ kind() === 'formation' ? 'Commencer la formation' : 'Commencer le cours' }} <app-icon name="arrow" /></a>
      </section>
    } @else if (item(); as it) {
      <a class="back" [routerLink]="backLink()"><app-icon name="back" [size]="18" /> Retour</a>
      <h1>Inscription</h1>
      <div class="checkout">
        <section class="card">
          @if (!it.price) {
            <h2>Inscription gratuite</h2>
            <p class="muted">Ce contenu est financé par le programme : aucun paiement n'est demandé.</p>
            <button class="primary lg block" (click)="pay('GRATUIT')" [disabled]="busy()">{{ busy() ? 'Inscription…' : 'Confirmer mon inscription' }}</button>
          } @else {
            <h2>Moyen de paiement</h2>
            <div class="pay-methods" role="radiogroup">
              <button class="pay-opt" role="radio" [attr.aria-checked]="method() === 'MOBILE_MONEY'" [class.selected]="method() === 'MOBILE_MONEY'" (click)="method.set('MOBILE_MONEY')">
                <app-icon name="smartphone" [size]="26" /><span><strong>Mobile Money</strong><span class="xs muted">MTN MoMo, Moov Money</span></span></button>
              <button class="pay-opt" role="radio" [attr.aria-checked]="method() === 'CARTE'" [class.selected]="method() === 'CARTE'" (click)="method.set('CARTE')">
                <app-icon name="credit-card" [size]="26" /><span><strong>Carte bancaire</strong><span class="xs muted">Visa, Mastercard</span></span></button>
              <button class="pay-opt" role="radio" [attr.aria-checked]="method() === 'CODE'" [class.selected]="method() === 'CODE'" (click)="method.set('CODE')">
                <app-icon name="school" [size]="26" /><span><strong>Code de licence</strong><span class="xs muted">Fourni par votre institution</span></span></button>
            </div>
            @switch (method()) {
              @case ('MOBILE_MONEY') {
                <label>Numéro Mobile Money <input type="tel" name="phone" [(ngModel)]="phone" placeholder="+229 97 00 00 00" autocomplete="tel" /></label>
                <p class="xs muted">Vous recevrez une demande de confirmation sur votre téléphone.</p>
              }
              @case ('CARTE') {
                <p class="small muted">Vous serez redirigé·e vers la page sécurisée du prestataire de paiement. Aucune donnée de carte n'est saisie ni conservée sur cette plateforme.</p>
              }
              @case ('CODE') {
                <label>Code de licence <input name="code" [(ngModel)]="code" placeholder="Ex. GDP-2027" autocapitalize="characters" /></label>
              }
            }
            <p class="notice small"><app-icon name="alert" [size]="16" /> Démonstration : le paiement est simulé, aucun débit n'est effectué.</p>
            <button class="sun lg block" (click)="pay(method())" [disabled]="busy() || !ready()">
              {{ busy() ? 'Traitement…' : method() === 'CODE' ? 'Valider le code' : 'Payer ' + price(it.price) }}
            </button>
          }
        </section>
        <aside class="card flat">
          <app-cover [icon]="it.icon" [seed]="it.id" [height]="100" [label]="it.title" />
          <span class="xs muted">{{ kind() === 'formation' ? 'Formation' : 'Cours' }}</span>
          <h3 style="margin:.2rem 0">{{ it.title }}</h3>
          <ul class="buy-list small">@for (l of it.lines; track l) { <li><app-icon name="check" [size]="14" /> {{ l }}</li> }</ul>
          <div class="row" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:.6rem"><span>Total</span><strong>{{ price(it.price) }}</strong></div>
        </aside>
      </div>
    } @else if (!error()) {
      <div class="skeleton" style="height:300px"></div>
    }
  `,
})
export class CheckoutPage implements OnInit {
  private api = inject(CatalogApi);
  private router = inject(Router);
  readonly kind = input.required<string>();
  readonly id = input.required<string>();

  item = signal<Item | null>(null);
  error = signal('');
  busy = signal(false);
  done = signal<EnrollResult | null>(null);
  method = signal<PayMethod>('MOBILE_MONEY');
  phone = '';
  code = '';

  ready = computed(() => true);

  async ngOnInit(): Promise<void> {
    const id = Number(this.id());
    try {
      const mine = await this.api.myLearning().catch(() => null);
      if (this.kind() === 'formation') {
        if (mine?.programs.some((p) => p.programId === id)) return void this.router.navigate(['/formations', id], { replaceUrl: true });
        const { data } = await this.api.program(id);
        const p = data.program;
        this.item.set({ id: p.id, title: p.title, icon: p.icon, price: p.price,
          lines: [`${p.courseCount} cours`, durationLabel(p.totalMinutes) + ' de contenu', 'Certificat de formation'] });
      } else {
        if (mine?.courses.some((c) => c.courseId === id)) return void this.router.navigate(['/apprendre', id], { replaceUrl: true });
        const { data } = await this.api.course(id);
        const c = data.course;
        this.item.set({ id: c.id, title: c.title, icon: c.icon, price: c.price,
          lines: [`${c.lessonCount} leçons et quiz`, durationLabel(c.totalMinutes) + ' de contenu', 'Certificat'] });
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async pay(m: PayMethod): Promise<void> {
    if (m === 'MOBILE_MONEY' && !this.phone.trim()) return void this.error.set('Indiquez votre numéro Mobile Money');
    if (m === 'CODE' && !this.code.trim()) return void this.error.set('Indiquez votre code de licence');
    this.busy.set(true);
    this.error.set('');
    const id = Number(this.id());
    try {
      const r = await this.api.enroll({
        ...(this.kind() === 'formation' ? { programId: id } : { courseId: id }),
        method: m,
        phone: this.phone || undefined,
        code: this.code || undefined,
      });
      this.done.set(r);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  startLink(): unknown[] {
    return this.kind() === 'formation' ? ['/formations', this.id()] : ['/apprendre', this.id()];
  }

  backLink(): unknown[] {
    return this.kind() === 'formation' ? ['/formations', this.id()] : ['/cours', this.id()];
  }

  price = priceLabel;
}
