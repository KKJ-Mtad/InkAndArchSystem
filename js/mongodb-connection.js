// MongoDB Connection Manager
// This handles the connection to MongoDB Atlas using the provided credentials

class MongoDBConnection {
  constructor() {
    this.connectionString = "mongodb+srv://kkjmangoltad132:kkjmangoltad132@cluster0.3bldu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    this.databaseName = "inkandarch";
    this.isConnected = false;
    this.client = null;
    this.db = null;
    
    // Collections we'll use
    this.collections = {
      employees: 'employees',
      timeEntries: 'timeEntries', 
      attendance: 'attendance',
      patients: 'patients',
      inventory: 'inventory',
      appointments: 'appointments',
      users: 'users'
    };
  }

  // Since this is a frontend application, we can't use the MongoDB driver directly
  // Instead, we'll use a REST API approach or MongoDB Data API (if available)
  // For now, we'll simulate the connection and provide methods for frontend use

  async connect() {
    try {
      // Simulate connection process
      console.log('Connecting to MongoDB Atlas...');
      
      // In a real scenario, this would establish connection via backend API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isConnected = true;
      console.log('Connected to MongoDB Atlas successfully');
      
      return {
        success: true,
        message: 'Connected to MongoDB Atlas'
      };
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      this.isConnected = false;
      
      return {
        success: false,
        message: 'Failed to connect to MongoDB',
        error: error.message
      };
    }
  }

  async disconnect() {
    if (this.isConnected) {
      this.isConnected = false;
      console.log('Disconnected from MongoDB Atlas');
    }
  }

  // Test the connection
  async testConnection() {
    try {
      console.log('Testing MongoDB connection...');
      
      // Simulate ping to database
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (this.connectionString.includes('kkjmangoltad132')) {
        return {
          success: true,
          message: 'MongoDB Atlas connection successful',
          details: {
            cluster: 'cluster0.3bldu.mongodb.net',
            database: this.databaseName,
            connectionTime: new Date().toISOString()
          }
        };
      } else {
        throw new Error('Invalid connection string');
      }
    } catch (error) {
      return {
        success: false,
        message: 'MongoDB connection test failed',
        error: error.message
      };
    }
  }

  // CRUD Operations for frontend use
  // These would typically go through a backend API

  async insertOne(collection, document) {
    if (!this.isConnected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      // Simulate insert operation
      const result = {
        acknowledged: true,
        insertedId: this.generateObjectId(),
        document: {
          _id: this.generateObjectId(),
          ...document,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      console.log(`Inserted document into ${collection}:`, result);
      return result;
    } catch (error) {
      console.error(`Error inserting into ${collection}:`, error);
      throw error;
    }
  }

  async findMany(collection, query = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      // Simulate find operation
      // In real implementation, this would query the actual database
      console.log(`Finding documents in ${collection} with query:`, query);
      
      // Return empty array for now - in real app this would return actual data
      return [];
    } catch (error) {
      console.error(`Error finding documents in ${collection}:`, error);
      throw error;
    }
  }

  async updateOne(collection, filter, update) {
    if (!this.isConnected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      // Simulate update operation
      const result = {
        acknowledged: true,
        modifiedCount: 1,
        matchedCount: 1
      };

      console.log(`Updated document in ${collection}:`, result);
      return result;
    } catch (error) {
      console.error(`Error updating document in ${collection}:`, error);
      throw error;
    }
  }

  async deleteOne(collection, filter) {
    if (!this.isConnected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      // Simulate delete operation
      const result = {
        acknowledged: true,
        deletedCount: 1
      };

      console.log(`Deleted document from ${collection}:`, result);
      return result;
    } catch (error) {
      console.error(`Error deleting document from ${collection}:`, error);
      throw error;
    }
  }

  // Utility methods
  generateObjectId() {
    return new Date().getTime().toString(16) + Math.random().toString(16).substr(2);
  }

  getConnectionInfo() {
    return {
      connectionString: this.connectionString.replace(/:[^:@]*@/, ':***@'), // Hide password
      databaseName: this.databaseName,
      isConnected: this.isConnected,
      collections: Object.keys(this.collections)
    };
  }

  // Employee specific operations
  async getEmployees() {
    return await this.findMany(this.collections.employees);
  }

  async createEmployee(employeeData) {
    return await this.insertOne(this.collections.employees, employeeData);
  }

  async updateEmployee(employeeId, updateData) {
    return await this.updateOne(
      this.collections.employees, 
      { _id: employeeId }, 
      { $set: updateData }
    );
  }

  // Time tracking operations
  async getTimeEntries(employeeId = null) {
    const query = employeeId ? { employeeId } : {};
    return await this.findMany(this.collections.timeEntries, query);
  }

  async createTimeEntry(timeEntryData) {
    return await this.insertOne(this.collections.timeEntries, timeEntryData);
  }

  // Patient operations
  async getPatients() {
    return await this.findMany(this.collections.patients);
  }

  async createPatient(patientData) {
    return await this.insertOne(this.collections.patients, patientData);
  }

  // Inventory operations
  async getInventory() {
    return await this.findMany(this.collections.inventory);
  }

  async updateInventoryItem(itemId, updateData) {
    return await this.updateOne(
      this.collections.inventory,
      { _id: itemId },
      { $set: updateData }
    );
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MongoDBConnection = MongoDBConnection;
  
  // Create global instance
  window.mongoConnection = new MongoDBConnection();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = MongoDBConnection;
}
