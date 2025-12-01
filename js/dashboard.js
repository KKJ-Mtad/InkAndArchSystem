// Dashboard page functionality
document.addEventListener("DOMContentLoaded", function () {
  // Check authentication and prevent back button access after logout
  checkAuthAndPreventBackAccess();

  // Check authentication
  const token = storage.get("authToken");
  if (!token) {
    navigate("login.html");
    return;
  }

  // Initialize dashboard
  initializeDashboard();
  setupEventListeners();

  // Test server connectivity before loading data
  if (typeof API_CONFIG !== 'undefined') {
    API_CONFIG.testConnection().then(connected => {
      if (connected) {
        console.log('✅ Server connection verified, loading dashboard data...');
      } else {
        console.warn('⚠️ Server connection failed, using fallback data...');
      }
      loadDashboardData();
      checkInventoryAlerts();
    }).catch(() => {
      console.warn('⚠️ Server connectivity test failed, proceeding with fallback...');
      loadDashboardData();
      checkInventoryAlerts();
    });
  } else {
    console.warn('⚠️ API_CONFIG not available, loading data with original method...');
    loadDashboardData();
    checkInventoryAlerts();
  }

  function initializeDashboard() {
    // Set current date
    const currentDateElement = $("#currentDate");
    if (currentDateElement) {
      const now = new Date();
      currentDateElement.textContent = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // Set last updated time
    const lastUpdatedElement = $("#lastUpdated");
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = formatTime(new Date());
    }

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

    // Apply role-based access restrictions
    applyRoleBasedAccess(currentUser);
  }

  function applyRoleBasedAccess(user) {
    if (!user) return;

    // If employee, hide restricted sidebar items and dashboard sections
    if (user.role === "employee") {
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

      // Hide admin-specific dashboard sections for employees
      const inventoryAlerts = $("#inventoryAlerts");
      const inventoryCard = $(".inventory-alerts");
      const analyticsCard = $(".analytics-section");
      const employeeCard = $(".employee-overview");

      // Hide inventory-related elements
      if (inventoryAlerts) inventoryAlerts.style.display = "none";
      if (inventoryCard) inventoryCard.style.display = "none";
      if (analyticsCard) analyticsCard.style.display = "none";
      if (employeeCard) employeeCard.style.display = "none";

      // Hide entire quick actions section for employees
      const quickActionsSection = document.querySelector(".quick-actions-section");
      if (quickActionsSection) {
        quickActionsSection.style.display = "none";
      }
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

    // Show audit logs for admin only
    const logsNavItem = $("#logsNavItem");
    if (logsNavItem) {
      if (user.role === "admin") {
        logsNavItem.style.display = "flex";
      } else {
        logsNavItem.style.display = "none";
      }
    }
  }

  function setupEventListeners() {
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

    // Update time every minute
    setInterval(function () {
      const lastUpdatedElement = $("#lastUpdated");
      if (lastUpdatedElement) {
        lastUpdatedElement.textContent = formatTime(new Date());
      }
    }, 60000);

    // Inventory alert dropdown
    const inventoryAlertBtn = $("#inventoryAlertBtn");
    const alertDropdown = $("#alertDropdown");

    if (inventoryAlertBtn) {
      inventoryAlertBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        if (alertDropdown) {
          alertDropdown.classList.toggle("show");
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener("click", function(e) {
      if (alertDropdown && !alertDropdown.contains(e.target) && !inventoryAlertBtn.contains(e.target)) {
        alertDropdown.classList.remove("show");
      }
    });

    // Settings panel
    const settingsTrigger = $("#settingsTrigger");
    const settingsPanel = $("#settingsPanel");
    const settingsOverlay = $("#settingsOverlay");
    const settingsClose = $("#settingsClose");

    if (settingsTrigger) {
      settingsTrigger.addEventListener("click", () => {
        settingsPanel.classList.add("open");
        settingsOverlay.classList.add("open");
      });
    }

    if (settingsClose) {
      settingsClose.addEventListener("click", () => {
        settingsPanel.classList.remove("open");
        settingsOverlay.classList.remove("open");
      });
    }

    if (settingsOverlay) {
      settingsOverlay.addEventListener("click", () => {
        settingsPanel.classList.remove("open");
        settingsOverlay.classList.remove("open");
      });
    }
  }

  async function loadDashboardData() {
    try {
      // Show loading state
      showLoadingStates();

      // Load employees data from server
      const empResponse = await API_CONFIG.apiCall('/api/employees');
      const employees = empResponse.ok ? await empResponse.json() : [];

      // Load today's time entries from server (fallback handled below)
      let todayEntries = [];
      try {
        const ttResponse = await API_CONFIG.apiCall('/api/timetracking/today');
        if (ttResponse.ok) {
          todayEntries = await ttResponse.json();
        }
      } catch (e) {
        console.warn('Failed to load today\'s entries, using fallback:', e.message);
      }

      // Update statistics using real time entries when available
      updateStatistics(employees, todayEntries);

      // Load recent activity (prefer server entries)
      await loadRecentActivity(todayEntries);

      // Load employee status
      loadEmployeeStatus(employees);
    } catch (error) {
      showToast("Failed to load dashboard data", "error");
      console.error("Dashboard data loading error:", error);
    }
  }

  function showLoadingStates() {
    // Show loading for stats
    ["totalEmployees", "presentToday", "onLeave", "absent"].forEach((id) => {
      const element = $(`#${id}`);
      if (element) {
        element.innerHTML = '<div class="loading-placeholder"></div>';
      }
    });

    // Show loading for activity sections
    const recentClockIns = $("#recentClockIns");
    const employeeStatus = $("#employeeStatus");

    if (recentClockIns) {
      showLoading(recentClockIns);
    }

    if (employeeStatus) {
      showLoading(employeeStatus);
    }
  }

  function updateStatistics(employees, todayEntries = []) {
    const stats = calculateDashboardStats(employees, todayEntries);

    // Update DOM elements
    const totalEmployeesEl = $("#totalEmployees");
    const presentTodayEl = $("#presentToday");
    const onLeaveEl = $("#onLeave");
    const absentEl = $("#absent");

    if (totalEmployeesEl) totalEmployeesEl.textContent = stats.total;
    if (presentTodayEl) presentTodayEl.textContent = stats.present;
    if (onLeaveEl) onLeaveEl.textContent = stats.onLeave;
    if (absentEl) absentEl.textContent = stats.absent;
  }

  function calculateDashboardStats(employees, todayEntries = []) {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(emp => emp.status === 'active').length;

    // Present today: unique employees with a time entry today
    const presentSet = new Set();
    (todayEntries || []).forEach(entry => {
      if (entry && (entry.clock_in || entry.clock_out) && entry.employee_id) {
        presentSet.add(entry.employee_id);
      }
    });
    const present = presentSet.size || 0;

    // On Leave/Day Off from attendance records stored locally
    const today = new Date().toISOString().split('T')[0];
    const attendanceRecords = storage.get('attendance') || [];
    const onLeave = attendanceRecords.filter(r => r.date === today && (r.status === 'day_off' || r.status === 'leave')).length;

    // Absent = active employees - present - onLeave (min 0)
    const absent = Math.max(0, activeEmployees - present - onLeave);

    return { total: totalEmployees, present, onLeave, absent };
  }

  async function loadRecentActivity(todayEntries) {
    const recentClockIns = $("#recentClockIns");
    if (!recentClockIns) return;

    try {
      const recentActivity = [];

      if (Array.isArray(todayEntries) && todayEntries.length > 0) {
        // Build from server-provided time entries
        todayEntries.forEach(entry => {
          const name = entry.employee_name || 'Unknown';
          const parts = (name || '').split(' ');
          const avatar = entry.employee_avatar || generateInitialsAvatar(parts[0] || 'U', parts[1] || 'N');

          if (entry.clock_in) {
            const ts = new Date(entry.clock_in).getTime();
            recentActivity.push({
              id: `${entry.id}_in`,
              name,
              avatar,
              action: 'Clocked in',
              time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              timestamp: ts,
              isYesterday: false
            });
          }
          if (entry.clock_out) {
            const ts = new Date(entry.clock_out).getTime();
            recentActivity.push({
              id: `${entry.id}_out`,
              name,
              avatar,
              action: 'Clocked out',
              time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              timestamp: ts,
              isYesterday: false
            });
          }
        });
      } else {
        // Fallback: infer from local storage marks
        const employees = await fetchEmployees();
        const today = new Date().toISOString().split('T')[0];
        employees.forEach(employee => {
          const lastTimeIn = storage.get(`lastTimeIn_${employee.email}`);
          const lastTimeOut = storage.get(`lastTimeOut_${employee.email}`);
          const lastTimeInTime = storage.get(`lastTimeInTime_${employee.email}`);
          const lastTimeOutTime = storage.get(`lastTimeOutTime_${employee.email}`);

          if (lastTimeIn === today && lastTimeInTime) {
            const ts = new Date(lastTimeInTime).getTime();
            recentActivity.push({
              id: `${employee.id}_in`,
              name: employee.name,
              avatar: employee.avatar || generateInitialsAvatar(employee.name.split(' ')[0], employee.name.split(' ')[1]),
              action: 'Clocked in',
              time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              timestamp: ts,
              isYesterday: false
            });
          }
          if (lastTimeOut === today && lastTimeOutTime) {
            const ts = new Date(lastTimeOutTime).getTime();
            recentActivity.push({
              id: `${employee.id}_out`,
              name: employee.name,
              avatar: employee.avatar || generateInitialsAvatar(employee.name.split(' ')[0], employee.name.split(' ')[1]),
              action: 'Clocked out',
              time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              timestamp: ts,
              isYesterday: false
            });
          }
        });
      }

      // Sort by timestamp and take top 4
      recentActivity.sort((a, b) => b.timestamp - a.timestamp);
      const displayActivity = recentActivity.slice(0, 4);

      if (displayActivity.length === 0) {
        recentClockIns.innerHTML = `
          <div class="empty-state">
            <p>No recent activity today</p>
          </div>
        `;
        return;
      }

      recentClockIns.innerHTML = displayActivity
        .map(activity => `
        <div class="activity-item">
          <div class="activity-info">
            <div class="activity-name">${activity.name}</div>
            <div class="activity-details">${activity.action}</div>
          </div>
          <div class="activity-time-badge">
            ${activity.isYesterday ? 'Yesterday ' : ''}${activity.time}
          </div>
        </div>
      `)
        .join('');
    } catch (error) {
      recentClockIns.innerHTML = `
        <div class="empty-state">
          <p>No recent activity found</p>
        </div>
      `;
    }
  }

  function loadEmployeeStatus(employees) {
    const employeeStatusEl = $("#employeeStatus");
    if (!employeeStatusEl) return;

    if (employees.length === 0) {
      employeeStatusEl.innerHTML = `
        <div class="empty-state">
          <p>No employees found</p>
        </div>
      `;
      return;
    }

    employeeStatusEl.innerHTML = employees
      .slice(0, 5) // Show only first 5 employees
      .map(
        (employee) => `
      <div class="employee-status-item">
        <div class="employee-status-info">
          <div class="employee-status-name">${employee.name}</div>
          <div class="employee-status-position">${employee.position}</div>
        </div>
        <div class="employee-status-badge badge badge-${employee.status === "active" ? "active" : employee.status === "leave" ? "leave" : "inactive"}">
          ${employee.status === "active" ? "Active" : employee.status === "leave" ? "On Leave" : "Inactive"}
        </div>
      </div>
    `,
      )
      .join("");
  }

  async function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
      // Get current user for logging before clearing
      const currentUser = storage.get("currentUser");
      const loginTime = storage.get("loginTime");
      const sessionDuration = loginTime ? Date.now() - loginTime : null;

      // Log logout activity
      if (window.auditLogger && currentUser) {
        await window.auditLogger.logUser('logout', {
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
          sessionDuration: sessionDuration
        });
      }

      // Clear authentication data
      storage.remove("authToken");
      storage.remove("currentUser");
      storage.remove("loginTime");

      // Show logout message
      showToast("Logged out successfully", "info");

      // Prevent back button access after logout
      if (typeof preventBackAfterLogout === 'function') {
        preventBackAfterLogout();
      }

      // Redirect to login page
      setTimeout(() => {
        navigate("login.html");
      }, 1000);
    }
  }

  // Helper function to fetch employees
  async function fetchEmployees() {
    try {
      const response = await API_CONFIG.apiCall('/api/employees');
      if (response.ok) {
        const employees = await response.json();
        return employees.map(emp => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          position: emp.position,
          status: emp.status,
          avatar: emp.avatar || generateInitialsAvatar(emp.name.split(' ')[0], emp.name.split(' ')[1])
        }));
      } else {
        // Fallback to localStorage
        return storage.get("employees") || [];
      }
    } catch (error) {
      console.warn('Error fetching employees:', error);
      return storage.get("employees") || [];
    }
  }

  // Auto-refresh dashboard data every 5 minutes
  setInterval(
    function () {
      loadDashboardData();
    },
    5 * 60 * 1000,
  );

  // Add click handlers for stat cards
  const statCards = $$(".stat-card");
  statCards.forEach((card, index) => {
    card.style.cursor = "pointer";
    card.addEventListener("click", function () {
      const routes = [
        "employees.html",
        "employees.html?filter=present",
        "employees.html?filter=leave",
        "employees.html?filter=absent",
      ];
      navigate(routes[index] || "employees.html");
    });
  });

  // Add hover effects for interactive elements
  const activityItems = $$(".activity-item");
  activityItems.forEach((item) => {
    item.style.cursor = "pointer";
    item.addEventListener("click", function () {
      showToast("Employee details feature coming soon!", "info");
    });
  });

  const employeeStatusItems = $$(".employee-status-item");
  employeeStatusItems.forEach((item) => {
    item.style.cursor = "pointer";
    item.addEventListener("click", function () {
      const employeeName = item.querySelector(
        ".employee-status-name",
      ).textContent;
      showToast(`${employeeName} profile feature coming soon!`, "info");
    });
  });

  // Handle sidebar navigation highlighting
  const currentPage = window.location.pathname.split("/").pop();
  const sidebarItems = $$(".sidebar-item");
  sidebarItems.forEach((item) => {
    const href = item.getAttribute("href");
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Add keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Ctrl/Cmd + K for quick navigation
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      showToast("Quick navigation feature coming soon!", "info");
    }

    // Ctrl/Cmd + R for refresh
    if ((e.ctrlKey || e.metaKey) && e.key === "r") {
      e.preventDefault();
      loadDashboardData();
      showToast("Dashboard refreshed", "success");
    }
  });

  // Performance monitoring
  const pageLoadTime = performance.now();
  console.log(`Dashboard loaded in ${pageLoadTime.toFixed(2)}ms`);

  // Add visual feedback for loaded state
  setTimeout(() => {
    document.body.classList.add("loaded");
  }, 100);

  async function checkInventoryAlerts() {
    // Load inventory data from database first, fallback to storage
    let inventory = [];
    try {
      const response = await API_CONFIG.apiCall('/api/inventory');
      if (response.ok) {
        inventory = await response.json();
      } else {
        throw new Error('Database unavailable');
      }
    } catch (error) {
      console.warn('Loading inventory from localStorage fallback:', error.message);
      inventory = storage.get("inventory") || [];
    }

    // Current date for expiry comparisons
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);

    // Filter different types of alerts
    const outOfStockItems = inventory.filter(item => item.quantity === 0);
    const lowStockItems = inventory.filter(item =>
      item.quantity <= item.min_quantity && item.quantity > 0
    );

    // Expiry date alerts
    const expiredItems = inventory.filter(item => {
      if (!item.expiry_date) return false;
      const expiryDate = new Date(item.expiry_date);
      return expiryDate < today;
    });

    const expiringSoonItems = inventory.filter(item => {
      if (!item.expiry_date) return false;
      const expiryDate = new Date(item.expiry_date);
      return expiryDate >= today && expiryDate <= nextWeek;
    });

    const expiringThisMonthItems = inventory.filter(item => {
      if (!item.expiry_date) return false;
      const expiryDate = new Date(item.expiry_date);
      return expiryDate > nextWeek && expiryDate <= nextMonth;
    });

    // Combine all alerts with priority (expired, out of stock, expiring soon, low stock, expiring this month)
    const allAlerts = [
      ...expiredItems.map(item => ({ ...item, alertType: 'expired', priority: 1 })),
      ...outOfStockItems.map(item => ({ ...item, alertType: 'out_of_stock', priority: 2 })),
      ...expiringSoonItems.map(item => ({ ...item, alertType: 'expiring_soon', priority: 3 })),
      ...lowStockItems.map(item => ({ ...item, alertType: 'low_stock', priority: 4 })),
      ...expiringThisMonthItems.map(item => ({ ...item, alertType: 'expiring_month', priority: 5 }))
    ];

    // Remove duplicates (item might have multiple alert types)
    const uniqueAlerts = allAlerts.filter((alert, index, self) =>
      index === self.findIndex(a => a.id === alert.id && a.alertType === alert.alertType)
    );

    // Sort by priority
    uniqueAlerts.sort((a, b) => a.priority - b.priority);

    // Update UI
    const inventoryAlertsEl = $("#inventoryAlerts");
    const alertCountEl = $("#alertCount");
    const alertDropdownEl = $("#alertDropdown");

    if (uniqueAlerts.length > 0) {
      // Show alerts section
      if (inventoryAlertsEl) {
        inventoryAlertsEl.style.display = "block";
      }

      // Update alert count
      if (alertCountEl) {
        alertCountEl.textContent = uniqueAlerts.length;

        // Add pulsing animation for critical alerts
        const hasCriticalAlerts = uniqueAlerts.some(alert =>
          alert.alertType === 'expired' || alert.alertType === 'out_of_stock'
        );

        if (hasCriticalAlerts) {
          alertCountEl.classList.add('critical-alert');
        } else {
          alertCountEl.classList.remove('critical-alert');
        }
      }

      // Populate dropdown
      if (alertDropdownEl) {
        let dropdownHTML = `
          <div class="alert-dropdown-header">
            Inventory Alerts (${uniqueAlerts.length})
          </div>
        `;

        uniqueAlerts.forEach(item => {
          const alertInfo = getAlertInfo(item);
          dropdownHTML += `
            <div class="alert-dropdown-item ${alertInfo.cssClass}" onclick="navigate('inventory.html')">
              <div class="alert-item-header">
                <div class="alert-item-name">${item.name}</div>
                <div class="alert-item-status ${alertInfo.cssClass}">
                  ${alertInfo.status}
                </div>
              </div>
              <div class="alert-item-details">
                ${alertInfo.details}
              </div>
            </div>
          `;
        });

        dropdownHTML += `
          <div class="alert-dropdown-footer">
            <a href="inventory.html" class="alert-dropdown-link">
              View All Inventory ���
            </a>
          </div>
        `;

        alertDropdownEl.innerHTML = dropdownHTML;
      }
    } else {
      // Hide alerts section if no alerts
      if (inventoryAlertsEl) {
        inventoryAlertsEl.style.display = "none";
      }
      if (alertCountEl) {
        alertCountEl.classList.remove('critical-alert');
      }
    }
  }

  // Helper function to get alert information
  function getAlertInfo(item) {
    switch (item.alertType) {
      case 'expired':
        return {
          status: 'EXPIRED',
          cssClass: 'alert-expired',
          details: `Expired on ${formatDate(item.expiry_date)} | Qty: ${item.quantity} ${item.unit || ''}`
        };
      case 'out_of_stock':
        return {
          status: 'OUT OF STOCK',
          cssClass: 'alert-critical',
          details: `Current: 0 ${item.unit || ''} | Min: ${item.min_quantity || 'N/A'} ${item.unit || ''}`
        };
      case 'expiring_soon':
        return {
          status: 'EXPIRING SOON',
          cssClass: 'alert-warning',
          details: `Expires ${formatDate(item.expiry_date)} | Qty: ${item.quantity} ${item.unit || ''}`
        };
      case 'low_stock':
        return {
          status: 'LOW STOCK',
          cssClass: 'alert-warning',
          details: `Current: ${item.quantity} ${item.unit || ''} | Min: ${item.min_quantity || 'N/A'} ${item.unit || ''}`
        };
      case 'expiring_month':
        return {
          status: 'EXPIRING THIS MONTH',
          cssClass: 'alert-info',
          details: `Expires ${formatDate(item.expiry_date)} | Qty: ${item.quantity} ${item.unit || ''}`
        };
      default:
        return {
          status: 'ALERT',
          cssClass: 'alert-info',
          details: `Qty: ${item.quantity} ${item.unit || ''}`
        };
    }
  }

  // Helper function to format dates
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Check alerts every 30 seconds
  setInterval(checkInventoryAlerts, 30000);
});

// Utility functions for dashboard
function formatStatValue(value) {
  return new Intl.NumberFormat().format(value);
}

function calculatePercentage(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Export Modal Functions
function openExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Close modal when clicking overlay
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeExportModal();
      }
    });
  }
});

// Export module data (patients, inventory, employees)
async function exportModuleData(moduleType) {
  try {
    showToast(`Preparing ${moduleType} data export...`, 'info');

    let data = [];
    let filename = '';

    if (moduleType === 'patients') {
      const response = await API_CONFIG.apiCall('/api/patients');
      if (response.ok) {
        data = await response.json();
        filename = `patients_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        data = storage.get('patients') || [];
        filename = `patients_${new Date().toISOString().split('T')[0]}.csv`;
      }

      if (data.length === 0) {
        showToast('No patient data to export', 'warning');
        return;
      }

      const csvContent = convertToCSV(data, [
        'id', 'name', 'email', 'mobile', 'address',
        'date_of_birth', 'status', 'registration_date'
      ]);
      downloadCSV(csvContent, filename);

    } else if (moduleType === 'inventory') {
      const response = await API_CONFIG.apiCall('/api/inventory');
      if (response.ok) {
        data = await response.json();
        filename = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        data = storage.get('inventory') || [];
        filename = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
      }

      if (data.length === 0) {
        showToast('No inventory data to export', 'warning');
        return;
      }

      const csvContent = convertToCSV(data, [
        'id', 'name', 'category', 'quantity', 'min_quantity',
        'unit', 'description', 'expiry_date', 'supplier',
        'platform', 'purchase_cost', 'date_received'
      ]);
      downloadCSV(csvContent, filename);

    } else if (moduleType === 'employees') {
      const response = await API_CONFIG.apiCall('/api/employees');
      if (response.ok) {
        data = await response.json();
        filename = `employees_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        data = storage.get('employees') || [];
        filename = `employees_${new Date().toISOString().split('T')[0]}.csv`;
      }

      if (data.length === 0) {
        showToast('No employee data to export', 'warning');
        return;
      }

      const csvContent = convertToCSV(data, [
        'id', 'name', 'email', 'position', 'status', 'created_at', 'updated_at'
      ]);
      downloadCSV(csvContent, filename);
    }

    closeExportModal();
    showToast(`${moduleType.charAt(0).toUpperCase() + moduleType.slice(1)} data exported successfully!`, 'success');

  } catch (error) {
    console.error('Export error:', error);
    showToast('Failed to export data. Please try again.', 'error');
  }
}

// Export complete database backup
async function exportDatabaseBackup() {
  try {
    showToast('Preparing database backup...', 'info');

    const response = await API_CONFIG.apiCall('/api/backup-database', {
      method: 'POST'
    });

    if (response.ok) {
      const result = await response.json();

      // Fetch all data from the API to create comprehensive backup
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        system: 'Ink and Arch',
        patients: [],
        inventory: [],
        employees: [],
        appointments: [],
        backup_info: result
      };

      try {
        const patientsRes = await API_CONFIG.apiCall('/api/patients');
        if (patientsRes.ok) {
          backupData.patients = await patientsRes.json();
        }
      } catch (e) {
        console.warn('Could not fetch patients:', e);
      }

      try {
        const inventoryRes = await API_CONFIG.apiCall('/api/inventory');
        if (inventoryRes.ok) {
          backupData.inventory = await inventoryRes.json();
        }
      } catch (e) {
        console.warn('Could not fetch inventory:', e);
      }

      try {
        const employeesRes = await API_CONFIG.apiCall('/api/employees');
        if (employeesRes.ok) {
          backupData.employees = await employeesRes.json();
        }
      } catch (e) {
        console.warn('Could not fetch employees:', e);
      }

      try {
        const appointmentsRes = await API_CONFIG.apiCall('/api/appointments');
        if (appointmentsRes.ok) {
          backupData.appointments = await appointmentsRes.json();
        }
      } catch (e) {
        console.warn('Could not fetch appointments:', e);
      }

      // Convert to JSON and download
      const jsonString = JSON.stringify(backupData, null, 2);
      const filename = `database_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;

      downloadFile(jsonString, filename, 'application/json');

      closeExportModal();
      showToast('Database backup exported successfully! File: ' + filename, 'success');

    } else {
      throw new Error('Backup creation failed');
    }

  } catch (error) {
    console.error('Backup export error:', error);
    showToast('Failed to export database backup. Please try again.', 'error');
  }
}

// Helper function to convert data to CSV
function convertToCSV(data, columns) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  // Create header row
  const header = columns.map(col => `"${col}"`).join(',');

  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col] || '';
      // Escape quotes and wrap in quotes if contains comma or quote
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

// Helper function to download CSV
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

// Helper function to download file
function downloadFile(content, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

// Helper function to trigger download
function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatStatValue,
    calculatePercentage,
    getTimeAgo,
    exportModuleData,
    exportDatabaseBackup
  };
}
