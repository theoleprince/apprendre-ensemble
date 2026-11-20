import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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

type Choice = 'ONLINE' | 'CODE' | 'ABONNEMENT';

/**
 * Inscription a un cours ou a une formation.
 * Gratuit : un clic. Payant : paiement en ligne securise chez le prestataire (FedaPay : Mobile Money, carte),
 * code de licence institutionnel, ou abonnement en cours. Aucun paiement n'est simule.
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
            <button class="primary lg block" (click)="enrollWith('GRATUIT')" [disabled]="busy()">{{ busy() ? 'Inscription…' : 'Confirmer mon inscription' }}</button>
          } @else {
            <h2>Comment souhaitez-vous accéder à ce contenu ?</h2>
            <div class="pay-methods" role="radiogroup">
              @if (subscribed()) {
                <button class="pay-opt" role="radio" [attr.aria-checked]="choice() === 'ABONNEMENT'" [class.selected]="choice() === 'ABONNEMENT'" (click)="choice.set('ABONNEMENT')">
                  <app-icon name="award" [size]="26" /><span><strong>Mon abonnement</strong><span class="xs muted">Inclus, sans paiement supplémentaire</span></span></button>
              }
              <button class="pay-opt" role="radio" [attr.aria-checked]="choice() === 'ONLINE'" [class.selected]="choice() === 'ONLINE'" (click)="choice.set('ONLINE')" [disabled]="!onlineEnabled()">
                <app-icon name="smartphone" [size]="26" /><span><strong>Payer en ligne</strong><span class="xs muted">Mobile Money (MTN, Moov) ou carte bancaire, sur la page sécurisée FedaPay</span></span></button>
              <button class="pay-opt" role="radio" [attr.aria-checked]="choice() === 'CODE'" [class.selected]="choice() === 'CODE'" (click)="choice.set('CODE')">
                <app-icon name="school" [size]="26" /><span><strong>Code de licence</strong><span class="xs muted">Fourni par votre institution</span></span></button>
            </div>
            @if (!onlineEnabled()) { <p class="notice small"><app-icon name="alert" [size]="16" /> Le paiement en ligne n'est pas activé sur ce serveur. Utilisez un code de licence ou un abonnement.</p> }
            @if (onlineEnabled() && environment() === 'sandbox') { <p class="notice small"><app-icon name="alert" [size]="16" /> Prestataire en mode test (sandbox) : aucun débit réel.</p> }
            @switch (choice()) {
              @case ('ONLINE') {
                <p class="small muted">Vous allez être redirigé·e vers la page de paiement sécurisée. Aucune donnée bancaire ne transite par cette plateforme. L'accès est ouvert dès que le paiement est confirmé.</p>
                <button class="sun lg block" (click)="payOnline()" [disabled]="busy() || !onlineEnabled()">{{ busy() ? 'Redirection…' : 'Payer ' + price(it.price) }}</button>
              }
              @case ('CODE') {
                <label>Code de licence <input name="code" [(ngModel)]="code" placeholder="Ex. GDP-2027" autocapitalize="characters" /></label>
                <button class="primary lg block" (click)="enrollWith('CODE')" [disabled]="busy() || !code.trim()">Valider le code</button>
              }
              @case ('ABONNEMENT') {
                <button class="primary lg block" (click)="enrollWith('ABONNEMENT')" [disabled]="busy()">Accéder avec mon abonnement</button>
              }
            }
            @if (!subscribed()) { <p class="small center" style="margin-top:.8rem"><a routerLink="/abonnement">Voir les abonnements : accès à tous les contenus payants</a></p> }
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
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly kind = input.required<string>();
  readonly id = input.required<string>();

  item = signal<Item | null>(null);
  error = signal('');
  busy = signal(false);
  done = signal<EnrollResult | null>(null);
  choice = signal<Choice>('ONLINE');
  onlineEnabled = signal(false);
  environment = signal<string | null>(null);
  subscribed = signal(false);
  code = '';

  async ngOnInit(): Promise<void> {
    const id = Number(this.id());
    try {
      const [mine, cfg, sub] = await Promise.all([
        this.api.myLearning().catch(() => null),
        firstValueFrom(this.http.get<{ enabled: boolean; environment: string | null }>('/api/public/payments/config')).catch(() => ({ enabled: false, environment: null })),
        firstValueFrom(this.http.get<{ active: boolean }>('/api/me/subscription')).catch(() => ({ active: false })),
      ]);
      this.onlineEnabled.set(cfg.enabled);
      this.environment.set(cfg.environment);
      this.subscribed.set(sub.active);
      this.choice.set(sub.active ? 'ABONNEMENT' : cfg.enabled ? 'ONLINE' : 'CODE');
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

  async enrollWith(m: PayMethod | 'ABONNEMENT'): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    const id = Number(this.id());
    try {
      const r = await this.api.enroll({
        ...(this.kind() === 'formation' ? { programId: id } : { courseId: id }),
        method: m as PayMethod,
        code: m === 'CODE' ? this.code.trim() : undefined,
      });
      this.done.set(r);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** Redirection vers la page de paiement du prestataire ; le retour se fait sur /paiement/retour. */
  async payOnline(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.post<{ reference: string; url: string }>('/api/payments',
        { kind: this.kind() === 'formation' ? 'PROGRAM' : 'COURSE', targetId: Number(this.id()) }));
      location.href = r.url;
    } catch (e) {
      this.error.set(errorMessage(e));
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
