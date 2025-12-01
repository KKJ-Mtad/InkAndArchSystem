// Employee Time Tracking Modal functionality
class EmployeeTimeModal {
  constructor() {
    this.modal = null;
    this.currentUser = null;
    this.modalState = "timetracking"; // 'timetracking', 'absent', 'late'
    this.currentSession = null;
    this.init();
  }

  init() {
    this.currentUser = storage.get("currentUser");
    this.createModal();
    this.setupEventListeners();
  }

  createModal() {
    // Remove existing modal if any
    const existingModal = $("#employeeTimeModal");
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "employeeTimeModal";
    modal.className = "employee-modal";
    modal.style.display = "none";

    modal.innerHTML = this.getModalHTML();
    document.body.appendChild(modal);
    this.modal = modal;
  }

  getModalHTML() {
    const now = new Date();
    const timestamp =
      now.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }) +
      " ; " +
      now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

    const userDisplay = this.getUserDisplay();

    return `
      <div class="employee-modal-content">
        <button class="modal-close-btn" id="closeEmployeeModal">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="employee-modal-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#4B5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 6V12L16 14" stroke="#4B5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 class="employee-modal-title" id="modalTitle">Time In & Time Out</h2>
        </div>

        <div class="employee-modal-timestamp">
          <span class="timestamp-text">${timestamp}</span>
        </div>

        <div class="employee-modal-info">
          <span class="employee-info-text">${userDisplay}</span>
        </div>

        <div class="employee-modal-body" id="modalBody">
          ${this.getTimeTrackingContent()}
        </div>
      </div>
    `;
  }

  getUserDisplay() {
    if (this.currentUser) {
      const roleMap = {
        front_desk: "Front Desk",
        employee: "Employee",
        admin: "Admin",
      };
      const roleDisplay = roleMap[this.currentUser.role] || "User";
      return `${roleDisplay}: ${this.currentUser.name}`;
    }
    return "User: Unknown";
  }

  getTimeTrackingContent() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const standardStartTime = 8 * 60; // 8:00 AM
    const lateThreshold = standardStartTime + 15; // 8:15 AM
    let statusMessage = '<div class="attendance-success">�� Ready to clock in</div>';

    return `
      <div class="time-tracking-buttons">
        <button class="time-button" id="timeInBtn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 2H12.6667C13.0203 2 13.3594 2.14048 13.6095 2.39052C13.8595 2.64057 14 2.97971 14 3.33333V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H10" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6.66675 11.3334L10.0001 8.00008L6.66675 4.66675" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 8H2" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Time In
        </button>
        <button class="time-button" id="timeOutBtn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.5 14H3.83333C3.47971 14 3.14057 13.8595 2.89052 13.6095C2.64048 13.3594 2.5 13.0203 2.5 12.6667V3.33333C2.5 2.97971 2.64048 2.64057 2.89052 2.39052C3.14057 2.14048 3.47971 2 3.83333 2H6.5" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11.1667 11.3334L14.5001 8.00008L11.1667 4.66675" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14.5 8H6.5" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Time Out
        </button>
        ${this.currentUser?.role === 'employee' ? `
          <div class="qr-divider" style="display: flex; align-items: center; margin: 16px 0;">
            <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
            <span style="padding: 0 16px; color: #6b7280; font-size: 14px; font-weight: 500;">OR</span>
            <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
          </div>
          <button class="time-button" id="generateQRBtn" style="background: #8b5cf6; border-color: #8b5cf6; width: 100%;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="5" height="5" stroke="white" stroke-width="2" fill="none"/>
              <rect x="16" y="3" width="5" height="5" stroke="white" stroke-width="2" fill="none"/>
              <rect x="3" y="16" width="5" height="5" stroke="white" stroke-width="2" fill="none"/>
              <circle cx="12" cy="12" r="2" stroke="white" stroke-width="2"/>
            </svg>
            Generate QR Code for Admin/Front Desk
          </button>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280; line-height: 1.4; text-align: center;">Generate a QR code that admin or front desk can scan to clock you in/out</p>
        ` : ''}
      </div>
      <div class="attendance-status-display">
        ${statusMessage}
      </div>
      <div class="current-session-display" id="sessionDisplay">
        ${this.getSessionDisplay()}
      </div>
      ${this.currentUser?.role !== "employee" ? `
        <div style="margin-top: 24px;">
          <details>
            <summary style="cursor: pointer; color: #666; font-size: 14px; margin-bottom: 12px;">Manual Override Options</summary>
            <div style="display: flex; gap: 12px;">
              <button class="time-button" style="width: 100%; font-size: 14px; padding: 8px 16px;" id="markAbsentBtn">Mark Absent</button>
              <button class="time-button" style="width: 100%; font-size: 14px; padding: 8px 16px;" id="markLateBtn">Mark Late</button>
            </div>
          </details>
        </div>
      ` : ''}
      ${this.currentUser?.role === "front_desk" ? `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <div style="text-align: center;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
              Working from home or day off?
            </p>
            <button class="time-button" style="background: #10b981; border-color: #10b981; font-size: 14px;" id="skipTimeTrackingBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
              </svg>
              Skip Time Tracking
            </button>
          </div>
        </div>
      ` : ''}
    `;
  }

  getSessionDisplay() {
    const now = new Date();
    const timeString =
      now.toLocaleDateString("en-US") + ", " + now.toLocaleTimeString("en-US");

    return `
      <div class="session-row">
        <span class="session-label">Time In:</span>
        <span class="session-time">${timeString}</span>
      </div>
      <div class="session-row">
        <span class="session-label">Time Out:</span>
        <span class="session-time">${timeString}</span>
      </div>
    `;
  }

  getAbsentFormContent() {
    return `
      <form class="employee-form" id="absentForm">
        <div class="form-field">
          <label class="form-field-label">Type</label>
          <div class="form-field-select">
            <select class="form-select" id="absentType">
              <option value="absent">Absent</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Leave</option>
            </select>
            <svg class="select-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="form-field">
          <label class="form-field-label">Reason</label>
          <div class="form-field-select">
            <select class="form-select" id="absentReason">
              <option value="family-emergency">Family emergency</option>
              <option value="medical">Medical appointment</option>
              <option value="personal">Personal matter</option>
              <option value="sick">Feeling unwell</option>
              <option value="other">Other</option>
            </select>
            <svg class="select-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="form-field">
          <label class="form-field-label">Additional Details</label>
          <div class="form-field-textarea">
            <textarea class="form-textarea" placeholder="Enter additional details if needed..." id="absentDetails"></textarea>
          </div>
        </div>

        <button type="submit" class="submit-button">Submit</button>
      </form>
    `;
  }

  getLateFormContent() {
    return `
      <form class="employee-form" id="lateForm">
        <div class="form-field">
          <label class="form-field-label">Type</label>
          <div class="form-field-select">
            <select class="form-select" id="lateType">
              <option value="late-arrival">Late Arrival</option>
              <option value="extended-break">Extended Break</option>
            </select>
            <svg class="select-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="form-time-buttons">
          <button type="button" class="time-button" id="lateTimeInBtn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2H12.6667C13.0203 2 13.3594 2.14048 13.6095 2.39052C13.8595 2.64057 14 2.97971 14 3.33333V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H10" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6.66675 11.3334L10.0001 8.00008L6.66675 4.66675" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 8H2" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Time In
          </button>
          <button type="button" class="time-button" id="lateTimeOutBtn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 14H3.83333C3.47971 14 3.14057 13.8595 2.89052 13.6095C2.64048 13.3594 2.5 13.0203 2.5 12.6667V3.33333C2.5 2.97971 2.64048 2.64057 2.89052 2.39052C3.14057 2.14048 3.47971 2 3.83333 2H6.5" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M11.1667 11.3334L14.5001 8.00008L11.1667 4.66675" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14.5 8H6.5" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Time Out
          </button>
        </div>

        <div class="form-field">
          <label class="form-field-label">Reason</label>
          <div class="form-field-select">
            <select class="form-select" id="lateReason">
              <option value="traffic-delay">Traffic delay</option>
              <option value="public-transport">Public transport delay</option>
              <option value="personal-emergency">Personal emergency</option>
              <option value="medical">Medical appointment</option>
              <option value="other">Other</option>
            </select>
            <svg class="select-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="form-field">
          <label class="form-field-label">Additional Details</label>
          <div class="form-field-textarea">
            <textarea class="form-textarea" placeholder="Enter additional details if needed..." id="lateDetails"></textarea>
          </div>
        </div>

        <button type="submit" class="submit-button">Submit</button>
      </form>
    `;
  }

  setupEventListeners() {
    // Check if time in is required (haven't timed in today or already timed out)
    const today = new Date().toISOString().split('T')[0];
    const lastTimeIn = storage.get(`lastTimeIn_${this.currentUser?.email}`);
    const lastTimeOut = storage.get(`lastTimeOut_${this.currentUser?.email}`);
    const isTimeInRequired = !lastTimeIn || lastTimeIn !== today || (lastTimeOut && lastTimeOut === today);

    // For employees who need to time in, make modal non-dismissible
    // For front desk users or employees who already timed in, allow dismissal
    const canDismissModal = this.currentUser?.role === "front_desk" || !isTimeInRequired;

    if (!canDismissModal) {
      // Hide close button and prevent closing for employees who haven't timed in
      const closeBtn = $("#closeEmployeeModal");
      if (closeBtn) {
        closeBtn.style.display = "none";
      }
    } else {
      // Allow closing the modal
      on("#closeEmployeeModal", "click", () => this.hideModal());

      // Click outside to close
      if (this.modal) {
        this.modal.addEventListener("click", (e) => {
          if (e.target === this.modal) {
            this.hideModal();
          }
        });
      }

      // ESC key to close
      document.addEventListener("keydown", (e) => {
        if (
          e.key === "Escape" &&
          this.modal &&
          this.modal.style.display !== "none"
        ) {
          this.hideModal();
        }
      });
    }
  }

  setupModalContentListeners() {
    // Time tracking buttons
    on("#timeInBtn", "click", () => this.handleTimeIn());
    on("#timeOutBtn", "click", () => this.handleTimeOut());

    // QR code generation button (for employees)
    on("#generateQRBtn", "click", () => this.handleGenerateQR());

    // Form mode buttons
    on("#markAbsentBtn", "click", () => this.showAbsentForm());
    on("#markLateBtn", "click", () => this.showLateForm());

    // Late form time buttons
    on("#lateTimeInBtn", "click", () => this.handleTimeIn());
    on("#lateTimeOutBtn", "click", () => this.handleTimeOut());

    // Form submissions
    on("#absentForm", "submit", (e) => this.handleAbsentSubmit(e));
    on("#lateForm", "submit", (e) => this.handleLateSubmit(e));

    // Skip time tracking button (for front desk)
    on("#skipTimeTrackingBtn", "click", () => this.handleSkipTimeTracking());
  }

  handleGenerateQR() {
    // Redirect to timetracking page where the employee can generate QR codes
    showToast("Redirecting to QR code generation...", "info");

    setTimeout(() => {
      this.hideModal();
      navigate("timetracking.html");
    }, 1000);
  }

  showModal() {
    if (this.modal) {
      this.modal.style.display = "flex";
      this.setupModalContentListeners();
      document.body.style.overflow = "hidden";
    }
  }

  hideModal() {
    if (this.modal) {
      this.modal.style.display = "none";
      document.body.style.overflow = "auto";

      // Redirect to appropriate page based on user role
      setTimeout(() => {
        if (this.currentUser?.role === "employee") {
          navigate("timetracking.html");
        } else {
          navigate("dashboard.html");
        }
      }, 100);
    }
  }

  showAbsentForm() {
    this.modalState = "absent";
    const modalTitle = $("#modalTitle");
    const modalBody = $("#modalBody");

    if (modalTitle) modalTitle.textContent = "Time Tracker";
    if (modalBody) modalBody.innerHTML = this.getAbsentFormContent();

    this.setupModalContentListeners();
  }

  showLateForm() {
    this.modalState = "late";
    const modalTitle = $("#modalTitle");
    const modalBody = $("#modalBody");

    if (modalTitle) modalTitle.textContent = "Time Tracker";
    if (modalBody) modalBody.innerHTML = this.getLateFormContent();

    this.setupModalContentListeners();
  }

  backToTimeTracking() {
    this.modalState = "timetracking";
    const modalTitle = $("#modalTitle");
    const modalBody = $("#modalBody");

    if (modalTitle) modalTitle.textContent = "Time In & Time Out";
    if (modalBody) modalBody.innerHTML = this.getTimeTrackingContent();

    this.setupModalContentListeners();
  }

  async handleTimeIn() {
    try {
      const now = new Date();
      const timeInTimestamp = now.toISOString();
      const today = now.toISOString().split('T')[0];

      // Store time in data for the current user
      storage.set(`lastTimeIn_${this.currentUser.email}`, today);
      storage.set(`lastTimeInTime_${this.currentUser.email}`, timeInTimestamp);
      storage.remove(`lastTimeOut_${this.currentUser.email}`); // Clear any previous time out
      storage.remove(`lastTimeOutTime_${this.currentUser.email}`); // Clear previous time out timestamp

      // Try to record clock in via server API
      try {
        // Find the employee in the employees list to get their ID
        const employees = storage.get("employees") || [];
        const employee = employees.find(emp => emp.email === this.currentUser.email);

        if (employee) {
          // Record clock in via server API
          const clockInResponse = await fetch('/api/timetracking/clockin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: employee.id,
              timestamp: timeInTimestamp
            })
          });

          if (clockInResponse.ok) {
            console.log('✅ Successfully recorded clock in via API');
          } else {
            console.warn('⚠️ Failed to record clock in via API, using localStorage only');
          }
        }
      } catch (apiError) {
        console.warn('⚠️ API call failed for clock in, using localStorage only:', apiError.message);
      }

      // Create or update attendance record
      let attendance = storage.get("attendance") || [];
      const existingRecord = attendance.find(record =>
        record.employeeEmail === this.currentUser.email && record.date === today
      );

      if (existingRecord) {
        existingRecord.timeIn = timeInTimestamp;
        existingRecord.status = "on-time";
        delete existingRecord.timeOut; // Remove timeout if re-clocking in
      } else {
        attendance.push({
          employeeEmail: this.currentUser.email,
          employeeName: this.currentUser.name,
          date: today,
          timeIn: timeInTimestamp,
          status: "on-time"
        });
      }
      storage.set("attendance", attendance);

      showToast("Time In recorded successfully!", "success");

      // Close modal and redirect to appropriate page immediately after time in
      setTimeout(() => {
        this.hideModal();
      }, 1500);
    } catch (error) {
      console.error('Time in error:', error);
      showToast("Failed to record Time In", "error");
    }
  }

  async handleTimeOut() {
    try {
      const now = new Date();
      const timeOutTimestamp = now.toISOString();
      const today = now.toISOString().split('T')[0];

      // Store time out data for the current user
      storage.set(`lastTimeOut_${this.currentUser.email}`, today);
      storage.set(`lastTimeOutTime_${this.currentUser.email}`, timeOutTimestamp);

      // Try to record clock out via server API
      try {
        // Find the employee in the employees list to get their ID
        const employees = storage.get("employees") || [];
        const employee = employees.find(emp => emp.email === this.currentUser.email);

        if (employee) {
          // Record clock out via server API
          const clockOutResponse = await fetch('/api/timetracking/clockout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: employee.id,
              timestamp: timeOutTimestamp
            })
          });

          if (clockOutResponse.ok) {
            console.log('✅ Successfully recorded clock out via API');
          } else {
            console.warn('⚠️ Failed to record clock out via API, using localStorage only');
          }
        }
      } catch (apiError) {
        console.warn('⚠️ API call failed for clock out, using localStorage only:', apiError.message);
      }

      // Update attendance record
      let attendance = storage.get("attendance") || [];
      const attendanceRecord = attendance.find(record =>
        record.employeeEmail === this.currentUser.email && record.date === today
      );

      if (attendanceRecord) {
        attendanceRecord.timeOut = timeOutTimestamp;
        attendanceRecord.status = "present";
        storage.set("attendance", attendance);
      }

      // For employees, this means their shift is over - show appropriate message
      if (this.currentUser?.role === "employee") {
        showToast("Shift completed successfully! Have a great day!", "success");

        // Close modal without redirecting (they're done for the day)
        setTimeout(() => {
          this.hideModal();
          // Clear authentication to require re-login next time
          storage.remove("authToken");
          storage.remove("currentUser");
          navigate("login.html");
        }, 2000);
      } else {
        // For front desk, normal time out flow
        showToast("Time Out recorded successfully!", "success");

        // Close modal and redirect after timeout
        setTimeout(() => {
          this.hideModal();
        }, 1500);
      }
    } catch (error) {
      console.error('Time out error:', error);
      showToast("Failed to record Time Out", "error");
    }
  }

  async handleAbsentSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
      type: $("#absentType")?.value,
      reason: $("#absentReason")?.value,
      details: $("#absentDetails")?.value,
    };

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      showToast("Absence record submitted successfully!", "success");
      this.hideModal();

      // Redirect based on user role
      setTimeout(() => {
        if (this.currentUser?.role === "employee") {
          navigate("timetracking.html");
        } else {
          navigate("dashboard.html");
        }
      }, 1500);
    } catch (error) {
      showToast("Failed to submit absence record", "error");
    }
  }

  async handleLateSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
      type: $("#lateType")?.value,
      reason: $("#lateReason")?.value,
      details: $("#lateDetails")?.value,
    };

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      showToast("Late arrival record submitted successfully!", "success");
      this.hideModal();

      // Redirect based on user role
      setTimeout(() => {
        if (this.currentUser?.role === "employee") {
          navigate("timetracking.html");
        } else {
          navigate("dashboard.html");
        }
      }, 1500);
    } catch (error) {
      showToast("Failed to submit late arrival record", "error");
    }
  }

  updateSessionDisplay() {
    const sessionDisplay = $("#sessionDisplay");
    if (sessionDisplay) {
      sessionDisplay.innerHTML = this.getSessionDisplay();
    }
  }

  handleSkipTimeTracking() {
    // For front desk users who want to skip time tracking (work from home, day off, etc.)
    showToast("Time tracking skipped. Welcome back!", "info");

    setTimeout(() => {
      this.hideModal();
    }, 1500);
  }
}

// Initialize and show modal for front desk and employee users
function showEmployeeTimeModal() {
  const currentUser = storage.get("currentUser");

  // Only show for front desk and employee users
  if (
    currentUser &&
    (currentUser.role === "front_desk" || currentUser.role === "employee")
  ) {
    const modal = new EmployeeTimeModal();
    modal.showModal();
    return modal;
  }

  return null;
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.EmployeeTimeModal = EmployeeTimeModal;
  window.showEmployeeTimeModal = showEmployeeTimeModal;
}
