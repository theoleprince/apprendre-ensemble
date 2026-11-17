import { Injectable } from '@angular/core';

/**
 * Petit wrapper IndexedDB (sans dependance) pour le stockage hors ligne :
 *  - "packages" : parcours telecharges (lecons + quiz)
 *  - "kv"       : caches divers (liste des parcours, progression, file de synchro...)
 */
const DB_NAME = 'formation-offline';
const DB_VERSION = 1;
type StoreName = 'packages' | 'kv';

@Injectable({ providedIn: 'root' })
export class OfflineStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('packages')) db.createObjectStore('packages');
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private async run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return this.run<T | undefined>(store, 'readonly', (s) => s.get(key));
  }

  set(store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
    return this.run<void>(store, 'readwrite', (s) => s.put(value, key));
  }

  delete(store: StoreName, key: IDBValidKey): Promise<void> {
    return this.run<void>(store, 'readwrite', (s) => s.delete(key));
  }

  keys(store: StoreName): Promise<IDBValidKey[]> {
    return this.run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys());
  }

  /** Efface toutes les donnees locales (deconnexion : protection des donnees sur appareil partage). */
  async clearAll(): Promise<void> {
    await this.run<void>('packages', 'readwrite', (s) => s.clear());
    await this.run<void>('kv', 'readwrite', (s) => s.clear());
  }
}
