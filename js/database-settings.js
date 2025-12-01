// Database Settings Component
class DatabaseSettings {
  constructor() {
    this.init();
  }

  init() {
    // Check user role - only admin can access database settings
    const currentUser = storage.get("currentUser");
    if (!currentUser || currentUser.role !== "admin") {
      return; // Don't initialize database settings for non-admin users
    }

    this.createSettingsPanel();
    this.setupEventListeners();
    this.updateStatus();
  }

  createSettingsPanel() {
    // Create floating settings button
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "dbSettingsBtn";
    settingsBtn.className = "db-settings-btn";
    settingsBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;

    // Create settings panel
    const settingsPanel = document.createElement("div");
    settingsPanel.id = "dbSettingsPanel";
    settingsPanel.className = "db-settings-panel";
    settingsPanel.style.display = "none";
    settingsPanel.innerHTML = `
      <div class="db-settings-header">
        <h3>Database Settings</h3>
        <button id="closeDbSettings">&times;</button>
      </div>
      <div class="db-settings-tabs">
        <button class="db-settings-tab active" data-tab="status">Status</button>
        <button class="db-settings-tab" data-tab="backup">Backup & Recovery</button>
      </div>

      <div class="db-settings-content">
        <div id="status-tab" class="db-settings-tab-content active">
          <div class="db-status">
            <h4>Current Status</h4>
            <div class="status-info">
              <span class="status-label">Database Type:</span>
              <span class="status-value" id="dbType">Loading...</span>
            </div>
            <div class="status-info">
              <span class="status-label">Connection:</span>
              <span class="status-value" id="dbConnection">Loading...</span>
            </div>
            <div class="status-info">
              <span class="status-label">Online:</span>
              <span class="status-value" id="isOnline">Loading...</span>
            </div>
          </div>

          <div class="db-actions">
            <h4>Database Options</h4>
            <button id="exportData" class="db-action-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7,10 12,15 17,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Export Data
            </button>
            <button id="importData" class="db-action-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="17,8 12,3 7,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Import Data
            </button>
          </div>

          <div class="db-config">
            <h4>MongoDB Configuration</h4>
            <div class="config-field">
              <label for="mongoUri">Connection String:</label>
              <input type="text" id="mongoUri" placeholder="mongodb+srv://..." />
            </div>
            <div class="config-field">
              <label for="mongoApiKey">API Key:</label>
              <input type="password" id="mongoApiKey" placeholder="Your MongoDB API Key" />
            </div>
            <button id="saveConfig" class="db-action-btn primary">Save Configuration</button>
          </div>
        </div>

        <div id="backup-tab" class="db-settings-tab-content">
          <div class="backup-storage-section">
            <h4>Backup Storage Usage</h4>
            <div class="storage-info">
              <div class="storage-meter-container">
                <div class="storage-meter">
                  <div class="storage-meter-fill" id="storageMeterFill"></div>
                </div>
                <div class="storage-stats">
                  <span id="storagePercentage">0%</span>
                  <span id="storageInfo">0 B / 5 GB</span>
                </div>
              </div>
              <div class="storage-warning" id="storageWarning" style="display: none;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="16" r="1" fill="currentColor"/>
                </svg>
                <span>Storage limit reached. Please delete old restore points.</span>
              </div>
            </div>
          </div>

          <div class="backup-actions-section">
            <h4>Backup Actions</h4>
            <button id="createBackupBtn" class="db-action-btn primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="12,3 12,13 9,10 15,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Create Backup Now
            </button>
          </div>

          <div class="restore-points-section">
            <h4>Restore Points (Last 7 Days)</h4>
            <div id="restorePointsList" class="restore-points-list">
              <p class="loading-text">Loading restore points...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Append to body
    document.body.appendChild(settingsBtn);
    document.body.appendChild(settingsPanel);

    // Hidden file input for import
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.id = "importFileInput";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
  }

  addStyles() {
    if ($("#db-settings-styles")) return;

    const styles = document.createElement("style");
    styles.id = "db-settings-styles";
    styles.textContent = `
      .db-settings-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--primary-blue);
        color: white;
        border: none;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      }

      .db-settings-btn:hover {
        transform: scale(1.1);
      }

      .db-settings-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        background: white;
        box-shadow: -2px 0 20px rgba(0,0,0,0.1);
        z-index: 1001;
        overflow-y: auto;
      }

      .db-settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--gray-200);
      }

      .db-settings-header h3 {
        margin: 0;
        color: var(--gray-900);
      }

      #closeDbSettings {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--gray-500);
      }

      .db-settings-tabs {
        display: flex;
        border-bottom: 1px solid var(--gray-200);
        padding: 0 20px;
      }

      .db-settings-tab {
        flex: 1;
        padding: 12px 16px;
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        color: var(--gray-600);
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .db-settings-tab:hover {
        color: var(--gray-900);
      }

      .db-settings-tab.active {
        border-bottom-color: var(--primary-blue);
        color: var(--primary-blue);
      }

      .db-settings-content {
        padding: 20px;
      }

      .db-settings-tab-content {
        display: none;
      }

      .db-settings-tab-content.active {
        display: block;
      }

      .db-status, .db-actions, .db-config {
        margin-bottom: 30px;
      }

      .db-status h4, .db-actions h4, .db-config h4, .backup-storage-section h4, .backup-actions-section h4, .restore-points-section h4 {
        margin: 0 0 15px 0;
        color: var(--gray-900);
        font-size: 16px;
      }

      .status-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        padding: 8px 0;
        border-bottom: 1px solid var(--gray-100);
      }

      .status-label {
        color: var(--gray-600);
        font-weight: 500;
      }

      .status-value {
        color: var(--gray-900);
        font-weight: 600;
      }

      .db-action-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 12px 16px;
        margin-bottom: 8px;
        border: 1px solid var(--gray-300);
        border-radius: 8px;
        background: white;
        color: var(--gray-700);
        cursor: pointer;
        transition: all 0.2s;
      }

      .db-action-btn:hover {
        background: var(--gray-50);
        border-color: var(--primary-blue);
      }

      .db-action-btn.primary {
        background: var(--primary-blue);
        color: white;
        border-color: var(--primary-blue);
      }

      .db-action-btn.primary:hover {
        background: var(--blue-600);
      }

      .config-field {
        margin-bottom: 15px;
      }

      .config-field label {
        display: block;
        margin-bottom: 5px;
        color: var(--gray-700);
        font-weight: 500;
      }

      .config-field input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--gray-300);
        border-radius: 6px;
        font-size: 14px;
      }

      .config-field input:focus {
        outline: none;
        border-color: var(--primary-blue);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }

      .backup-storage-section, .backup-actions-section, .restore-points-section {
        margin-bottom: 30px;
      }

      .storage-info {
        background: var(--gray-50);
        padding: 15px;
        border-radius: 8px;
      }

      .storage-meter-container {
        margin-bottom: 12px;
      }

      .storage-meter {
        width: 100%;
        height: 8px;
        background: var(--gray-200);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .storage-meter-fill {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #3b82f6);
        border-radius: 4px;
        transition: width 0.3s ease;
      }

      .storage-meter-fill.warning {
        background: linear-gradient(90deg, #f59e0b, #ef4444);
      }

      .storage-stats {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--gray-600);
      }

      .storage-stats span {
        font-weight: 500;
      }

      .storage-warning {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
        padding: 10px 12px;
        background: #fef3c7;
        border: 1px solid #fbbf24;
        border-radius: 6px;
        color: #92400e;
        font-size: 13px;
      }

      .storage-warning svg {
        color: #f59e0b;
        flex-shrink: 0;
      }

      .restore-points-list {
        border: 1px solid var(--gray-200);
        border-radius: 8px;
        overflow: hidden;
      }

      .restore-point-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 15px;
        border-bottom: 1px solid var(--gray-100);
        background: white;
        transition: background 0.2s;
      }

      .restore-point-item:last-child {
        border-bottom: none;
      }

      .restore-point-item:hover {
        background: var(--gray-50);
      }

      .restore-point-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .restore-point-date {
        font-weight: 500;
        color: var(--gray-900);
        font-size: 14px;
      }

      .restore-point-size {
        font-size: 12px;
        color: var(--gray-500);
      }

      .restore-point-actions {
        display: flex;
        gap: 8px;
      }

      .restore-point-btn {
        padding: 6px 12px;
        border: 1px solid var(--gray-300);
        border-radius: 6px;
        background: white;
        color: var(--gray-700);
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }

      .restore-point-btn:hover {
        border-color: var(--primary-blue);
        background: var(--gray-50);
      }

      .restore-point-btn.restore {
        border-color: var(--primary-blue);
        color: var(--primary-blue);
      }

      .restore-point-btn.restore:hover {
        background: var(--blue-50);
      }

      .restore-point-btn.delete {
        border-color: #ef4444;
        color: #ef4444;
      }

      .restore-point-btn.delete:hover {
        background: #fee2e2;
      }

      .loading-text {
        text-align: center;
        color: var(--gray-500);
        padding: 20px;
        font-size: 14px;
      }

      .empty-state {
        text-align: center;
        padding: 30px 20px;
        color: var(--gray-500);
      }

      .empty-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        opacity: 0.3;
      }

      .empty-state p {
        font-size: 14px;
        margin: 0;
      }

      @media (max-width: 768px) {
        .db-settings-panel {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  setupEventListeners() {
    // Toggle panel
    on("#dbSettingsBtn", "click", () => this.togglePanel());
    on("#closeDbSettings", "click", () => this.hidePanel());

    // Tab switching
    document.querySelectorAll(".db-settings-tab").forEach(tab => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });

    // Database actions
    on("#exportData", "click", () => this.exportData());
    on("#importData", "click", () => this.importData());
    on("#saveConfig", "click", () => this.saveConfig());

    // Backup actions
    on("#createBackupBtn", "click", () => this.createBackup());

    // File input
    on("#importFileInput", "change", (e) => this.handleFileImport(e));

    // Update status every 5 seconds
    setInterval(() => this.updateStatus(), 5000);

    // Update restore points and storage when showing backup tab
    setInterval(() => this.loadRestorePoints(), 30000); // Every 30 seconds

    // Click outside to close
    document.addEventListener("click", (e) => {
      const panel = $("#dbSettingsPanel");
      const btn = $("#dbSettingsBtn");
      if (
        panel?.style.display === "block" &&
        !panel.contains(e.target) &&
        !btn.contains(e.target)
      ) {
        this.hidePanel();
      }
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".db-settings-tab").forEach(tab => {
      tab.classList.remove("active");
      if (tab.dataset.tab === tabName) {
        tab.classList.add("active");
      }
    });

    // Update tab content
    document.querySelectorAll(".db-settings-tab-content").forEach(content => {
      content.classList.remove("active");
    });

    const contentTab = $(`#${tabName}-tab`);
    if (contentTab) {
      contentTab.classList.add("active");
    }

    // Load restore points when switching to backup tab
    if (tabName === "backup") {
      this.loadRestorePoints();
    }
  }

  togglePanel() {
    const panel = $("#dbSettingsPanel");
    if (panel.style.display === "none" || !panel.style.display) {
      this.showPanel();
    } else {
      this.hidePanel();
    }
  }

  showPanel() {
    const panel = $("#dbSettingsPanel");
    panel.style.display = "block";
    this.updateStatus();

    // Load restore points if backup tab is visible
    const backupTab = $("#backup-tab");
    if (backupTab && backupTab.classList.contains("active")) {
      this.loadRestorePoints();
    }
  }

  hidePanel() {
    const panel = $("#dbSettingsPanel");
    panel.style.display = "none";
  }

  async updateStatus() {
    if (typeof enhancedAPI === "undefined") return;

    try {
      const status = enhancedAPI.getStatus();

      $("#dbType").textContent = "SQLite/MongoDB";
      $("#dbConnection").textContent = "Real Database";
      $("#isOnline").textContent = "Yes";
    } catch (error) {
      console.error("Error updating database status:", error);
    }
  }

  // Mock database methods removed - using real database only

  async exportData() {
    try {
      const data = await enhancedAPI.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inkandarch-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Data exported successfully", "success");
    } catch (error) {
      showToast("Failed to export data", "error");
      console.error(error);
    }
  }

  importData() {
    $("#importFileInput").click();
  }

  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await enhancedAPI.importData(data);
      showToast("Data imported successfully", "success");
      // Reset file input
      event.target.value = "";
      // Refresh the page to load new data
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      showToast("Failed to import data", "error");
      console.error(error);
    }
  }

  saveConfig() {
    const mongoUri = $("#mongoUri").value;
    const mongoApiKey = $("#mongoApiKey").value;

    if (mongoUri) {
      localStorage.setItem("mongoUri", mongoUri);
    }
    if (mongoApiKey) {
      localStorage.setItem("mongoApiKey", mongoApiKey);
    }

    showToast("Configuration saved", "success");
  }

  async loadRestorePoints() {
    try {
      const response = await fetch("/api/restore-points");
      const data = await response.json();

      if (data.success) {
        this.displayRestorePoints(data.restorePoints);
        this.updateStorageDisplay(data.storageUsage);
      } else {
        showToast("Failed to load restore points", "error");
      }
    } catch (error) {
      console.error("Error loading restore points:", error);
      showToast("Failed to load restore points", "error");
    }
  }

  displayRestorePoints(restorePoints) {
    const container = $("#restorePointsList");

    if (!restorePoints || restorePoints.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" stroke="currentColor" stroke-width="2"/>
            <path d="M9 11l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>No restore points yet. Create one to get started.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = restorePoints.map(point => `
      <div class="restore-point-item">
        <div class="restore-point-info">
          <div class="restore-point-date">${new Date(point.date).toLocaleString()}</div>
          <div class="restore-point-size">${point.sizeHumanReadable}</div>
        </div>
        <div class="restore-point-actions">
          <button class="restore-point-btn restore" data-filename="${point.filename}" data-action="restore">
            Restore
          </button>
          <button class="restore-point-btn delete" data-filename="${point.filename}" data-action="delete">
            Delete
          </button>
        </div>
      </div>
    `).join("");

    // Add event listeners for restore and delete buttons
    this.setupRestorePointButtons();
  }

  setupRestorePointButtons() {
    document.querySelectorAll(".restore-point-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const filename = e.target.dataset.filename;
        const action = e.target.dataset.action;

        if (action === "restore") {
          await this.restoreFromPoint(filename);
        } else if (action === "delete") {
          await this.deleteRestorePoint(filename);
        }
      });
    });
  }

  updateStorageDisplay(storageUsage) {
    const meterFill = $("#storageMeterFill");
    const percentage = $("#storagePercentage");
    const info = $("#storageInfo");
    const warning = $("#storageWarning");

    if (meterFill) {
      meterFill.style.width = `${Math.min(storageUsage.percentage, 100)}%`;
      if (storageUsage.percentage > 80) {
        meterFill.classList.add("warning");
      } else {
        meterFill.classList.remove("warning");
      }
    }

    if (percentage) {
      percentage.textContent = `${storageUsage.percentage}%`;
    }

    if (info) {
      info.textContent = `${storageUsage.totalHumanReadable} / ${storageUsage.limitHumanReadable}`;
    }

    if (warning) {
      if (storageUsage.isLimitReached) {
        warning.style.display = "flex";
      } else {
        warning.style.display = "none";
      }
    }
  }

  async createBackup() {
    try {
      const btn = $("#createBackupBtn");
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Creating backup...";

      const response = await fetch("/api/backup-database", {
        method: "POST"
      });

      const data = await response.json();

      if (data.success) {
        showToast("Backup created successfully", "success");
        this.loadRestorePoints();
      } else {
        showToast("Failed to create backup", "error");
      }

      btn.disabled = false;
      btn.textContent = originalText;
    } catch (error) {
      console.error("Error creating backup:", error);
      showToast("Failed to create backup", "error");
      const btn = $("#createBackupBtn");
      btn.disabled = false;
      btn.textContent = "Create Backup Now";
    }
  }

  async restoreFromPoint(filename) {
    const confirmed = confirm(`Are you sure you want to restore from this restore point? This will overwrite all current data.`);
    if (!confirmed) return;

    try {
      const response = await fetch("/api/restore-database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ restorePointFilename: filename })
      });

      const data = await response.json();

      if (data.success) {
        showToast("Database restored successfully. Please refresh the page.", "success");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showToast("Failed to restore database", "error");
      }
    } catch (error) {
      console.error("Error restoring database:", error);
      showToast("Failed to restore database", "error");
    }
  }

  async deleteRestorePoint(filename) {
    const confirmed = confirm("Are you sure you want to delete this restore point? This cannot be undone.");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/restore-points/${filename}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (data.success) {
        showToast("Restore point deleted successfully", "success");
        this.loadRestorePoints();
      } else {
        showToast("Failed to delete restore point", "error");
      }
    } catch (error) {
      console.error("Error deleting restore point:", error);
      showToast("Failed to delete restore point", "error");
    }
  }
}

// Initialize database settings (only on dashboard)
if (
  typeof window !== "undefined" &&
  window.location.pathname.includes("dashboard")
) {
  document.addEventListener("DOMContentLoaded", () => {
    new DatabaseSettings();
  });
}

// Export for use in other modules
if (typeof window !== "undefined") {
  window.DatabaseSettings = DatabaseSettings;
}
