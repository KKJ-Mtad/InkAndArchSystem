// Employees page functionality
/**
 * EMPLOYEE MANAGEMENT MODULE
 * ===========================
 *
 * This module handles all employee-related functionality including:
 * - Employee listing with pagination and search
 * - Employee creation, editing, and deletion
 * - Role-based access control (admin vs front_desk vs employee)
 * - Integration with SQLite database via server APIs
 * - User credential management for employee logins
 *
 * Key Features:
 * - Real-time search and filtering
 * - Paginated table display
 * - Modal-based employee creation/editing
 * - Permission-based UI controls
 * - Avatar generation and management
 *
 * Dependencies:
 * - utils.js (storage, navigation, toast notifications)
 * - Server API endpoints (/api/employees, /api/auth/*)
 * - SQLite database with 'employees' and 'users' tables
 *
 * @author Ink and Arch Development Team
 * @version 1.0.0
 */

document.addEventListener("DOMContentLoaded", function () {
  // Check authentication and prevent back button access after logout
  checkAuthAndPreventBackAccess();

  // Add global error handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection in employees.js:', event.reason);
    // Prevent the default browser behavior of logging to console
    event.preventDefault();

    // Show user-friendly error message
    if (typeof showToast === 'function') {
      showToast('An unexpected error occurred. Please try again.', 'error');
    }
  });

  // ============================================================================
  // AUTHENTICATION & PERMISSION CHECK
  // ============================================================================
  // Verify user is logged in and has permission to access employee management

  const token = storage.get("authToken");
  if (!token) {
    navigate("login.html");
    return;
  }

  // Check permissions
  const currentUser = storage.get("currentUser");
  if (!currentUser || !currentUser.permissions ||
    (!currentUser.permissions.includes("employees") && !currentUser.permissions.includes("all"))) {
    showToast("Access denied. You don't have permission to view this page.", "error");
    setTimeout(() => navigate("dashboard.html"), 2000);
    return;
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  // Global variables to manage employee data and UI state

  let employees = [];               // Complete list of employees from database
  let filteredEmployees = [];      // Filtered employees based on search criteria
  let currentPage = 1;             // Current page number for pagination
  const itemsPerPage = 10;         // Number of employees to display per page
  let currentEditEmployeeId = null; // ID of employee currently being edited

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  // Set up the page and load initial data

  initializeEmployeesPage();  // Configure UI elements and role-based access
  setupEventListeners();           // Bind event handlers to interactive elements
  setupArchiveModalHandlers();     // Setup archive modal handlers
  loadEmployees();                 // Fetch employee data from server

  // Check QRCode library status and generate missing QR codes
  setTimeout(() => {
    console.log('✅ QRCode functionality ready');

    // Generate QR codes for employees who don't have them
    generateMissingQRCodes();
  }, 1000); // Faster startup

  // Generate QR codes for employees who don't have them
  function generateMissingQRCodes() {
    const employeesWithoutQR = employees.filter(emp => !emp.qrDataUrl);

    if (employeesWithoutQR.length > 0) {
      console.log(`🔄 Generating QR codes for ${employeesWithoutQR.length} employees without QR codes`);

      employeesWithoutQR.forEach((employee, index) => {
        // Generate QR codes instantly using online service
        setTimeout(() => {
          generateEmployeeQR(employee.id);
          console.log(`✅ Generated QR code for ${employee.name} (${index + 1}/${employeesWithoutQR.length})`);
        }, index * 100); // Much faster - 100ms delay between each generation
      });
    } else {
      console.log('✅ All employees already have QR codes');
    }
  }

  function initializeEmployeesPage() {
    // Set user name
    const currentUser = storage.get("currentUser");
    const userNameElement = $("#userName");
    if (userNameElement && currentUser) {
      userNameElement.textContent = currentUser.name || "Admin";
    }

    // Apply role-based sidebar access
    applyRoleBasedSidebarAccess(currentUser);

    // Hide login credentials section for non-admin users
    if (currentUser && currentUser.role !== "admin") {
      const loginCredentialsSection = $("#loginCredentialsSection");
      if (loginCredentialsSection) {
        loginCredentialsSection.style.display = "none";
      }
    }

    // Show audit logs for admin and front desk users only
    if (currentUser && (currentUser.role === "admin" || currentUser.role === "front_desk")) {
      const logsNavItem = $("#logsNavItem");
      if (logsNavItem) {
        logsNavItem.style.display = "flex";
      }
    }
  }

  function applyRoleBasedSidebarAccess(user) {
    if (!user) return;

    // If employee, hide restricted sidebar items
    if (user.role === "employee") {
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

    // For front desk users, hide employees tab
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

    // Admin users should have access to all sections - no restrictions
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

    // Add employee button
    const addEmployeeBtn = $("#addEmployeeBtn");
    if (addEmployeeBtn) {
      addEmployeeBtn.addEventListener("click", () => showAddEmployeeModal());
    }

    // Search input
    const searchInput = $("#searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    }

    // Filter selects
    const statusFilter = $("#statusFilter");
    const departmentFilter = $("#departmentFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", handleFilters);
    }
    if (departmentFilter) {
      departmentFilter.addEventListener("change", handleFilters);
    }

    // Export button
    const exportBtn = $("#exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", handleExport);
    }

    // Manage employees (AWOL) button
    const manageEmployeesBtn = $("#manageEmployeesBtn");
    if (manageEmployeesBtn) {
      manageEmployeesBtn.addEventListener("click", () => showManageEmployeesModal());
    }

    // Modal close buttons
    setupModalEventListeners();

    // Form submission
    const employeeForm = $("#employeeForm");
    if (employeeForm) {
      employeeForm.addEventListener("submit", handleEmployeeFormSubmit);
      // Employee name real-time sanitization & capitalization
      const employeeNameInput = document.getElementById('employeeName');
      if (employeeNameInput) {
        employeeNameInput.setAttribute('maxlength', '24');
        employeeNameInput.addEventListener('input', function() {
          const start = this.selectionStart;
          const end = this.selectionEnd;
          // allow only letters and spaces
          const cleaned = String(this.value).replace(/[^A-Za-z\s]/g, '').replace(/\s+/g,' ').slice(0,24);
          const titled = cleaned.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
          this.value = titled;
          if (typeof start === 'number' && typeof end === 'number') this.setSelectionRange(start, end);
        });
      }
      // Position input sanitization (letters, spaces, dash only)
      const positionInput = document.getElementById('employeePosition');
      if (positionInput) {
        positionInput.setAttribute('maxlength', '26');
        positionInput.addEventListener('input', function() {
          const start = this.selectionStart;
          const end = this.selectionEnd;
          const cleaned = String(this.value).replace(/[^A-Za-z\s\-]/g, '').replace(/\s+/g,' ').slice(0,26);
          // Title case
          const titled = cleaned.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
          this.value = titled;
          if (typeof start === 'number' && typeof end === 'number') this.setSelectionRange(start, end);
        });
      }
    }

    // Role change handler for password requirement
    const employeeRole = $("#employeeRole");
    if (employeeRole) {
      employeeRole.addEventListener("change", handleRoleChange);
    }

    // Password validation
    const passwordInput = $("#employeePassword");
    const confirmPasswordInput = $("#employeeConfirmPassword");

    if (passwordInput && confirmPasswordInput) {
      confirmPasswordInput.addEventListener("input", validatePasswordMatch);
      passwordInput.addEventListener("input", validatePasswordMatch);
    }

    // Password visibility toggles
    const toggleEmployeePassword = $("#toggleEmployeePassword");
    const toggleConfirmPassword = $("#toggleConfirmPassword");

    if (toggleEmployeePassword) {
      toggleEmployeePassword.addEventListener("click", () => togglePasswordVisibility("employeePassword"));
    }
    if (toggleConfirmPassword) {
      toggleConfirmPassword.addEventListener("click", () => togglePasswordVisibility("employeeConfirmPassword"));
    }

    // Portrait camera controls
    setupPortraitCameraListeners();

    // Pagination
    setupPaginationEventListeners();

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
    // Add employee modal
    const closeModalBtn = $("#closeModalBtn");
    const cancelBtn = $("#cancelBtn");
    const addEmployeeModal = $("#addEmployeeModal");

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", hideAddEmployeeModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", hideAddEmployeeModal);
    }
    if (addEmployeeModal) {
      addEmployeeModal.addEventListener("click", function (e) {
        if (e.target === addEmployeeModal) {
          hideAddEmployeeModal();
        }
      });
    }

    // Delete modal
    const closeDeleteModalBtn = $("#closeDeleteModalBtn");
    const cancelDeleteBtn = $("#cancelDeleteBtn");
    const confirmDeleteBtn = $("#confirmDeleteBtn");
    const deleteModal = $("#deleteModal");

    if (closeDeleteModalBtn) {
      closeDeleteModalBtn.addEventListener("click", hideDeleteModal);
    }
    if (cancelDeleteBtn) {
      cancelDeleteBtn.addEventListener("click", hideDeleteModal);
    }
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener("click", confirmDelete);
    }
    if (deleteModal) {
      deleteModal.addEventListener("click", function (e) {
        if (e.target === deleteModal) {
          hideDeleteModal();
        }
      });
    }
  }

  function setupPaginationEventListeners() {
    const prevBtn = $("#prevBtn");
    const nextBtn = $("#nextBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderEmployeesTable();
          updatePagination();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderEmployeesTable();
          updatePagination();
        }
      });
    }
  }

  /**
   * LOAD EMPLOYEES FROM DATABASE
   * ============================
   * Fetches employee data from the server SQLite database and populates the UI.
   * Includes error handling and loading state management.
   *
   * Flow:
   * 1. Show loading indicator
   * 2. Fetch data from /api/employees endpoint
   * 3. Filter and render the employee table
   * 4. Update pagination controls
   * 5. Hide loading indicator
   */
  async function loadEmployees() {
    try {
      showLoadingState();

      // Fetch employee data from SQLite database via server API
      const response = await fetch('/api/employees');
      employees = response.ok ? await response.json() : [];

      // All employees now loaded from database only
      filteredEmployees = [...employees];
      renderEmployeesTable();
      updateEmployeeCount();
      updatePagination();
    } catch (error) {
      showToast("Failed to load employees", "error");
      console.error("Error loading employees:", error);
    }
  }

  function showLoadingState() {
    const tableBody = $("#employeesTableBody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="loading-row">
            <div class="loading-spinner">
              <div class="spinner"></div>
              <span>Loading employees...</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function renderEmployeesTable() {
    const tableBody = $("#employeesTableBody");
    if (!tableBody) return;

    if (filteredEmployees.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No employees found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </td>
        </tr>
      `;
      return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageEmployees = filteredEmployees.slice(startIndex, endIndex);

    tableBody.innerHTML = pageEmployees
      .map(
        (employee) => {
          const portrait = window.getEmployeePortrait(employee.id);
          return `
      <tr>
        <td>
          <div class="employee-info">
            <div class="employee-portrait">
              ${portrait ? `<img src="${portrait}" alt="${employee.name}" />` : `
                <div class="employee-portrait-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
                    <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
              `}
            </div>
            <div class="employee-details">
              <div class="employee-name">${employee.name}</div>
              <div class="employee-id">ID: ${employee.id.toString().padStart(3, "0")}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="employee-position">${employee.position}</div>
        </td>
        <td>
          <a href="mailto:${employee.email}" class="employee-email">${employee.email}</a>
        </td>
        <td>
          <span class="status-badge ${employee.status}">
            ${employee.status === "active" ? "Active" : employee.status === "leave" ? "On Leave" : "Inactive"}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" onclick="editEmployee(${employee.id})" title="Edit Employee">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="action-btn view" onclick="viewAttendance(${employee.id})" title="View Attendance">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div class="action-buttons-container" style="display: flex; gap: 8px;">
             <button class="action-btn delete" onclick="deleteEmployee(${employee.id}, '${employee.name}')" title="Delete Employee">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            </button>

             <button class="action-btn view-qr" onclick="showEmployeeQR(${employee.id})" title="Show QR Code">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="5" height="5" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="16" y="3" width="5" height="5" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="3" y="16" width="5" height="5" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="5" y="5" width="1" height="1" fill="currentColor"/>
            <rect x="18" y="5" width="1" height="1" fill="currentColor"/>
            <rect x="5" y="18" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="10" width="4" height="4" stroke="currentColor" stroke-width="1" fill="none"/>
            <rect x="11" y="11" width="2" height="2" fill="currentColor"/>
            </svg>
            </button>
        </div>
          </div>
        </td>
      </tr>
    `;
        }
      )
      .join("");
  }

  function updateEmployeeCount() {
    const employeeCount = $("#employeeCount");
    if (employeeCount) {
      const count = filteredEmployees.length;
      employeeCount.textContent = `${count} employee${count !== 1 ? "s" : ""}`;
    }
  }

  function updatePagination() {
    const totalItems = filteredEmployees.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    // Update pagination info
    const paginationInfo = $("#paginationInfo");
    if (paginationInfo) {
      if (totalItems === 0) {
        paginationInfo.textContent = "No employees to show";
      } else {
        paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} employees`;
      }
    }

    // Update pagination controls
    const prevBtn = $("#prevBtn");
    const nextBtn = $("#nextBtn");

    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
    }

    // Update page numbers
    const paginationPages = $("#paginationPages");
    if (paginationPages) {
      const pageNumbers = [];
      const maxVisiblePages = 5;

      let startPage = Math.max(
        1,
        currentPage - Math.floor(maxVisiblePages / 2),
      );
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(`
          <button class="page-btn ${i === currentPage ? "active" : ""}" onclick="goToPage(${i})">
            ${i}
          </button>
        `);
      }

      paginationPages.innerHTML = pageNumbers.join("");
    }
  }

  function handleSearch() {
    const searchInput = $("#searchInput");
    const searchTerm = searchInput.value.toLowerCase().trim();

    applyFilters(searchTerm);
  }

  function handleFilters() {
    const searchInput = $("#searchInput");
    const searchTerm = searchInput
      ? searchInput.value.toLowerCase().trim()
      : "";

    applyFilters(searchTerm);
  }

  function applyFilters(searchTerm = "") {
    const statusFilter = $("#statusFilter");
    const departmentFilter = $("#departmentFilter");

    const statusValue = statusFilter ? statusFilter.value : "all";
    const departmentValue = departmentFilter ? departmentFilter.value : "all";

    filteredEmployees = employees.filter((employee) => {
      const matchesSearch =
        !searchTerm ||
        employee.name.toLowerCase().includes(searchTerm) ||
        employee.email.toLowerCase().includes(searchTerm) ||
        employee.position.toLowerCase().includes(searchTerm);

      const matchesStatus =
        statusValue === "all" || employee.status === statusValue;

      const matchesDepartment =
        departmentValue === "all" ||
        (employee.department && employee.department === departmentValue);

      return matchesSearch && matchesStatus && matchesDepartment;
    });

    currentPage = 1;
    renderEmployeesTable();
    updateEmployeeCount();
    updatePagination();
  }

  function handleRoleChange() {
    const employeeRole = $("#employeeRole");
    const passwordSection = $("#passwordSection");
    const credentialCheckboxRow = $("#credentialCheckboxRow");
    const passwordInput = $("#employeePassword");
    const confirmPasswordInput = $("#employeeConfirmPassword");

    if (!employeeRole) return;

    const selectedRole = employeeRole.value;

    // For Employee role, hide password section
    if (selectedRole === "employee") {
      if (passwordSection) passwordSection.style.display = "none";
      if (credentialCheckboxRow) credentialCheckboxRow.style.display = "none";

      // Clear password requirement
      if (passwordInput) {
        passwordInput.removeAttribute("required");
        passwordInput.value = "";
      }
      if (confirmPasswordInput) {
        confirmPasswordInput.removeAttribute("required");
        confirmPasswordInput.value = "";
      }
    } else if (selectedRole === "front_desk" || selectedRole === "admin") {
      // For Front Desk and Admin, show password section
      if (passwordSection) passwordSection.style.display = "flex";
      if (credentialCheckboxRow) credentialCheckboxRow.style.display = "flex";

      // Set password as required
      if (passwordInput) {
        passwordInput.setAttribute("required", "required");
      }
      if (confirmPasswordInput) {
        confirmPasswordInput.setAttribute("required", "required");
      }
    }
  }

  function showAddEmployeeModal() {
    const modal = $("#addEmployeeModal");
    const form = $("#employeeForm");

    // Reset form
    if (form) {
      form.reset();
      currentEditEmployeeId = null;
    }

    // Reset role-based visibility
    const employeeRole = $("#employeeRole");
    if (employeeRole) {
      employeeRole.value = "";
      handleRoleChange();
    }

    // Update modal title
    const modalTitle = modal.querySelector(".modal-header h2");
    const submitBtn = $("#saveEmployeeBtn");
    const submitBtnText = submitBtn.querySelector(".btn-text");

    if (modalTitle) modalTitle.textContent = "Add New Employee";
    if (submitBtnText) submitBtnText.textContent = "Add Employee";

    // Reset portrait section for new employee
    resetPortraitSection();

    showModal("#addEmployeeModal");
  }

  function hideAddEmployeeModal() {
    hideModal("#addEmployeeModal");
    currentEditEmployeeId = null;
    resetPortraitSection();
  }

  function resetPortraitSection() {
    currentPortraitData = null;
    document.getElementById('portraitData').value = '';

    const cameraPreview = document.getElementById('cameraPreview');
    const portraitImage = document.getElementById('portraitImage');
    const noPortraitPlaceholder = document.getElementById('noPortraitPlaceholder');
    const startCameraBtn = document.getElementById('startCameraBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const retakePhotoBtn = document.getElementById('retakePhotoBtn');
    const clearPortraitBtn = document.getElementById('clearPortraitBtn');

    if (cameraPreview) cameraPreview.style.display = 'none';
    if (portraitImage) portraitImage.style.display = 'none';
    if (noPortraitPlaceholder) noPortraitPlaceholder.style.display = 'flex';
    if (startCameraBtn) startCameraBtn.style.display = 'inline-flex';
    if (capturePhotoBtn) capturePhotoBtn.style.display = 'none';
    if (retakePhotoBtn) retakePhotoBtn.style.display = 'none';
    if (clearPortraitBtn) clearPortraitBtn.style.display = 'none';

    stopCamera();
  }

  // Global function to edit employee
  window.editEmployee = function(employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
      showToast("Employee not found", "error");
      return;
    }

    const modal = $("#addEmployeeModal");
    const form = $("#employeeForm");
    const modalTitle = modal.querySelector(".modal-header h2");
    const submitBtn = $("#saveEmployeeBtn");
    const submitBtnText = submitBtn.querySelector(".btn-text");

    // Set current edit ID
    currentEditEmployeeId = employeeId;

    // Populate form with employee data
    $("#employeeName").value = employee.name || "";
    $("#employeeEmail").value = employee.email || "";
    $("#employeePosition").value = employee.position || "";
    $("#employeeDepartment").value = employee.department || "";
    $("#employeeStatus").value = employee.status || "active";
    $("#employeeStartDate").value = employee.startDate || "";
    $("#employeeRole").value = employee.role || "";
    $("#employeeUsername").value = employee.username || "";

    // Load existing portrait if available
    const existingPortrait = window.getEmployeePortrait(employeeId);
    if (existingPortrait) {
      const portraitImage = document.getElementById('portraitImage');
      const cameraPreview = document.getElementById('cameraPreview');
      const noPortraitPlaceholder = document.getElementById('noPortraitPlaceholder');
      const startCameraBtn = document.getElementById('startCameraBtn');
      const capturePhotoBtn = document.getElementById('capturePhotoBtn');
      const retakePhotoBtn = document.getElementById('retakePhotoBtn');
      const clearPortraitBtn = document.getElementById('clearPortraitBtn');

      if (portraitImage) {
        portraitImage.src = existingPortrait;
        portraitImage.style.display = 'block';
      }
      if (cameraPreview) cameraPreview.style.display = 'none';
      if (noPortraitPlaceholder) noPortraitPlaceholder.style.display = 'none';
      if (startCameraBtn) startCameraBtn.style.display = 'inline-flex';
      if (capturePhotoBtn) capturePhotoBtn.style.display = 'none';
      if (retakePhotoBtn) retakePhotoBtn.style.display = 'inline-flex';
      if (clearPortraitBtn) clearPortraitBtn.style.display = 'inline-flex';

      currentPortraitData = existingPortrait;
      document.getElementById('portraitData').value = existingPortrait;
    } else {
      // Reset portrait section for new employee
      resetPortraitSection();
    }

    // Handle password fields for editing
    const passwordInput = $("#employeePassword");
    const confirmPasswordInput = $("#employeeConfirmPassword");
    const sendCredentialsCheckbox = $("#sendCredentials");

    // For editing, password is optional
    if (passwordInput) {
      passwordInput.removeAttribute("required");
      passwordInput.value = "";
      passwordInput.placeholder = "Leave blank to keep current password";
    }
    if (confirmPasswordInput) {
      confirmPasswordInput.removeAttribute("required");
      confirmPasswordInput.value = "";
      confirmPasswordInput.placeholder = "Leave blank to keep current password";
    }

    // Trigger role change to show/hide password fields appropriately
    handleRoleChange();

    // Update modal title and button
    if (modalTitle) modalTitle.textContent = "Edit Employee";
    if (submitBtnText) submitBtnText.textContent = "Update Employee";

    // Show send credentials checkbox only for non-employee roles
    if (sendCredentialsCheckbox && employee.role !== "employee") {
      if (sendCredentialsCheckbox.parentElement.parentElement) {
        sendCredentialsCheckbox.parentElement.parentElement.style.display = "flex";
      }
    }

    showModal("#addEmployeeModal");
  };

  async function handleEmployeeFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const employeeData = Object.fromEntries(formData.entries());

    const selectedRole = employeeData.role || "";

    // Validate passwords match if password is provided
    if (employeeData.password && employeeData.password !== employeeData.confirmPassword) {
      showToast("Passwords do not match. Please try again.", "error");
      return;
    }

    // Validate password requirement based on role
    if ((selectedRole === "front_desk" || selectedRole === "admin") && !employeeData.password && !currentEditEmployeeId) {
      showToast("Password is required for this role.", "error");
      return;
    }

    // For Employee role, don't require password
    if (selectedRole === "employee") {
      delete employeeData.password;
      delete employeeData.confirmPassword;
    }

    // Store portrait data separately if provided
    const portraitData = employeeData.portraitData;
    delete employeeData.portraitData;

    // Validate email uniqueness
    const existingEmployee = employees.find(emp =>
      emp.email === employeeData.email && emp.id !== currentEditEmployeeId
    );
    if (existingEmployee) {
      showToast("Email address is already in use. Please use a different email.", "error");
      return;
    }

    // Validate name uniqueness (no duplicates allowed)
    const normalizedEmpName = (employeeData.name || '').trim().toLowerCase();
    if (normalizedEmpName) {
      const existingByName = employees.find(emp => (emp.name || '').trim().toLowerCase() === normalizedEmpName && emp.id !== currentEditEmployeeId);
      if (existingByName) {
        showToast('Employee name already exists. Please choose a different name.', 'error');
        return;
      }
    }

    // Validate username if provided
    if (employeeData.username) {
      const existingUsername = employees.find(emp =>
        emp.username === employeeData.username && emp.id !== currentEditEmployeeId
      );
      if (existingUsername) {
        showToast("Username is already in use. Please choose a different username.", "error");
        return;
      }
    }

    const submitBtn = $("#saveEmployeeBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnSpinner = submitBtn.querySelector(".btn-spinner");

    // Show loading state
    submitBtn.disabled = true;
    btnText.classList.add("hidden");
    btnSpinner.classList.remove("hidden");

    let result = null;
    let credentialsSent = false;

    try {
      if (currentEditEmployeeId) {
        // Update existing employee
        const employeeIndex = employees.findIndex(
          (emp) => emp.id === currentEditEmployeeId,
        );
        if (employeeIndex !== -1) {
          const oldData = { ...employees[employeeIndex] };

          // For edit, only update fields that have values
          const updateData = {};
          Object.keys(employeeData).forEach(key => {
            if (key !== 'confirmPassword') {
              if (key === 'password' && !employeeData.password) {
                // Skip empty password on edit
                return;
              }
              updateData[key] = employeeData[key];
            }
          });

          const updatedEmployee = {
            ...employees[employeeIndex],
            ...updateData,
          };
          employees[employeeIndex] = updatedEmployee;

          // Log employee update
          if (window.auditLogger) {
            try {
              const changes = Object.keys(updateData)
                .filter(key => oldData[key] !== updateData[key])
                .map(key => ({
                  field: key,
                  oldValue: key === 'password' ? '[REDACTED]' : oldData[key],
                  newValue: key === 'password' ? '[REDACTED]' : updateData[key]
                }));

              await window.auditLogger.logEmployee('update', {
                id: currentEditEmployeeId,
                name: updatedEmployee.name,
                email: updatedEmployee.email,
                role: updatedEmployee.role,
                department: updatedEmployee.department,
                oldValue: { ...oldData, password: '[REDACTED]' },
                newValue: { ...updatedEmployee, password: '[REDACTED]' },
                changes: changes,
                updatedFields: Object.keys(updateData)
              });
            } catch (auditError) {
              console.warn('Audit logging failed:', auditError);
            }
          }

          // Send credentials email if checkbox is checked and password was updated
          if (employeeData.sendCredentials && employeeData.password && (selectedRole === "front_desk" || selectedRole === "admin")) {
            try {
              await sendCredentialsEmail(updatedEmployee, employeeData.password);
              credentialsSent = true;
              console.log('✅ Credentials email sent to:', updatedEmployee.email);
            } catch (emailError) {
              console.error('❌ Failed to send credentials email:', emailError);
              showToast('Employee updated but email sending failed.', 'warning');
            }
          }

          // Update user credentials if this is the current user
          updateUserCredentials(updatedEmployee);

          // Save portrait if updated
          if (portraitData) {
            saveEmployeePortrait(currentEditEmployeeId, portraitData);
          }
        }
        showToast("Employee updated successfully!" + (credentialsSent ? " Login details sent via email." : ""), "success");
      } else {
        // Create new employee
        const newEmployeeData = {
          name: employeeData.name,
          email: employeeData.email,
          position: employeeData.position || employeeData.role,
          department: employeeData.department,
          status: employeeData.status || 'active',
          role: employeeData.role,
          username: employeeData.username,
          startDate: employeeData.startDate,
          avatar: generateInitialsAvatar(employeeData.name?.split(' ')[0], employeeData.name?.split(' ')[1])
        };

        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEmployeeData)
        });

        if (!response.ok) {
          throw new Error('Failed to create employee on server');
        }

        result = await response.json();

        // Add the new employee to local array with server-assigned ID
        const newEmployee = {
          id: result.id,
          ...newEmployeeData,
          createdAt: new Date().toISOString(),
          permissions: getRolePermissions(employeeData.role)
        };

        employees.push(newEmployee);

        // Save portrait if captured
        if (portraitData) {
          saveEmployeePortrait(newEmployee.id, portraitData);
        }

        // Also create user credentials in the users table (only for non-employee roles)
        if (selectedRole !== "employee" && employeeData.password) {
          try {
            await createUserCredentialsOnServer(employeeData);
            console.log('✅ User credentials created for employee:', employeeData.email);
          } catch (credentialsError) {
            console.error('❌ Failed to create user credentials:', credentialsError);
            showToast('Employee created but login credentials failed. Please create manually.', 'warning');
          }
        } else if (selectedRole === "employee") {
          console.log('⚠️ Skipping user credentials creation for Employee role (no login access needed)');
        }

        // Send credentials email if applicable
        if (employeeData.sendCredentials && employeeData.password && (selectedRole === "front_desk" || selectedRole === "admin")) {
          try {
            await sendCredentialsEmail(newEmployee, employeeData.password);
            credentialsSent = true;
            console.log('✅ Credentials email sent to:', newEmployee.email);
          } catch (emailError) {
            console.error('❌ Failed to send credentials email:', emailError);
            showToast('Employee created but email sending failed.', 'warning');
          }
        }

        // Log employee creation
        if (window.auditLogger) {
          try {
            await window.auditLogger.logEmployee('create', {
              id: newEmployee.id,
              name: newEmployee.name,
              email: newEmployee.email,
              role: newEmployee.role,
              department: newEmployee.department
            });
          } catch (auditError) {
            console.warn('Audit logging failed:', auditError);
          }
        }

        showToast(`Employee created successfully!${credentialsSent ? ' Login details sent via email.' : ''}`, "success");
      }

      // Save to storage
      try {
        storage.set("employees", employees);
      } catch (storageError) {
        console.warn('Failed to save employees to storage:', storageError);
      }

      // Refresh the display
      applyFilters();
      hideAddEmployeeModal();

      // Refresh employee data in timetracking page if function is available
      if (typeof window.refreshEmployeeData === 'function') {
        window.refreshEmployeeData();
      }
    } catch (error) {
      console.error('Employee form submission error:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      showToast(`Failed to save employee: ${errorMessage}. Please try again.`, "error");
    } finally {
      // Reset loading state
      submitBtn.disabled = false;
      btnText.classList.remove("hidden");
      btnSpinner.classList.add("hidden");

      // Generate QR code for new employees only
      if (!currentEditEmployeeId && result && result.id) {
        try {
          generateEmployeeQR(result.id);
        } catch (qrError) {
          console.warn('QR code generation failed:', qrError);
        }
      }
    }
  }

  // QR Code generation function using online service
  function generateEmployeeQR(employeeId) {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        console.error('Employee not found for QR generation');
        return;
      }
      if (employee.qrDataUrl) {
        console.log('QR code already exists for employee, skipping generation');
        return;
      }

      // Simple QR data format
      const qrData = `employee:${employeeId}`;
      console.log(`🔄 Generating QR code for employee ${employee.name} with data: ${qrData}`);

      // Use online QR service for immediate QR code generation
      const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}`;

      // Update the employee object with QR URL
      const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
      if (employeeIndex !== -1) {
        employees[employeeIndex].qrDataUrl = qrServiceUrl;
        storage.set("employees", employees);
        console.log(`✅ QR code generated for employee ${employeeId}`);
      }
    } catch (qrError) {
      console.warn('QR code generation failed:', qrError);
    }
  }

  // On-demand QR code generation for existing employees
  function generateEmployeeQROnDemand(employeeId) {
    try {
      const existing = employees.find(emp => emp.id === employeeId);
      if (existing && existing.qrDataUrl) {
        showEmployeeQRModal(existing);
        return;
      }
      // Check if QRCode library is available
      if (typeof QRCode === 'undefined' && !window.QRCodeLoaded) {
        console.error('QRCode library not loaded');
        showToast("QR code library is still loading. Please wait a moment.", "warning");

        // Wait for library to load
        let checkCount = 0;
        const checkInterval = setInterval(() => {
          checkCount++;
          if (typeof QRCode !== 'undefined' || window.QRCodeLoaded) {
            clearInterval(checkInterval);
            generateEmployeeQROnDemand(employeeId); // Retry
          } else if (checkCount > 10) {
            clearInterval(checkInterval);
            showToast("QR code library failed to load. Please refresh the page.", "error");
          }
        }, 500);
        return;
      }

      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        showToast("Employee not found for QR generation", "error");
        return;
      }

      showToast("Generating QR code...", "info");

      // Simple QR data format
      const qrData = `employee:${employeeId}`;

      console.log(`🔄 Generating on-demand QR for ${employee.name} with enhanced data`);

      // Generate QR code and show immediately
      const qrContainerId = `qrcode-ondemand-${employeeId}`;
      const qrDiv = document.createElement('div');
      qrDiv.id = qrContainerId;
      qrDiv.style.display = 'none';
      document.body.appendChild(qrDiv);

      try {
        let qr;

        // Always use manual QRCode implementation
        console.log('Using manual QRCode implementation');
        qr = new QRCode(qrDiv, {
          text: qrData,
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff'
        });

        setTimeout(() => {
          const qrCanvas = qrDiv.querySelector('canvas');
          if (qrCanvas) {
            const qrDataUrl = qrCanvas.toDataURL();

            // Update the employee object with QR data
            const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
            if (employeeIndex !== -1) {
              employees[employeeIndex].qrDataUrl = qrDataUrl;
              storage.set("employees", employees);
              console.log(`���� QR code generated on-demand for employee ${employeeId}`);

              // Show the QR code modal immediately
              showEmployeeQRModal(employees[employeeIndex]);
              showToast("QR code generated successfully!", "success");
            }
          } else {
            console.error('QR canvas not found after generation, trying online service');
            // Fallback to online QR service
            const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

            // Create a temporary image to test if the service works
            const testImg = new Image();
            testImg.onload = function() {
              // Update employee with service URL
              const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
              if (employeeIndex !== -1) {
                employees[employeeIndex].qrDataUrl = qrServiceUrl;
                storage.set("employees", employees);
                console.log(`✅ QR code generated via online service for employee ${employeeId}`);

                // Show the QR code modal
                showEmployeeQRModal(employees[employeeIndex]);
                showToast("QR code generated successfully!", "success");
              }
            };
            testImg.onerror = function() {
              showToast("QR code generation failed - all methods unavailable", "error");
            };
            testImg.src = qrServiceUrl;
          }

          // Cleanup
          if (document.body.contains(qrDiv)) {
            document.body.removeChild(qrDiv);
          }
        }, 1500); // Increased timeout to ensure QR code is fully generated
      } catch (qrLibraryError) {
        console.error('QRCode library error:', qrLibraryError);

        // Check if this is the online service fallback trigger
        if (qrLibraryError.message === 'Using online service fallback') {
          console.log('QR library unavailable, using online QR service...');

          // Use online QR service as ultimate fallback
          const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

          // Create a temporary image to test if the service works
          const testImg = new Image();
          testImg.onload = function() {
            // Update employee with service URL
            const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
            if (employeeIndex !== -1) {
              employees[employeeIndex].qrDataUrl = qrServiceUrl;
              storage.set("employees", employees);
              console.log(`✅ QR code generated via online service for employee ${employeeId}`);

              // Show the QR code modal
              showEmployeeQRModal(employees[employeeIndex]);
              showToast("QR code generated using online service!", "success");
            }
          };
          testImg.onerror = function() {
            showToast("QR code generation failed - all methods unavailable", "error");
          };
          testImg.src = qrServiceUrl;
        } else {
          showToast("QR code generation failed - library error", "error");
        }

        // Cleanup on error
        if (document.body.contains(qrDiv)) {
          document.body.removeChild(qrDiv);
        }
      }
    } catch (qrError) {
      console.error('On-demand QR code generation failed:', qrError);
      showToast("Failed to generate QR code: " + qrError.message, "error");
    }
  }

  // Separate function to show QR modal
  function showEmployeeQRModal(employee) {
    const modalHTML = `
      <div class="modal" id="qrModal" style="display: flex;">
        <div class="modal-content" style="max-width: 400px; text-align: center;">
          <div class="modal-header">
            <h2>📱 Employee QR Code</h2>
            <button class="modal-close" onclick="closeQRModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e5e7eb;">
              <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="color: white; font-weight: bold; font-size: 16px;">${employee.name.charAt(0)}</span>
                </div>
                <div style="text-align: left;">
                  <h3 style="margin: 0; color: #1f2937; font-size: 18px;">${employee.name}</h3>
                  <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 14px;">${employee.position}</p>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;">
                <span>Employee ID: <strong>${employee.id.toString().padStart(3, "0")}</strong></span>
                <span>Department: <strong>${employee.department || 'N/A'}</strong></span>
              </div>
            </div>

            <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #e5e7eb; margin: 20px 0;">
              <img src="${employee.qrDataUrl}" alt="QR Code for ${employee.name}"
                   style="width: 220px; height: 220px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            </div>

            <div style="margin: 20px 0; padding: 10px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
              <p style="margin: 0; color: #1e40af; font-size: 12px;">
                💡 Scan this QR code for quick employee identification and time tracking
              </p>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
              <button class="btn btn-primary" onclick="printQRCode('${employee.qrDataUrl}', '${employee.name}')" title="Print QR Code">
                🖨️ Print
              </button>
              <button class="btn btn-secondary" onclick="downloadQRCode('${employee.qrDataUrl}', '${employee.name}')" title="Download QR Code">
                💾 Download
              </button>
              <button class="btn btn-secondary" onclick="copyQRData(${employee.id})" title="Copy QR Data">
                📋 Copy Data
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Fallback function when QR library is not available
  function showEmployeeQRFallback(employee) {
    const qrData = `employee:${employee.id}`;

    // Try to generate QR code using online service as fallback
    const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

    const modalHTML = `
      <div class="modal" id="qrModal" style="display: flex;">
        <div class="modal-content" style="max-width: 400px; text-align: center;">
          <div class="modal-header">
            <h2>Employee QR Code</h2>
            <button class="modal-close" onclick="closeQRModal()">&times;</button>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <div style="margin-bottom: 15px;">
              <h3 style="margin: 0; color: #2563eb;">${employee.name}</h3>
              <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">ID: ${employee.id.toString().padStart(3, "0")} | ${employee.position}</p>
            </div>
            <div style="margin: 15px 0;">
              <img src="${qrServiceUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #e5e7eb; border-radius: 8px;"
                   onload="this.style.display='block'; document.getElementById('qr-fallback-message').style.display='none';"
                   onerror="this.style.display='none'; document.getElementById('qr-fallback-message').style.display='block';">

              <div id="qr-fallback-message" style="padding: 20px; background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; display: none;">
                <svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 10px;">
                  <rect x="3" y="3" width="5" height="5" stroke="currentColor" stroke-width="2" fill="none"/>
                  <rect x="16" y="3" width="5" height="5" stroke="currentColor" stroke-width="2" fill="none"/>
                  <rect x="3" y="16" width="5" height="5" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">QR Code Service Unavailable</p>
                <p style="margin: 10px 0 0 0; font-weight: bold; color: #374151;">QR Data: ${qrData}</p>
                <p style="color: #6b7280; font-size: 12px; margin: 10px 0;">
                  You can manually enter this data into any QR code scanner app.
                </p>
              </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
              <button class="btn btn-primary" onclick="downloadQRFromService('${qrServiceUrl}', '${employee.name}')">Download QR</button>
              <button class="btn btn-secondary" onclick="window.location.reload()">Refresh Page</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Download QR code from service
  window.downloadQRFromService = function(url, employeeName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${employeeName.replace(/[^a-z0-9]/gi, '_')}_QR_Code.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("QR code download started!", "success");
  };

  // Helper function to generate initials avatar
  function generateInitialsAvatar(firstName = '', lastName = '') {
    const initials = ((firstName || '').charAt(0) + (lastName || '').charAt(0)).toUpperCase() || 'UK';
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    const backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    // Create a simple data URL for the avatar
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, 150, 150);

    // Draw initials
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 75, 75);

    return canvas.toDataURL();
  }

  // Helper function for creating user avatar (alias)
  function createUserAvatar(firstName, lastName) {
    return generateInitialsAvatar(firstName, lastName);
  }

  function getRolePermissions(role) {
    switch (role) {
      case 'admin':
        return ['dashboard', 'patients', 'inventory', 'employees', 'timetracking', 'records'];
      case 'front_desk':
        return ['dashboard', 'patients', 'inventory', 'timetracking', 'records'];
      case 'employee':
        return ['dashboard', 'timetracking'];
      default:
        return ['dashboard'];
    }
  }

  /**
   * Send login credentials via email using nodemailer on the server
   */
  async function sendCredentialsEmail(employee, password) {
    try {
      const username = employee.username || employee.email.split('@')[0];
      const roleDisplayName = {
        'admin': 'Administrator',
        'frontdesk': 'Front Desk',
        'front_desk': 'Front Desk',
        'employee': 'Employee'
      }[employee.role] || employee.role;

      const response = await fetch('/api/send-credentials-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: employee.email,
          name: employee.name,
          username: username,
          password: password,
          role: roleDisplayName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending credentials email:', error);
      throw error;
    }
  }

  /**
   * Create user credentials on the server for a new employee
   */
  async function createUserCredentialsOnServer(employeeData) {
    try {
      // Validate required fields before sending
      if (!employeeData.email) {
        throw new Error('Email is required for user credentials');
      }
      if (!employeeData.password) {
        throw new Error('Password is required for user credentials');
      }
      if (!employeeData.role) {
        throw new Error('Role is required for user credentials');
      }

      // Map role names to database values
      const roleMapping = {
        'admin': 'admin',
        'frontdesk': 'front_desk',
        'front_desk': 'front_desk',
        'employee': 'employee'
      };

      const mappedRole = roleMapping[employeeData.role.toLowerCase()] || employeeData.role;

      const userData = {
        username: employeeData.email.split('@')[0], // Use email prefix as username
        email: employeeData.email,
        password: employeeData.password,
        role: mappedRole,
        first_name: employeeData.first_name || employeeData.name?.split(' ')[0] || '',
        last_name: employeeData.last_name || employeeData.name?.split(' ')[1] || ''
      };

      console.log('Creating user credentials with data:', {
        ...userData,
        password: '[REDACTED]'
      });

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      }).catch(networkError => {
        console.error('Network error creating user credentials:', networkError);
        throw new Error(`Network error: ${networkError.message}`);
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = await response.json();
          console.error('Failed to create user credentials on server:', {
            status: response.status,
            statusText: response.statusText,
            errorData: errorData
          });

          // Handle different error response formats
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData && errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData && errorData.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData === 'object') {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (parseError) {
          console.warn('Could not parse error response:', parseError);
          // Use the default HTTP error message
        }

        throw new Error(`Failed to create user credentials: ${errorMessage}`);
      } else {
        const result = await response.json();
        console.log('✅ User credentials created successfully:', result);
      }
    } catch (error) {
      // Ensure we have a proper error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error creating user credentials:', errorMessage);

      // Create a new error with a clear message
      throw new Error(`User credentials creation failed: ${errorMessage}`);
    }
  }

  function createUserCredentials(employee) {
    // Get existing users or initialize array
    let users = storage.get("users") || [];

    // Create new user credentials
    const newUser = {
      id: Math.max(...users.map(u => u.id), 0) + 1,
      email: employee.email,
      name: employee.name,
      password: employee.password, // In production, this should be hashed
      role: employee.role,
      permissions: employee.permissions,
      employeeId: employee.id,
      status: employee.status,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    storage.set("users", users);

    console.log(`Created login credentials for ${employee.name} (${employee.email}) with role: ${employee.role}`);
  }

  function updateUserCredentials(employee) {
    // Update existing user credentials
    let users = storage.get("users") || [];
    const userIndex = users.findIndex(u => u.employeeId === employee.id);

    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        email: employee.email,
        name: employee.name,
        password: employee.password, // In production, this should be hashed
        role: employee.role,
        permissions: getRolePermissions(employee.role),
        status: employee.status,
        updatedAt: new Date().toISOString()
      };

      storage.set("users", users);
      console.log(`Updated login credentials for ${employee.name} (${employee.email})`);
    }
  }

  function validatePasswordMatch() {
    const passwordInput = $("#employeePassword");
    const confirmPasswordInput = $("#employeeConfirmPassword");

    if (!passwordInput || !confirmPasswordInput) return;

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Clear previous error states for both inputs
    clearFieldError(passwordInput);
    clearFieldError(confirmPasswordInput);

    let isValid = true;

    // Validate password strength - all new passwords meet minimum requirements
    if (password && password.length < 6) {
      showFieldError(passwordInput, "Password must be at least 6 characters long");
      isValid = false;
    }

    // Validate password match
    if (confirmPassword && password !== confirmPassword) {
      showFieldError(confirmPasswordInput, "Passwords do not match");
      isValid = false;
    }

    return isValid;
  }

  function clearFieldError(input) {
    if (!input) return;

    input.style.borderColor = "";
    const existingError = input.parentNode.querySelector(".field-error");
    if (existingError) {
      existingError.remove();
    }
  }

  function showFieldError(input, message) {
    // Clear existing error
    input.style.borderColor = "";
    const existingError = input.parentNode.querySelector(".field-error");
    if (existingError) {
      existingError.remove();
    }

    // Show new error
    input.style.borderColor = "var(--red-500)";
    const errorDiv = document.createElement("div");
    errorDiv.className = "field-error";
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      color: var(--red-500);
      font-size: 0.75rem;
      margin-top: var(--spacing-1);
    `;

    input.parentNode.appendChild(errorDiv);
  }

  function togglePasswordVisibility(inputId) {
    const input = $("#" + inputId);
    // Handle different ID patterns for toggle buttons
    let toggleBtnId;
    if (inputId === "employeeConfirmPassword") {
      toggleBtnId = "toggleConfirmPassword";
    } else if (inputId === "employeePassword") {
      toggleBtnId = "toggleEmployeePassword";
    } else {
      toggleBtnId = "toggle" + inputId.charAt(0).toUpperCase() + inputId.slice(1);
    }

    const toggleBtn = $("#" + toggleBtnId);

    if (!input || !toggleBtn) {
      console.log(`Toggle button not found: ${toggleBtnId} for input: ${inputId}`);
      return;
    }

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";

    // Update icon
    const svg = toggleBtn.querySelector("svg");
    if (isPassword) {
      // Show "hide" icon (eye with slash)
      svg.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    } else {
      // Show "show" icon (normal eye)
      svg.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    }
  }

  function handleExport() {
    // Show export format selection modal
    showExportModal();
  }

  function showExportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content modal-sm">
        <div class="modal-header">
          <h2>Export Employee Report</h2>
          <button class="modal-close" id="closeExportModal">×</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px;">Choose export format:</p>
          <button class="btn btn-primary" id="exportCSV" style="width: 100%; margin-bottom: 10px;">���� Export as CSV</button>
          <button class="btn btn-secondary" id="exportPDF" style="width: 100%;">📄 Export as PDF</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#closeExportModal').onclick = () => document.body.removeChild(modal);
    modal.querySelector('#exportCSV').onclick = () => { document.body.removeChild(modal); exportToCSV(); };
    modal.querySelector('#exportPDF').onclick = () => { document.body.removeChild(modal); exportToPDF(); };
    modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
  }

  function exportToCSV() {
    const exportData = filteredEmployees.map((emp) => ({
      "Employee Name": emp.name,
      "Position": emp.position,
      "Email": emp.email,
      "Status": emp.status,
      "Department": emp.department || "N/A",
      "Start Date": emp.startDate || "N/A",
      "Salary": emp.salary ? `₱${emp.salary.toLocaleString()}` : "N/A"
    }));

    // Generate CSV content
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => {
        const value = row[header] || '';
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `employees-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("CSV file downloaded successfully!", "success");
  }

  function exportToPDF() {
    const exportData = filteredEmployees.map((emp) => ({
      name: emp.name,
      position: emp.position,
      email: emp.email,
      status: emp.status,
      department: emp.department || "N/A",
      startDate: emp.startDate || "N/A",
      salary: emp.salary ? `₱${emp.salary.toLocaleString()}` : "N/A"
    }));

    // Create PDF content (simplified HTML table)
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Employee Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #2563eb; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .status-active { color: #10b981; }
          .status-leave { color: #f59e0b; }
          .status-inactive { color: #ef4444; }
        </style>
      </head>
      <body>
        <h1>📊 Employee Report - ${new Date().toLocaleDateString()}</h1>
        <table>
          <thead>
            <tr><th>Name</th><th>Position</th><th>Email</th><th>Department</th><th>Status</th><th>Start Date</th><th>Salary</th></tr>
          </thead>
          <tbody>
            ${exportData.map(emp => `
              <tr>
                <td>${emp.name}</td>
                <td>${emp.position}</td>
                <td>${emp.email}</td>
                <td>${emp.department}</td>
                <td class="status-${emp.status}">${emp.status}</td>
                <td>${emp.startDate}</td>
                <td>${emp.salary}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="margin-top: 20px; text-align: center; color: #6b7280;">
          Generated on ${new Date().toLocaleString()} | Total Employees: ${exportData.length}
        </p>
      </body>
      </html>
    `;

    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(pdfContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);

    showToast("PDF export opened in new window for printing/saving", "success");
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

  // Global functions for action buttons
  window.editEmployee = function (id) {
    const employee = employees.find((emp) => emp.id === id);
    if (!employee) return;

    // Populate form with employee data
    const form = $("#employeeForm");
    if (form) {
      // Sanitize and title-case name
      const sanitizedName = String(employee.name || '').replace(/[^A-Za-z\s]/g, '').slice(0, 24);
      const titled = sanitizedName.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
      form.name.value = titled;
      form.email.value = employee.email;
      form.position.value = employee.position;
      form.department.value = employee.department || "";
      form.status.value = employee.status;
      form.startDate.value = employee.startDate || "";
    }

    // Update modal for editing
    const modal = $("#addEmployeeModal");
    const modalTitle = modal.querySelector(".modal-header h2");
    const submitBtn = $("#saveEmployeeBtn");
    const submitBtnText = submitBtn.querySelector(".btn-text");

    if (modalTitle) modalTitle.textContent = "Edit Employee";
    if (submitBtnText) submitBtnText.textContent = "Update Employee";

    currentEditEmployeeId = id;
    showModal("#addEmployeeModal");
  };

  window.deleteEmployee = function (id, name) {
    const deleteEmployeeName = $("#deleteEmployeeName");
    if (deleteEmployeeName) {
      deleteEmployeeName.textContent = name;
    }

    // Store the ID for deletion
    window.employeeToDelete = id;
    showModal("#deleteModal");
  };

  window.viewAttendance = async function (id) {
    const employee = employees.find((emp) => emp.id === id);
    if (employee) {
      await showEmployeeAttendanceModal(employee);
    }
  };

  // Helper function to calculate duration
  function calculateDuration(timeIn, timeOut) {
    const diff = timeOut.getTime() - timeIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  async function showEmployeeAttendanceModal(employee) {
    // Get real attendance data for this employee from multiple sources
    let employeeEntries = [];

    try {
      // Try to get from server API first
      const response = await fetch(`/api/timetracking/employee/${employee.id}`);
      if (response.ok) {
        employeeEntries = await response.json();
        console.log('✅ Loaded attendance from server:', employeeEntries.length);
      } else {
        console.warn('Server unavailable, using localStorage fallback');
        throw new Error('Server unavailable');
      }
    } catch (error) {
      // Fallback to localStorage and attendance data
      const attendance = storage.get("attendance") || [];
      const employeeAttendance = attendance.filter(record =>
        record.employeeEmail === employee.email
      );

      // Convert attendance records to time entry format
      employeeEntries = employeeAttendance.map(record => ({
        id: `${employee.id}-${record.date}`,
        employeeId: employee.id,
        date: record.date,
        timeIn: record.timeIn ? new Date(record.timeIn).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) : '-',
        timeOut: record.timeOut ? new Date(record.timeOut).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) : '-',
        duration: record.timeIn && record.timeOut ?
          calculateDuration(new Date(record.timeIn), new Date(record.timeOut)) : '-',
        attendanceStatus: record.status || 'present'
      }));

      console.log('⚠️ Using localStorage fallback:', employeeEntries.length);
    }

    // Sort by date (most recent first)
    employeeEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate summary counts
    const totalDays = employeeEntries.length;
    const onTimeCount = employeeEntries.filter(e => (e.attendanceStatus === 'on-time' || e.attendanceStatus === 'present')).length;
    const lateCount = employeeEntries.filter(e => e.attendanceStatus === 'late').length;
    const absentCount = employeeEntries.filter(e => e.attendanceStatus === 'absent').length;
    const dayOffCount = employeeEntries.filter(e => e.attendanceStatus === 'day_off').length;

    // Create modal HTML
  const modalHTML = `
      <div class="modal" id="attendanceModal" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal-content modal-lg" style="max-width: 900px;">
          <div class="modal-header">
            <h2>Attendance Sheet - ${employee.name}</h2>
            <button class="modal-close" onclick="closeAttendanceModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="employee-info" style="margin-bottom: 20px; padding: 15px; background: var(--gray-50, #f9fafb); border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${employee.avatar}" alt="${employee.name}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
                <div>
                  <h3 style="margin: 0; font-size: 18px; color: var(--gray-900, #111827);">${employee.name}</h3>
                  <p style="margin: 0; color: var(--gray-600, #6b7280); font-size: 14px;">ID: ${employee.id.toString().padStart(3, "0")} | ${employee.position}</p>
                </div>
              </div>
            </div>

            <div class="attendance-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 12px;">
              <div class="summary-box" data-filter="all" style="padding: 10px; background: var(--blue-50, #eff6ff); border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;">
                <div style="font-size: 20px; font-weight: bold; color: var(--blue-600, #2563eb);">${totalDays}</div>
                <div style="font-size: 11px; color: var(--gray-600, #6b7280); text-transform: uppercase;">Total Days</div>
              </div>
              <div class="summary-box" data-filter="on-time" style="padding: 10px; background: var(--green-50, #f0fdf4); border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;">
                <div style="font-size: 20px; font-weight: bold; color: var(--green-600, #16a34a);">${onTimeCount}</div>
                <div style="font-size: 11px; color: var(--gray-600, #6b7280); text-transform: uppercase;">On Time</div>
              </div>
              <div class="summary-box" data-filter="late" style="padding: 10px; background: var(--yellow-50, #fefce8); border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;">
                <div style="font-size: 20px; font-weight: bold; color: var(--yellow-600, #ca8a04);">${lateCount}</div>
                <div style="font-size: 11px; color: var(--gray-600, #6b7280); text-transform: uppercase;">Late</div>
              </div>
              <div class="summary-box" data-filter="absent" style="padding: 10px; background: var(--red-50, #fef2f2); border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;">
                <div style="font-size: 20px; font-weight: bold; color: var(--red-600, #dc2626);">${absentCount}</div>
                <div style="font-size: 11px; color: var(--gray-600, #6b7280); text-transform: uppercase;">Absent</div>
              </div>
              <div class="summary-box" data-filter="day_off" style="padding: 10px; background: var(--gray-50, #f8fafc); border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;">
                <div style="font-size: 20px; font-weight: bold; color: var(--gray-800, #374151);">${dayOffCount}</div>
                <div style="font-size: 11px; color: var(--gray-600, #6b7280); text-transform: uppercase;">Day Off</div>
              </div>
            </div>

            <div class="attendance-records">
              <h3 style="margin-bottom: 10px; font-size: 16px;">Attendance Records</h3>
              <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                <label style="font-size:12px; color:var(--gray-600);">Start Date</label>
                <input type="date" id="attendanceStartDate" class="form-input" />
                <label style="font-size:12px; color:var(--gray-600);">End Date</label>
                <input type="date" id="attendanceEndDate" class="form-input" />
                <button id="applyAttendanceRange" class="btn btn-primary" style="margin-left:8px;">Apply Range</button>
                <button id="clearAttendanceRange" class="btn btn-secondary">Cancel</button>
              </div>
              ${employeeEntries.length > 0 ? `
                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                      <tr style="background: var(--gray-50, #f9fafb);">
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--gray-200, #e5e7eb);">Date</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--gray-200, #e5e7eb);">Time In</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--gray-200, #e5e7eb);">Time Out</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--gray-200, #e5e7eb);">Duration</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--gray-200, #e5e7eb);">Status</th>
                      </tr>
                    </thead>
                    <tbody id="attendanceTableBody">
                    </tbody>
                  </table>
                </div>

                <div id="attendancePagination" style="display:flex; gap:8px; justify-content:center; align-items:center; margin-top:12px;"></div>
              ` : `
                <div style="text-align: center; padding: 40px; color: var(--gray-500, #6b7280);">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;">
                    <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M21 12c.552 0 1-.448 1-1V5c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1h18z" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  <p>No attendance records found for this employee.</p>
                </div>
              `}
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="exportEmployeeAttendance(${employee.id})">Export Report</button>
            <button class="btn btn-secondary" onclick="closeAttendanceModal()">Close</button>
          </div>
        </div>
      </div>
    `;

    // Insert modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add click handlers for attendance filter
    setTimeout(() => {
      const summaryBoxes = document.querySelectorAll('.summary-box');
      const tableBody = document.querySelector('#attendanceModal tbody');

      summaryBoxes.forEach(box => {
        box.addEventListener('click', () => {
          const filter = box.getAttribute('data-filter');

          // Update active state
          summaryBoxes.forEach(b => b.style.borderColor = 'transparent');
          box.style.borderColor = 'var(--gray-400, #9ca3af)';
          box.style.backgroundColor = box.style.backgroundColor.replace('50,', '100,');

          // Filter table rows
          if (tableBody) {
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => {
              if (filter === 'all') {
                row.style.display = '';
              } else {
                const statusCell = row.querySelector('td:last-child span');
                if (statusCell) {
                  const rowStatus = statusCell.textContent.toLowerCase().trim();
                  const matches = (filter === 'on-time' && (rowStatus === 'on-time' || rowStatus === 'present')) ||
                                 (filter === 'late' && rowStatus === 'late') ||
                                 (filter === 'absent' && rowStatus === 'absent');
                  row.style.display = matches ? '' : 'none';
                }
              }
            });
          }
        });
      });

      // Set initial active state on "Total Days"
      summaryBoxes[0].style.borderColor = 'var(--gray-400, #9ca3af)';

      // Pagination and table rendering
      const perPage = 7;
      let currentAttendancePage = 1;
      let filteredEntries = employeeEntries.slice();
      const tableBodyEl = document.getElementById('attendanceTableBody');
      const paginationEl = document.getElementById('attendancePagination');
      const startInput = document.getElementById('attendanceStartDate');
      const endInput = document.getElementById('attendanceEndDate');
      const applyBtn = document.getElementById('applyAttendanceRange');
      const clearBtn = document.getElementById('clearAttendanceRange');

      function renderAttendancePage() {
        if (!tableBodyEl) return;
        const totalPages = Math.max(1, Math.ceil(filteredEntries.length / perPage));
        if (currentAttendancePage > totalPages) currentAttendancePage = totalPages;
        const start = (currentAttendancePage - 1) * perPage;
        const pageItems = filteredEntries.slice(start, start + perPage);
        tableBodyEl.innerHTML = pageItems.map(entry => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid var(--gray-100, #f3f4f6);">${formatDate(entry.date)}</td>
            <td style="padding: 12px; border-bottom: 1px solid var(--gray-100, #f3f4f6);">${entry.timeIn || '-'}</td>
            <td style="padding: 12px; border-bottom: 1px solid var(--gray-100, #f3f4f6);">${entry.timeOut || '-'}</td>
            <td style="padding: 12px; border-bottom: 1px solid var(--gray-100, #f3f4f6);">${entry.duration || '-'}</td>
            <td style="padding: 12px; border-bottom: 1px solid var(--gray-100, #f3f4f6);">
              <span style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; background: ${getStatusColor(entry.attendanceStatus).bg}; color: ${getStatusColor(entry.attendanceStatus).text};">${(entry.attendanceStatus || 'present').charAt(0).toUpperCase() + (entry.attendanceStatus || 'present').slice(1)}</span>
            </td>
          </tr>
        `).join('');

        // Render pagination controls
        if (paginationEl) {
          paginationEl.innerHTML = '';
          const prev = document.createElement('button');
          prev.className = 'btn btn-secondary btn-sm';
          prev.textContent = 'Prev';
          prev.disabled = currentAttendancePage === 1;
          prev.addEventListener('click', () => { currentAttendancePage = Math.max(1, currentAttendancePage - 1); renderAttendancePage(); });
          const next = document.createElement('button');
          next.className = 'btn btn-secondary btn-sm';
          next.textContent = 'Next';
          next.disabled = currentAttendancePage === totalPages;
          next.addEventListener('click', () => { currentAttendancePage = Math.min(totalPages, currentAttendancePage + 1); renderAttendancePage(); });
          const info = document.createElement('span');
          info.style.margin = '0 8px';
          info.textContent = `${currentAttendancePage} / ${totalPages}`;
          paginationEl.appendChild(prev);
          paginationEl.appendChild(info);
          paginationEl.appendChild(next);
        }
      }

      renderAttendancePage();

      // Apply range filter
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          const s = startInput.value ? new Date(startInput.value) : null;
          const e = endInput.value ? new Date(endInput.value) : null;
          filteredEntries = employeeEntries.filter(en => {
            const d = new Date(en.date);
            if (s && d < s) return false;
            if (e && d > e) return false;
            return true;
          });
          currentAttendancePage = 1;
          renderAttendancePage();
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          startInput.value = '';
          endInput.value = '';
          filteredEntries = employeeEntries.slice();
          currentAttendancePage = 1;
          renderAttendancePage();
        });
      }

      // Update summary-box clicks to filter with pagination
      document.querySelectorAll('.summary-box').forEach(box => {
        box.addEventListener('click', () => {
          const filter = box.getAttribute('data-filter');
          if (filter === 'all') filteredEntries = employeeEntries.slice();
          else if (filter === 'on-time') filteredEntries = employeeEntries.filter(e => (e.attendanceStatus === 'on-time' || e.attendanceStatus === 'present'));
          else if (filter === 'late') filteredEntries = employeeEntries.filter(e => e.attendanceStatus === 'late');
          else if (filter === 'absent') filteredEntries = employeeEntries.filter(e => e.attendanceStatus === 'absent');
          else if (filter === 'day_off') filteredEntries = employeeEntries.filter(e => e.attendanceStatus === 'day_off');
          currentAttendancePage = 1; renderAttendancePage();
        });
      });

    }, 100);
  }

  function getStatusColor(status) {
    switch (status) {
      case 'on-time':
        return { bg: 'var(--green-100, #dcfce7)', text: 'var(--green-800, #166534)' };
      case 'late':
        return { bg: 'var(--yellow-100, #fef3c7)', text: 'var(--yellow-800, #92400e)' };
      case 'absent':
        return { bg: 'var(--red-100, #fee2e2)', text: 'var(--red-800, #991b1b)' };
      case 'day_off':
        return { bg: 'var(--purple-100, #f3e8ff)', text: 'var(--purple-800, #6b21a8)' };
      default:
        return { bg: 'var(--gray-100, #f3f4f6)', text: 'var(--gray-800, #1f2937)' };
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  window.closeAttendanceModal = function () {
    const modal = document.getElementById('attendanceModal');
    if (modal) {
      modal.remove();
    }
  };

  window.exportEmployeeAttendance = function (employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    const timeEntries = storage.get("timeEntries") || [];
    const employeeEntries = timeEntries.filter(entry => entry.employeeId === employee.id);

    // Create CSV content
    const csvContent = [
      ['Date', 'Time In', 'Time Out', 'Duration', 'Status'],
      ...employeeEntries.map(entry => [
        entry.date,
        entry.timeIn || '',
        entry.timeOut || '',
        entry.duration || '',
        entry.attendanceStatus || 'present'
      ])
    ].map(row => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${employee.name.replace(/\s+/g, '_')}_Attendance_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast(`Attendance report exported for ${employee.name}`, 'success');
  };

  window.goToPage = function (page) {
    currentPage = page;
    renderEmployeesTable();
    updatePagination();
  };

  async function confirmDelete() {
    const id = window.employeeToDelete;
    console.log('🔍 Attempting to delete employee with ID:', id, typeof id);

    if (id) {
      try {
        // Find employee data before deletion for logging
        const employeeToDelete = employees.find(emp => emp.id === id || emp.id === parseInt(id));
        console.log('🔍 Employee found in local data:', employeeToDelete);

        if (!employeeToDelete) {
          throw new Error('Employee not found in local data');
        }

        // Ensure ID is properly formatted for the API call
        const employeeId = parseInt(id);
        if (isNaN(employeeId)) {
          throw new Error('Invalid employee ID format');
        }

        console.log('🔍 Making DELETE request to:', `/api/employees/${employeeId}`);

        // Archive employee on server database first
        const response = await fetch(`/api/sqlite/employees/${employeeId}/archive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Employee archived via UI'
          })
        });

        console.log('Archive response status:', response.status, response.statusText);

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json();
            console.log('🔍 Error response data:', errorData);
            errorMessage = errorData.error || errorData.message || response.statusText;
          } catch (parseError) {
            console.log('�� Failed to parse error response:', parseError);
            errorMessage = response.statusText || `HTTP ${response.status}`;
          }
          throw new Error(`Failed to archive employee: ${errorMessage}`);
        }

        console.log('�� Employee deleted from database:', employeeId);

        // Remove from local array only after successful database deletion
        employees = employees.filter((emp) => emp.id !== employeeId && emp.id !== id);

        // Log employee deletion
        if (window.auditLogger && employeeToDelete) {
          await window.auditLogger.logEmployee('delete', {
            id: employeeToDelete.id,
            name: employeeToDelete.name,
            email: employeeToDelete.email,
            role: employeeToDelete.role,
            department: employeeToDelete.department,
            ...employeeToDelete
          }, {
            reason: 'Employee record deletion'
          });
        }

        applyFilters();
        showToast("Employee deleted successfully", "success");
        hideDeleteModal();

        // Refresh employee data in timetracking page if function is available
        if (typeof window.refreshEmployeeData === 'function') {
          window.refreshEmployeeData();
        }
      } catch (error) {
        console.error('❌ Failed to delete employee from server:', error);

        // If server deletion failed, try to delete from local storage as fallback
        try {
          console.log('⚠️ Attempting fallback deletion from local storage...');

          // Remove from local employees array
          const originalLength = employees.length;
          employees = employees.filter((emp) => emp.id !== id && emp.id !== parseInt(id));

          // Also remove from localStorage
          storage.set('employees', employees);

          if (employees.length < originalLength) {
            console.log('✅ Employee deleted from local storage as fallback');
            applyFilters();
            showToast('Employee deleted (local only - server may be unavailable)', 'warning');
          } else {
            showToast(`Failed to delete employee: ${error.message}`, 'error');
          }
        } catch (fallbackError) {
          console.error('�� Fallback deletion also failed:', fallbackError);
          showToast(`Failed to delete employee: ${error.message}`, 'error');
        }

        hideDeleteModal(); // Ensure modal is closed even on error
      } finally {
        // Always reset the delete target
        window.employeeToDelete = null;
      }
    } else {
      console.warn('No employee ID provided for deletion');
      showToast('No employee selected for deletion', 'warning');
      hideDeleteModal();
    }
  }

  function hideDeleteModal() {
    hideModal("#deleteModal");
    window.employeeToDelete = null;
  }

  // Show employee archive modal
  window.showEmployeeArchiveModal = function() {
    loadAndDisplayArchiveModal();
  };

  async function loadAndDisplayArchiveModal() {
    const modal = document.getElementById('employeeArchiveModal');
    if (!modal) {
      showToast('Archive modal not found', 'error');
      return;
    }

    try {
      const response = await fetch('/api/sqlite/employees/archive/list');
      if (!response.ok) {
        throw new Error('Failed to fetch archived employees');
      }

      const archivedEmployees = await response.json();
      displayArchivedEmployees(archivedEmployees);
      showModal('#employeeArchiveModal');
    } catch (error) {
      console.error('Error loading archived employees:', error);
      showToast('Failed to load archived employees', 'error');
    }
  }

  function displayArchivedEmployees(employees) {
    const tableBody = document.getElementById('archiveEmployeesTableBody');
    const noMessage = document.getElementById('noArchiveMessage');

    if (!tableBody) return;

    if (!employees || employees.length === 0) {
      tableBody.innerHTML = '';
      noMessage.style.display = 'block';
      return;
    }

    noMessage.style.display = 'none';
    tableBody.innerHTML = employees.map(emp => `
      <tr>
        <td>${emp.name || 'N/A'}</td>
        <td>${emp.email || 'N/A'}</td>
        <td>${emp.position || 'N/A'}</td>
        <td>${emp.status || 'N/A'}</td>
        <td>${new Date(emp.archived_at).toLocaleDateString()}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view" onclick="viewArchivedEmployee(${emp.id})" title="View Details">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="action-btn" onclick="exportArchivedEmployee(${emp.id}, '${emp.name}')" title="Export Data">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7,10 12,15 17,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // View details of an archived employee in a modal
  window.viewArchivedEmployee = function(employeeId) {
    fetch('/api/sqlite/employees/archive/list')
      .then(res => res.json())
      .then(employees => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) {
          showToast('Employee not found', 'error');
          return;
        }

        let dataSnapshot = {};
        try {
          dataSnapshot = emp.data_snapshot ? JSON.parse(emp.data_snapshot) : emp;
        } catch (e) {
          dataSnapshot = emp;
        }

        const contentEl = document.getElementById('archivedEmployeeDetailsContent');
        if (!contentEl) return;

        // Get attendance records for this employee
        let attendanceRecords = [];
        try {
          const allAttendance = storage.get('attendance') || [];
          attendanceRecords = allAttendance.filter(record =>
            String(record.employeeId) === String(employeeId) ||
            String(record.employee_id) === String(employeeId)
          ).sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp));
        } catch (e) {
          console.warn('Could not load attendance records:', e);
        }

        const attendanceHTML = attendanceRecords.length > 0
          ? attendanceRecords.slice(0, 20).map(record => `
              <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 8px; background-color: #f9fafb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong style="color: #1f2937;">${new Date(record.date || record.timestamp).toLocaleDateString()}</strong>
                  <span style="font-size: 12px; color: #6b7280; background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${record.status || 'Present'}</span>
                </div>
                ${record.timeIn ? `<div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
                  <strong>Clock In:</strong> ${record.timeIn}
                </div>` : ''}
                ${record.timeOut ? `<div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
                  <strong>Clock Out:</strong> ${record.timeOut}
                </div>` : ''}
                ${record.duration ? `<div style="font-size: 14px; color: #374151;">
                  <strong>Duration:</strong> ${record.duration}
                </div>` : ''}
              </div>
            `).join('')
          : '<p style="color: #6b7280; text-align: center; padding: 16px;">No attendance records found</p>';

        const detailsHTML = `
          <div class="details-group">
            <div class="detail-row">
              <label class="detail-label">Name</label>
              <span class="detail-value">${emp.name || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <label class="detail-label">Email</label>
              <span class="detail-value">${emp.email || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <label class="detail-label">Position</label>
              <span class="detail-value">${emp.position || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <label class="detail-label">Status</label>
              <span class="detail-value"><span class="status-badge ${(emp.status || '').toLowerCase()}">${emp.status || 'N/A'}</span></span>
            </div>
            <div class="detail-row">
              <label class="detail-label">Archived Date</label>
              <span class="detail-value">${new Date(emp.archived_at).toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <label class="detail-label">Archive Reason</label>
              <span class="detail-value">${emp.archived_reason || 'No reason provided'}</span>
            </div>
            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">Attendance History</h3>
              <div style="max-height: 300px; overflow-y: auto;">
                ${attendanceHTML}
              </div>
              ${attendanceRecords.length > 20 ? `<p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 8px;">Showing latest 20 records</p>` : ''}
            </div>
          </div>
        `;

        contentEl.innerHTML = detailsHTML;
        showModal('#archivedEmployeeDetailsModal');
      })
      .catch(error => {
        console.error('Error viewing archived employee:', error);
        showToast('Failed to load employee details', 'error');
      });
  };

  // Export archived employee data
  window.exportArchivedEmployee = function(employeeId, employeeName) {
    fetch('/api/sqlite/employees/archive/list')
      .then(res => res.json())
      .then(employees => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) {
          showToast('Employee not found', 'error');
          return;
        }

        let dataSnapshot = {};
        try {
          dataSnapshot = emp.data_snapshot ? JSON.parse(emp.data_snapshot) : emp;
        } catch (e) {
          dataSnapshot = emp;
        }

        const exportData = {
          ...emp,
          data_snapshot: dataSnapshot
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `employee_archive_${employeeName.replace(/\s+/g, '_')}_${new Date().getTime()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Employee data exported successfully', 'success');
      })
      .catch(error => {
        console.error('Error exporting employee data:', error);
        showToast('Failed to export employee data', 'error');
      });
  };

  // Setup archive modal handlers
  function setupArchiveModalHandlers() {
    // Details modal handlers
    const closeDetailsBtn = document.getElementById('closeDetailsModalBtn');
    const closeDetailsBtnBottom = document.getElementById('closeDetailsBtn');
    const detailsModal = document.getElementById('archivedEmployeeDetailsModal');

    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener('click', () => hideModal('#archivedEmployeeDetailsModal'));
    }

    if (closeDetailsBtnBottom) {
      closeDetailsBtnBottom.addEventListener('click', () => hideModal('#archivedEmployeeDetailsModal'));
    }

    if (detailsModal) {
      detailsModal.addEventListener('click', function(e) {
        if (e.target === detailsModal) {
          hideModal('#archivedEmployeeDetailsModal');
        }
      });
    }

    // Archive list modal handlers
    const closeArchiveBtn = document.getElementById('closeArchiveModalBtn');
    const closeArchiveBtnBottom = document.getElementById('closeArchiveBtn');
    const archiveModal = document.getElementById('employeeArchiveModal');
    const exportArchiveBtn = document.getElementById('exportArchiveBtn');

    if (closeArchiveBtn) {
      closeArchiveBtn.addEventListener('click', () => hideModal('#employeeArchiveModal'));
    }

    if (closeArchiveBtnBottom) {
      closeArchiveBtnBottom.addEventListener('click', () => hideModal('#employeeArchiveModal'));
    }

    if (archiveModal) {
      archiveModal.addEventListener('click', function(e) {
        if (e.target === archiveModal) {
          hideModal('#employeeArchiveModal');
        }
      });
    }

    if (exportArchiveBtn) {
      exportArchiveBtn.addEventListener('click', () => {
        fetch('/api/sqlite/employees/archive/list')
          .then(res => res.json())
          .then(employees => {
            if (!employees || employees.length === 0) {
              showToast('No archived employees to export', 'warning');
              return;
            }

            const dataStr = JSON.stringify(employees, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `employee_archive_${new Date().getTime()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('Archive exported successfully', 'success');
          })
          .catch(error => {
            console.error('Error exporting archive:', error);
            showToast('Failed to export archive', 'error');
          });
      });
    }
  }

  // Global function for showing employee QR code
  window.showEmployeeQR = function(id) {
    const employee = employees.find(emp => emp.id === id);
    if (!employee) {
      showToast("Employee not found", "error");
      return;
    }

    console.log(`📱 Showing QR code for employee: ${employee.name} (ID: ${id})`);

    // If QR code already exists, show it immediately
    if (employee.qrDataUrl) {
      console.log(`✅ QR code exists for employee ${employee.name}, showing modal`);
      showEmployeeQRModal(employee);
      return;
    }

    // Check if QRCode library is available
    if (typeof QRCode === 'undefined' && !window.QRCodeLoaded) {
      console.log('⚠️ QRCode library not available, using fallback');
      showEmployeeQRFallback(employee);
      return;
    }

    // Generate QR code on-demand
    console.log(`🔄 Generating QR code for employee ${employee.name} (ID: ${id})`);
    generateEmployeeQROnDemand(id);
  };

  window.closeQRModal = function() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.remove();
  };

  window.printQRCode = function(dataUrl, employeeName) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Employee QR Code - ${employeeName}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin: 50px; }
            .header { margin-bottom: 30px; }
            .qr-container { border: 2px solid #2563eb; padding: 20px; border-radius: 10px; display: inline-block; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ink and Arch Medical Clinic</h1>
            <h2>Employee QR Code</h2>
            <p><strong>${employeeName}</strong></p>
          </div>
          <div class="qr-container">
            <img src="${dataUrl}" style="width: 200px; height: 200px;"/>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  window.downloadQRCode = function(dataUrl, employeeName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${employeeName.replace(/[^a-z0-9]/gi, '_')}_QR_Code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("QR code downloaded successfully!", "success");
  };


  // Copy QR data to clipboard
  window.copyQRData = function(employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
      showToast("Employee not found", "error");
      return;
    }

    const qrData = `employee:${employeeId}`;

    // Try to copy to clipboard
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(qrData).then(() => {
        showToast("QR data copied to clipboard!", "success");
      }).catch(() => {
        fallbackCopyTextToClipboard(qrData);
      });
    } else {
      fallbackCopyTextToClipboard(qrData);
    }
  };

  // Fallback copy function for older browsers
  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast("QR data copied to clipboard!", "success");
      } else {
        showToast("Failed to copy QR data", "error");
      }
    } catch (err) {
      showToast("Failed to copy QR data", "error");
    }

    document.body.removeChild(textArea);
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Escape key to close modals
    if (e.key === "Escape") {
      hideAddEmployeeModal();
      hideDeleteModal();
    }

    // Ctrl/Cmd + N to add new employee
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      showAddEmployeeModal();
    }

    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      const searchInput = $("#searchInput");
      if (searchInput) {
        searchInput.focus();
      }
    }
  });

  // ===================== AWOL MANAGEMENT =====================
  function getAwolSettings() {
    const s = storage.get('awolSettings') || {};
    return {
      enabled: s.enabled !== false,
      thresholdDays: Number.isFinite(s.thresholdDays) ? s.thresholdDays : 5,
      mode: s.mode ? s.mode : 'both'
    };
  }
  function saveAwolSettings(settings){ storage.set('awolSettings', settings); }
  function getAttendanceAll() { return storage.get('attendance') || []; }
  function formatDateShort(iso){ try { return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});} catch(e){ return '—'; } }
  function computeAbsenceStatsForEmployee(emp) {
    const attendance = getAttendanceAll().filter(r => r.employeeEmail === emp.email);
    const today = new Date();
    const byDate = new Map(attendance.map(r => [r.date, r]));
    // walk back counting consecutive absences ending yesterday/today
    let consecutive = 0; let since = null;
    for (let i=0; i<365; i++) {
      const d = new Date(today); d.setDate(today.getDate()-i);
      const ds = d.toISOString().split('T')[0];
      const rec = byDate.get(ds);
      if (!rec) { break; }
      if (rec.status === 'absent') { consecutive++; since = ds; } else { break; }
    }
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(today.getFullYear()-1);
    const absencesYear = attendance.filter(r => r.status==='absent' && new Date(r.date)>=oneYearAgo).length;
    return { consecutiveAbsentDays: consecutive, since, absences12mo: absencesYear };
  }
  function buildAwolTableRows(searchTerm = '') {
    const settings = getAwolSettings();
    const term = String(searchTerm || '').toLowerCase().trim();
    // Use full employees list for AWOL review (do not rely on filteredEmployees)
    const list = employees.filter(emp => {
      if (!term) return true;
      return (
        (emp.name || '').toLowerCase().includes(term) ||
        (emp.email || '').toLowerCase().includes(term) ||
        (emp.position || '').toLowerCase().includes(term)
      );
    });

    return list.map(emp => {
      const stats = computeAbsenceStatsForEmployee(emp);
      const isConsecutiveAwol = stats.consecutiveAbsentDays >= settings.thresholdDays;
      const isAccumulatedAwol = stats.absences12mo >= settings.thresholdDays;
      const isAwol = settings.enabled && (isConsecutiveAwol || isAccumulatedAwol);
      return `
        <tr style="cursor: pointer;" onclick="viewEmployeeAbsences(${emp.id}, '${emp.name}', '${emp.email}')">
          <td>
            <div class="employee-info">
              <div class="employee-details"><div class="employee-name">${emp.name}</div><div class="employee-id">ID: ${emp.id.toString().padStart(3,'0')}</div></div>
            </div>
          </td>
          <td>${stats.consecutiveAbsentDays}</td>
          <td>${stats.since ? formatDateShort(stats.since) : '—'}</td>
          <td>${stats.absences12mo}</td>
          <td>${isAwol ? '<span class="status-badge inactive">AWOL</span>' : '<span class="status-badge active">OK</span>'}</td>
        </tr>`;
    }).join('');
  }
  function viewEmployeeAbsences(empId, empName, empEmail) {
    const attendance = getAttendanceAll().filter(r => r.employeeEmail === empEmail && r.status === 'absent').sort((a, b) => new Date(b.date) - new Date(a.date));

    if (attendance.length === 0) {
      showToast(`${empName} has no absences`, 'info');
      return;
    }

    const absenceTable = `
      <div style="max-height: 400px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="position: sticky; top: 0; background: var(--gray-100);">
            <tr>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--gray-300);">Date</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--gray-300);">Status</th>
            </tr>
          </thead>
          <tbody>
            ${attendance.map(rec => `
              <tr style="border-bottom: 1px solid var(--gray-200);">
                <td style="padding: 12px;">${formatDateShort(rec.date)}</td>
                <td style="padding: 12px;"><span class="status-badge inactive">Absent</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Absence History - ${empName}</h2>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          ${absenceTable}
        </div>
        <div class="modal-footer" style="padding: 20px; text-align: right; border-top: 1px solid var(--gray-200);">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }
  function showManageEmployeesModal(){
    try {
      const settings = getAwolSettings();
      const modal = document.getElementById('manageEmployeesModal');
      if (!modal) return;
      const thr = document.getElementById('awolThreshold'); if (thr) thr.value = settings.thresholdDays;
      const modeSel = document.getElementById('awolConsecutive'); if (modeSel) modeSel.value = settings.mode;
      const en = document.getElementById('awolEnabled'); if (en) en.checked = !!settings.enabled;
      const tbody = document.getElementById('awolTableBody');
      if (tbody) {
        try {
          tbody.innerHTML = buildAwolTableRows();
        } catch (tableErr) {
          console.error('Error building AWOL table rows:', tableErr);
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Error loading data</td></tr>';
        }

        // Wire AWOL search input to filter the AWOL table without affecting main filters
        const awolSearch = document.getElementById('awolSearch');
        if (awolSearch) {
          awolSearch.value = '';
          awolSearch.addEventListener('input', function() {
            try {
              const term = this.value;
              tbody.innerHTML = buildAwolTableRows(term);
            } catch (err) {
              console.error('AWOL search error:', err);
            }
          });
        }
      }
      const saveBtn = document.getElementById('saveAwolSettingsBtn');
      if (saveBtn){ saveBtn.onclick = () => {
        try {
          const modeValue = document.getElementById('awolConsecutive')?.value;
          const newSettings = {
            enabled: document.getElementById('awolEnabled')?.checked !== false,
            thresholdDays: parseInt(document.getElementById('awolThreshold')?.value || '5',10),
            mode: modeValue || 'both'
          };
          saveAwolSettings(newSettings);
          if (tbody) tbody.innerHTML = buildAwolTableRows();
          showToast('AWOL settings saved','success');
        } catch (saveErr) {
          console.error('Error saving AWOL settings:', saveErr);
          showToast('Error saving settings', 'error');
        }
      }; }
      const closeBtn = document.getElementById('closeAwolBtn'); if (closeBtn) closeBtn.onclick = () => hideModal('#manageEmployeesModal');
      const xBtn = document.getElementById('closeManageEmployeesBtn'); if (xBtn) xBtn.onclick = () => hideModal('#manageEmployeesModal');
      showModal('#manageEmployeesModal');
    } catch (error) {
      console.error('Error opening Manage Employees modal:', error);
      showToast('Error opening modal', 'error');
    }
  }

  // ============================================================================
  // PORTRAIT CAMERA FUNCTIONALITY
  // ============================================================================

  let cameraStream = null;
  let currentPortraitData = null;

  function setupPortraitCameraListeners() {
    const startCameraBtn = document.getElementById('startCameraBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const retakePhotoBtn = document.getElementById('retakePhotoBtn');
    const clearPortraitBtn = document.getElementById('clearPortraitBtn');

    if (startCameraBtn) {
      startCameraBtn.addEventListener('click', startCamera);
    }
    if (capturePhotoBtn) {
      capturePhotoBtn.addEventListener('click', capturePortrait);
    }
    if (retakePhotoBtn) {
      retakePhotoBtn.addEventListener('click', retakePortrait);
    }
    if (clearPortraitBtn) {
      clearPortraitBtn.addEventListener('click', clearPortrait);
    }
  }

  async function startCamera(e) {
    e.preventDefault();

    try {
      // Request camera access
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 400 },
          height: { ideal: 600 }
        }
      });

      // Show camera preview
      const cameraPreview = document.getElementById('cameraPreview');
      const noPortraitPlaceholder = document.getElementById('noPortraitPlaceholder');
      const portraitImage = document.getElementById('portraitImage');
      const startCameraBtn = document.getElementById('startCameraBtn');
      const capturePhotoBtn = document.getElementById('capturePhotoBtn');

      if (cameraPreview) {
        cameraPreview.srcObject = cameraStream;
        cameraPreview.style.display = 'block';
        portraitImage.style.display = 'none';
        if (noPortraitPlaceholder) noPortraitPlaceholder.style.display = 'none';
      }

      if (startCameraBtn) startCameraBtn.style.display = 'none';
      if (capturePhotoBtn) capturePhotoBtn.style.display = 'inline-flex';

      showToast('Camera started. Click "Capture" to take a photo.', 'info');
    } catch (error) {
      console.error('Error accessing camera:', error);
      if (error.name === 'NotAllowedError') {
        showToast('Camera access denied. Please allow camera access in your browser settings.', 'error');
      } else if (error.name === 'NotFoundError') {
        showToast('No camera found on your device.', 'error');
      } else {
        showToast('Error accessing camera: ' + error.message, 'error');
      }
    }
  }

  function capturePortrait(e) {
    e.preventDefault();

    const cameraPreview = document.getElementById('cameraPreview');
    const portraitImage = document.getElementById('portraitImage');
    const canvas = document.createElement('canvas');

    if (cameraPreview && cameraPreview.srcObject) {
      canvas.width = cameraPreview.videoWidth;
      canvas.height = cameraPreview.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(cameraPreview, 0, 0);

      // Convert to data URL
      const portraitDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      currentPortraitData = portraitDataUrl;

      // Store in hidden input
      document.getElementById('portraitData').value = portraitDataUrl;

      // Display portrait
      portraitImage.src = portraitDataUrl;
      portraitImage.style.display = 'block';
      cameraPreview.style.display = 'none';

      // Stop camera stream
      stopCamera();

      // Update buttons
      const startCameraBtn = document.getElementById('startCameraBtn');
      const capturePhotoBtn = document.getElementById('capturePhotoBtn');
      const retakePhotoBtn = document.getElementById('retakePhotoBtn');
      const clearPortraitBtn = document.getElementById('clearPortraitBtn');

      if (startCameraBtn) startCameraBtn.style.display = 'inline-flex';
      if (capturePhotoBtn) capturePhotoBtn.style.display = 'none';
      if (retakePhotoBtn) retakePhotoBtn.style.display = 'inline-flex';
      if (clearPortraitBtn) clearPortraitBtn.style.display = 'inline-flex';

      showToast('Portrait captured successfully!', 'success');
    }
  }

  function retakePortrait(e) {
    e.preventDefault();
    startCamera({ preventDefault: () => {} });
  }

  function clearPortrait(e) {
    e.preventDefault();

    currentPortraitData = null;
    document.getElementById('portraitData').value = '';

    const cameraPreview = document.getElementById('cameraPreview');
    const portraitImage = document.getElementById('portraitImage');
    const noPortraitPlaceholder = document.getElementById('noPortraitPlaceholder');
    const startCameraBtn = document.getElementById('startCameraBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const retakePhotoBtn = document.getElementById('retakePhotoBtn');
    const clearPortraitBtn = document.getElementById('clearPortraitBtn');

    cameraPreview.style.display = 'none';
    portraitImage.style.display = 'none';
    if (noPortraitPlaceholder) noPortraitPlaceholder.style.display = 'flex';

    if (startCameraBtn) startCameraBtn.style.display = 'inline-flex';
    if (capturePhotoBtn) capturePhotoBtn.style.display = 'none';
    if (retakePhotoBtn) retakePhotoBtn.style.display = 'none';
    if (clearPortraitBtn) clearPortraitBtn.style.display = 'none';

    stopCamera();
    showToast('Portrait cleared.', 'info');
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
  }

  // Store portrait in employee data
  function saveEmployeePortrait(employeeId, portraitDataUrl) {
    if (portraitDataUrl) {
      try {
        const portraitsKey = 'employee_portraits';
        const portraits = storage.get(portraitsKey) || {};
        portraits[String(employeeId)] = portraitDataUrl;
        storage.set(portraitsKey, portraits);
        console.log(`✅ Portrait saved for employee ${employeeId} (size: ${portraitDataUrl.length} bytes)`);

        // Verify it was saved
        const saved = storage.get(portraitsKey);
        if (saved[String(employeeId)]) {
          console.log(`✅ Portrait verified in storage for employee ${employeeId}`);
        }
      } catch (error) {
        console.error('Error saving employee portrait:', error);
        showToast('Error saving portrait', 'error');
      }
    }
  }

  // Get portrait for employee - Available globally
  window.getEmployeePortrait = function(employeeId) {
    try {
      // Ensure storage is available
      if (typeof storage === 'undefined' || !storage) {
        console.warn('Storage not available for portrait retrieval');
        return null;
      }
      const portraitsKey = 'employee_portraits';
      const portraits = storage.get(portraitsKey) || {};
      const portrait = portraits[String(employeeId)] || null;
      if (portrait) {
        console.log(`📸 Portrait found for employee ${employeeId}`);
      }
      return portrait;
    } catch (error) {
      console.error('Error retrieving employee portrait:', error);
      return null;
    }
  };

  // Auto-refresh every 5 minutes
  setInterval(
    function () {
      loadEmployees();
    },
    5 * 60 * 1000,
  );

  // Export functions to global scope for onclick handlers
  window.showManageEmployeesModal = showManageEmployeesModal;
  window.viewEmployeeAbsences = viewEmployeeAbsences;
});

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
