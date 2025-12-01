// Sync Status Component
class SyncStatusComponent {
  constructor() {
    this.statusElement = null;
    this.isVisible = false;
    this.lastStatus = null;

    this.init();
    this.startStatusCheck();
  }

  init() {
    this.createStatusElement();
    this.setupEventListeners();
  }

  createStatusElement() {
    // Create sync status indicator
    const statusContainer = document.createElement('div');
    statusContainer.className = 'sync-status-container';
    statusContainer.innerHTML = `
      <div class="sync-status" id="syncStatus">
        <div class="sync-icon" id="syncIcon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="sync-text" id="syncText">Synced</span>
        <button class="sync-manual-btn" id="syncManualBtn" title="Force sync">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      
      <div class="sync-details" id="syncDetails">
        <div class="sync-detail-item">
          <span class="detail-label">Status:</span>
          <span class="detail-value" id="connectionStatus">Online</span>
        </div>
        <div class="sync-detail-item">
          <span class="detail-label">Pending:</span>
          <span class="detail-value" id="pendingItems">0 items</span>
        </div>
        <div class="sync-detail-item">
          <span class="detail-label">Last Sync:</span>
          <span class="detail-value" id="lastSync">Never</span>
        </div>
        <div class="sync-detail-item">
          <span class="detail-label">Database:</span>
          <span class="detail-value" id="dbType">Local</span>
        </div>
      </div>
    `;

    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
      .sync-status-container {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 1400;
        font-family: var(--font-family);
      }
      
      .sync-status {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--surface-primary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        padding: 8px 12px;
        box-shadow: var(--shadow-md);
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 120px;
      }
      
      .sync-status:hover {
        box-shadow: var(--shadow-lg);
        transform: translateY(-1px);
      }
      
      .sync-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        transition: color 0.2s ease;
      }
      
      .sync-status.syncing .sync-icon {
        color: var(--primary-blue);
        animation: spin 1s linear infinite;
      }
      
      .sync-status.error .sync-icon {
        color: var(--red-500);
      }
      
      .sync-status.success .sync-icon {
        color: var(--green-500);
      }
      
      .sync-status.offline .sync-icon {
        color: var(--yellow-500);
      }
      
      .sync-text {
        font-size: 14px;
        color: var(--text-primary);
        font-weight: 500;
        flex: 1;
      }
      
      .sync-manual-btn {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: var(--radius-sm);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .sync-manual-btn:hover {
        background: var(--surface-secondary);
        color: var(--text-primary);
      }
      
      .sync-details {
        background: var(--surface-primary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        margin-top: 8px;
        padding: 16px;
        box-shadow: var(--shadow-md);
        display: none;
        min-width: 200px;
      }
      
      .sync-details.visible {
        display: block;
      }
      
      .sync-detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .sync-detail-item:last-child {
        margin-bottom: 0;
      }
      
      .detail-label {
        font-size: 12px;
        color: var(--text-secondary);
        font-weight: 500;
      }
      
      .detail-value {
        font-size: 12px;
        color: var(--text-primary);
        font-weight: 600;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @media (max-width: 768px) {
        .sync-status-container {
          bottom: 80px; /* Above settings trigger */
          left: 16px;
        }
        
        .sync-status {
          padding: 6px 10px;
          min-width: 100px;
        }
        
        .sync-text {
          font-size: 12px;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(statusContainer);

    this.statusElement = statusContainer;
  }

  setupEventListeners() {
    const syncStatus = document.getElementById('syncStatus');
    const syncDetails = document.getElementById('syncDetails');
    const syncManualBtn = document.getElementById('syncManualBtn');

    if (syncStatus) {
      syncStatus.addEventListener('click', (e) => {
        if (e.target !== syncManualBtn && !syncManualBtn.contains(e.target)) {
          this.toggleDetails();
        }
      });
    }

    if (syncManualBtn) {
      syncManualBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.manualSync();
      });
    }

    // Close details when clicking outside
    document.addEventListener('click', (e) => {
      if (this.statusElement && !this.statusElement.contains(e.target)) {
        this.hideDetails();
      }
    });

    // Listen for online/offline events
    window.addEventListener('online', () => this.updateStatus());
    window.addEventListener('offline', () => this.updateStatus());
  }

  toggleDetails() {
    const syncDetails = document.getElementById('syncDetails');
    if (syncDetails) {
      syncDetails.classList.toggle('visible');
      this.isVisible = syncDetails.classList.contains('visible');
    }
  }

  hideDetails() {
    const syncDetails = document.getElementById('syncDetails');
    if (syncDetails) {
      syncDetails.classList.remove('visible');
      this.isVisible = false;
    }
  }

  async manualSync() {
    const syncStatus = document.getElementById('syncStatus');
    const syncText = document.getElementById('syncText');

    if (syncStatus && syncText) {
      syncStatus.className = 'sync-status syncing';
      syncText.textContent = 'Syncing...';

      try {
        if (window.dbIntegration && window.dbIntegration.forceSyncToCloud) {
          await window.dbIntegration.forceSyncToCloud();
          syncText.textContent = 'Synced';
          syncStatus.className = 'sync-status success';

          setTimeout(() => {
            this.updateStatus();
          }, 2000);
        } else {
          throw new Error('Sync not available');
        }
      } catch (error) {
        console.error('Manual sync failed:', error);
        syncText.textContent = 'Sync Failed';
        syncStatus.className = 'sync-status error';

        setTimeout(() => {
          this.updateStatus();
        }, 3000);
      }
    }
  }

  updateStatus() {
    const status = this.getSyncStatus();

    const syncStatus = document.getElementById('syncStatus');
    const syncText = document.getElementById('syncText');
    const connectionStatus = document.getElementById('connectionStatus');
    const pendingItems = document.getElementById('pendingItems');
    const lastSync = document.getElementById('lastSync');
    const dbType = document.getElementById('dbType');

    if (!syncStatus || !syncText) return;

    // Update main status
    syncStatus.className = `sync-status ${status.className}`;
    syncText.textContent = status.text;

    // Update details
    if (connectionStatus) {
      connectionStatus.textContent = status.isOnline ? 'Online' : 'Offline';
      connectionStatus.style.color = status.isOnline ? 'var(--green-500)' : 'var(--red-500)';
    }

    if (pendingItems) {
      pendingItems.textContent = `${status.pendingSyncItems} items`;
      pendingItems.style.color = status.pendingSyncItems > 0 ? 'var(--yellow-500)' : 'var(--text-primary)';
    }

    if (lastSync) {
      lastSync.textContent = status.lastSyncTime ? this.formatTimestamp(status.lastSyncTime) : 'Never';
    }

    if (dbType) {
      dbType.textContent = status.dbType || 'Local';
    }

    this.lastStatus = status;
  }

  getSyncStatus() {
    let status = {
      isOnline: navigator.onLine,
      pendingSyncItems: 0,
      lastSyncTime: null,
      dbType: 'localStorage'
    };

    // Get status from database integration
    if (window.dbIntegration && window.dbIntegration.getSyncStatus) {
      status = { ...status, ...window.dbIntegration.getSyncStatus() };
    }

    // Determine status class and text
    let className = 'offline';
    let text = 'Offline';

    if (status.isOnline) {
      if (status.pendingSyncItems > 0) {
        className = 'pending';
        text = `${status.pendingSyncItems} pending`;
      } else {
        className = 'success';
        text = 'Synced';
      }
    }

    return { ...status, className, text };
  }

  formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  }

  startStatusCheck() {
    // Update status immediately
    this.updateStatus();

    // Update status every 30 seconds
    setInterval(() => {
      this.updateStatus();
    }, 30000);
  }

  show() {
    if (this.statusElement) {
      this.statusElement.style.display = 'block';
    }
  }

  hide() {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
    }
  }
}

// Sync component initialization disabled - now integrated into settings
// document.addEventListener('DOMContentLoaded', function() {
//   // Only show sync status if database integration is available
//   if (window.enhancedDB || window.dbIntegration) {
//     const syncStatus = new SyncStatusComponent();
//
//     // Export for external access
//     if (typeof window !== "undefined") {
//       window.syncStatus = syncStatus;
//     }
//   }
// });

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = SyncStatusComponent;
}
