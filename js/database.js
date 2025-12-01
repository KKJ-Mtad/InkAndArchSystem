// Database Configuration and Connection Manager
//
// ARCHITECTURE CLARIFICATION:
// - Server: Uses SQLite as PRIMARY database (see server.js)
// - Client: Uses API calls to server as PRIMARY, with localStorage as fallback
// - This file provides compatibility layer for offline functionality only
//
class DatabaseManager {
  constructor() {
    this.dbType = this.getDbType();
    this.isOnline = navigator.onLine;
    this.db = null;
    this.mongoClient = null;
    this.serverApiUrl = window.location.origin; // Use current origin for API calls
    this.init();
  }

  getDbType() {
    // Check if running in browser environment
    if (typeof window !== "undefined") {
      // For browser environment, prioritize server API, fallback to localStorage
      return this.isOnline ? "server_api" : "localstorage";
    }
    // For Node.js environment, use actual SQLite
    return this.isOnline ? "mongodb" : "sqlite";
  }

  async init() {
    try {
      if (this.dbType === "server_api") {
        // Test server API connection
        await this.testServerConnection();
        console.log(`✅ Database initialized: Server API (SQLite backend)`);
      } else if (this.dbType === "indexeddb") {
        await this.initIndexedDB();
        console.log(`📱 Database initialized: IndexedDB (offline mode)`);
      } else if (this.dbType === "mongodb") {
        await this.initMongoDB();
        console.log(`☁️ Database initialized: MongoDB`);
      } else {
        console.log(`💾 Database initialized: LocalStorage (fallback mode)`);
      }
    } catch (error) {
      console.error("Database initialization failed:", error);
      // Fallback to localStorage
      this.dbType = "localstorage";
      console.log("🔄 Falling back to localStorage");
    }
  }

  async testServerConnection() {
    try {
      const response = await fetch(`${this.serverApiUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Server health check failed: ${response.status}`);
      }
      const health = await response.json();
      console.log('🏥 Server health:', health);
      return true;
    } catch (error) {
      console.error('❌ Server connection test failed:', error);
      throw error;
    }
  }

  // IndexedDB implementation (SQLite alternative for browser)
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("InkAndArchDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores (tables)
        if (!db.objectStoreNames.contains("employees")) {
          const employeeStore = db.createObjectStore("employees", {
            keyPath: "id",
            autoIncrement: true,
          });
          employeeStore.createIndex("email", "email", { unique: true });
          employeeStore.createIndex("status", "status", { unique: false });
        }

        if (!db.objectStoreNames.contains("timeEntries")) {
          const timeStore = db.createObjectStore("timeEntries", {
            keyPath: "id",
            autoIncrement: true,
          });
          timeStore.createIndex("employeeId", "employeeId", { unique: false });
          timeStore.createIndex("date", "date", { unique: false });
        }

        if (!db.objectStoreNames.contains("attendance")) {
          const attendanceStore = db.createObjectStore("attendance", {
            keyPath: "id",
            autoIncrement: true,
          });
          attendanceStore.createIndex("employeeId", "employeeId", {
            unique: false,
          });
          attendanceStore.createIndex("date", "date", { unique: false });
          attendanceStore.createIndex("status", "status", { unique: false });
        }
      };
    });
  }

  // MongoDB Atlas configuration
  async initMongoDB() {
    // MongoDB connection configuration
    this.mongoConfig = {
      // Replace with your MongoDB Atlas connection string
      connectionString:
        process.env.MONGODB_URI ||
        "mongodb+srv://username:password@cluster.mongodb.net/inkandarch?retryWrites=true&w=majority",
      dbName: "inkandarch",
      collections: {
        employees: "employees",
        timeEntries: "timeEntries",
        attendance: "attendance",
        users: "users",
      },
    };

    // For browser environment, use MongoDB Realm SDK or API calls
    if (typeof window !== "undefined") {
      // Initialize MongoDB API client
      this.mongoConnectionString = process.env.MONGODB_URI || "mongodb+srv://username:password@cluster.mongodb.net/";
      this.mongoDatabaseName = process.env.MONGODB_DB_NAME || "inkandarch";
    }
  }

  // CRUD Operations

  // Employee operations
  async getEmployees() {
    try {
      switch (this.dbType) {
        case "server_api":
          return await this.getFromServerAPI("employees");
        case "indexeddb":
          return await this.getFromIndexedDB("employees");
        case "mongodb":
          return await this.getFromMongoDB("employees");
        default:
          return this.getFromLocalStorage("employees");
      }
    } catch (error) {
      console.error("Error getting employees:", error);
      // Try fallback
      return this.getFromLocalStorage("employees");
    }
  }

  // Server API helper methods
  async getFromServerAPI(entity) {
    try {
      const response = await fetch(`${this.serverApiUrl}/api/${entity}`);
      if (!response.ok) {
        throw new Error(`Server API error: ${response.status}`);
      }
      const data = await response.json();
      console.log(`✅ Loaded ${entity} from server:`, data.length);
      // Cache in localStorage
      this.setInLocalStorage(entity, data);
      return data;
    } catch (error) {
      console.error(`❌ Server API error for ${entity}:`, error);
      // Fallback to localStorage
      return this.getFromLocalStorage(entity);
    }
  }

  async addToServerAPI(entity, data) {
    try {
      const response = await fetch(`${this.serverApiUrl}/api/${entity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error(`Server API error: ${response.status}`);
      }
      const result = await response.json();
      console.log(`✅ Added ${entity} to server:`, result);
      return result.id;
    } catch (error) {
      console.error(`❌ Server API error adding ${entity}:`, error);
      throw error;
    }
  }

  async addEmployee(employee) {
    try {
      switch (this.dbType) {
        case "server_api":
          return await this.addToServerAPI("employees", employee);
        case "indexeddb":
          return await this.addToIndexedDB("employees", employee);
        case "mongodb":
          return await this.addToMongoDB("employees", employee);
        default:
          return this.addToLocalStorage("employees", employee);
      }
    } catch (error) {
      console.error("Error adding employee:", error);
      // Try fallback to localStorage
      return this.addToLocalStorage("employees", employee);
    }
  }

  async updateEmployee(id, employee) {
    try {
      switch (this.dbType) {
        case "indexeddb":
          return await this.updateInIndexedDB("employees", id, employee);
        case "mongodb":
          return await this.updateInMongoDB("employees", id, employee);
        default:
          return this.updateInLocalStorage("employees", id, employee);
      }
    } catch (error) {
      console.error("Error updating employee:", error);
      throw error;
    }
  }

  async deleteEmployee(id) {
    try {
      switch (this.dbType) {
        case "indexeddb":
          return await this.deleteFromIndexedDB("employees", id);
        case "mongodb":
          return await this.deleteFromMongoDB("employees", id);
        default:
          return this.deleteFromLocalStorage("employees", id);
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      throw error;
    }
  }

  // Time entry operations
  async addTimeEntry(entry) {
    try {
      entry.timestamp = new Date().toISOString();
      entry.date = new Date().toISOString().split("T")[0];

      switch (this.dbType) {
        case "indexeddb":
          return await this.addToIndexedDB("timeEntries", entry);
        case "mongodb":
          return await this.addToMongoDB("timeEntries", entry);
        default:
          return this.addToLocalStorage("timeEntries", entry);
      }
    } catch (error) {
      console.error("Error adding time entry:", error);
      throw error;
    }
  }

  async getTimeEntries(employeeId = null, date = null) {
    try {
      let entries;
      switch (this.dbType) {
        case "indexeddb":
          entries = await this.getFromIndexedDB("timeEntries");
          break;
        case "mongodb":
          entries = await this.getFromMongoDB("timeEntries");
          break;
        default:
          entries = this.getFromLocalStorage("timeEntries");
      }

      // Filter by employeeId and/or date if provided
      if (employeeId) {
        entries = entries.filter((entry) => entry.employeeId === employeeId);
      }
      if (date) {
        entries = entries.filter((entry) => entry.date === date);
      }

      return entries;
    } catch (error) {
      console.error("Error getting time entries:", error);
      return [];
    }
  }

  // Attendance operations
  async addAttendanceRecord(record) {
    try {
      record.timestamp = new Date().toISOString();
      record.date = new Date().toISOString().split("T")[0];

      switch (this.dbType) {
        case "indexeddb":
          return await this.addToIndexedDB("attendance", record);
        case "mongodb":
          return await this.addToMongoDB("attendance", record);
        default:
          return this.addToLocalStorage("attendance", record);
      }
    } catch (error) {
      console.error("Error adding attendance record:", error);
      throw error;
    }
  }

  // IndexedDB helper methods
  async getFromIndexedDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addToIndexedDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateInIndexedDB(storeName, id, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      data.id = id;
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFromIndexedDB(storeName, id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // MongoDB helper methods (using MongoDB Driver)
  async getFromMongoDB(collection) {
    if (typeof window === "undefined") {
      // Server-side MongoDB operations would go here
      return [];
    }

    try {
      const response = await fetch(`${this.mongoApiUrl}/action/find`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.mongoApiKey,
        },
        body: JSON.stringify({
          collection: collection,
          database: this.mongoConfig.dbName,
          dataSource: "Cluster0",
        }),
      });

      const result = await response.json();
      return result.documents || [];
    } catch (error) {
      console.error("MongoDB fetch error:", error);
      return [];
    }
  }

  async addToMongoDB(collection, data) {
    if (typeof window === "undefined") {
      // Server-side MongoDB operations would go here
      return null;
    }

    try {
      const response = await fetch(`${this.mongoApiUrl}/action/insertOne`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.mongoApiKey,
        },
        body: JSON.stringify({
          collection: collection,
          database: this.mongoConfig.dbName,
          dataSource: "Cluster0",
          document: data,
        }),
      });

      const result = await response.json();
      return result.insertedId;
    } catch (error) {
      console.error("MongoDB insert error:", error);
      throw error;
    }
  }

  async updateInMongoDB(collection, id, data) {
    if (typeof window === "undefined") {
      // Server-side MongoDB operations would go here
      return null;
    }

    try {
      const response = await fetch(`${this.mongoApiUrl}/action/updateOne`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.mongoApiKey,
        },
        body: JSON.stringify({
          collection: collection,
          database: this.mongoConfig.dbName,
          dataSource: "Cluster0",
          filter: { _id: { $oid: id } },
          update: { $set: data },
        }),
      });

      const result = await response.json();
      return result.modifiedCount > 0;
    } catch (error) {
      console.error("MongoDB update error:", error);
      throw error;
    }
  }

  async deleteFromMongoDB(collection, id) {
    if (typeof window === "undefined") {
      // Server-side MongoDB operations would go here
      return null;
    }

    try {
      const response = await fetch(`${this.mongoApiUrl}/action/deleteOne`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.mongoApiKey,
        },
        body: JSON.stringify({
          collection: collection,
          database: this.mongoConfig.dbName,
          dataSource: "Cluster0",
          filter: { _id: { $oid: id } },
        }),
      });

      const result = await response.json();
      return result.deletedCount > 0;
    } catch (error) {
      console.error("MongoDB delete error:", error);
      throw error;
    }
  }

  // LocalStorage fallback methods
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
      existing.push(data);
      localStorage.setItem(key, JSON.stringify(existing));
      return data.id;
    } catch (error) {
      console.error("LocalStorage add error:", error);
      throw error;
    }
  }

  setInLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("LocalStorage set error:", error);
      return false;
    }
  }

  updateInLocalStorage(key, id, data) {
    try {
      const existing = this.getFromLocalStorage(key);
      const index = existing.findIndex((item) => item.id === id);
      if (index !== -1) {
        existing[index] = { ...existing[index], ...data, id };
        localStorage.setItem(key, JSON.stringify(existing));
        return true;
      }
      return false;
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

  // Database migration and sync
  async syncToCloud() {
    if (this.dbType === "indexeddb" && navigator.onLine) {
      console.log("Syncing local data to cloud...");
      // Implementation for syncing IndexedDB to MongoDB when online
    }
  }

  async exportData() {
    const data = {
      employees: await this.getEmployees(),
      timeEntries: await this.getTimeEntries(),
      attendance: await this.getFromLocalStorage("attendance"),
    };
    return data;
  }

  async importData(data) {
    try {
      if (data.employees) {
        for (const employee of data.employees) {
          await this.addEmployee(employee);
        }
      }
      if (data.timeEntries) {
        for (const entry of data.timeEntries) {
          await this.addTimeEntry(entry);
        }
      }
      if (data.attendance) {
        for (const record of data.attendance) {
          await this.addAttendanceRecord(record);
        }
      }
      console.log("Data import completed");
    } catch (error) {
      console.error("Data import error:", error);
      throw error;
    }
  }
}

// Initialize database manager
const dbManager = new DatabaseManager();

// Export for use in other modules
if (typeof window !== "undefined") {
  window.dbManager = dbManager;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = DatabaseManager;
}
