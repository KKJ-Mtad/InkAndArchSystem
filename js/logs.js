// Audit Logs Page Functionality
document.addEventListener("DOMContentLoaded", function () {
  // Check authentication and prevent back button access after logout
  checkAuthAndPreventBackAccess();

  // Check authentication and permissions
  const currentUser = storage.get("currentUser");
  if (!currentUser) {
    navigate("login.html");
    return;
  }

  // Check if user has permission to view logs (only Admin)
  if (currentUser.role !== "admin") {
    showToast("Access denied. Only administrators can access audit logs.", "error");
    setTimeout(() => navigate("dashboard.html"), 2000);
    return;
  }

  // Initialize page
  updateUserInfo();
  setupEventListeners();
  setupMobileSidebar();
  loadInitialData();
  // Settings panel not needed on audit logs page

  // Current filters
  let currentFilters = {};
  let allLogs = [];

  function updateUserInfo() {
    const userNameEl = $("#userName");
    const userRoleEl = $("#userRole");
    const userAvatarEl = $("#userAvatar");

    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userRoleEl) {
      const roleMap = { admin: "Administrator", front_desk: "Front Desk", employee: "Employee" };
      userRoleEl.textContent = roleMap[currentUser.role] || currentUser.role;
    }
    if (userAvatarEl && currentUser.avatar) {
      userAvatarEl.src = currentUser.avatar;
    }
  }

  function setupEventListeners() {
    // Logout functionality
    const logoutBtn = $("#logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }

    // Refresh logs
    const refreshBtn = $("#refreshLogsBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", refreshLogs);
    }

    // Export logs
    const exportBtn = $("#exportLogsBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", exportLogs);
    }

    // Filter controls
    const applyFiltersBtn = $("#applyFiltersBtn");
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener("click", applyFilters);
    }

    const clearFiltersBtn = $("#clearFiltersBtn");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", clearFilters);
    }

    // Modal controls
    const closeModalBtn = $("#closeLogDetailsModal");
    const closeDetailBtn = $("#closeLogDetails");
    
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", hideLogDetailsModal);
    }
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener("click", hideLogDetailsModal);
    }

    // Real-time log updates
    document.addEventListener('auditLog', function(event) {
      const newLog = event.detail;
      allLogs.unshift(newLog); // Add to beginning
      refreshLogsDisplay();
    });
  }

  function setupMobileSidebar() {
    const mobileToggle = $("#mobileMenuToggle");
    const sidebar = $("#sidebar");

    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener("click", function () {
        sidebar.classList.toggle("open");
      });

      // Close sidebar when clicking outside on mobile
      document.addEventListener("click", function (e) {
        if (window.innerWidth <= 768) {
          if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
            sidebar.classList.remove("open");
          }
        }
      });
    }
  }

  async function loadInitialData() {
    showLoadingState(true);
    
    try {
      // Load audit logs
      if (window.auditLogger) {
        allLogs = await window.auditLogger.getLogs();
      }
      
      // Populate user filter
      populateUserFilter();
      
      // Set default date range (last 30 days)
      setDefaultDateRange();
      
      // Display logs
      refreshLogsDisplay();
      
    } catch (error) {
      console.error("Failed to load logs:", error);
      showToast("Failed to load audit logs", "error");
    } finally {
      showLoadingState(false);
    }
  }

  function populateUserFilter() {
    const userFilter = $("#userFilter");
    if (!userFilter) return;

    // Get unique users from logs
    const users = [...new Set(allLogs.map(log => log.userId))].filter(Boolean);
    
    // Clear existing options except first one
    while (userFilter.children.length > 1) {
      userFilter.removeChild(userFilter.lastChild);
    }

    // Add user options
    users.forEach(userId => {
      const log = allLogs.find(l => l.userId === userId);
      if (log) {
        const option = document.createElement("option");
        option.value = userId;
        option.textContent = `${log.userName} (${log.userRole})`;
        userFilter.appendChild(option);
      }
    });
  }

  function setDefaultDateRange() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const startDateInput = $("#startDate");
    const endDateInput = $("#endDate");

    if (startDateInput) {
      startDateInput.value = startDate.toISOString().split('T')[0];
    }
    if (endDateInput) {
      endDateInput.value = endDate.toISOString().split('T')[0];
    }
  }

  async function refreshLogs() {
    const refreshBtn = $("#refreshLogsBtn");
    const originalText = refreshBtn.innerHTML;
    
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
      Refreshing...
    `;

    try {
      if (window.auditLogger) {
        allLogs = await window.auditLogger.getLogs();
        populateUserFilter();
        refreshLogsDisplay();
        showToast("Logs refreshed successfully", "success");
      }
    } catch (error) {
      console.error("Failed to refresh logs:", error);
      showToast("Failed to refresh logs", "error");
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = originalText;
    }
  }

  async function exportLogs() {
    const exportBtn = $("#exportLogsBtn");
    const originalText = exportBtn.innerHTML;
    
    exportBtn.disabled = true;
    exportBtn.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
      Exporting...
    `;

    try {
      if (window.auditLogger) {
        const result = await window.auditLogger.exportLogs(currentFilters, 'csv');
        if (result.success) {
          showToast(`Exported ${result.recordCount} log entries to ${result.filename}`, "success");
        } else {
          showToast("Failed to export logs: " + result.error, "error");
        }
      }
    } catch (error) {
      console.error("Failed to export logs:", error);
      showToast("Failed to export logs", "error");
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalText;
    }
  }

  function applyFilters() {
    const typeFilter = $("#typeFilter");
    const actionFilter = $("#actionFilter");
    const userFilter = $("#userFilter");
    const startDateInput = $("#startDate");
    const endDateInput = $("#endDate");

    currentFilters = {};

    if (typeFilter && typeFilter.value) {
      currentFilters.type = typeFilter.value;
    }
    if (actionFilter && actionFilter.value) {
      currentFilters.action = actionFilter.value;
    }
    if (userFilter && userFilter.value) {
      currentFilters.userId = userFilter.value;
    }
    if (startDateInput && startDateInput.value) {
      currentFilters.startDate = startDateInput.value;
    }
    if (endDateInput && endDateInput.value) {
      currentFilters.endDate = endDateInput.value;
    }

    refreshLogsDisplay();
  }

  function clearFilters() {
    const typeFilter = $("#typeFilter");
    const actionFilter = $("#actionFilter");
    const userFilter = $("#userFilter");
    const startDateInput = $("#startDate");
    const endDateInput = $("#endDate");

    if (typeFilter) typeFilter.value = "";
    if (actionFilter) actionFilter.value = "";
    if (userFilter) userFilter.value = "";
    if (startDateInput) startDateInput.value = "";
    if (endDateInput) endDateInput.value = "";

    currentFilters = {};
    refreshLogsDisplay();
  }

  function refreshLogsDisplay() {
    const filteredLogs = filterLogs(allLogs);
    displayLogs(filteredLogs);
    updateLogsCount(filteredLogs.length);
  }

  function filterLogs(logs) {
    return logs.filter(log => {
      // Type filter
      if (currentFilters.type && log.type !== currentFilters.type) {
        return false;
      }
      
      // Action filter
      if (currentFilters.action && log.action !== currentFilters.action) {
        return false;
      }
      
      // User filter
      if (currentFilters.userId && log.userId !== currentFilters.userId) {
        return false;
      }
      
      // Date range filter
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      
      if (currentFilters.startDate && logDate < currentFilters.startDate) {
        return false;
      }
      
      if (currentFilters.endDate && logDate > currentFilters.endDate) {
        return false;
      }
      
      return true;
    });
  }

  function displayLogs(logs) {
    const tableBody = $("#logsTableBody");
    const emptyState = $("#emptyState");

    if (!tableBody) return;

    // Clear existing rows
    tableBody.innerHTML = "";

    if (logs.length === 0) {
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");

    // Create table rows
    logs.forEach(log => {
      const row = createLogRow(log);
      tableBody.appendChild(row);
    });
  }

  function createLogRow(log) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="log-timestamp">${formatTimestamp(log.timestamp)}</div>
      </td>
      <td>
        <span class="log-type ${log.type}">${log.type}</span>
      </td>
      <td>
        <span class="log-action ${log.action}">${log.action}</span>
      </td>
      <td>
        <div class="log-user">
          <div class="log-user-name">${log.userName}</div>
          <div class="log-user-role">${log.userRole}</div>
        </div>
      </td>
      <td>
        <div class="log-entity">${log.entityName || '-'}</div>
      </td>
      <td>
        <div class="log-details" title="${getLogSummary(log)}">
          ${getLogSummary(log)}
        </div>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn view" onclick="viewLogDetails('${log.id}')" title="View Details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </td>
    `;
    return row;
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  function getLogSummary(log) {
    switch (log.type) {
      case 'patient':
        return `${log.action} patient: ${log.entityName}`;
      case 'employee':
        return `${log.action} employee: ${log.entityName}`;
      case 'inventory':
        return `${log.action} item: ${log.entityName}`;
      case 'user':
        return `User ${log.action}: ${log.entityName}`;
      case 'system':
        return `System ${log.action}: ${log.entityName}`;
      default:
        return `${log.action} ${log.type}`;
    }
  }

  function updateLogsCount(count) {
    const countEl = $("#logsCount");
    if (countEl) {
      countEl.textContent = count.toLocaleString();
    }
  }

  function showLoadingState(show) {
    const loadingState = $("#loadingState");
    const tableBody = $("#logsTableBody");
    
    if (show) {
      loadingState?.classList.remove("hidden");
      if (tableBody) tableBody.innerHTML = "";
    } else {
      loadingState?.classList.add("hidden");
    }
  }

  // Global function for viewing log details
  window.viewLogDetails = function(logId) {
    const log = allLogs.find(l => l.id === logId);
    if (log) {
      showLogDetailsModal(log);
    }
  };

  function showLogDetailsModal(log) {
    const modal = $("#logDetailsModal");
    const content = $("#logDetailsContent");
    
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="log-detail-section">
        <h3 class="log-detail-title">Basic Information</h3>
        <div class="log-detail-grid">
          <div class="log-detail-item">
            <div class="log-detail-label">Timestamp</div>
            <div class="log-detail-value">${formatTimestamp(log.timestamp)}</div>
          </div>
          <div class="log-detail-item">
            <div class="log-detail-label">Type</div>
            <div class="log-detail-value">
              <span class="log-type ${log.type}">${log.type}</span>
            </div>
          </div>
          <div class="log-detail-item">
            <div class="log-detail-label">Action</div>
            <div class="log-detail-value">
              <span class="log-action ${log.action}">${log.action}</span>
            </div>
          </div>
          <div class="log-detail-item">
            <div class="log-detail-label">Entity</div>
            <div class="log-detail-value">${log.entityName || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div class="log-detail-section">
        <h3 class="log-detail-title">User Information</h3>
        <div class="log-detail-grid">
          <div class="log-detail-item">
            <div class="log-detail-label">User Name</div>
            <div class="log-detail-value">${log.userName}</div>
          </div>
          <div class="log-detail-item">
            <div class="log-detail-label">User Role</div>
            <div class="log-detail-value">${log.userRole}</div>
          </div>
          <div class="log-detail-item">
            <div class="log-detail-label">User ID</div>
            <div class="log-detail-value">${log.userId}</div>
          </div>
          <div class="log-detail-item">
            <div class="log-detail-label">Session ID</div>
            <div class="log-detail-value">${log.sessionId || 'N/A'}</div>
          </div>
        </div>
      </div>

      ${log.changes && log.changes.length > 0 ? `
        <div class="log-detail-section">
          <h3 class="log-detail-title">Changes Made</h3>
          <div class="log-detail-code">${JSON.stringify(log.changes, null, 2)}</div>
        </div>
      ` : ''}

      <div class="log-detail-section">
        <h3 class="log-detail-title">Details</h3>
        <div class="log-detail-code">${JSON.stringify(log.details, null, 2)}</div>
      </div>

      ${log.metadata ? `
        <div class="log-detail-section">
          <h3 class="log-detail-title">Metadata</h3>
          <div class="log-detail-code">${JSON.stringify(log.metadata, null, 2)}</div>
        </div>
      ` : ''}
    `;

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function hideLogDetailsModal() {
    const modal = $("#logDetailsModal");
    if (modal) {
      modal.style.display = "none";
      document.body.style.overflow = "";
    }
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

  // Settings panel removed from audit logs page

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      hideLogDetailsModal();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === "r") {
      e.preventDefault();
      refreshLogs();
    }
  });

  // Auto-refresh logs every 30 seconds if user is active
  let lastActivity = Date.now();
  let autoRefreshInterval;

  function updateLastActivity() {
    lastActivity = Date.now();
  }

  // Track user activity
  document.addEventListener("mousemove", updateLastActivity);
  document.addEventListener("keypress", updateLastActivity);
  document.addEventListener("click", updateLastActivity);

  // Auto-refresh function
  function startAutoRefresh() {
    autoRefreshInterval = setInterval(async () => {
      // Only refresh if user has been active in last 5 minutes
      if (Date.now() - lastActivity < 5 * 60 * 1000) {
        try {
          if (window.auditLogger) {
            const newLogs = await window.auditLogger.getLogs();
            if (newLogs.length !== allLogs.length) {
              allLogs = newLogs;
              populateUserFilter();
              refreshLogsDisplay();
            }
          }
        } catch (error) {
          console.error("Auto-refresh failed:", error);
        }
      }
    }, 30000); // 30 seconds
  }

  // Start auto-refresh
  startAutoRefresh();

  // Clean up on page unload
  window.addEventListener("beforeunload", function() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
  });
});

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
