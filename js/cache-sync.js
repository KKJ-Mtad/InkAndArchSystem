/**
 * Cache Sync Utility
 * Manages IndexedDB cache for inventory and appointment data
 * Ensures data synchronization between inventory.html and records.html
 */

class CacheSync {
  constructor() {
    this.dbName = 'InkAndArchCache';
    this.version = 1;
    this.db = null;
    this.initialized = false;
    this.initDB();
  }

  // Initialize IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      if (this.initialized && this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('✅ IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('appointments')) {
          db.createObjectStore('appointments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cacheMetadata')) {
          db.createObjectStore('cacheMetadata', { keyPath: 'key' });
        }

        console.log('✅ IndexedDB stores created');
      };
    });
  }

  // Cache inventory data
  async cacheInventory(inventoryData) {
    try {
      await this.initDB();
      const transaction = this.db.transaction('inventory', 'readwrite');
      const store = transaction.objectStore('inventory');

      // Clear old data
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Add new data
      for (const item of (inventoryData || [])) {
        await new Promise((resolve, reject) => {
          const addRequest = store.add(item);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => {
            // Item might already exist, try update
            const putRequest = store.put(item);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          };
        });
      }

      // Update metadata
      await this.setCacheMetadata('inventory_last_synced', new Date().toISOString());
      console.log(`✅ Cached ${inventoryData.length} inventory items`);
      
      // Notify other tabs/windows
      this.broadcastCacheUpdate('inventory', inventoryData);
      
      return true;
    } catch (error) {
      console.error('Error caching inventory:', error);
      return false;
    }
  }

  // Cache appointments data
  async cacheAppointments(appointmentsData) {
    try {
      await this.initDB();
      const transaction = this.db.transaction('appointments', 'readwrite');
      const store = transaction.objectStore('appointments');

      // Clear old data
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Add new data
      for (const item of (appointmentsData || [])) {
        await new Promise((resolve, reject) => {
          const addRequest = store.add(item);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => {
            const putRequest = store.put(item);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          };
        });
      }

      // Update metadata
      await this.setCacheMetadata('appointments_last_synced', new Date().toISOString());
      console.log(`✅ Cached ${appointmentsData.length} appointments`);
      
      // Notify other tabs/windows
      this.broadcastCacheUpdate('appointments', appointmentsData);
      
      return true;
    } catch (error) {
      console.error('Error caching appointments:', error);
      return false;
    }
  }

  // Get inventory from cache
  async getInventoryFromCache() {
    try {
      await this.initDB();
      const transaction = this.db.transaction('inventory', 'readonly');
      const store = transaction.objectStore('inventory');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          console.log(`📦 Retrieved ${request.result.length} inventory items from cache`);
          resolve(request.result || []);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error retrieving inventory from cache:', error);
      return [];
    }
  }

  // Get appointments from cache
  async getAppointmentsFromCache() {
    try {
      await this.initDB();
      const transaction = this.db.transaction('appointments', 'readonly');
      const store = transaction.objectStore('appointments');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          console.log(`📋 Retrieved ${request.result.length} appointments from cache`);
          resolve(request.result || []);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error retrieving appointments from cache:', error);
      return [];
    }
  }

  // Set cache metadata
  async setCacheMetadata(key, value) {
    try {
      await this.initDB();
      const transaction = this.db.transaction('cacheMetadata', 'readwrite');
      const store = transaction.objectStore('cacheMetadata');

      return new Promise((resolve, reject) => {
        const request = store.put({ key, value, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error setting cache metadata:', error);
    }
  }

  // Get cache metadata
  async getCacheMetadata(key) {
    try {
      await this.initDB();
      const transaction = this.db.transaction('cacheMetadata', 'readonly');
      const store = transaction.objectStore('cacheMetadata');

      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting cache metadata:', error);
      return null;
    }
  }

  // Check if cache is stale (older than specified minutes)
  async isCacheStale(dataType, minutes = 5) {
    const lastSynced = await this.getCacheMetadata(`${dataType}_last_synced`);
    if (!lastSynced) return true;

    const lastSyncTime = new Date(lastSynced).getTime();
    const now = Date.now();
    const ageInMinutes = (now - lastSyncTime) / (1000 * 60);
    
    return ageInMinutes > minutes;
  }

  // Broadcast cache update to other tabs/windows
  broadcastCacheUpdate(dataType, data) {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('cache-sync');
        channel.postMessage({
          type: 'cache-updated',
          dataType: dataType,
          itemCount: data.length,
          timestamp: Date.now()
        });
        channel.close();
      } catch (error) {
        console.warn('BroadcastChannel not available:', error);
      }
    }
  }

  // Listen for cache updates from other tabs/windows
  onCacheUpdate(callback) {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('cache-sync');
        channel.onmessage = (event) => {
          if (event.data.type === 'cache-updated') {
            console.log(`📡 Cache update received: ${event.data.dataType} (${event.data.itemCount} items)`);
            callback(event.data);
          }
        };
        return channel;
      } catch (error) {
        console.warn('BroadcastChannel not available:', error);
        return null;
      }
    }
  }

  // Clear all caches
  async clearAllCaches() {
    try {
      await this.initDB();
      const storeNames = ['inventory', 'appointments', 'cacheMetadata'];
      
      for (const storeName of storeNames) {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction(storeName, 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
      console.log('✅ All caches cleared');
      return true;
    } catch (error) {
      console.error('Error clearing caches:', error);
      return false;
    }
  }
}

// Create global instance
const cacheSync = new CacheSync();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cacheSync;
}
