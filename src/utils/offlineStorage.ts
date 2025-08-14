// Offline storage utilities for caching data
class OfflineStorage {
  private dbName = 'visao-aguia-offline';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores for different data types
        if (!db.objectStoreNames.contains('cameras')) {
          db.createObjectStore('cameras', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('events')) {
          const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
          eventsStore.createIndex('timestamp', 'ts');
        }
        
        if (!db.objectStoreNames.contains('detections')) {
          const detectionsStore = db.createObjectStore('detections', { keyPath: 'id' });
          detectionsStore.createIndex('timestamp', 'created_at');
        }

        if (!db.objectStoreNames.contains('pendingSync')) {
          db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async store(storeName: string, data: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    for (const item of data) {
      await store.put(item);
    }
  }

  async get(storeName: string, key?: string): Promise<any> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    if (key) {
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  async addToPendingSync(action: string, data: any): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction(['pendingSync'], 'readwrite');
    const store = transaction.objectStore('pendingSync');
    
    await store.add({
      action,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async getPendingSync(): Promise<any[]> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction(['pendingSync'], 'readonly');
    const store = transaction.objectStore('pendingSync');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearPendingSync(): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction(['pendingSync'], 'readwrite');
    const store = transaction.objectStore('pendingSync');
    
    await store.clear();
  }
}

export const offlineStorage = new OfflineStorage();