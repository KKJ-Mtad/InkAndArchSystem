// Attendance Settings Component for Admin/Front Desk
class AttendanceSettings {
  constructor() {
    this.init();
  }

  init() {
    // Check user role - only admin and front_desk can access attendance settings
    const currentUser = storage.get("currentUser");
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "front_desk")) {
      return; // Don't initialize for employees
    }

    this.loadSettings();
    this.setupEventListeners();
  }

  loadSettings() {
    // Load default or saved settings
    const defaultSettings = {
      lateThreshold: 15, // minutes after start time
      absentThreshold: 60, // minutes after start time
      standardStartTime: "08:00", // 8:00 AM
      rememberSettings: true,
      autoApplyToAllDays: false
    };

    this.settings = storage.get("attendanceSettings") || defaultSettings;
  }

  setupEventListeners() {
    // Add attendance settings button to timetracking page if user is admin/frontdesk
    if (window.location.pathname.includes("timetracking")) {
      this.addSettingsButton();
    }
  }

  addSettingsButton() {
    const sidebar = document.querySelector(".sidebar-menu");
    if (!sidebar) return;

    // Check if button already exists
    if (document.getElementById("attendanceSettingsBtn")) return;

    const settingsItem = document.createElement("div");
    settingsItem.innerHTML = `
      <button class="sidebar-item" id="attendanceSettingsBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>
        </svg>
        Attendance Rules
      </button>
    `;

    // Add before the last item in sidebar
    const lastItem = sidebar.lastElementChild;
    sidebar.insertBefore(settingsItem, lastItem);

    // Add click listener
    document.getElementById("attendanceSettingsBtn").addEventListener("click", () => {
      this.showSettingsModal();
    });
  }

  showSettingsModal() {
    const modal = document.createElement("div");
    modal.id = "attendanceSettingsModal";
    modal.className = "modal";
    modal.style.display = "flex";

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2>Attendance Rules Settings</h2>
          <button class="modal-close" id="closeAttendanceSettings">&times;</button>
        </div>
        
        <div class="modal-body">
          <form id="attendanceSettingsForm">
            <div class="form-group">
              <label for="standardStartTime">Standard Start Time:</label>
              <input type="time" id="standardStartTime" value="${this.settings.standardStartTime}" required>
              <small class="form-help">The expected start time for employees</small>
            </div>

            <div class="form-group">
              <label for="lateThreshold">Late Threshold (minutes):</label>
              <input type="number" id="lateThreshold" value="${this.settings.lateThreshold}" min="1" max="120" required>
              <small class="form-help">Minutes after start time to mark as late</small>
            </div>

            <div class="form-group">
              <label for="absentThreshold">Absent Threshold (minutes):</label>
              <input type="number" id="absentThreshold" value="${this.settings.absentThreshold}" min="1" max="240" required>
              <small class="form-help">Minutes after start time to mark as absent</small>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="rememberSettings" ${this.settings.rememberSettings ? 'checked' : ''}>
                <span class="checkbox-text">Remember these settings</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="autoApplyToAllDays" ${this.settings.autoApplyToAllDays ? 'checked' : ''}>
                <span class="checkbox-text">Apply to all future days automatically</span>
              </label>
            </div>

            <div class="attendance-preview">
              <h4>Preview:</h4>
              <div class="preview-content">
                <div class="preview-item success">
                  <span class="status-dot on-time"></span>
                  On-time: Before <span id="onTimeLimit">${this.settings.standardStartTime}</span>
                </div>
                <div class="preview-item warning">
                  <span class="status-dot late"></span>
                  Late: <span id="lateStart">${this.settings.standardStartTime}</span> + <span id="lateMinutes">${this.settings.lateThreshold}</span> minutes
                </div>
                <div class="preview-item error">
                  <span class="status-dot absent"></span>
                  Absent: <span id="absentStart">${this.settings.standardStartTime}</span> + <span id="absentMinutes">${this.settings.absentThreshold}</span> minutes
                </div>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancelAttendanceSettings">Cancel</button>
          <button type="submit" form="attendanceSettingsForm" class="btn btn-primary">Save Settings</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Setup event listeners
    this.setupModalEventListeners(modal);
    this.setupPreviewUpdates();
  }

  setupModalEventListeners(modal) {
    // Close modal
    const closeBtn = modal.querySelector("#closeAttendanceSettings");
    const cancelBtn = modal.querySelector("#cancelAttendanceSettings");

    [closeBtn, cancelBtn].forEach(btn => {
      btn.addEventListener("click", () => this.hideSettingsModal(modal));
    });

    // Form submission
    const form = modal.querySelector("#attendanceSettingsForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveSettings(modal);
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideSettingsModal(modal);
      }
    });
  }

  setupPreviewUpdates() {
    const inputs = ["standardStartTime", "lateThreshold", "absentThreshold"];

    inputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      input.addEventListener("input", () => this.updatePreview());
    });
  }

  updatePreview() {
    const startTime = document.getElementById("standardStartTime").value;
    const lateThreshold = document.getElementById("lateThreshold").value;
    const absentThreshold = document.getElementById("absentThreshold").value;

    document.getElementById("onTimeLimit").textContent = startTime;
    document.getElementById("lateStart").textContent = startTime;
    document.getElementById("lateMinutes").textContent = lateThreshold;
    document.getElementById("absentStart").textContent = startTime;
    document.getElementById("absentMinutes").textContent = absentThreshold;
  }

  saveSettings(modal) {
    const formData = new FormData(document.getElementById("attendanceSettingsForm"));

    this.settings = {
      standardStartTime: formData.get("standardStartTime"),
      lateThreshold: parseInt(formData.get("lateThreshold")),
      absentThreshold: parseInt(formData.get("absentThreshold")),
      rememberSettings: formData.has("rememberSettings"),
      autoApplyToAllDays: formData.has("autoApplyToAllDays")
    };

    // Save settings if remember is checked
    if (this.settings.rememberSettings) {
      storage.set("attendanceSettings", this.settings);
    }

    showToast("Attendance settings saved successfully!", "success");
    this.hideSettingsModal(modal);
  }

  hideSettingsModal(modal) {
    modal.remove();
    document.body.style.overflow = "auto";
  }

  // Method to manually mark attendance status (for admin/frontdesk)
  markAttendanceStatus(employeeId, date, status, reason = "") {
    const attendanceKey = `attendance_${employeeId}_${date}`;
    const attendanceRecord = {
      employeeId: employeeId,
      date: date,
      status: status,
      reason: reason,
      markedBy: storage.get("currentUser")?.name || "System",
      markedAt: new Date().toISOString()
    };

    storage.set(attendanceKey, attendanceRecord);
    showToast(`Employee marked as ${status} for ${date}`, "success");
  }

  // Get attendance status for an employee on a specific date
  getAttendanceStatus(employeeId, date) {
    const attendanceKey = `attendance_${employeeId}_${date}`;
    return storage.get(attendanceKey);
  }
}

// Initialize attendance settings
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    new AttendanceSettings();
  });

  window.AttendanceSettings = AttendanceSettings;
}
