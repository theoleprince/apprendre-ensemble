import { Pipe, PipeTransform } from '@angular/core';

/**
 * Rendu markdown minimal (gras, listes, paragraphes) pour garder le bundle leger.
 * Le texte est echappe avant transformation : aucun HTML du contenu n'est interprete.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(src: string | null | undefined): string {
    if (!src) return '';
    const lines = escapeHtml(src).split(/\r?\n/);
    const out: string[] = [];
    let list: 'ul' | 'ol' | null = null;
    const close = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };
    for (const raw of lines) {
      const line = raw.trim();
      const ul = /^[-*]\s+(.*)$/.exec(line);
      const ol = /^\d+\.\s+(.*)$/.exec(line);
      if (ul || ol) {
        const kind = ul ? 'ul' : 'ol';
        if (list !== kind) {
          close();
          out.push(`<${kind}>`);
          list = kind;
        }
        out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      } else if (!line) {
        close();
      } else {
        close();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    close();
    return out.join('');
  }
}

function inline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
