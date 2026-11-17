import { Injectable, signal } from '@angular/core';

const CACHE = 'formation-media-v1';

/**
 * Medias (video, audio, sous-titres) stockes sur l'appareil via l'API Cache du navigateur.
 * Lecture hors ligne : on cree une URL locale (blob) a partir du fichier en cache.
 */
@Injectable({ providedIn: 'root' })
export class MediaCacheService {
  /** URLs presentes en cache. */
  readonly cached = signal<Set<string>>(new Set());

  async init(): Promise<void> {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    this.cached.set(new Set(keys.map((r) => new URL(r.url).pathname)));
  }

  has(url: string | null): boolean {
    return !!url && this.cached().has(url);
  }

  /** Telecharge un media (avec suivi de progression) et le garde sur l'appareil. */
  async download(url: string, onProgress?: (ratio: number) => void): Promise<void> {
    if (!('caches' in window) || this.has(url)) return;
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length') ?? 0);
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (total && onProgress) onProgress(loaded / total);
    }
    const type = res.headers.get('content-type') ?? 'application/octet-stream';
    const blob = new Blob(chunks, { type });
    const cache = await caches.open(CACHE);
    await cache.put(url, new Response(blob, { headers: { 'content-type': type, 'content-length': String(blob.size) } }));
    this.cached.update((s) => new Set(s).add(url));
  }

  /** URL a donner a <video>/<audio> : locale si en cache, sinon distante. */
  async playableUrl(url: string): Promise<string> {
    if ('caches' in window && this.has(url)) {
      const cache = await caches.open(CACHE);
      const r = await cache.match(url);
      if (r) return URL.createObjectURL(await r.blob());
    }
    return url;
  }

  async remove(urls: string[]): Promise<void> {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE);
    await Promise.all(urls.map((u) => cache.delete(u)));
    this.cached.update((s) => {
      const n = new Set(s);
      urls.forEach((u) => n.delete(u));
      return n;
    });
  }

  async clear(): Promise<void> {
    if ('caches' in window) await caches.delete(CACHE);
    this.cached.set(new Set());
  }

  /** Espace utilise / disponible sur l'appareil. */
  async estimate(): Promise<{ usage: number; quota: number } | null> {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  }
}
