// Enhanced Database Manager with SQLite and MongoDB Atlas
class EnhancedDatabaseManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.db = null;
    this.mongoClient = null;
    this.dbType = this.getDbType();
    this.syncQueue = [];
    this.lastSyncTime = null;

    this.init();
    this.setupSyncListeners();
  }

  getDbType() {
    // For browser environment, use IndexedDB as SQLite alternative
    // In production with Cloudflare Pages, this would be IndexedDB
    return this.isOnline ? "hybrid" : "indexeddb";
  }

  async init() {
    try {
      // Always initialize IndexedDB for local storage
      await this.initIndexedDB();

      // Try to initialize MongoDB connection if online
      if (this.isOnline) {
        await this.initMongoDB();
      }

      console.log(`Database initialized: ${this.dbType}`);

      // Start sync process if we have pending items
      this.startPeriodicSync();
    } catch (error) {
      console.error("Database initialization failed:", error);
      // Fallback to localStorage if IndexedDB fails
      this.dbType = "localstorage";
      console.log("Falling back to localStorage");
    }
  }

  // IndexedDB implementation (local storage)
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("InkAndArchDB", 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores (tables) with proper indexes
        this.createObjectStore(db, "patients", ["mobile", "status", "createdAt"]);
        this.createObjectStore(db, "appointments", ["patientId", "date", "treatment", "createdAt"]);
        this.createObjectStore(db, "inventory", ["category", "quantity", "minQuantity", "lastUpdated"]);
        this.createObjectStore(db, "inventoryLogs", ["itemId", "action", "timestamp"]);
        this.createObjectStore(db, "employees", ["email", "status", "department"]);
        this.createObjectStore(db, "users", ["email", "role"]);
        this.createObjectStore(db, "syncQueue", ["timestamp", "synced"]);
      };
    });
  }

  createObjectStore(db, storeName, indexes = []) {
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName, {
        keyPath: "id",
        autoIncrement: true,
      });

      // Create indexes for better querying
      indexes.forEach(indexName => {
        const unique = indexName === 'email' || indexName === 'mobile';
        store.createIndex(indexName, indexName, { unique });
      });
    }
  }

  // MongoDB Atlas configuration
  async initMongoDB() {
    // Get configuration from config manager
    const config = window.appConfig?.getMongoDBConfig() || {};

    this.mongoConfig = {
      connectionString: config.connectionString || "mongodb+srv://username:password@cluster.mongodb.net/",
      databaseName: config.databaseName || "inkandarch",
      dataSource: config.dataSource || "Cluster0",
      database: config.database || "inkandarch",
      collections: {
        patients: "patients",
        appointments: "appointments",
        inventory: "inventory",
        inventoryLogs: "inventoryLogs",
        employees: "employees",
        users: "users"
      }
    };

    // Test connection if API key is available and configuration is valid
    if (this.mongoConfig.apiKey && window.appConfig?.validateMongoDBConfig()) {
      try {
        await this.testMongoConnection();
        console.log("MongoDB Atlas connection established");
      } catch (error) {
        console.warn("MongoDB Atlas connection failed, using local only:", error);
        this.mongoConfig.apiKey = ""; // Disable MongoDB sync
      }
    } else {
      console.log("MongoDB configuration not available or invalid, using local storage only");
    }
  }

  async testMongoConnection() {
    const response = await fetch(`${this.mongoConfig.apiUrl}/action/findOne`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.mongoConfig.apiKey,
      },
      body: JSON.stringify({
        collection: "patients",
        database: this.mongoConfig.database,
        dataSource: this.mongoConfig.dataSource,
        filter: { "_id": { "$exists": true } },
        limit: 1
      }),
    });

    if (!response.ok) {
      throw new Error(`MongoDB connection test failed: ${response.status}`);
    }

    return response.json();
  }

  // CRUD Operations with local-first approach
  async create(collection, data) {
    try {
      // Always save to local first
      const localResult = await this.createLocal(collection, data);

      // Queue for sync to MongoDB
      this.queueForSync('create', collection, localResult);

      // Try immediate sync if online
      if (this.isOnline) {
        this.syncToMongoDB();
      }

      return localResult;
    } catch (error) {
      console.error(`Error creating ${collection}:`, error);
      throw error;
    }
  }

  async read(collection, filter = {}) {
    try {
      // Always read from local first
      return await this.readLocal(collection, filter);
    } catch (error) {
      console.error(`Error reading ${collection}:`, error);
      return [];
    }
  }

  async update(collection, id, data) {
    try {
      // Always update local first
      const localResult = await this.updateLocal(collection, id, data);

      // Queue for sync to MongoDB
      this.queueForSync('update', collection, { id, ...data });

      // Try immediate sync if online
      if (this.isOnline) {
        this.syncToMongoDB();
      }

      return localResult;
    } catch (error) {
      console.error(`Error updating ${collection}:`, error);
      throw error;
    }
  }

  async delete(collection, id) {
    try {
      // Always delete from local first
      const localResult = await this.deleteLocal(collection, id);

      // Queue for sync to MongoDB
      this.queueForSync('delete', collection, { id });

      // Try immediate sync if online
      if (this.isOnline) {
        this.syncToMongoDB();
      }

      return localResult;
    } catch (error) {
      console.error(`Error deleting from ${collection}:`, error);
      throw error;
    }
  }

  // Local IndexedDB operations
  async createLocal(collection, data) {
    if (this.dbType === "localstorage") {
      return this.addToLocalStorage(collection, data);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([collection], "readwrite");
      const store = transaction.objectStore(collection);

      // Add timestamp
      const record = {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const request = store.add(record);

      request.onsuccess = () => {
        resolve({ ...record, id: request.result });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async readLocal(collection, filter = {}) {
    if (this.dbType === "localstorage") {
      return this.getFromLocalStorage(collection);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([collection], "readonly");
      const store = transaction.objectStore(collection);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result;

        // Apply basic filtering
        if (Object.keys(filter).length > 0) {
          results = results.filter(item => {
            return Object.entries(filter).every(([key, value]) => item[key] === value);
          });
        }

        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateLocal(collection, id, data) {
    if (this.dbType === "localstorage") {
      return this.updateInLocalStorage(collection, id, data);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([collection], "readwrite");
      const store = transaction.objectStore(collection);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingRecord = getRequest.result;
        if (existingRecord) {
          const updatedRecord = {
            ...existingRecord,
            ...data,
            updatedAt: new Date().toISOString()
          };

          const putRequest = store.put(updatedRecord);
          putRequest.onsuccess = () => resolve(updatedRecord);
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Record with id ${id} not found`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteLocal(collection, id) {
    if (this.dbType === "localstorage") {
      return this.deleteFromLocalStorage(collection, id);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([collection], "readwrite");
      const store = transaction.objectStore(collection);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue management
  queueForSync(action, collection, data) {
    const syncItem = {
      id: Date.now() + Math.random(),
      action,
      collection,
      data,
      timestamp: new Date().toISOString(),
      synced: false
    };

    this.syncQueue.push(syncItem);

    // Also store in IndexedDB for persistence
    if (this.db) {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      store.add(syncItem);
    }
  }

  async syncToMongoDB() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    console.log(`Syncing ${this.syncQueue.length} items to MongoDB...`);

    const itemsToSync = [...this.syncQueue];

    for (const item of itemsToSync) {
      try {
        await this.syncItemToMongoDB(item);

        // Remove from sync queue on success
        this.syncQueue = this.syncQueue.filter(qItem => qItem.id !== item.id);

        // Update sync status in IndexedDB
        if (this.db) {
          const transaction = this.db.transaction(['syncQueue'], 'readwrite');
          const store = transaction.objectStore('syncQueue');
          store.delete(item.id);
        }

      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        // Keep item in queue for retry
      }
    }

    this.lastSyncTime = new Date().toISOString();
    console.log(`Sync completed. ${this.syncQueue.length} items remaining.`);
  }

  async syncItemToMongoDB(item) {
    const { action, collection, data } = item;

    switch (action) {
      case 'create':
        return await this.createInMongoDB(collection, data);
      case 'update':
        return await this.updateInMongoDB(collection, data.id, data);
      case 'delete':
        return await this.deleteFromMongoDB(collection, data.id);
      default:
        throw new Error(`Unknown sync action: ${action}`);
    }
  }

  // MongoDB operations
  async createInMongoDB(collection, data) {
    const mongoCollection = this.mongoConfig.collections[collection];

    const response = await fetch(`${this.mongoConfig.apiUrl}/action/insertOne`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.mongoConfig.apiKey,
      },
      body: JSON.stringify({
        collection: mongoCollection,
        database: this.mongoConfig.database,
        dataSource: this.mongoConfig.dataSource,
        document: data,
      }),
    });

    if (!response.ok) {
      throw new Error(`MongoDB create failed: ${response.status}`);
    }

    return response.json();
  }

  async updateInMongoDB(collection, id, data) {
    const mongoCollection = this.mongoConfig.collections[collection];

    const response = await fetch(`${this.mongoConfig.apiUrl}/action/updateOne`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.mongoConfig.apiKey,
      },
      body: JSON.stringify({
        collection: mongoCollection,
        database: this.mongoConfig.database,
        dataSource: this.mongoConfig.dataSource,
        filter: { localId: id }, // Use localId to find the record
        update: { $set: data },
        upsert: true
      }),
    });

    if (!response.ok) {
      throw new Error(`MongoDB update failed: ${response.status}`);
    }

    return response.json();
  }

  async deleteFromMongoDB(collection, id) {
    const mongoCollection = this.mongoConfig.collections[collection];

    const response = await fetch(`${this.mongoConfig.apiUrl}/action/deleteOne`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.mongoConfig.apiKey,
      },
      body: JSON.stringify({
        collection: mongoCollection,
        database: this.mongoConfig.database,
        dataSource: this.mongoConfig.dataSource,
        filter: { localId: id },
      }),
    });

    if (!response.ok) {
      throw new Error(`MongoDB delete failed: ${response.status}`);
    }

    return response.json();
  }

  // Sync management
  setupSyncListeners() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Connection restored, starting sync...');
      this.syncToMongoDB();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Connection lost, switching to local-only mode');
    });

    // Load any pending sync items from IndexedDB on startup
    setTimeout(() => {
      this.loadPendingSyncItems();
    }, 1000);
  }

  async loadPendingSyncItems() {
    if (!this.db) return;

    try {
      const pendingItems = await this.readLocal('syncQueue', { synced: false });
      this.syncQueue = pendingItems;

      if (this.syncQueue.length > 0) {
        console.log(`Loaded ${this.syncQueue.length} pending sync items`);
        if (this.isOnline) {
          this.syncToMongoDB();
        }
      }
    } catch (error) {
      console.error('Failed to load pending sync items:', error);
    }
  }

  startPeriodicSync() {
    // Sync every 5 minutes when online
    setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.syncToMongoDB();
      }
    }, 5 * 60 * 1000);
  }

  // LocalStorage fallback methods (same as before)
  getFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("LocalStorage get error:", error);
      return [];
    }
  }

  addToLocalStorage(key, data) {
    try {
      const existing = this.getFromLocalStorage(key);
      data.id = data.id || Date.now();
      data.createdAt = data.createdAt || new Date().toISOString();
      data.updatedAt = new Date().toISOString();
      existing.push(data);
      localStorage.setItem(key, JSON.stringify(existing));
      return data;
    } catch (error) {
      console.error("LocalStorage add error:", error);
      throw error;
    }
  }

  updateInLocalStorage(key, id, data) {
    try {
      const existing = this.getFromLocalStorage(key);
      const index = existing.findIndex((item) => item.id === id);
      if (index !== -1) {
        existing[index] = {
          ...existing[index],
          ...data,
          id,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(existing));
        return existing[index];
      }
      return null;
    } catch (error) {
      console.error("LocalStorage update error:", error);
      throw error;
    }
  }

  deleteFromLocalStorage(key, id) {
    try {
      const existing = this.getFromLocalStorage(key);
      const filtered = existing.filter((item) => item.id !== id);
      localStorage.setItem(key, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error("LocalStorage delete error:", error);
      throw error;
    }
  }

  // Export/Import for backup
  async exportAllData() {
    const collections = ['patients', 'appointments', 'inventory', 'inventoryLogs', 'employees'];
    const exportData = {};

    for (const collection of collections) {
      exportData[collection] = await this.read(collection);
    }

    exportData.exportDate = new Date().toISOString();
    exportData.syncQueueLength = this.syncQueue.length;

    return exportData;
  }

  // Utility methods
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      pendingSyncItems: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      dbType: this.dbType
    };
  }
}

// Initialize enhanced database manager
const enhancedDB = new EnhancedDatabaseManager();

// Export for use in other modules
if (typeof window !== "undefined") {
  window.enhancedDB = enhancedDB;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = EnhancedDatabaseManager;
}
