import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Telechargements authentifies (le jeton ne peut pas passer par un simple lien). */
@Injectable({ providedIn: 'root' })
export class AdminFiles {
  private http = inject(HttpClient);

  async download(url: string, filename: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async open(url: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    window.open(URL.createObjectURL(blob), '_blank');
  }
}

export function query(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
  const s = q.toString();
  return s ? '?' + s : '';
}
