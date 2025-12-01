// Inventory page functionality

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
  if (!currentUser) {
    showToast("Access denied. You don't have permission to view this page.", "error");
    setTimeout(() => navigate("dashboard.html"), 2000);
    return;
  }

  // Block employees from accessing inventory page
  if (currentUser.role === "employee") {
    showToast("Access denied. Employees cannot access inventory management.", "error");
    setTimeout(() => navigate("dashboard.html"), 2000);
    return;
  }

  // State management
  let inventory = [];
  let filteredInventory = [];
  let inventoryLogs = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let currentEditItemId = null;
  let currentStockItemId = null;

  // Categories state and helpers
  let categories = [];
  try {
    categories = JSON.parse(localStorage.getItem('categories')) || [];
  } catch (_) {
    categories = [];
  }
  function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
  }
  // Category pagination state
  let categoriesPage = 1;
  const categoriesPerPage = 8;

  function renderCategories() {
    const categoriesList = document.getElementById('categoriesList');
    const categoryFilter = document.getElementById('categoryFilter');
    const categoriesPagination = document.getElementById('categoriesPagination');
    if (categoriesList) {
      categoriesList.innerHTML = '';
      const totalPages = Math.max(1, Math.ceil(categories.length / categoriesPerPage));
      if (categoriesPage > totalPages) categoriesPage = totalPages;
      const start = (categoriesPage - 1) * categoriesPerPage;
      const pageItems = categories.slice(start, start + categoriesPerPage);

      pageItems.forEach((cat, index) => {
        const row = document.createElement('div');
        row.className = 'category-row';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid var(--gray-100, #f3f4f6)';
        row.innerHTML = `<div class="category-label">${cat}</div><div><button class="btn btn-danger btn-sm" data-index="${start + index}">Delete</button></div>`;
        categoriesList.appendChild(row);
      });

      // Pagination controls
      if (categoriesPagination) {
        categoriesPagination.innerHTML = '';
        if (totalPages > 1) {
          const prev = document.createElement('button');
          prev.className = 'btn btn-secondary btn-sm';
          prev.textContent = 'Previous';
          prev.disabled = categoriesPage === 1;
          prev.addEventListener('click', () => { categoriesPage = Math.max(1, categoriesPage - 1); renderCategories(); });
          const next = document.createElement('button');
          next.className = 'btn btn-secondary btn-sm';
          next.textContent = 'Next';
          next.disabled = categoriesPage === totalPages;
          next.addEventListener('click', () => { categoriesPage = Math.min(totalPages, categoriesPage + 1); renderCategories(); });
          const pageInfo = document.createElement('span');
          pageInfo.style.margin = '0 8px';
          pageInfo.textContent = `${categoriesPage} / ${totalPages}`;
          categoriesPagination.appendChild(prev);
          categoriesPagination.appendChild(pageInfo);
          categoriesPagination.appendChild(next);
        }
      }
    }
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="all">All Categories</option>';
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categoryFilter.appendChild(opt);
      });
    }
  }
  function populateItemCategories() {
    const itemCategory = document.getElementById('itemCategory');
    if (!itemCategory) return;
    itemCategory.innerHTML = '<option value="">Select category</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      itemCategory.appendChild(opt);
    });
  }
  function populateCategoryOptions() {
    renderCategories();
    populateItemCategories();
  }

  function normalizeItemName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function isDuplicateItemName(name, excludeId) {
    if (!name) return false;
    const normalized = normalizeItemName(name);
    return inventory.some(item => {
      if (!item) return false;
      if (excludeId && String(item.id) === String(excludeId)) return false;
      return normalizeItemName(item.name) === normalized;
    });
  }

  function setItemNameError(message) {
    const nameInput = $("#itemName");
    if (!nameInput) return;
    nameInput.classList.add("input-error");
    nameInput.setAttribute("aria-invalid", "true");
    if (typeof nameInput.setCustomValidity === "function") {
      nameInput.setCustomValidity(message || "Invalid value");
      nameInput.reportValidity();
    }
    nameInput.focus();
  }

  function clearItemNameError() {
    const nameInput = $("#itemName");
    if (!nameInput) return;
    nameInput.classList.remove("input-error");
    nameInput.removeAttribute("aria-invalid");
    if (typeof nameInput.setCustomValidity === "function") {
      nameInput.setCustomValidity("");
    }
  }

  function wireCategoryModalHandlers() {
    const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
    const manageCategoriesModal = document.getElementById('manageCategoriesModal');
    const closeManageCategoriesBtn = document.getElementById('closeManageCategoriesBtn');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const categoriesList = document.getElementById('categoriesList');

    if (manageCategoriesBtn && manageCategoriesModal) {
      manageCategoriesBtn.addEventListener('click', () => {
        // Center modal
        manageCategoriesModal.style.display = 'flex';
        manageCategoriesModal.style.alignItems = 'center';
        manageCategoriesModal.style.justifyContent = 'center';
        renderCategories();
      });
    }
    if (closeManageCategoriesBtn && manageCategoriesModal) {
      closeManageCategoriesBtn.addEventListener('click', () => {
        manageCategoriesModal.style.display = 'none';
      });
    }
    if (addCategoryBtn && newCategoryInput) {
      addCategoryBtn.addEventListener('click', () => {
        let val = newCategoryInput.value.trim();
        if (!val) return;
        // Normalize for duplicate check (case-insensitive)
        const normalized = val.toLowerCase();
        const exists = categories.some(c => c.toLowerCase() === normalized);
        if (exists) {
          showToast('Category name is taken', 'warning');
          return;
        }
        // Capitalize each word before saving
        val = val.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        categories.push(val);
        saveCategories();
        newCategoryInput.value = '';
        renderCategories();
        populateItemCategories();
      });
    }
    if (categoriesList) {
      categoriesList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-index]');
        if (!btn) return;
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!Number.isNaN(idx)) {
          categories.splice(idx, 1);
          saveCategories();
          renderCategories();
          populateItemCategories();
          applyFilters();
        }
      });
    }
    window.addEventListener('click', (e) => {
      if (manageCategoriesModal && e.target === manageCategoriesModal) {
        manageCategoriesModal.style.display = 'none';
      }
    });
  }


  // State for sales/revenue tracking
  let appointments = [];

  // Initialize page
  initializeInventoryPage();
  setupEventListeners();
  wireCategoryModalHandlers();
  resetInventoryIfNeeded().then(loadData);

  // Load appointments for revenue tracking
  setTimeout(() => loadAppointmentsForRevenue(), 500);

  function initializeInventoryPage() {
    populateCategoryOptions();

    // Set user name
    const currentUser = storage.get("currentUser");
    const userNameElement = $("#userName");
    if (userNameElement && currentUser) {
      userNameElement.textContent = currentUser.name || "Admin";
    }

    // Hide employees tab for front desk users
    if (currentUser && currentUser.role === "front_desk") {
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

    // Add item button
    const addItemBtn = $("#addItemBtn");
    if (addItemBtn) {
      addItemBtn.addEventListener("click", () => showAddItemModal());
    }

    // Notification button
    const notificationBtn = $("#notificationBtn");
    if (notificationBtn) {
      notificationBtn.addEventListener("click", showAlertsModal);
    }

    // Search input
    const searchInput = $("#searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    }

    // Filter selects
    const categoryFilter = $("#categoryFilter");
    const statusFilter = $("#statusFilter");
    if (categoryFilter) {
      categoryFilter.addEventListener("change", handleFilters);
    }
    if (statusFilter) {
      statusFilter.addEventListener("change", handleFilters);
    }

    // Export button
    const exportBtn = $("#exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", handleExport);
    }

    // Modal close buttons and form submissions
    setupModalEventListeners();

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
    // Add item modal
    const closeModalBtn = $("#closeModalBtn");
    const cancelBtn = $("#cancelBtn");
    const addItemModal = $("#addItemModal");
    const itemForm = $("#itemForm");

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", hideAddItemModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", hideAddItemModal);
    }
    if (addItemModal) {
      addItemModal.addEventListener("click", function (e) {
        if (e.target === addItemModal) {
          hideAddItemModal();
        }
      });
    }
    if (itemForm) {
      itemForm.addEventListener("submit", handleItemFormSubmit);
    }

    const itemNameInput = $("#itemName");
    if (itemNameInput) {
      itemNameInput.addEventListener("input", clearItemNameError);
    }

    // Add validation for Current Quantity field - numbers only, max 10 digits
    const itemQuantityInput = $("#itemQuantity");
    if (itemQuantityInput) {
      itemQuantityInput.addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 10) {
          this.value = this.value.slice(0, 10);
        }
      });
    }

    // Stock update modal
    const closeStockModalBtn = $("#closeStockModalBtn");
    const cancelStockBtn = $("#cancelStockBtn");
    const stockUpdateModal = $("#stockUpdateModal");
    const stockForm = $("#stockForm");

    if (closeStockModalBtn) {
      closeStockModalBtn.addEventListener("click", hideStockUpdateModal);
    }
    if (cancelStockBtn) {
      cancelStockBtn.addEventListener("click", hideStockUpdateModal);
    }
    if (stockUpdateModal) {
      stockUpdateModal.addEventListener("click", function (e) {
        if (e.target === stockUpdateModal) {
          hideStockUpdateModal();
        }
      });
    }
    if (stockForm) {
      stockForm.addEventListener("submit", handleStockFormSubmit);
    }

    // Add validation for Stock Quantity field - numbers only, max 10 digits
    const stockQuantityInput = $("#stockQuantity");
    if (stockQuantityInput) {
      stockQuantityInput.addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 10) {
          this.value = this.value.slice(0, 10);
        }
      });
    }

    // Add validation for Supplier/Seller - max 15 characters
    const stockSupplierInput = $("#stockSupplier");
    if (stockSupplierInput) {
      stockSupplierInput.addEventListener("input", function () {
        if (this.value.length > 15) {
          this.value = this.value.slice(0, 15);
        }
      });
    }

    // Add validation for Platform - max 15 characters
    const stockPlatformInput = $("#stockPlatform");
    if (stockPlatformInput) {
      stockPlatformInput.addEventListener("input", function () {
        if (this.value.length > 15) {
          this.value = this.value.slice(0, 15);
        }
      });
    }

    // Alerts modal
    const closeAlertsModalBtn = $("#closeAlertsModalBtn");
    const alertsModal = $("#alertsModal");

    if (closeAlertsModalBtn) {
      closeAlertsModalBtn.addEventListener("click", hideAlertsModal);
    }
    if (alertsModal) {
      alertsModal.addEventListener("click", function (e) {
        if (e.target === alertsModal) {
          hideAlertsModal();
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
          renderInventoryTable();
          updatePagination();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderInventoryTable();
          updatePagination();
        }
      });
    }
  }

  async function loadData() {
    try {
      showLoadingState();

      // Try to load inventory from server database first
      try {
        const response = await fetch('/api/inventory');
        if (response.ok) {
          const dbInventory = await response.json();
          inventory = dbInventory || [];
          console.log('✅ Loaded inventory from database:', inventory.length);
          if (inventory.length > 0) {
            console.log('Sample item fields:', Object.keys(inventory[0]));
          }

          // Cache to IndexedDB for synchronization
          if (typeof cacheSync !== 'undefined' && inventory.length > 0) {
            await cacheSync.cacheInventory(inventory);
          }
        } else {
          throw new Error('Failed to load from database');
        }
      } catch (apiError) {
        console.warn('⚠️ Database API unavailable, checking cache...', apiError.message);

        // Try to load from IndexedDB cache first
        if (typeof cacheSync !== 'undefined') {
          const cachedInventory = await cacheSync.getInventoryFromCache();
          if (cachedInventory && cachedInventory.length > 0) {
            inventory = cachedInventory;
            console.log('✅ Loaded inventory from IndexedDB cache:', inventory.length);
          } else {
            // Fallback to localStorage
            inventory = storage.get("inventory") || [];
            console.log('⚠️ Using localStorage fallback');
          }
        } else {
          // Cache sync not available, use localStorage
          inventory = storage.get("inventory") || [];
          console.log('⚠️ Using localStorage fallback (cache-sync not available)');
        }
      }

      inventoryLogs = storage.get("inventoryLogs") || [];

      filteredInventory = [...inventory];
      renderInventoryTable();
      updateItemCount();
      updatePagination();
      updateNotificationCount();
      updateInventorySummaries();

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
      showToast("Failed to load inventory", "error");
      console.error("Error loading inventory:", error);
    }
  }

  function showLoadingState() {
    const tableBody = $("#inventoryTableBody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="loading-row">
            <div class="loading-spinner">
              <div class="spinner"></div>
              <span>Loading inventory...</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function renderInventoryTable() {
    const tableBody = $("#inventoryTableBody");
    if (!tableBody) return;

    if (filteredInventory.length === 0) {
      tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="3.27,6.96 12,12.01 20.73,6.96" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3>No items found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </td>
      </tr>
    `;
      return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredInventory.slice(startIndex, endIndex);

    tableBody.innerHTML = pageItems
      .map((item) => {
        const status = getItemStatus(item);
        return `
        <tr>
          <td>
            <div class="item-info">
              <div class="item-details">
                <div class="item-name">${item.name}</div>
                ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <div class="item-category">${item.category}</div>
          </td>
          <td>
            <div class="stock-quantity">${item.quantity}</div>
          </td>
          <td>
            <div class="min-quantity">${item.min_quantity || 0}</div>
          </td>
          <td>
            <span class="status-badge ${status.class}">${status.text}</span>
          </td>
          <td>
            <div class="item-unit">${item.unit}</div>
          </td>
          <td>
            <div class="item-expiry">${item.expiry_date ? formatDate(new Date(item.expiry_date)) : 'No expiry set'}</div>
          </td>
          <td>
            <div class="action-buttons">
              <button class="action-btn stock" onclick="updateStock(${item.id})" title="Update Stock">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="action-btn edit" onclick="editItem(${item.id})" title="Edit Item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="action-btn delete" onclick="deleteItem(${item.id}, '${item.name}')" title="Delete Item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function getItemStatus(item) {
    // Check expiry first (highest priority)
    if (item.expiry_date) {
      const today = new Date();
      const expiryDate = new Date(item.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        return { class: "expired", text: "Expired" };
      } else if (daysUntilExpiry <= 7) {
        return { class: "near-expiry", text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}` };
      }
    }

    // Then check stock levels
    if (item.quantity === 0) {
      return { class: "out-of-stock", text: "Out of Stock" };
    } else if (item.quantity <= (item.min_quantity || 0)) {
      return { class: "low-stock", text: "Low Stock" };
    } else {
      return { class: "in-stock", text: "In Stock" };
    }
  }

  function updateItemCount() {
    const itemCount = $("#itemCount");
    if (itemCount) {
      const count = filteredInventory.length;
      itemCount.textContent = `${count} item${count !== 1 ? "s" : ""}`;
    }
  }

  function updateNotificationCount() {
    // Count all items that need attention (out of stock, low stock, expired, near expiry)
    const alertItems = inventory.filter(item => {
      const status = getItemStatus(item);
      return status.class === 'out-of-stock' ||
        status.class === 'low-stock' ||
        status.class === 'expired' ||
        status.class === 'near-expiry';
    });

    const notificationCount = $("#notificationCount");
    const notificationBtn = $("#notificationBtn");

    if (notificationCount && notificationBtn) {
      if (alertItems.length > 0) {
        notificationCount.textContent = alertItems.length;
        notificationCount.classList.remove("hidden");
        notificationBtn.classList.remove("hidden");

        // Change button color based on severity
        const hasCritical = alertItems.some(item => {
          const status = getItemStatus(item);
          return status.class === 'expired' || status.class === 'out-of-stock';
        });

        if (hasCritical) {
          notificationBtn.classList.remove("btn-warning");
          notificationBtn.classList.add("btn-danger");
        } else {
          notificationBtn.classList.remove("btn-danger");
          notificationBtn.classList.add("btn-warning");
        }
      } else {
        notificationCount.classList.add("hidden");
        notificationBtn.classList.add("hidden");
      }
    }
  }

  function updatePagination() {
    const totalItems = filteredInventory.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    // Update pagination info
    const paginationInfo = $("#paginationInfo");
    if (paginationInfo) {
      if (totalItems === 0) {
        paginationInfo.textContent = "No items to show";
      } else {
        paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} items`;
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
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    applyFilters(searchTerm);
  }

  function applyFilters(searchTerm = "") {
    const categoryFilter = $("#categoryFilter");
    const statusFilter = $("#statusFilter");

    const categoryValue = categoryFilter ? categoryFilter.value : "all";
    const statusValue = statusFilter ? statusFilter.value : "all";

    filteredInventory = inventory.filter((item) => {
      if (!item || !item.name) return false;

      const matchesSearch =
        !searchTerm ||
        String(item.name).toLowerCase().includes(searchTerm) ||
        String(item.category || "").toLowerCase().includes(searchTerm) ||
        (item.description && String(item.description).toLowerCase().includes(searchTerm)) ||
        String(item.supplier || "").toLowerCase().includes(searchTerm) ||
        String(item.platform || "").toLowerCase().includes(searchTerm);

      const matchesCategory =
        categoryValue === "all" || item.category === categoryValue;

      const itemStatus = getItemStatus(item);
      let matchesStatus = true;
      if (statusValue === "in_stock") {
        matchesStatus = itemStatus.class === "in-stock";
      } else if (statusValue === "low_stock") {
        matchesStatus = itemStatus.class === "low-stock";
      } else if (statusValue === "out_of_stock") {
        matchesStatus = itemStatus.class === "out-of-stock";
      } else if (statusValue === "expired") {
        matchesStatus = itemStatus.class === "expired";
      } else if (statusValue === "near_expiry") {
        matchesStatus = itemStatus.class === "near-expiry";
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort by status priority for better UX: critical items first
    filteredInventory.sort((a, b) => {
      const statusA = getItemStatus(a);
      const statusB = getItemStatus(b);
      const priorityOrder = { 'expired': 0, 'out-of-stock': 1, 'near-expiry': 2, 'low-stock': 3, 'in-stock': 4 };
      const priorityA = priorityOrder[statusA.class] || 5;
      const priorityB = priorityOrder[statusB.class] || 5;
      return priorityA - priorityB;
    });

    currentPage = 1;
    renderInventoryTable();
    updateItemCount();
    updatePagination();
  }

  async function resetInventoryIfNeeded() {
    try {
      // Only run this initialization once per browser
      if (localStorage.getItem('inventoryInitialized') === 'true') return;

      // Initialize categories from database if not already set
      if (categories.length === 0) {
        try {
          const resp = await fetch('/api/inventory');
          if (resp.ok) {
            const items = await resp.json();
            // Extract unique categories from existing items
            const uniqueCategories = [...new Set(items.map(item => item.category).filter(Boolean))];
            if (uniqueCategories.length > 0) {
              categories = uniqueCategories;
              saveCategories();
            }
          }
        } catch (error) {
          console.warn('Could not load categories from database:', error.message);
        }
      }

      // Mark initialization as complete
      localStorage.setItem('inventoryInitialized', 'true');
    } catch (e) {
      console.warn('Inventory initialization skipped:', e);
    }
  }

  function showAddItemModal() {
    const modal = $("#addItemModal");
    const form = $("#itemForm");

    clearItemNameError();

    if (form) {
      form.reset();
      // Set default date to today
      form.date.value = new Date().toISOString().slice(0, 10);
      currentEditItemId = null;
    }

    // Hide history section on add
    const historySection = document.getElementById('itemHistorySection');
    const historyList = document.getElementById('itemHistoryList');
    if (historySection) historySection.classList.add('hidden');
    if (historyList) historyList.innerHTML = '';

    // Update modal title
    const modalTitle = modal.querySelector(".modal-header h2");
    const submitBtn = $("#saveItemBtn");
    const submitBtnText = submitBtn.querySelector(".btn-text");

    if (modalTitle) modalTitle.textContent = "Add New Item";
    if (submitBtnText) submitBtnText.textContent = "Add Item";

    showModal("#addItemModal");
  }

  function hideAddItemModal() {
    hideModal("#addItemModal");
    currentEditItemId = null;
  }

  function showStockUpdateModal(itemId) {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    currentStockItemId = itemId;

    // Update modal content
    const itemNameElement = $("#stockItemName");
    const currentStockElement = $("#currentStockAmount");
    const currentStockUnitElement = $("#currentStockUnit");
    const form = $("#stockForm");
    const stockExpiryRow = document.getElementById('stockExpiryRow');
    const stockExpiryDate = document.getElementById('stockExpiryDate');

    if (itemNameElement) itemNameElement.textContent = item.name;
    if (currentStockElement) currentStockElement.textContent = item.quantity;
    if (currentStockUnitElement) currentStockUnitElement.textContent = item.unit;

    // Reset form
    if (form) {
      form.reset();
      const dateReceivedEl = document.getElementById('stockDateReceived');
      if (dateReceivedEl) dateReceivedEl.value = new Date().toISOString().slice(0, 10);
    }

    // Show expiry updater only if item has expiry set
    if (stockExpiryRow && stockExpiryDate) {
      if (item.expiry_date) {
        stockExpiryRow.style.display = 'flex';
        try {
          stockExpiryDate.value = new Date(item.expiry_date).toISOString().slice(0, 10);
        } catch (_) {
          stockExpiryDate.value = '';
        }
      } else {
        stockExpiryRow.style.display = 'none';
        stockExpiryDate.value = '';
      }
    }

    showModal("#stockUpdateModal");
  }

  function hideStockUpdateModal() {
    hideModal("#stockUpdateModal");
    currentStockItemId = null;
  }

  function showAlertsModal() {
    // Get all items that need attention
    const alertItems = inventory.filter(item => {
      const status = getItemStatus(item);
      return status.class === 'out-of-stock' ||
        status.class === 'low-stock' ||
        status.class === 'expired' ||
        status.class === 'near-expiry';
    });

    const alertsList = $("#alertsList");

    if (alertsList) {
      if (alertItems.length === 0) {
        alertsList.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No alerts</h3>
            <p>All items are properly stocked and within expiry dates</p>
          </div>
        `;
      } else {
        // Sort alerts by priority: expired > out of stock > near expiry > low stock
        const sortedAlerts = alertItems.sort((a, b) => {
          const statusA = getItemStatus(a);
          const statusB = getItemStatus(b);
          const priorityOrder = { 'expired': 0, 'out-of-stock': 1, 'near-expiry': 2, 'low-stock': 3 };
          return priorityOrder[statusA.class] - priorityOrder[statusB.class];
        });

        alertsList.innerHTML = sortedAlerts.map(item => {
          const status = getItemStatus(item);
          let alertClass = '';
          let alertIcon = '';

          switch (status.class) {
            case 'expired':
              alertClass = 'critical';
              alertIcon = '⚠️';
              break;
            case 'out-of-stock':
              alertClass = 'critical';
              alertIcon = '❌';
              break;
            case 'near-expiry':
              alertClass = 'warning';
              alertIcon = '⏰';
              break;
            case 'low-stock':
              alertClass = 'warning';
              alertIcon = '📦';
              break;
          }

          return `
            <div class="alert-item ${alertClass}" onclick="filterByItem('${item.name.replace(/'/g, "\\'")}', '${status.class}')" style="cursor: pointer;">
              <div class="alert-header">
                <div class="alert-title">
                  <span class="alert-icon">${alertIcon}</span>
                  ${item.name}
                  <span class="click-hint">📍 Click to locate</span>
                </div>
                <div class="alert-status ${alertClass}">
                  ${status.text.toUpperCase()}
                </div>
              </div>
              <div class="alert-message">
                ${status.class === 'expired' || status.class === 'near-expiry' ?
              `Expiry: ${item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'Not set'} | ` : ''}
                Current stock: ${item.quantity} ${item.unit}${item.min_quantity ? ` | Min required: ${item.min_quantity} ${item.unit}` : ''}
                ${status.class === 'out-of-stock' || status.class === 'expired' ? ' - Immediate action required!' : ' - Consider taking action soon.'}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    showModal("#alertsModal");
  }

  function hideAlertsModal() {
    hideModal("#alertsModal");
  }

  // Global function to filter by item from alerts
  window.filterByItem = function (itemName, statusClass) {
    // Close the alerts modal
    hideAlertsModal();

    // Set search filter to item name
    const searchInput = $("#searchInput");
    if (searchInput) {
      searchInput.value = itemName;
    }

    // Set status filter to match the alert type
    const statusFilter = $("#statusFilter");
    if (statusFilter) {
      let statusValue = 'all';
      switch (statusClass) {
        case 'out-of-stock':
          statusValue = 'out_of_stock';
          break;
        case 'low-stock':
          statusValue = 'low_stock';
          break;
        case 'expired':
          statusValue = 'expired';
          break;
        case 'near-expiry':
          statusValue = 'near_expiry';
          break;
      }
      statusFilter.value = statusValue;
    }

    // Apply filters to show the specific item
    applyFilters();

    // Show toast notification
    showToast(`Showing: ${itemName}`, "info");

    // Scroll to top of table
    const inventorySection = $(".inventory-section");
    if (inventorySection) {
      inventorySection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  async function handleItemFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const itemData = Object.fromEntries(formData.entries());

    clearItemNameError();

    itemData.name = (itemData.name || "").trim();

    // Map form fields to database fields
    itemData.expiry_date = formData.get("expirationDate") || null;
    itemData.min_quantity = parseInt(formData.get("minQuantity")) || 0;

    // Additional purchase fields
    itemData.purchase_cost = parseFloat(formData.get('purchaseCost')) || 0;
    itemData.supplier = (formData.get('supplier') || '').trim();
    itemData.platform = (formData.get('platform') || '').trim();
    itemData.date_received = formData.get('date') || null;

    // Remove original form field names to avoid conflicts
    delete itemData.expirationDate;
    delete itemData.minQuantity;

    // Convert numeric fields
    itemData.quantity = parseInt(itemData.quantity) || 0;

    // Validate quantity
    if (itemData.quantity < 0) {
      showToast('Item quantity cannot be negative', 'warning');
      return;
    }

    if (!itemData.name) {
      showToast("Item name is required.", "warning");
      setItemNameError("Item name is required.");
      return;
    }

    if (itemData.name.length > 50) {
      showToast("Item name is too long (max 50 characters)", "warning");
      setItemNameError("Item name is too long (max 50 characters)");
      return;
    }

    if (isDuplicateItemName(itemData.name, currentEditItemId)) {
      showToast("An item with this name already exists. Please choose a different name.", "warning");
      setItemNameError("Item name already exists. Please choose a different name.");
      return;
    }

    // Validate category
    if (!itemData.category || itemData.category === '') {
      showToast('Please select a category', 'warning');
      return;
    }

    // Validate unit
    if (!itemData.unit || itemData.unit === '') {
      showToast('Please specify a unit', 'warning');
      return;
    }

    // Required purchase details validation
    if (!itemData.purchase_cost || isNaN(itemData.purchase_cost) || itemData.purchase_cost < 0) {
      showToast('Purchase cost must be a valid positive number', 'warning');
      return;
    }
    if (!itemData.supplier) {
      showToast('Supplier/Seller is required', 'warning');
      return;
    }
    if (!itemData.platform) {
      showToast('Platform is required', 'warning');
      return;
    }

    // Enforce maxlength limits
    itemData.name = String(itemData.name).slice(0, 24);
    itemData.supplier = String(itemData.supplier).slice(0, 24);
    itemData.platform = String(itemData.platform).slice(0, 24);
    itemData.description = String(itemData.description || '').slice(0, 24);

    const submitBtn = $("#saveItemBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnSpinner = submitBtn.querySelector(".btn-spinner");

    // Show loading state
    submitBtn.disabled = true;
    btnText.classList.add("hidden");
    btnSpinner.classList.remove("hidden");

    try {
      if (currentEditItemId) {
        // Update existing item via server API
        try {
          const response = await fetch(`/api/inventory/${currentEditItemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
          });

          if (!response.ok) {
            throw new Error('Failed to update item on server');
          }
        } catch (apiError) {
          console.warn('API update failed, using localStorage:', apiError.message);
        }

        // Update local data
        const itemIndex = inventory.findIndex(item => item.id === currentEditItemId);
        if (itemIndex !== -1) {
          const prevQty = parseInt(inventory[itemIndex].quantity) || 0;
          const nextQty = parseInt(itemData.quantity) || prevQty;
          inventory[itemIndex] = {
            ...inventory[itemIndex],
            ...itemData,
            lastUpdated: new Date().toISOString(),
          };
          // Log edit if quantity changed
          if (nextQty !== prevQty) {
            const editLog = {
              id: Math.max(...inventoryLogs.map(l => l.id), 0) + 1,
              itemId: inventory[itemIndex].id,
              itemName: inventory[itemIndex].name,
              action: 'set',
              quantity: Math.abs(nextQty - prevQty),
              oldQuantity: prevQty,
              newQuantity: nextQty,
              reason: 'Edited via item form',
              purchaseCost: itemData.purchase_cost || 0,
              supplier: itemData.supplier || '',
              platform: itemData.platform || '',
              dateReceived: itemData.date_received || null,
              timestamp: new Date().toISOString(),
            };
            inventoryLogs.push(editLog);
            storage.set('inventoryLogs', inventoryLogs);
          }
        }
        showToast("Item updated successfully!", "success");
      } else {
        // Create new item via server API
        try {
          const newItemData = {
            ...itemData,
            createdAt: itemData.date || new Date().toISOString(),
          };

          const response = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItemData)
          });

          if (!response.ok) {
            throw new Error('Failed to create item on server');
          }

          const result = await response.json();

          // Add the new item to local array with server-assigned ID
          const newItem = {
            id: result.id || Math.max(...inventory.map(item => item.id), 0) + 1,
            ...newItemData,
          };
          inventory.push(newItem);
          // Log initial stock as an addition
          const initLog = {
            id: Math.max(...inventoryLogs.map(l => l.id), 0) + 1,
            itemId: newItem.id,
            itemName: newItem.name,
            action: 'add',
            quantity: parseInt(newItem.quantity) || 0,
            oldQuantity: 0,
            newQuantity: parseInt(newItem.quantity) || 0,
            reason: 'Initial stock',
            purchaseCost: newItem.purchase_cost || 0,
            supplier: newItem.supplier || '',
            platform: newItem.platform || '',
            dateReceived: newItem.date_received || (newItem.createdAt ? newItem.createdAt.split('T')[0] : null),
            timestamp: new Date().toISOString(),
          };
          inventoryLogs.push(initLog);
          storage.set('inventoryLogs', inventoryLogs);
        } catch (apiError) {
          console.warn('API creation failed, using localStorage:', apiError.message);
          // Fallback to local creation
          const newItem = {
            id: Math.max(...inventory.map(item => item.id), 0) + 1,
            ...itemData,
            createdAt: itemData.date || new Date().toISOString(),
          };
          inventory.push(newItem);
          // Log initial stock as an addition
          const initLog = {
            id: Math.max(...inventoryLogs.map(l => l.id), 0) + 1,
            itemId: newItem.id,
            itemName: newItem.name,
            action: 'add',
            quantity: parseInt(newItem.quantity) || 0,
            oldQuantity: 0,
            newQuantity: parseInt(newItem.quantity) || 0,
            reason: 'Initial stock',
            purchaseCost: newItem.purchase_cost || 0,
            supplier: newItem.supplier || '',
            platform: newItem.platform || '',
            dateReceived: newItem.date_received || (newItem.createdAt ? newItem.createdAt.split('T')[0] : null),
            timestamp: new Date().toISOString(),
          };
          inventoryLogs.push(initLog);
          storage.set('inventoryLogs', inventoryLogs);
        }

        showToast("Item added successfully!", "success");
      }

      // Save to storage
      storage.set("inventory", inventory);

      // Refresh the display
      applyFilters();
      updateNotificationCount();

      // Update inventory summaries when inventory changes
      if (typeof updateInventorySummaries === 'function') {
        updateInventorySummaries();
      }

      hideAddItemModal();
    } catch (error) {
      showToast("Failed to save item. Please try again.", "error");
      console.error("Item form error:", error);
    } finally {
      // Reset loading state
      submitBtn.disabled = false;
      btnText.classList.remove("hidden");
      btnSpinner.classList.add("hidden");
    }
  }

  async function handleStockFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const stockData = Object.fromEntries(formData.entries());

    // Validate quantity input
    const quantity = parseInt(stockData.quantity) || 0;
    if (quantity < 0) {
      showToast('Quantity cannot be negative', 'warning');
      return;
    }

    // Parse additional fields
    const purchaseCost = parseFloat(stockData.purchaseCost) || 0;
    const supplier = (stockData.supplier || '').trim();
    const platform = (stockData.platform || '').trim();
    const dateReceived = stockData.dateReceived || null;
    const action = (stockData.action || '').trim();

    // Validate action
    if (!action || !['add', 'remove', 'set'].includes(action)) {
      showToast('Invalid action selected', 'warning');
      return;
    }

    const submitBtn = $("#saveStockBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnSpinner = submitBtn.querySelector(".btn-spinner");

    // Show loading state
    submitBtn.disabled = true;
    btnText.classList.add("hidden");
    btnSpinner.classList.remove("hidden");

    try {
      const item = inventory.find(i => i.id === currentStockItemId);
      if (item) {
        const oldQuantity = item.quantity;

        switch (action) {
          case "add":
            item.quantity += quantity;
            break;
          case "remove":
            item.quantity = Math.max(0, item.quantity - quantity);
            break;
          case "set":
            item.quantity = quantity;
            break;
        }

        // Update expiry date if provided
        const newExpiry = stockData.stockExpiryDate ? stockData.stockExpiryDate : null;
        if (newExpiry) {
          item.expiry_date = newExpiry;
        }

        // Persist purchase meta on item (last known)
        if (supplier) item.supplier = supplier;
        if (platform) item.platform = platform;
        if (!Number.isNaN(purchaseCost)) item.purchase_cost = purchaseCost;
        if (dateReceived) item.date_received = dateReceived;

        item.lastUpdated = new Date().toISOString();

        // Try server update
        try {
          const updatePayload = {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            min_quantity: item.min_quantity || 0,
            unit: item.unit,
            description: item.description || '',
            expiry_date: item.expiry_date || null,
            supplier: supplier || item.supplier || '',
            platform: platform || item.platform || '',
            purchase_cost: typeof purchaseCost === 'number' ? purchaseCost : (item.purchase_cost || 0),
            date_received: dateReceived || item.date_received || null
          };
          await fetch(`/api/inventory/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
          }).catch(() => { });
        } catch (_) { }

        // Log the stock change
        const logEntry = {
          id: Math.max(...inventoryLogs.map(l => l.id), 0) + 1,
          itemId: item.id,
          itemName: item.name,
          action: action,
          quantity: quantity,
          oldQuantity: oldQuantity,
          newQuantity: item.quantity,
          reason: stockData.reason || "",
          purchaseCost: purchaseCost,
          supplier: supplier,
          platform: platform,
          dateReceived: dateReceived,
          timestamp: new Date().toISOString(),
        };
        inventoryLogs.push(logEntry);

        // Save to storage
        storage.set("inventory", inventory);
        storage.set("inventoryLogs", inventoryLogs);

        showToast("Stock updated successfully!", "success");

        // Refresh the display
        applyFilters();
        updateNotificationCount();

        // Update inventory summaries when inventory changes
      if (typeof updateInventorySummaries === 'function') {
        updateInventorySummaries();
      }

        hideStockUpdateModal();
      }
    } catch (error) {
      showToast("Failed to update stock. Please try again.", "error");
      console.error("Stock update error:", error);
    } finally {
      // Reset loading state
      submitBtn.disabled = false;
      btnText.classList.remove("hidden");
      btnSpinner.classList.add("hidden");
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
          <h2>Export Inventory Report</h2>
          <button class="modal-close" id="closeExportModal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px; color: #6b7280;">Choose the export format for your inventory report:</p>
          <div style="display: flex; gap: 12px; flex-direction: column;">
            <button class="btn btn-primary" id="exportCSV" style="justify-content: flex-start;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Export as CSV (Excel Compatible)
            </button>
            <button class="btn btn-secondary" id="exportPDF" style="justify-content: flex-start;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="10,9 9,9 8,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Export as PDF (Formatted Report)
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#closeExportModal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('#exportCSV').addEventListener('click', () => {
      document.body.removeChild(modal);
      exportToCSV();
    });

    modal.querySelector('#exportPDF').addEventListener('click', () => {
      document.body.removeChild(modal);
      exportToPDF();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  function exportToCSV() {
    const exportData = filteredInventory.map((item) => {
      const status = getItemStatus(item);
      return {
        "Item Name": item.name,
        "Category": item.category,
        "Current Stock": item.quantity,
        "Minimum Required": item.min_quantity,
        "Unit": item.unit,
        "Status": status.text,
        "Description": item.description || "N/A",
        "Last Updated": new Date(item.lastUpdated || Date.now()).toLocaleDateString()
      };
    });

    if (exportData.length === 0) {
      showToast("No data to export", "warning");
      return;
    }

    // Create CSV with BOM for proper Excel display
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => {
          const value = row[header];
          // Properly escape CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Add BOM for proper Excel UTF-8 support
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast("CSV report exported successfully!", "success");
  }

  function exportToPDF() {
    try {
      // Create a simple PDF using basic HTML canvas/print
      const printWindow = window.open('', '_blank');
      const exportData = filteredInventory.map((item) => {
        const status = getItemStatus(item);
        return {
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          min_quantity: item.min_quantity,
          unit: item.unit,
          status: status.text,
          description: item.description || "N/A"
        };
      });

      if (exportData.length === 0) {
        showToast("No data to export", "warning");
        printWindow.close();
        return;
      }

      const currentDate = new Date().toLocaleDateString();
      const totalItems = exportData.length;
      const lowStockItems = exportData.filter(item => item.status === 'Low Stock').length;
      const outOfStockItems = exportData.filter(item => item.status === 'Out of Stock').length;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Inventory Report - ${currentDate}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              color: #333;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2563eb;
              margin: 0 0 10px 0;
              font-size: 28px;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .summary {
              display: flex;
              justify-content: space-around;
              background: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
              border: 1px solid #e2e8f0;
            }
            .summary-item {
              text-align: center;
            }
            .summary-item .number {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              display: block;
            }
            .summary-item .label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f8fafc;
              font-weight: 600;
              color: #374151;
            }
            .status-ok { color: #10b981; font-weight: 500; }
            .status-low { color: #f59e0b; font-weight: 500; }
            .status-out { color: #ef4444; font-weight: 500; }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #9ca3af;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
            @media print {
              body { margin: 20px; }
              .summary { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 Inventory Report</h1>
            <p><strong>Generated on:</strong> ${currentDate}</p>
            <p><strong>Report Type:</strong> Complete Inventory Overview</p>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span class="number">${totalItems}</span>
              <span class="label">Total Items</span>
            </div>
            <div class="summary-item">
              <span class="number" style="color: #f59e0b;">${lowStockItems}</span>
              <span class="label">Low Stock</span>
            </div>
            <div class="summary-item">
              <span class="number" style="color: #ef4444;">${outOfStockItems}</span>
              <span class="label">Out of Stock</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Min Required</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Product Date</th>
                <th>Description</th>

              </tr>
            </thead>
            <tbody>
              ${exportData.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.category}</td>
                  <td>${item.quantity}</td>
                  <td>${item.min_quantity}</td>
                  <td>${item.unit}</td>
                  <td class="status-${item.status === 'In Stock' ? 'ok' : item.status === 'Low Stock' ? 'low' : 'out'}">${item.status}</td>
                  <td>${item.description}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This report was generated automatically by the Ink and Arch Medical Clinic Inventory Management System.</p>
            <p>For questions or concerns, please contact the system administrator.</p>
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
      showToast("PDF report generated successfully!", "success");

    } catch (error) {
      console.error('PDF export error:', error);
      showToast("Error generating PDF report", "error");
    }
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
  window.editItem = function (id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    // Populate form with item data
    const form = document.getElementById('itemForm');
    if (form) {
      const nameEl = document.getElementById('itemName');
      const categoryEl = document.getElementById('itemCategory');
      const quantityEl = document.getElementById('itemQuantity');
      const minQtyEl = document.getElementById('itemMinQuantity');
      const unitEl = document.getElementById('itemUnit');
      const descEl = document.getElementById('itemDescription');
      const dateEl = document.getElementById('itemDate');
      const expEl = document.getElementById('expirationDate');
      const purchaseCostEl = document.getElementById('purchaseCost');
      const supplierEl = document.getElementById('supplier');
      const platformEl = document.getElementById('platform');

      if (nameEl) nameEl.value = item.name || "";
      if (categoryEl) categoryEl.value = item.category || "";
      if (quantityEl) quantityEl.value = item.quantity || 0;
      if (minQtyEl) minQtyEl.value = item.min_quantity || 0;
      if (unitEl) unitEl.value = item.unit || "";
      if (descEl) descEl.value = item.description || "";
      if (purchaseCostEl) purchaseCostEl.value = item.purchase_cost || 0;
      if (supplierEl) supplierEl.value = item.supplier || '';
      if (platformEl) platformEl.value = item.platform || '';
      if (dateEl) dateEl.value = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (expEl) expEl.value = item.expiry_date ? new Date(item.expiry_date).toISOString().slice(0, 10) : "";
    }

    // Update modal for editing
    const modal = $("#addItemModal");
    const modalTitle = modal.querySelector(".modal-header h2");
    const submitBtn = $("#saveItemBtn");
    const submitBtnText = submitBtn.querySelector(".btn-text");

    if (modalTitle) modalTitle.textContent = "Edit Item";
    if (submitBtnText) submitBtnText.textContent = "Update Item";

    // Show and render item history
    const historySection = document.getElementById('itemHistorySection');
    const historyList = document.getElementById('itemHistoryList');
    if (historySection && historyList) {
      historySection.classList.remove('hidden');
      const logs = (storage.get('inventoryLogs') || []).filter(l => String(l.itemId) === String(item.id));
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (logs.length === 0) {
        historyList.innerHTML = '<div class="empty-state"><p>No history yet for this item</p></div>';
      } else {
        const tableHTML = `
          <table class="history-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Date</th>
                <th>Qty Change</th>
                <th>Supplier</th>
                <th>Cost</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => {
                const actionLabel = log.action === 'add' ? 'Stock Added' : log.action === 'remove' ? 'Stock Removed' : log.action === 'set' ? 'Stock Set' : log.action;
                const qtyChange = (typeof log.newQuantity !== 'undefined' && typeof log.oldQuantity !== 'undefined')
                  ? `${log.oldQuantity} → ${log.newQuantity}`
                  : (typeof log.quantity !== 'undefined' ? log.quantity : '—');
                const dateReceived = log.dateReceived ? formatDate(new Date(log.dateReceived)) : '—';
                const supplier = log.supplier || '—';
                const cost = log.purchaseCost ? formatCurrency(log.purchaseCost) : '—';
                const reason = log.reason || '—';
                return `
                  <tr>
                    <td><span class="history-action-badge">${actionLabel}</span></td>
                    <td><small>${formatDateTime(log.timestamp)}</small></td>
                    <td><span class="qty-change">${qtyChange}</span></td>
                    <td>${supplier}</td>
                    <td>${cost}</td>
                    <td>${reason}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
        historyList.innerHTML = tableHTML;
      }
    }

    clearItemNameError();

    currentEditItemId = id;
    showModal("#addItemModal");
  };

  window.updateStock = function (id) {
    showStockUpdateModal(id);
  };

  window.deleteItem = function (id, name) {
    const deleteItemName = $("#deleteItemName");
    if (deleteItemName) {
      deleteItemName.textContent = name;
    }

    // Store the ID for deletion
    window.itemToDelete = id;
    showModal("#deleteModal");
  };

  window.goToPage = function (page) {
    currentPage = page;
    renderInventoryTable();
    updatePagination();
  };

  async function confirmDelete() {
    const id = window.itemToDelete;
    if (!id) return;
    try {
      // Attempt server-side deletion first
      try {
        const resp = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (!resp.ok && resp.status !== 404) {
          throw new Error('Server delete failed');
        }
      } catch (e) {
        console.warn('Inventory API delete failed or offline:', e.message);
      }
      // Update local state regardless
      inventory = inventory.filter(item => item.id !== id);
      inventoryLogs = inventoryLogs.filter(log => log.itemId !== id);
      storage.set('inventory', inventory);
      storage.set('inventoryLogs', inventoryLogs);
      applyFilters();
      updateNotificationCount();

      // Update inventory summaries when inventory changes
      if (typeof updateInventorySummaries === 'function') {
        updateInventorySummaries();
      }

      showToast('Item deleted successfully', 'success');
    } finally {
      hideDeleteModal();
      window.itemToDelete = null;
    }
  }

  function hideDeleteModal() {
    hideModal("#deleteModal");
    window.itemToDelete = null;
  }

  // ========================================
  // SALES & REVENUE TRACKING FUNCTIONS
  // ========================================

  // Load appointments for revenue calculations
  async function loadAppointmentsForRevenue() {
    try {
      // Try to get from server first if API_CONFIG is available
      if (typeof API_CONFIG !== 'undefined' && API_CONFIG.apiCall) {
        try {
          const response = await API_CONFIG.apiCall('/api/appointments');
          if (response && response.ok) {
            appointments = await response.json();
            console.log('✅ Loaded appointments from server for revenue tracking:', appointments.length);
          }
        } catch (apiError) {
          console.warn('⚠️ Server API not available, trying localStorage:', apiError.message);
          appointments = storage.get('appointments') || [];
        }
      } else {
        // Direct fallback to localStorage
        appointments = storage.get('appointments') || [];
      }
    } catch (error) {
      console.warn('⚠️ Error loading appointments for revenue tracking:', error.message);
      // Final fallback to localStorage
      appointments = storage.get('appointments') || [];
    }

    // Update inventory summaries
    updateInventorySummaries();
  }

  // Calculate total inventory value
  function calculateInventoryValue() {
    // Consistent calculation using purchase_cost
    return (inventory || []).reduce((total, item) => {
      // Normalize field names: purchase_cost is the standard
      const unitCost = parseFloat(item.purchase_cost) ||
                       parseFloat(item.unitPrice) ||
                       parseFloat(item.unit_cost) || 0;
      const quantity = parseInt(item.quantity) || 0;
      const itemValue = unitCost * quantity;
      return total + itemValue;
    }, 0);
  }

  // Calculate sales summaries from appointments
  function calculateSalesSummaries() {
    // Use records.js function if available
    if (typeof window.calculatePaidUnpaidBreakdown === 'function') {
      const allTime = { start: new Date(1970, 0, 1), end: new Date(2099, 11, 31) };
      return window.calculatePaidUnpaidBreakdown(allTime);
    }

    // Fallback calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSales = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    let appointmentCount = 0;

    (appointments || []).forEach(apt => {
      if (!apt) return;

      const amount = apt.total_after_discount || apt.amount || 0;
      totalSales += amount;
      appointmentCount++;

      if (apt.payment_status === 'full') {
        paidAmount += amount;
      } else {
        unpaidAmount += amount;
      }
    });

    return {
      totalAmount: totalSales,
      paidAmount: paidAmount,
      unpaidAmount: unpaidAmount,
      appointmentCount: appointmentCount
    };
  }

  // Update inventory summary cards
  function updateInventorySummaries() {
    try {
      const inventoryValue = calculateInventoryValue();
      const totalItemsCount = inventory.length;
      const lowStockCount = inventory.filter(item => item.quantity <= item.minQuantity && item.quantity > 0).length;
      const outOfStockCount = inventory.filter(item => item.quantity === 0).length;

      // Update DOM elements with inventory-specific metrics
      const totalItemsEl = $("#totalItems");
      const lowStockEl = $("#lowStockItems");
      const outOfStockEl = $("#outOfStockItems");
      const inventoryValueEl = $("#inventoryValueValue");

      if (totalItemsEl) {
        totalItemsEl.textContent = totalItemsCount;
      }
      if (lowStockEl) {
        lowStockEl.textContent = lowStockCount;
      }
      if (outOfStockEl) {
        outOfStockEl.textContent = outOfStockCount;
      }
      if (inventoryValueEl) {
        inventoryValueEl.textContent = formatCurrency(inventoryValue);
      }

      // Detailed logging with data source info
      const dataSource = inventory.length > 0 ? (inventory[0].purchase_cost !== undefined ? 'Database (purchase_cost)' : 'Database (other format)') : 'Empty';
      console.log('📦 Inventory summaries updated:', {
        totalItems: totalItemsCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        inventoryValue: formatCurrency(inventoryValue),
        dataSource: dataSource,
        itemCount: inventory.length
      });
    } catch (error) {
      console.error('Error updating inventory summaries:', error);
    }
  }

  // Expose function globally for use by other modules
  window.updateInventorySummaries = updateInventorySummaries;
  window.calculateInventoryValue = calculateInventoryValue;

  // ========================================
  // INVENTORY USAGE & SALES TRACKING
  // ========================================

  /**
   * Record inventory item usage during appointment treatment
   * @param {string} itemId - ID of the inventory item
   * @param {number} quantity - Quantity of item used
   * @param {string} treatment - Treatment name
   * @param {string} reason - Reason for usage (optional)
   */
  window.recordInventoryUsage = function(itemId, quantity, treatment, reason = '') {
    try {
      const item = inventory.find(i => String(i.id) === String(itemId));
      if (!item) {
        console.warn('Item not found for usage tracking:', itemId);
        return false;
      }

      const oldQuantity = item.quantity;
      const newQuantity = Math.max(0, oldQuantity - quantity);
      item.quantity = newQuantity;
      item.lastUpdated = new Date().toISOString();

      // Log the usage
      const usageLog = {
        id: Math.max(...inventoryLogs.map(l => l.id || 0), 0) + 1,
        itemId: item.id,
        itemName: item.name,
        action: 'treatment_usage',
        quantity: quantity,
        oldQuantity: oldQuantity,
        newQuantity: newQuantity,
        treatment: treatment,
        reason: reason || `Used for ${treatment} treatment`,
        timestamp: new Date().toISOString()
      };
      inventoryLogs.push(usageLog);

      // Persist changes
      storage.set('inventory', inventory);
      storage.set('inventoryLogs', inventoryLogs);

      // Try to update server
      try {
        fetch(`/api/inventory/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            min_quantity: item.min_quantity || 0,
            unit: item.unit,
            description: item.description || '',
            expiry_date: item.expiry_date || null,
            supplier: item.supplier || '',
            platform: item.platform || '',
            purchase_cost: item.purchase_cost || 0,
            date_received: item.date_received || null
          })
        }).catch(() => {
          console.warn('Could not update server inventory for usage tracking');
        });
      } catch (_) {}

      console.log(`✅ Recorded usage: ${quantity} units of ${item.name} for ${treatment}`);
      return true;
    } catch (error) {
      console.error('Error recording inventory usage:', error);
      return false;
    }
  };

  /**
   * Get inventory items low on stock for alerts
   * @returns {Array} Array of low stock items
   */
  window.getLowStockItems = function() {
    return inventory.filter(item => {
      const status = getItemStatus(item);
      return status.class === 'low-stock' || status.class === 'out-of-stock';
    });
  };

  /**
   * Get inventory items near expiry
   * @returns {Array} Array of items near expiry
   */
  window.getNearExpiryItems = function() {
    return inventory.filter(item => {
      const status = getItemStatus(item);
      return status.class === 'expired' || status.class === 'near-expiry';
    });
  };

  /**
   * Get total inventory cost/value
   * @returns {number} Total value of all inventory items
   */
  window.getTotalInventoryValue = calculateInventoryValue;

  /**
   * Update multiple inventory items at once (for bulk sales/usage)
   * @param {Array} updates - Array of {itemId, quantity, action} objects
   * @param {string} reason - Reason for bulk update
   */
  window.bulkUpdateInventory = function(updates, reason = '') {
    try {
      let successCount = 0;
      const bulkLogs = [];

      updates.forEach(update => {
        const item = inventory.find(i => String(i.id) === String(update.itemId));
        if (!item) return;

        const oldQuantity = item.quantity;
        let newQuantity = oldQuantity;

        switch(update.action) {
          case 'add':
            newQuantity = oldQuantity + (update.quantity || 0);
            break;
          case 'remove':
            newQuantity = Math.max(0, oldQuantity - (update.quantity || 0));
            break;
          case 'set':
            newQuantity = update.quantity || 0;
            break;
        }

        if (newQuantity !== oldQuantity) {
          item.quantity = newQuantity;
          item.lastUpdated = new Date().toISOString();

          const logEntry = {
            id: Math.max(...inventoryLogs.map(l => l.id || 0), 0) + 1 + bulkLogs.length,
            itemId: item.id,
            itemName: item.name,
            action: update.action || 'set',
            quantity: Math.abs(newQuantity - oldQuantity),
            oldQuantity: oldQuantity,
            newQuantity: newQuantity,
            reason: reason,
            timestamp: new Date().toISOString()
          };
          bulkLogs.push(logEntry);
          successCount++;
        }
      });

      if (bulkLogs.length > 0) {
        inventoryLogs.push(...bulkLogs);
        storage.set('inventory', inventory);
        storage.set('inventoryLogs', inventoryLogs);
        console.log(`✅ Bulk updated ${successCount} inventory items`);
      }

      return successCount;
    } catch (error) {
      console.error('Error in bulk inventory update:', error);
      return 0;
    }
  };

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Escape key to close modals
    if (e.key === "Escape") {
      hideAddItemModal();
      hideStockUpdateModal();
      hideAlertsModal();
      hideDeleteModal();
    }

    // Ctrl/Cmd + N to add new item
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      showAddItemModal();
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
});

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
