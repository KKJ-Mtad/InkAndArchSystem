// Utility functions for the time tracking application

// DOM manipulation utilities
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Event handling utilities
const on = (element, event, handler) => {
  if (typeof element === "string") {
    element = $(element);
  }
  if (element) {
    element.addEventListener(event, handler);
  }
};

// Generate initials-based avatar
function generateInitialsAvatar(firstName, lastName) {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();

  // Generate a color based on the initials for consistency
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];

  const colorIndex = initials.charCodeAt(0) % colors.length;
  const backgroundColor = colors[colorIndex];

  // Create SVG avatar
  const svg = `
    <svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
      <circle cx="75" cy="75" r="75" fill="${backgroundColor}"/>
      <text x="75" y="85" font-family="Arial, sans-serif" font-size="48" font-weight="bold"
            text-anchor="middle" fill="white">${initials}</text>
    </svg>
  `;

  // Convert SVG to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Generate initials avatar URL for user creation
function createUserAvatar(firstName, lastName) {
  if (!firstName && !lastName) {
    return generateInitialsAvatar('U', 'N'); // Unknown user
  }
  return generateInitialsAvatar(firstName, lastName);
}

// Local storage utilities
const storage = {
  get: (key) => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return localStorage.getItem(key);
    }
  },
  set: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove: (key) => {
    localStorage.removeItem(key);
  },
  clear: () => {
    localStorage.clear();
  },
};

// Clear all browser cache and storage
function clearBrowserCache() {
  try {
    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear cookies
    document.cookie.split(";").forEach(function (c) {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // Clear IndexedDB databases
    if (window.indexedDB) {
      indexedDB.databases().then(dbs => {
        dbs.forEach(db => {
          indexedDB.deleteDatabase(db.name);
        });
      }).catch(err => {
        console.warn("Could not clear IndexedDB:", err);
      });
    }

    console.log("✅ Browser cache cleared successfully");
    showToast("Browser cache cleared. Page will reload...", "success");

    // Reload page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);

    return true;
  } catch (error) {
    console.error("Error clearing cache:", error);
    showToast("Error clearing cache. Please try again.", "error");
    return false;
  }
}

// Date formatting utilities
const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Currency formatting utilities
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(amount);
};

// Mobile number formatting utilities
const formatMobileNumber = (number) => {
  // Remove all non-digits
  const cleaned = number.replace(/\D/g, '');

  // If it starts with 63, format as +63
  if (cleaned.startsWith('63')) {
    return `+${cleaned}`;
  }

  // If it starts with 09, replace with +639
  if (cleaned.startsWith('09')) {
    return `+63${cleaned.substring(1)}`;
  }

  // If it's just 9 digits starting with 9, add +63
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    return `+63${cleaned}`;
  }

  // Default: add +63 prefix
  return `+63${cleaned}`;
};

const validatePhilippineMobile = (number) => {
  const cleaned = number.replace(/\D/g, '');

  // Should be +63 followed by 10 digits (starting with 9)
  const pattern = /^63[9][0-9]{9}$/;
  return pattern.test(cleaned);
};

const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (date) => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

// Navigation utilities
const navigate = (page) => {
  window.location.href = page;
};

// Modal utilities
const showModal = (modalId) => {
  const modal = $(modalId);
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
};

const hideModal = (modalId) => {
  const modal = $(modalId);
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
};

// Form validation utilities
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validateRequired = (value) => {
  return value && value.trim().length > 0;
};

// Toast notification utility (stacked, min 5s duration)
const showToast = (message, type = "info") => {
  // Ensure container exists
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Add toast styles if not already present
  if (!$("#toast-styles")) {
    const styles = document.createElement("style");
    styles.id = "toast-styles";
    styles.textContent = `
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 1000;
        max-width: 90vw;
      }
      .toast {
        background: var(--gray-900);
        color: #fff;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        min-width: 300px;
        animation: slideIn 0.3s ease;
      }
      .toast-info { background-color: var(--primary-blue); }
      .toast-success { background-color: var(--green-500); }
      .toast-warning { background-color: var(--yellow-500); }
      .toast-error { background-color: var(--red-500); }
      .toast-content { display: flex; justify-content: space-between; align-items: center; }
      .toast-close { background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: 12px; }
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
    document.head.appendChild(styles);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    </div>
  `;

  container.appendChild(toast);

  // Trigger visibility transition if theme styles expect .show
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  const closeBtn = toast.querySelector(".toast-close");
  const removeToast = () => {
    if (toast.parentNode) {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }
  };
  closeBtn.addEventListener("click", removeToast);

  // Auto-close: errors 10s, others 5s (minimum)
  const duration = type === 'error' ? 10000 : 5000;
  setTimeout(removeToast, duration);
};

// Mobile sidebar toggle
const toggleSidebar = () => {
  const sidebar = $(".sidebar");
  if (sidebar) {
    sidebar.classList.toggle("open");
  }
};

// Loading spinner utility
const showLoading = (element) => {
  if (typeof element === "string") {
    element = $(element);
  }
  if (element) {
    element.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading...</span>
      </div>
    `;

    // Add spinner styles if not already present
    if (!$("#spinner-styles")) {
      const styles = document.createElement("style");
      styles.id = "spinner-styles";
      styles.textContent = `
        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 40px;
        }
        
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid var(--gray-200);
          border-top: 3px solid var(--primary-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styles);
    }
  }
};

// Shared API functions for the application
const sharedAPI = {
  // Patient management
  getPatients: () => {
    return storage.get("patients") || [];
  },

  addPatient: (patient) => {
    const patients = sharedAPI.getPatients();
    const newPatient = {
      id: Math.max(...patients.map(p => p.id), 0) + 1,
      ...patient,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    patients.push(newPatient);
    storage.set("patients", patients);
    return newPatient;
  },

  updatePatient: (id, updates) => {
    const patients = sharedAPI.getPatients();
    const index = patients.findIndex(p => p.id === id);
    if (index !== -1) {
      patients[index] = { ...patients[index], ...updates };
      storage.set("patients", patients);
      return patients[index];
    }
    return null;
  },

  deletePatient: (id) => {
    const patients = sharedAPI.getPatients();
    const filtered = patients.filter(p => p.id !== id);
    storage.set("patients", filtered);

    // Also remove associated appointments
    const appointments = sharedAPI.getAppointments();
    const filteredAppointments = appointments.filter(app => app.patientId !== id);
    storage.set("appointments", filteredAppointments);

    return true;
  },

  // Appointment management
  getAppointments: () => {
    return storage.get("appointments") || [];
  },

  addAppointment: (appointment) => {
    const appointments = sharedAPI.getAppointments();
    const newAppointment = {
      id: Math.max(...appointments.map(a => a.id), 0) + 1,
      ...appointment,
      createdAt: new Date().toISOString(),
    };
    appointments.push(newAppointment);
    storage.set("appointments", appointments);

    // Update inventory based on treatment
    sharedAPI.updateInventoryForTreatment(appointment.treatment);

    return newAppointment;
  },

  // Inventory management
  getInventory: () => {
    return storage.get("inventory") || [];
  },

  addInventoryItem: (item) => {
    const inventory = sharedAPI.getInventory();
    const newItem = {
      id: Math.max(...inventory.map(i => i.id), 0) + 1,
      ...item,
      createdAt: new Date().toISOString(),
    };
    inventory.push(newItem);
    storage.set("inventory", inventory);
    return newItem;
  },

  updateInventoryItem: (id, updates) => {
    const inventory = sharedAPI.getInventory();
    const index = inventory.findIndex(i => i.id === id);
    if (index !== -1) {
      inventory[index] = { ...inventory[index], ...updates, lastUpdated: new Date().toISOString() };
      storage.set("inventory", inventory);
      return inventory[index];
    }
    return null;
  },

  updateInventoryStock: (id, action, quantity, reason = "") => {
    const inventory = sharedAPI.getInventory();
    const item = inventory.find(i => i.id === id);
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

      item.lastUpdated = new Date().toISOString();
      storage.set("inventory", inventory);

      // Log the change
      const logs = storage.get("inventoryLogs") || [];
      const logEntry = {
        id: Math.max(...logs.map(l => l.id), 0) + 1,
        itemId: item.id,
        itemName: item.name,
        action: action,
        quantity: quantity,
        oldQuantity: oldQuantity,
        newQuantity: item.quantity,
        reason: reason,
        timestamp: new Date().toISOString(),
      };
      logs.push(logEntry);
      storage.set("inventoryLogs", logs);

      return item;
    }
    return null;
  },

  updateInventoryForTreatment: (treatment) => {
    // Define items used for each treatment
    const treatmentItems = {
      "Consultation": [
        { name: "Disposable Gloves", quantity: 2 },
        { name: "Alcohol Wipes", quantity: 3 }
      ],
      "Botox": [
        { name: "Botox Vials", quantity: 1 },
        { name: "Syringes", quantity: 2 },
        { name: "Disposable Gloves", quantity: 2 },
        { name: "Alcohol Wipes", quantity: 5 }
      ],
      "Dermal Fillers": [
        { name: "Dermal Filler Syringes", quantity: 1 },
        { name: "Needles", quantity: 2 },
        { name: "Disposable Gloves", quantity: 2 },
        { name: "Topical Anesthetic", quantity: 1 }
      ],
      "Chemical Peel": [
        { name: "Chemical Peel Solution", quantity: 1 },
        { name: "Neutralizer", quantity: 1 },
        { name: "Cotton Pads", quantity: 10 },
        { name: "Disposable Gloves", quantity: 2 }
      ],
      "Laser Treatment": [
        { name: "Laser Tips", quantity: 1 },
        { name: "Cooling Gel", quantity: 1 },
        { name: "Protective Eyewear", quantity: 2 }
      ],
      "HydraFacial": [
        { name: "HydraFacial Tips", quantity: 3 },
        { name: "Serums", quantity: 2 },
        { name: "Cleansing Solution", quantity: 1 }
      ],
      "Microneedling": [
        { name: "Microneedling Cartridges", quantity: 1 },
        { name: "Serum", quantity: 1 },
        { name: "Numbing Cream", quantity: 1 },
        { name: "Disposable Gloves", quantity: 2 }
      ],
      "PRP Therapy": [
        { name: "PRP Tubes", quantity: 2 },
        { name: "Syringes", quantity: 3 },
        { name: "Needles", quantity: 3 },
        { name: "Disposable Gloves", quantity: 2 }
      ],
      "Thread Lift": [
        { name: "PDO Threads", quantity: 8 },
        { name: "Cannulas", quantity: 2 },
        { name: "Local Anesthetic", quantity: 1 },
        { name: "Disposable Gloves", quantity: 2 }
      ],
      "IPL Photofacial": [
        { name: "IPL Gel", quantity: 1 },
        { name: "Protective Eyewear", quantity: 2 },
        { name: "Cooling Pads", quantity: 4 }
      ],
      "Acne Treatment": [
        { name: "Acne Medication", quantity: 1 },
        { name: "Cotton Pads", quantity: 8 },
        { name: "Disposable Gloves", quantity: 2 }
      ],
      "Skin Assessment": [
        { name: "Disposable Gloves", quantity: 2 },
        { name: "Alcohol Wipes", quantity: 2 },
        { name: "Documentation Forms", quantity: 1 }
      ]
    };

    const itemsUsed = treatmentItems[treatment];
    if (!itemsUsed) return;

    const inventory = sharedAPI.getInventory();
    const logs = storage.get("inventoryLogs") || [];

    itemsUsed.forEach(usedItem => {
      let inventoryItem = inventory.find(item => item.name === usedItem.name);

      if (!inventoryItem) {
        // Create new inventory item with a reasonable starting quantity
        inventoryItem = {
          id: Math.max(...inventory.map(i => i.id), 0) + 1,
          name: usedItem.name,
          quantity: 100, // Starting quantity
          minQuantity: 10,
          category: "Supplies",
          unit: "pcs",
          createdAt: new Date().toISOString()
        };
        inventory.push(inventoryItem);
      }

      // Decrement quantity
      const oldQuantity = inventoryItem.quantity;
      inventoryItem.quantity = Math.max(0, inventoryItem.quantity - usedItem.quantity);
      inventoryItem.lastUpdated = new Date().toISOString();

      // Log the usage
      const logEntry = {
        id: Math.max(...logs.map(l => l.id), 0) + 1,
        action: "treatment_usage",
        treatment: treatment,
        itemId: inventoryItem.id,
        itemName: inventoryItem.name,
        quantity: usedItem.quantity,
        oldQuantity: oldQuantity,
        newQuantity: inventoryItem.quantity,
        timestamp: new Date().toISOString()
      };
      logs.push(logEntry);
    });

    storage.set("inventory", inventory);
    storage.set("inventoryLogs", logs);
  },

  // Analytics functions
  getPatientAnalytics: (dateRange = null) => {
    const appointments = sharedAPI.getAppointments();
    const patients = sharedAPI.getPatients();

    let filteredAppointments = appointments;
    if (dateRange) {
      filteredAppointments = appointments.filter(app => {
        const appDate = new Date(app.date);
        return appDate >= dateRange.start && appDate <= dateRange.end;
      });
    }

    const uniquePatients = new Set(filteredAppointments.map(app => app.patientId)).size;
    const totalRevenue = filteredAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);
    const totalAppointments = filteredAppointments.length;

    return {
      totalPatients: patients.length,
      uniquePatientsInPeriod: uniquePatients,
      totalRevenue,
      totalAppointments,
      averagePerPatient: uniquePatients > 0 ? totalRevenue / uniquePatients : 0
    };
  },

  getTreatmentAnalytics: (dateRange = null) => {
    const appointments = sharedAPI.getAppointments();

    let filteredAppointments = appointments;
    if (dateRange) {
      filteredAppointments = appointments.filter(app => {
        const appDate = new Date(app.date);
        return appDate >= dateRange.start && appDate <= dateRange.end;
      });
    }

    const treatmentCounts = {};
    const treatmentRevenue = {};

    filteredAppointments.forEach(app => {
      if (app.treatment) {
        treatmentCounts[app.treatment] = (treatmentCounts[app.treatment] || 0) + 1;
        treatmentRevenue[app.treatment] = (treatmentRevenue[app.treatment] || 0) + (app.amount || 0);
      }
    });

    return {
      counts: treatmentCounts,
      revenue: treatmentRevenue,
      popular: Object.entries(treatmentCounts).sort((a, b) => b[1] - a[1])
    };
  },

  getInventoryAlerts: () => {
    const inventory = sharedAPI.getInventory();
    const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity && item.quantity > 0);
    const outOfStockItems = inventory.filter(item => item.quantity === 0);

    return {
      lowStock: lowStockItems,
      outOfStock: outOfStockItems,
      total: lowStockItems.length + outOfStockItems.length
    };
  }
};


// Export for ES6 modules (if needed)
// Global error handler for unhandled script errors
window.addEventListener('error', function (event) {
  console.error('Global script error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });

  // Don't show toast for every error as it can be annoying
  // Only log to console for debugging
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
  console.error('Unhandled promise rejection:', event.reason);

  // Prevent the default browser behavior
  event.preventDefault();
});

// Function to prevent back button access after logout
const preventBackAfterLogout = () => {
  // Push a new history state to prevent back navigation
  window.history.pushState({ isLoggedOut: true }, null, window.location.href);

  // Add event listener for back button and popstate
  window.addEventListener('popstate', function (event) {
    const token = storage.get("authToken");

    // If user is logged out, redirect to login and prevent going back
    if (!token) {
      // Clear the current history to prevent back navigation
      window.location.href = 'login.html';
    }
  });

  // Add handler for browser cache restoration (bfcache)
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      const token = storage.get("authToken");
      if (!token) {
        // User was logged out and browser restored page from cache
        window.location.href = 'login.html';
      }
    }
  });

  // Add beforeunload handler to clear session
  window.addEventListener('beforeunload', function () {
    const token = storage.get("authToken");
    if (!token) {
      // Session was cleared, set a flag to prevent back navigation
      sessionStorage.setItem('logoutInProgress', 'true');
    }
  });
};

// Function to check authentication and prevent access without token
const checkAuthAndPreventBackAccess = () => {
  const token = storage.get("authToken");
  if (!token) {
    navigate("login.html");
    return false;
  }

  // Add handler for back button press and bfcache restoration
  window.addEventListener('pageshow', function (event) {
    // Check if page was loaded from browser cache (bfcache)
    if (event.persisted) {
      const currentToken = storage.get("authToken");
      if (!currentToken) {
        // User was logged out, redirect to login
        window.location.href = 'login.html';
      }
    }
  });

  // Add popstate handler for back button navigation
  window.addEventListener('popstate', function (event) {
    const currentToken = storage.get("authToken");
    if (!currentToken) {
      // User pressed back but is logged out
      window.location.href = 'login.html';
    }
  });

  return true;
};

// Register service worker for offline usage
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js').then(function (reg) {
      console.log('ServiceWorker registered with scope:', reg.scope);
    }).catch(function (err) {
      console.warn('ServiceWorker registration failed:', err);
    });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    $,
    $$,
    on,
    storage,
    formatDate,
    formatTime,
    formatDateTime,
    formatCurrency,
    formatMobileNumber,
    validatePhilippineMobile,
    navigate,
    showModal,
    hideModal,
    validateEmail,
    validateRequired,
    showToast,
    toggleSidebar,
    showLoading,
    sharedAPI,
  };
}
