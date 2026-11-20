import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/auth.interceptor';
import { CatalogApi } from '../core/catalog.service';
import { priceLabel } from '../core/models';
import { IconComponent } from '../shared/icon.component';

interface PaymentDto {
  reference: string;
  kind: 'COURSE' | 'PROGRAM' | 'SUBSCRIPTION';
  targetId: number;
  description: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELED' | 'FAILED';
  createdAt: string;
  fulfilled: boolean;
}

/** Retour du prestataire : l'etat est relu par le serveur aupres de FedaPay (jamais deduit de l'URL). */
@Component({
  selector: 'app-payment-return',
  imports: [RouterLink, IconComponent],
  template: `
    <section class="card narrow center">
      @if (p(); as p) {
        @switch (p.status) {
          @case ('APPROVED') {
            <div class="empty-icon" style="width:84px;height:84px"><app-icon name="check-circle" [size]="42" /></div>
            <h1>Paiement confirmé</h1>
            <p class="muted">{{ p.description }} · {{ price(p.amount) }}</p>
            <a class="btn primary lg" [routerLink]="link(p)">{{ p.kind === 'SUBSCRIPTION' ? 'Parcourir le catalogue' : 'Commencer' }} <app-icon name="arrow" /></a>
          }
          @case ('PENDING') {
            <div class="empty-icon sunbg" style="width:84px;height:84px"><app-icon name="clock" [size]="40" /></div>
            <h1>Paiement en cours de confirmation</h1>
            <p class="muted">Validez la demande sur votre téléphone si ce n'est pas déjà fait. Cette page se met à jour automatiquement.</p>
            <button (click)="check()"><app-icon name="sync" /> Vérifier maintenant</button>
          }
          @default {
            <div class="empty-icon clay" style="width:84px;height:84px"><app-icon name="alert" [size]="40" /></div>
            <h1>Paiement non abouti</h1>
            <p class="muted">Aucun montant n'a été validé. Vous pouvez réessayer.</p>
            <a class="btn primary" routerLink="/catalogue">Retour au catalogue</a>
          }
        }
        <p class="xs muted" style="margin-top:1rem">Référence {{ p.reference }}</p>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <div class="skeleton" style="height:200px"></div>
      }
    </section>
  `,
})
export class PaymentReturnPage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private api = inject(CatalogApi);
  private ref = inject(ActivatedRoute).snapshot.queryParamMap.get('ref') ?? '';
  p = signal<PaymentDto | null>(null);
  error = signal('');
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tries = 0;

  async ngOnInit(): Promise<void> {
    await this.check();
  }

  async check(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    try {
      const p = await firstValueFrom(this.http.get<PaymentDto>(`/api/payments/${encodeURIComponent(this.ref)}`));
      this.p.set(p);
      if (p.status === 'APPROVED') void this.api.myLearning().catch(() => undefined);
      if (p.status === 'PENDING' && this.tries++ < 20) this.timer = setTimeout(() => void this.check(), 4000);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  link(p: PaymentDto): unknown[] {
    return p.kind === 'COURSE' ? ['/apprendre', p.targetId] : p.kind === 'PROGRAM' ? ['/formations', p.targetId] : ['/catalogue'];
  }

  price = priceLabel;

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}

/** Abonnements individuels : acces a tous les contenus payants pendant la duree choisie. */
@Component({
  selector: 'app-subscription',
  imports: [RouterLink, IconComponent, DatePipe],
  template: `
    <h1>Abonnement</h1>
    <p class="muted">Un abonnement donne accès à tous les cours et formations payants pendant sa durée. Les contenus gratuits restent gratuits.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (mine(); as m) {
      @if (m.active) { <p class="notice info"><app-icon name="check-circle" /> Abonnement « {{ m.planName }} » actif jusqu'au {{ m.endsAt | date: 'dd/MM/yyyy' }}. Un nouvel achat prolonge la durée.</p> }
    }
    @if (!enabled()) { <p class="notice"><app-icon name="alert" /> Le paiement en ligne n'est pas activé sur ce serveur.</p> }
    <div class="grid cols-3 section">
      @for (p of plans(); track p.id) {
        <article class="card">
          <h2 style="margin:0">{{ p.name }}</h2>
          <div class="price" style="font-size:1.6rem;font-weight:800;margin:.4rem 0">{{ price(p.price) }}</div>
          <p class="small muted">{{ p.description }}</p>
          <p class="small">{{ p.durationDays }} jours</p>
          <button class="primary block" (click)="subscribe(p.id)" [disabled]="busy() || !enabled()">Souscrire</button>
        </article>
      } @empty { <p class="muted">Aucune formule disponible.</p> }
    </div>
    <p class="small"><a routerLink="/catalogue">Retour au catalogue</a></p>
  `,
})
export class SubscriptionPage implements OnInit {
  private http = inject(HttpClient);
  plans = signal<{ id: number; name: string; description: string; price: number; durationDays: number }[]>([]);
  mine = signal<{ active: boolean; planName: string | null; endsAt: string | null } | null>(null);
  enabled = signal(false);
  busy = signal(false);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.plans.set(await firstValueFrom(this.http.get<{ id: number; name: string; description: string; price: number; durationDays: number }[]>('/api/public/subscription-plans')));
      this.enabled.set((await firstValueFrom(this.http.get<{ enabled: boolean }>('/api/public/payments/config'))).enabled);
      this.mine.set(await firstValueFrom(this.http.get<{ active: boolean; planName: string | null; endsAt: string | null }>('/api/me/subscription')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async subscribe(planId: number): Promise<void> {
    this.busy.set(true);
    try {
      const r = await firstValueFrom(this.http.post<{ url: string }>('/api/payments', { kind: 'SUBSCRIPTION', targetId: planId }));
      location.href = r.url;
    } catch (e) {
      this.error.set(errorMessage(e));
      this.busy.set(false);
    }
  }

  price = priceLabel;
}
