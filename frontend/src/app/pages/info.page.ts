import { BrandingService } from '../core/branding.service';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { IconComponent } from '../shared/icon.component';
import { SiteFooterComponent } from '../shared/site-footer.component';

type Page = 'about' | 'help' | 'privacy' | 'legal';

export const PLATFORM_FAQ: { id?: string; q: string; a: string }[] = [
  { q: 'La plateforme est-elle gratuite ?', a: "La plupart des formations sont gratuites. Certaines sont payantes : elles s'achètent par Mobile Money (MTN, Moov) ou carte, s'ouvrent avec un code de licence fourni par votre institution, ou sont incluses dans un abonnement." },
  { id: 'hors-ligne', q: 'Puis-je apprendre sans connexion ?', a: "Oui. Ouvrez un cours et touchez « Télécharger » : leçons, audios, vidéos et quiz restent disponibles sans réseau. Votre progression est enregistrée sur votre appareil puis envoyée automatiquement au retour de la connexion. Seule l'évaluation finale, corrigée par le serveur, demande d'être en ligne." },
  { q: 'Puis-je sauter des leçons ?', a: "Non : chaque notion s'ouvre quand la précédente est validée par son quiz. C'est ce qui donne sa valeur au certificat. Vous pouvez en revanche revoir à tout moment une leçon déjà terminée." },
  { id: 'certificats', q: 'Comment obtenir mon certificat ?', a: "Suivez toutes les leçons et réussissez l'évaluation finale (70 % en général). Le certificat PDF porte un code et un QR code : n'importe qui peut vérifier son authenticité sur la page « Vérifier un certificat ». Vous pouvez l'ajouter à votre profil LinkedIn en un clic." },
  { q: 'Combien de fois puis-je repasser l\'évaluation ?', a: 'Autant de fois que nécessaire. Votre meilleur score est conservé.' },
  { q: 'Sur quels appareils fonctionne la plateforme ?', a: "Sur tout téléphone, tablette ou ordinateur avec un navigateur récent. Vous pouvez l'installer comme une application depuis votre navigateur (« Ajouter à l'écran d'accueil »). Les vidéos se chargent seulement si vous le demandez, pour économiser vos données." },
  { q: 'Mes données sont-elles protégées ?', a: "Oui. Vous pouvez télécharger toutes vos données ou supprimer votre compte depuis votre profil. Les vidéos que vous envoyez à votre mentor sont privées. Voir la page Confidentialité." },
];

/** Pages d'information publiques : a propos, aide, confidentialite, mentions legales. */
@Component({
  selector: 'app-info',
  imports: [RouterLink, IconComponent, SiteFooterComponent],
  template: `
    <article class="info-page">
      @switch (page()) {
        @case ('about') {
          <span class="tag sun">À propos</span>
          <h1>Former celles et ceux qui accompagnent les enfants</h1>
          <p class="lead">{{ brand().name }} propose des formations courtes, pratiques et certifiantes aux enseignant·es, directions d'école, parents, jeunes et travailleur·ses sociaux, pour un climat de paix à l'école et à la maison.</p>
          <div class="info-grid">
            <div><app-icon name="wifi-off" [size]="24" /><strong>Pensée pour le terrain</strong><span class="small muted">Fonctionne sur un téléphone d'entrée de gamme, avec peu ou pas de réseau, et sur des serveurs relais installés dans les écoles.</span></div>
            <div><app-icon name="target" [size]="24" /><strong>Exigeante</strong><span class="small muted">Un quiz après chaque notion, une évaluation finale corrigée par le serveur, des certificats vérifiables.</span></div>
            <div><app-icon name="users" [size]="24" /><strong>Accompagnée</strong><span class="small muted">Classes, mentors, communauté de pratique et mentor IA disponible à chaque étape.</span></div>
          </div>
          <h2 id="contact">Contact</h2>
          @if (brand().supportEmail; as m) {
            <p>Pour toute question sur une formation, une licence pour votre institution ou un partenariat : <a [href]="'mailto:' + m">{{ m }}</a>.</p>
          } @else {
            <p>Pour toute question sur une formation, une licence pour votre institution ou un partenariat, écrivez à l'équipe de la plateforme à l'adresse indiquée par votre organisation.</p>
          }
        }
        @case ('help') {
          <span class="tag">Aide</span>
          <h1>Questions fréquentes</h1>
          <p class="lead">Les réponses aux questions les plus courantes. Une autre question ? Une fois connecté·e, le mentor IA vous répond à tout moment.</p>
          <div class="faq">
            @for (f of faq; track f.q) {
              <details [id]="f.id ?? null" [open]="f.id === fragment()"><summary>{{ f.q }}<app-icon name="chevron-down" [size]="18" /></summary><p>{{ f.a }}</p></details>
            }
          </div>
        }
        @case ('privacy') {
          <span class="tag">Confidentialité</span>
          <h1>Vos données personnelles</h1>
          <p class="lead">Nous collectons le minimum nécessaire pour vous former et vous certifier, et vous gardez la main sur vos données.</p>
          <h2>Ce que nous enregistrons</h2>
          <ul>
            <li><strong>Votre compte</strong> : nom, e-mail, pays, langue, public (enseignant·e, parent…), région et école si vous les indiquez.</li>
            <li><strong>Votre apprentissage</strong> : leçons terminées, temps passé, résultats aux évaluations, certificats, notes personnelles.</li>
            <li><strong>Vos contributions</strong> : messages dans la communauté, exercices envoyés à votre mentor, avis sur les cours, questions posées au mentor IA.</li>
          </ul>
          <h2>Ce que nous en faisons</h2>
          <ul>
            <li>Vous permettre d'apprendre, de reprendre où vous en étiez et d'obtenir vos certificats.</li>
            <li>Permettre à votre mentor ou à votre classe de vous accompagner.</li>
            <li>Mesurer l'impact des formations, sur des données regroupées et non nominatives.</li>
          </ul>
          <p>Les avis publiés sur les pages des cours n'affichent que votre prénom et l'initiale de votre nom. Les vidéos d'exercices sont privées : seul·es vous et vos mentors y accèdent, par des liens qui expirent.</p>
          <h2>Vos droits</h2>
          <p>Depuis votre <a routerLink="/profil">profil</a>, vous pouvez à tout moment télécharger toutes vos données (format JSON), vous déconnecter de tous vos appareils ou supprimer votre compte. La suppression efface vos données personnelles ; seules des statistiques non identifiantes sont conservées.</p>
          <h2>Rappels par e-mail</h2>
          <p>Les rappels d'apprentissage ne sont envoyés que si vous les activez dans votre profil. Vous pouvez les désactiver à tout moment.</p>
        }
        @case ('legal') {
          <span class="tag">Mentions légales</span>
          <h1>Mentions légales</h1>
          <p class="notice info small"><app-icon name="info" [size]="16" /> Plateforme de démonstration. Les informations d'identification de l'éditeur et de l'hébergeur seront celles de l'organisation qui exploite la plateforme.</p>
          <h2>Éditeur</h2>
          <p>Organisation exploitant la plateforme (raison sociale, adresse, numéro d'enregistrement, directeur·rice de la publication) : à renseigner lors de la mise en service.</p>
          <h2>Hébergement</h2>
          <p>Hébergeur et localisation des données : à renseigner lors de la mise en service.</p>
          <h2>Propriété intellectuelle</h2>
          <p>Le logiciel est distribué sous licence Apache 2.0. Les contenus pédagogiques restent la propriété de leurs auteur·rices et de l'organisation qui les publie.</p>
          <h2>Données personnelles</h2>
          <p>Voir la page <a routerLink="/confidentialite">Confidentialité</a>.</p>
        }
      }
    </article>
    <app-site-footer />
  `,
})
export class InfoPage {
  private route = inject(ActivatedRoute);
  protected page = toSignal(this.route.data.pipe(map((d) => d['page'] as Page)), { initialValue: 'about' as Page });
  protected fragment = toSignal(this.route.fragment, { initialValue: null });
  protected faq = PLATFORM_FAQ;
  protected brand = inject(BrandingService).brand;
  protected title = computed(() => this.page());
}
