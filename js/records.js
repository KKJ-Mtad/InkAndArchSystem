// Records page functionality
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
  if (!currentUser || !currentUser.permissions) {
    showToast("Access denied. You don't have permission to view this page.", "error");
    setTimeout(() => navigate("dashboard.html"), 2000);
    return;
  }

  // State management
  let patients = [];
  let appointments = [];
  let inventory = [];
  let inventoryLogs = [];
  let archivedPatients = {};
  let archivedEmployees = [];
  let currentDateRange = "today";
  let customDateRange = null;

  // Daily selection & calendar state
  let selectedDailyDate = new Date();
  let currentCalendarMonth = new Date(selectedDailyDate.getFullYear(), selectedDailyDate.getMonth(), 1);

  // Initialize page
  initializeRecordsPage();
  setupEventListeners();
  loadData();

  function initializeRecordsPage() {
    // Set user name
    const currentUser = storage.get("currentUser");
    const userNameElement = $("#userName");
    if (userNameElement && currentUser) {
      userNameElement.textContent = currentUser.name || "Admin";
    }

    // Apply role-based navigation restrictions
    if (currentUser) {
      const sidebarItems = document.querySelectorAll(".sidebar-item");

      if (currentUser.role === "employee") {
        // Hide all tabs except Dashboard, Time Tracking, and Records for employees
        sidebarItems.forEach(item => {
          const href = item.getAttribute("href");
          const text = item.textContent.trim();
          if (href !== "dashboard.html" && href !== "timetracking.html" && href !== "records.html" &&
            text !== "Dashboard" && text !== "Time Tracking" && text !== "Records") {
            item.style.display = "none";
          }
        });
      } else if (currentUser.role === "front_desk") {
        // Hide employees tab for front desk users
        sidebarItems.forEach(item => {
          const href = item.getAttribute("href");
          const text = item.textContent.trim();
          if (href === "employees.html" || text === "Employees") {
            item.style.display = "none";
          }
        });
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

    // Date range selector
    const dateRangeSelect = $("#dateRangeSelect");
    if (dateRangeSelect) {
      dateRangeSelect.addEventListener("change", handleDateRangeChange);
    }

    // Export report button
    const exportReportBtn = $("#exportReportBtn");
    if (exportReportBtn) {
      exportReportBtn.addEventListener("click", handleExportReport);
    }

    // Tab navigation
    setupTabNavigation();

    // Custom date modal
    setupCustomDateModal();

    // Inventory log filter
    const logTypeFilter = $("#logTypeFilter");
    if (logTypeFilter) {
      logTypeFilter.addEventListener("change", renderInventoryLogs);
    }

    // Daily calendar navigation
    const prevBtn = $("#dailyCalendarPrev");
    const nextBtn = $("#dailyCalendarNext");
    if (prevBtn) prevBtn.addEventListener("click", () => changeCalendarMonth(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => changeCalendarMonth(1));

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

  function setupTabNavigation() {
    const tabBtns = $$(".tab-btn");
    const tabContents = $$(".tab-content");

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-tab");

        // Update active tab button
        tabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Update active tab content
        tabContents.forEach(content => {
          content.classList.remove("active");
          if (content.id === `${tabId}-tab`) {
            content.classList.add("active");
          }
        });

        // Load content for the active tab
        switch (tabId) {
          case "daily":
            renderDailyRecords();
            break;
          case "weekly":
            renderWeeklySummary();
            break;
          case "monthly":
            renderMonthlyReport();
            break;
          case "inventory-logs":
            renderInventoryLogs();
            break;
        }
      });
    });
  }

  function setupCustomDateModal() {
    const closeCustomDateModalBtn = $("#closeCustomDateModalBtn");
    const cancelDateRangeBtn = $("#cancelDateRangeBtn");
    const customDateModal = $("#customDateModal");
    const dateRangeForm = $("#dateRangeForm");

    if (closeCustomDateModalBtn) {
      closeCustomDateModalBtn.addEventListener("click", hideCustomDateModal);
    }
    if (cancelDateRangeBtn) {
      cancelDateRangeBtn.addEventListener("click", hideCustomDateModal);
    }
    if (customDateModal) {
      customDateModal.addEventListener("click", function (e) {
        if (e.target === customDateModal) {
          hideCustomDateModal();
        }
      });
    }
    if (dateRangeForm) {
      dateRangeForm.addEventListener("submit", handleCustomDateSubmit);
    }
  }

  async function loadData() {
    try {
      // Load patients from API (with fallback to localStorage)
      try {
        const patientsResponse = await fetch('/api/patients?includeInactive=true');
        if (patientsResponse.ok) {
          patients = await patientsResponse.json();
          console.log('✅ Loaded patients from database:', patients.length);
        } else {
          throw new Error('Failed to load patients from API');
        }
      } catch (apiError) {
        console.warn('⚠️ Patients API unavailable, using localStorage:', apiError.message);
        patients = storage.get("patients") || [];
      }

      // Load appointments from API (with fallback to cache then localStorage)
      try {
        const appointmentsResponse = await fetch('/api/appointments');
        if (appointmentsResponse.ok) {
          appointments = await appointmentsResponse.json();
          console.log('✅ Loaded appointments from database:', appointments.length);

          // Cache to IndexedDB for synchronization
          if (typeof cacheSync !== 'undefined' && appointments.length > 0) {
            await cacheSync.cacheAppointments(appointments);
          }
        } else {
          throw new Error('Failed to load appointments from API');
        }
      } catch (apiError) {
        console.warn('⚠️ Appointments API unavailable, checking cache...', apiError.message);

        // Try to load from IndexedDB cache first
        if (typeof cacheSync !== 'undefined') {
          const cachedAppointments = await cacheSync.getAppointmentsFromCache();
          if (cachedAppointments && cachedAppointments.length > 0) {
            appointments = cachedAppointments;
            console.log('✅ Loaded appointments from IndexedDB cache:', appointments.length);
          } else {
            appointments = storage.get("appointments") || [];
            console.log('⚠️ Using localStorage fallback');
          }
        } else {
          appointments = storage.get("appointments") || [];
          console.log('⚠️ Using localStorage fallback (cache-sync not available)');
        }
      }

      // Load inventory from API (with fallback to cache then localStorage)
      try {
        const inventoryResponse = await fetch('/api/inventory');
        if (inventoryResponse.ok) {
          inventory = await inventoryResponse.json();
          console.log('✅ Loaded inventory from database:', inventory.length);

          // Cache to IndexedDB for synchronization
          if (typeof cacheSync !== 'undefined' && inventory.length > 0) {
            await cacheSync.cacheInventory(inventory);
          }
        } else {
          throw new Error('Failed to load inventory from API');
        }
      } catch (apiError) {
        console.warn('⚠️ Inventory API unavailable, checking cache...', apiError.message);

        // Try to load from IndexedDB cache first
        if (typeof cacheSync !== 'undefined') {
          const cachedInventory = await cacheSync.getInventoryFromCache();
          if (cachedInventory && cachedInventory.length > 0) {
            inventory = cachedInventory;
            console.log('✅ Loaded inventory from IndexedDB cache:', inventory.length);
          } else {
            inventory = storage.get("inventory") || [];
            console.log('⚠️ Using localStorage fallback');
          }
        } else {
          inventory = storage.get("inventory") || [];
          console.log('⚠️ Using localStorage fallback (cache-sync not available)');
        }
      }

      // Load inventory logs from localStorage (no API endpoint for logs)
      inventoryLogs = storage.get("inventoryLogs") || [];

      // Load archived patients from localStorage
      try {
        archivedPatients = storage.get("patientArchives") || {};
        console.log('✅ Loaded archived patients:', Object.keys(archivedPatients).length);
      } catch (error) {
        console.warn('⚠️ Failed to load archived patients:', error.message);
        archivedPatients = {};
      }

      // Load archived employees from API
      try {
        const archivedEmpResponse = await fetch('/api/sqlite/employees/archive/list');
        if (archivedEmpResponse.ok) {
          archivedEmployees = await archivedEmpResponse.json();
          console.log('✅ Loaded archived employees:', archivedEmployees.length);
        } else {
          throw new Error('Failed to load archived employees');
        }
      } catch (error) {
        console.warn('⚠️ Failed to load archived employees:', error.message);
        archivedEmployees = [];
      }

      // Render all analytics and records
      logDataSources();
      renderAnalytics();
      renderDailyCalendar();
      renderDailyRecords();

      // Listen for cache updates from other tabs
      if (typeof cacheSync !== 'undefined') {
        cacheSync.onCacheUpdate((update) => {
          if (update.dataType === 'inventory' || update.dataType === 'appointments') {
            console.log('📡 Cache update detected, refreshing data...');
            loadData();
          }
        });
      }
    } catch (error) {
      showToast("Failed to load records data", "error");
      console.error("Error loading records:", error);
    }
  }

  function getAllPatients() {
    const allPatients = [...patients];
    const archiveIds = Object.keys(archivedPatients);
    archiveIds.forEach(patientId => {
      const archiveEntries = archivedPatients[patientId] || [];
      if (archiveEntries.length > 0) {
        const latestArchive = archiveEntries[archiveEntries.length - 1];
        const existingPatient = allPatients.find(p => String(p.id) === String(patientId));
        if (!existingPatient && latestArchive.name) {
          allPatients.push({
            id: patientId,
            name: latestArchive.name,
            is_archived: true,
            archived_at: latestArchive.archivedAt,
            email: latestArchive.email || '',
            phone: latestArchive.phone || ''
          });
        }
      }
    });
    return allPatients;
  }

  function renderAnalytics() {
    renderPatientAnalytics();
    renderRevenueAnalytics();
    renderPaymentSummary();
    renderPopularTreatments();
    renderInventoryStatus();
    renderSalesAnalytics();
  }

  function renderPatientAnalytics() {
    const dateRange = getDateRange();
    const filteredAppointments = filterAppointmentsByDate(appointments, dateRange);

    // Get unique patients in different time periods (includes archived patients with appointments)
    const todayAppointments = filterAppointmentsByDate(appointments, getDateRange("today"));
    const weekAppointments = filterAppointmentsByDate(appointments, getDateRange("week"));
    const monthAppointments = filterAppointmentsByDate(appointments, getDateRange("month"));

    const uniquePatients = new Set(filteredAppointments.map(getAppointmentPatientKey).filter(Boolean)).size;
    const todayPatients = new Set(todayAppointments.map(getAppointmentPatientKey).filter(Boolean)).size;
    const weekPatients = new Set(weekAppointments.map(getAppointmentPatientKey).filter(Boolean)).size;
    const monthPatients = new Set(monthAppointments.map(getAppointmentPatientKey).filter(Boolean)).size;

    // Log archived patients in analytics for transparency
    if (Object.keys(archivedPatients).length > 0) {
      console.log('📊 Patient Analytics includes data from archived patients via their appointments');
    }

    // Update UI
    const totalPatientsEl = $("#totalPatients");
    const dailyPatientsEl = $("#dailyPatients");
    const weeklyPatientsEl = $("#weeklyPatients");
    const monthlyPatientsEl = $("#monthlyPatients");

    if (totalPatientsEl) totalPatientsEl.textContent = uniquePatients;
    if (dailyPatientsEl) dailyPatientsEl.textContent = todayPatients;
    if (weeklyPatientsEl) weeklyPatientsEl.textContent = weekPatients;
    if (monthlyPatientsEl) monthlyPatientsEl.textContent = monthPatients;
  }

  function renderRevenueAnalytics() {
    // Use cash-only income and subtract all expenses (appointments + inventory purchases)
    const selectedRange = getDateRange();

    const todayRange = getDateRange("today");
    const weekRange = getDateRange("week");
    const monthRange = getDateRange("month");

    const totalRevenue = computeRevenueForRange(selectedRange);
    const todayRevenue = computeRevenueForRange(todayRange);
    const weekRevenue = computeRevenueForRange(weekRange);
    const monthRevenue = computeRevenueForRange(monthRange);

    // Update UI
    const totalRevenueEl = $("#totalRevenue");
    const dailyRevenueEl = $("#dailyRevenue");
    const weeklyRevenueEl = $("#weeklyRevenue");
    const monthlyRevenueEl = $("#monthlyRevenue");

    if (totalRevenueEl) totalRevenueEl.textContent = formatCurrency(totalRevenue);
    if (dailyRevenueEl) dailyRevenueEl.textContent = formatCurrency(todayRevenue);
    if (weeklyRevenueEl) weeklyRevenueEl.textContent = formatCurrency(weekRevenue);
    if (monthlyRevenueEl) monthlyRevenueEl.textContent = formatCurrency(monthRevenue);
  }

  function renderPaymentSummary() {
    const dateRange = getDateRange();
    const filteredAppointments = filterAppointmentsByDate(appointments, dateRange);
    const totals = calculatePaymentTotals(filteredAppointments);

    const cashElement = $("#paymentSummaryCash");
    const bankElement = $("#paymentSummaryBank");
    const creditElement = $("#paymentSummaryCredit");
    const ewalletElement = $("#paymentSummaryEwallet");

    if (cashElement) cashElement.textContent = formatCurrency(totals.cash);
    if (bankElement) bankElement.textContent = formatCurrency(totals.bankTransfer);
    if (creditElement) creditElement.textContent = formatCurrency(totals.creditCard);
    if (ewalletElement) ewalletElement.textContent = formatCurrency(totals.eWallet);
  }

  function calculatePaymentTotals(list) {
    const totals = {
      cash: 0,
      bankTransfer: 0,
      creditCard: 0,
      eWallet: 0
    };

    list.forEach(appointment => {
      const paymentEntries = Array.isArray(appointment.payments) ? appointment.payments : [];
      let categorizedTotal = 0;

      paymentEntries.forEach(entry => {
        const amount = parseAmount(entry?.amount);
        const method = normalizePaymentMethod(entry?.method);

        switch (method) {
          case "cash":
            totals.cash += amount;
            categorizedTotal += amount;
            break;
          case "bank_transfer":
            totals.bankTransfer += amount;
            categorizedTotal += amount;
            break;
          case "credit_card":
            totals.creditCard += amount;
            categorizedTotal += amount;
            break;
          case "e_wallet":
            totals.eWallet += amount;
            categorizedTotal += amount;
            break;
          default:
            break;
        }
      });

      if (categorizedTotal === 0) {
        const cashAmount = parseAmount(appointment.cash_payment ?? appointment.cashPayment);
        const nonCashAmount = parseAmount(appointment.bank_transfer ?? appointment.bankTransfer);
        const preferredMethod = normalizePaymentMethod(appointment.payment_method ?? appointment.paymentMethod);

        if (cashAmount > 0) {
          totals.cash += cashAmount;
        }

        if (nonCashAmount > 0) {
          switch (preferredMethod) {
            case "credit_card":
              totals.creditCard += nonCashAmount;
              break;
            case "e_wallet":
              totals.eWallet += nonCashAmount;
              break;
            case "bank_transfer":
            default:
              totals.bankTransfer += nonCashAmount;
              break;
          }
        }
      }
    });

    return totals;
  }

  function normalizePaymentMethod(method) {
    if (!method) return "";

    const value = String(method).toLowerCase().trim();

    if (value === "down_payment" || value === "downpayment") return "";
    if (value === "cash") return "cash";
    if (value === "credit_card" || value === "credit card" || value === "creditcard") return "credit_card";
    if (value === "e_wallet" || value === "e-wallet" || value === "gcash" || value === "e wallet") return "e_wallet";
    if (value === "bank_transfer" || value === "bank transfer" || value === "bank") return "bank_transfer";

    if (value.includes("wallet") || value.includes("gcash")) return "e_wallet";
    if (value.includes("credit")) return "credit_card";
    if (value.includes("cash")) return "cash";
    if (value.includes("bank")) return "bank_transfer";

    return "";
  }

  function parseAmount(value) {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  }

  // Compute revenue for a given date range using:
  // Revenue = Total payments received from all methods (cash + bank + e-wallet + credit) - (appointment expenses + inventory purchase costs)
  function computeRevenueForRange(dateRange) {
    const apps = filterAppointmentsByDate(appointments, dateRange);

    // Calculate total payments received from all payment methods
    const paymentTotals = calculatePaymentTotals(apps);
    const totalPayments = (paymentTotals.cash || 0) + (paymentTotals.bankTransfer || 0) + (paymentTotals.creditCard || 0) + (paymentTotals.eWallet || 0);

    // Expenses recorded on appointments
    const appointmentExpenses = apps.reduce((sum, app) => sum + (parseAmount(app.expenses) || 0), 0);

    // Inventory purchase costs logged within range (from inventoryLogs)
    const invLogs = Array.isArray(inventoryLogs) ? inventoryLogs : (storage.get('inventoryLogs') || []);
    const inventoryExpenses = invLogs.reduce((sum, log) => {
      if (!log) return sum;
      const cost = parseAmount(log?.purchaseCost || log?.purchase_cost || 0);
      if (!cost || log?.action !== 'add') return sum;
      const when = log.dateReceived ? new Date(log.dateReceived) : new Date(log.timestamp);
      return (when >= dateRange.start && when <= dateRange.end) ? sum + cost : sum;
    }, 0);

    const netRevenue = totalPayments - (appointmentExpenses + inventoryExpenses);

    // Log for debugging (optional)
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('📊 Revenue Calculation:', {
        dateRange: `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
        totalPayments: formatCurrency(totalPayments),
        appointmentExpenses: formatCurrency(appointmentExpenses),
        inventoryExpenses: formatCurrency(inventoryExpenses),
        netRevenue: formatCurrency(netRevenue)
      });
    }

    return netRevenue;
  }

  // Calculate paid vs unpaid sales breakdown
  function calculatePaidUnpaidBreakdown(dateRange) {
    const apps = filterAppointmentsByDate(appointments, dateRange);

    let paidTotal = 0;
    let unpaidTotal = 0;
    let totalAmount = 0;

    apps.forEach(app => {
      const amount = parseAmount(app.total_after_discount || app.amount) || 0;
      totalAmount += amount;

      if (app.payment_status === 'full') {
        paidTotal += amount;
      } else {
        unpaidTotal += amount;
      }
    });

    return {
      totalAmount: totalAmount,
      paidAmount: paidTotal,
      unpaidAmount: unpaidTotal,
      appointmentCount: apps.length
    };
  }

  // Get current inventory value (for inclusion in asset calculations)
  function getInventoryValue() {
    try {
      const inv = Array.isArray(inventory) ? inventory : (storage.get('inventory') || []);
      return inv.reduce((total, item) => {
        const unitCost = parseAmount(item.purchase_cost) || parseAmount(item.unit_cost) || 0;
        const quantity = parseAmount(item.quantity) || 0;
        const itemValue = unitCost * quantity;
        return total + itemValue;
      }, 0);
    } catch (e) {
      return 0;
    }
  }

  // ========================================
  // SALES & REVENUE SUMMARY FUNCTIONS
  // ========================================

  /**
   * Get comprehensive sales summary for a date range
   * @param {Object} dateRange - Date range object with start and end properties
   * @returns {Object} Sales summary with totals and breakdown
   */
  function getSalesSummary(dateRange) {
    const apps = filterAppointmentsByDate(appointments, dateRange);
    const paymentTotals = calculatePaymentTotals(apps);
    const revenue = computeRevenueForRange(dateRange);
    const breakdown = calculatePaidUnpaidBreakdown(apps);

    return {
      totalAppointments: apps.length,
      totalSales: breakdown.totalAmount,
      paidAmount: breakdown.paidAmount,
      unpaidAmount: breakdown.unpaidAmount,
      revenue: revenue,
      paymentMethods: {
        cash: paymentTotals.cash || 0,
        bankTransfer: paymentTotals.bankTransfer || 0,
        creditCard: paymentTotals.creditCard || 0,
        eWallet: paymentTotals.eWallet || 0
      },
      dateRange: dateRange
    };
  }

  /**
   * Get detailed sales metrics including inventory costs
   * @returns {Object} Detailed financial metrics
   */
  function getFinancialMetrics() {
    const allTime = { start: new Date(1970, 0, 1), end: new Date(2099, 11, 31) };
    const todayRange = getDateRange('today');
    const weekRange = getDateRange('week');
    const monthRange = getDateRange('month');

    return {
      allTime: getSalesSummary(allTime),
      today: getSalesSummary(todayRange),
      week: getSalesSummary(weekRange),
      month: getSalesSummary(monthRange),
      inventoryValue: getInventoryValue(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate profit/loss by comparing revenue to expenses
   * @param {Object} dateRange - Date range object
   * @returns {Object} Profit/loss analysis
   */
  function calculateProfitLoss(dateRange) {
    const apps = filterAppointmentsByDate(appointments, dateRange);
    const paymentTotals = calculatePaymentTotals(apps);
    const totalPayments = (paymentTotals.cash || 0) + (paymentTotals.bankTransfer || 0) + (paymentTotals.creditCard || 0) + (paymentTotals.eWallet || 0);

    // Calculate total expenses
    const appointmentExpenses = apps.reduce((sum, app) => sum + (parseAmount(app.expenses) || 0), 0);
    const invLogs = Array.isArray(inventoryLogs) ? inventoryLogs : (storage.get('inventoryLogs') || []);
    const inventoryExpenses = invLogs.reduce((sum, log) => {
      if (!log) return sum;
      const cost = parseAmount(log?.purchaseCost || log?.purchase_cost || 0);
      if (!cost || log?.action !== 'add') return sum;
      const when = log.dateReceived ? new Date(log.dateReceived) : new Date(log.timestamp);
      return (when >= dateRange.start && when <= dateRange.end) ? sum + cost : sum;
    }, 0);

    const totalExpenses = appointmentExpenses + inventoryExpenses;
    const profit = totalPayments - totalExpenses;
    const profitMargin = totalPayments > 0 ? (profit / totalPayments) * 100 : 0;

    return {
      totalIncome: totalPayments,
      appointmentExpenses: appointmentExpenses,
      inventoryExpenses: inventoryExpenses,
      totalExpenses: totalExpenses,
      profit: profit,
      profitMargin: profitMargin,
      isProfitable: profit >= 0
    };
  }

  // Expose functions globally for use by other modules (inventory.js, etc)
  window.calculatePaidUnpaidBreakdown = calculatePaidUnpaidBreakdown;
  window.getInventoryValue = getInventoryValue;
  window.getSalesSummary = getSalesSummary;
  window.getFinancialMetrics = getFinancialMetrics;
  window.calculateProfitLoss = calculateProfitLoss;
  window.getAllPatients = getAllPatients;

  // Log data sources for transparency
  function logDataSources() {
    const sources = {
      activePatients: patients.length,
      archivedPatients: Object.keys(archivedPatients).length,
      archivedEmployees: archivedEmployees.length,
      totalAppointments: appointments.length,
      totalInventory: inventory.length,
      inventoryLogs: inventoryLogs.length
    };
    console.log('📊 Analytics Data Sources:', sources);
    if (sources.archivedPatients > 0 || sources.archivedEmployees > 0) {
      console.log('✅ Archived data is included in all analytics calculations');
    }
  }
  window.logDataSources = logDataSources;

  function resolveAppointmentPatientId(appointment) {
    if (!appointment) return null;
    const candidates = [
      appointment.patientId,
      appointment.patient_id,
      appointment.patient?.id,
      appointment.patient?.patientId,
      appointment.patient?.patient_id,
      appointment.patientDetails?.id,
      appointment.patientDetails?.patientId,
      appointment.patientDetails?.patient_id
    ];
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
        return candidate;
      }
    }
    return null;
  }

  function getAppointmentPatientKey(appointment) {
    const identifier = resolveAppointmentPatientId(appointment);
    return identifier !== undefined && identifier !== null ? String(identifier).trim() : null;
  }

  function findPatientForAppointment(appointment) {
    const targetId = getAppointmentPatientKey(appointment);
    if (!targetId) return null;

    // First try to find in active patients
    let foundPatient = (patients || []).find(record => {
      const potentialIds = [
        record.id,
        record.patientId,
        record.patient_id,
        record.comprehensive_data?.id,
        record.comprehensive_data?.patientId,
        record.comprehensive_data?.patient_id
      ];
      return potentialIds.some(id => id !== undefined && id !== null && String(id).trim() === targetId);
    });

    if (foundPatient) return foundPatient;

    // If not found in active, check archived patients
    const archiveEntries = archivedPatients[targetId];
    if (archiveEntries && archiveEntries.length > 0) {
      const latestArchive = archiveEntries[archiveEntries.length - 1];
      return {
        id: targetId,
        name: latestArchive.name,
        is_archived: true,
        email: latestArchive.email || '',
        phone: latestArchive.phone || ''
      };
    }

    return null;
  }

  function buildNameFromParts(first, middle, last) {
    const parts = [first, middle, last]
      .map(part => (part && String(part).trim()) || '')
      .filter(Boolean);
    return parts.join(' ');
  }

  function getPatientNameFromAppointment(appointment, cachedPatient = null) {
    try {
      const patientRecord = cachedPatient || findPatientForAppointment(appointment);

      // First priority: check for 'name' field directly on patient record
      if (patientRecord?.name && String(patientRecord.name).trim()) {
        return String(patientRecord.name).trim();
      }

      // Second priority: try to build from firstName, middleName, lastName on patient record
      if (patientRecord) {
        const recordCompositeName = buildNameFromParts(
          patientRecord.firstName || patientRecord.first_name,
          patientRecord.middleName || patientRecord.middle_name,
          patientRecord.lastName || patientRecord.last_name
        );
        if (recordCompositeName && String(recordCompositeName).trim()) {
          return String(recordCompositeName).trim();
        }

        // Third priority: check comprehensive_data for name parts
        if (patientRecord.comprehensive_data) {
          const compData = patientRecord.comprehensive_data;

          // Try the 'name' field in comprehensive_data first
          if (compData.name && String(compData.name).trim()) {
            return String(compData.name).trim();
          }

          // Build from name parts in comprehensive_data
          const comprehensiveCompositeName = buildNameFromParts(
            compData.firstName || compData.first_name,
            compData.middleName || compData.middle_name,
            compData.lastName || compData.last_name
          );
          if (comprehensiveCompositeName && String(comprehensiveCompositeName).trim()) {
            return String(comprehensiveCompositeName).trim();
          }
        }
      }

      // Fourth priority: try embedded patient data in appointment
      const embeddedPatient = appointment?.patient || appointment?.patientDetails || null;
      if (embeddedPatient?.name && String(embeddedPatient.name).trim()) {
        return String(embeddedPatient.name).trim();
      }

      const compositeName = buildNameFromParts(
        embeddedPatient?.firstName ?? embeddedPatient?.first_name,
        embeddedPatient?.middleName ?? embeddedPatient?.middle_name,
        embeddedPatient?.lastName ?? embeddedPatient?.last_name
      );

      // Fifth priority: try various name fields on appointment
      const inlineName =
        appointment?.patientName ||
        appointment?.patient_name ||
        embeddedPatient?.name ||
        embeddedPatient?.fullName ||
        compositeName ||
        appointment?.fullName ||
        appointment?.name;

      if (inlineName && String(inlineName).trim()) {
        return String(inlineName).trim();
      }

      return 'Unknown Patient';
    } catch (error) {
      console.error('Error in getPatientNameFromAppointment:', error);
      return 'Unknown Patient';
    }
  }

  function renderPopularTreatments() {
    const dateRange = getDateRange();
    const filteredAppointments = filterAppointmentsByDate(appointments, dateRange);

    // Count treatments
    const treatmentCounts = {};
    filteredAppointments.forEach(app => {
      if (app.treatment) {
        treatmentCounts[app.treatment] = (treatmentCounts[app.treatment] || 0) + 1;
      }
    });

    // Sort by count and get top 5
    const sortedTreatments = Object.entries(treatmentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Update UI
    const popularTreatmentsEl = $("#popularTreatments");
    if (popularTreatmentsEl) {
      if (sortedTreatments.length === 0) {
        popularTreatmentsEl.innerHTML = `
          <div class="empty-state">
            <p>No treatments recorded yet</p>
          </div>
        `;
      } else {
        popularTreatmentsEl.innerHTML = sortedTreatments.map(([treatment, count]) => `
          <div class="treatment-item">
            <div class="treatment-name">${treatment}</div>
            <div class="treatment-count">${count}</div>
          </div>
        `).join('');
      }
    }
  }

  function renderInventoryStatus() {
    const totalItems = inventory.length;
    const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity && item.quantity > 0).length;
    const outOfStockItems = inventory.filter(item => item.quantity === 0).length;

    // Update UI
    const totalItemsEl = $("#totalItems");
    const lowStockItemsEl = $("#lowStockItems");
    const outOfStockItemsEl = $("#outOfStockItems");

    if (totalItemsEl) totalItemsEl.textContent = totalItems;
    if (lowStockItemsEl) lowStockItemsEl.textContent = lowStockItems;
    if (outOfStockItemsEl) outOfStockItemsEl.textContent = outOfStockItems;
  }

  function calculateSalesAndInventorySummary() {
    const dateRange = getDateRange();
    const apps = filterAppointmentsByDate(appointments, dateRange);

    let totalSales = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    apps.forEach(apt => {
      const amount = apt.total_after_discount || apt.amount || 0;
      totalSales += amount;

      if (apt.payment_status === 'full') {
        paidAmount += amount;
      } else {
        unpaidAmount += amount;
      }
    });

    // Consistent inventory value calculation using purchase_cost (standard field)
    let inventoryValue = 0;
    inventory.forEach(item => {
      // Normalize field names: purchase_cost is the standard
      const unitPrice = parseAmount(item.purchase_cost) ||
                        parseAmount(item.unitPrice) ||
                        parseAmount(item.unit_cost) || 0;
      const quantity = parseAmount(item.quantity) || 0;
      inventoryValue += unitPrice * quantity;
    });

    return {
      totalSales,
      paidAmount,
      unpaidAmount,
      inventoryValue
    };
  }

  function renderSalesAnalytics() {
    const summary = calculateSalesAndInventorySummary();

    const totalSalesEl = $("#recordsTotalSalesValue");
    const paidAmountEl = $("#recordsPaidAmountValue");
    const unpaidAmountEl = $("#recordsUnpaidAmountValue");
    const inventoryValueEl = $("#recordsInventoryValueValue");

    console.log('📊 Sales Analytics Summary:', {
      totalSales: summary.totalSales,
      paidAmount: summary.paidAmount,
      unpaidAmount: summary.unpaidAmount,
      inventoryValue: summary.inventoryValue,
      appointmentsCount: appointments.length,
      inventoryCount: inventory.length
    });

    if (totalSalesEl) totalSalesEl.textContent = formatCurrency(summary.totalSales);
    if (paidAmountEl) paidAmountEl.textContent = formatCurrency(summary.paidAmount);
    if (unpaidAmountEl) unpaidAmountEl.textContent = formatCurrency(summary.unpaidAmount);
    if (inventoryValueEl) inventoryValueEl.textContent = formatCurrency(summary.inventoryValue);
  }

  function renderDailyRecords() {
    const dateRange = getSingleDayRange(selectedDailyDate);
    const todayAppointments = filterAppointmentsByDate(appointments, dateRange);

    // Update date display
    const dailyRecordsDateEl = $("#dailyRecordsDate");
    if (dailyRecordsDateEl) {
      const baseToday = new Date();
      const normalizedToday = new Date(baseToday.getFullYear(), baseToday.getMonth(), baseToday.getDate());
      const normalizedSelected = new Date(selectedDailyDate.getFullYear(), selectedDailyDate.getMonth(), selectedDailyDate.getDate());
      const isToday = normalizedSelected.getTime() === normalizedToday.getTime();
      dailyRecordsDateEl.textContent = isToday ? `Today - ${formatDate(selectedDailyDate)}` : `${formatDate(selectedDailyDate)}`;
    }

    // Render records list
    const dailyRecordsListEl = $("#dailyRecordsList");
    if (dailyRecordsListEl) {
      if (todayAppointments.length === 0) {
        dailyRecordsListEl.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No appointments today</h3>
            <p>No patient records found for today</p>
          </div>
        `;
      } else {
        // Build patient appointment entries
        const appointmentEntries = todayAppointments.map(appointment => {
          const patientRecord = findPatientForAppointment(appointment);
          const staff = getStaffNameById(appointment.staff);
          const embeddedPatient = appointment?.patient || appointment?.patientDetails || {};
          const contactNumber =
            patientRecord?.mobile ||
            patientRecord?.contactNumber ||
            patientRecord?.contact_number ||
            embeddedPatient?.mobile ||
            embeddedPatient?.contactNumber ||
            embeddedPatient?.contact_number ||
            appointment.patientMobile ||
            appointment.contactNumber ||
            appointment.mobile ||
            'N/A';
          const patientName = getPatientNameFromAppointment(appointment, patientRecord);

          return `
            <div class="record-item">
              <div class="record-header">
                <div class="record-patient">${patientName}</div>
                <div class="record-amount">${formatCurrency(appointment.amount)}</div>
              </div>
              <div class="record-details">
                <div class="record-detail-row">
                  <span class="detail-label">Contact:</span>
                  <span class="detail-value">${contactNumber}</span>
                </div>
                <div class="record-detail-row">
                  <span class="detail-label">Staff:</span>
                  <span class="detail-value">${staff}</span>
                </div>
                <div class="record-detail-row">
                  <span class="detail-label">Treatment:</span>
                  <span class="detail-value">${appointment.treatment}</span>
                </div>
                <div class="record-detail-row">
                  <span class="detail-label">Total Sales:</span>
                  <span class="detail-value">${formatCurrency(appointment.amount)}</span>
                </div>
                <div class="record-detail-row">
                  <span class="detail-label">Down Payment:</span>
                  <span class="detail-value">${formatCurrency((appointment.down_payment || appointment.downPayment || 0))}</span>
                </div>
                <div class="record-detail-row">
                  <span class="detail-label">Cash:</span>
                  <span class="detail-value">${formatCurrency((appointment.cash_payment || appointment.cashPayment || 0))}</span>
                </div>
                ${(() => {
              const entries = Array.isArray(appointment.payments) ? appointment.payments : [];
              const prefer = normalizePaymentMethod(appointment.non_cash_method || appointment.payment_method || appointment.paymentMethod);
              const groups = {};
              entries.forEach(p => {
                const amount = parseAmount(p?.amount);
                let method = normalizePaymentMethod(p?.method);
                if (method === 'bank_transfer' && (prefer === 'e_wallet' || prefer === 'credit_card')) method = prefer;
                if (method && method !== 'cash' && amount > 0) {
                  if (!groups[method]) groups[method] = { amount: 0, refs: [] };
                  groups[method].amount += amount;
                  const refVal = p.reference || p.ref || p.reference_number || p.referenceNumber;
                  if (refVal) groups[method].refs.push(refVal);
                }
              });
              if (Object.keys(groups).length === 0) {
                const amt = parseAmount(appointment.bank_transfer ?? appointment.bankTransfer);
                const method = prefer;
                const ref = appointment.payment_reference || appointment.reference_number || appointment.reference;
                if (amt > 0 && method && method !== 'cash') {
                  groups[method] = { amount: amt, refs: ref ? [ref] : [] };
                }
              } else if (Object.keys(groups).length === 1 && prefer && prefer !== 'cash') {
                const onlyKey = Object.keys(groups)[0];
                if (onlyKey === 'bank_transfer' && (prefer === 'e_wallet' || prefer === 'credit_card')) {
                  const info = groups[onlyKey];
                  delete groups[onlyKey];
                  groups[prefer] = info;
                }
              }
              const label = m => m === 'bank_transfer' ? 'Bank Transfer' : m === 'e_wallet' ? 'E-wallet' : 'Credit Card';
              return Object.entries(groups).map(([m, info]) => `
                    <div class="record-detail-row">
                      <span class="detail-label">${label(m)}:</span>
                      <span class="detail-value">${formatCurrency(info.amount)}${info.refs.length ? ` (Ref: ${info.refs.join(', ')})` : ''}</span>
                    </div>
                  `).join('');
            })()}
                <div class="record-detail-row">
                  <span class="detail-label">Expenses:</span>
                  <span class="detail-value">${formatCurrency(appointment.expenses || 0)}</span>
                </div>
                <div class="record-time">Time: ${formatDateTime(appointment.createdAt || appointment.date)}</div>
                ${appointment.notes ? `<div class="record-notes">Notes: ${appointment.notes}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');

        // Build inventory purchase entries from logs
        const todayRange = getSingleDayRange(selectedDailyDate);
        const purchaseLogs = (inventoryLogs || []).filter(log => {
          if (log.action !== 'add') return false;
          const when = log.dateReceived ? new Date(log.dateReceived) : new Date(log.timestamp);
          return when >= todayRange.start && when <= todayRange.end && (parseFloat(log.purchaseCost) || 0) > 0;
        });

        const purchaseEntries = purchaseLogs.map(log => {
          const amount = parseFloat(log.purchaseCost) || 0;
          return `
            <div class="record-item">
              <div class="record-header">
                <div class="record-patient">Inventory Purchase - ${log.itemName || 'Unknown Item'}</div>
                <div class="record-amount">${formatCurrency(amount)}</div>
              </div>
              <div class="record-details">
                <div class="record-detail-row"><span class="detail-label">Quantity Added:</span><span class="detail-value">${log.quantity}</span></div>
                ${log.supplier ? `<div class="record-detail-row"><span class="detail-label">Supplier:</span><span class="detail-value">${log.supplier}</span></div>` : ''}
                ${log.platform ? `<div class="record-detail-row"><span class="detail-label">Platform:</span><span class="detail-value">${log.platform}</span></div>` : ''}
                ${log.dateReceived ? `<div class="record-detail-row"><span class="detail-label">Date Received:</span><span class="detail-value">${formatDate(new Date(log.dateReceived))}</span></div>` : ''}
                <div class="record-time">Time: ${formatDateTime(log.timestamp)}</div>
                ${log.reason ? `<div class="record-notes">Reason: ${log.reason}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');

        dailyRecordsListEl.innerHTML = appointmentEntries + purchaseEntries;
      }
    }
  }

  function renderWeeklySummary() {
    const weekRange = getDateRange("week");
    const weekAppointments = filterAppointmentsByDate(appointments, weekRange);

    const uniquePatients = new Set(weekAppointments.map(getAppointmentPatientKey).filter(Boolean)).size;
    const totalRevenue = weekAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);
    const averagePerPatient = uniquePatients > 0 ? totalRevenue / uniquePatients : 0;

    // Update summary stats
    const weekSummaryPatientsEl = $("#weekSummaryPatients");
    const weekSummaryRevenueEl = $("#weekSummaryRevenue");
    const weekSummaryAverageEl = $("#weekSummaryAverage");

    if (weekSummaryPatientsEl) weekSummaryPatientsEl.textContent = uniquePatients;
    if (weekSummaryRevenueEl) weekSummaryRevenueEl.textContent = formatCurrency(totalRevenue);
    if (weekSummaryAverageEl) weekSummaryAverageEl.textContent = formatCurrency(averagePerPatient);

    // Treatment ranking
    const treatmentCounts = {};
    const treatmentRevenue = {};

    weekAppointments.forEach(app => {
      if (app.treatment) {
        treatmentCounts[app.treatment] = (treatmentCounts[app.treatment] || 0) + 1;
        treatmentRevenue[app.treatment] = (treatmentRevenue[app.treatment] || 0) + (app.amount || 0);
      }
    });

    const sortedTreatments = Object.entries(treatmentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const weeklyTreatmentRankingEl = $("#weeklyTreatmentRanking");
    if (weeklyTreatmentRankingEl) {
      if (sortedTreatments.length === 0) {
        weeklyTreatmentRankingEl.innerHTML = `
          <div class="empty-state">
            <p>No treatments this week</p>
          </div>
        `;
      } else {
        weeklyTreatmentRankingEl.innerHTML = sortedTreatments.map(([treatment, count], index) => `
          <div class="ranking-item">
            <div>
              <div class="ranking-treatment">#${index + 1} ${treatment}</div>
              <div class="ranking-revenue">Revenue: ${formatCurrency(treatmentRevenue[treatment] || 0)}</div>
            </div>
            <div class="ranking-count">${count} times</div>
          </div>
        `).join('');
      }
    }
  }

  function renderMonthlyReport() {
    const monthRange = getDateRange("month");
    const monthAppointments = filterAppointmentsByDate(appointments, monthRange);

    const totalAppointments = monthAppointments.length;
    const totalRevenue = monthAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);
    const daysInMonth = new Date().getDate(); // Current day of month
    const avgDailyRevenue = daysInMonth > 0 ? totalRevenue / daysInMonth : 0;

    // Count new patients this month (includes archived patients)
    const monthStart = monthRange.start;
    const allPatients = getAllPatients();
    const newPatients = allPatients.filter(patient => {
      const createdDate = new Date(patient.createdAt);
      return createdDate >= monthStart;
    }).length;

    // Update monthly metrics
    const monthlyAppointmentsEl = $("#monthlyAppointments");
    const monthlyTotalRevenueEl = $("#monthlyTotalRevenue");
    const monthlyAvgDailyEl = $("#monthlyAvgDaily");
    const monthlyNewPatientsEl = $("#monthlyNewPatients");

    if (monthlyAppointmentsEl) monthlyAppointmentsEl.textContent = totalAppointments;
    if (monthlyTotalRevenueEl) monthlyTotalRevenueEl.textContent = formatCurrency(totalRevenue);
    if (monthlyAvgDailyEl) monthlyAvgDailyEl.textContent = formatCurrency(avgDailyRevenue);
    if (monthlyNewPatientsEl) monthlyNewPatientsEl.textContent = newPatients;

    // Treatment breakdown
    const treatmentCounts = {};
    const treatmentRevenue = {};

    monthAppointments.forEach(app => {
      if (app.treatment) {
        treatmentCounts[app.treatment] = (treatmentCounts[app.treatment] || 0) + 1;
        treatmentRevenue[app.treatment] = (treatmentRevenue[app.treatment] || 0) + (app.amount || 0);
      }
    });

    const sortedTreatments = Object.entries(treatmentCounts)
      .sort((a, b) => b[1] - a[1]);

    const monthlyTreatmentBreakdownEl = $("#monthlyTreatmentBreakdown");
    if (monthlyTreatmentBreakdownEl) {
      if (sortedTreatments.length === 0) {
        monthlyTreatmentBreakdownEl.innerHTML = `
          <div class="empty-state">
            <p>No treatments this month</p>
          </div>
        `;
      } else {
        monthlyTreatmentBreakdownEl.innerHTML = sortedTreatments.map(([treatment, count]) => `
          <div class="breakdown-item">
            <div>
              <div class="breakdown-treatment">${treatment}</div>
              <div class="breakdown-revenue">${formatCurrency(treatmentRevenue[treatment] || 0)} total</div>
            </div>
            <div class="breakdown-count">${count}</div>
          </div>
        `).join('');
      }
    }
  }

  function renderInventoryLogs() {
    const logTypeFilter = $("#logTypeFilter");
    const filterValue = logTypeFilter ? logTypeFilter.value : "all";

    let filteredLogs = [...inventoryLogs];
    if (filterValue !== "all") {
      filteredLogs = inventoryLogs.filter(log => log.action === filterValue);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const inventoryLogsListEl = $("#inventoryLogsList");
    if (inventoryLogsListEl) {
      if (filteredLogs.length === 0) {
        inventoryLogsListEl.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No inventory logs</h3>
            <p>No inventory changes recorded yet</p>
          </div>
        `;
      } else {
        inventoryLogsListEl.innerHTML = filteredLogs.map(log => {
          let actionText = "";
          let changeText = "";

          switch (log.action) {
            case "treatment_usage":
              actionText = "Treatment Usage";
              changeText = `Used for ${log.treatment} treatment`;
              break;
            case "add":
              actionText = "Stock Added";
              changeText = `Added ${log.quantity} items (${log.oldQuantity} �� ${log.newQuantity})`;
              break;
            case "remove":
              actionText = "Stock Removed";
              changeText = `Removed ${log.quantity} items (${log.oldQuantity} → ${log.newQuantity})`;
              break;
            case "set":
              actionText = "Stock Set";
              changeText = `Set quantity to ${log.newQuantity} (was ${log.oldQuantity})`;
              break;
            default:
              actionText = log.action;
              changeText = `Quantity changed: ${log.oldQuantity} → ${log.newQuantity}`;
          }

          return `
            <div class="log-item">
              <div class="log-header">
                <div>
                  <div class="log-title">${log.itemName || 'Unknown Item'}</div>
                  <div class="log-action">${actionText}</div>
                </div>
                <div class="log-time">${formatDateTime(log.timestamp)}</div>
              </div>
              <div class="log-change">${changeText}</div>
              ${(log.supplier || log.platform || log.purchaseCost || log.dateReceived) ? `
                <div class="log-details">
                  ${log.supplier ? `<div>Supplier: ${log.supplier}</div>` : ''}
                  ${log.platform ? `<div>Platform: ${log.platform}</div>` : ''}
                  ${log.purchaseCost ? `<div>Cost: ${formatCurrency(log.purchaseCost)}</div>` : ''}
                  ${log.dateReceived ? `<div>Date Received: ${formatDate(new Date(log.dateReceived))}</div>` : ''}
                </div>` : ''}
              ${log.reason ? `<div class="log-reason">Reason: ${log.reason}</div>` : ''}
            </div>
          `;
        }).join('');
      }
    }
  }

  function getSingleDayRange(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return { start: d, end: new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1) };
  }

  function getDateRange(range = currentDateRange) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (range === "custom" && customDateRange) {
      return customDateRange;
    }

    switch (range) {
      case "today":
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      case "month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        return { start: monthStart, end: monthEnd };
      case "quarter":
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
        const quarterEnd = new Date(now.getFullYear(), quarterMonth + 3, 0);
        quarterEnd.setHours(23, 59, 59, 999);
        return { start: quarterStart, end: quarterEnd };
      case "year":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        return { start: yearStart, end: yearEnd };
      default:
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
  }

  function filterAppointmentsByDate(appointments, dateRange) {
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.date);
      return appointmentDate >= dateRange.start && appointmentDate <= dateRange.end;
    });
  }

  function getStaffNameById(staffId) {
    if (!staffId) return 'Not assigned';

    try {
      const employees = storage.get("employees") || [];
      const staff = employees.find(emp => String(emp.id) === String(staffId));
      if (staff) return staff.name;

      // Check archived employees if not found in active list
      if (Array.isArray(archivedEmployees) && archivedEmployees.length > 0) {
        const archivedStaff = archivedEmployees.find(emp => String(emp.id) === String(staffId));
        if (archivedStaff) {
          return `${archivedStaff.name} (archived)`;
        }
      }

      return 'Unknown Staff';
    } catch (error) {
      console.error("Error getting staff name:", error);
      return 'Unknown Staff';
    }
  }

  function formatPaymentMethod(method) {
    if (!method) return 'Not specified';

    const methods = {
      'cash': 'Cash',
      'bank_transfer': 'Bank Transfer',
      'gcash': 'E-wallet',
      'e_wallet': 'E-wallet',
      'credit_card': 'Credit Card'
    };

    return methods[method] || method;
  }

  function handleDateRangeChange(e) {
    const newRange = e.target.value;

    if (newRange === "custom") {
      showCustomDateModal();
      return;
    }

    currentDateRange = newRange;
    customDateRange = null;

    // Re-render analytics
    renderAnalytics();

    // Re-render active tab content
    const activeTab = $(".tab-btn.active");
    if (activeTab) {
      const tabId = activeTab.getAttribute("data-tab");
      switch (tabId) {
        case "daily":
          renderDailyRecords();
          break;
        case "weekly":
          renderWeeklySummary();
          break;
        case "monthly":
          renderMonthlyReport();
          break;
        case "inventory-logs":
          renderInventoryLogs();
          break;
      }
    }
  }

  function showCustomDateModal() {
    showModal("#customDateModal");
  }

  function hideCustomDateModal() {
    hideModal("#customDateModal");

    // Reset date range selector if user cancels
    const dateRangeSelect = $("#dateRangeSelect");
    if (dateRangeSelect) {
      dateRangeSelect.value = currentDateRange;
    }
  }

  function handleCustomDateSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const startDate = new Date(formData.get("startDate"));
    const endDate = new Date(formData.get("endDate"));
    endDate.setHours(23, 59, 59, 999);

    if (startDate > endDate) {
      showToast("Start date cannot be after end date", "error");
      return;
    }

    customDateRange = { start: startDate, end: endDate };
    currentDateRange = "custom";

    hideCustomDateModal();

    // Re-render analytics with custom range
    renderAnalytics();

    // Re-render active tab content
    const activeTab = $(".tab-btn.active");
    if (activeTab) {
      const tabId = activeTab.getAttribute("data-tab");
      switch (tabId) {
        case "daily":
          renderDailyRecords();
          break;
        case "weekly":
          renderWeeklySummary();
          break;
        case "monthly":
          renderMonthlyReport();
          break;
        case "inventory-logs":
          renderInventoryLogs();
          break;
      }
    }
  }

  function handleExportReport() {
    // Show export format selection modal
    showExportFormatModal();
  }

  function showExportFormatModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content modal-sm">
        <div class="modal-header">
          <h2>Export Records Report</h2>
          <button class="modal-close" id="closeExportFormatModal">×</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px;">Choose export format:</p>
          <button class="btn btn-primary" id="exportReportCSV" style="width: 100%; margin-bottom: 10px;">📊 Export as CSV</button>
          <button class="btn btn-secondary" id="exportReportPDF" style="width: 100%;">📄 Export as PDF</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#closeExportFormatModal').onclick = () => document.body.removeChild(modal);
    modal.querySelector('#exportReportCSV').onclick = () => { document.body.removeChild(modal); exportReportToCSV(); };
    modal.querySelector('#exportReportPDF').onclick = () => { document.body.removeChild(modal); exportReportToPDF(); };
    modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
  }

  function renderDailyCalendar() {
    const monthLabel = $("#dailyCalendarMonth");
    const grid = $("#dailyCalendarGrid");
    if (!grid || !monthLabel) return;

    const monthName = currentCalendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName;

    const firstOfMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1);
    const firstDayIndex = firstOfMonth.getDay();
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstDayIndex);

    const buildRange = (d) => getSingleDayRange(d);

    const hasRecordsOn = (date) => {
      const range = buildRange(date);
      const apps = filterAppointmentsByDate(appointments, range);
      const logs = Array.isArray(inventoryLogs) ? inventoryLogs : (storage.get('inventoryLogs') || []);
      const inv = logs.some(log => {
        const cost = parseAmount(log?.purchaseCost || log?.purchase_cost);
        if (!cost || log?.action !== 'add') return false;
        const when = log.dateReceived ? new Date(log.dateReceived) : new Date(log.timestamp);
        return when >= range.start && when <= range.end;
      });
      return apps.length > 0 || inv;
    };

    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }

    grid.innerHTML = days.map(d => {
      const isCurrentMonth = d.getMonth() === currentCalendarMonth.getMonth();
      const isToday = new Date().toDateString() === d.toDateString();
      const isSelected = selectedDailyDate.toDateString() === d.toDateString();
      const cls = [
        'calendar-day',
        isToday ? 'is-today' : '',
        isSelected ? 'is-selected' : '',
        isCurrentMonth ? '' : 'is-outside-month',
        hasRecordsOn(d) ? 'has-records' : ''
      ].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-date="${d.toISOString()}">${d.getDate()}</button>`;
    }).join('');

    grid.querySelectorAll('.calendar-day').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDailyDate = new Date(btn.getAttribute('data-date'));
        renderDailyCalendar();
        renderDailyRecords();
      });
    });
  }

  function changeCalendarMonth(delta) {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + delta, 1);
    renderDailyCalendar();
  }

  function exportReportToCSV() {
    const dateRange = getDateRange();
    const filteredAppointments = filterAppointmentsByDate(appointments, dateRange);

    // Prepare export data
    const reportData = {
      dateRange: {
        start: formatDate(dateRange.start),
        end: formatDate(dateRange.end),
        type: currentDateRange
      },
      summary: {
        totalAppointments: filteredAppointments.length,
        uniquePatients: new Set(filteredAppointments.map(getAppointmentPatientKey).filter(Boolean)).size,
        totalRevenue: filteredAppointments.reduce((sum, app) => sum + (app.amount || 0), 0)
      },
      appointments: filteredAppointments.map(appointment => {
        const patientRecord = findPatientForAppointment(appointment);
        const staff = getStaffNameById(appointment.staff);
        const embeddedPatient = appointment?.patient || appointment?.patientDetails || {};
        const contactNumber =
          patientRecord?.mobile ||
          patientRecord?.contactNumber ||
          patientRecord?.contact_number ||
          embeddedPatient?.mobile ||
          embeddedPatient?.contactNumber ||
          embeddedPatient?.contact_number ||
          appointment.patientMobile ||
          appointment.contactNumber ||
          appointment.mobile ||
          'N/A';

        return {
          Date: appointment.date,
          'Contact#': contactNumber,
          'Client Name': getPatientNameFromAppointment(appointment, patientRecord),
          'Staff/Employee': staff,
          'Procedure/Treatment': appointment.treatment,
          'Total Sales': formatCurrency(appointment.amount),
          'Down Payment': formatCurrency((appointment.down_payment || appointment.downPayment || 0)),
          'Cash': formatCurrency((appointment.cash_payment || appointment.cashPayment || 0)),
          'Bank/E-wallet/Credit': formatCurrency((appointment.bank_transfer || appointment.bankTransfer || 0)),
          'Expenses': formatCurrency(appointment.expenses || 0),
          'Payment Status': appointment.payment_status === 'full' ? 'Paid in Full' : 'Partial Payment',
          'Payment Method': formatPaymentMethod(appointment.payment_method),
          Notes: appointment.notes || ''
        };
      }),
      treatments: {},
      inventoryStatus: {
        totalItems: inventory.length,
        lowStock: inventory.filter(item => item.quantity <= item.minQuantity && item.quantity > 0).length,
        outOfStock: inventory.filter(item => item.quantity === 0).length
      }
    };

    // Calculate treatment summary
    filteredAppointments.forEach(app => {
      if (app.treatment) {
        if (!reportData.treatments[app.treatment]) {
          reportData.treatments[app.treatment] = { count: 0, revenue: 0 };
        }
        reportData.treatments[app.treatment].count++;
        reportData.treatments[app.treatment].revenue += app.amount || 0;
      }
    });

    // Convert to CSV format
    const csvSections = [
      "REPORT SUMMARY",
      `Date Range,${reportData.dateRange.start} to ${reportData.dateRange.end}`,
      `Total Appointments,${reportData.summary.totalAppointments}`,
      `Unique Patients,${reportData.summary.uniquePatients}`,
      `Total Revenue,${formatCurrency(reportData.summary.totalRevenue)}`,
      "",
      "APPOINTMENTS DETAIL"
    ];

    if (reportData.appointments.length > 0) {
      const appointmentHeaders = Object.keys(reportData.appointments[0]);
      csvSections.push(appointmentHeaders.join(','));
      reportData.appointments.forEach(appointment => {
        csvSections.push(appointmentHeaders.map(header => `"${appointment[header]}"`).join(','));
      });
    } else {
      csvSections.push("No appointments in selected date range");
    }

    csvSections.push("", "TREATMENT SUMMARY");
    Object.entries(reportData.treatments).forEach(([treatment, data]) => {
      csvSections.push(`${treatment},${data.count} appointments,${formatCurrency(data.revenue)}`);
    });

    csvSections.push("", "INVENTORY STATUS");
    csvSections.push(`Total Items,${reportData.inventoryStatus.totalItems}`);
    csvSections.push(`Low Stock Items,${reportData.inventoryStatus.lowStock}`);
    csvSections.push(`Out of Stock Items,${reportData.inventoryStatus.outOfStock}`);

    const csvContent = csvSections.join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `records_report_${currentDateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast("CSV report exported successfully!", "success");
  }

  function exportReportToPDF() {
    const dateRange = getDateRange();
    const filteredAppointments = filterAppointmentsByDate(appointments, dateRange);

    // Prepare export data
    const reportData = {
      dateRange: {
        start: formatDate(dateRange.start),
        end: formatDate(dateRange.end),
        type: currentDateRange
      },
      summary: {
        totalAppointments: filteredAppointments.length,
        uniquePatients: new Set(filteredAppointments.map(getAppointmentPatientKey).filter(Boolean)).size,
        totalRevenue: filteredAppointments.reduce((sum, app) => sum + (app.amount || 0), 0)
      },
      appointments: filteredAppointments.map(appointment => {
        const patientRecord = findPatientForAppointment(appointment);
        const staff = getStaffNameById(appointment.staff);
        const embeddedPatient = appointment?.patient || appointment?.patientDetails || {};
        const contactNumber =
          patientRecord?.mobile ||
          patientRecord?.contactNumber ||
          patientRecord?.contact_number ||
          embeddedPatient?.mobile ||
          embeddedPatient?.contactNumber ||
          embeddedPatient?.contact_number ||
          appointment.patientMobile ||
          appointment.contactNumber ||
          appointment.mobile ||
          'N/A';

        return {
          date: appointment.date,
          contactNumber: contactNumber,
          patient: getPatientNameFromAppointment(appointment, patientRecord),
          staff: staff,
          treatment: appointment.treatment,
          totalSales: appointment.amount,
          downPayment: (appointment.down_payment || appointment.downPayment || 0),
          cashPayment: (appointment.cash_payment || appointment.cashPayment || 0),
          bankTransfer: (appointment.bank_transfer || appointment.bankTransfer || 0),
          expenses: appointment.expenses || 0,
          paymentStatus: appointment.payment_status === 'full' ? 'Paid in Full' : 'Partial Payment',
          paymentMethod: formatPaymentMethod(appointment.payment_method),
          notes: appointment.notes || ''
        };
      }),
      treatments: {}
    };

    // Calculate treatment summary
    filteredAppointments.forEach(app => {
      if (app.treatment) {
        if (!reportData.treatments[app.treatment]) {
          reportData.treatments[app.treatment] = { count: 0, revenue: 0 };
        }
        reportData.treatments[app.treatment].count++;
        reportData.treatments[app.treatment].revenue += app.amount || 0;
      }
    });

    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString();

    printWindow.document.write(`
      <html><head><title>Records Report - ${reportData.dateRange.type}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #2563eb; margin: 0; font-size: 28px; }
        .header .subtitle { color: #666; margin: 10px 0 0 0; }
        .summary { display: flex; justify-content: space-around; background: #f8fafc; padding: 20px; margin-bottom: 30px; border-radius: 8px; }
        .summary-item { text-align: center; }
        .summary-item .number { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
        .summary-item .label { font-size: 12px; color: #666; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f8fafc; font-weight: 600; color: #374151; }
        tr:nth-child(even) { background: #f9fafb; }
        .treatment-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .treatment-item { background: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; }
        .treatment-name { font-weight: 600; color: #374151; margin-bottom: 5px; }
        .treatment-stats { font-size: 11px; color: #6b7280; }
      </style>
      </head><body>
        <div class="header">
          <h1>📊 Records & Analytics Report</h1>
          <p class="subtitle">Ink and Arch Medical Clinic</p>
          <p class="subtitle">Period: ${reportData.dateRange.start} to ${reportData.dateRange.end}</p>
          <p class="subtitle">Generated on: ${currentDate}</p>
        </div>

        <div class="summary">
          <div class="summary-item">
            <div class="number">${reportData.summary.totalAppointments}</div>
            <div class="label">Total Appointments</div>
          </div>
          <div class="summary-item">
            <div class="number">${reportData.summary.uniquePatients}</div>
            <div class="label">Unique Patients</div>
          </div>
          <div class="summary-item">
            <div class="number">₱${reportData.summary.totalRevenue.toLocaleString()}</div>
            <div class="label">Total Revenue</div>
          </div>
        </div>

        <div class="section">
          <h2>📋 Appointment Details</h2>
          ${reportData.appointments.length > 0 ? `
            <table style="font-size: 10px;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Contact#</th>
                  <th>Client</th>
                  <th>Staff</th>
                  <th>Treatment</th>
                  <th>Total Sales</th>
                  <th>Down Payment</th>
                  <th>Cash</th>
                  <th>Bank/E-wallet/Credit</th>
                  <th>Expenses</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.appointments.map(app => `
                  <tr>
                    <td>${formatDate(app.date)}</td>
                    <td>${app.contactNumber}</td>
                    <td><strong>${app.patient}</strong></td>
                    <td>${app.staff}</td>
                    <td>${app.treatment}</td>
                    <td>₱${app.totalSales.toLocaleString()}</td>
                    <td>₱${app.downPayment.toLocaleString()}</td>
                    <td>₱${app.cashPayment.toLocaleString()}</td>
                    <td>₱${app.bankTransfer.toLocaleString()}</td>
                    <td>₱${app.expenses.toLocaleString()}</td>
                    <td>${app.paymentStatus}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="text-align: center; color: #6b7280; padding: 20px;">No appointments found in the selected date range.</p>'}
        </div>

        <div class="section">
          <h2>🎯 Treatment Summary</h2>
          ${Object.keys(reportData.treatments).length > 0 ? `
            <div class="treatment-summary">
              ${Object.entries(reportData.treatments).map(([treatment, data]) => `
                <div class="treatment-item">
                  <div class="treatment-name">${treatment}</div>
                  <div class="treatment-stats">
                    ${data.count} appointment${data.count !== 1 ? 's' : ''} • ₱${data.revenue.toLocaleString()} revenue
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="text-align: center; color: #6b7280; padding: 20px;">No treatments recorded in the selected date range.</p>'}
        </div>

        <div class="section">
          <h2>📦 Inventory Status</h2>
          <table>
            <tr><th>Metric</th><th>Count</th></tr>
            <tr><td>Total Items in Inventory</td><td>${inventory.length}</td></tr>
            <tr><td>Low Stock Items</td><td>${inventory.filter(item => item.quantity <= item.minQuantity && item.quantity > 0).length}</td></tr>
            <tr><td>Out of Stock Items</td><td>${inventory.filter(item => item.quantity === 0).length}</td></tr>
          </table>
        </div>

        <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); };</script>
      </body></html>
    `);

    printWindow.document.close();
    showToast("PDF report generated successfully!", "success");
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
      hideCustomDateModal();
    }

    // Ctrl/Cmd + E to export report
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
      e.preventDefault();
      handleExportReport();
    }

    // Ctrl/Cmd + Shift + C to export CSV directly
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
      e.preventDefault();
      exportReportToCSV();
    }

    // Ctrl/Cmd + Shift + P to export PDF directly
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
      e.preventDefault();
      exportReportToPDF();
    }
  });

  // Auto-refresh every 5 minutes
  setInterval(function () {
    loadData();
  }, 5 * 60 * 1000);
});

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
