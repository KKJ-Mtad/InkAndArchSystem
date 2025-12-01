// Attendance page functionality
document.addEventListener("DOMContentLoaded", function () {
  // Check authentication and prevent back button access after logout
  checkAuthAndPreventBackAccess();

  // Check authentication
  const token = storage.get("authToken");
  if (!token) {
    navigate("login.html");
    return;
  }

  // Check permissions
  const currentUser = storage.get("currentUser");
  if (
    !currentUser ||
    !currentUser.permissions ||
    (!currentUser.permissions.includes("attendance") && !currentUser.permissions.includes("all"))
  ) {
    showToast(
      "Access denied. You don't have permission to view this page.",
      "error",
    );
    setTimeout(() => navigate("dashboard.html"), 2000);
    return;
  }

  // State management
  let employees = [];
  let attendanceRecords = [];
  let filteredRecords = [];

  // Initialize page
  initializeAttendancePage();
  setupEventListeners();
  loadData();

  function initializeAttendancePage() {
    // Set user name
    const currentUser = storage.get("currentUser");
    const userNameElement = $("#userName");
    if (userNameElement && currentUser) {
      userNameElement.textContent = currentUser.name || "Admin";
    }

    // Set default date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const startDateInput = $("#startDate");
    const endDateInput = $("#endDate");
    const absentDateInput = $("#absentDate");

    if (startDateInput) {
      startDateInput.value = startDate.toISOString().split("T")[0];
    }
    if (endDateInput) {
      endDateInput.value = endDate.toISOString().split("T")[0];
    }
    if (absentDateInput) {
      absentDateInput.value = endDate.toISOString().split("T")[0];
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

    // Mark absent button
    const markAbsentBtn = $("#markAbsentBtn");
    if (markAbsentBtn) {
      markAbsentBtn.addEventListener("click", showMarkAbsentModal);
    }

    // Filters
    const startDateInput = $("#startDate");
    const endDateInput = $("#endDate");
    const employeeFilter = $("#employeeFilter");
    const statusFilterReport = $("#statusFilterReport");

    if (startDateInput) {
      startDateInput.addEventListener("change", applyFilters);
    }
    if (endDateInput) {
      endDateInput.addEventListener("change", applyFilters);
    }
    if (employeeFilter) {
      employeeFilter.addEventListener("change", applyFilters);
    }
    if (statusFilterReport) {
      statusFilterReport.addEventListener("change", applyFilters);
    }

    // Export button
    const exportReportBtn = $("#exportReportBtn");
    if (exportReportBtn) {
      exportReportBtn.addEventListener("click", handleExportReport);
    }

    // Modal event listeners
    setupModalEventListeners();

    // Form submission
    const absentForm = $("#absentForm");
    if (absentForm) {
      absentForm.addEventListener("submit", handleAbsentFormSubmit);
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
  }

  function setupModalEventListeners() {
    const closeAbsentModalBtn = $("#closeAbsentModalBtn");
    const cancelAbsentBtn = $("#cancelAbsentBtn");
    const markAbsentModal = $("#markAbsentModal");

    if (closeAbsentModalBtn) {
      closeAbsentModalBtn.addEventListener("click", hideMarkAbsentModal);
    }
    if (cancelAbsentBtn) {
      cancelAbsentBtn.addEventListener("click", hideMarkAbsentModal);
    }
    if (markAbsentModal) {
      markAbsentModal.addEventListener("click", function (e) {
        if (e.target === markAbsentModal) {
          hideMarkAbsentModal();
        }
      });
    }
  }

  async function loadData() {
    try {
      // Load employees from server API
      const response = await fetch('/api/employees');
      employees = response.ok ? await response.json() : [];

      // All employees now loaded from database only

      // Load real attendance records from storage
      attendanceRecords = storage.get("attendance") || [];

      // Populate employee filter
      populateEmployeeFilter();

      // Apply initial filters
      applyFilters();
    } catch (error) {
      showToast("Failed to load data", "error");
      console.error("Error loading data:", error);
    }
  }



  function populateEmployeeFilter() {
    const employeeFilter = $("#employeeFilter");
    const absentEmployee = $("#absentEmployee");

    if (!employeeFilter || !absentEmployee) return;

    const options = employees
      .filter((emp) => emp.status === "active")
      .map((emp) => `<option value="${emp.id}">${emp.name}</option>`)
      .join("");

    employeeFilter.innerHTML = `<option value="all">All Employees</option>${options}`;
    absentEmployee.innerHTML = `<option value="">Select employee...</option>${options}`;
  }

  function applyFilters() {
    const startDateInput = $("#startDate");
    const endDateInput = $("#endDate");
    const employeeFilter = $("#employeeFilter");
    const statusFilterReport = $("#statusFilterReport");

    const startDate = startDateInput ? startDateInput.value : "";
    const endDate = endDateInput ? endDateInput.value : "";
    const employeeId = employeeFilter ? employeeFilter.value : "all";
    const status = statusFilterReport ? statusFilterReport.value : "all";

    // First, enrich attendance records with employee data
    const enrichedRecords = attendanceRecords.map((record) => {
      let employee = null;

      // Try to find employee by ID first
      if (record.employeeId) {
        employee = employees.find(emp => emp.id === record.employeeId);
      }

      // If not found by ID, try to find by email
      if (!employee && record.employeeEmail) {
        employee = employees.find(emp => emp.email === record.employeeEmail);
      }

      // Create a default employee object if none found
      if (!employee) {
        employee = {
          id: record.employeeId || 0,
          name: record.employeeName || "Unknown Employee",
          email: record.employeeEmail || "",
          avatar: generateInitialsAvatar(
            (record.employeeName || "Unknown").split(" ")[0] || "U",
            (record.employeeName || "Employee").split(" ")[1] || "E"
          )
        };
      }

      return {
        ...record,
        employee: employee,
        clockIn: record.timeIn ? formatTime(new Date(record.timeIn)) : "--",
        clockOut: record.timeOut ? formatTime(new Date(record.timeOut)) : "--",
        hours: calculateHours(record.timeIn, record.timeOut),
        notes: record.notes || ''
      };
    });

    // Then apply filters
    filteredRecords = enrichedRecords.filter((record) => {
      const recordDate = record.date;

      // Date filter
      const dateInRange =
        (!startDate || recordDate >= startDate) &&
        (!endDate || recordDate <= endDate);

      // Employee filter
      const employeeMatch =
        employeeId === "all" || record.employee.id === parseInt(employeeId);

      // Status filter
      const statusMatch = status === "all" || record.status === status;

      return dateInRange && employeeMatch && statusMatch;
    });

    renderAttendanceTable();
    updateRecordCount();
  }

  function renderAttendanceTable() {
    const tableBody = $("#attendanceTableBody");
    if (!tableBody) return;

    if (filteredRecords.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No Records Found</h3>
            <p>Try adjusting your filter criteria</p>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filteredRecords
      .map(
        (record) => `
      <tr>
        <td>
          <div class="employee-info">
            <div class="employee-avatar">
              <img src="${record.employee.avatar}" alt="${record.employee.name}" />
            </div>
            <div class="employee-details">
              <div class="employee-name">${record.employee.name}</div>
              <div class="employee-id">ID: ${record.employee.id.toString().padStart(3, "0")}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="attendance-date">${formatDisplayDate(record.date)}</div>
        </td>
        <td>
          <div class="attendance-time ${record.status === "late" ? "late" : ""}">${record.clockIn}</div>
        </td>
        <td>
          <div class="attendance-time">${record.clockOut}</div>
        </td>
        <td>
          <div class="attendance-hours">${record.hours}h</div>
        </td>
        <td>
          <span class="attendance-status ${record.status}">
            ${getStatusDisplayText(record.status)}
          </span>
        </td>
        <td>
          <div class="attendance-notes" title="${record.notes || ''}">${record.notes || ''}</div>
        </td>
      </tr>
    `,
      )
      .join("");
  }

  function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function getStatusDisplayText(status) {
    const statusMap = {
      present: "Present",
      absent: "Absent",
      late: "Late",
      leave: "On Leave",
      day_off: "Day Off",
    };
    return statusMap[status] || status;
  }

  function updateRecordCount() {
    const recordCount = $("#recordCount");
    if (recordCount) {
      const count = filteredRecords.length;
      recordCount.textContent = `${count} record${count !== 1 ? "s" : ""}`;
    }
  }

  function showMarkAbsentModal() {
    const modal = $("#markAbsentModal");
    const form = $("#absentForm");

    // Reset form
    if (form) {
      form.reset();
      // Set today's date as default
      const absentDateInput = $("#absentDate");
      if (absentDateInput) {
        absentDateInput.value = new Date().toISOString().split("T")[0];
      }
    }

    showModal("#markAbsentModal");
  }

  function hideMarkAbsentModal() {
    hideModal("#markAbsentModal");
  }

  async function handleAbsentFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const absentData = Object.fromEntries(formData.entries());

    const saveBtn = $("#saveAbsentBtn");
    const btnText = saveBtn.querySelector(".btn-text");
    const btnSpinner = saveBtn.querySelector(".btn-spinner");

    // Show loading state
    saveBtn.disabled = true;
    btnText.classList.add("hidden");
    btnSpinner.classList.remove("hidden");

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Find the employee
      const employee = employees.find(
        (emp) => emp.id === parseInt(absentData.employee),
      );

      if (employee) {
        // Check if record already exists
        const existingRecordIndex = attendanceRecords.findIndex(
          (record) =>
            record.employeeId === parseInt(absentData.employee) &&
            record.date === absentData.date,
        );

        const newRecord = {
          id: `${absentData.employee}-${absentData.date}`,
          employeeId: parseInt(absentData.employee),
          employee: employee,
          date: absentData.date,
          clockIn: "--",
          clockOut: "--",
          hours: "0.0",
          status: absentData.status,
          notes: `${absentData.reason}${absentData.notes ? ": " + absentData.notes : ""}`,
        };

        if (existingRecordIndex !== -1) {
          // Update existing record
          attendanceRecords[existingRecordIndex] = newRecord;
          showToast("Attendance record updated successfully!", "success");
        } else {
          // Add new record
          attendanceRecords.unshift(newRecord); // Add to beginning
          showToast("Absence/Late record added successfully!", "success");
        }

        // Refresh the display
        applyFilters();
        hideMarkAbsentModal();
      }
    } catch (error) {
      showToast("Failed to save record. Please try again.", "error");
    } finally {
      // Reset loading state
      saveBtn.disabled = false;
      btnText.classList.remove("hidden");
      btnSpinner.classList.add("hidden");
    }
  }

  function handleExportReport() {
    // Simulate export functionality
    showToast("Exporting attendance report...", "info");

    // In a real application, this would generate a CSV or PDF
    const exportData = filteredRecords.map((record) => ({
      Employee: record.employee.name,
      Date: record.date,
      "Clock In": record.clockIn,
      "Clock Out": record.clockOut,
      Hours: record.hours,
      Status: getStatusDisplayText(record.status),
      Notes: record.notes || '',
    }));

    console.log("Export data:", exportData);

    // Simulate download
    setTimeout(() => {
      showToast("Report exported successfully!", "success");
    }, 2000);
  }

  function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
      storage.remove("authToken");
      storage.remove("currentUser");
      showToast("Logged out successfully", "info");
      if (typeof preventBackAfterLogout === 'function') {
        preventBackAfterLogout();
      }
      setTimeout(() => navigate("login.html"), 1000);
    }
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Escape key to close modals
    if (e.key === "Escape") {
      hideMarkAbsentModal();
    }

    // Ctrl/Cmd + M to mark absent
    if ((e.ctrlKey || e.metaKey) && e.key === "m") {
      e.preventDefault();
      showMarkAbsentModal();
    }

    // Ctrl/Cmd + E to export
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
      e.preventDefault();
      handleExportReport();
    }
  });

  // Helper function to format time from ISO string
  function formatTime(date) {
    if (!date) return "--";
    try {
      return new Date(date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch (error) {
      return "--";
    }
  }

  // Helper function to calculate hours worked
  function calculateHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return "0.0";

    try {
      const start = new Date(timeIn);
      const end = new Date(timeOut);
      const diffMs = end - start;
      const hours = diffMs / (1000 * 60 * 60);
      return Math.max(0, hours).toFixed(1);
    } catch (error) {
      return "0.0";
    }
  }

  // Auto-refresh data every 5 minutes
  setInterval(
    function () {
      applyFilters();
    },
    5 * 60 * 1000,
  );
});

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
