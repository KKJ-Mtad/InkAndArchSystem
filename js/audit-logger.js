// Comprehensive Audit Logging System
class AuditLogger {
  constructor() {
    this.logTypes = {
      PATIENT: 'patient',
      EMPLOYEE: 'employee',
      INVENTORY: 'inventory',
      USER: 'user',
      SYSTEM: 'system'
    };

    this.actions = {
      CREATE: 'create',
      UPDATE: 'update',
      DELETE: 'delete',
      LOGIN: 'login',
      LOGOUT: 'logout',
      ACCESS: 'access',
      EXPORT: 'export',
      IMPORT: 'import'
    };
  }

  /**
   * Create a comprehensive audit log entry
   * @param {string} type - Type of entity (patient, employee, inventory, user, system)
   * @param {string} action - Action performed (create, update, delete, etc.)
   * @param {Object} data - Data related to the action
   * @param {Object} options - Additional options
   */
  async log(type, action, data, options = {}) {
    try {
      const currentUser = storage.get("currentUser");
      const logEntry = {
        id: this.generateLogId(),
        timestamp: new Date().toISOString(),
        type: type,
        action: action,
        userId: currentUser?.email || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'system',
        entityId: data.entityId || null,
        entityName: data.entityName || null,
        details: data.details || {},
        oldValue: data.oldValue || null,
        newValue: data.newValue || null,
        changes: data.changes || [],
        reason: options.reason || '',
        ipAddress: this.getClientIP(),
        sessionId: this.getSessionId(),
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          ...options.metadata
        }
      };

      // Store log entry
      await this.storeLogEntry(logEntry);

      // Emit event for real-time monitoring
      this.emitLogEvent(logEntry);

      return logEntry;
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Fail silently to not disrupt application flow
    }
  }

  /**
   * Log patient-related activities
   */
  async logPatient(action, patientData, options = {}) {
    let details = {};
    let entityName = '';

    switch (action) {
      case this.actions.CREATE:
        entityName = patientData.name || 'New Patient';
        details = {
          patientId: patientData.id,
          name: patientData.name,
          mobile: patientData.mobile,
          contact: patientData.contact
        };
        break;

      case this.actions.UPDATE:
        entityName = patientData.name || `Patient ${patientData.id}`;
        details = {
          patientId: patientData.id,
          updatedFields: patientData.updatedFields || []
        };
        break;

      case this.actions.DELETE:
        entityName = patientData.name || `Patient ${patientData.id}`;
        details = {
          patientId: patientData.id,
          deletedData: patientData
        };
        break;
    }

    return await this.log(this.logTypes.PATIENT, action, {
      entityId: patientData.id,
      entityName: entityName,
      details: details,
      oldValue: patientData.oldValue,
      newValue: patientData.newValue,
      changes: patientData.changes
    }, options);
  }

  /**
   * Log employee-related activities
   */
  async logEmployee(action, employeeData, options = {}) {
    let details = {};
    let entityName = '';

    switch (action) {
      case this.actions.CREATE:
        entityName = employeeData.name || 'New Employee';
        details = {
          employeeId: employeeData.id,
          name: employeeData.name,
          email: employeeData.email,
          role: employeeData.role,
          department: employeeData.department
        };
        break;

      case this.actions.UPDATE:
        entityName = employeeData.name || `Employee ${employeeData.id}`;
        details = {
          employeeId: employeeData.id,
          updatedFields: employeeData.updatedFields || []
        };
        break;

      case this.actions.DELETE:
        entityName = employeeData.name || `Employee ${employeeData.id}`;
        details = {
          employeeId: employeeData.id,
          deletedData: employeeData
        };
        break;
    }

    return await this.log(this.logTypes.EMPLOYEE, action, {
      entityId: employeeData.id,
      entityName: entityName,
      details: details,
      oldValue: employeeData.oldValue,
      newValue: employeeData.newValue,
      changes: employeeData.changes
    }, options);
  }

  /**
   * Log inventory-related activities (enhanced version of existing system)
   */
  async logInventory(action, inventoryData, options = {}) {
    let details = {};
    let entityName = '';

    switch (action) {
      case this.actions.CREATE:
        entityName = inventoryData.name || 'New Item';
        details = {
          itemId: inventoryData.id,
          name: inventoryData.name,
          category: inventoryData.category,
          initialQuantity: inventoryData.quantity
        };
        break;

      case this.actions.UPDATE:
        entityName = inventoryData.name || `Item ${inventoryData.id}`;
        details = {
          itemId: inventoryData.id,
          quantityChange: inventoryData.quantityChange,
          reason: inventoryData.reason || 'Stock adjustment'
        };
        break;

      case this.actions.DELETE:
        entityName = inventoryData.name || `Item ${inventoryData.id}`;
        details = {
          itemId: inventoryData.id,
          deletedData: inventoryData
        };
        break;
    }

    return await this.log(this.logTypes.INVENTORY, action, {
      entityId: inventoryData.id,
      entityName: entityName,
      details: details,
      oldValue: inventoryData.oldValue,
      newValue: inventoryData.newValue,
      changes: inventoryData.changes
    }, options);
  }

  /**
   * Log user authentication and access activities
   */
  async logUser(action, userData, options = {}) {
    let details = {};
    let entityName = '';

    switch (action) {
      case this.actions.LOGIN:
        entityName = userData.name || userData.email;
        details = {
          userId: userData.email,
          name: userData.name,
          role: userData.role,
          loginMethod: userData.loginMethod || 'standard'
        };
        break;

      case this.actions.LOGOUT:
        entityName = userData.name || userData.email;
        details = {
          userId: userData.email,
          sessionDuration: userData.sessionDuration
        };
        break;

      case this.actions.ACCESS:
        entityName = userData.name || userData.email;
        details = {
          userId: userData.email,
          resource: userData.resource,
          permission: userData.permission
        };
        break;
    }

    return await this.log(this.logTypes.USER, action, {
      entityId: userData.email,
      entityName: entityName,
      details: details
    }, options);
  }

  /**
   * Log system-level activities
   */
  async logSystem(action, systemData, options = {}) {
    return await this.log(this.logTypes.SYSTEM, action, {
      entityId: systemData.id || 'system',
      entityName: systemData.name || 'System Operation',
      details: systemData.details || {}
    }, options);
  }

  /**
   * Store log entry in database
   */
  async storeLogEntry(logEntry) {
    try {
      // Store in localStorage for immediate access
      const existingLogs = storage.get('auditLogs') || [];
      existingLogs.push(logEntry);

      // Keep only last 1000 logs in localStorage to prevent overflow
      if (existingLogs.length > 1000) {
        existingLogs.splice(0, existingLogs.length - 1000);
      }

      storage.set('auditLogs', existingLogs);

      // If database manager is available, store in database
      if (typeof window.databaseManager !== 'undefined') {
        await window.databaseManager.create('auditLogs', logEntry);
      }
    } catch (error) {
      console.error('Failed to store audit log:', error);
    }
  }

  /**
   * Retrieve audit logs with filtering
   */
  async getLogs(filters = {}) {
    try {
      let logs = storage.get('auditLogs') || [];

      // Apply filters
      if (filters.type) {
        logs = logs.filter(log => log.type === filters.type);
      }

      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }

      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }

      if (filters.startDate) {
        logs = logs.filter(log => new Date(log.timestamp) >= new Date(filters.startDate));
      }

      if (filters.endDate) {
        logs = logs.filter(log => new Date(log.timestamp) <= new Date(filters.endDate));
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return logs;
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      return [];
    }
  }

  /**
   * Generate unique log ID
   */
  generateLogId() {
    return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get client IP (simplified for demo)
   */
  getClientIP() {
    return 'localhost'; // In real implementation, this would get actual IP
  }

  /**
   * Get session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Emit log event for real-time monitoring
   */
  emitLogEvent(logEntry) {
    // Dispatch custom event for real-time log monitoring
    const event = new CustomEvent('auditLog', {
      detail: logEntry
    });
    document.dispatchEvent(event);
  }

  /**
   * Export logs to file
   */
  async exportLogs(filters = {}, format = 'json') {
    try {
      const logs = await this.getLogs(filters);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audit_logs_${timestamp}.${format}`;

      let content;
      let mimeType;

      if (format === 'csv') {
        content = this.convertToCSV(logs);
        mimeType = 'text/csv';
      } else {
        content = JSON.stringify(logs, null, 2);
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log the export action
      await this.logSystem(this.actions.EXPORT, {
        name: 'Audit Logs Export',
        details: {
          format: format,
          recordCount: logs.length,
          filters: filters
        }
      });

      return { success: true, filename: filename, recordCount: logs.length };
    } catch (error) {
      console.error('Failed to export logs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';

    const headers = [
      'Timestamp', 'Type', 'Action', 'User', 'Role', 'Entity', 'Details', 'Changes'
    ];

    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        log.timestamp,
        log.type,
        log.action,
        log.userName,
        log.userRole,
        log.entityName || '',
        JSON.stringify(log.details).replace(/"/g, '""'),
        JSON.stringify(log.changes || []).replace(/"/g, '""')
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Clean up old logs (retention policy)
   */
  async cleanupOldLogs(retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let logs = storage.get('auditLogs') || [];
      const originalCount = logs.length;

      logs = logs.filter(log => new Date(log.timestamp) >= cutoffDate);

      storage.set('auditLogs', logs);

      const cleanedCount = originalCount - logs.length;

      if (cleanedCount > 0) {
        await this.logSystem(this.actions.DELETE, {
          name: 'Audit Log Cleanup',
          details: {
            cleanedRecords: cleanedCount,
            retentionDays: retentionDays,
            cutoffDate: cutoffDate.toISOString()
          }
        });
      }

      return { cleanedCount, remainingCount: logs.length };
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      return { error: error.message };
    }
  }
}

// Create global instance
window.auditLogger = new AuditLogger();

// Auto-cleanup logs on initialization (run once per session)
if (!sessionStorage.getItem('auditLogCleanupDone')) {
  window.auditLogger.cleanupOldLogs().then(() => {
    sessionStorage.setItem('auditLogCleanupDone', 'true');
  });
}
