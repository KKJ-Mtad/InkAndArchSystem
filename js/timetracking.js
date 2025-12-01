// Time Tracking page functionality
/**
 * Clean up stale time tracking data
 * Removes localStorage entries that are more than 24 hours old
 */
function cleanupStaleTimeData() {
  const today = new Date().toISOString().split('T')[0];

  // Get all localStorage keys
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('lastTimeIn_')) {
      const timeInDate = localStorage.getItem(key);
      // If the time in date is not today, remove it and related data
      if (timeInDate && timeInDate !== today) {
        const email = key.replace('lastTimeIn_', '');
        localStorage.removeItem(`lastTimeIn_${email}`);
        localStorage.removeItem(`lastTimeOut_${email}`);
        localStorage.removeItem(`lastTimeInTime_${email}`);
        console.log(`Cleaned up stale time data for ${email}`);
      }
    }
  }
}

/**
 * Clean up expired temporary QR codes
 */
function cleanupExpiredTemporaryQRs() {
  const now = Date.now();

  // Get all localStorage keys
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('tempQR_')) {
      const qrData = JSON.parse(localStorage.getItem(key) || '{}');
      if (qrData.expiresAt && now > qrData.expiresAt) {
        localStorage.removeItem(key);
        console.log(`Cleaned up expired QR code for employee ${qrData.employeeId}`);
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Check authentication and prevent back button access after logout
  checkAuthAndPreventBackAccess();

  // Clean up stale time tracking data first
  cleanupStaleTimeData();
  // Remove inconsistent 'clocked-in' flags that aren't backed by attendance
  cleanupInconsistentTodayFlagsUsingAttendance();

  // Clean up expired temporary QR codes
  cleanupExpiredTemporaryQRs();

  // Periodic cleanup to ensure stale time flags and day-off states are cleared next day
  setInterval(() => {
    cleanupStaleTimeData();
    cleanupInconsistentTodayFlagsUsingAttendance();
  }, 1000 * 60 * 30); // every 30 minutes

  // Also run at midnight rollover to be safe
  scheduleMidnightCleanup();

  // Check authentication
  const token = storage.get("authToken");
  if (!token) {
    navigate("login.html");
    return;
  }

  // State management
  let employees = [];
  let activeSessions = [];
  let selectedEmployeeId = null;
  let currentSessionTimer = null;
  let html5QrCode;

  // Initialize page
  initializeTimeTrackingPage();
  setupEventListeners();
  loadData();

  function scheduleMidnightCleanup() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilTomorrow = tomorrow.getTime() - now.getTime() + 1000; // small buffer
    setTimeout(() => {
      try {
        cleanupStaleTimeData();
        cleanupInconsistentTodayFlagsUsingAttendance();
      } finally {
        // schedule next midnight
        scheduleMidnightCleanup();
      }
    }, msUntilTomorrow);
  }

  function initializeTimeTrackingPage() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    // Set user info
    const currentUser = storage.get("currentUser");
    const userNameElement = $("#userName");
    const userRoleElement = $(".user-role");
    if (userNameElement && currentUser) {
      userNameElement.textContent = currentUser.name || "Admin";
    }
    if (userRoleElement && currentUser) {
      const roleDisplayMap = {
        admin: "Administrator",
        front_desk: "Front Desk",
        employee: "Employee",
      };
      userRoleElement.textContent = roleDisplayMap[currentUser.role] || "User";
    }

    // Set last updated time
    const lastUpdatedElement = $("#lastUpdatedActivity");
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = formatTime(new Date());
    }

    // Apply role-based restrictions
    applyRoleBasedTimeTrackingAccess(currentUser);
  }

  function applyRoleBasedTimeTrackingAccess(user) {
    if (!user) return;

    // If employee, pre-select themselves and hide selector
    if (user.role === "employee") {
      const employeeSelect = $("#employeeSelect");
      if (employeeSelect) {
        // Find employee by email match
        const employee = employees.find((emp) => emp.email === user.email);
        if (employee) {
          employeeSelect.value = employee.id;
          employeeSelect.disabled = true;
          selectedEmployeeId = employee.id;

          // Check if employee is already timed in and create session
          const today = new Date().toISOString().split('T')[0];
          const lastTimeIn = storage.get(`lastTimeIn_${user.email}`);
          const lastTimeOut = storage.get(`lastTimeOut_${user.email}`);

          // If timed in today and not timed out, they should already be in activeSessions
          // Don't create a new session automatically - just show existing ones
          if (lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today)) {
            console.log(`Employee ${employee.name} appears to be clocked in - will show if session exists`);
          }

          // Force show clock actions for the employee
          selectedEmployeeId = employee.id;
          showClockActions();
          updateCurrentSession();

          // Reload active sessions to ensure employee shows up if they're clocked in
          setTimeout(() => {
            loadActiveSessions();
          }, 200);
        }
      }

      // For employees, hide the employees table since they don't need to see other employees
      const employeesTableContainer = $(".employees-table-container");
      if (employeesTableContainer) {
        employeesTableContainer.style.display = "none";
      }

      // Employee quick actions setup - timeout button removed
      console.log(`Employee ${user.email} setup completed`);

      // Update header
      const clockInterface = $(".clock-interface");
      const h2 = clockInterface?.querySelector("h2");
      if (h2) {
        h2.textContent = "My Time Clock";
      }

      // Modify activity sections for employees - show their own activity only
      const activitySection = $(".activity-section");
      const attendanceOverview = $(".attendance-overview");

      if (activitySection) {
        // Keep activity section but modify to show only employee's own data
        const sectionHeader = activitySection.querySelector(".section-header h2");
        if (sectionHeader) {
          sectionHeader.textContent = "My Activity Today";
        }

        // Hide export and filter controls for employees
        const activityFilters = activitySection.querySelector(".activity-filters");
        if (activityFilters) {
          activityFilters.style.display = "none";
        }
      }

      if (attendanceOverview) {
        // Hide attendance overview for employees (they only see their own data)
        attendanceOverview.style.display = "none";
      }

      // Setup employee-exclusive sidebar actions
      setupEmployeeQuickActions(user);

      // Show employee-exclusive sidebar section
      const employeeQuickActions = $("#employeeQuickActions");
      if (employeeQuickActions) {
        employeeQuickActions.style.display = "block";
      }

      // Show employee QR actions in clock interface
      const employeeQrActions = $("#employeeQrActions");
      if (employeeQrActions) {
        employeeQrActions.style.display = "block";
      }

      // Hide restricted sidebar items for employees - only show Dashboard and Time Tracking
      const sidebarItems = document.querySelectorAll(".sidebar-item");
      sidebarItems.forEach(item => {
        const href = item.getAttribute("href");
        const text = item.textContent.trim();
        // Only allow Dashboard and Time Tracking for employees
        if (href !== "dashboard.html" && href !== "timetracking.html" &&
          text !== "Dashboard" && text !== "Time Tracking") {
          item.style.display = "none";
        }
      });
    }

    // Hide employees tab for front desk users
    if (user.role === "front_desk") {
      const sidebarItems = document.querySelectorAll(".sidebar-item");
      sidebarItems.forEach(item => {
        const href = item.getAttribute("href");
        const text = item.textContent.trim();
        if (href === "employees.html" || text === "Employees") {
          item.style.display = "none";
        }
      });
    }
  }

  function setupEventListeners() {
    // Auto-refresh when returning to the tab/page
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        initializeActiveSessions();
        populateEmployeesTable();
        loadTodaysActivity();
        updateAttendanceOverview();
      }
    });

    // React to clock-in/out changes from other tabs/windows
    window.addEventListener('storage', (e) => {
      if (!e || !e.key) return;
      if (e.key.startsWith('lastTimeIn_') || e.key.startsWith('lastTimeOut_') || e.key.startsWith('lastTimeInTime_') || e.key.startsWith('lastTimeOutTime_')) {
        initializeActiveSessions();
        populateEmployeesTable();
        loadTodaysActivity();
        updateAttendanceOverview();
      }
    });

    // Periodic refresh to keep Active Sessions accurate
    setInterval(() => {
      initializeActiveSessions();
    }, 30000);

    // Mobile menu toggle
    const mobileMenuToggle = $("#mobileMenuToggle");
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener("click", toggleSidebar);
    }

    // Logout functionality
    const logoutBtn = $("#logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }

    // Employee selection (removed - now using table buttons)

    // QR Code scanner
    const qrScanBtn = $("#qrScanBtn");
    if (qrScanBtn) {
      qrScanBtn.addEventListener("click", showQrScanner);
    }

    // Manage time tracking settings
    const manageTimeSettingsBtn = $("#manageTimeSettingsBtn");
    if (manageTimeSettingsBtn) {
      manageTimeSettingsBtn.addEventListener("click", openTimeSettingsModal);
    }

    const timeSettingsForm = $("#timeSettingsForm");
    if (timeSettingsForm) {
      timeSettingsForm.addEventListener("submit", saveTimeSettings);
    }

    const closeTimeSettingsBtn = $("#closeTimeSettingsBtn");
    if (closeTimeSettingsBtn) {
      closeTimeSettingsBtn.addEventListener("click", closeTimeSettingsModal);
    }

    const cancelTimeSettingsBtn = $("#cancelTimeSettingsBtn");
    if (cancelTimeSettingsBtn) {
      cancelTimeSettingsBtn.addEventListener("click", closeTimeSettingsModal);
    }

    const timeSettingsModal = $("#timeSettingsModal");
    if (timeSettingsModal) {
      timeSettingsModal.addEventListener("click", function (e) { if (e.target === timeSettingsModal) closeTimeSettingsModal(); });
    }

    // Clock buttons
    const clockInBtn = $("#clockInBtn");
    const clockOutBtn = $("#clockOutBtn");
    const dayOffBtn = $("#dayOffBtn");
    if (clockInBtn) {
      clockInBtn.addEventListener("click", handleClockIn);
    }
    if (clockOutBtn) {
      clockOutBtn.addEventListener("click", handleClockOut);
    }
    if (dayOffBtn) {
      dayOffBtn.addEventListener("click", handleDayOff);
    }

    // Activity filters
    const statusFilterActivity = $("#statusFilterActivity");
    if (statusFilterActivity) {
      statusFilterActivity.addEventListener("change", handleActivityFilter);
    }

    // Export button
    const exportActivityBtn = $("#exportActivityBtn");
    if (exportActivityBtn) {
      exportActivityBtn.addEventListener("click", handleExportActivity);
    }

    // QR Modal
    setupQrModalEventListeners();

    // Employee QR Modal
    setupEmployeeQrModalEventListeners();

    // Employee QR Clock Actions (new buttons)
    // setupEmployeeQrClockActions(); // Handled by inline script in HTML"}

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", function (e) {
      const sidebar = $("#sidebar");
      const mobileToggle = $("#mobileMenuToggle");

      if (
        window.innerWidth <= 768 &&
        sidebar &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(e.target) &&
        !mobileToggle.contains(e.target)
      ) {
        sidebar.classList.remove("open");
      }
    });

    // Handle window resize
    window.addEventListener("resize", function () {
      const sidebar = $("#sidebar");
      if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove("open");
      }
    });
  }

  function setupQrModalEventListeners() {
    const closeQrModalBtn = $("#closeQrModalBtn");
    const cancelQrBtn = $("#cancelQrBtn");
    const qrScanModal = $("#qrScanModal");

    if (closeQrModalBtn) {
      closeQrModalBtn.addEventListener("click", hideQrScanner);
    }
    if (cancelQrBtn) {
      cancelQrBtn.addEventListener("click", hideQrScanner);
    }
    if (qrScanModal) {
      qrScanModal.addEventListener("click", function (e) {
        if (e.target === qrScanModal) {
          hideQrScanner();
        }
      });
    }
  }

  function setupEmployeeQrModalEventListeners() {
    const closeEmployeeQrModalBtn = $("#closeEmployeeQrModalBtn");
    const closeEmployeeQrBtn = $("#closeEmployeeQrBtn");
    const refreshQrBtn = $("#refreshQrBtn");
    const employeeQrModal = $("#employeeQrModal");

    if (closeEmployeeQrModalBtn) {
      closeEmployeeQrModalBtn.addEventListener("click", hideEmployeeQrModal);
    }
    if (closeEmployeeQrBtn) {
      closeEmployeeQrBtn.addEventListener("click", hideEmployeeQrModal);
    }
    if (refreshQrBtn) {
      refreshQrBtn.addEventListener("click", refreshEmployeeQR);
    }
    if (employeeQrModal) {
      employeeQrModal.addEventListener("click", function (e) {
        if (e.target === employeeQrModal) {
          hideEmployeeQrModal();
        }
      });
    }
  }

  // Time settings modal handlers
  function openTimeSettingsModal() {
    const modal = $("#timeSettingsModal");
    const settings = getAttendanceSettings();
    const startInput = $("#startTimeInput");
    const lateInput = $("#lateMinutesInput");
    const absentInput = $("#absentMinutesInput");
    if (startInput) startInput.value = settings.standardStartTime || "08:00";
    if (lateInput) lateInput.value = settings.lateThreshold;
    if (absentInput) absentInput.value = settings.absentThreshold;

    // Update example and bind listeners
    updateTimeSettingsExample();
    startInput?.addEventListener('input', updateTimeSettingsExample);
    lateInput?.addEventListener('input', updateTimeSettingsExample);
    absentInput?.addEventListener('input', updateTimeSettingsExample);

    showModal("#timeSettingsModal");
  }

  function closeTimeSettingsModal() {
    hideModal("#timeSettingsModal");
  }

  function saveTimeSettings(e) {
    if (e && e.preventDefault) e.preventDefault();
    const startInput = $("#startTimeInput");
    const lateInput = $("#lateMinutesInput");
    const absentInput = $("#absentMinutesInput");
    const settings = {
      standardStartTime: startInput?.value || "08:00",
      lateThreshold: parseInt(lateInput?.value || "30", 10),
      absentThreshold: parseInt(absentInput?.value || "30", 10)
    };
    storage.set("attendanceSettings", settings);
    showToast("Time tracking settings saved", "success");
    closeTimeSettingsModal();
    updateAttendanceOverview();
  }

  function updateTimeSettingsExample() {
    const start = (document.getElementById('startTimeInput')?.value || '08:00').trim();
    const late = parseInt(document.getElementById('lateMinutesInput')?.value || '30', 10);
    const absent = parseInt(document.getElementById('absentMinutesInput')?.value || '30', 10);

    const [hh, mm] = start.split(':').map(n => parseInt(n, 10));
    const startMin = (isNaN(hh) ? 8 : hh) * 60 + (isNaN(mm) ? 0 : mm);
    const lateUntilMin = Math.max(startMin, startMin + Math.max(0, late) - 1);
    const absentFromMin = startMin + Math.max(0, absent);

    const fmt = (m) => {
      const h = Math.floor(((m % (24 * 60)) + (24 * 60)) % (24 * 60) / 60);
      const minutes = ((m % 60) + 60) % 60;
      return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const helpEl = document.querySelector('#timeSettingsModal .help-text');
    if (helpEl) {
      helpEl.textContent = `Start ${fmt(startMin)}, late until ${fmt(lateUntilMin)}, absent from ${fmt(absentFromMin)}.`;
    }
  }

  function updateCurrentTime() {
    const now = new Date();
    const currentTimeElement = $("#currentTime");
    const currentDateElement = $("#currentDate");

    if (currentTimeElement) {
      currentTimeElement.textContent = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

    if (currentDateElement) {
      currentDateElement.textContent = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // Update active session timers
    updateActiveSessionTimers();
  }

  async function loadData() {
    try {
      // Load employees from database API
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const dbEmployees = await response.json();
          employees = dbEmployees.map(emp => ({
            id: emp.id,
            name: emp.name,
            email: emp.email,
            position: emp.position,
            status: emp.status,
            avatar: emp.avatar || generateInitialsAvatar(emp.name.split(' ')[0], emp.name.split(' ')[1])
          }));
          console.log('✅ Loaded employees from database:', employees.length);
        } else {
          throw new Error('Failed to load from database');
        }
      } catch (apiError) {
        console.warn('⚠️ Database API unavailable, using fallback:', apiError.message);
        // Fallback to localStorage
        const dynamicEmployees = storage.get("employees") || [];
        employees = [...dynamicEmployees];
      }

      // Remove duplicates based on email
      employees = employees.filter((employee, index, self) =>
        index === self.findIndex((e) => e.email === employee.email)
      );

      // Initialize active sessions (await to ensure flags and sessions are ready)
      await initializeActiveSessions();

      // Populate employees table (now reflects active sessions)
      populateEmployeesTable();

      // Load activity data
      loadTodaysActivity();

      // Update attendance overview
      updateAttendanceOverview();

      // Force reload active sessions to ensure they show correctly
      setTimeout(() => {
        initializeActiveSessions();
      }, 100);
    } catch (error) {
      showToast("Failed to load data", "error");
      console.error("Error loading data:", error);
    }
  }

  function populateEmployeesTable() {
    const employeesTableBody = $("#employeesTableBody");
    if (!employeesTableBody) return;

    // Only show employees table for admin and front_desk users
    const currentUser = storage.get("currentUser");
    if (currentUser?.role === "employee") {
      return; // Employees don't see the table
    }

    const activeEmployees = employees.filter((emp) => emp.status === "active");
    const today = new Date().toISOString().split('T')[0];

    if (activeEmployees.length === 0) {
      employeesTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-gray-500 py-8">
            No active employees found
          </td>
        </tr>
      `;
      return;
    }

    employeesTableBody.innerHTML = activeEmployees
      .map((emp) => {
        // Check today's attendance for Day Off
        const attendance = storage.get("attendance") || [];
        const todayRecord = attendance.find(r => r.employeeEmail === emp.email && r.date === today);
        const isDayOff = todayRecord?.status === 'day_off';

        // Check if employee is currently clocked in
        const lastTimeIn = storage.get(`lastTimeIn_${emp.email}`);
        const lastTimeOut = storage.get(`lastTimeOut_${emp.email}`);
        const isClockedIn = !isDayOff && lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today);

        const status = isDayOff ? 'day-off' : (isClockedIn ? 'clocked-in' : 'clocked-out');
        const statusText = isDayOff ? 'Day Off' : (isClockedIn ? 'Clocked In' : 'Available');

        return `
          <tr data-employee-id="${emp.id}">
            <td>
              <div class="employee-info">
                <div class="employee-portrait">
                  ${getEmployeePortraitHTML(emp.id, emp.name)}
                </div>
                <div class="employee-details">
                  <div class="employee-name">${emp.name}</div>
                  <div class="employee-email">${emp.email}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="employee-position">${emp.position}</span>
            </td>
            <td>
              <span class="employee-status status-${status}">${statusText}</span>
            </td>
            <td>
              <div class="employee-actions">
                <button class="action-btn action-btn-in"
                        onclick="handleEmployeeClockIn(${emp.id})"
                        ${isClockedIn || isDayOff ? 'disabled' : ''}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                    <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Clock In
                </button>
                <button class="action-btn action-btn-out"
                        onclick="handleEmployeeClockOut(${emp.id})"
                        ${!isClockedIn ? 'disabled' : ''}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                    <path d="M16 12l-4-4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Clock Out
                </button>
                <button class="action-btn"
                        onclick="handleEmployeeDayOff(${emp.id})"
                        ${isDayOff ? 'disabled' : ''}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                    <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Day Off
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Remove stray today flags not backed by attendance
  function cleanupInconsistentTodayFlagsUsingAttendance() {
    const today = new Date().toISOString().split('T')[0];
    const attendance = storage.get('attendance') || [];
    const activeEmails = new Set(
      attendance
        .filter(r => r.date === today && r.timeIn && !r.timeOut)
        .map(r => r.employeeEmail)
    );

    // Scan localStorage and clear any 'lastTimeIn_*' that isn't in activeEmails
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('lastTimeIn_')) {
        const email = key.replace('lastTimeIn_', '');
        if (!activeEmails.has(email)) {
          localStorage.removeItem(`lastTimeIn_${email}`);
          localStorage.removeItem(`lastTimeInTime_${email}`);
          localStorage.removeItem(`lastTimeOut_${email}`);
          localStorage.removeItem(`lastTimeOutTime_${email}`);
        }
      }
    }
  }

  function reconcileLocalTimeFlags() {
    const today = new Date().toISOString().split('T')[0];
    const attendance = storage.get('attendance') || [];

    const activeEmailsFromSessions = new Set(activeSessions.map(s => s.employeeEmail));

    employees.forEach(emp => {
      const hasActiveAttendance = attendance.some(r => r.employeeEmail === emp.email && r.date === today && r.timeIn && !r.timeOut);
      const shouldBeActive = activeEmailsFromSessions.has(emp.email) || hasActiveAttendance;

      if (shouldBeActive) {
        if (storage.get(`lastTimeIn_${emp.email}`) !== today) {
          storage.set(`lastTimeIn_${emp.email}`, today);
          // Prefer attendance timestamp if available
          const rec = attendance.find(r => r.employeeEmail === emp.email && r.date === today && r.timeIn && !r.timeOut);
          storage.set(`lastTimeInTime_${emp.email}`, rec?.timeIn || new Date().toISOString());
        }
        storage.remove(`lastTimeOut_${emp.email}`);
        storage.remove(`lastTimeOutTime_${emp.email}`);
      } else {
        storage.remove(`lastTimeIn_${emp.email}`);
        storage.remove(`lastTimeInTime_${emp.email}`);
        storage.remove(`lastTimeOut_${emp.email}`);
        storage.remove(`lastTimeOutTime_${emp.email}`);
      }
    });
  }

  async function initializeActiveSessions() {
    // Load real active sessions from both localStorage and server
    activeSessions = [];
    const today = new Date().toISOString().split('T')[0];

    try {
      // First, try to load from server
      const response = await fetch('/api/timetracking/active');
      if (response.ok) {
        const serverSessions = await response.json();
        console.log('🔄 Loaded active sessions from server:', serverSessions.length);

        // Convert server sessions to our format and remove duplicates
        const sessionsByEmployee = new Map();

        serverSessions.forEach(session => {
          const employee = employees.find(emp => emp.id === session.employee_id);
          if (employee && !sessionsByEmployee.has(session.employee_id)) {
            sessionsByEmployee.set(session.employee_id, {
              employeeId: session.employee_id,
              startTime: new Date(session.clock_in),
              status: "active",
              employeeName: session.employee_name,
              employeeEmail: session.employee_email
            });

            // Sync with localStorage for persistence
            storage.set(`lastTimeIn_${session.employee_email}`, today);
            storage.set(`lastTimeInTime_${session.employee_email}`, session.clock_in);
            storage.remove(`lastTimeOut_${session.employee_email}`);
          }
        });

        activeSessions = Array.from(sessionsByEmployee.values());
      } else {
        console.warn('Server sessions unavailable, using localStorage fallback');
        throw new Error('Server unavailable');
      }
    } catch (error) {
      console.warn('Loading from localStorage fallback:', error.message);

      // Fallback to localStorage data - also check for duplicates
      const sessionsByEmployee = new Map();

      employees.forEach(employee => {
        const lastTimeIn = storage.get(`lastTimeIn_${employee.email}`);
        const lastTimeOut = storage.get(`lastTimeOut_${employee.email}`);
        const lastTimeInTime = storage.get(`lastTimeInTime_${employee.email}`);

        // If they timed in today and haven't timed out, they're active
        if (lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today) && !sessionsByEmployee.has(employee.id)) {
          const startTime = lastTimeInTime ? new Date(lastTimeInTime) : new Date();

          sessionsByEmployee.set(employee.id, {
            employeeId: employee.id,
            startTime: startTime,
            status: "active",
            employeeName: employee.name,
            employeeEmail: employee.email
          });

          console.log(`✅ Active session found for ${employee.name} (${employee.email}) - started at ${startTime.toLocaleTimeString()}`);
        }
      });

      activeSessions = Array.from(sessionsByEmployee.values());
    }

    console.log(`📊 Loaded ${activeSessions.length} active sessions from combined sources`);

    // Ensure local flags reflect only real sessions or attendance
    reconcileLocalTimeFlags();

    // Reload active sessions display immediately
    loadActiveSessions();
    // Also refresh employees table so button states reflect latest sessions
    populateEmployeesTable();
  }

  function handleEmployeeSelection() {
    const employeeSelect = $("#employeeSelect");
    const selectedId = parseInt(employeeSelect.value);

    if (selectedId) {
      selectedEmployeeId = selectedId;
      showClockActions();
      updateCurrentSession();
    } else {
      selectedEmployeeId = null;
      hideClockActions();
    }
  }

  // Attendance status thresholds helper (configurable)
  function getAttendanceSettings() {
    const defaults = { standardStartTime: "08:00", lateThreshold: 30, absentThreshold: 30 };
    const saved = storage.get("attendanceSettings");
    if (!saved) return defaults;
    return {
      standardStartTime: saved.standardStartTime || defaults.standardStartTime,
      lateThreshold: Number.isFinite(saved.lateThreshold) ? saved.lateThreshold : defaults.lateThreshold,
      absentThreshold: Number.isFinite(saved.absentThreshold) ? saved.absentThreshold : defaults.absentThreshold
    };
  }

  function computeAttendanceStatus(now) {
    const settings = getAttendanceSettings();
    const [hh, mm] = (settings.standardStartTime || "08:00").split(":").map(n => parseInt(n, 10));
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const start = new Date(y, m, d, isNaN(hh) ? 8 : hh, isNaN(mm) ? 0 : mm, 0, 0);
    const absentStart = new Date(start.getTime() + (Number(settings.absentThreshold) || 30) * 60000);

    if (now < start) return 'on-time';
    if (now >= absentStart) return 'absent';
    return 'late';
  }

  // Global functions for employee table clock actions
  window.handleEmployeeClockIn = async function (employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
      showToast("Employee not found", "error");
      return;
    }

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeInTimestamp = now.toISOString();

      // Check if employee is already clocked in
      const lastTimeIn = storage.get(`lastTimeIn_${employee.email}`);
      const lastTimeOut = storage.get(`lastTimeOut_${employee.email}`);

      if (lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today)) {
        showToast(`${employee.name} is already clocked in today`, "warning");
        return;
      }

      // Record clock in via server API if online
      try {
        const response = await fetch('/api/timetracking/clockin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employeeId,
            timestamp: timeInTimestamp,
            date: today
          })
        });

        if (!response.ok) {
          throw new Error('Server unavailable');
        }
        console.log('✅ Clock in recorded on server');
      } catch (error) {
        console.warn('⚠️ Server unavailable, storing locally:', error.message);
      }

      // Always store locally for offline functionality
      storage.set(`lastTimeIn_${employee.email}`, today);
      storage.set(`lastTimeInTime_${employee.email}`, timeInTimestamp);
      storage.remove(`lastTimeOut_${employee.email}`);
      storage.remove(`lastTimeOutTime_${employee.email}`);

      // Determine attendance status
      const attendanceStatus = computeAttendanceStatus(now);

      // Update attendance record
      let attendance = storage.get("attendance") || [];
      const existingRecord = attendance.find(record =>
        record.employeeEmail === employee.email && record.date === today
      );

      if (existingRecord) {
        existingRecord.timeIn = timeInTimestamp;
        existingRecord.status = attendanceStatus === 'on-time' ? 'present' : attendanceStatus;
        delete existingRecord.timeOut;
      } else {
        attendance.push({
          employeeEmail: employee.email,
          employeeName: employee.name,
          date: today,
          timeIn: timeInTimestamp,
          status: attendanceStatus === 'on-time' ? 'present' : attendanceStatus
        });
      }
      storage.set("attendance", attendance);

      // Add to active sessions
      activeSessions = activeSessions.filter(session => session.employeeId !== employeeId);
      activeSessions.push({
        employeeId: employeeId,
        startTime: now,
        status: "active",
        attendanceStatus: attendanceStatus === 'on-time' ? 'present' : attendanceStatus,
        employeeName: employee.name,
        employeeEmail: employee.email
      });

      // Refresh displays
      populateEmployeesTable();
      loadTodaysActivity();
      updateAttendanceOverview();

      const msg = attendanceStatus === 'late' ? 'clocked in (Late)' : attendanceStatus === 'absent' ? 'clocked in (Marked Absent)' : 'clocked in successfully';
      showToast(`${employee.name} ${msg} at ${formatTime(now)}`, attendanceStatus === 'on-time' ? 'success' : (attendanceStatus === 'late' ? 'warning' : 'error'));
    } catch (error) {
      console.error("Clock in error:", error);
      showToast(`Failed to clock in ${employee.name}: ${error.message}`, "error");
    }
  };

  window.handleEmployeeClockOut = async function (employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
      showToast("Employee not found", "error");
      return;
    }

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeOutTimestamp = now.toISOString();

      // Check if employee is actually clocked in
      const lastTimeIn = storage.get(`lastTimeIn_${employee.email}`);
      const lastTimeOut = storage.get(`lastTimeOut_${employee.email}`);

      if (lastTimeIn !== today || (lastTimeOut && lastTimeOut === today)) {
        showToast(`${employee.name} is not currently clocked in`, "warning");
        return;
      }

      // Record clock out via server API if online
      try {
        const response = await fetch('/api/timetracking/clockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employeeId,
            timestamp: timeOutTimestamp,
            date: today
          })
        });

        if (!response.ok) {
          throw new Error('Server unavailable');
        }
        console.log('��� Clock out recorded on server');
      } catch (error) {
        console.warn('⚠️ Server unavailable, storing locally:', error.message);
      }

      // Always store locally for offline functionality
      storage.set(`lastTimeOut_${employee.email}`, today);
      storage.set(`lastTimeOutTime_${employee.email}`, timeOutTimestamp);

      // Update attendance record
      let attendance = storage.get("attendance") || [];
      const attendanceRecord = attendance.find(record =>
        record.employeeEmail === employee.email && record.date === today
      );

      if (attendanceRecord) {
        attendanceRecord.timeOut = timeOutTimestamp;
        // Preserve original status (present/late/absent/day_off) from clock-in
        storage.set("attendance", attendance);
      }

      // Remove from active sessions
      activeSessions = activeSessions.filter(session => session.employeeId !== employeeId);

      // Refresh displays
      populateEmployeesTable();
      loadTodaysActivity();
      updateAttendanceOverview();

      showToast(`${employee.name} clocked out successfully at ${formatTime(now)}`, "success");
    } catch (error) {
      console.error("Clock out error:", error);
      showToast(`Failed to clock out ${employee.name}: ${error.message}`, "error");
    }
  };

  function showClockActions() {
    const clockActions = $("#clockActions");
    const selectedEmployee = employees.find(
      (emp) => emp.id === selectedEmployeeId,
    );

    if (clockActions && selectedEmployee) {
      clockActions.style.display = "block";

      // Update selected employee display
      const selectedEmployeeEl = $("#selectedEmployee");
      if (selectedEmployeeEl) {
        selectedEmployeeEl.innerHTML = `
          <div class="selected-employee-info">
            <div class="selected-employee-portrait">
              ${getEmployeePortraitHTML(selectedEmployee.id, selectedEmployee.name)}
            </div>
            <div class="selected-employee-details">
              <div class="selected-employee-name">${selectedEmployee.name}</div>
              <div class="selected-employee-position">${selectedEmployee.position}</div>
              <div class="selected-employee-id">ID: ${selectedEmployee.id.toString().padStart(3, "0")}</div>
            </div>
          </div>
        `;
      }

      updateCurrentSession();

      // For employees, check and enable clock out button if needed
      const currentUser = storage.get("currentUser");
      if (currentUser && currentUser.role === "employee" && selectedEmployee.email === currentUser.email) {
        const clockOutBtn = $("#clockOutBtn");
        const generateClockInQrBtn = $("#generateClockInQrBtn");
        const generateClockOutQrBtn = $("#generateClockOutQrBtn");
        const today = new Date().toISOString().split('T')[0];
        const lastTimeIn = storage.get(`lastTimeIn_${currentUser.email}`);
        const lastTimeOut = storage.get(`lastTimeOut_${currentUser.email}`);

        // Check if employee is clocked in today
        const isClockedIn = lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today);

        // Update regular clock buttons
        if (isClockedIn) {
          // Ensure clock out button is enabled for employees
          if (clockOutBtn) {
            clockOutBtn.disabled = false;
            clockOutBtn.style.display = "inline-flex";
          }
          console.log("Employee clocked in - clock out button available");
        } else {
          console.log("Employee not clocked in - clock out button disabled");
        }

        // Update QR buttons
        if (generateClockInQrBtn) generateClockInQrBtn.disabled = isClockedIn;
        if (generateClockOutQrBtn) generateClockOutQrBtn.disabled = !isClockedIn;
      }
    }
  }

  function hideClockActions() {
    const clockActions = $("#clockActions");
    if (clockActions) {
      clockActions.style.display = "none";
    }
    if (currentSessionTimer) {
      clearInterval(currentSessionTimer);
      currentSessionTimer = null;
    }
  }

  function updateCurrentSession() {
    const currentSessionEl = $("#currentSession");
    const clockInBtn = $("#clockInBtn");
    const clockOutBtn = $("#clockOutBtn");

    if (!selectedEmployeeId || !currentSessionEl) return;

    // For employees, also check localStorage directly to ensure accurate state
    const currentUser = storage.get("currentUser");
    const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
    let isClockedInByStorage = false;

    if (currentUser?.role === "employee" && selectedEmployee && selectedEmployee.email === currentUser.email) {
      const today = new Date().toISOString().split('T')[0];
      const lastTimeIn = storage.get(`lastTimeIn_${currentUser.email}`);
      const lastTimeOut = storage.get(`lastTimeOut_${currentUser.email}`);
      isClockedInByStorage = lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today);
    }

    const activeSession = activeSessions.find(
      (session) =>
        session.employeeId === selectedEmployeeId &&
        session.status === "active",
    );

    // Use either active session or localStorage check for employees
    const isActuallyActive = activeSession || isClockedInByStorage;

    if (isActuallyActive) {
      // Employee is clocked in
      const attendanceStatus = activeSession?.attendanceStatus || "present";
      const statusBadge = attendanceStatus !== "present" ?
        `<span class="attendance-badge attendance-${attendanceStatus}">${attendanceStatus.charAt(0).toUpperCase() + attendanceStatus.slice(1)}</span>` : "";

      // Get start time from active session or localStorage
      let startTime = activeSession?.startTime;
      if (!startTime && isClockedInByStorage && currentUser) {
        const lastTimeInTime = storage.get(`lastTimeInTime_${currentUser.email}`);
        if (lastTimeInTime) {
          startTime = new Date(lastTimeInTime);
        }
      }

      currentSessionEl.innerHTML = `
        <div class="session-status">Currently Working ${statusBadge}</div>
        <div class="session-time" id="sessionTimer">00:00:00</div>
        <div class="session-details">
          <div class="session-start">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Started: ${startTime ? formatTime(startTime) : 'Today'}
          </div>
          <div class="session-duration">Working...</div>
        </div>
      `;
      currentSessionEl.classList.add("active");

      if (clockInBtn) clockInBtn.disabled = true;
      if (clockOutBtn) clockOutBtn.disabled = false;

      // Update QR buttons for employees
      const generateClockInQrBtn = $("#generateClockInQrBtn");
      const generateClockOutQrBtn = $("#generateClockOutQrBtn");
      if (generateClockInQrBtn) generateClockInQrBtn.disabled = true;
      if (generateClockOutQrBtn) generateClockOutQrBtn.disabled = false;

      // Start timer
      if (startTime) {
        startSessionTimer(startTime);
      }
    } else {
      // Employee is not clocked in
      currentSessionEl.innerHTML = `
        <div class="session-status">Ready to Clock In</div>
        <div class="session-time">--:--:--</div>
        <div class="session-details">
          <div class="session-start">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Not clocked in
          </div>
          <div class="session-duration">Ready to start</div>
        </div>
      `;
      currentSessionEl.classList.remove("active");

      if (clockInBtn) clockInBtn.disabled = false;
      if (clockOutBtn) clockOutBtn.disabled = true;

      // Update QR buttons for employees
      const generateClockInQrBtn = $("#generateClockInQrBtn");
      const generateClockOutQrBtn = $("#generateClockOutQrBtn");
      if (generateClockInQrBtn) generateClockInQrBtn.disabled = false;
      if (generateClockOutQrBtn) generateClockOutQrBtn.disabled = true;

      if (currentSessionTimer) {
        clearInterval(currentSessionTimer);
        currentSessionTimer = null;
      }
    }
  }

  function startSessionTimer(startTime) {
    if (currentSessionTimer) {
      clearInterval(currentSessionTimer);
    }

    currentSessionTimer = setInterval(() => {
      const sessionTimerEl = $("#sessionTimer");
      if (sessionTimerEl) {
        const elapsed = Date.now() - startTime.getTime();
        sessionTimerEl.textContent = formatDuration(elapsed);
      }
    }, 1000);
  }

  function updateActiveSessionTimers() {
    // Update all active session displays in the activity section
    const activeSessionsEl = $("#activeSessions");
    if (activeSessionsEl && activeSessions.length > 0) {
      // This will be updated in the loadTodaysActivity function
    }
  }

  async function handleClockIn() {
    if (!selectedEmployeeId) return;

    const clockInBtn = $("#clockInBtn");
    const originalText = clockInBtn.innerHTML;

    try {
      // Show loading state
      clockInBtn.disabled = true;
      clockInBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Clocking In...
      `;

      // Check time-based status
      const now = new Date();
      const attendanceStatus = computeAttendanceStatus(now);
      const statusMessage = attendanceStatus === 'late' ? 'clocked in (Late)!' : attendanceStatus === 'absent' ? 'clocked in (Marked Absent)!' : 'clocked in successfully!';
      const toastType = attendanceStatus === 'on-time' ? 'success' : (attendanceStatus === 'late' ? 'warning' : 'error');

      // Record clock in via server API
      const clockInResponse = await fetch('/api/timetracking/clockin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedEmployeeId, timestamp: new Date().toISOString() })
      });

      if (!clockInResponse.ok) {
        throw new Error('Failed to record clock in on server');
      }

      // Store time in data for ALL users (not just current user)
      const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId);
      if (selectedEmployee) {
        const today = new Date().toISOString().split('T')[0];
        const timeInTimestamp = new Date().toISOString();

        // Store time tracking data for the selected employee
        storage.set(`lastTimeIn_${selectedEmployee.email}`, today);
        storage.set(`lastTimeInTime_${selectedEmployee.email}`, timeInTimestamp);
        storage.remove(`lastTimeOut_${selectedEmployee.email}`); // Clear any previous time out
        storage.remove(`lastTimeOutTime_${selectedEmployee.email}`); // Clear previous time out timestamp

        console.log(`✅ Stored clock-in data for ${selectedEmployee.name} (${selectedEmployee.email})`);

        // Create or update attendance record for the selected employee
        let attendance = storage.get("attendance") || [];
        const existingRecord = attendance.find(record =>
          record.employeeEmail === selectedEmployee.email && record.date === today
        );

        if (existingRecord) {
          existingRecord.timeIn = timeInTimestamp;
          existingRecord.status = attendanceStatus === 'on-time' ? 'present' : attendanceStatus;
          delete existingRecord.timeOut; // Remove timeout if re-clocking in
        } else {
          attendance.push({
            employeeEmail: selectedEmployee.email,
            employeeName: selectedEmployee.name,
            date: today,
            timeIn: timeInTimestamp,
            status: attendanceStatus === 'on-time' ? 'present' : attendanceStatus
          });
        }
        storage.set("attendance", attendance);
      }

      // Remove any existing session for this employee to prevent duplicates
      activeSessions = activeSessions.filter(
        (session) => session.employeeId !== selectedEmployeeId
      );

      // Add to active sessions with status
      activeSessions.push({
        employeeId: selectedEmployeeId,
        startTime: new Date(),
        status: "active",
        attendanceStatus: attendanceStatus === 'on-time' ? 'present' : attendanceStatus,
        employeeName: selectedEmployee.name,
        employeeEmail: selectedEmployee.email
      });

      // Update display with forced refresh
      updateCurrentSession();
      // Force immediate refresh of recent activity
      setTimeout(() => {
        loadTodaysActivity();
        loadRecentActivity();
      }, 100);
      updateAttendanceOverview();

      showToast(`${selectedEmployee.name} ${statusMessage}`, toastType);
    } catch (error) {
      console.error("Clock in error:", error);
      showToast(`Failed to clock in: ${error.message}`, "error");
      clockInBtn.innerHTML = originalText;
      clockInBtn.disabled = false;
    }
  }

  async function handleClockOut() {
    if (!selectedEmployeeId) return;

    const clockOutBtn = $("#clockOutBtn");
    const originalText = clockOutBtn.innerHTML;

    try {
      // Show loading state
      clockOutBtn.disabled = true;
      clockOutBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M16 12l-4-4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Clocking Out...
      `;

      // Record clock out via server API
      const clockOutResponse = await fetch('/api/timetracking/clockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedEmployeeId, timestamp: new Date().toISOString() })
      });

      if (!clockOutResponse.ok) {
        throw new Error('Failed to record clock out on server');
      }

      // Store time out data for ALL users (not just current user)
      const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId);
      if (selectedEmployee) {
        const today = new Date().toISOString().split('T')[0];
        const timeOutTimestamp = new Date().toISOString();

        // Store time tracking data for the selected employee
        storage.set(`lastTimeOut_${selectedEmployee.email}`, today);
        storage.set(`lastTimeOutTime_${selectedEmployee.email}`, timeOutTimestamp);

        console.log(`✅ Stored clock-out data for ${selectedEmployee.name} (${selectedEmployee.email})`);

        // Update attendance record for the selected employee
        let attendance = storage.get("attendance") || [];
        const attendanceRecord = attendance.find(record =>
          record.employeeEmail === selectedEmployee.email && record.date === today
        );

        if (attendanceRecord) {
          attendanceRecord.timeOut = timeOutTimestamp;
          // Keep original status from clock-in (present/late/absent/day_off)
          storage.set("attendance", attendance);
        }
      }

      // Remove from active sessions
      activeSessions = activeSessions.filter(
        (session) => session.employeeId !== selectedEmployeeId,
      );

      // Update display with forced refresh
      updateCurrentSession();
      // Force immediate refresh of recent activity
      setTimeout(() => {
        loadTodaysActivity();
        loadRecentActivity();
      }, 100);
      updateAttendanceOverview();

      showToast(
        `${selectedEmployee.name} clocked out successfully!`,
        "success",
      );
    } catch (error) {
      console.error("Clock out error:", error);
      showToast(`Failed to clock out: ${error.message}`, "error");
      clockOutBtn.innerHTML = originalText;
      clockOutBtn.disabled = false;
    }
  }

  function showQrScanner() {
    showModal("#qrScanModal");
    startQrCodeScanner();
  }

  function hideQrScanner() {
    hideModal("#qrScanModal");
    if (html5QrCode) {
      html5QrCode.stop().then(() => {
        try {
          html5QrCode.clear();
        } catch (clearError) {
          console.warn("Failed to clear QR scanner:", clearError);
        }
      }).catch(err => {
        console.warn("Failed to stop QR scanner:", err);
        // Try to clear anyway
        try {
          html5QrCode.clear();
        } catch (clearError) {
          console.warn("Failed to clear QR scanner after stop error:", clearError);
        }
      });
    }
  }

  function startQrCodeScanner() {
    const qrRegionId = "qr-reader";
    if (typeof Html5Qrcode === 'undefined') {
      showToast("QR scanner library not loaded", "error");
      return;
    }

    try {
      html5QrCode = new Html5Qrcode(qrRegionId);

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast("Camera access not supported in this browser", "error");
        return;
      }

      Html5Qrcode.getCameras().then(cameras => {
        if (cameras && cameras.length) {
          const cameraId = cameras[0].id;
          html5QrCode.start(
            cameraId,
            { fps: 10, qrbox: 250 },
            onScanSuccess,
            onScanFailure
          ).catch(startErr => {
            console.error("Failed to start camera:", startErr);
            showToast("Failed to start camera. Please check permissions.", "error");
          });
        } else {
          showToast("No camera found on this device", "error");
        }
      }).catch(err => {
        console.error("Error getting cameras:", err);
        if (err.name === 'NotAllowedError') {
          showToast("Camera permission denied. Please allow camera access.", "error");
        } else if (err.name === 'NotFoundError') {
          showToast("No camera found on this device", "error");
        } else {
          showToast("Unable to access camera. Please check your browser settings.", "error");
        }
      });
    } catch (initError) {
      console.error("Failed to initialize QR scanner:", initError);
      showToast("Failed to initialize QR scanner", "error");
    }
  }

  function onScanSuccess(decodedText, decodedResult) {
    try {
      console.log('🎯 QR Code scanned successfully:', decodedText.substring(0, 50) + '...');

      // Show immediate visual feedback
      const qrReader = document.getElementById('qr-reader');
      if (qrReader) {
        qrReader.style.border = '3px solid #10b981';
        qrReader.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)';

        // Add success overlay
        const successOverlay = document.createElement('div');
        successOverlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(16, 185, 129, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
          border-radius: 8px;
          z-index: 1000;
        `;
        successOverlay.innerHTML = '✅ QR Code Detected!';
        qrReader.style.position = 'relative';
        qrReader.appendChild(successOverlay);
      }

      // Stop scanning after successful scan
      if (html5QrCode) {
        html5QrCode.stop().then(() => {
          try {
            html5QrCode.clear();
          } catch (clearError) {
            console.warn("Failed to clear QR scanner:", clearError);
          }
        }).catch(err => {
          console.warn("Failed to stop QR scanner:", err);
        });
      }

      // Close modal after a brief delay to show success feedback
      setTimeout(() => {
        hideModal("#qrScanModal");

        // Process scanned employee data
        processScannedEmployee(decodedText);
      }, 800);

    } catch (processError) {
      console.error("Error processing scanned QR code:", processError);
      showToast("Failed to process QR code", "error");
      hideModal("#qrScanModal");
    }
  }
  function onScanSuccess(decodedText, decodedResult) {
    try {
      console.log('🎯 QR Code scanned successfully:', decodedText.substring(0, 50) + '...');

      // Show immediate visual feedback
      const qrReader = document.getElementById('qr-reader');
      if (qrReader) {
        qrReader.style.border = '3px solid #10b981';
        qrReader.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)';

        // Add success overlay
        const successOverlay = document.createElement('div');
        successOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(16, 185, 129, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        font-weight: bold;
        border-radius: 8px;
        z-index: 1000;
      `;
        successOverlay.innerHTML = '✅ QR Code Detected!';
        qrReader.style.position = 'relative';
        qrReader.appendChild(successOverlay);
      }

      // Stop scanning after successful scan
      if (html5QrCode) {
        html5QrCode.stop().then(() => {
          try {
            html5QrCode.clear();
          } catch (clearError) {
            console.warn("Failed to clear QR scanner:", clearError);
          }
        }).catch(err => {
          console.warn("Failed to stop QR scanner:", err);
        });
      }

      // Close modal after a brief delay to show success feedback
      setTimeout(async () => {
        hideModal("#qrScanModal");

        // 📸 Take webcam picture after QR scan success
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const video = document.createElement('video');
          video.srcObject = videoStream;
          await video.play();

          // Wait briefly for camera exposure
          await new Promise(resolve => setTimeout(resolve, 500));

          // Create canvas for snapshot
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Stop video stream
          videoStream.getTracks().forEach(track => track.stop());

          // Convert to downloadable image
          const imageDataUrl = canvas.toDataURL('image/jpeg');
          const a = document.createElement('a');

          const now = new Date();
          const formattedDate = now.toISOString().split("T")[0];
          const formattedTime = now.toLocaleTimeString("en-US", { hour12: false }).replace(/:/g, "-");

          // Get employee info (if available)
          let employeeName = "Unknown_Employee";
          try {
            const parsedData = decodedText.includes("employee:")
              ? decodedText.split(":")[1]
              : decodedText;
            const emp = employees.find(e => e.id.toString() === parsedData || e.email === parsedData);
            if (emp) employeeName = emp.name.replace(/\s+/g, "_");
          } catch (e) {
            console.warn("Employee name not found for filename:", e);
          }

          // Create filename format: Name_Date_Time.jpg
          a.href = imageDataUrl;
          a.download = `${employeeName}_${formattedDate}_${formattedTime}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          console.log(`📸 Picture captured and saved as: ${a.download}`);
        } catch (cameraError) {
          console.error("Camera capture failed:", cameraError);
        }

        // Process scanned employee data
        processScannedEmployee(decodedText);
      }, 800);

    } catch (processError) {
      console.error("Error processing scanned QR code:", processError);
      showToast("Failed to process QR code", "error");
      hideModal("#qrScanModal");
    }
  }

  function onScanFailure(error) {
    // Do nothing on failure, continue scanning
    // Optional: console.log(`QR scan failed: ${error}`)
  }

  function processScannedEmployee(scannedData) {
    console.log('📱 Processing scanned QR data:', scannedData.substring(0, 100) + '...');

    let employeeId = null;

    // Handle simple employee:id format
    if (scannedData.startsWith('employee:')) {
      employeeId = parseInt(scannedData.split(':')[1]);
      console.log('✅ Parsed employee QR code for employee ID:', employeeId);
    } else {
      // Try direct ID or email match as fallback
      const employee = employees.find(emp =>
        emp.email === scannedData ||
        emp.id.toString() === scannedData
      );
      if (employee) {
        employeeId = employee.id;
        console.log('✅ Found employee by direct match:', employee.name);
      }
    }

    if (employeeId) {
      const employee = employees.find(emp => emp.id === employeeId);
      if (employee) {
        console.log(`🎯 Processing QR scan for employee: ${employee.name} (ID: ${employee.id})`);

        // Check current employee status
        const today = new Date().toISOString().split('T')[0];
        const lastTimeIn = storage.get(`lastTimeIn_${employee.email}`);
        const lastTimeOut = storage.get(`lastTimeOut_${employee.email}`);
        const isClockedIn = lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today);

        // Select employee in the dropdown
        const employeeSelect = document.querySelector('#employeeSelect');
        if (employeeSelect) {
          employeeSelect.value = employee.id;
          handleEmployeeSelection();
        }

        // Automatically process clock in/out without confirmation
        const action = isClockedIn ? 'out' : 'in';
        const actionText = isClockedIn ? 'clocked out' : 'clocked in';

        if (isClockedIn) {
          console.log(`⏰ Employee ${employee.name} is clocked in - automatically clocking out`);
          handleEmployeeClockOut(employee.id);
        } else {
          console.log(`⏰ Employee ${employee.name} is not clocked in - automatically clocking in`);
          handleEmployeeClockIn(employee.id);
        }

        // Show detailed success modal
        showQRScanResultModal(employee, action, actionText);

        // Log QR scan activity
        if (window.auditLogger) {
          try {
            window.auditLogger.logTimeTracking(isClockedIn ? 'qr_clock_out' : 'qr_clock_in', {
              employeeId: employee.id,
              employeeName: employee.name,
              qrDataFormat: 'simple',
              qrData: `employee:${employee.id}`,
              timestamp: new Date().toISOString()
            });
          } catch (auditError) {
            console.warn('Audit logging failed:', auditError);
          }
        }
      } else {
        console.error('❌ Employee not found in database for ID:', employeeId);
        showToast("Employee not found for scanned QR code", "error");
      }
    } else {
      console.error('❌ Could not extract employee ID from QR data:', scannedData.substring(0, 50));
      showToast("Invalid QR code format - please scan a valid employee QR code", "error");
    }
  }

  // Day Off handlers
  function confirmDayOffAction(employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) { showToast('Employee not found', 'error'); return; }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; text-align: center;">
        <div class="modal-header">
          <h2>Confirm Day Off</h2>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <p style="color: #374151; margin: 15px 0;">
            Are you sure you want to mark <strong>${employee.name}</strong> as Day Off for today?
          </p>
        </div>
        <div class="modal-footer" style="padding: 15px; display: flex; gap: 10px; justify-content: center; border-top: 1px solid #e5e7eb;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="performDayOffAction(${employeeId}); this.closest('.modal').remove();">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  function performDayOffAction(employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) { showToast('Employee not found', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];
    // Create/Update attendance record as day_off
    let attendance = storage.get('attendance') || [];
    const rec = attendance.find(r => r.employeeEmail === employee.email && r.date === today);
    if (rec) {
      rec.status = 'day_off';
      delete rec.timeIn; delete rec.timeOut;
    } else {
      attendance.push({ employeeEmail: employee.email, employeeName: employee.name, date: today, status: 'day_off' });
    }
    storage.set('attendance', attendance);
    // Clear any active session
    activeSessions = activeSessions.filter(s => s.employeeId !== employeeId);
    storage.remove(`lastTimeIn_${employee.email}`);
    storage.remove(`lastTimeOut_${employee.email}`);
    storage.remove(`lastTimeInTime_${employee.email}`);
    storage.remove(`lastTimeOutTime_${employee.email}`);
    // Immediate UI update for the employee row
    const row = document.querySelector(`tr[data-employee-id="${employeeId}"]`);
    if (row) {
      const statusEl = row.querySelector('.employee-status');
      if (statusEl) {
        statusEl.textContent = 'Day Off';
        statusEl.className = 'employee-status status-day-off';
      }
      const inBtn = row.querySelector('.action-btn-in');
      const outBtn = row.querySelector('.action-btn-out');
      const dayBtn = Array.from(row.querySelectorAll('.action-btn')).find(b => b.textContent.trim().includes('Day Off'));
      if (inBtn) inBtn.disabled = true;
      if (outBtn) outBtn.disabled = true;
      if (dayBtn) dayBtn.disabled = true;
    }

    populateEmployeesTable();
    loadTodaysActivity();
    updateAttendanceOverview();
    showToast(`${employee.name} marked as Day Off`, 'success');
  }

  // Expose to global scope so inline onclick handlers can call it
  window.performDayOffAction = performDayOffAction;

  window.handleEmployeeDayOff = function (employeeId) {
    confirmDayOffAction(employeeId);
  };

  async function handleDayOff() {
    if (!selectedEmployeeId) return;
    window.handleEmployeeDayOff(selectedEmployeeId);
  }

  function handleTemporaryQRScan() {
    showToast("Temporary QR codes have been removed. Use static employee QR.", "warning");
  }

  function showClockActionModal(employee, isClockedIn, qrToken) {
    const modalHTML = `
      <div class="modal" id="clockActionModal" style="display: flex;">
        <div class="modal-content" style="max-width: 400px; text-align: center;">
          <div class="modal-header">
            <h2>Clock Action</h2>
            <button class="modal-close" onclick="closeClockActionModal()">&times;</button>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <div style="margin-bottom: 20px;">
              <h3 style="margin: 0; color: #2563eb;">${employee.name}</h3>
              <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">ID: ${employee.id.toString().padStart(3, "0")} | ${employee.position}</p>
            </div>

            <div style="margin: 20px 0;">
              <p style="color: #374151; margin-bottom: 15px;">Current Status: <strong>${isClockedIn ? 'Clocked In' : 'Not Clocked In'}</strong></p>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
              <button class="btn ${isClockedIn ? 'btn-secondary' : 'btn-primary'}"
                      id="clockInAction"
                      ${isClockedIn ? 'disabled' : ''}
                      onclick="performClockAction('in', '${qrToken}')">
                Clock In
              </button>
              <button class="btn ${!isClockedIn ? 'btn-secondary' : 'btn-primary'}"
                      id="clockOutAction"
                      ${!isClockedIn ? 'disabled' : ''}
                      onclick="performClockAction('out', '${qrToken}')">
                Clock Out
              </button>
            </div>

            <p style="color: #6b7280; font-size: 12px; margin-top: 15px;">
              ${isClockedIn ? 'Clock Out is available' : 'Clock In is available'}
            </p>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Global functions for clock action modal
  window.closeClockActionModal = function () {
    const modal = document.getElementById('clockActionModal');
    if (modal) modal.remove();
  };

  window.performClockAction = function (action, qrToken) {
    // Validate QR token again
    const qrData = validateTemporaryQR(qrToken);
    if (!qrData) {
      showToast("QR code has expired", "error");
      closeClockActionModal();
      return;
    }

    if (action === 'in') {
      handleClockIn();
    } else {
      handleClockOut();
    }

    // Clean up the temporary QR after use
    cleanupExpiredQR(qrData.employeeId);
    closeClockActionModal();
    showToast(`Successfully clocked ${action} via QR code`, "success");
  };

  async function handleTimeout() {
    const currentUser = storage.get("currentUser");
    if (!currentUser || currentUser.role !== "employee") {
      showToast("Only employees can use the timeout function", "error");
      return;
    }

    const timeoutBtn = $("#timeoutBtn");
    if (!timeoutBtn) {
      showToast("Timeout button not found", "error");
      return;
    }

    const originalText = timeoutBtn.innerHTML;

    try {
      // Check if employee is actually timed in
      const today = new Date().toISOString().split('T')[0];
      const lastTimeIn = storage.get(`lastTimeIn_${currentUser.email}`);
      const lastTimeOut = storage.get(`lastTimeOut_${currentUser.email}`);

      console.log(`Timeout attempt - User: ${currentUser.email}, Today: ${today}, LastTimeIn: ${lastTimeIn}, LastTimeOut: ${lastTimeOut}`);

      if (lastTimeIn !== today) {
        showToast("You haven't timed in today. Please clock in first.", "error");
        return;
      }

      if (lastTimeOut && lastTimeOut === today) {
        showToast("You have already timed out for today.", "warning");
        return;
      }

      // Show confirmation dialog
      const confirmed = confirm("Are you sure you want to end your shift? This will log you out of the system.");
      if (!confirmed) {
        return;
      }

      // Show loading state
      timeoutBtn.disabled = true;
      timeoutBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Ending Shift...
      `;

      console.log("Processing timeout for employee:", currentUser.email);


      // Store time out for today with precise timestamp
      const timeoutTimestamp = new Date().toISOString();
      storage.set(`lastTimeOut_${currentUser.email}`, today);
      storage.set(`lastTimeOutTime_${currentUser.email}`, timeoutTimestamp);

      // Update any attendance records
      let attendance = storage.get("attendance") || [];
      const attendanceRecord = attendance.find(record =>
        record.employeeEmail === currentUser.email && record.date === today
      );

      if (attendanceRecord) {
        attendanceRecord.timeOut = timeoutTimestamp;
        // Preserve original status from clock-in
        storage.set("attendance", attendance);
        console.log("Updated attendance record for timeout");
      } else {
        // Create a new attendance record if none exists
        const newRecord = {
          employeeEmail: currentUser.email,
          employeeName: currentUser.name,
          date: today,
          timeIn: storage.get(`lastTimeInTime_${currentUser.email}`) || timeoutTimestamp,
          timeOut: timeoutTimestamp,
          status: "present"
        };
        attendance.push(newRecord);
        storage.set("attendance", attendance);
        console.log("Created new attendance record for timeout");
      }

      // Remove from active sessions
      const employee = employees.find((emp) => emp.email === currentUser.email);
      if (employee) {
        activeSessions = activeSessions.filter(
          (session) => session.employeeId !== employee.id,
        );
        storage.set("activeSessions", activeSessions);
        console.log("Removed employee from active sessions");
      }

      showToast("Shift ended successfully! Have a great day!", "success");

      // Update UI to reflect timeout
      const clockInBtn = $("#clockInBtn");
      const clockOutBtn = $("#clockOutBtn");

      if (clockInBtn) clockInBtn.disabled = false;
      if (clockOutBtn) clockOutBtn.disabled = true;

      // Hide timeout button
      timeoutBtn.style.display = "none";

      // Clear authentication to require fresh login for security
      setTimeout(() => {
        storage.remove("authToken");
        storage.remove("currentUser");
        showToast("Logging out for security. Please login again tomorrow.", "info");
        navigate("login.html");
      }, 3000);
    } catch (error) {
      console.error("Timeout error:", error);
      showToast("Failed to end shift. Please try again.", "error");

      // Reset button state
      if (timeoutBtn) {
        timeoutBtn.innerHTML = originalText;
        timeoutBtn.disabled = false;
      }
    }
  }

  // QR Scanner functions are defined above handleTimeout


  function loadTodaysActivity() {
    loadActiveSessions();
    loadRecentActivity();
  }

  function loadActiveSessions() {
    const activeSessionsEl = $("#activeSessions");
    const activeSessionsCountEl = $("#activeSessionsCount");
    const currentUser = storage.get("currentUser");

    // Filter sessions based on user role
    let sessionsToShow = activeSessions;
    if (currentUser?.role === "employee") {
      // Find the current employee and show only their session
      const currentEmployee = employees.find((emp) => emp.email === currentUser.email);
      if (currentEmployee) {
        sessionsToShow = activeSessions.filter(session => session.employeeId === currentEmployee.id);
      } else {
        sessionsToShow = [];
      }
    }

    if (activeSessionsCountEl) {
      activeSessionsCountEl.textContent = sessionsToShow.length;
    }

    if (!activeSessionsEl) return;

    if (sessionsToShow.length === 0) {
      const emptyMessage = currentUser?.role === "employee"
        ? "You are not currently clocked in"
        : "No employees are currently clocked in";

      activeSessionsEl.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3>No Active Sessions</h3>
          <p>${emptyMessage}</p>
        </div>
      `;
      return;
    }

    activeSessionsEl.innerHTML = sessionsToShow
      .map((session) => {
        const employee = employees.find((emp) => emp.id === session.employeeId);
        if (!employee) return "";

        const duration = Date.now() - session.startTime.getTime();
        const attendanceStatus = session.attendanceStatus || "on-time";
        const statusBadge = attendanceStatus !== "on-time" ?
          `<span class="attendance-badge attendance-${attendanceStatus}">${attendanceStatus}</span>` : "";

        // For employees, show "You" instead of their name
        const displayName = (currentUser?.role === "employee" && employee.email === currentUser.email)
          ? "You"
          : employee.name;

        return `
          <div class="activity-item">
            <div class="activity-info">
              <div class="activity-name">${displayName} ${statusBadge}</div>
              <div class="activity-status">Working since ${formatTime(session.startTime)}</div>
            </div>
            <div class="activity-duration">${formatDuration(duration)}</div>
          </div>
        `;
      })
      .join("");
  }

  function loadRecentActivity() {
    const recentActivityEl = $("#recentActivity");
    const currentUser = storage.get("currentUser");
    if (!recentActivityEl) return;

    // For employees, show their own recent activity
    if (currentUser?.role === "employee") {
      const today = new Date().toISOString().split('T')[0];
      const lastTimeIn = storage.get(`lastTimeIn_${currentUser.email}`);
      const lastTimeOut = storage.get(`lastTimeOut_${currentUser.email}`);
      const lastTimeInTime = storage.get(`lastTimeInTime_${currentUser.email}`);
      const lastTimeOutTime = storage.get(`lastTimeOutTime_${currentUser.email}`);

      const myActivity = [];

      // Add time in activity if they timed in today
      if (lastTimeIn === today && lastTimeInTime) {
        myActivity.push({
          name: "You",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
          action: "Clocked in",
          time: new Date(lastTimeInTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }) + " (" + new Date(lastTimeInTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          }) + ")",
          timestamp: new Date(lastTimeInTime).getTime()
        });
      }

      // Add time out activity if they timed out today
      if (lastTimeOut === today && lastTimeOutTime) {
        myActivity.push({
          name: "You",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
          action: "Clocked out",
          time: new Date(lastTimeOutTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }) + " (" + new Date(lastTimeOutTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          }) + ")",
          timestamp: new Date(lastTimeOutTime).getTime()
        });
      }

      // Sort by timestamp (most recent first)
      myActivity.sort((a, b) => b.timestamp - a.timestamp);

      if (myActivity.length === 0) {
        recentActivityEl.innerHTML = `
          <div class="empty-state">
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0;">
              No activity recorded today
            </p>
          </div>
        `;
        return;
      }

      recentActivityEl.innerHTML = myActivity
        .map(
          (activity) => `
          <div class="activity-item">
            <div class="activity-info">
              <div class="activity-name">${activity.name}</div>
              <div class="activity-status">${activity.action}</div>
            </div>
            <div class="activity-time-badge">${activity.time}</div>
          </div>
        `,
        )
        .join("");
    } else {
      // For admin/front desk, show recent activity from all employees
      const today = new Date().toISOString().split('T')[0];
      const recentActivity = [];

      // Get real activity from all employees
      employees.forEach(employee => {
        const lastTimeIn = storage.get(`lastTimeIn_${employee.email}`);
        const lastTimeOut = storage.get(`lastTimeOut_${employee.email}`);
        const lastTimeInTime = storage.get(`lastTimeInTime_${employee.email}`);
        const lastTimeOutTime = storage.get(`lastTimeOutTime_${employee.email}`);

        // Add clock in activity if they clocked in today
        if (lastTimeIn === today && lastTimeInTime) {
          recentActivity.push({
            name: employee.name,
            avatar: employee.avatar || generateInitialsAvatar(employee.name.split(' ')[0], employee.name.split(' ')[1]),
            action: "Clocked in",
            time: new Date(lastTimeInTime).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }) + " (" + new Date(lastTimeInTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }) + ")",
            timestamp: new Date(lastTimeInTime).getTime()
          });
        }

        // Add clock out activity if they clocked out today
        if (lastTimeOut === today && lastTimeOutTime) {
          recentActivity.push({
            name: employee.name,
            avatar: employee.avatar || generateInitialsAvatar(employee.name.split(' ')[0], employee.name.split(' ')[1]),
            action: "Clocked out",
            time: new Date(lastTimeOutTime).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }) + " (" + new Date(lastTimeOutTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }) + ")",
            timestamp: new Date(lastTimeOutTime).getTime()
          });
        }
      });

      // Sort by timestamp (most recent first) and take only the latest 5
      recentActivity.sort((a, b) => b.timestamp - a.timestamp);
      const displayActivity = recentActivity.slice(0, 5);

      if (displayActivity.length === 0) {
        recentActivityEl.innerHTML = `
          <div class="empty-state">
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0;">
              No recent activity today
            </p>
          </div>
        `;
        return;
      }

      recentActivityEl.innerHTML = displayActivity
        .map(
          (activity) => `
          <div class="activity-item">
            <div class="activity-info">
              <div class="activity-name">${activity.name}</div>
              <div class="activity-status">${activity.action}</div>
            </div>
            <div class="activity-time-badge">${activity.time}</div>
          </div>
        `,
        )
        .join("");
    }
  }

  function updateAttendanceOverview() {
    const totalEmployees = employees.filter(
      (emp) => emp.status === "active",
    ).length;
    const presentCount = activeSessions.length;
    const lateCount = 0; // Will be calculated from actual data
    const today = new Date().toISOString().split('T')[0];
    const dayOffCount = (storage.get('attendance') || []).filter(r => r.date === today && r.status === 'day_off').length;
    const absentCount = Math.max(0, totalEmployees - presentCount - dayOffCount);
    const avgHours = "0.0"; // Will be calculated from actual data

    const presentCountEl = $("#presentCount");
    const lateCountEl = $("#lateCount");
    const absentCountEl = $("#absentCount");
    const avgHoursEl = $("#avgHours");

    if (presentCountEl) presentCountEl.textContent = presentCount;
    if (lateCountEl) lateCountEl.textContent = lateCount;
    if (absentCountEl) absentCountEl.textContent = absentCount;
    if (avgHoursEl) avgHoursEl.textContent = avgHours;
  }

  function handleActivityFilter() {
    loadTodaysActivity();
  }

  function handleExportActivity() {
    showToast("Exporting today's activity report...", "info");
    // In a real application, this would generate and download a report
  }

  function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
      storage.remove("authToken");
      storage.remove("currentUser");
      showToast("Logged out successfully", "info");
      setTimeout(() => navigate("login.html"), 1000);
    }
  }

  // Utility functions
  function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // Auto-refresh data every 30 seconds
  setInterval(function () {
    loadTodaysActivity();
    updateAttendanceOverview();
  }, 30 * 1000);

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Escape key to close modals
    if (e.key === "Escape") {
      hideQrScanner();
    }

    // Space to toggle clock in/out for selected employee
    if (e.code === "Space" && selectedEmployeeId) {
      e.preventDefault();
      const activeSession = activeSessions.find(
        (session) =>
          session.employeeId === selectedEmployeeId &&
          session.status === "active",
      );

      if (activeSession) {
        handleClockOut();
      } else {
        handleClockIn();
      }
    }

    // Ctrl/Cmd + Q for QR scanner
    if ((e.ctrlKey || e.metaKey) && e.key === "q") {
      e.preventDefault();
      showQrScanner();
    }
  });
});

// Employee-exclusive sidebar functionality
function setupEmployeeQuickActions(user) {
  const quickClockBtn = $("#employeeQuickClockBtn");
  const viewAttendanceBtn = $("#employeeViewAttendanceBtn");
  const showQRBtn = $("#employeeShowQRBtn");
  const quickClockButtonText = $("#quickClockButtonText");

  if (!quickClockBtn || !user) return;

  // Check current clock status
  function updateQuickClockButton() {
    const today = new Date().toISOString().split('T')[0];
    const lastTimeIn = storage.get(`lastTimeIn_${user.email}`);
    const lastTimeOut = storage.get(`lastTimeOut_${user.email}`);

    const isClockedIn = lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today);

    if (isClockedIn) {
      quickClockBtn.classList.add('clocked-in');
      quickClockButtonText.textContent = 'Quick Clock Out';
    } else {
      quickClockBtn.classList.remove('clocked-in');
      quickClockButtonText.textContent = 'Quick Clock In';
    }
  }

  // Quick clock in/out functionality
  quickClockBtn.addEventListener('click', async () => {
    const today = new Date().toISOString().split('T')[0];
    const lastTimeIn = storage.get(`lastTimeIn_${user.email}`);
    const lastTimeOut = storage.get(`lastTimeOut_${user.email}`);
    const isClockedIn = lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today);

    try {
      if (isClockedIn) {
        // Clock out using existing functionality
        await handleTimeout();
        showToast('Successfully clocked out!', 'success');
      } else {
        // Clock in using existing functionality
        await handleClockIn();
        showToast('Successfully clocked in!', 'success');
      }

      updateQuickClockButton();
      loadActiveSessions();
    } catch (error) {
      showToast('Clock operation failed. Please try again.', 'error');
      console.error('Quick clock operation failed:', error);
    }
  });

  // View attendance functionality
  if (viewAttendanceBtn) {
    viewAttendanceBtn.addEventListener('click', () => {
      const employee = employees.find(emp => emp.email === user.email);
      if (employee && typeof window.viewAttendance === 'function') {
        window.viewAttendance(employee.id);
      } else {
        showToast('Attendance view feature not available', 'info');
      }
    });
  }

  // Show QR functionality
  if (showQRBtn) {
    showQRBtn.addEventListener('click', () => {
      showEmployeeQrModal();
    });
  }

  // Initial button state update
  updateQuickClockButton();

  // Update button state periodically
  setInterval(updateQuickClockButton, 30000); // Every 30 seconds
}

// Static QR mode (no temporary tokens, no expiry)

function generateTemporaryQR(employeeId) {
  // Generate unique QR token
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const qrToken = `temp_${employeeId}_${timestamp}_${randomStr}`;

  // Set expiry time (15 minutes from now)
  const expiryTime = Date.now() + (15 * 60 * 1000);

  const qrData = {
    token: qrToken,
    employeeId: employeeId,
    createdAt: timestamp,
    expiresAt: expiryTime,
    isTemporary: true
  };

  // Store in global variable and localStorage for persistence
  currentEmployeeQR = qrData;
  storage.set(`tempQR_${employeeId}`, qrData);

  return qrData;
}

function validateTemporaryQR(token) {
  // Check if token exists and is still valid
  const parts = token.split('_');
  if (parts[0] !== 'temp' || parts.length !== 4) {
    return null;
  }

  const employeeId = parseInt(parts[1]);
  const storedQR = storage.get(`tempQR_${employeeId}`);

  if (!storedQR || storedQR.token !== token) {
    return null;
  }

  // Check expiry
  if (Date.now() > storedQR.expiresAt) {
    // Clean up expired QR
    storage.remove(`tempQR_${employeeId}`);
    return null;
  }

  return storedQR;
}

function cleanupExpiredQR(employeeId) {
  storage.remove(`tempQR_${employeeId}`);
  if (currentEmployeeQR && currentEmployeeQR.employeeId === employeeId) {
    currentEmployeeQR = null;
  }

  // Clear timers
  if (qrExpiryTimer) {
    clearTimeout(qrExpiryTimer);
    qrExpiryTimer = null;
  }
  if (qrCountdownTimer) {
    clearInterval(qrCountdownTimer);
    qrCountdownTimer = null;
  }
}

function showEmployeeQrModal() {
  const currentUser = storage.get("currentUser");
  if (!currentUser || currentUser.role !== "employee") {
    showToast("Only employees can view QR codes", "error");
    return;
  }

  const employee = employees.find(emp => emp.email === currentUser.email);
  if (!employee) {
    showToast("Employee record not found", "error");
    return;
  }

  // Show modal
  showModal("#employeeQrModal");

  const employeeQrName = $("#employeeQrName");
  const employeeQrInfo = $("#employeeQrInfo");
  if (employeeQrName) employeeQrName.textContent = employee.name;
  if (employeeQrInfo) employeeQrInfo.textContent = `ID: ${employee.id.toString().padStart(3, "0")} | ${employee.position}`;

  // Render static QR code (employee:<id>)
  generateAndDisplayQR(employee.id);
}

function hideEmployeeQrModal() {
  hideModal("#employeeQrModal");
  // Clean up timers but keep QR valid
  if (qrCountdownTimer) {
    clearInterval(qrCountdownTimer);
    qrCountdownTimer = null;
  }
}

function refreshEmployeeQR() {
  const currentUser = storage.get("currentUser");
  if (!currentUser) return;

  const employee = employees.find(emp => emp.email === currentUser.email);
  if (employee) {
    generateAndDisplayQR(employee.id);
    showToast("QR code refreshed", "success");
  }
}

function generateAndDisplayQR(employeeId) {
  const qrContainer = $("#employeeQrContainer");
  if (!qrContainer) return;

  // Show loading state
  qrContainer.innerHTML = `
      <div style="text-align: center;">
        <div style=\"width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;\"></div>
        <p style=\"color: #6b7280; font-size: 14px;\">Preparing QR code...</p>
      </div>
    `;

  const qrText = `employee:${employeeId}`;
  const qrCodeAvailable = typeof QRCode !== 'undefined' || window.QRCodeLoaded;

  setTimeout(() => {
    if (qrCodeAvailable) {
      qrContainer.innerHTML = '<div id="staticEmployeeQr"></div>';
      const qrDiv = $("#staticEmployeeQr");
      try {
        new QRCode(qrDiv, {
          text: qrText,
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff'
        });
      } catch (error) {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`;
        qrContainer.innerHTML = `<img src="${url}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #e5e7eb; border-radius: 8px;">`;
      }
    } else {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`;
      qrContainer.innerHTML = `<img src="${url}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #e5e7eb; border-radius: 8px;">`;
    }
  }, 300);
}

function displayQRCode(qrData) {
  const qrContainer = $("#employeeQrContainer");
  if (!qrContainer) return;

  // Check if QRCode library is available, with fallback
  const qrCodeAvailable = typeof QRCode !== 'undefined' || window.QRCodeLoaded;

  if (qrCodeAvailable) {
    // Generate QR using library
    qrContainer.innerHTML = '<div id="tempQrCode"></div>';
    const qrDiv = $("#tempQrCode");

    try {
      new QRCode(qrDiv, {
        text: qrData.token,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
    } catch (error) {
      console.warn('QR library failed, using fallback');
      displayQRFallback(qrData);
    }
  } else {
    displayQRFallback(qrData);
  }
}

function displayQRFallback(qrData) {
  const qrContainer = $("#employeeQrContainer");
  const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.token)}`;

  qrContainer.innerHTML = `
      <img src="${qrServiceUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #e5e7eb; border-radius: 8px;"
           onload="this.style.display='block';"
           onerror="this.outerHTML='<div style=\\'padding: 20px; background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px;\\'>QR service unavailable<br><small>${qrData.token}</small></div>';">
    `;
}

function startCountdown(expiryTime) {
  const qrTimer = $("#qrTimer");
  if (!qrTimer) return;

  qrCountdownTimer = setInterval(() => {
    const now = Date.now();
    const remaining = expiryTime - now;

    if (remaining <= 0) {
      qrTimer.textContent = "00:00";
      clearInterval(qrCountdownTimer);
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    qrTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Change color when less than 2 minutes
    if (remaining < 2 * 60 * 1000) {
      qrTimer.style.color = '#dc2626';
    } else {
      qrTimer.style.color = '#92400e';
    }
  }, 1000);
}

// QR Scan Result Modal
// Helper function to get employee portrait HTML
function getEmployeePortraitHTML(employeeId, employeeName) {
  try {
    // Try to get portrait from window function (from employees.js)
    if (typeof window.getEmployeePortrait === 'function') {
      const portrait = window.getEmployeePortrait(employeeId);
      if (portrait) {
        console.log(`📸 Using portrait for employee ${employeeId}`);
        return `<img src="${portrait}" alt="${employeeName}" style="width: 100%; height: 100%; object-fit: cover;" />`;
      }
    }

    // Fallback: try to retrieve directly from localStorage
    const portraitsKey = 'employee_portraits';
    const portraitsJSON = localStorage.getItem(portraitsKey);
    if (portraitsJSON) {
      try {
        const portraits = JSON.parse(portraitsJSON);
        const portrait = portraits[String(employeeId)];
        if (portrait) {
          console.log(`📸 Using portrait from localStorage for employee ${employeeId}`);
          return `<img src="${portrait}" alt="${employeeName}" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      } catch (e) {
        console.warn('Error parsing portraits from localStorage:', e);
      }
    }
  } catch (error) {
    console.warn(`Could not load portrait for employee ${employeeId}:`, error);
  }

  // Fallback to initials
  return `<span style="color: white; font-weight: bold; font-size: 24px;">${employeeName.charAt(0)}</span>`;
}

function showQRScanResultModal(employee, action, actionText) {
  const timestamp = new Date();
  const timeString = timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const dateString = timestamp.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const modalHTML = `
      <div class="modal" id="qrScanResultModal" style="display: flex;">
        <div class="modal-content" style="max-width: 450px; text-align: center;">
          <div class="modal-header" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 20px;">
            <h2 style="color: #10b981; margin: 0; display: flex; align-items: center; justify-content: center; gap: 10px;">
              <span style="font-size: 24px;">��</span>
              QR Scan Successful
            </h2>
          </div>
          <div class="modal-body" style="padding: 30px 20px;">
            <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; border: 2px solid #bbf7d0; margin-bottom: 25px;">
              <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; margin-right: 15px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); overflow: hidden; flex-shrink: 0;">
                  ${getEmployeePortraitHTML(employee.id, employee.name)}
                </div>
                <div style="text-align: left;">
                  <h3 style="margin: 0; color: #1f2937; font-size: 20px;">${employee.name}</h3>
                  <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 14px;">${employee.position}</p>
                  <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 12px;">ID: ${employee.id.toString().padStart(3, "0")}</p>
                </div>
              </div>

              <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #d1fae5;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                  <span style="font-size: 18px;">${action === 'in' ? '🕐' : '🕙'}</span>
                  <strong style="color: #059669; font-size: 16px;">Successfully ${actionText.toUpperCase()}</strong>
                </div>
                <p style="margin: 0; color: #374151; font-size: 14px;">
                  <strong>${timeString}</strong> on ${dateString}
                </p>
              </div>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #fbbf24; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">
                <strong>📱 QR Code Method:</strong> Employee automatically ${actionText} via QR scan
              </p>
            </div>

            <button class="btn btn-primary" onclick="closeQRScanResultModal()" style="width: 100%; padding: 12px;">
              Continue
            </button>
          </div>
        </div>
      </div>
    `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Auto-close after 5 seconds
  setTimeout(() => {
    closeQRScanResultModal();
  }, 5000);
}

// Global function to close QR scan result modal
window.closeQRScanResultModal = function () {
  const modal = document.getElementById('qrScanResultModal');
  if (modal) {
    modal.remove();
  }
};

// Make functions available globally for other modules
window.refreshEmployeeData = loadData;
window.refreshEmployeeSelect = populateEmployeeSelect;
window.showQRScanResultModal = showQRScanResultModal;

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
