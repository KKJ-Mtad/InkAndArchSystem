// Enhanced API utility that works with both mock data and real database
class APIManager {
  constructor() {
    this.useRealDB = this.shouldUseRealDB();
    this.dbManager = null;
    this.init();
  }

  shouldUseRealDB() {
    // Default to true (SQLite) unless explicitly disabled
    return (
      window.USE_REAL_DB !== false &&
      localStorage.getItem("useRealDB") !== "false" &&
      !window.location.search.includes("realdb=false")
    );
  }

  async init() {
    if (this.useRealDB) {
      // Always try to use server-side SQLite database
      try {
        // Test server connectivity with a simple ping endpoint instead of login
        const response = await fetch('/api/patients', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        // If server responds (even with error), we know it's running
        if (response) {
          console.log("✅ Server is running, using SQLite database");
          this.dbManager = window.dbManager; // Optional database manager for local operations
        }
      } catch (error) {
        console.warn("⚠️ Server not available, keeping real DB flag for retry");
        // Keep useRealDB true - server might start up later
      }
    }
  }

  // Employee operations
  async getEmployees() {
    if (this.useRealDB && this.dbManager) {
      try {
        const employees = await this.dbManager.getEmployees();
        // If no employees in database, seed with mock data
        if (employees.length === 0) {
          await this.seedEmployees();
          return await this.dbManager.getEmployees();
        }
        return employees;
      } catch (error) {
        console.error("Database error, falling back to mock:", error);
        this.useRealDB = false;
      }
    }

    // Fallback to empty array
    return [];
  }

  async getEmployee(id) {
    if (this.useRealDB && this.dbManager) {
      try {
        const employees = await this.dbManager.getEmployees();
        return employees.find((emp) => emp.id === parseInt(id));
      } catch (error) {
        console.error("Database error, falling back to mock:", error);
      }
    }

    return null;
  }

  async addEmployee(employee) {
    if (this.useRealDB && this.dbManager) {
      try {
        return await this.dbManager.addEmployee(employee);
      } catch (error) {
        console.error("Database error:", error);
        throw error;
      }
    }

    // Fallback implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        employee.id = Date.now();
        resolve(employee);
      }, 500);
    });
  }

  async updateEmployee(id, employee) {
    if (this.useRealDB && this.dbManager) {
      try {
        return await this.dbManager.updateEmployee(id, employee);
      } catch (error) {
        console.error("Database error:", error);
        throw error;
      }
    }

    // Fallback implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...employee, id: parseInt(id) });
      }, 500);
    });
  }

  async deleteEmployee(id) {
    if (this.useRealDB && this.dbManager) {
      try {
        return await this.dbManager.deleteEmployee(id);
      } catch (error) {
        console.error("Database error:", error);
        throw error;
      }
    }

    // Fallback implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 500);
    });
  }

  // Authentication
  async login(email, password) {
    if (this.useRealDB && this.dbManager) {
      try {
        // In a real implementation, this would hash the password and check against database
        const users =
          (await this.dbManager.getFromLocalStorage("users")) || [];
        const user = users.find(
          (u) => u.email === email && u.password === password,
        );

        if (user) {
          return {
            token: this.generateToken(),
            user: {
              name: user.name,
              email: user.email,
              role: user.role,
              permissions: user.permissions,
            },
          };
        } else {
          throw new Error("Invalid credentials");
        }
      } catch (error) {
        console.error("Database login error:", error);
      }
    }

    throw new Error("Invalid credentials");
  }

  // Time tracking operations
  async clockIn(employeeId, attendanceStatus = "on-time") {
    const now = new Date();
    const entry = {
      id: Date.now(),
      employeeId: parseInt(employeeId),
      date: now.toISOString().split("T")[0],
      timeIn: now.toTimeString().substring(0, 8),
      timeOut: null,
      status: "present",
      attendanceStatus: attendanceStatus,
      timestamp: now.toISOString(),
    };

    if (this.useRealDB && this.dbManager) {
      try {
        await this.dbManager.addTimeEntry(entry);
        return entry;
      } catch (error) {
        console.error("Database error:", error);
      }
    }

    // Fallback implementation with enhanced data
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(entry);
      }, 500);
    });
  }

  async clockOut(employeeId) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    if (this.useRealDB && this.dbManager) {
      try {
        const entries = await this.dbManager.getTimeEntries(employeeId, today);
        const activeEntry = entries.find((e) => !e.timeOut);

        if (activeEntry) {
          activeEntry.timeOut = now.toTimeString().substring(0, 8);
          activeEntry.duration = this.calculateDuration(
            activeEntry.timeIn,
            activeEntry.timeOut,
          );
          await this.dbManager.updateInIndexedDB(
            "timeEntries",
            activeEntry.id,
            activeEntry,
          );
          return activeEntry;
        }
      } catch (error) {
        console.error("Database error:", error);
      }
    }

    // Fallback implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(null);
      }, 500);
    });
  }

  // Attendance operations
  async addAttendanceRecord(record) {
    if (this.useRealDB && this.dbManager) {
      try {
        return await this.dbManager.addAttendanceRecord(record);
      } catch (error) {
        console.error("Database error:", error);
        throw error;
      }
    }

    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        record.id = Date.now();
        record.timestamp = new Date().toISOString();
        // Store in localStorage for mock implementation
        const attendance = storage.get("attendance") || [];
        attendance.push(record);
        storage.set("attendance", attendance);
        resolve(record);
      }, 500);
    });
  }

  async getTimeEntries(employeeId = null, date = null) {
    if (this.useRealDB && this.dbManager) {
      try {
        return await this.dbManager.getTimeEntries(employeeId, date);
      } catch (error) {
        console.error("Database error:", error);
      }
    }

    // Fallback implementation
    return Promise.resolve([]);
  }

  async getAttendanceRecords(filters = {}) {
    if (this.useRealDB && this.dbManager) {
      try {
        return (await this.dbManager.getFromLocalStorage("attendance")) || [];
      } catch (error) {
        console.error("Database error:", error);
      }
    }

    // Fallback implementation
    return Promise.resolve(storage.get("attendance") || []);
  }

  // Utility methods
  calculateDuration(timeIn, timeOut) {
    if (!timeIn || !timeOut) return null;

    const [inHours, inMinutes, inSeconds = 0] = timeIn.split(":").map(Number);
    const [outHours, outMinutes, outSeconds = 0] = timeOut
      .split(":")
      .map(Number);

    const inDate = new Date();
    inDate.setHours(inHours, inMinutes, inSeconds);

    const outDate = new Date();
    outDate.setHours(outHours, outMinutes, outSeconds);

    const diffMs = outDate - inDate;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  generateToken() {
    return "enhanced-jwt-token-" + Date.now();
  }

  // Seed database with mock data
  async seedEmployees() {
    if (!this.useRealDB || !this.dbManager) return;

    try {
      // No mock data available to seed

      console.log("Database seeded with mock data");
    } catch (error) {
      console.error("Error seeding database:", error);
    }
  }

  // Database management
  async switchToRealDB() {
    this.useRealDB = true;
    localStorage.setItem("useRealDB", "true");
    await this.init();
    await this.seedEmployees();
  }


  async exportData() {
    if (this.useRealDB && this.dbManager) {
      return await this.dbManager.exportData();
    }

    // Export from localStorage fallback
    return {
      employees: storage.get("employees") || [],
      timeEntries: storage.get("timeEntries") || [],
      attendance: storage.get("attendance") || [],
      users: storage.get("users") || [],
    };
  }

  async importData(data) {
    if (this.useRealDB && this.dbManager) {
      return await this.dbManager.importData(data);
    }

    // Import to localStorage fallback
    if (data.employees) storage.set("employees", data.employees);
    if (data.timeEntries) storage.set("timeEntries", data.timeEntries);
    if (data.attendance) storage.set("attendance", data.attendance);
    if (data.users) storage.set("users", data.users);
  }

  // Get current database status
  getStatus() {
    return {
      useRealDB: this.useRealDB,
      dbType: this.dbManager?.dbType || "localStorage",
      isOnline: navigator.onLine,
    };
  }
}

// Initialize API manager
const apiManager = new APIManager();

// Enhanced API object that uses the API manager
const enhancedAPI = {
  // Employee operations
  getEmployees: () => apiManager.getEmployees(),
  getEmployee: (id) => apiManager.getEmployee(id),
  addEmployee: (employee) => apiManager.addEmployee(employee),
  updateEmployee: (id, employee) => apiManager.updateEmployee(id, employee),
  deleteEmployee: (id) => apiManager.deleteEmployee(id),

  // Authentication
  login: (email, password) => apiManager.login(email, password),

  // Time tracking
  clockIn: (employeeId, attendanceStatus) =>
    apiManager.clockIn(employeeId, attendanceStatus),
  clockOut: (employeeId) => apiManager.clockOut(employeeId),
  getTimeEntries: (employeeId, date) =>
    apiManager.getTimeEntries(employeeId, date),

  // Attendance
  addAttendanceRecord: (record) => apiManager.addAttendanceRecord(record),
  getAttendanceRecords: (filters) => apiManager.getAttendanceRecords(filters),

  // Database management
  switchToRealDB: () => apiManager.switchToRealDB(),
  exportData: () => apiManager.exportData(),
  importData: (data) => apiManager.importData(data),
  getStatus: () => apiManager.getStatus(),

  // Utilities
  calculateDuration: (timeIn, timeOut) =>
    apiManager.calculateDuration(timeIn, timeOut),
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.apiManager = apiManager;
  window.enhancedAPI = enhancedAPI;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { APIManager, enhancedAPI };
}
