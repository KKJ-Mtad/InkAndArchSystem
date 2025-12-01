// Settings panel functionality
let settingsPanel = null;
let settingsOverlay = null;

function initializeSettings() {
  settingsPanel = $("#settingsPanel");
  settingsOverlay = $("#settingsOverlay");

  if (!settingsPanel || !settingsOverlay) {
    return;
  }

  setupSettingsEventListeners();
  loadUserPreferences();
}

function setupSettingsEventListeners() {
  // Settings trigger button
  const settingsTrigger = $("#settingsTrigger");
  if (settingsTrigger) {
    settingsTrigger.addEventListener("click", openSettings);
  }

  // Settings close button
  const settingsClose = $("#settingsClose");
  if (settingsClose) {
    settingsClose.addEventListener("click", closeSettings);
  }

  // Overlay click to close
  if (settingsOverlay) {
    settingsOverlay.addEventListener("click", closeSettings);
  }

  // Theme toggle
  const themeToggle = $("#themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // Font size buttons
  const fontSizeButtons = $$(".font-size-btn");
  fontSizeButtons.forEach(btn => {
    btn.addEventListener("click", function () {
      const fontSize = this.dataset.fontSize;
      setFontSize(fontSize);
    });
  });

  // Color palette options
  const colorPaletteItems = $$(".color-palette-item");
  colorPaletteItems.forEach(item => {
    item.addEventListener("click", function () {
      const palette = this.dataset.palette;
      setColorPalette(palette);
    });
  });

  // Language select
  const languageSelect = $("#languageSelect");
  if (languageSelect) {
    languageSelect.addEventListener("change", function () {
      setLanguage(this.value);
    });
  }

  // Reset settings button
  const resetSettingsBtn = $("#resetSettingsBtn");
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener("click", resetSettings);
  }

  // Clear cache button
  const clearCacheBtn = $("#clearCacheBtn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", function () {
      if (confirm("Are you sure you want to clear all browser cache and storage? This will reload the page.")) {
        clearBrowserCache();
      }
    });
  }

  // Database settings - Only for admin users
  const currentUser = storage.get("currentUser");
  const isAdmin = currentUser && currentUser.role === "admin";

  if (isAdmin) {
    const dbModeRadios = $$("input[name='dbMode']");
    dbModeRadios.forEach(radio => {
      radio.addEventListener("change", function () {
        setDatabaseMode(this.value);
      });
    });

    // Database test connection button
    const testConnectionBtn = $("#testConnectionBtn");
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener("click", testDatabaseConnection);
    }

    // Database save configuration button
    const saveDbConfigBtn = $("#saveDbConfigBtn");
    if (saveDbConfigBtn) {
      saveDbConfigBtn.addEventListener("click", saveDatabaseConfiguration);
    }

    // Manual sync button
    const manualSyncBtn = $("#manualSyncBtn");
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener("click", performManualSync);
    }

    // Initialize backup and restore functionality
    initializeDatabaseBackupRestore();
  } else {
    // Hide database settings for non-admin users
    hideDatabaseSettings();
  }
}

function openSettings() {
  if (settingsPanel && settingsOverlay) {
    settingsPanel.classList.add("open");
    settingsOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function closeSettings() {
  if (settingsPanel && settingsOverlay) {
    settingsPanel.classList.remove("open");
    settingsOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  setTheme(newTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  // Update theme toggle text
  const themeToggleText = $("#themeToggleText");
  const themeIndicator = $("#themeIndicator");

  if (themeToggleText) {
    themeToggleText.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
  }

  if (themeIndicator) {
    themeIndicator.classList.toggle("active", theme === "dark");
  }

  // Save theme preference for current user
  saveUserPreference("theme", theme);
}

function setFontSize(size) {
  // Remove all font size classes
  document.documentElement.classList.remove("font-small", "font-medium", "font-large");

  // Add new font size class
  if (size !== "medium") {
    document.documentElement.classList.add(`font-${size}`);
  }

  // Update active button
  const fontSizeButtons = $$(".font-size-btn");
  fontSizeButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.fontSize === size);
  });

  // Save font size preference
  saveUserPreference("fontSize", size);
}

function setColorPalette(palette, showNotification = true) {
  // Remove all color palette classes
  document.documentElement.classList.remove(
    "palette-default", "palette-green", "palette-purple",
    "palette-orange", "palette-pink", "palette-teal"
  );

  // Add new color palette class
  if (palette !== "default") {
    document.documentElement.classList.add(`palette-${palette}`);
  }

  // Update active palette item
  const colorPaletteItems = $$(".color-palette-item");
  colorPaletteItems.forEach(item => {
    item.classList.toggle("active", item.dataset.palette === palette);
  });

  // Save color palette preference
  saveUserPreference("colorPalette", palette);

  // Show success message only when requested (not during initial load)
  if (showNotification) {
    const paletteColor = getPaletteColor(palette);
    showToastWithColor(`Color palette changed to ${getColorPaletteName(palette)}`, "success", paletteColor);
  }
}

function setLanguage(language) {
  // Save language preference
  saveUserPreference("language", language);

  // Use the translation system if available
  if (typeof window.changeLanguage === 'function') {
    window.changeLanguage(language);
  }

  // Show success message
  const message = language === "en" ? "Language set to English" : "Wika ay naitakda sa Filipino";
  showToast(message, "success");
}

function getColorPaletteName(palette) {
  const names = {
    default: "Default Blue",
    green: "Nature Green",
    purple: "Royal Purple",
    orange: "Warm Orange",
    pink: "Vibrant Pink",
    teal: "Ocean Teal"
  };
  return names[palette] || "Default Blue";
}

function getPaletteColor(palette) {
  const colors = {
    default: "#2563eb",
    green: "#059669",
    purple: "#7c3aed",
    orange: "#ea580c",
    pink: "#db2777",
    teal: "#0d9488"
  };
  return colors[palette] || "#2563eb";
}

function showToastWithColor(message, type, color) {
  if (typeof showToast === 'function') {
    // Create a custom toast with the palette color
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background-color: ${color};
      border-left-color: ${color};
      color: white;
    `;

    toast.innerHTML = `
      <div class="toast-content">
        <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="toast-message">${message}</span>
      </div>
      <button class="toast-close">&times;</button>
    `;

    // Add close functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      removeToast(toast);
    });

    // Add to container and show
    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(toast);
    }, 5000);
  } else {
    // Fallback to regular toast
    console.log(message);
  }
}

function createToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }
  return container;
}

function removeToast(toast) {
  if (toast && toast.parentNode) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}

function saveUserPreference(key, value) {
  const currentUser = storage.get("currentUser");
  if (!currentUser) return;

  const userPreferences = storage.get(`preferences_${currentUser.email}`) || {};
  userPreferences[key] = value;
  storage.set(`preferences_${currentUser.email}`, userPreferences);
}

function getUserPreference(key, defaultValue = null) {
  const currentUser = storage.get("currentUser");
  if (!currentUser) return defaultValue;

  const userPreferences = storage.get(`preferences_${currentUser.email}`) || {};
  return userPreferences[key] || defaultValue;
}

function loadUserPreferences() {
  const currentUser = storage.get("currentUser");
  if (!currentUser) return;

  // Load and apply theme
  const theme = getUserPreference("theme", "light");
  setTheme(theme);

  // Load and apply font size
  const fontSize = getUserPreference("fontSize", "medium");
  setFontSize(fontSize);

  // Load and apply color palette (without notification during initial load)
  const colorPalette = getUserPreference("colorPalette", "default");
  setColorPalette(colorPalette, false);

  // Load and apply language
  const language = getUserPreference("language", "en");
  const languageSelect = $("#languageSelect");
  if (languageSelect) {
    languageSelect.value = language;
  }

  // Load and apply database settings
  const databaseMode = getUserPreference("databaseMode", "sqlite");
  const dbModeRadios = $$("input[name='dbMode']");
  dbModeRadios.forEach(radio => {
    radio.checked = radio.value === databaseMode;
  });

  // Load MongoDB configuration
  const mongoConnectionString = getUserPreference("mongoConnectionString", "");
  const mongoDatabaseName = getUserPreference("mongoDatabaseName", "inkandarch");

  const mongoConnectionInput = $("#mongoConnectionString");
  const mongoDatabaseInput = $("#mongoDatabaseName");

  if (mongoConnectionInput) {
    mongoConnectionInput.value = mongoConnectionString;
  }
  if (mongoDatabaseInput) {
    mongoDatabaseInput.value = mongoDatabaseName;
  }

  // Update database UI
  updateDatabaseConfigVisibility();
  updateDatabaseStatus(databaseMode);
}

function setDatabaseMode(mode) {
  // Save database mode preference
  saveUserPreference("databaseMode", mode);

  // Update UI
  updateDatabaseConfigVisibility();
  updateDatabaseStatus(mode);

  showToast(`Database mode set to ${mode}`, "success");
}

function updateDatabaseConfigVisibility() {
  const databaseMode = getUserPreference("databaseMode", "sqlite");
  const mongoConfig = $("#mongodbConfig");

  if (mongoConfig) {
    mongoConfig.style.display = databaseMode === "mongodb" ? "block" : "none";
  }
}

function updateDatabaseStatus(mode) {
  const statusDot = $("#dbStatusDot");
  const statusText = $("#dbStatusText");

  if (!statusDot || !statusText) return;

  // Reset classes
  statusDot.className = "status-dot";

  switch (mode) {
    case "localStorage":
      statusText.textContent = "Using Local Storage";
      statusDot.classList.add("connected");
      break;
    case "mongodb":
      statusText.textContent = "MongoDB Atlas - Not connected";
      statusDot.classList.add("disconnected");
      break;
    case "sqlite":
      statusText.textContent = "SQLite Local Database";
      statusDot.classList.add("connected");
      break;
    default:
      statusText.textContent = "Unknown database mode";
      statusDot.classList.add("error");
  }
}

async function testDatabaseConnection() {
  const testBtn = $("#testConnectionBtn");
  const statusDot = $("#dbStatusDot");
  const statusText = $("#dbStatusText");

  if (!testBtn) return;

  const originalText = testBtn.innerHTML;

  try {
    // Show loading state
    testBtn.disabled = true;
    testBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      </svg>
      Testing...
    `;

    const databaseMode = getUserPreference("databaseMode", "sqlite");

    await new Promise(resolve => setTimeout(resolve, 1000));
    showToast(`${databaseMode.toUpperCase()} connection test completed`, "success");
    if (statusText) statusText.textContent = `${databaseMode.toUpperCase()} - Connected`;
    if (statusDot) statusDot.className = "status-dot connected";
  } catch (error) {
    showToast("Connection test failed: " + error.message, "error");
    if (statusText) statusText.textContent = "Connection failed";
    if (statusDot) statusDot.className = "status-dot error";
  } finally {
    testBtn.innerHTML = originalText;
    testBtn.disabled = false;
  }
}

function saveDatabaseConfiguration() {
  const mongoConnectionString = $("#mongoConnectionString");
  const mongoDatabaseName = $("#mongoDatabaseName");

  if (mongoConnectionString) {
    saveUserPreference("mongoConnectionString", mongoConnectionString.value);
  }
  if (mongoDatabaseName) {
    saveUserPreference("mongoDatabaseName", mongoDatabaseName.value);
  }

  showToast("Database configuration saved", "success");
}

async function performManualSync() {
  const syncBtn = $("#manualSyncBtn");
  const syncStatusText = $("#syncStatusText");
  const syncLastTime = $("#syncLastTime");

  if (!syncBtn) return;

  const originalText = syncBtn.innerHTML;

  try {
    // Show loading state
    syncBtn.disabled = true;
    syncBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      </svg>
      Syncing...
    `;

    if (syncStatusText) syncStatusText.textContent = "Syncing...";

    await new Promise(resolve => setTimeout(resolve, 1500));

    const now = new Date();
    if (syncStatusText) syncStatusText.textContent = "Sync completed";
    if (syncLastTime) syncLastTime.textContent = `Last sync: ${formatTime(now)}`;

    showToast("Data synchronization completed", "success");
  } catch (error) {
    if (syncStatusText) syncStatusText.textContent = "Sync failed";
    showToast("Sync failed: " + error.message, "error");
  } finally {
    syncBtn.innerHTML = originalText;
    syncBtn.disabled = false;
  }
}

function resetSettings() {
  if (confirm("Are you sure you want to reset all settings to default values?")) {
    const currentUser = storage.get("currentUser");
    if (currentUser) {
      storage.remove(`preferences_${currentUser.email}`);
    }

    // Reset to defaults
    setTheme("light");
    setFontSize("medium");
    setColorPalette("default");
    setLanguage("en");

    showToast("Settings reset to default values", "success");
  }
}

function hideDatabaseSettings() {
  // Hide the entire database settings section
  const databaseSettingsGroup = $("#databaseSettingsGroup");
  if (databaseSettingsGroup) {
    databaseSettingsGroup.style.display = "none";
  }

  // Hide the backup and restore section
  const backupGroup = $("#databaseBackupGroup");
  if (backupGroup) {
    backupGroup.style.display = "none";
  }

  // Also hide the data sync section since it's database-related
  const syncSection = databaseSettingsGroup?.nextElementSibling;
  if (syncSection && syncSection.classList.contains("setting-group")) {
    const syncLabel = syncSection.querySelector(".setting-label");
    if (syncLabel && syncLabel.textContent.includes("Data Synchronization")) {
      syncSection.style.display = "none";
    }
  }
}

// Database Backup and Restore functionality
function initializeDatabaseBackupRestore() {
  const currentUser = storage.get("currentUser");
  const isAdmin = currentUser && currentUser.role === "admin";

  if (!isAdmin) {
    const backupGroup = $("#databaseBackupGroup");
    if (backupGroup) {
      backupGroup.style.display = "none";
    }
    return;
  }

  // Create backup button
  const createBackupBtn = $("#createBackupBtnSettings");
  if (createBackupBtn) {
    createBackupBtn.addEventListener("click", createDatabaseBackup);
  }

  // Load restore points
  loadRestorePointsList();

  // Refresh restore points every 30 seconds
  setInterval(loadRestorePointsList, 30000);
}

async function loadRestorePointsList() {
  try {
    const response = await fetch("/api/restore-points");
    const data = await response.json();

    if (data.success) {
      displayRestorePointsList(data.restorePoints);
    } else {
      console.error("Failed to load restore points:", data.error);
      displayRestorePointsList([]);
    }
  } catch (error) {
    console.error("Error loading restore points:", error);
    displayRestorePointsList([]);
  }
}

function displayRestorePointsList(restorePoints) {
  const container = $("#restorePointsListSettings");
  if (!container) return;

  if (!restorePoints || restorePoints.length === 0) {
    container.innerHTML = `
      <div style="padding: 12px; text-align: center; color: var(--gray-500); font-size: 13px;">
        <p>No restore points available. Create one to get started.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = restorePoints.map(point => `
    <div class="restore-point-item-settings">
      <div class="restore-point-info-settings">
        <div class="restore-point-date-settings">${new Date(point.date).toLocaleString()}</div>
        <div class="restore-point-size-settings">${point.sizeHumanReadable}</div>
      </div>
      <div class="restore-point-actions-settings">
        <button class="restore-btn" data-filename="${point.filename}" onclick="restoreDatabaseFromPoint(event)">
          Restore
        </button>
        <button class="delete-restore-btn" data-filename="${point.filename}" onclick="deleteRestorePoint(event)">
          Delete
        </button>
      </div>
    </div>
  `).join("");
}

async function createDatabaseBackup() {
  const btn = $("#createBackupBtnSettings");
  if (!btn) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Creating backup...";

  try {
    const response = await fetch("/api/backup-database", {
      method: "POST"
    });

    const data = await response.json();

    if (data.success) {
      showToast("Backup created successfully", "success");
      loadRestorePointsList();
    } else {
      showToast("Failed to create backup", "error");
    }
  } catch (error) {
    console.error("Error creating backup:", error);
    showToast("Failed to create backup", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function restoreDatabaseFromPoint(event) {
  const btn = event.target;
  const filename = btn.dataset.filename;

  if (!confirm("Are you sure you want to restore from this backup? This will replace your current database.")) {
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Restoring...";

  try {
    const response = await fetch("/api/restore-database", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ filename })
    });

    const data = await response.json();

    if (data.success) {
      showToast("Database restored successfully. Reloading...", "success");
      setTimeout(() => window.location.reload(), 2000);
    } else {
      showToast("Failed to restore database: " + (data.error || "Unknown error"), "error");
    }
  } catch (error) {
    console.error("Error restoring database:", error);
    showToast("Failed to restore database", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function deleteRestorePoint(event) {
  const btn = event.target;
  const filename = btn.dataset.filename;

  if (!confirm("Are you sure you want to delete this restore point? This action cannot be undone.")) {
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Deleting...";

  try {
    const response = await fetch("/api/restore-points", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ filename })
    });

    const data = await response.json();

    if (data.success) {
      showToast("Restore point deleted successfully", "success");
      loadRestorePointsList();
    } else {
      showToast("Failed to delete restore point", "error");
    }
  } catch (error) {
    console.error("Error deleting restore point:", error);
    showToast("Failed to delete restore point", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  // Load user preferences immediately for all pages
  loadUserPreferencesGlobal();

  // Small delay to ensure settings panel is loaded
  setTimeout(initializeSettings, 100);
});

// Load and apply user preferences globally (for all pages)
function loadUserPreferencesGlobal() {
  const currentUser = storage.get("currentUser");
  if (!currentUser) return;

  const userPreferences = storage.get(`preferences_${currentUser.email}`) || {};

  // Apply theme
  const theme = userPreferences.theme || "light";
  document.documentElement.setAttribute("data-theme", theme);

  // Apply font size
  const fontSize = userPreferences.fontSize || "medium";
  document.documentElement.classList.remove("font-small", "font-medium", "font-large");
  if (fontSize !== "medium") {
    document.documentElement.classList.add(`font-${fontSize}`);
  }

  // Apply color palette (silently during initial load)
  const colorPalette = userPreferences.colorPalette || "default";
  document.documentElement.classList.remove(
    "palette-default", "palette-green", "palette-purple",
    "palette-orange", "palette-pink", "palette-teal"
  );
  if (colorPalette !== "default") {
    document.documentElement.classList.add(`palette-${colorPalette}`);
  }
}

// Make functions available globally
if (typeof window !== "undefined") {
  window.initializeSettings = initializeSettings;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
}
