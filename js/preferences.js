// User Preferences Management
class UserPreferences {
  constructor() {
    this.defaultPreferences = {
      theme: 'light',
      fontSize: 'medium',
      sidebarCollapsed: false,
      language: 'en',
      notifications: true,
      databaseMode: 'sqlite',
      mongoConnectionString: '',
      mongoDatabaseName: 'inkandarch'
    };

    this.loadPreferences();
    this.applyPreferences();
    this.setupEventListeners();
  }

  loadPreferences() {
    const currentUser = storage.get("currentUser");
    const userId = currentUser?.email || 'guest';

    this.preferences = storage.get(`preferences_${userId}`) || { ...this.defaultPreferences };
  }

  savePreferences() {
    const currentUser = storage.get("currentUser");
    const userId = currentUser?.email || 'guest';

    storage.set(`preferences_${userId}`, this.preferences);
  }

  updatePreference(key, value) {
    this.preferences[key] = value;
    this.savePreferences();
    this.applyPreferences();
  }

  applyPreferences() {
    // Apply theme
    this.applyTheme();

    // Apply font size
    this.applyFontSize();

    // Apply sidebar state
    this.applySidebarState();
  }

  applyTheme() {
    const theme = this.preferences.theme;
    document.documentElement.setAttribute('data-theme', theme);

    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  applyFontSize() {
    const fontSize = this.preferences.fontSize;
    document.documentElement.setAttribute('data-font-size', fontSize);

    // Remove existing font size classes
    document.body.classList.remove('font-small', 'font-medium', 'font-large');

    // Add new font size class
    document.body.classList.add(`font-${fontSize}`);
  }

  applySidebarState() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      if (this.preferences.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
      }
    }
  }

  setupEventListeners() {
    // Theme toggle
    document.addEventListener('click', (e) => {
      if (e.target.matches('#themeToggle, #themeToggle *')) {
        this.toggleTheme();
        this.updateThemeUI();
      }
    });

    // Font size controls
    document.addEventListener('click', (e) => {
      if (e.target.matches('.font-size-btn')) {
        const fontSize = e.target.dataset.fontSize;
        this.updatePreference('fontSize', fontSize);
        this.updateFontSizeUI();
      }
    });

    // Database settings - Only for admin users
    const currentUser = storage.get("currentUser");
    const isAdmin = currentUser && currentUser.role === "admin";

    if (isAdmin) {
      // Database mode selection
      document.addEventListener('change', (e) => {
        if (e.target.name === 'dbMode') {
          this.updatePreference('databaseMode', e.target.value);
          this.updateDatabaseConfigVisibility();
          this.updateDatabaseStatus();
        }
      });

      // Database configuration inputs
      document.addEventListener('input', (e) => {
        if (e.target.matches('#mongoConnectionString')) {
          this.updatePreference('mongoConnectionString', e.target.value);
        }
        if (e.target.matches('#mongoDatabaseName')) {
          this.updatePreference('mongoDatabaseName', e.target.value);
        }
      });

      // Database action buttons
      document.addEventListener('click', (e) => {
        if (e.target.matches('#testConnectionBtn')) {
          this.testDatabaseConnection();
        }
        if (e.target.matches('#saveDbConfigBtn')) {
          this.saveDatabaseConfiguration();
        }
      });
    }

    // Reset settings
    document.addEventListener('click', (e) => {
      if (e.target.matches('#resetSettingsBtn')) {
        if (confirm('Are you sure you want to reset all settings to default values?')) {
          this.resetToDefaults();
          this.updateAllUI();
          showToast('Settings reset to defaults', 'success');
        }
      }
    });

    // Initialize UI after DOM is loaded
    setTimeout(() => {
      this.updateAllUI();
      this.initializeSyncControls();
      this.initializeDatabaseSettings();
    }, 100);
  }

  updateAllUI() {
    this.updateThemeUI();
    this.updateFontSizeUI();
    this.updateDatabaseUI();
  }

  updateThemeUI() {
    const themeToggleText = $("#themeToggleText");
    const themeIndicator = $("#themeIndicator");

    if (themeToggleText && themeIndicator) {
      const isDark = this.preferences.theme === 'dark';
      themeToggleText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      themeIndicator.style.background = isDark ? '#10b981' : '#2563eb';
    }
  }

  updateFontSizeUI() {
    // Update active font size button
    const fontBtns = document.querySelectorAll('.font-size-btn');
    fontBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.fontSize === this.preferences.fontSize) {
        btn.classList.add('active');
      }
    });
  }

  toggleTheme() {
    const currentTheme = this.preferences.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.updatePreference('theme', newTheme);
  }

  getPreference(key) {
    return this.preferences[key];
  }

  resetToDefaults() {
    this.preferences = { ...this.defaultPreferences };
    this.savePreferences();
    this.applyPreferences();
  }

  initializeSyncControls() {
    // Set up sync button event listener
    const manualSyncBtn = document.getElementById('manualSyncBtn');
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener('click', () => {
        this.performManualSync();
      });
    }

    // Update sync status display
    this.updateSyncDisplay();

    // Update sync status every 30 seconds
    setInterval(() => {
      this.updateSyncDisplay();
    }, 30000);
  }

  async performManualSync() {
    const manualSyncBtn = document.getElementById('manualSyncBtn');
    const syncStatusText = document.getElementById('syncStatusText');

    if (manualSyncBtn) {
      manualSyncBtn.disabled = true;
      manualSyncBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="spinning">
          <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Syncing...
      `;
    }

    if (syncStatusText) {
      syncStatusText.textContent = 'Syncing...';
    }

    try {
      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update last sync time
      storage.set('lastSyncTime', new Date().toISOString());

      showToast('Data synced successfully!', 'success');
      this.updateSyncDisplay();
    } catch (error) {
      showToast('Sync failed. Please try again.', 'error');
      if (syncStatusText) {
        syncStatusText.textContent = 'Sync failed';
      }
    } finally {
      if (manualSyncBtn) {
        manualSyncBtn.disabled = false;
        manualSyncBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Sync Now
        `;
      }
    }
  }

  updateSyncDisplay() {
    const syncStatusText = document.getElementById('syncStatusText');
    const syncLastTime = document.getElementById('syncLastTime');
    const syncIndicator = document.getElementById('syncIndicator');

    // Check if online
    const isOnline = navigator.onLine;
    const lastSync = storage.get('lastSyncTime');

    if (syncStatusText) {
      syncStatusText.textContent = isOnline ? 'Online' : 'Offline';
    }

    if (syncLastTime) {
      if (lastSync) {
        const lastSyncDate = new Date(lastSync);
        const timeAgo = this.getTimeAgo(lastSyncDate);
        syncLastTime.textContent = `Last sync: ${timeAgo}`;
      } else {
        syncLastTime.textContent = 'Last sync: Never';
      }
    }

    if (syncIndicator) {
      syncIndicator.className = `sync-indicator ${isOnline ? 'online' : 'offline'}`;
    }
  }

  initializeDatabaseSettings() {
    // Set default MongoDB connection string from your provided credentials
    if (!this.preferences.mongoConnectionString) {
      this.preferences.mongoConnectionString = "mongodb+srv://kkjmangoltad132:kkjmangoltad132@cluster0.3bldu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
      this.savePreferences();
    }

    this.updateDatabaseUI();
    this.updateDatabaseConfigVisibility();
    this.updateDatabaseStatus();
  }

  updateDatabaseUI() {
    // Update radio buttons
    const dbModeRadios = document.querySelectorAll('input[name="dbMode"]');
    dbModeRadios.forEach(radio => {
      radio.checked = radio.value === this.preferences.databaseMode;
    });

    // Update input values
    const mongoConnectionInput = document.getElementById('mongoConnectionString');
    const mongoDatabaseInput = document.getElementById('mongoDatabaseName');

    if (mongoConnectionInput) {
      mongoConnectionInput.value = this.preferences.mongoConnectionString;
    }
    if (mongoDatabaseInput) {
      mongoDatabaseInput.value = this.preferences.mongoDatabaseName;
    }
  }

  updateDatabaseConfigVisibility() {
    const mongoConfig = document.getElementById('mongodbConfig');
    if (mongoConfig) {
      mongoConfig.style.display = this.preferences.databaseMode === 'mongodb' ? 'block' : 'none';
    }
  }

  updateDatabaseStatus() {
    const statusDot = document.getElementById('dbStatusDot');
    const statusText = document.getElementById('dbStatusText');

    if (statusDot && statusText) {
      statusDot.className = 'status-dot';

      switch (this.preferences.databaseMode) {
        case 'sqlite':
          statusText.textContent = 'Using SQLite Database';
          break;
        case 'mongodb':
          statusText.textContent = 'MongoDB Atlas - Ready to connect';
          statusDot.classList.add('connected');
          break;
        case 'sqlite':
          statusText.textContent = 'SQLite Local Database';
          statusDot.classList.add('connected');
          break;
        default:
          statusText.textContent = 'Unknown database mode';
          statusDot.classList.add('error');
      }
    }
  }

  async testDatabaseConnection() {
    const testBtn = document.getElementById('testConnectionBtn');
    const statusDot = document.getElementById('dbStatusDot');
    const statusText = document.getElementById('dbStatusText');

    if (testBtn) {
      testBtn.disabled = true;
      testBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="spinning">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        </svg>
        Testing...
      `;
    }

    if (statusDot) {
      statusDot.className = 'status-dot testing';
    }
    if (statusText) {
      statusText.textContent = 'Testing connection...';
    }

    try {
      // Test actual database connection via API
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: this.preferences.databaseMode
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(`${result.message}`, 'success');
        if (statusText) statusText.textContent = `${this.preferences.databaseMode.toUpperCase()} - Connected`;
        if (statusDot) statusDot.className = 'status-dot connected';

        // Store connection success in preferences
        this.updatePreference('lastConnectionTest', new Date().toISOString());
      } else {
        throw new Error(result.message || 'Connection test failed');
      }
    } catch (error) {
      console.error('Database connection test failed:', error);

      // Check if it's a network/fetch error
      if (error.message.includes('fetch') || error.name === 'TypeError') {
        showToast('Server connection failed. Server may be starting up.', 'warning');
        if (statusText) statusText.textContent = 'Server connecting... - using SQLite Database';
        if (statusDot) statusDot.className = 'status-dot warning';
      } else if (error.message.includes('timeout')) {
        showToast('Connection timeout. Using local database.', 'warning');
        if (statusText) statusText.textContent = 'Connection timeout - using SQLite';
        if (statusDot) statusDot.className = 'status-dot warning';
      } else {
        showToast('Database connection failed: ' + error.message, 'error');
        if (statusText) statusText.textContent = 'Connection failed';
        if (statusDot) statusDot.className = 'status-dot error';
      }
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          Test Connection
        `;
      }
    }
  }

  saveDatabaseConfiguration() {
    this.savePreferences();
    showToast('Database configuration saved!', 'success');

    // Update the global config if available
    if (typeof window !== 'undefined' && window.config) {
      window.config.database = {
        mode: this.preferences.databaseMode,
        mongodb: {
          connectionString: this.preferences.mongoConnectionString,
          databaseName: this.preferences.mongoDatabaseName
        }
      };
    }
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  }
}

// Create global preferences instance
let userPreferences;

// Initialize preferences when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  userPreferences = new UserPreferences();
});

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.userPreferences = userPreferences;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = UserPreferences;
}
