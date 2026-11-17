import { Pipe, PipeTransform, inject } from '@angular/core';
import { PrefsService } from './prefs.service';

/**
 * Interface traduisible par simple dictionnaire : ajouter une langue = ajouter un bloc de cles
 * (pas de developpement). Les contenus pedagogiques, eux, sont produits par langue dans les modules.
 */
const DICT: Record<string, Record<string, string>> = {
  fr: {
    'nav.home': 'Accueil',
    'nav.courses': 'Modules',
    'nav.community': 'Communauté',
    'nav.certificates': 'Certificats',
    'nav.profile': 'Profil',
    'nav.mentor': 'Mentorat',
    'nav.admin': 'Pilotage',
    'status.online': 'En ligne',
    'status.offline': 'Hors ligne',
    'status.offlineHint': 'Vous pouvez continuer à apprendre',
    'status.syncing': 'Synchronisation…',
    'status.pending': 'à envoyer',
    'status.synced': 'À jour',
    'action.continue': 'Continuer',
    'action.start': 'Commencer',
    'action.download': 'Télécharger',
    'action.downloaded': 'Sur l’appareil',
    'action.listen': 'Écouter',
    'action.stop': 'Arrêter',
    'action.done': 'J’ai terminé',
    'action.next': 'Suivant',
    'action.previous': 'Précédent',
    'action.send': 'Envoyer',
    'action.logout': 'Se déconnecter',
    'assistant.title': 'Mentor IA',
    'assistant.placeholder': 'Posez votre question…',
    'assistant.offline': 'Hors ligne : je cherche dans vos modules téléchargés.',
    'assistant.hello': 'Bonjour ! Je peux vous aider à choisir un module, expliquer une leçon ou préparer l’évaluation.',
  },
  en: {
    'nav.home': 'Home',
    'nav.courses': 'Modules',
    'nav.community': 'Community',
    'nav.certificates': 'Certificates',
    'nav.profile': 'Profile',
    'nav.mentor': 'Mentoring',
    'nav.admin': 'Dashboard',
    'status.online': 'Online',
    'status.offline': 'Offline',
    'status.offlineHint': 'You can keep learning',
    'status.syncing': 'Syncing…',
    'status.pending': 'to send',
    'status.synced': 'Up to date',
    'action.continue': 'Continue',
    'action.start': 'Start',
    'action.download': 'Download',
    'action.downloaded': 'On device',
    'action.listen': 'Listen',
    'action.stop': 'Stop',
    'action.done': 'I’m done',
    'action.next': 'Next',
    'action.previous': 'Previous',
    'action.send': 'Send',
    'action.logout': 'Log out',
    'assistant.title': 'AI Mentor',
    'assistant.placeholder': 'Ask your question…',
    'assistant.offline': 'Offline: searching your downloaded modules.',
    'assistant.hello': 'Hello! I can help you choose a module, explain a lesson or prepare for the assessment.',
  },
};

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private prefs = inject(PrefsService);

  transform(key: string): string {
    const lang = this.prefs.prefs().lang;
    return DICT[lang]?.[key] ?? DICT['fr'][key] ?? key;
  }
}
