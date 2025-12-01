// Patients page functionality

// Add global error handler to prevent [object Object] errors
window.addEventListener('error', function (event) {
  const errorMessage = event.error && event.error.message ? event.error.message :
    (typeof event.error === 'string' ? event.error : 'Unknown global error');

  console.error('Global error caught:', errorMessage);
  console.error('Full error details:', event.error);
  console.error('Error location:', event.filename, 'Line:', event.lineno);

  // Prevent default error display
  event.preventDefault();

  // Show user-friendly error
  if (typeof showToast === 'function') {
    showToast('An error occurred: ' + errorMessage, 'error');
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
  const errorMessage = event.reason && event.reason.message ? event.reason.message :
    (typeof event.reason === 'string' ? event.reason : 'Unknown promise rejection');

  console.error('Unhandled promise rejection:', errorMessage);
  console.error('Full rejection details:', event.reason);

  // Prevent default error display
  event.preventDefault();

  // Show user-friendly error
  if (typeof showToast === 'function') {
    showToast('Promise error: ' + errorMessage, 'error');
  }
});

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

  // Block employees from accessing patients page
  if (currentUser.role === "employee") {
    showToast("Access denied. Employees cannot access patient management.", "error");
    setTimeout(() => navigate("dashboard.html"), 2000);
    return;
  }

  // State management
  let patients = [];
  let filteredPatients = [];
  let appointments = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let currentEditPatientId = null;
  let currentViewPatientId = null;
  let appointmentIdBeingEdited = null;
  let treatmentsCatalog = [];
  let selectedItemsPatient = [];
  let tempNewPatientConsents = [];
  let editingConsentId = null;
  let appointmentEditingConsentId = null;
  let globalConsentEditingId = null;

  // Initialize page with error handling
  try {
    initializePatientsPage();
    setupEventListeners();
    loadData();
  } catch (initError) {
    const errorMessage = initError && initError.message ? initError.message :
      (typeof initError === 'string' ? initError : 'Unknown initialization error');

    console.error('Error during page initialization:', errorMessage);
    console.error('Full init error object:', initError);

    if (typeof showToast === 'function') {
      showToast('Page initialization error: ' + errorMessage, 'error');
    }

    // Try to continue with basic functionality
    try {
      initializePatientsPage();
    } catch (fallbackError) {
      console.error('Fallback initialization also failed:', fallbackError);
    }
  }

  // Make functions available globally
  function initializePatientsPage() {
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

    // Initialize treatments catalog into selects
    treatmentsCatalog = loadTreatmentsCatalog();
    setTimeout(() => populateCatalogIntoSelects(), 0);
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

    // Add patient button
    const addPatientBtn = $("#addPatientBtn");
    if (addPatientBtn) {
      addPatientBtn.addEventListener("click", () => showAddPatientModal());
    }

    // Search input
    const searchInput = $("#searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", handleSearch);
    }

    // Filter selects
    const statusFilter = $("#statusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", handleFilters);
    }

    // Export button
    const exportBtn = $("#exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", handleExport);
    }

    // Manage Treatments button
    const manageTreatmentsBtn = $("#manageTreatmentsBtn");
    if (manageTreatmentsBtn) {
      manageTreatmentsBtn.addEventListener("click", () => {
        treatmentsCatalog = loadTreatmentsCatalog();
        renderTreatmentsList();
        showModal("#manageTreatmentsModal");
      });
    }

    // Manage Treatments modal handlers
    const closeManageTreatmentsBtn = $("#closeManageTreatmentsBtn");
    const manageTreatmentsModal = $("#manageTreatmentsModal");
    const addTreatmentBtn = $("#addTreatmentBtn");
    const newTreatmentName = $("#newTreatmentName");
    const newTreatmentPrice = $("#newTreatmentPrice");

    if (closeManageTreatmentsBtn) {
      closeManageTreatmentsBtn.addEventListener("click", () => hideModal("#manageTreatmentsModal"));
    }
    if (manageTreatmentsModal) {
      manageTreatmentsModal.addEventListener("click", function (e) {
        if (e.target === manageTreatmentsModal) hideModal("#manageTreatmentsModal");
      });
    }
    if (addTreatmentBtn) {
      addTreatmentBtn.addEventListener("click", () => {
        const name = (newTreatmentName?.value || "").trim();
        const price = parseFloat(newTreatmentPrice?.value) || 0;
        if (!name) { showToast("Enter treatment name", "warning"); return; }
        const idx = (treatmentsCatalog || []).findIndex(t => t.name.toLowerCase() === name.toLowerCase());
        if (idx !== -1) {
          treatmentsCatalog[idx].price = price;
        } else {
          treatmentsCatalog.push({ id: Date.now(), name, price });
        }
        saveTreatmentsCatalog();
        renderTreatmentsList();
        populateCatalogIntoSelects();
        if (newTreatmentName) newTreatmentName.value = "";
        if (newTreatmentPrice) newTreatmentPrice.value = "";
        showToast("Treatment saved", "success");
      });
    }

    // Modal close buttons and form submissions
    setupModalEventListeners();

    // Manage Consents modal wiring
    const manageConsentsBtn = document.getElementById('manageConsentsBtn');
    const closeManageConsentsBtn = document.getElementById('closeManageConsentsBtn');
    const addConsentGlobalBtn = document.getElementById('addConsentGlobalBtn');
    const updateConsentGlobalBtn = document.getElementById('updateConsentGlobalBtn');
    const cancelConsentGlobalEditBtn = document.getElementById('cancelConsentGlobalEditBtn');

    if (manageConsentsBtn) manageConsentsBtn.addEventListener('click', showManageConsentsModal);
    if (closeManageConsentsBtn) closeManageConsentsBtn.addEventListener('click', hideManageConsentsModal);
    if (addConsentGlobalBtn) addConsentGlobalBtn.addEventListener('click', () => saveGlobalConsent());
    if (updateConsentGlobalBtn) updateConsentGlobalBtn.addEventListener('click', () => saveGlobalConsent(true));
    if (cancelConsentGlobalEditBtn) cancelConsentGlobalEditBtn.addEventListener('click', resetGlobalConsentEditor);

    // Click outside to close Manage Consents Modal
    const manageConsentsModal = $("#manageConsentsModal");
    if (manageConsentsModal) {
      manageConsentsModal.addEventListener("click", function (e) {
        if (e.target === manageConsentsModal) hideManageConsentsModal();
      });
    }

    // Manage Archives wiring
    const manageArchivesBtn = document.getElementById('manageArchivesBtn');
    const closeArchiveBtn = document.getElementById('closeArchiveBtn');
    const closeArchiveManagerBtn = document.getElementById('closeArchiveManagerBtn');
    const saveArchiveSettingsBtn = document.getElementById('saveArchiveSettingsBtn');
    const openArchiveBtn = document.getElementById('openArchiveBtn');
    const closeArchivedBrowserBtn = document.getElementById('closeArchivedBrowserBtn');
    const closeArchivedBrowserBtn2 = document.getElementById('closeArchivedBrowserBtn2');
    if (manageArchivesBtn) manageArchivesBtn.addEventListener('click', showArchiveManagerModal);
    if (closeArchiveBtn) closeArchiveBtn.addEventListener('click', () => hideModal('#archiveManagerModal'));
    if (closeArchiveManagerBtn) closeArchiveManagerBtn.addEventListener('click', () => hideModal('#archiveManagerModal'));
    if (saveArchiveSettingsBtn) saveArchiveSettingsBtn.addEventListener('click', saveArchiveSettingsFromUI);
    if (openArchiveBtn) openArchiveBtn.addEventListener('click', showArchivedPatientsBrowser);
    if (closeArchivedBrowserBtn) closeArchivedBrowserBtn.addEventListener('click', () => hideModal('#archivedPatientsBrowserModal'));
    if (closeArchivedBrowserBtn2) closeArchivedBrowserBtn2.addEventListener('click', () => hideModal('#archivedPatientsBrowserModal'));

    // Click outside to close Archive Manager Modal
    const archiveManagerModal = $("#archiveManagerModal");
    if (archiveManagerModal) {
      archiveManagerModal.addEventListener("click", function (e) {
        if (e.target === archiveManagerModal) hideModal('#archiveManagerModal');
      });
    }

    // Click outside to close Archived Patients Browser Modal
    const archivedPatientsBrowserModal = $("#archivedPatientsBrowserModal");
    if (archivedPatientsBrowserModal) {
      archivedPatientsBrowserModal.addEventListener("click", function (e) {
        if (e.target === archivedPatientsBrowserModal) hideModal('#archivedPatientsBrowserModal');
      });
    }

    // Patient Details Modal Handlers
    const closePatientDetailsBtn = document.getElementById('closePatientDetailsModalBtn');
    const closePatientDetailsBtnBottom = document.getElementById('closePatientDetailsBtn');
    const archivedPatientDetailsModal = document.getElementById('archivedPatientDetailsModal');

    if (closePatientDetailsBtn) {
      closePatientDetailsBtn.addEventListener('click', () => hideModal('#archivedPatientDetailsModal'));
    }

    if (closePatientDetailsBtnBottom) {
      closePatientDetailsBtnBottom.addEventListener('click', () => hideModal('#archivedPatientDetailsModal'));
    }

    if (archivedPatientDetailsModal) {
      archivedPatientDetailsModal.addEventListener('click', function(e) {
        if (e.target === archivedPatientDetailsModal) {
          hideModal('#archivedPatientDetailsModal');
        }
      });
    }

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

    // Set up periodic reminder checking (every 30 seconds)
    setInterval(() => {
      if (typeof checkAndSendReminders === 'function') {
        checkAndSendReminders();
      }
    }, 30000);
  }

  // Capitalize first letter of each word
  function capitalizeWords(text) {
    return text
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Remove special characters and numbers — only allow letters, spaces, and hyphens
  function sanitizeNameInput(text) {
    return text.replace(/[^a-zA-Z\s\-]/g, '');
  }

  // Setup name field validation
  function setupNameFieldValidation() {
    const nameFields = ['lastName', 'firstName', 'middleName'];
    const maxLength = 25;

    nameFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) return;

      // Handle input in real-time
      field.addEventListener('input', function (e) {
        // Remove special characters
        let value = sanitizeNameInput(this.value);

        // Limit to max characters
        if (value.length > maxLength) {
          value = value.substring(0, maxLength);
        }

        this.value = value;
      });

      // Capitalize on blur (when user leaves the field)
      field.addEventListener('blur', function (e) {
        if (this.value.trim()) {
          this.value = capitalizeWords(this.value);
        }
      });

      // Set maxlength attribute
      field.setAttribute('maxlength', maxLength);
    });
  }

  function setupFieldValidations() {
    const age = document.getElementById('age');
    if (age) age.setAttribute('max', '999');

    const city = document.getElementById('city');
    const state = document.getElementById('state');
    const zip = document.getElementById('zipCode');
    const contact = document.getElementById('contactNumber');
    const eName = document.getElementById('emergencyContactName');
    const relation = document.getElementById('emergencyRelationship');
    const eContact = document.getElementById('emergencyContactNumber');

    const onlyLetters = v => v.replace(/[^A-Za-z ]/g, '');
    const onlyDigits = (v, max) => v.replace(/\D/g, '').slice(0, max);

    if (city) {
      city.addEventListener('input', function () {
        this.value = onlyLetters(this.value).slice(0, 25);
      });
      city.setAttribute('maxlength', '25');
    }
    if (state) {
      state.addEventListener('input', function () {
        this.value = onlyLetters(this.value).slice(0, 25);
      });
      state.setAttribute('maxlength', '25');
    }
    if (zip) {
      zip.addEventListener('input', function () {
        this.value = onlyDigits(this.value, 4);
      });
      zip.setAttribute('maxlength', '4');
    }
    if (contact) {
      contact.addEventListener('input', function () {
        this.value = onlyDigits(this.value, 11);
      });
      contact.setAttribute('maxlength', '11');
    }
    if (eName) {
      eName.addEventListener('input', function () {
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const cleaned = onlyLetters(this.value).replace(/\s+/g, ' ');
        const titled = cleaned.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
        this.value = titled;
        if (typeof start === 'number' && typeof end === 'number') {
          this.setSelectionRange(start, end);
        }
      });
    }
    if (relation) {
      relation.addEventListener('input', function () {
        this.value = onlyLetters(this.value).slice(0, 15);
      });
      relation.setAttribute('maxlength', '15');
    }
    if (eContact) {
      eContact.addEventListener('input', function () {
        this.value = onlyDigits(this.value, 11);
      });
      eContact.setAttribute('maxlength', '11');
    }
  }

  // Setup multiple phone numbers functionality
  function setupMultiplePhoneNumbers() {
    const addPhoneBtn = document.getElementById('addPhoneBtn');
    const phoneContainer = document.getElementById('phoneNumbersContainer');

    if (addPhoneBtn && phoneContainer) {
      addPhoneBtn.addEventListener('click', function (e) {
        e.preventDefault();
        addPhoneNumberField('phoneNumbersContainer', 'phone-number-field');
      });
    }

    const addEmergencyPhoneBtn = document.getElementById('addEmergencyPhoneBtn');
    const emergencyPhoneContainer = document.getElementById('emergencyPhoneNumbersContainer');

    if (addEmergencyPhoneBtn && emergencyPhoneContainer) {
      addEmergencyPhoneBtn.addEventListener('click', function (e) {
        e.preventDefault();
        addPhoneNumberField('emergencyPhoneNumbersContainer', 'emergency-phone-field');
      });
    }

    // Setup formatting for existing phone number fields
    const phoneInputs = document.querySelectorAll('.phone-number-field, .emergency-phone-field');
    phoneInputs.forEach(input => {
      input.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 11);
      });
    });

    // Setup remove buttons for existing phone number fields
    updatePhoneNumberRemoveButtons('phoneNumbersContainer', 'phone-number-field');
    updatePhoneNumberRemoveButtons('emergencyPhoneNumbersContainer', 'emergency-phone-field');
  }

  function addPhoneNumberField(containerId, fieldClassName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const newField = document.createElement('div');
    newField.className = 'phone-number-input-group';
    newField.innerHTML = `
      <input type="tel" class="form-input phone-input ${fieldClassName}" maxlength="11" pattern="^\\d{11}$" placeholder="Enter phone number" />
      <button type="button" class="btn btn-secondary remove-phone-btn">Remove</button>
    `;

    container.appendChild(newField);

    const removeBtn = newField.querySelector('.remove-phone-btn');
    removeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      newField.remove();
      updatePhoneNumberRemoveButtons(containerId, fieldClassName);
    });

    // Add input formatting
    const phoneInput = newField.querySelector('.phone-input');
    phoneInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 11);
    });

    updatePhoneNumberRemoveButtons(containerId, fieldClassName);
  }

  function updatePhoneNumberRemoveButtons(containerId, fieldClassName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const fields = container.querySelectorAll(`.${fieldClassName}`);
    const removeButtons = container.querySelectorAll('.remove-phone-btn');

    // Show remove button only if there's more than one field
    removeButtons.forEach(btn => {
      btn.style.display = fields.length > 1 ? 'block' : 'none';
    });

    // Add event listeners to remove buttons
    removeButtons.forEach(btn => {
      if (!btn.hasListener) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          this.closest('.phone-number-input-group').remove();
          updatePhoneNumberRemoveButtons(containerId, fieldClassName);
        });
        btn.hasListener = true;
      }
    });
  }

  // Progressive modal step management
  let currentStep = 1;
  const totalSteps = 6;

  function setupProgressiveModal() {
    updateProgressiveModalDisplay();
    setupStepIndicatorListeners();
  }

  function goToStep(step) {
    if (step < 1 || step > totalSteps) return;

    // Validate current step before moving to next
    if (step > currentStep) {
      if (!validateCurrentStep()) {
        showToast('Please complete all required fields in this section', 'warning');
        return;
      }
    }

    currentStep = step;
    updateProgressiveModalDisplay();
  }

  function nextStep() {
    if (currentStep < totalSteps) {
      goToStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  }

  function validateCurrentStep() {
    switch (currentStep) {
      case 1: // Guest Information
        return validateGuestInfo();
      case 2: // Personal Details
        return validatePersonalDetails();
      case 3: // Medical History
        return true; // Optional section
      case 4: // Skin Care Routine
        return true; // Optional section
      case 5: // Consent Forms
        return true; // Optional section
      case 6: // Treatment & Payment
        return validateTreatmentPayment();
      default:
        return true;
    }
  }

  function validateGuestInfo() {
    const title = document.getElementById('title');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');

    return title && title.value && firstName && firstName.value && lastName && lastName.value;
  }

  function validatePersonalDetails() {
    const address = document.getElementById('address');
    const city = document.getElementById('city');
    const state = document.getElementById('state');
    const zipCode = document.getElementById('zipCode');
    const dateOfBirth = document.getElementById('dateOfBirth');
    const age = document.getElementById('age');
    const gender = document.getElementById('gender');
    const emergencyContactName = document.getElementById('emergencyContactName');
    const emergencyRelationship = document.getElementById('emergencyRelationship');

    const phoneInputs = document.querySelectorAll('#phoneNumbersContainer .phone-number-field');
    const hasValidPhone = Array.from(phoneInputs).some(input => input.value && input.value.match(/^\d{11}$/));

    return address && address.value && city && city.value && state && state.value &&
      zipCode && zipCode.value && dateOfBirth && dateOfBirth.value && age && age.value &&
      gender && gender.value && emergencyContactName && emergencyContactName.value &&
      emergencyRelationship && emergencyRelationship.value && hasValidPhone;
  }

  function validateTreatmentPayment() {
    const isEdit = !!currentEditPatientId;
    if (isEdit) return true; // Don't validate treatment/payment when editing

    const staffEmployee = document.getElementById('staffEmployee');
    const treatmentDate = document.getElementById('treatmentDate');
    const totalSales = document.getElementById('totalSales');

    return staffEmployee && staffEmployee.value && treatmentDate && treatmentDate.value &&
      totalSales && totalSales.value;
  }

  function updateProgressiveModalDisplay() {
    // Hide all form sections
    const formSections = document.querySelectorAll('form.patient-form .form-section');
    formSections.forEach((section) => {
      section.style.display = 'none';
    });

    // Show sections based on current step
    const sectionsToShow = {
      1: ['Guest Information'],
      2: ['Personal Details', 'Emergency Contact'],
      3: ['Medical History'],
      4: ['Skin Care Routine'],
      5: ['Consent Forms'],
      6: ['Treatment & Payment Information']
    };

    const targetSections = sectionsToShow[currentStep] || [];
    formSections.forEach(section => {
      const h4 = section.querySelector('h4.section-title');
      if (h4) {
        // Get only the direct text content, excluding child elements
        const sectionTitle = Array.from(h4.childNodes)
          .filter(node => node.nodeType === 3) // Text nodes only
          .map(node => node.textContent)
          .join('')
          .trim();
        targetSections.forEach(title => {
          if (sectionTitle === title) {
            section.style.display = 'block';
          }
        });
      }
    });

    // Also show the header for the first step
    const header = document.querySelector('form.patient-form .form-section-header');
    if (header) {
      header.style.display = currentStep === 1 ? 'block' : 'none';
    }

    // Update step indicators
    updateStepIndicators();

    // Update navigation buttons visibility
    updateNavigationButtons();
  }

  function updateStepIndicators() {
    const indicators = document.querySelectorAll('.step-indicator');
    indicators.forEach((indicator, index) => {
      const step = index + 1;
      indicator.classList.remove('active', 'completed');

      if (step < currentStep) {
        indicator.classList.add('completed');
      } else if (step === currentStep) {
        indicator.classList.add('active');
      }
    });

    // Update progress bar
    const progressFill = document.querySelector('.step-progress-fill');
    if (progressFill) {
      const percentage = (currentStep / totalSteps) * 100;
      progressFill.style.width = percentage + '%';
    }
  }

  function updateNavigationButtons() {
    const prevBtn = document.querySelector('.prev-step-btn');
    const nextBtn = document.querySelector('.next-step-btn');
    const submitBtn = document.querySelector('#savePatientBtn');

    if (prevBtn) {
      prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
    }

    if (nextBtn) {
      nextBtn.style.display = currentStep < totalSteps ? 'block' : 'none';
    }

    if (submitBtn) {
      submitBtn.style.display = currentStep === totalSteps ? 'block' : 'none';
    }
  }

  function setupStepIndicatorListeners() {
    const indicators = document.querySelectorAll('.step-indicator');
    indicators.forEach(indicator => {
      indicator.addEventListener('click', function () {
        const step = parseInt(this.getAttribute('data-step'));
        goToStep(step);
      });
    });
  }

  function setupModalEventListeners() {
    // Patient modal
    const closeModalBtn = $("#closeModalBtn");
    const cancelBtn = $("#cancelBtn");
    const addPatientModal = $("#addPatientModal");
    const patientForm = $("#patientForm");
    const prevStepBtn = $("#prevStepBtn");
    const nextStepBtn = $("#nextStepBtn");

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", hideAddPatientModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", hideAddPatientModal);
    }
    if (addPatientModal) {
      addPatientModal.addEventListener("click", function (e) {
        if (e.target === addPatientModal) {
          hideAddPatientModal();
        }
      });
    }
    if (prevStepBtn) {
      prevStepBtn.addEventListener("click", function (e) {
        e.preventDefault();
        prevStep();
      });
    }
    if (nextStepBtn) {
      nextStepBtn.addEventListener("click", function (e) {
        e.preventDefault();
        nextStep();
      });
    }
    if (patientForm) {
      patientForm.addEventListener("submit", handlePatientFormSubmit);
      // Setup name field validation
      setupNameFieldValidation();
      setupFieldValidations();
    }

    // Age calculation from date of birth and vice versa
    const dateOfBirth = $("#dateOfBirth");
    const ageInput = $("#age");

    function calculateAgeFromDOB(dob) {
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return Math.min(999, Math.max(0, age));
    }

    function calculateDOBFromAge(age) {
      const today = new Date();
      const birthYear = today.getFullYear() - age;
      const birthMonth = String(today.getMonth() + 1).padStart(2, '0');
      const birthDay = String(today.getDate()).padStart(2, '0');
      return `${birthYear}-${birthMonth}-${birthDay}`;
    }

    if (dateOfBirth && ageInput) {
      dateOfBirth.addEventListener("change", function () {
        if (this.value) {
          ageInput.value = calculateAgeFromDOB(this.value);
        } else {
          ageInput.value = "";
        }
      });

      ageInput.addEventListener("change", function () {
        if (this.value) {
          const age = parseInt(this.value);
          if (!isNaN(age) && age >= 0 && age <= 999) {
            dateOfBirth.value = calculateDOBFromAge(age);
          }
        } else {
          dateOfBirth.value = "";
        }
      });

      // Allow only numbers in age field
      ageInput.addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value && parseInt(this.value) > 999) {
          this.value = '999';
        }
      });
    }

    // Gender other option handling
    const genderSelect = $("#gender");
    const otherGenderRow = $("#otherGenderRow");

    if (genderSelect && otherGenderRow) {
      genderSelect.addEventListener("change", function () {
        if (this.value === "other") {
          otherGenderRow.style.display = "block";
          $("#otherGender").required = true;
        } else {
          otherGenderRow.style.display = "none";
          $("#otherGender").required = false;
        }
      });
    }

    // Medical history conditional fields
    setupConditionalField("hasAllergies", "allergiesSpecifyRow", "allergiesSpecify");
    setupConditionalField("takingMedication", "medicationSpecifyRow", "medicationSpecify");
    setupConditionalField("hasSkinConditions", "skinConditionsSpecifyRow", "skinConditionsSpecify");
    setupConditionalField("hadSurgeries", "surgeriesSpecifyRow", "surgeriesSpecify");
    setupConditionalField("usedNewProducts", "newProductsSpecifyRow", "newProductsSpecify");
    setupConditionalField("hadAdverseReactions", "adverseReactionsSpecifyRow", "adverseReactionsSpecify");

    // Print/Export button
    const printBtn = $("#printBtn");
    if (printBtn) {
      printBtn.addEventListener("click", handlePrintExport);
    }

    // Auto-format mobile number input
    const mobileInput = $("#patientMobile");
    if (mobileInput) {
      mobileInput.addEventListener("input", function (e) {
        let value = e.target.value.replace(/\D/g, ''); // Remove non-digits

        // Ensure it starts with 9
        if (value.length > 0 && !value.startsWith('9')) {
          value = '9' + value.substring(1);
        }

        // Limit to 10 digits
        if (value.length > 10) {
          value = value.substring(0, 10);
        }

        e.target.value = value;
      });
    }

    // Initial treatment selection - show amount field when treatment is selected and auto-fill price
    const initialTreatmentSelect = $("#patientInitialTreatment");
    const amountGroup = $("#initialTreatmentAmountGroup");
    const initialDiscountTypeGroup = $("#initialDiscountTypeGroup");
    const initialDiscountGroup = $("#initialDiscountGroup");
    const initialTotalGroup = $("#initialTotalGroup");
    const initialTrackRow = $("#initialTrackCardRow");
    const initialDaysRow = $("#initialTrackCardDaysRow");
    const initialTrackCheckbox = $("#trackInitialTreatmentCard");
    if (initialTrackCheckbox && initialDaysRow) {
      initialTrackCheckbox.addEventListener('change', () => {
        initialDaysRow.style.display = initialTrackCheckbox.checked ? 'block' : 'none';
      });
    }
    if (initialTreatmentSelect) {
      initialTreatmentSelect.addEventListener("change", function () {
        const hasValue = !!this.value;
        if (initialTrackRow) initialTrackRow.style.display = hasValue ? 'block' : 'none';
        if (!hasValue && initialTrackCheckbox) initialTrackCheckbox.checked = false;
        if (initialDaysRow) initialDaysRow.style.display = (hasValue && initialTrackCheckbox && initialTrackCheckbox.checked) ? 'block' : 'none';

        // Auto-fill Total Sales and recompute Total After Discount based on treatment catalog price
        const totalSalesInput = document.getElementById('totalSales');
        if (hasValue && totalSalesInput) {
          const found = (treatmentsCatalog || []).find(t => t.name === this.value);
          if (found && typeof found.price !== 'undefined') {
            totalSalesInput.value = Number(found.price || 0);
            // Trigger input to update discounted total via existing listeners
            totalSalesInput.dispatchEvent(new Event('input'));
            const totalAfterEl = document.getElementById('paymentTotalAfterDiscount');
            if (totalAfterEl) {
              // If no discount entered, mirror base price
              const discType = (document.getElementById('paymentDiscountType') || {}).value || 'amount';
              const discVal = parseFloat((document.getElementById('paymentDiscount') || {}).value) || 0;
              const base = Number(found.price || 0);
              const deduction = discType === 'percent' ? (base * discVal / 100) : discVal;
              totalAfterEl.value = Math.max(0, base - deduction).toFixed(2);
            }
          }
        }
      });
    }

    // Payment amount validation
    const totalSalesInput = $("#totalSales");
    const downPaymentInput = $("#downPayment");
    const cashPaymentInput = $("#cashPayment");
    const bankTransferInput = $("#bankTransferEWalletCredit") || $("#bankTransferGcashCredit");

    if (totalSalesInput && downPaymentInput && cashPaymentInput && bankTransferInput) {
      function computePaymentTotalAfterDiscount() {
        const discountTypeEl = document.getElementById('paymentDiscountType');
        const discountEl = document.getElementById('paymentDiscount');
        const totalAfterEl = document.getElementById('paymentTotalAfterDiscount');
        const base = parseFloat(totalSalesInput.value) || 0;
        const dtype = discountTypeEl ? discountTypeEl.value : 'amount';
        let dval = parseFloat(discountEl && discountEl.value) || 0;

        // Validate discount is not negative
        if (dval < 0) {
          dval = 0;
          if (discountEl) discountEl.value = '0';
          showToast('Discount cannot be negative', 'warning');
        }

        // Validate discount does not exceed price
        if (dtype === 'amount' && dval > base) {
          dval = base;
          if (discountEl) discountEl.value = base.toFixed(2);
          showToast('Discount cannot exceed the treatment price', 'warning');
        } else if (dtype === 'percent' && dval > 100) {
          dval = 100;
          if (discountEl) discountEl.value = '100';
          showToast('Discount percentage cannot exceed 100%', 'warning');
        }

        const deduction = dtype === 'percent' ? (base * dval / 100) : dval;
        const totalAfter = Math.max(0, base - deduction);
        if (totalAfterEl) totalAfterEl.value = totalAfter.toFixed(2);
        return totalAfter;
      }

      function validatePaymentAmounts() {
        const effectiveTotal = computePaymentTotalAfterDiscount();
        const downPayment = parseFloat(downPaymentInput.value) || 0;
        const cashPayment = parseFloat(cashPaymentInput.value) || 0;
        const bankTransfer = parseFloat(bankTransferInput.value) || 0;

        const totalPayments = downPayment + cashPayment + bankTransfer;

        if (totalPayments > effectiveTotal) {
          showToast("Total payments cannot exceed total sales amount", "warning");
        }

        // Update payment UI to auto-fill Bank/E-wallet/Credit field if "Paid in Full" is selected
        if (typeof window.toggleAddPatientPaymentUI === 'function') {
          window.toggleAddPatientPaymentUI();
        }
      }

      [totalSalesInput, downPaymentInput, cashPaymentInput, bankTransferInput].forEach(input => {
        input.addEventListener("input", validatePaymentAmounts);
      });
      const paymentDiscountEl = document.getElementById('paymentDiscount');
      const paymentDiscountTypeEl = document.getElementById('paymentDiscountType');
      if (paymentDiscountEl) {
        paymentDiscountEl.addEventListener('input', function (e) {
          e.target.value = e.target.value.replace(/[^0-9.]/g, '');
          validatePaymentAmounts();
        });
      }
      if (paymentDiscountTypeEl) paymentDiscountTypeEl.addEventListener('change', validatePaymentAmounts);
    }

    // Radio button handlers will be set up when modal is shown

    // Helpers to toggle payment inputs visibility based on status/method
    function showHide(el, show) { if (el) el.style.display = show ? '' : 'none'; }

    function toggleAddPatientPaymentUI() {
      const status = document.querySelector('input[name="paymentStatus"]:checked')?.value || 'partial';
      const method = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash';
      const downInput = document.getElementById('downPayment');
      const cashInput = document.getElementById('cashPayment');
      const bankInput = document.getElementById('bankTransferEWalletCredit') || document.getElementById('bankTransferGcashCredit');
      const totalSalesInput = document.getElementById('totalSales');
      const downGroup = downInput?.closest('.form-group');
      const cashGroup = cashInput?.closest('.form-group');
      const bankGroup = bankInput?.closest('.form-group');
      const referenceGroup = document.getElementById('paymentReferenceGroup');
      const referenceInput = document.getElementById('paymentReference');
      const eWalletTypeRow = document.getElementById('eWalletTypeRow');
      const eWalletCustomRow = document.getElementById('eWalletCustomRow');
      const eWalletSelectedLabel = document.getElementById('eWalletSelectedLabel');
      const eWalletSelectedName = document.getElementById('eWalletSelectedName');
      const isNonCashMethod = method === 'bank_transfer' || method === 'e_wallet' || method === 'credit_card';

      // Handle E-Wallet type selector visibility
      const shouldShowEWallet = method === 'e_wallet' && (status === 'full' || status === 'partial');
      showHide(eWalletTypeRow, shouldShowEWallet);
      showHide(eWalletCustomRow, false);
      showHide(eWalletSelectedLabel, false);

      // Show custom E-wallet input when "Other" is selected, and handle reference field visibility
      const eWalletTypeRadios = document.querySelectorAll('input[name="eWalletType"]');
      eWalletTypeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
          showHide(eWalletCustomRow, this.value === 'other');

          const selectedType = this.value;
          const eWalletTypesWithRef = ['gcash', 'paymaya', 'grabpay', 'other'];
          const shouldShowRef = eWalletTypesWithRef.includes(selectedType);

          if (shouldShowRef && shouldShowEWallet) {
            showHide(eWalletSelectedLabel, true);
            const typeLabels = { gcash: 'GCash', paymaya: 'PayMaya', grabpay: 'GrabPay', other: 'Other E-Wallet' };
            if (eWalletSelectedName) eWalletSelectedName.textContent = typeLabels[selectedType] || selectedType;
            if (referenceInput) referenceInput.required = true;
          } else {
            showHide(eWalletSelectedLabel, false);
            if (referenceInput) referenceInput.required = false;
          }
        });
      });

      if (status === 'partial') {
        showHide(downGroup, true);
        showHide(cashGroup, false);
        showHide(bankGroup, false);
        if (cashInput) { cashInput.value = ''; cashInput.readOnly = false; }
        if (bankInput) { bankInput.value = ''; bankInput.readOnly = false; }
        if (downInput) downInput.disabled = false;
      } else {
        showHide(downGroup, false);
        if (downInput) { downInput.value = ''; downInput.disabled = true; }
        showHide(cashGroup, method === 'cash');
        showHide(bankGroup, isNonCashMethod);

        // Auto-fill Cash Payment field when "Paid in Full" is selected with Cash method
        if (status === 'full' && method === 'cash' && cashInput && totalSalesInput) {
          const totalAmount = parseFloat(totalSalesInput.value) || 0;
          cashInput.value = totalAmount > 0 ? totalAmount.toFixed(2) : '';
          cashInput.readOnly = true;
        }

        // Auto-fill Bank/E-wallet/Credit field when "Paid in Full" is selected
        if (status === 'full' && isNonCashMethod && bankInput && totalSalesInput) {
          const totalAmount = parseFloat(totalSalesInput.value) || 0;
          bankInput.value = totalAmount > 0 ? totalAmount.toFixed(2) : '';
          bankInput.readOnly = true;
        }

        if (method !== 'cash' && cashInput) { cashInput.value = ''; cashInput.readOnly = true; }
        if (method === 'cash' && bankInput) { bankInput.value = ''; bankInput.readOnly = true; }
      }

      // Only show reference for bank transfer or credit card (not e-wallet, which has its own logic)
      const shouldShowReference = (method === 'bank_transfer' || method === 'credit_card');
      showHide(referenceGroup, shouldShowReference);
      if (referenceInput) {
        referenceInput.required = shouldShowReference;
        if (!shouldShowReference) {
          referenceInput.value = '';
        }
      }
    }
    // Expose globally for inline/event usage
    window.toggleAddPatientPaymentUI = toggleAddPatientPaymentUI;

    function toggleAppointmentPaymentUI() {
      const status = document.querySelector('input[name="appointmentPaymentStatus"]:checked')?.value || 'partial';
      const method = document.querySelector('input[name="appointmentPaymentMethod"]:checked')?.value || 'cash';
      const downInput = document.getElementById('appointmentDownPayment');
      const cashInput = document.getElementById('appointmentCashPayment');
      const bankInput = document.getElementById('appointmentBankTransfer');
      const appointmentTotal = document.getElementById('appointmentTotal');
      const downGroup = downInput?.closest('.form-group');
      const cashGroup = cashInput?.closest('.form-group');
      const bankGroup = bankInput?.closest('.form-group');
      const referenceGroup = document.getElementById('appointmentReferenceGroup');
      const referenceInput = document.getElementById('appointmentReference');
      const appointmentEWalletTypeRow = document.getElementById('appointmentEWalletTypeRow');
      const appointmentEWalletCustomRow = document.getElementById('appointmentEWalletCustomRow');
      const appointmentEWalletSelectedLabel = document.getElementById('appointmentEWalletSelectedLabel');
      const appointmentEWalletSelectedName = document.getElementById('appointmentEWalletSelectedName');
      const isNonCashMethod = method === 'bank_transfer' || method === 'e_wallet' || method === 'credit_card';

      // Handle E-Wallet type selector visibility
      const shouldShowEWallet = method === 'e_wallet' && (status === 'full' || status === 'partial');
      showHide(appointmentEWalletTypeRow, shouldShowEWallet);
      showHide(appointmentEWalletCustomRow, false);
      showHide(appointmentEWalletSelectedLabel, false);

      // Show custom E-wallet input when "Other" is selected, and handle reference field visibility
      const appointmentEWalletTypeRadios = document.querySelectorAll('input[name="appointmentEWalletType"]');
      appointmentEWalletTypeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
          showHide(appointmentEWalletCustomRow, this.value === 'other');

          const selectedType = this.value;
          const eWalletTypesWithRef = ['gcash', 'paymaya', 'grabpay', 'other'];
          const shouldShowRef = eWalletTypesWithRef.includes(selectedType);

          if (shouldShowRef && shouldShowEWallet) {
            showHide(appointmentEWalletSelectedLabel, true);
            const typeLabels = { gcash: 'GCash', paymaya: 'PayMaya', grabpay: 'GrabPay', other: 'Other E-Wallet' };
            if (appointmentEWalletSelectedName) appointmentEWalletSelectedName.textContent = typeLabels[selectedType] || selectedType;
            if (referenceInput) referenceInput.required = true;
          } else {
            showHide(appointmentEWalletSelectedLabel, false);
            if (referenceInput) referenceInput.required = false;
          }
        });
      });

      if (status === 'partial') {
        showHide(downGroup, true);
        showHide(cashGroup, false);
        showHide(bankGroup, false);
        if (cashInput) { cashInput.value = ''; cashInput.readOnly = false; }
        if (bankInput) { bankInput.value = ''; bankInput.readOnly = false; }
        if (downInput) downInput.disabled = false;
      } else {
        showHide(downGroup, false);
        if (downInput) { downInput.value = ''; downInput.disabled = true; }
        showHide(cashGroup, method === 'cash');
        showHide(bankGroup, isNonCashMethod);

        // Auto-fill Cash Payment field when "Paid in Full" is selected with Cash method
        if (status === 'full' && method === 'cash' && cashInput && appointmentTotal) {
          const totalAmount = parseFloat(appointmentTotal.value) || 0;
          cashInput.value = totalAmount > 0 ? totalAmount.toFixed(2) : '';
          cashInput.readOnly = true;
        }

        // Auto-fill Bank/E-wallet/Credit field when "Paid in Full" is selected
        if (status === 'full' && isNonCashMethod && bankInput && appointmentTotal) {
          const totalAmount = parseFloat(appointmentTotal.value) || 0;
          bankInput.value = totalAmount > 0 ? totalAmount.toFixed(2) : '';
          bankInput.readOnly = true;
        }

        if (method !== 'cash' && cashInput) { cashInput.value = ''; cashInput.readOnly = true; }
        if (method === 'cash' && bankInput) { bankInput.value = ''; bankInput.readOnly = true; }
      }

      // Only show reference for bank transfer or credit card (not e-wallet, which has its own logic)
      const shouldShowReference = (method === 'bank_transfer' || method === 'credit_card');
      showHide(referenceGroup, shouldShowReference);
      if (referenceInput) {
        referenceInput.required = shouldShowReference;
        if (!shouldShowReference) {
          referenceInput.value = '';
        }
      }
    }
    window.toggleAppointmentPaymentUI = toggleAppointmentPaymentUI;

    // Populate staff dropdown
    // Note: This will be available after functions are defined
    setTimeout(() => {
      if (typeof window.populateStaffDropdown === 'function') {
        window.populateStaffDropdown();
      }
    }, 50);

    // Setup radio button handlers
    function setupRadioButtonHandlers() {
      // Handle payment status radio buttons (Add Patient)
      const paymentStatusRadios = document.querySelectorAll('input[name="paymentStatus"]');
      paymentStatusRadios.forEach(radio => {
        radio.addEventListener('click', function () {
          paymentStatusRadios.forEach(r => r.checked = false);
          this.checked = true;
          toggleAddPatientPaymentUI();
        });
      });
      if (paymentStatusRadios.length) toggleAddPatientPaymentUI();

      // Handle payment method radio buttons (Add Patient)
      const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
      paymentMethodRadios.forEach(radio => {
        radio.addEventListener('click', function () {
          paymentMethodRadios.forEach(r => r.checked = false);
          this.checked = true;
          toggleAddPatientPaymentUI();
        });
        // Also trigger on change for better compatibility
        radio.addEventListener('change', function () {
          if (this.checked) {
            toggleAddPatientPaymentUI();
          }
        });
      });

      // Handle E-Wallet type selection for Add Patient
      const eWalletTypeRadios = document.querySelectorAll('input[name="eWalletType"]');
      eWalletTypeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
          const eWalletCustomRow = document.getElementById('eWalletCustomRow');
          if (eWalletCustomRow) {
            showHide(eWalletCustomRow, this.value === 'other');
          }
        });
      });

      // Handle appointment payment status radio buttons
      const appointmentPaymentStatusRadios = document.querySelectorAll('input[name="appointmentPaymentStatus"]');
      appointmentPaymentStatusRadios.forEach(radio => {
        radio.addEventListener('click', function () {
          appointmentPaymentStatusRadios.forEach(r => r.checked = false);
          this.checked = true;
          toggleAppointmentPaymentUI();
        });
      });
      if (appointmentPaymentStatusRadios.length) toggleAppointmentPaymentUI();

      // Handle appointment payment method radio buttons
      const appointmentPaymentMethodRadios = document.querySelectorAll('input[name="appointmentPaymentMethod"]');
      appointmentPaymentMethodRadios.forEach(radio => {
        radio.addEventListener('click', function () {
          appointmentPaymentMethodRadios.forEach(r => r.checked = false);
          this.checked = true;
          toggleAppointmentPaymentUI();
        });
        // Also trigger on change for better compatibility
        radio.addEventListener('change', function () {
          if (this.checked) {
            toggleAppointmentPaymentUI();
          }
        });
      });

      // Handle E-Wallet type selection for Add Appointment
      const appointmentEWalletTypeRadios = document.querySelectorAll('input[name="appointmentEWalletType"]');
      appointmentEWalletTypeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
          const appointmentEWalletCustomRow = document.getElementById('appointmentEWalletCustomRow');
          if (appointmentEWalletCustomRow) {
            showHide(appointmentEWalletCustomRow, this.value === 'other');
          }
        });
      });

      // Also handle label clicks
      const radioLabels = document.querySelectorAll('.radio-option');
      radioLabels.forEach(label => {
        label.addEventListener('click', function (e) {
          const radio = this.querySelector('input[type="radio"]');
          if (radio && e.target !== radio) {
            e.preventDefault();
            radio.click();
          }
        });
      });

      // Handle total sales amount changes for Add Patient modal
      const totalSalesInput = document.getElementById('totalSales');
      if (totalSalesInput) {
        totalSalesInput.addEventListener('change', function () {
          toggleAddPatientPaymentUI();
        });
      }

      // Handle appointment total amount changes for Add Appointment modal
      const appointmentTotalInput = document.getElementById('appointmentTotal');
      if (appointmentTotalInput) {
        appointmentTotalInput.addEventListener('change', function () {
          toggleAppointmentPaymentUI();
        });
      }
    }

    // Populate staff dropdown function
    function populateStaffDropdown() {
      try {
        const staffSelect = $("#staffEmployee");
        if (!staffSelect) {
          console.warn("Staff dropdown element not found");
          return;
        }

        // First try to load employees from localStorage
        let employees = storage.get("employees") || [];

        // If no employees in localStorage, try to fetch from server
        if (employees.length === 0) {
          loadEmployeesFromServer()
            .then(serverEmployees => {
              if (serverEmployees && serverEmployees.length > 0) {
                employees = serverEmployees;
                storage.set("employees", employees);
                populateDropdownOptions(staffSelect, employees);
              } else {
                showNoEmployeesOption(staffSelect);
              }
            })
            .catch(error => {
              const errorMessage = error && error.message ? error.message :
                (typeof error === 'string' ? error : 'Unknown server error');
              console.error("Error loading employees from server:", errorMessage);
              showNoEmployeesOption(staffSelect);
            });
          return;
        }

        populateDropdownOptions(staffSelect, employees);
      } catch (error) {
        const errorMessage = error && error.message ? error.message :
          (typeof error === 'string' ? error : 'Unknown dropdown error');
        console.error("Error populating staff dropdown:", errorMessage);

        // Try to get the staff select element again for fallback
        try {
          const staffSelect = $("#staffEmployee");
          if (staffSelect) {
            showNoEmployeesOption(staffSelect);
          }
        } catch (fallbackError) {
          console.error("Fallback error handling also failed:", fallbackError);
        }
      }
    }

    // Helper function to populate dropdown options
    function populateDropdownOptions(staffSelect, employees) {
      try {
        if (!staffSelect) {
          console.error("Staff select element is null in populateDropdownOptions");
          return;
        }

        if (!Array.isArray(employees)) {
          console.error("Employees parameter is not an array:", typeof employees);
          showNoEmployeesOption(staffSelect);
          return;
        }

        // Clear existing options (except the first one)
        while (staffSelect.children.length > 1) {
          staffSelect.removeChild(staffSelect.lastChild);
        }

        let activeEmployees = 0;

        // Add employee options
        employees.forEach((employee, index) => {
          try {
            if (employee && employee.status === 'active' && employee.name && employee.id) {
              activeEmployees++;
              const option = document.createElement("option");
              option.value = employee.id;
              option.textContent = employee.name;
              staffSelect.appendChild(option);
            }
          } catch (employeeError) {
            console.warn(`Error processing employee at index ${index}:`, employee, employeeError);
          }
        });

        // If no active employees found, show message
        if (activeEmployees === 0) {
          showNoEmployeesOption(staffSelect);
        }
      } catch (error) {
        const errorMessage = error && error.message ? error.message :
          (typeof error === 'string' ? error : 'Unknown options error');
        console.error("Error in populateDropdownOptions:", errorMessage);

        if (staffSelect) {
          showNoEmployeesOption(staffSelect);
        }
      }
    }

    // Helper function to show no employees option
    function showNoEmployeesOption(staffSelect) {
      // Clear existing options (except the first one)
      while (staffSelect.children.length > 1) {
        staffSelect.removeChild(staffSelect.lastChild);
      }

      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No active employees found - Please check Employees page";
      option.disabled = true;
      staffSelect.appendChild(option);

      // Log for debugging
      console.warn("No active employees found for staff dropdown");

      // Add a refresh button option
      const refreshOption = document.createElement("option");
      refreshOption.value = "refresh";
      refreshOption.textContent = "��� Click to refresh employee list";
      refreshOption.style.color = "#2563eb";
      staffSelect.appendChild(refreshOption);

      // Handle refresh option click
      staffSelect.addEventListener('change', function () {
        if (this.value === 'refresh') {
          console.log("Refreshing employee list...");
          loadEmployeesFromServer().then(employees => {
            if (employees && employees.length > 0) {
              storage.set("employees", employees);
              populateDropdownOptions(this, employees);
              showToast("Employee list refreshed successfully!", "success");
            } else {
              showToast("No employees found. Please add employees first.", "warning");
            }
          }).catch(error => {
            console.error("Error refreshing employees:", error);
            showToast("Failed to refresh employee list", "error");
          });
        }
      });
    }

    // Load employees from server
    async function loadEmployeesFromServer() {
      try {
        const response = await API_CONFIG.apiCall('/api/employees');
        if (response.ok) {
          const employees = await response.json();
          console.log('✅ Successfully loaded employees from server:', employees.length);
          return employees;
        } else {
          console.warn('��️ Server response not OK:', response.status, response.statusText);
          return null;
        }
      } catch (error) {
        const errorMessage = error && error.message ? error.message :
          (typeof error === 'string' ? error : 'Unknown server error');
        console.error("Error fetching employees from server:", errorMessage);
        console.error("Full server error object:", error);
        return null;
      }
    }

    // Make functions globally accessible to prevent scoping issues
    window.populateStaffDropdown = populateStaffDropdown;
    window.populateDropdownOptions = populateDropdownOptions;
    window.showNoEmployeesOption = showNoEmployeesOption;
    window.loadEmployeesFromServer = loadEmployeesFromServer;

    // Validate functions are properly accessible
    console.log('✅ Staff dropdown functions made globally accessible:', {
      populateStaffDropdown: typeof window.populateStaffDropdown,
      populateDropdownOptions: typeof window.populateDropdownOptions,
      showNoEmployeesOption: typeof window.showNoEmployeesOption,
      loadEmployeesFromServer: typeof window.loadEmployeesFromServer
    });

    // Also make appointment staff dropdown function global (defined later)
    setTimeout(() => {
      if (typeof populateAppointmentStaffDropdown === 'function') {
        window.populateAppointmentStaffDropdown = populateAppointmentStaffDropdown;
        console.log('✅ Appointment staff dropdown function made global');
      }
    }, 100);

    // Appointment modal
    const closeAppointmentModalBtn = $("#closeAppointmentModalBtn");
    const cancelAppointmentBtn = $("#cancelAppointmentBtn");
    const addAppointmentModal = $("#addAppointmentModal");
    const appointmentForm = $("#appointmentForm");
    const addAppointmentToPatientBtn = $("#addAppointmentToPatientBtn");

    if (closeAppointmentModalBtn) {
      closeAppointmentModalBtn.addEventListener("click", hideAddAppointmentModal);
    }
    if (cancelAppointmentBtn) {
      cancelAppointmentBtn.addEventListener("click", hideAddAppointmentModal);
    }
    if (addAppointmentModal) {
      addAppointmentModal.addEventListener("click", function (e) {
        if (e.target === addAppointmentModal) {
          hideAddAppointmentModal();
        }
      });
    }
    if (appointmentForm) {
      appointmentForm.addEventListener("submit", handleAppointmentFormSubmit);
    }
    if (addAppointmentToPatientBtn) {
      addAppointmentToPatientBtn.addEventListener("click", () => {
        hidePatientDetailsModal();
        showAddAppointmentModal(currentViewPatientId);
      });
    }

    // Patient details modal
    const closeDetailsModalBtn = $("#closeDetailsModalBtn");
    const patientDetailsModal = $("#patientDetailsModal");

    if (closeDetailsModalBtn) {
      closeDetailsModalBtn.addEventListener("click", hidePatientDetailsModal);
    }
    if (patientDetailsModal) {
      patientDetailsModal.addEventListener("click", function (e) {
        if (e.target === patientDetailsModal) {
          hidePatientDetailsModal();
        }
      });
    }

    // Export patient details to PDF
    const exportPatientPdfBtn = $("#exportPatientPdfBtn");
    if (exportPatientPdfBtn) {
      exportPatientPdfBtn.addEventListener("click", exportPatientDetailsToPDF);
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
          renderPatientsTable();
          updatePagination();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderPatientsTable();
          updatePagination();
        }
      });
    }
  }

  async function loadData() {
    try {
      showLoadingState();

      // Load patients from API
      try {
        const patientsResponse = await API_CONFIG.apiCall('/api/patients?includeInactive=true');
        if (patientsResponse.ok) {
          patients = await patientsResponse.json();
          console.log('✅ Loaded patients from API:', patients.length);
        } else {
          throw new Error('Failed to load patients from API');
        }
      } catch (apiError) {
        console.warn('⚠️ API unavailable, using fallback data:', apiError.message);
        // Fallback to localStorage
        patients = storage.get("patients") || [];
      }

      // Load appointments from API
      try {
        const appointmentsResponse = await API_CONFIG.apiCall('/api/appointments');
        if (appointmentsResponse.ok) {
          const rawAppointments = await appointmentsResponse.json();
          // Normalize and merge with local enriched data (payments, status)
          const serverNormalized = rawAppointments.map(apt => ({
            ...apt,
            patientId: apt.patientId || apt.patient_id
          }));
          const localBackup = storage.get('appointments') || [];
          const localById = Object.fromEntries(localBackup.map(a => [String(a.id), a]));
          appointments = serverNormalized.map(s => {
            const local = localById[String(s.id)];
            if (!local) return s;
            // Prefer local payment-related fields so fully-paid persists
            return {
              ...s,
              payment_status: local.payment_status ?? s.payment_status,
              payment_method: local.payment_method ?? s.payment_method,
              down_payment: local.down_payment ?? local.downPayment ?? s.down_payment,
              cash_payment: local.cash_payment ?? local.cashPayment ?? s.cash_payment,
              bank_transfer: local.bank_transfer ?? local.bankTransfer ?? s.bank_transfer,
              expenses: local.expenses ?? s.expenses,
              price_before_discount: local.price_before_discount ?? s.price_before_discount,
              discount_type: local.discount_type ?? s.discount_type,
              discount_value: local.discount_value ?? s.discount_value,
              total_after_discount: local.total_after_discount ?? s.total_after_discount ?? s.amount,
              balance_remaining: local.balance_remaining ?? s.balance_remaining,
              payments: Array.isArray(local.payments) ? local.payments : s.payments,
              paid_in_full_date: local.paid_in_full_date ?? s.paid_in_full_date,
              staff: local.staff ?? s.staff,
            };
          });
          // Keep global and storage consistent
          window.appointments = appointments;
          storage.set('appointments', appointments);
          console.log('✅ Loaded appointments from API and merged with local:', appointments.length);
        } else {
          throw new Error('Failed to load appointments from API');
        }
      } catch (apiError) {
        console.warn('⚠����� Appointments API unavailable, using fallback data:', apiError.message);
        // Fallback to localStorage
        appointments = storage.get("appointments") || [];
      }

      // Remove auto-added test appointments
      appointments = appointments.filter(apt => String(apt.id) !== '49');
      storage.set('appointments', appointments);

      // Load employees from API for staff dropdowns
      try {
        const employeesResponse = await API_CONFIG.apiCall('/api/employees');
        if (employeesResponse.ok) {
          const employees = await employeesResponse.json();
          storage.set("employees", employees);
          console.log('✅ Loaded employees from API:', employees.length);

          // Populate staff dropdowns after loading employees
          setTimeout(() => {
            if (typeof window.populateStaffDropdown === 'function') {
              window.populateStaffDropdown();
            } else {
              console.error('populateStaffDropdown function not available');
            }
          }, 100);
        } else {
          throw new Error('Failed to load employees from API');
        }
      } catch (apiError) {
        // Enhanced error handling to prevent [object Object] errors
        const errorMessage = apiError && apiError.message ? apiError.message :
          (typeof apiError === 'string' ? apiError : 'Unknown error');
        console.warn('⚠️ Employees API unavailable, using fallback data:', errorMessage);

        // Check if we have any employee data at all
        let employees = storage.get("employees") || [];
        if (employees.length === 0) {
          // Create sample employee data for testing
          const sampleEmployees = [
            {
              id: 1,
              name: "Dr. Jane Smith",
              email: "jane.smith@inkandarch.com",
              role: "admin",
              status: "active",
              department: "Medical"
            },
            {
              id: 2,
              name: "Sarah Johnson",
              email: "sarah.johnson@inkandarch.com",
              role: "front_desk",
              status: "active",
              department: "Administration"
            },
            {
              id: 3,
              name: "Mike Chen",
              email: "mike.chen@inkandarch.com",
              role: "employee",
              status: "active",
              department: "Treatment"
            }
          ];

          storage.set("employees", sampleEmployees);
          console.log('✅ Created sample employee data for testing');
        }

        // Still try to populate dropdown with existing data
        try {
          console.log('🔄 Setting up staff dropdown timeout...');
          setTimeout(() => {
            try {
              console.log('⏰ Staff dropdown timeout executing...');
              if (typeof window.populateStaffDropdown === 'function') {
                window.populateStaffDropdown();
                console.log('��� Staff dropdown populated successfully');
              } else {
                console.error('populateStaffDropdown function not available in timeout');
              }
            } catch (timeoutError) {
              const timeoutErrorMessage = timeoutError && timeoutError.message ? timeoutError.message :
                (typeof timeoutError === 'string' ? timeoutError : 'Unknown timeout error');
              console.error('❌ Error in staff dropdown timeout:', timeoutErrorMessage);
              console.error('Full timeout error object:', timeoutError);
            }
          }, 100);
        } catch (dropdownError) {
          const dropdownErrorMessage = dropdownError && dropdownError.message ? dropdownError.message :
            (typeof dropdownError === 'string' ? dropdownError : 'Unknown dropdown setup error');
          console.error('Error setting up staff dropdown timeout:', dropdownErrorMessage);
          console.error('Full dropdown setup error object:', dropdownError);
        }
      }

      filteredPatients = [...patients];
      // Expose for modules outside this scope
      window.patients = patients;
      window.appointments = appointments;

      // Automatically purge expired archives on page load
      setTimeout(() => {
        const purged = purgeExpiredArchivesAutomatic();
        if (purged > 0) {
          console.log(`✅ Auto-purged ${purged} expired patient archive(s)`);
        }
      }, 500);

      renderPatientsTable();
      updatePatientCount();
      updatePagination();

      // Initialize appointment notifications
      setTimeout(() => initializeAppointmentNotifications(), 100);
    } catch (error) {
      // Enhanced error handling to prevent [object Object] errors
      const errorMessage = error && error.message ? error.message :
        (typeof error === 'string' ? error : 'Unknown error occurred');

      console.error("Error loading patients:", errorMessage);
      console.error("Full error object:", error);

      showToast("Failed to load patients: " + errorMessage, "error");

      // Try to provide fallback data
      try {
        if (!patients || patients.length === 0) {
          patients = storage.get("patients") || [];
          filteredPatients = [...patients];
          // Expose for modules outside this scope
          window.patients = patients;
          window.appointments = appointments;
          renderPatientsTable();
          updatePatientCount();
          updatePagination();

          // Initialize appointment notifications
          setTimeout(() => initializeAppointmentNotifications(), 100);
        }
      } catch (fallbackError) {
        console.error("Fallback data loading also failed:", fallbackError);
      }
    }
  }

  function showLoadingState() {
    const tableBody = $("#patientsTableBody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="loading-row">
            <div class="loading-spinner">
              <div class="spinner"></div>
              <span>Loading patients...</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function renderPatientsTable() {
    const tableBody = $("#patientsTableBody");
    if (!tableBody) return;

    if (filteredPatients.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No patients found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </td>
        </tr>
      `;
      return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pagePatients = filteredPatients.slice(startIndex, endIndex);

    tableBody.innerHTML = pagePatients
      .map((patient) => {
        const patientAppointments = appointments.filter(app => String(app.patientId) === String(patient.id));
        const lastAppointment = patientAppointments.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const totalSpent = patientAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);
        // Determine if treatment card is available (has any appointment or existing card)
        const cards = (typeof getTreatmentCards === 'function' ? getTreatmentCards() : {}) || {};
        const pid = String(patient.id);
        const cardTreatments = cards[pid] ? Object.keys(cards[pid]) : [];
        const hasTreatmentCard = cardTreatments.length > 0;

        return `
          <tr>
            <td>
              <div class="patient-info">
                <div class="patient-details">
                  <div class="patient-name">${patient.name}</div>
                  <div class="patient-id">ID: ${patient.id.toString().padStart(3, "0")}</div>
                </div>
              </div>
            </td>
            <td>
              <a href="tel:${patient.mobile}" class="patient-mobile">${patient.mobile}</a>
            </td>
            <td>
              <div class="appointment-date ${!lastAppointment ? 'appointment-date-none' : ''}">
                ${lastAppointment ? formatDate(lastAppointment.date) : 'No appointments'}
              </div>
            </td>
            <td>
              <div class="amount">${formatCurrency(totalSpent)}</div>
            </td>
            <td>
              ${lastAppointment ?
            `<span class="treatment-badge">${lastAppointment.treatment}</span>` :
            '<span class="treatment-none">No treatments</span>'
          }
            </td>
            <td>
              <div class="action-buttons">
                <button class="action-btn view" onclick="viewPatientDetails(${patient.id})" title="View Patient Details">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button class="action-btn add" onclick="addAppointmentToPatient(${patient.id})" title="Add Appointment">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                ${hasTreatmentCard ? `
                <button class="action-btn card" onclick="openTreatmentCards(${patient.id})" title="View Treatment Card">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                    <line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="2"/>
                    <line x1="7" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
                ` : ''}
                <button class="action-btn edit" onclick="editPatient(${patient.id})" title="Edit Patient">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button class="action-btn delete" onclick="deletePatient(${patient.id}, '${patient.name}')" title="Delete Patient">
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

  function updatePatientCount() {
    const patientCount = $("#patientCount");
    if (patientCount) {
      const count = filteredPatients.length;
      patientCount.textContent = `${count} patient${count !== 1 ? "s" : ""}`;
    }
  }

  function updatePagination() {
    const totalItems = filteredPatients.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    // Update pagination info
    const paginationInfo = $("#paginationInfo");
    if (paginationInfo) {
      if (totalItems === 0) {
        paginationInfo.textContent = "No patients to show";
      } else {
        paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} patients`;
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
    const statusFilter = $("#statusFilter");
    const statusValue = statusFilter ? statusFilter.value : "all";
    const archives = getPatientArchives();

    filteredPatients = patients.filter((patient) => {
      // Exclude soft-deleted patients (from API is_deleted flag)
      if (patient.is_deleted) return false;

      // Exclude archived patients from local storage
      const isArchived = archives[String(patient.id)] && archives[String(patient.id)].length > 0;
      if (isArchived) return false;

      const matchesSearch =
        !searchTerm ||
        patient.name.toLowerCase().includes(searchTerm) ||
        patient.mobile.toLowerCase().includes(searchTerm);

      const matchesStatus =
        statusValue === "all" || patient.status === statusValue;

      return matchesSearch && matchesStatus;
    });

    currentPage = 1;
    renderPatientsTable();
    updatePatientCount();
    updatePagination();
  }

  function setupRadioButtonHandlers() {
    const paymentStatusRadios = document.querySelectorAll('input[name="paymentStatus"]');
    paymentStatusRadios.forEach(radio => {
      radio.addEventListener('click', function () {
        paymentStatusRadios.forEach(r => r.checked = false);
        this.checked = true;
        toggleAddPatientPaymentUI();
      });
    });
    if (paymentStatusRadios.length) toggleAddPatientPaymentUI();

    const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethodRadios.forEach(radio => {
      radio.addEventListener('click', function () {
        paymentMethodRadios.forEach(r => r.checked = false);
        this.checked = true;
        toggleAddPatientPaymentUI();
      });
    });

    const appointmentPaymentStatusRadios = document.querySelectorAll('input[name="appointmentPaymentStatus"]');
    appointmentPaymentStatusRadios.forEach(radio => {
      radio.addEventListener('click', function () {
        appointmentPaymentStatusRadios.forEach(r => r.checked = false);
        this.checked = true;
        toggleAppointmentPaymentUI();
      });
    });
    if (appointmentPaymentStatusRadios.length) toggleAppointmentPaymentUI();

    const appointmentPaymentMethodRadios = document.querySelectorAll('input[name="appointmentPaymentMethod"]');
    appointmentPaymentMethodRadios.forEach(radio => {
      radio.addEventListener('click', function () {
        appointmentPaymentMethodRadios.forEach(r => r.checked = false);
        this.checked = true;
        toggleAppointmentPaymentUI();
      });
    });

    const radioLabels = document.querySelectorAll('.radio-option');
    radioLabels.forEach(label => {
      label.addEventListener('click', function (e) {
        const radio = this.querySelector('input[type="radio"]');
        if (radio && e.target !== radio) {
          e.preventDefault();
          radio.click();
        }
      });
    });
  }

  window.setupRadioButtonHandlers = setupRadioButtonHandlers;

  // Treatments catalog helpers
  function loadTreatmentsCatalog() {
    try { return JSON.parse(localStorage.getItem('treatmentsCatalog')) || []; } catch (_) { return []; }
  }
  function saveTreatmentsCatalog() {
    localStorage.setItem('treatmentsCatalog', JSON.stringify(treatmentsCatalog || []));
  }
  function renderTreatmentsList() {
    const list = document.getElementById('treatmentsList');
    if (!list) return;
    const data = treatmentsCatalog || [];
    if (data.length === 0) {
      list.innerHTML = '<li class="empty-state" style="list-style:none; padding:10px; color:#6b7280;">No treatments added</li>';
      return;
    }
    list.innerHTML = data.map((t, i) => `
      <li style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <input type="text" class="form-input" style="flex:1;" value="${t.name}" data-index="${i}" data-field="name" />
        <input type="number" class="form-input" style="width:140px;" value="${Number(t.price || 0)}" step="0.01" min="0" data-index="${i}" data-field="price" />
        <button type="button" class="btn btn-secondary" data-action="save" data-index="${i}">Save</button>
        <button type="button" class="btn btn-danger" data-action="delete" data-index="${i}">Delete</button>
      </li>`).join('');

    list.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-index'));
      const action = btn.getAttribute('data-action');
      if (Number.isNaN(idx) || !treatmentsCatalog[idx]) return;
      if (action === 'delete') {
        treatmentsCatalog.splice(idx, 1);
        saveTreatmentsCatalog();
        renderTreatmentsList();
        populateCatalogIntoSelects();
        showToast('Treatment deleted', 'info');
      } else if (action === 'save') {
        const nameInput = list.querySelector(`input[data-index="${idx}"][data-field="name"]`);
        const priceInput = list.querySelector(`input[data-index="${idx}"][data-field="price"]`);
        const name = (nameInput?.value || '').trim();
        const price = parseFloat(priceInput?.value) || 0;
        if (!name) { showToast('Name is required', 'warning'); return; }
        treatmentsCatalog[idx].name = name;
        treatmentsCatalog[idx].price = price;
        saveTreatmentsCatalog();
        populateCatalogIntoSelects();
        showToast('Treatment updated', 'success');
      }
    };
  }
  function populateCatalogIntoSelects() {
    const selects = [document.getElementById('appointmentTreatment'), document.getElementById('patientInitialTreatment')];
    selects.forEach(sel => {
      if (!sel) return;
      const existing = sel.querySelector('optgroup[data-id="catalog-treatments-group"]');
      if (existing) existing.remove();
      if (!treatmentsCatalog || treatmentsCatalog.length === 0) return;
      const group = document.createElement('optgroup');
      group.setAttribute('label', 'Clinic Treatments');
      group.setAttribute('data-id', 'catalog-treatments-group');
      treatmentsCatalog.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        group.appendChild(opt);
      });
      sel.insertBefore(group, sel.firstChild);
    });
  }
  function computeAppointmentTotals() {
    const amountEl = document.getElementById('appointmentAmount');
    const discountEl = document.getElementById('appointmentDiscount');
    const typeEl = document.getElementById('appointmentDiscountType');
    const totalEl = document.getElementById('appointmentTotal');
    if (!amountEl || !totalEl) return;
    const base = parseFloat(amountEl.value) || 0;
    const dtype = (typeEl && typeEl.value) || 'amount';
    let dval = parseFloat(discountEl && discountEl.value) || 0;

    // Validate discount is not negative
    if (dval < 0) {
      dval = 0;
      if (discountEl) discountEl.value = '0';
      showToast('Discount cannot be negative', 'warning');
    }

    // Validate discount does not exceed price
    if (dtype === 'amount' && dval > base) {
      dval = base;
      if (discountEl) discountEl.value = base.toFixed(2);
      showToast('Discount cannot exceed the treatment price', 'warning');
    } else if (dtype === 'percent' && dval > 100) {
      dval = 100;
      if (discountEl) discountEl.value = '100';
      showToast('Discount percentage cannot exceed 100%', 'warning');
    }

    const deduction = dtype === 'percent' ? (base * dval / 100) : dval;
    const total = Math.max(0, base - deduction);
    totalEl.value = total.toFixed(2);

    // Update payment UI to auto-fill Bank/E-wallet/Credit field if "Paid in Full" is selected
    if (typeof window.toggleAppointmentPaymentUI === 'function') {
      window.toggleAppointmentPaymentUI();
    }
  }
  function wireAppointmentPricing() {
    const treatmentSel = document.getElementById('appointmentTreatment');
    const amountEl = document.getElementById('appointmentAmount');
    const totalEl = document.getElementById('appointmentTotal');
    const discountEl = document.getElementById('appointmentDiscount');
    const typeEl = document.getElementById('appointmentDiscountType');
    if (treatmentSel) {
      treatmentSel.addEventListener('change', function () {
        const found = (treatmentsCatalog || []).find(t => t.name === this.value);
        if (found && amountEl) {
          amountEl.value = Number(found.price || 0);
          amountEl.readOnly = true;
          if (totalEl) totalEl.readOnly = true;
        } else {
          if (amountEl) amountEl.readOnly = false;
          if (totalEl) totalEl.readOnly = false;
        }
        computeAppointmentTotals();
      });
    }
    if (amountEl) amountEl.addEventListener('input', computeAppointmentTotals);
    if (discountEl) {
      discountEl.addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/[^0-9.]/g, '');
        computeAppointmentTotals();
      });
    }
    if (typeEl) typeEl.addEventListener('change', computeAppointmentTotals);
  }

  function computeInitialTotals() {
    const amountEl = document.getElementById('patientInitialTreatmentAmount');
    const discountTypeEl = document.getElementById('patientInitialDiscountType');
    const discountEl = document.getElementById('patientInitialDiscount');
    const totalEl = document.getElementById('patientInitialTotal');
    if (!amountEl || !totalEl) return;
    const base = parseFloat(amountEl.value) || 0;
    const dtype = (discountTypeEl && discountTypeEl.value) || 'amount';
    let dval = parseFloat(discountEl && discountEl.value) || 0;

    // Validate discount is not negative
    if (dval < 0) {
      dval = 0;
      if (discountEl) discountEl.value = '0';
      showToast('Discount cannot be negative', 'warning');
    }

    // Validate discount does not exceed price
    if (dtype === 'amount' && dval > base) {
      dval = base;
      if (discountEl) discountEl.value = base.toFixed(2);
      showToast('Discount cannot exceed the treatment price', 'warning');
    } else if (dtype === 'percent' && dval > 100) {
      dval = 100;
      if (discountEl) discountEl.value = '100';
      showToast('Discount percentage cannot exceed 100%', 'warning');
    }

    const deduction = dtype === 'percent' ? (base * dval / 100) : dval;
    const total = Math.max(0, base - deduction);
    totalEl.value = total.toFixed(2);
  }

  function wireInitialPricing() {
    const treatmentSel = document.getElementById('patientInitialTreatment');
    const amountEl = document.getElementById('patientInitialTreatmentAmount');
    const totalEl = document.getElementById('patientInitialTotal');
    const discountTypeEl = document.getElementById('patientInitialDiscountType');
    const discountEl = document.getElementById('patientInitialDiscount');
    if (treatmentSel) {
      treatmentSel.addEventListener('change', function () {
        const found = (treatmentsCatalog || []).find(t => t.name === this.value);
        if (found && amountEl) {
          amountEl.value = Number(found.price || 0);
          amountEl.readOnly = true;
          if (totalEl) totalEl.readOnly = true;
        } else {
          if (amountEl) amountEl.readOnly = false;
          if (totalEl) totalEl.readOnly = false;
        }
        computeInitialTotals();
      });
    }
    if (amountEl) amountEl.addEventListener('input', computeInitialTotals);
    if (discountEl) {
      discountEl.addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/[^0-9.]/g, '');
        computeInitialTotals();
      });
    }
    if (discountTypeEl) discountTypeEl.addEventListener('change', computeInitialTotals);
  }

  // Ensure Add Patient modal sections are in expected order without altering styles
  function ensureAddPatientModalSectionOrder() {
    const form = document.getElementById('patientForm');
    if (!form) return;
    const sections = Array.from(form.querySelectorAll('.form-section'));
    const findByTitle = (t) => sections.find(s => (((s.querySelector('.section-title') || {}).textContent) || '').trim().toLowerCase() === t.toLowerCase());
    const consent = findByTitle('Consent Forms');
    const treatment = findByTitle('Treatment & Payment Information');
    if (consent && treatment) {
      const consentAfterTreatment = !!(treatment.compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (consentAfterTreatment) {
        form.insertBefore(consent, treatment);
      }
    }
  }

  // Helpers to toggle sections for Add vs Edit patient modes
  function findSectionByHeaderText(text) {
    const form = document.getElementById('patientForm');
    if (!form) return null;
    const sections = Array.from(form.querySelectorAll('.form-section'));
    const lower = text.trim().toLowerCase();
    return sections.find((s) => {
      const t1 = (s.querySelector('.section-title') || {}).textContent || '';
      const t2 = (s.querySelector('h4') || {}).textContent || '';
      return t1.trim().toLowerCase() === lower || t2.trim().toLowerCase() === lower;
    }) || null;
  }
  function configureAddPatientView() {
    const treatment = findSectionByHeaderText('Treatment & Payment Information');
    const items = findSectionByHeaderText('Items Used During Treatment');
    if (treatment) treatment.style.display = '';
    if (items) items.style.display = '';
    const staff = document.getElementById('staffEmployee');
    const tDate = document.getElementById('treatmentDate');
    const total = document.getElementById('totalSales');
    if (staff) staff.required = true;
    if (tDate) tDate.required = true;
    if (total) total.required = true;
  }
  function configureEditPatientView() {
    const treatment = findSectionByHeaderText('Treatment & Payment Information');
    const items = findSectionByHeaderText('Items Used During Treatment');
    if (treatment) treatment.style.display = 'none';
    if (items) items.style.display = 'none';
    const staff = document.getElementById('staffEmployee');
    const tDate = document.getElementById('treatmentDate');
    const total = document.getElementById('totalSales');
    if (staff) staff.required = false;
    if (tDate) tDate.required = false;
    if (total) total.required = false;
  }

  function setRadioValue(name, value) {
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    radios.forEach(r => { r.checked = (r.value === String(value)); });
  }
  function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = val ?? '';
    }
  }
  function fillFormWithComprehensiveData(comp) {
    if (!comp) return;

    // Fill title field
    setInputValue('title', comp.title);

    setInputValue('lastName', comp.lastName);
    setInputValue('firstName', comp.firstName);
    setInputValue('middleName', comp.middleName);

    setInputValue('dateOfBirth', comp.dateOfBirth);
    const dobEl = document.getElementById('dateOfBirth');
    const ageEl = document.getElementById('age');
    if (dobEl && ageEl && comp.dateOfBirth) {
      const birthDate = new Date(comp.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      ageEl.value = isFinite(age) ? age : '';
    }

    setInputValue('gender', comp.gender);
    if (comp.gender === 'other') {
      const row = document.getElementById('otherGenderRow');
      if (row) row.style.display = 'block';
      setInputValue('otherGender', comp.otherGender);
    }

    setInputValue('address', comp.address);
    setInputValue('city', comp.city);
    setInputValue('state', comp.state);
    setInputValue('zipCode', comp.zipCode);
    setInputValue('occupation', comp.occupation);

    // Contact numbers: fill multiple phone numbers if available
    const phoneContainer = document.getElementById('phoneNumbersContainer');
    if (phoneContainer && comp.phoneNumbers && Array.isArray(comp.phoneNumbers)) {
      phoneContainer.innerHTML = '';
      comp.phoneNumbers.forEach((phone, index) => {
        const cn = String(phone || '').replace(/\D/g, '').slice(0, 11);
        if (cn) {
          const phoneGroup = document.createElement('div');
          phoneGroup.className = 'phone-number-input-group';
          phoneGroup.innerHTML = `
            <input type="tel" class="form-input phone-input phone-number-field" maxlength="11" pattern="^\\d{11}$" value="${cn}" />
            <button type="button" class="btn btn-secondary remove-phone-btn" style="display: none;">Remove</button>
          `;
          phoneContainer.appendChild(phoneGroup);
        }
      });
      updatePhoneNumberRemoveButtons('phoneNumbersContainer', 'phone-number-field');
    } else if (phoneContainer && comp.contactNumber) {
      // Fallback for single contact number
      const cn = String(comp.contactNumber || '').replace(/\D/g, '').slice(0, 11);
      if (cn) {
        phoneContainer.innerHTML = `
          <div class="phone-number-input-group">
            <input type="tel" class="form-input phone-input phone-number-field" maxlength="11" pattern="^\\d{11}$" value="${cn}" />
            <button type="button" class="btn btn-secondary remove-phone-btn" style="display: none;">Remove</button>
          </div>
        `;
        updatePhoneNumberRemoveButtons('phoneNumbersContainer', 'phone-number-field');
      }
    }

    setInputValue('email', comp.email);

    setInputValue('emergencyContactName', comp.emergencyContactName);
    setInputValue('emergencyRelationship', comp.emergencyRelationship);

    // Emergency contact phone numbers: fill multiple if available
    const emergencyPhoneContainer = document.getElementById('emergencyPhoneNumbersContainer');
    if (emergencyPhoneContainer && comp.emergencyPhoneNumbers && Array.isArray(comp.emergencyPhoneNumbers)) {
      emergencyPhoneContainer.innerHTML = '';
      comp.emergencyPhoneNumbers.forEach((phone, index) => {
        const ecn = String(phone || '').replace(/\D/g, '').slice(0, 11);
        if (ecn) {
          const phoneGroup = document.createElement('div');
          phoneGroup.className = 'phone-number-input-group';
          phoneGroup.innerHTML = `
            <input type="tel" class="form-input phone-input emergency-phone-field" maxlength="11" pattern="^\\d{11}$" value="${ecn}" />
            <button type="button" class="btn btn-secondary remove-phone-btn" style="display: none;">Remove</button>
          `;
          emergencyPhoneContainer.appendChild(phoneGroup);
        }
      });
      updatePhoneNumberRemoveButtons('emergencyPhoneNumbersContainer', 'emergency-phone-field');
    } else if (emergencyPhoneContainer && comp.emergencyContactNumber) {
      // Fallback for single emergency contact number
      const ecn = String(comp.emergencyContactNumber || '').replace(/\D/g, '').slice(0, 11);
      if (ecn) {
        emergencyPhoneContainer.innerHTML = `
          <div class="phone-number-input-group">
            <input type="tel" class="form-input phone-input emergency-phone-field" maxlength="11" pattern="^\\d{11}$" value="${ecn}" />
            <button type="button" class="btn btn-secondary remove-phone-btn" style="display: none;">Remove</button>
          </div>
        `;
        updatePhoneNumberRemoveButtons('emergencyPhoneNumbersContainer', 'emergency-phone-field');
      }
    }

    // Medical history
    setRadioValue('hasAllergies', comp.hasAllergies || 'no');
    setInputValue('allergiesSpecify', comp.allergiesSpecify);
    const ar = document.getElementById('allergiesSpecifyRow');
    if (ar) ar.style.display = comp.hasAllergies === 'yes' ? 'block' : 'none';

    setRadioValue('takingMedication', comp.takingMedication || 'no');
    setInputValue('medicationSpecify', comp.medicationSpecify);
    const mr = document.getElementById('medicationSpecifyRow');
    if (mr) mr.style.display = comp.takingMedication === 'yes' ? 'block' : 'none';

    setRadioValue('hasSkinConditions', comp.hasSkinConditions || 'no');
    setInputValue('skinConditionsSpecify', comp.skinConditionsSpecify);
    const sr = document.getElementById('skinConditionsSpecifyRow');
    if (sr) sr.style.display = comp.hasSkinConditions === 'yes' ? 'block' : 'none';

    setRadioValue('hadSurgeries', comp.hadSurgeries || 'no');
    setInputValue('surgeriesSpecify', comp.surgeriesSpecify);
    const sur = document.getElementById('surgeriesSpecifyRow');
    if (sur) sur.style.display = comp.hadSurgeries === 'yes' ? 'block' : 'none';

    setRadioValue('isPregnant', comp.isPregnant || 'no');
    setRadioValue('smokes', comp.smokes || 'no');

    setInputValue('currentSkincare', comp.currentSkincare);
    setRadioValue('usedNewProducts', comp.usedNewProducts || 'no');
    setInputValue('newProductsSpecify', comp.newProductsSpecify);
    const npr = document.getElementById('newProductsSpecifyRow');
    if (npr) npr.style.display = comp.usedNewProducts === 'yes' ? 'block' : 'none';

    setRadioValue('hadAdverseReactions', comp.hadAdverseReactions || 'no');
    setInputValue('adverseReactionsSpecify', comp.adverseReactionsSpecify);
    const arr = document.getElementById('adverseReactionsSpecifyRow');
    if (arr) arr.style.display = comp.hadAdverseReactions === 'yes' ? 'block' : 'none';
  }

  function showAddPatientModal() {
    const modal = $("#addPatientModal");
    const form = $("#patientForm");

    // Reset form
    if (form) {
      form.reset();
      currentEditPatientId = null;

      // Reset treatment selection
      const treatmentSelect = $("#patientInitialTreatment");
      if (treatmentSelect) {
        treatmentSelect.value = "";
      }

      // Set treatment date to today based on system time
      const treatmentDateInput = $("#treatmentDate");
      if (treatmentDateInput) {
        treatmentDateInput.value = new Date().toISOString().split('T')[0];
      }

      // Reset progressive modal to step 1
      currentStep = 1;
    }

    // Update modal title
    const modalTitle = modal.querySelector(".modal-header h2");
    const submitBtn = $("#savePatientBtn");
    const submitBtnText = submitBtn.querySelector(".btn-text");

    if (modalTitle) modalTitle.textContent = "Add New Patient";
    if (submitBtnText) submitBtnText.textContent = "Add Patient";

    // Ensure Add-specific sections are visible and required
    configureAddPatientView();

    // Setup radio buttons after modal is shown
    setTimeout(() => {
      if (typeof setupRadioButtonHandlers === 'function') setupRadioButtonHandlers();
      if (typeof window.toggleAddPatientPaymentUI === 'function') window.toggleAddPatientPaymentUI();
      if (typeof window.populateStaffDropdown === 'function') {
        window.populateStaffDropdown();
      }
      if (typeof wireInitialPricing === 'function') {
        wireInitialPricing();
      }
      const dType = document.getElementById('patientInitialDiscountType');
      const dVal = document.getElementById('patientInitialDiscount');
      const tEl = document.getElementById('patientInitialTotal');
      if (dType) dType.value = 'amount';
      if (dVal) dVal.value = '';
      if (tEl) tEl.value = '';
      const payDType = document.getElementById('paymentDiscountType');
      const payDVal = document.getElementById('paymentDiscount');
      const payTotal = document.getElementById('paymentTotalAfterDiscount');
      if (payDType) payDType.value = 'amount';
      if (payDVal) payDVal.value = '';
      if (payTotal) payTotal.value = '';
    }, 100);

    selectedItemsPatient = [];
    updateSelectedItemsDisplayPatient();
    loadAvailableItemsForPatient();

    // Setup multiple phone numbers
    setupMultiplePhoneNumbers();

    // Initialize progressive modal
    setupProgressiveModal();
    updateProgressiveModalDisplay();

    // Ensure Consent Forms comes before Treatment & Payment Information
    ensureAddPatientModalSectionOrder();
    // Render consent checkboxes from global consents
    renderConsentCheckboxes('patient');

    showModal("#addPatientModal");
  }

  function hideAddPatientModal() {
    hideModal("#addPatientModal");
    currentEditPatientId = null;

    // Reset initial treatment field
    const treatmentSelect = $("#patientInitialTreatment");
    if (treatmentSelect) {
      treatmentSelect.value = "";
    }
  }

  function showAddAppointmentModal(patientId = null) {
    const modal = $("#addAppointmentModal");
    const form = $("#appointmentForm");

    // Reset appointment editing state if starting fresh appointment
    if (patientId) {
      appointmentIdBeingEdited = null;
    }

    // Reset form completely
    if (form) {
      form.reset();
      // Set today's date as default
      const today = new Date().toISOString().split('T')[0];
      const dateInput = $("#appointmentDate");
      if (dateInput) {
        dateInput.value = today;
      }

      // Ensure treatment field has no default value
      const treatmentSelect = $("#appointmentTreatment");
      if (treatmentSelect) {
        treatmentSelect.value = ""; // Explicitly set to empty
      }

      // Ensure amount field is empty
      const amountInput = $("#appointmentAmount");
      if (amountInput) {
        amountInput.value = "";
      }
    }

    // Store the patient ID for the appointment
    if (patientId) {
      currentViewPatientId = patientId;
    }

    // Reset selected items
    selectedItems = [];
    updateSelectedItemsDisplay();

    // Load available items for selection
    loadAvailableItems();

    // Populate staff dropdown
    populateAppointmentStaffDropdown();

    // Render applicable info
    renderApplicableInfoChips();

    // Render consent checkboxes from global consents
    renderConsentCheckboxes('appointment');

    // Populate treatments and wire pricing/discount handlers
    populateCatalogIntoSelects();
    wireAppointmentPricing();
    const dtEl = document.getElementById('appointmentDiscountType');
    const dEl = document.getElementById('appointmentDiscount');
    const totalEl = document.getElementById('appointmentTotal');
    if (dtEl) dtEl.value = 'amount';
    if (dEl) dEl.value = '';
    if (totalEl) totalEl.value = '';
    computeAppointmentTotals();

    // Treatment card days toggle
    const trackCardCb = document.getElementById('trackTreatmentCard');
    const daysRow = document.getElementById('treatmentCardDaysRow');
    if (daysRow) daysRow.style.display = trackCardCb && trackCardCb.checked ? 'block' : 'none';
    if (trackCardCb) trackCardCb.addEventListener('change', () => {
      if (daysRow) daysRow.style.display = trackCardCb.checked ? 'block' : 'none';
    });

    // Setup radio buttons for appointment form
    setTimeout(() => {
      if (typeof setupRadioButtonHandlers === 'function') setupRadioButtonHandlers();
      if (typeof window.toggleAppointmentPaymentUI === 'function') window.toggleAppointmentPaymentUI();
    }, 100);

    showModal("#addAppointmentModal");
  }

  function populateAppointmentStaffDropdown() {
    const staffSelect = $("#appointmentStaff");
    if (!staffSelect) return;

    try {
      // First try to load employees from localStorage
      let employees = storage.get("employees") || [];

      // If no employees in localStorage, try to fetch from server
      if (employees.length === 0) {
        loadEmployeesFromServer()
          .then(serverEmployees => {
            if (serverEmployees && serverEmployees.length > 0) {
              employees = serverEmployees;
              storage.set("employees", employees);
              populateDropdownOptions(staffSelect, employees);
            } else {
              showNoEmployeesOption(staffSelect);
            }
          })
          .catch(error => {
            console.error("Error loading employees from server:", error);
            showNoEmployeesOption(staffSelect);
          });
        return;
      }

      populateDropdownOptions(staffSelect, employees);
    } catch (error) {
      console.error("Error populating appointment staff dropdown:", error);
      showNoEmployeesOption(staffSelect);
    }
  }

  function hideAddAppointmentModal() {
    hideModal("#addAppointmentModal");
    // Reset selected items to prevent carryover to next appointment
    selectedItems = [];
    updateSelectedItemsDisplay();
    // Reset appointment editing state
    appointmentIdBeingEdited = null;
  }

  function showPatientDetailsModal(patientId) {
    const patient = patients.find(p => String(p.id) === String(patientId));
    if (!patient) return;

    currentViewPatientId = patientId;
    const patientAppointments = appointments.filter(app => String(app.patientId) === String(patientId))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalSpent = patientAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);

    // Update modal content
    const titleElement = $("#patientDetailsTitle");
    const nameElement = $("#detailsPatientName");
    const mobileElement = $("#detailsPatientMobile");
    const appointmentsElement = $("#detailsTotalAppointments");
    const spentElement = $("#detailsTotalSpent");
    const appointmentsList = $("#appointmentsList");

    if (titleElement) titleElement.textContent = `${patient.name} - Patient Details`;
    if (nameElement) nameElement.textContent = patient.name;
    if (mobileElement) mobileElement.textContent = `Mobile: ${patient.mobile}`;
    if (appointmentsElement) appointmentsElement.textContent = `${patientAppointments.length} appointment${patientAppointments.length !== 1 ? 's' : ''}`;
    if (spentElement) spentElement.textContent = `${formatCurrency(totalSpent)} total spent`;

    // Show archive info in header
    const archives = getPatientArchives();
    const entries = archives[String(patientId)] || [];
    const statsContainer = appointmentsElement?.parentElement;
    if (statsContainer && !document.getElementById('detailsArchiveInfo')) {
      const span = document.createElement('span');
      span.id = 'detailsArchiveInfo';
      span.textContent = entries.length ? `Archived: ${entries.length} (${entries.map(e => formatDate(e.archivedAt)).join(', ')})` : 'Archived: 0';
      statsContainer.appendChild(document.createTextNode(' �� '));
      statsContainer.appendChild(span);
    } else if (document.getElementById('detailsArchiveInfo')) {
      const span = document.getElementById('detailsArchiveInfo');
      span.textContent = entries.length ? `Archived: ${entries.length} (${entries.map(e => formatDate(e.archivedAt)).join(', ')})` : 'Archived: 0';
    }

    // Render appointments list
    if (appointmentsList) {
      if (patientAppointments.length === 0) {
        appointmentsList.innerHTML = `
          <div class="empty-state">
            <p>No appointments found for this patient.</p>
          </div>
        `;
      } else {
        appointmentsList.innerHTML = patientAppointments.map(appointment => `
          <div class="appointment-item">
            <div class="appointment-header">
              <div class="appointment-treatment">${appointment.treatment}</div>
              <div class="appointment-amount">${formatCurrency(appointment.amount)}</div>
            </div>
            <div class="appointment-date-item">${formatDate(appointment.date)}</div>
            <div class="appointment-meta">
              <div>Status: ${appointment.payment_status === 'full' ? 'Paid in Full' : 'Partial Payment'}</div>
              <div>Paid: ${formatCurrency((appointment.down_payment || appointment.downPayment || 0) + (appointment.cash_payment || appointment.cashPayment || 0) + (appointment.bank_transfer || appointment.bankTransfer || 0))}</div>
              <div>Remaining: ${formatCurrency(Math.max(0, (appointment.total_after_discount || appointment.amount || 0) - ((appointment.down_payment || appointment.downPayment || 0) + (appointment.cash_payment || appointment.cashPayment || 0) + (appointment.bank_transfer || appointment.bankTransfer || 0))))}</div>
              <div>Method: ${formatPaymentMethod(appointment.payment_method || appointment.paymentMethod)}</div>
              ${(() => {
            const refs = [];
            if (Array.isArray(appointment.payments)) {
              appointment.payments.forEach(p => {
                const r = p?.reference || p?.ref || p?.reference_number || p?.referenceNumber;
                if (r) refs.push(r);
              });
            }
            const top = appointment.payment_reference || appointment.reference_number || appointment.reference;
            if (top) refs.push(top);
            const unique = Array.from(new Set(refs.filter(Boolean)));
            return (unique.length ? `<div>Reference: ${unique.join(', ')}</div>` : '');
          })()}
            </div>
            ${appointment.payment_status !== 'full' ? `<div style="margin-top:8px;"><button class="btn btn-primary" onclick="settleAppointmentPayment(${appointment.id})">Settle Remaining</button></div>` : ''}
            ${appointment.notes ? `<div class="appointment-notes">${appointment.notes}</div>` : ''}
            <div style="margin-top:12px; display:flex; gap:8px;">
              <button class="btn btn-secondary" onclick="generateReceipt(${appointment.id}, ${appointment.patientId})" title="View and print receipt">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline; margin-right:4px;">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                </svg>
                Receipt
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render treatment cards list
    const tList = document.getElementById('treatmentCardsList');
    if (tList) {
      renderTreatmentCardsList(patientId);
    }

    showModal("#patientDetailsModal");
  }
  window.showPatientDetailsModal = showPatientDetailsModal;

  // Export patient details to PDF
  function exportPatientDetailsToPDF() {
    const patientId = currentViewPatientId;
    if (!patientId) {
      showToast("No patient selected", "error");
      return;
    }

    const patient = patients.find(p => String(p.id) === String(patientId));
    if (!patient) {
      showToast("Patient not found", "error");
      return;
    }

    const patientAppointments = appointments.filter(app => String(app.patientId) === String(patientId))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalSpent = patientAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);

    const pdfContent = document.createElement("div");
    pdfContent.style.padding = "20px";
    pdfContent.style.fontFamily = "Arial, sans-serif";
    pdfContent.innerHTML = `
      <div style="margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0 0 10px 0; font-size: 24px;">${patient.name}</h1>
        <p style="color: #666; margin: 5px 0; font-size: 14px;">Patient ID: ${patient.id.toString().padStart(3, "0")}</p>
        <p style="color: #666; margin: 5px 0; font-size: 14px;">Mobile: ${patient.mobile}</p>
      </div>

      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 8px;">
        <h3 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">Summary</h3>
        <p style="color: #666; margin: 5px 0; font-size: 14px;"><strong>Total Appointments:</strong> ${patientAppointments.length}</p>
        <p style="color: #666; margin: 5px 0; font-size: 14px;"><strong>Total Spent:</strong> ${formatCurrency(totalSpent)}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">Appointment History</h3>
        ${patientAppointments.length === 0 ?
        `<p style="color: #999; font-size: 14px;">No appointments found</p>` :
        `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
                <th style="padding: 10px; text-align: left; color: #333; font-size: 13px;">Date</th>
                <th style="padding: 10px; text-align: left; color: #333; font-size: 13px;">Treatment</th>
                <th style="padding: 10px; text-align: right; color: #333; font-size: 13px;">Amount</th>
                <th style="padding: 10px; text-align: left; color: #333; font-size: 13px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${patientAppointments.map(apt => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 10px; color: #666; font-size: 13px;">${formatDate(apt.date)}</td>
                  <td style="padding: 10px; color: #666; font-size: 13px;">${apt.treatment || "—"}</td>
                  <td style="padding: 10px; text-align: right; color: #666; font-size: 13px;">${formatCurrency(apt.amount || 0)}</td>
                  <td style="padding: 10px; color: #666; font-size: 13px;">${apt.payment_status === 'full' ? 'Paid in Full' : 'Partial Payment'}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`
      }
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
        <p style="margin: 0;">Generated on ${new Date().toLocaleString()}</p>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `${patient.name.replace(/\s+/g, '_')}_Details.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    try {
      html2pdf().set(opt).from(pdfContent).save();
      showToast("PDF exported successfully", "success");
    } catch (error) {
      console.error("PDF export error:", error);
      showToast("Failed to export PDF", "error");
    }
  }
  window.exportPatientDetailsToPDF = exportPatientDetailsToPDF;

  // =================== ARCHIVE MANAGEMENT ===================
  function getArchiveSettings() {
    const s = storage.get('archiveSettings') || {};
    return {
      enabled: s.enabled !== false,
      months: Number.isFinite(s.months) ? s.months : 6,
      retentionDays: Number.isFinite(s.retentionDays) ? s.retentionDays : 730 // Default: 2 years
    };
  }
  function saveArchiveSettings(settings) { storage.set('archiveSettings', settings); }
  function getPatientArchives() { return storage.get('patientArchives') || {}; }
  function setPatientArchives(v) { storage.set('patientArchives', v); }

  /**
   * Calculate expiry date for an archived patient based on retention period
   * @param {number} retentionDays - Days to retain before permanent deletion
   * @returns {Date} Expiry date
   */
  function calculateArchiveExpiryDate(retentionDays) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    return expiryDate;
  }

  /**
   * Check if an archived patient has expired
   * @param {Object} archiveEntry - Archive entry with archivedAt and expiryDate
   * @returns {boolean} True if expired
   */
  function isArchiveExpired(archiveEntry) {
    if (!archiveEntry.expiryDate) return false;
    const expiryDate = new Date(archiveEntry.expiryDate);
    return new Date() > expiryDate;
  }
  function lastActivityForPatient(pid) {
    const apps = (window.appointments || []).filter(a => String(a.patientId) === String(pid));
    if (!apps.length) return null;
    const last = apps.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return last?.date || null;
  }
  function isEligibleForArchive(patient) {
    const settings = getArchiveSettings();
    if (!settings.enabled) return false;
    if (patient.status !== 'inactive') return false;
    const last = lastActivityForPatient(patient.id);
    if (!last) return true; // never visited
    const months = settings.months;
    const lastDate = new Date(last);
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);
    return lastDate < cutoff;
  }
  function buildArchiveTableRows() {
    const archives = getPatientArchives();
    return patients.map(p => {
      const last = lastActivityForPatient(p.id);
      const eligible = isEligibleForArchive(p);
      const count = (archives[String(p.id)] || []).length;
      return `
        <tr>
          <td><div class="patient-info"><div class="patient-details"><div class="patient-name">${p.name}</div><div class="patient-id">ID: ${p.id.toString().padStart(3, '0')}</div></div></div></td>
          <td>${last ? formatDate(last) : '—'}</td>
          <td>${eligible ? '<span class="status-badge inactive">Eligible</span>' : '<span class="status-badge active">Not eligible</span>'}</td>
          <td>${count}</td>
        </tr>`;
    }).join('');
  }
  function showArchiveManagerModal() {
    const settings = getArchiveSettings();
    const monthsInput = document.getElementById('archiveMonths');
    const enabledInput = document.getElementById('autoArchiveEnabled');
    const retentionDaysInput = document.getElementById('retentionDays');
    if (monthsInput) monthsInput.value = settings.months;
    if (enabledInput) enabledInput.checked = !!settings.enabled;
    if (retentionDaysInput) retentionDaysInput.value = settings.retentionDays;
    const tbody = document.getElementById('archiveTableBody');
    if (tbody) tbody.innerHTML = buildArchiveTableRows();
    showModal('#archiveManagerModal');
  }
  function saveArchiveSettingsFromUI() {
    const months = parseInt(document.getElementById('archiveMonths')?.value || '6', 10);
    const enabled = document.getElementById('autoArchiveEnabled')?.checked !== false;
    const retentionDays = parseInt(document.getElementById('retentionDays')?.value || '730', 10);

    if (retentionDays < 1) {
      showToast('Retention period must be at least 1 day', 'warning');
      return;
    }

    saveArchiveSettings({ months, enabled, retentionDays });
    const tbody = document.getElementById('archiveTableBody');
    if (tbody) tbody.innerHTML = buildArchiveTableRows();
    showToast('Archive settings saved successfully', 'success');
  }
  function archiveEligibleNow() {
    const archives = getPatientArchives();
    const settings = getArchiveSettings();
    let added = 0;
    patients.forEach(p => {
      if (isEligibleForArchive(p)) {
        const key = String(p.id);
        archives[key] = archives[key] || [];
        const expiryDate = calculateArchiveExpiryDate(settings.retentionDays);
        archives[key].push({
          archivedAt: new Date().toISOString(),
          name: p.name,
          expiryDate: expiryDate.toISOString(),
          reason: 'Automatic archive - inactive patient'
        });
        added++;
      }
    });
    if (added > 0) {
      setPatientArchives(archives);
      showToast(`${added} archived snapshot${added > 1 ? 's' : ''} created`, 'success');
    }
    const tbody = document.getElementById('archiveTableBody');
    if (tbody) tbody.innerHTML = buildArchiveTableRows();
  }

  function showArchivedPatientsBrowser() {
    const container = document.getElementById('archivedPatientsList');
    if (!container) return;

    const archives = getPatientArchives();
    const hasArchives = Object.keys(archives).length > 0;

    if (!hasArchives) {
      container.innerHTML = '<div class="empty-state"><p>No archived patients found</p></div>';
      showModal('#archivedPatientsBrowserModal');
      return;
    }

    let html = '';
    let hasExpiredArchives = false;

    Object.keys(archives).forEach(patientId => {
      const archiveList = archives[patientId];
      const patient = patients.find(p => String(p.id) === String(patientId));
      const patientName = patient ? patient.name : `Patient ID: ${patientId}`;

      html += `
        <div class="archived-patient-card">
          <div class="archived-patient-header">
            <div class="archived-patient-info">
              <h3 class="archived-patient-name">${patientName}</h3>
              <p class="archived-patient-id">Patient ID: ${patientId}</p>
            </div>
            <div class="archived-patient-count">${archiveList.length} archive${archiveList.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="archived-patient-history">
            <div class="history-label">Archive History:</div>
            <ul class="archive-entries-list">
              ${archiveList.map((entry, idx) => {
                const isExpired = isArchiveExpired(entry);
                if (isExpired) hasExpiredArchives = true;
                const expiryDate = entry.expiryDate ? new Date(entry.expiryDate) : null;
                const expiryStatus = isExpired ? '<span style="color: #dc2626; font-weight: bold;">EXPIRED</span>' :
                  (expiryDate ? `Expires: ${formatDate(expiryDate)}` : 'No expiry set');

                return `
                  <li class="archive-entry">
                    <div class="entry-info">
                      <div class="entry-date">${new Date(entry.archivedAt).toLocaleString('en-US')}</div>
                      <div class="entry-expiry" style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">${expiryStatus}</div>
                      ${entry.reason ? `<div class="entry-reason" style="font-size: 0.8em; color: #9ca3af;">Reason: ${entry.reason}</div>` : ''}
                    </div>
                    <div class="archive-entry-actions" style="display: flex; gap: 8px;">
                      <button class="btn btn-primary btn-sm view-archive-btn" data-patient-id="${patientId}" data-entry-index="${idx}" title="View details">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        View
                      </button>
                      <button class="btn btn-danger btn-sm delete-archive-btn" data-patient-id="${patientId}" data-entry-index="${idx}" title="Delete this archive entry">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>
        </div>
      `;
    });

    // Add purge button if there are expired archives
    if (hasExpiredArchives) {
      container.innerHTML = `
        <div style="margin-bottom: 20px; padding: 12px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
          <p style="margin: 0 0 10px 0; color: #991b1b; font-weight: 500;">⚠️ Some archives have expired and can be permanently deleted</p>
          <button class="btn btn-danger" id="purgeExpiredBtn" style="width: 100%;">Purge Expired Archives</button>
        </div>
      ` + html;
    } else {
      container.innerHTML = html;
    }

    // Add event listeners to view buttons
    const viewButtons = container.querySelectorAll('.view-archive-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const patientId = this.getAttribute('data-patient-id');
        const entryIndex = parseInt(this.getAttribute('data-entry-index'));
        viewPatientArchiveDetails(patientId, entryIndex);
      });
    });

    // Add event listeners to delete buttons
    const deleteButtons = container.querySelectorAll('.delete-archive-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const patientId = this.getAttribute('data-patient-id');
        const entryIndex = parseInt(this.getAttribute('data-entry-index'));
        deleteArchiveEntry(patientId, entryIndex);
      });
    });

    // Add event listener for purge expired button
    const purgeBtn = container.querySelector('#purgeExpiredBtn');
    if (purgeBtn) {
      purgeBtn.addEventListener('click', purgeExpiredArchives);
    }

    showModal('#archivedPatientsBrowserModal');
  }

  function viewPatientArchiveDetails(patientId, entryIndex) {
    const archives = getPatientArchives();
    const archiveList = archives[patientId];

    if (!archiveList || !archiveList[entryIndex]) {
      showToast('Archive entry not found', 'error');
      return;
    }

    const entry = archiveList[entryIndex];
    const contentEl = document.getElementById('archivedPatientDetailsContent');
    if (!contentEl) return;

    // Get appointments for this patient
    const patientAppointments = (appointments || []).filter(apt =>
      String(apt.patientId || apt.patient_id) === String(patientId)
    );

    const appointmentsHTML = patientAppointments.length > 0
      ? patientAppointments.map(apt => `
          <div class="appointment-item" style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 8px; background-color: #f9fafb;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="color: #1f2937;">${new Date(apt.date).toLocaleDateString()}</strong>
              <span style="font-size: 12px; color: #6b7280; background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${apt.status || 'Scheduled'}</span>
            </div>
            <div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
              <strong>Treatment:</strong> ${apt.treatment || 'N/A'}
            </div>
            <div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
              <strong>Amount:</strong> ₱${(apt.total_after_discount || apt.amount || 0).toFixed(2)}
            </div>
            ${apt.staff ? `<div style="font-size: 14px; color: #374151;">
              <strong>Staff:</strong> ${apt.staff}
            </div>` : ''}
          </div>
        `).join('')
      : '<p style="color: #6b7280; text-align: center; padding: 16px;">No appointments found</p>';

    const detailsHTML = `
      <div class="details-group">
        <div class="detail-row">
          <label class="detail-label">Patient ID</label>
          <span class="detail-value">${patientId}</span>
        </div>
        <div class="detail-row">
          <label class="detail-label">Name</label>
          <span class="detail-value">${entry.name || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <label class="detail-label">Email</label>
          <span class="detail-value">${entry.email || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <label class="detail-label">Phone</label>
          <span class="detail-value">${entry.phone || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <label class="detail-label">Archived Date</label>
          <span class="detail-value">${new Date(entry.archivedAt).toLocaleString()}</span>
        </div>
        <div class="detail-row">
          <label class="detail-label">Archive Reason</label>
          <span class="detail-value">${entry.reason || 'No reason provided'}</span>
        </div>
        ${entry.expiryDate ? `
        <div class="detail-row">
          <label class="detail-label">Expiry Date</label>
          <span class="detail-value">${new Date(entry.expiryDate).toLocaleString()}</span>
        </div>
        ` : ''}
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">Appointment History</h3>
          <div style="max-height: 300px; overflow-y: auto;">
            ${appointmentsHTML}
          </div>
        </div>
      </div>
    `;

    contentEl.innerHTML = detailsHTML;
    showModal('#archivedPatientDetailsModal');
  }

  /**
   * Permanently delete expired archived patients (automatic, silent)
   * @returns {number} Number of purged archives
   */
  function purgeExpiredArchivesAutomatic() {
    const archives = getPatientArchives();
    let purgedCount = 0;

    Object.keys(archives).forEach(patientId => {
      archives[patientId] = archives[patientId].filter(entry => {
        const isExpired = isArchiveExpired(entry);
        if (isExpired) purgedCount++;
        return !isExpired;
      });

      // Remove patient from archives if no entries left
      if (archives[patientId].length === 0) {
        delete archives[patientId];
      }
    });

    if (purgedCount > 0) {
      setPatientArchives(archives);
    }

    return purgedCount;
  }

  /**
   * Permanently delete expired archived patients (manual, with notifications)
   */
  function purgeExpiredArchives() {
    const purgedCount = purgeExpiredArchivesAutomatic();

    if (purgedCount > 0) {
      showToast(`${purgedCount} expired archive${purgedCount !== 1 ? 's' : ''} permanently deleted`, 'success');
      showArchivedPatientsBrowser(); // Refresh the modal
    } else {
      showToast('No expired archives found', 'info');
    }
  }

  window.purgeExpiredArchives = purgeExpiredArchives;
  window.purgeExpiredArchivesAutomatic = purgeExpiredArchivesAutomatic;

  window.deleteArchiveEntry = function (patientId, entryIndex) {
    try {
      const confirmed = confirm('Are you sure you want to delete this archive entry? This action cannot be undone.');
      if (!confirmed) return;

      const archives = getPatientArchives();
      if (archives[patientId] && archives[patientId][entryIndex] !== undefined) {
        archives[patientId].splice(entryIndex, 1);

        // Remove patient from archives if no entries left
        if (archives[patientId].length === 0) {
          delete archives[patientId];
        }

        setPatientArchives(archives);
        showToast('Archive entry deleted successfully', 'success');
        showArchivedPatientsBrowser(); // Refresh the modal
      } else {
        showToast('Archive entry not found', 'error');
      }
    } catch (error) {
      console.error('Error deleting archive entry:', error);
      showToast('Failed to delete archive entry', 'error');
    }
  };

  function hidePatientDetailsModal() {
    hideModal("#patientDetailsModal");
    currentViewPatientId = null;
  }

  async function handlePatientFormSubmit(e) {
    e.preventDefault();

    // Ensure name fields are capitalized before submission
    const nameFields = ['lastName', 'firstName', 'middleName'];
    nameFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field && field.value.trim()) {
        field.value = capitalizeWords(field.value);
      }
    });

    // Collect comprehensive form data
    const patientData = collectFormData();
    if (!patientData) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    // Validate required fields (different for Add vs Edit)
    const isEdit = !!currentEditPatientId;
    const baseMissing = !patientData.title || !patientData.lastName || !patientData.firstName || !patientData.dateOfBirth ||
      !patientData.gender || !patientData.address || !patientData.city ||
      !patientData.state || !patientData.zipCode || !patientData.contactNumber ||
      !patientData.email || !patientData.emergencyContactName || !patientData.emergencyRelationship;

    if (isEdit) {
      if (baseMissing) {
        showToast("Please complete all required patient information fields", "error");
        return;
      }
    } else {
      const addMissing = baseMissing || !patientData.staffEmployee || !patientData.treatmentDate || !patientData.totalSales;
      if (addMissing) {
        showToast("Please fill in all required fields including treatment and payment information", "error");
        return;
      }
    }

    // Validate at least one phone number is provided
    const phoneNumbers = patientData.phoneNumbers || [];
    if (phoneNumbers.length === 0) {
      showToast("Please enter at least one phone number", "error");
      return;
    }

    // Validate all phone numbers format
    const invalidPhones = phoneNumbers.filter(num => !num || !num.match(/^\d{11}$/));
    if (invalidPhones.length > 0) {
      showToast("All phone numbers must be exactly 11 digits", "error");
      return;
    }

    // Validate contact number (exactly 11 digits)
    if (patientData.contactNumber && !patientData.contactNumber.match(/^\d{11}$/)) {
      showToast("Please enter an 11-digit contact number", "error");
      return;
    }

    // Validate email
    if (patientData.email && !validateEmail(patientData.email)) {
      showToast("Please enter a valid email address", "error");
      return;
    }
    if (patientData.email && patientData.email.length > 26) {
      showToast("Email address must be 26 characters or fewer", "error");
      return;
    }

    // Occupation validation: no special chars except dash, max 24
    if (patientData.occupation && !/^[A-Za-z\s\-]{0,24}$/.test(patientData.occupation)) {
      showToast("Occupation can only contain letters, spaces, and dashes (max 24 chars)", "error");
      return;
    }

    // Emergency contact validations
    if (patientData.emergencyContactName && patientData.emergencyContactName.length > 30) {
      showToast('Emergency contact name must be 30 characters or fewer', 'error');
      return;
    }
    if (patientData.emergencyRelationship && !/^[A-Za-z\s]{1,15}$/.test(patientData.emergencyRelationship)) {
      showToast('Relationship must be letters only, up to 15 characters', 'error');
      return;
    }
    if (patientData.emergencyContactNumber && !/^[0-9]{11}$/.test(String(patientData.emergencyContactNumber))) {
      showToast('Emergency contact number must be 11 digits', 'error');
      return;
    }

    // Normalize numbers to digits only
    if (patientData.contactNumber) {
      patientData.contactNumber = String(patientData.contactNumber).replace(/\D/g, '').slice(0, 11);
    }
    if (patientData.emergencyContactNumber) {
      patientData.emergencyContactNumber = String(patientData.emergencyContactNumber).replace(/\D/g, '').slice(0, 11);
    }

    // Create full name for compatibility
    patientData.name = `${patientData.firstName} ${patientData.middleName ? patientData.middleName + ' ' : ''}${patientData.lastName}`;
    patientData.mobile = patientData.contactNumber; // For compatibility

    // Validate name reuse - can only reuse if previous patient is archived
    if (!isEdit) {
      const existingPatient = patients.find(p =>
        p.name.toLowerCase().trim() === patientData.name.toLowerCase().trim() &&
        !p.is_deleted
      );
      if (existingPatient) {
        showToast('A patient with this name already exists. You can only reuse a name if the previous patient is archived.', 'error');
        return;
      }
    }

    // Ensure individual name parts are preserved in the object
    patientData.first_name = patientData.firstName;
    patientData.middle_name = patientData.middleName;
    patientData.last_name = patientData.lastName;

    // Check for duplicate patient name (allow duplicates only if existing records are archived)
    const normalizedName = (patientData.name || '').trim().toLowerCase();
    if (normalizedName) {
      const archives = getPatientArchives();
      const matching = patients.filter(p => (p.name || '').trim().toLowerCase() === normalizedName && (!currentEditPatientId || p.id !== currentEditPatientId));
      if (matching.length > 0) {
        // If any matching patient is not archived (no archive entries), block save
        const hasNonArchived = matching.some(p => {
          const key = String(p.id);
          const entries = archives[key] || [];
          return !entries || entries.length === 0;
        });
        if (hasNonArchived) {
          showToast('A patient with that name already exists. If this is an archived record, restore it first or use a different name.', 'error');
          return;
        }
      }
    }

    const submitBtn = $("#savePatientBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnSpinner = submitBtn.querySelector(".btn-spinner");

    // Show loading state
    submitBtn.disabled = true;
    btnText.classList.add("hidden");
    btnSpinner.classList.remove("hidden");

    try {
      if (currentEditPatientId) {
        // Update existing patient via API
        const response = await API_CONFIG.apiCall(`/api/patients/${currentEditPatientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: patientData.name,
            email: patientData.email,
            mobile: patientData.contactNumber,
            address: `${patientData.address}, ${patientData.city}, ${patientData.state} ${patientData.zipCode}`,
            date_of_birth: patientData.dateOfBirth,
            comprehensive_data: patientData // Store all the detailed information
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Update failed' }));
          throw new Error(errorData.error || 'Failed to update patient');
        }

        // Update local data
        const patientIndex = patients.findIndex(p => p.id === currentEditPatientId);
        if (patientIndex !== -1) {
          const oldData = { ...patients[patientIndex] };
          const updatedPatient = {
            ...patients[patientIndex],
            ...patientData,
            comprehensive_data: patientData,
          };
          patients[patientIndex] = updatedPatient;

          // Log patient update
          if (window.auditLogger) {
            const changes = Object.keys(patientData).filter(key =>
              oldData[key] !== patientData[key]
            ).map(key => ({
              field: key,
              oldValue: oldData[key],
              newValue: patientData[key]
            }));

            await window.auditLogger.logPatient('update', {
              id: currentEditPatientId,
              name: updatedPatient.name,
              oldValue: oldData,
              newValue: updatedPatient,
              changes: changes,
              updatedFields: Object.keys(patientData)
            });
          }
        }
        showToast("Patient updated successfully!", "success");
      } else {
        // Create new patient via API
        const response = await API_CONFIG.apiCall('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: patientData.name,
            email: patientData.email,
            mobile: patientData.contactNumber,
            address: `${patientData.address}, ${patientData.city}, ${patientData.state} ${patientData.zipCode}`,
            date_of_birth: patientData.dateOfBirth,
            comprehensive_data: patientData // Store all the detailed information
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Creation failed' }));
          throw new Error(errorData.error || 'Failed to create patient');
        }

        const result = await response.json();
        console.log('✅ Patient created on server:', result);

        // Add to local array with server-assigned ID
        const newPatient = {
          id: result.id,
          ...patientData,
          comprehensive_data: patientData,
          status: "active",
          createdAt: new Date().toISOString(),
        };
        patients.push(newPatient);
        // Keep global in sync
        window.patients = patients;

        // Persist any temp consents created during Add Patient
        if (tempNewPatientConsents && tempNewPatientConsents.length > 0) {
          const consentsMap = storage.get('consentForms') || {};
          consentsMap[String(result.id)] = (consentsMap[String(result.id)] || []).concat(tempNewPatientConsents);
          storage.set('consentForms', consentsMap);
          tempNewPatientConsents = [];
        }

        // Also save to localStorage as backup
        storage.set('patients', patients);
        console.log('✅ Patient saved to localStorage backup:', newPatient);

        // If initial treatment is selected, create appointment automatically
        if (patientData.initialTreatment) {
          try {
            const baseAmt = parseFloat(patientData.totalSales) || 0;
            const discType = patientData.paymentDiscountType || 'amount';
            const discValue = parseFloat(patientData.paymentDiscount) || 0;
            const discDeduction = discType === 'percent' ? (baseAmt * discValue / 100) : discValue;
            const totalAfter = Math.max(0, baseAmt - discDeduction);

            const appointmentPayload = {
              patient_id: result.id,
              treatment: patientData.initialTreatment,
              amount: totalAfter,
              date: patientData.treatmentDate || new Date().toISOString().split('T')[0],
              notes: 'Initial treatment - created with patient registration',
              itemsUsed: selectedItemsPatient,
              price_before_discount: baseAmt,
              discount_type: discType,
              discount_value: discValue,
              total_after_discount: totalAfter,
              staff: patientData.staffEmployee || null
            };

            const appointmentResponse = await API_CONFIG.apiCall('/api/appointments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(appointmentPayload)
            });

            if (appointmentResponse.ok) {
              const appointmentResult = await appointmentResponse.json();
              console.log('✅ Initial appointment created:', appointmentResult);

              // Add to local appointments array
              const dp = parseFloat(patientData.downPayment) || 0;
              const cp = parseFloat(patientData.cashPayment) || 0;
              const bt = parseFloat(patientData.bankTransferEWalletCredit || patientData.bankTransferGcashCredit) || 0;
              const expVal = parseFloat(patientData.expenses) || 0;
              const totalPaidInit = dp + cp + bt;
              const initStatus = (totalPaidInit >= totalAfter) ? 'full' : 'partial';
              const remainingInit = Math.max(0, totalAfter - totalPaidInit);
              const initDate = patientData.treatmentDate || new Date().toISOString().split('T')[0];

              const newAppointment = {
                id: appointmentResult.id,
                patientId: result.id,
                treatment: patientData.initialTreatment,
                date: initDate,
                notes: 'Initial treatment - created with patient registration',
                staff: patientData.staffEmployee || null,
                amount: totalAfter,
                payment_status: initStatus,
                payment_method: patientData.paymentMethod || 'cash',
                payment_reference: (patientData.paymentReference || '').trim(),
                non_cash_method: patientData.paymentMethod || 'cash',
                down_payment: dp,
                cash_payment: cp,
                bank_transfer: bt,
                expenses: expVal,
                price_before_discount: baseAmt,
                discount_type: discType,
                discount_value: discValue,
                total_after_discount: totalAfter,
                balance_remaining: remainingInit,
                payments: [
                  ...(dp ? [{ amount: dp, method: 'down_payment', date: initDate }] : []),
                  ...(cp ? [{ amount: cp, method: 'cash', date: initDate }] : []),
                  ...(bt ? [{ amount: bt, method: (patientData.paymentMethod && patientData.paymentMethod !== 'cash') ? patientData.paymentMethod : 'bank_transfer', date: initDate, reference: (patientData.paymentReference || '').trim() }] : []),
                ],
                itemsUsed: selectedItemsPatient,
                createdAt: new Date().toISOString(),
              };

              if (initStatus === 'full') {
                newAppointment.paid_in_full_date = initDate;
              }
              appointments.push(newAppointment);

              // Save to localStorage as backup
              storage.set('appointments', appointments);
              console.log('✅ Appointment saved to localStorage backup:', newAppointment);

              // Update inventory based on selected items for initial treatment
              await updateInventoryForSelectedItems(selectedItemsPatient, patientData.initialTreatment);
              selectedItemsPatient = [];

              showToast(`Patient added with initial treatment: ${patientData.initialTreatment}`, "success");
              const trackInit = document.getElementById('trackInitialTreatmentCard')?.checked;
              const slotsVal2 = parseInt(document.getElementById('initialTreatmentCardDays')?.value || '7', 10);
              const slots2 = Math.min(8, Math.max(1, isNaN(slotsVal2) ? 7 : slotsVal2));
              if (trackInit) {
                setTimeout(() => showTreatmentCardModal(result.id, patientData.initialTreatment, slots2), 300);
              }
            } else {
              console.warn('Failed to create initial appointment, but patient was created');
              showToast("Patient added successfully! (Initial appointment creation failed)", "warning");
            }
          } catch (appointmentError) {
            console.error('Error creating initial appointment:', appointmentError);
            showToast("Patient added successfully! (Initial appointment creation failed)", "warning");
          }
        } else {
          showToast("Patient added successfully!", "success");
        }

        // Log patient creation
        if (window.auditLogger) {
          await window.auditLogger.logPatient('create', {
            id: newPatient.id,
            name: newPatient.name,
            mobile: newPatient.mobile || newPatient.landline,
            contact: newPatient.contactType,
            initialTreatment: patientData.initialTreatment || 'None'
          });
        }
      }

      // Save to storage as backup
      storage.set("patients", patients);

      // Refresh the display
      applyFilters();
      hideAddPatientModal();
    } catch (error) {
      console.error("Patient creation error:", error);
      showToast(`Failed to save patient: ${error.message}`, "error");
    } finally {
      // Reset loading state
      submitBtn.disabled = false;
      btnText.classList.remove("hidden");
      btnSpinner.classList.add("hidden");
    }
  }

  async function handleAppointmentFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const appointmentData = Object.fromEntries(formData.entries());

    const submitBtn = $("#saveAppointmentBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnSpinner = submitBtn.querySelector(".btn-spinner");

    // Show loading state
    submitBtn.disabled = true;
    btnText.classList.add("hidden");
    btnSpinner.classList.remove("hidden");

    try {
      // Check if we're editing an existing appointment
      const isEditingAppointment = appointmentIdBeingEdited !== null;
      const appointmentToEdit = isEditingAppointment ?
        appointments.find(a => String(a.id) === String(appointmentIdBeingEdited)) : null;

      // If editing, update button text
      if (isEditingAppointment) {
        if (btnText) btnText.textContent = "Updating...";
      }

      // Get payment status and method
      const paymentStatus = document.querySelector('input[name="appointmentPaymentStatus"]:checked')?.value || 'partial';
      const paymentMethod = document.querySelector('input[name="appointmentPaymentMethod"]:checked')?.value || 'cash';

      // Compute final total
      const baseAmount = parseFloat(appointmentData.amount) || 0;
      const discountType = document.getElementById('appointmentDiscountType')?.value || 'amount';
      const discountValue = parseFloat(document.getElementById('appointmentDiscount')?.value) || 0;
      const enteredTotal = parseFloat(document.getElementById('appointmentTotal')?.value);
      const computedDeduction = discountType === 'percent' ? (baseAmount * discountValue / 100) : discountValue;
      const computedTotal = isNaN(enteredTotal) ? Math.max(0, baseAmount - computedDeduction) : enteredTotal;

      // If editing, handle update and return early
      if (isEditingAppointment && appointmentToEdit) {
        await updateExistingAppointment(appointmentToEdit, appointmentData, computedTotal, baseAmount, discountType, discountValue, paymentMethod);
        await updateInventoryForSelectedItems(selectedItems, appointmentData.treatment);
        applyFilters();
        setTimeout(() => renderAppointmentNotifications(), 100);
        if (typeof window.updateRevenueSummaries === 'function') {
          setTimeout(() => window.updateRevenueSummaries(), 200);
        }
        hideAddAppointmentModal();
        return;
      }

      // Create appointment via server API
      const appointmentPayload = {
        patient_id: currentViewPatientId,
        treatment: appointmentData.treatment,
        amount: computedTotal,
        date: appointmentData.date,
        notes: appointmentData.notes || '',
        itemsUsed: selectedItems,
        staff: appointmentData.staff,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        payment_reference: (appointmentData.appointmentReference || '').trim(),
        non_cash_method: paymentMethod,
        down_payment: parseFloat(appointmentData.downPayment) || 0,
        cash_payment: parseFloat(appointmentData.cashPayment) || 0,
        bank_transfer: parseFloat(appointmentData.bankTransfer) || 0,
        expenses: parseFloat(appointmentData.expenses) || 0,
        price_before_discount: baseAmount,
        discount_type: discountType,
        discount_value: discountValue,
        total_after_discount: computedTotal
      };

      const response = await API_CONFIG.apiCall('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create appointment');
      }

      const result = await response.json();
      console.log('��� Appointment created on server:', result);

      // Add to local array with server-assigned ID
      const paidDown = parseFloat(appointmentData.downPayment) || 0;
      const paidCash = parseFloat(appointmentData.cashPayment) || 0;
      const paidBank = parseFloat(appointmentData.bankTransfer) || 0;
      const expensesVal = parseFloat(appointmentData.expenses) || 0;
      const totalPaid = paidDown + paidCash + paidBank;
      const initialStatus = (totalPaid >= computedTotal) ? 'full' : 'partial';
      const remainingBalance = Math.max(0, computedTotal - totalPaid);

      const newAppointment = {
        id: result.id,
        patientId: currentViewPatientId,
        treatment: appointmentData.treatment,
        date: appointmentData.date,
        notes: appointmentData.notes || '',
        staff: appointmentData.staff || null,
        amount: computedTotal,
        payment_status: initialStatus,
        payment_method: paymentMethod,
        payment_reference: (appointmentData.appointmentReference || '').trim(),
        non_cash_method: paymentMethod,
        down_payment: paidDown,
        cash_payment: paidCash,
        bank_transfer: paidBank,
        expenses: expensesVal,
        price_before_discount: baseAmount,
        discount_type: discountType,
        discount_value: discountValue,
        total_after_discount: computedTotal,
        balance_remaining: remainingBalance,
        payments: [
          ...(paidDown ? [{ amount: paidDown, method: 'down_payment', date: appointmentData.date }] : []),
          ...(paidCash ? [{ amount: paidCash, method: 'cash', date: appointmentData.date }] : []),
          ...(paidBank ? [{ amount: paidBank, method: (paymentMethod && paymentMethod !== 'cash') ? paymentMethod : 'bank_transfer', date: appointmentData.date, reference: (appointmentData.appointmentReference || '').trim() }] : []),
        ],
        itemsUsed: selectedItems,
        createdAt: new Date().toISOString(),
      };

      if (initialStatus === 'full') {
        newAppointment.paid_in_full_date = appointmentData.date;
      }

      appointments.push(newAppointment);
      // Keep global in sync
      window.appointments = appointments;

      // Auto-set reminder for the day of appointment (at 8 AM)
      const appointmentDate = new Date(newAppointment.date);
      const reminderDate = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate(), 8, 0, 0);
      const now = new Date();

      // If 8 AM has already passed today, set reminder at 8 AM tomorrow for today's appointments
      if (reminderDate <= now) {
        reminderDate.setDate(reminderDate.getDate() + 1);
      }

      // Only set reminder if it's in the future
      if (reminderDate > now) {
        setAppointmentReminder(newAppointment.id, reminderDate);
      }

      // Update inventory if needed (decrement selected items)
      await updateInventoryForSelectedItems(selectedItems, appointmentData.treatment);

      // Save to localStorage as backup
      storage.set('appointments', appointments);
      console.log('�� Appointment saved to localStorage backup:', newAppointment);

      showToast("Appointment added successfully!", "success");

      // Refresh the display
      applyFilters();

      // Refresh appointment notifications
      setTimeout(() => renderAppointmentNotifications(), 100);

      // Update revenue summaries in inventory module if it's loaded
      if (typeof window.updateRevenueSummaries === 'function') {
        setTimeout(() => window.updateRevenueSummaries(), 200);
      }

      const shouldTrack = document.getElementById('trackTreatmentCard')?.checked;
      const treatmentToTrack = appointmentData.treatment;
      const slotsVal = parseInt(document.getElementById('treatmentCardDays')?.value || '7', 10);
      const slots = Math.min(8, Math.max(1, isNaN(slotsVal) ? 7 : slotsVal));
      hideAddAppointmentModal();
      if (shouldTrack) {
        setTimeout(() => showTreatmentCardModal(currentViewPatientId, treatmentToTrack, slots), 300);
      }
    } catch (error) {
      showToast("Failed to add appointment. Please try again.", "error");
    } finally {
      // Reset loading state
      submitBtn.disabled = false;
      btnText.classList.remove("hidden");
      btnSpinner.classList.add("hidden");
    }
  }

  async function updateInventoryForSelectedItems(selectedItems, treatment) {
    if (!selectedItems || selectedItems.length === 0) {
      console.log("No items selected for inventory update");
      return;
    }

    console.log(`🔄 Updating inventory for ${selectedItems.length} selected items:`, selectedItems);
    let itemsUpdated = 0;

    // Update each item both in database and localStorage
    for (const selectedItem of selectedItems) {
      // Validate selected item has required properties
      if (!selectedItem || !selectedItem.id || !selectedItem.quantity) {
        console.warn("⚠️ Invalid selected item:", selectedItem);
        continue;
      }

      try {
        // First, get current inventory item from server
        const response = await API_CONFIG.apiCall(`/api/inventory`);
        let serverInventory = [];
        if (response.ok) {
          serverInventory = await response.json();
        }

        const serverItem = serverInventory.find(item => item.id === selectedItem.id);
        if (!serverItem) {
          console.warn(`⚠���� Inventory item with ID ${selectedItem.id} not found in server database`);
          continue;
        }

        const oldQuantity = serverItem.quantity;
        const newQuantity = Math.max(0, serverItem.quantity - selectedItem.quantity);

        // Update in server database
        const updateResponse = await API_CONFIG.apiCall(`/api/inventory/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...serverItem,
            quantity: newQuantity,
            last_updated: new Date().toISOString()
          })
        });

        if (updateResponse.ok) {
          console.log(`���� Updated ${serverItem.name} in database: ${oldQuantity} → ${newQuantity} (used: ${selectedItem.quantity})`);
          itemsUpdated++;

          // Also update localStorage as backup
          let inventory = storage.get("inventory") || [];
          let localItem = inventory.find(item => item.id === selectedItem.id);
          if (localItem) {
            localItem.quantity = newQuantity;
            localItem.lastUpdated = new Date().toISOString();
            storage.set("inventory", inventory);
          }
        } else {
          console.error(`❌ Failed to update ${serverItem.name} in database`);
          // Fallback to localStorage only
          let inventory = storage.get("inventory") || [];
          let localItem = inventory.find(item => item.id === selectedItem.id);
          if (localItem) {
            localItem.quantity = Math.max(0, localItem.quantity - selectedItem.quantity);
            localItem.lastUpdated = new Date().toISOString();
            storage.set("inventory", inventory);
            console.log(`📱 Updated ${localItem.name} in localStorage as fallback`);
            itemsUpdated++;
          }
        }
      } catch (error) {
        console.error(`❌ Error updating inventory item ${selectedItem.id}:`, error);
        // Fallback to localStorage only
        let inventory = storage.get("inventory") || [];
        let localItem = inventory.find(item => item.id === selectedItem.id);
        if (localItem) {
          localItem.quantity = Math.max(0, localItem.quantity - selectedItem.quantity);
          localItem.lastUpdated = new Date().toISOString();
          storage.set("inventory", inventory);
          console.log(`📱 Updated ${localItem.name} in localStorage as fallback`);
          itemsUpdated++;
        }
      }
    }

    if (itemsUpdated > 0) {
      // Add inventory change log
      let inventoryLogs = storage.get("inventoryLogs") || [];
      const logEntry = {
        id: Math.max(...inventoryLogs.map(l => l.id), 0) + 1,
        action: "treatment_usage",
        treatment: treatment,
        items: selectedItems,
        timestamp: new Date().toISOString()
      };
      inventoryLogs.push(logEntry);
      storage.set("inventoryLogs", inventoryLogs);

      console.log(`✅ Inventory updated successfully. ${itemsUpdated} items processed.`);
      showToast(`Inventory updated: ${itemsUpdated} item${itemsUpdated !== 1 ? 's' : ''} consumed`, "success");

      // Notify inventory module to update summaries if it's loaded
      if (typeof window.updateRevenueSummaries === 'function') {
        console.log("📊 Triggering revenue summary update");
        setTimeout(() => window.updateRevenueSummaries(), 100);
      }
    }
  }

  // Handle appointment update when editing existing appointment
  async function updateExistingAppointment(appointmentToUpdate, appointmentData, computedTotal, baseAmount, discountType, discountValue, paymentMethod) {
    const paidDown = parseFloat(appointmentData.downPayment) || 0;
    const paidCash = parseFloat(appointmentData.cashPayment) || 0;
    const paidBank = parseFloat(appointmentData.bankTransfer) || 0;
    const expensesVal = parseFloat(appointmentData.expenses) || 0;
    const totalPaid = paidDown + paidCash + paidBank;
    const initialStatus = (totalPaid >= computedTotal) ? 'full' : 'partial';
    const remainingBalance = Math.max(0, computedTotal - totalPaid);

    // Update appointment object
    appointmentToUpdate.treatment = appointmentData.treatment;
    appointmentToUpdate.date = appointmentData.date;
    appointmentToUpdate.notes = appointmentData.notes || '';
    appointmentToUpdate.staff = appointmentData.staff || null;
    appointmentToUpdate.amount = computedTotal;
    appointmentToUpdate.payment_status = initialStatus;
    appointmentToUpdate.payment_method = paymentMethod;
    appointmentToUpdate.payment_reference = (appointmentData.appointmentReference || '').trim();
    appointmentToUpdate.non_cash_method = paymentMethod;
    appointmentToUpdate.down_payment = paidDown;
    appointmentToUpdate.cash_payment = paidCash;
    appointmentToUpdate.bank_transfer = paidBank;
    appointmentToUpdate.expenses = expensesVal;
    appointmentToUpdate.price_before_discount = baseAmount;
    appointmentToUpdate.discount_type = discountType;
    appointmentToUpdate.discount_value = discountValue;
    appointmentToUpdate.total_after_discount = computedTotal;
    appointmentToUpdate.balance_remaining = remainingBalance;
    appointmentToUpdate.payments = [
      ...(paidDown ? [{ amount: paidDown, method: 'down_payment', date: appointmentData.date }] : []),
      ...(paidCash ? [{ amount: paidCash, method: 'cash', date: appointmentData.date }] : []),
      ...(paidBank ? [{ amount: paidBank, method: (paymentMethod && paymentMethod !== 'cash') ? paymentMethod : 'bank_transfer', date: appointmentData.date, reference: (appointmentData.appointmentReference || '').trim() }] : []),
    ];
    appointmentToUpdate.itemsUsed = selectedItems;
    appointmentToUpdate.updatedAt = new Date().toISOString();

    if (initialStatus === 'full') {
      appointmentToUpdate.paid_in_full_date = appointmentData.date;
    }

    try {
      // Update on server
      const updateResponse = await API_CONFIG.apiCall(`/api/appointments/${appointmentIdBeingEdited}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentToUpdate)
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update appointment');
      }

      // Save to localStorage
      storage.set('appointments', appointments);
      console.log('Appointment updated:', appointmentToUpdate);
      showToast("Appointment updated successfully!", "success");
      appointmentIdBeingEdited = null;
      return true;
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  // Items selection functionality
  let selectedItems = [];

  async function loadAvailableItems() {
    // Try to get fresh inventory from server first
    let inventory = [];
    try {
      const response = await API_CONFIG.apiCall('/api/inventory');
      if (response.ok) {
        inventory = await response.json();
        console.log('✅ Loaded fresh inventory from server for item selection:', inventory.length);
        // Update localStorage with fresh data
        storage.set('inventory', inventory);
      } else {
        throw new Error('Failed to load from server');
      }
    } catch (error) {
      console.warn('⚠️ Using localStorage inventory for item selection:', error.message);
      inventory = storage.get("inventory") || [];
    }
    const itemsGrid = $("#itemsGrid");

    if (!itemsGrid) return;

    if (inventory.length === 0) {
      itemsGrid.innerHTML = '<p class="no-items-text">No items available in inventory</p>';
      return;
    }

    itemsGrid.innerHTML = inventory.map(item => `
      <div class="item-card" data-item-id="${item.id}" ${item.quantity === 0 ? 'style="opacity: 0.6;"' : ''}>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">
            <span class="item-category">${item.category}</span>
            <span class="item-quantity ${item.quantity === 0 ? 'out-of-stock' : ''}">Stock: ${item.quantity} ${item.unit}${item.quantity === 0 ? ' (Out of Stock)' : ''}</span>
          </div>
        </div>
        <div class="item-select">
          <input type="number" class="item-quantity-input" min="1" max="${Math.max(1, item.quantity)}" value="1">
          <button type="button" class="btn btn-sm btn-primary add-item-btn">Add</button>
        </div>
      </div>
    `).join('');

    // Add event listeners for item selection
    const addButtons = itemsGrid.querySelectorAll('.add-item-btn');
    addButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const itemCard = this.closest('.item-card');
        const itemId = parseInt(itemCard.dataset.itemId);
        const quantityInput = itemCard.querySelector('.item-quantity-input');
        const quantity = parseInt(quantityInput.value);

        addItemToSelection(itemId, quantity);
      });
    });

    // Add search functionality
    const itemSearch = $("#itemSearch");
    if (itemSearch) {
      itemSearch.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const itemCards = itemsGrid.querySelectorAll('.item-card');

        itemCards.forEach(card => {
          const itemName = card.querySelector('.item-name').textContent.toLowerCase();
          const itemCategory = card.querySelector('.item-category').textContent.toLowerCase();

          if (itemName.includes(searchTerm) || itemCategory.includes(searchTerm)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    }
  }

  function addItemToSelection(itemId, quantity) {
    const inventory = storage.get("inventory") || [];
    const item = inventory.find(i => i.id === itemId);

    if (!item) return;

    // Only validate stock when user actually tries to select an item
    if (item.quantity === 0) {
      showToast(`Cannot select ${item.name} - item is out of stock`, "error");
      return;
    }

    if (quantity > item.quantity) {
      showToast(`Only ${item.quantity} ${item.unit} available in stock for ${item.name}`, "error");
      return;
    }

    // Check if item already selected
    const existingIndex = selectedItems.findIndex(si => si.id === itemId);

    if (existingIndex !== -1) {
      // Update quantity
      const newQuantity = selectedItems[existingIndex].quantity + quantity;
      if (newQuantity > item.quantity) {
        showToast(`Cannot exceed available stock (${item.quantity} ${item.unit}) for ${item.name}`, "error");
        return;
      }
      selectedItems[existingIndex].quantity = newQuantity;
    } else {
      // Add new item
      selectedItems.push({
        id: itemId,
        name: item.name,
        unit: item.unit,
        quantity: quantity
      });
    }

    updateSelectedItemsDisplay();
  }

  function updateSelectedItemsDisplay() {
    const selectedItemsList = $("#selectedItemsList");

    if (!selectedItemsList) return;

    if (selectedItems.length === 0) {
      selectedItemsList.innerHTML = '<p class="no-items-text">No items selected</p>';
      return;
    }

    selectedItemsList.innerHTML = selectedItems.map(item => `
      <div class="selected-item">
        <div class="selected-item-info">
          <span class="selected-item-name">${item.name}</span>
          <span class="selected-item-quantity">${item.quantity} ${item.unit}</span>
        </div>
        <button type="button" class="btn btn-sm btn-danger remove-item-btn" data-item-id="${item.id}">
          Remove
        </button>
      </div>
    `).join('');

    // Add remove event listeners
    const removeButtons = selectedItemsList.querySelectorAll('.remove-item-btn');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const itemId = parseInt(this.dataset.itemId);
        removeItemFromSelection(itemId);
      });
    });
  }

  function removeItemFromSelection(itemId) {
    selectedItems = selectedItems.filter(item => item.id !== itemId);
    updateSelectedItemsDisplay();
  }

  // Items selection for Add Patient modal
  async function loadAvailableItemsForPatient() {
    let inventory = [];
    try {
      const response = await API_CONFIG.apiCall('/api/inventory');
      if (response.ok) {
        inventory = await response.json();
        storage.set('inventory', inventory);
      } else {
        throw new Error('Failed to load from server');
      }
    } catch (error) {
      inventory = storage.get('inventory') || [];
    }

    const itemsGrid = document.getElementById('patientItemsGrid');
    if (!itemsGrid) return;

    if (inventory.length === 0) {
      itemsGrid.innerHTML = '<p class="no-items-text">No items available in inventory</p>';
      return;
    }

    itemsGrid.innerHTML = inventory.map(item => `
      <div class="item-card" data-item-id="${item.id}" ${item.quantity === 0 ? 'style="opacity: 0.6;"' : ''}>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">
            <span class="item-category">${item.category}</span>
            <span class="item-quantity ${item.quantity === 0 ? 'out-of-stock' : ''}">Stock: ${item.quantity} ${item.unit}${item.quantity === 0 ? ' (Out of Stock)' : ''}</span>
          </div>
        </div>
        <div class="item-select">
          <input type="number" class="item-quantity-input" min="1" max="${Math.max(1, item.quantity)}" value="1">
          <button type="button" class="btn btn-sm btn-primary add-item-btn">Add</button>
        </div>
      </div>
    `).join('');

    const addButtons = itemsGrid.querySelectorAll('.add-item-btn');
    addButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const itemCard = this.closest('.item-card');
        const itemId = parseInt(itemCard.dataset.itemId);
        const quantityInput = itemCard.querySelector('.item-quantity-input');
        const quantity = parseInt(quantityInput.value);
        addItemToSelectionForPatient(itemId, quantity);
      });
    });

    const itemSearch = document.getElementById('patientItemSearch');
    if (itemSearch) {
      itemSearch.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const itemCards = itemsGrid.querySelectorAll('.item-card');
        itemCards.forEach(card => {
          const itemName = card.querySelector('.item-name').textContent.toLowerCase();
          const itemCategory = card.querySelector('.item-category').textContent.toLowerCase();
          card.style.display = (itemName.includes(searchTerm) || itemCategory.includes(searchTerm)) ? 'flex' : 'none';
        });
      });
    }
  }

  function addItemToSelectionForPatient(itemId, quantity) {
    const inventory = storage.get('inventory') || [];
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    if (item.quantity === 0) {
      showToast(`Cannot select ${item.name} - item is out of stock`, 'error');
      return;
    }
    if (quantity > item.quantity) {
      showToast(`Only ${item.quantity} ${item.unit} available in stock for ${item.name}`, 'error');
      return;
    }

    const existingIndex = selectedItemsPatient.findIndex(si => si.id === itemId);
    if (existingIndex !== -1) {
      const newQuantity = selectedItemsPatient[existingIndex].quantity + quantity;
      if (newQuantity > item.quantity) {
        showToast(`Cannot exceed available stock (${item.quantity} ${item.unit}) for ${item.name}`, 'error');
        return;
      }
      selectedItemsPatient[existingIndex].quantity = newQuantity;
    } else {
      selectedItemsPatient.push({ id: itemId, name: item.name, unit: item.unit, quantity });
    }

    updateSelectedItemsDisplayPatient();
  }

  function updateSelectedItemsDisplayPatient() {
    const selectedItemsList = document.getElementById('patientSelectedItemsList');
    if (!selectedItemsList) return;

    if (selectedItemsPatient.length === 0) {
      selectedItemsList.innerHTML = '<p class="no-items-text">No items selected</p>';
      return;
    }

    selectedItemsList.innerHTML = selectedItemsPatient.map(item => `
      <div class="selected-item">
        <div class="selected-item-info">
          <span class="selected-item-name">${item.name}</span>
          <span class="selected-item-quantity">${item.quantity} ${item.unit}</span>
        </div>
        <button type="button" class="btn btn-sm btn-danger remove-item-btn" data-item-id="${item.id}">Remove</button>
      </div>
    `).join('');

    const removeButtons = selectedItemsList.querySelectorAll('.remove-item-btn');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const itemId = parseInt(this.dataset.itemId);
        removeItemFromSelectionPatient(itemId);
      });
    });
  }

  function removeItemFromSelectionPatient(itemId) {
    selectedItemsPatient = selectedItemsPatient.filter(item => item.id !== itemId);
    updateSelectedItemsDisplayPatient();
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
          <h2>Export Patient Report</h2>
          <button class="modal-close" id="closeExportModal">×</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px;">Choose export format:</p>
          <button class="btn btn-primary" id="exportCSV" style="width: 100%; margin-bottom: 10px;">��� Export as CSV</button>
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
    const exportData = filteredPatients.map((patient) => {
      const patientAppointments = appointments.filter(app => String(app.patientId) === String(patient.id));
      const totalSpent = patientAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);
      const lastAppointment = patientAppointments.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return {
        "Patient Name": patient.name,
        "Mobile Number": patient.mobile,
        "Email": patient.email || "N/A",
        "Total Appointments": patientAppointments.length,
        "Total Spent": totalSpent,
        "Last Appointment": lastAppointment ? lastAppointment.date : "None",
        "Last Treatment": lastAppointment ? lastAppointment.treatment : "None",
        "Status": patient.status
      };
    });

    if (exportData.length === 0) {
      showToast("No data to export", "warning");
      return;
    }

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Patient_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast("CSV report exported successfully!", "success");
  }

  function exportToPDF() {
    const printWindow = window.open('', '_blank');
    const exportData = filteredPatients.map((patient) => {
      const patientAppointments = appointments.filter(app => String(app.patientId) === String(patient.id));
      const totalSpent = patientAppointments.reduce((sum, app) => sum + (app.amount || 0), 0);
      const lastAppointment = patientAppointments.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return {
        name: patient.name,
        mobile: patient.mobile,
        email: patient.email || "N/A",
        appointments: patientAppointments.length,
        totalSpent: totalSpent,
        lastAppointment: lastAppointment ? lastAppointment.date : "None",
        status: patient.status
      };
    });

    const currentDate = new Date().toLocaleDateString();
    const totalPatients = exportData.length;
    const totalRevenue = exportData.reduce((sum, p) => sum + p.totalSpent, 0);

    printWindow.document.write(`
      <html><head><title>Patient Report</title>
      <style>
        body { font-family: Arial; margin: 40px; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #2563eb; margin: 0; }
        .summary { display: flex; justify-content: space-around; background: #f8fafc; padding: 20px; margin-bottom: 30px; }
        .summary-item { text-align: center; }
        .summary-item .number { font-size: 24px; font-weight: bold; color: #2563eb; }
        .summary-item .label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f8fafc; font-weight: 600; }
      </style>
      </head><body>
        <div class="header">
          <h1>����� Patient Report</h1>
          <p>Generated on: ${currentDate}</p>
        </div>
        <div class="summary">
          <div class="summary-item">
            <div class="number">${totalPatients}</div>
            <div class="label">Total Patients</div>
          </div>
          <div class="summary-item">
            <div class="number">₱${totalRevenue.toLocaleString()}</div>
            <div class="label">Total Revenue</div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Patient Name</th><th>Mobile</th><th>Email</th><th>Appointments</th><th>Total Spent</th><th>Last Visit</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${exportData.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.mobile}</td>
                <td>${p.email}</td>
                <td>${p.appointments}</td>
                <td>₱${p.totalSpent.toLocaleString()}</td>
                <td>${p.lastAppointment}</td>
                <td>${p.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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

  // Global functions for action buttons
  window.editPatient = function (id) {
    const patient = patients.find(p => p.id === id);
    if (!patient) return;

    // Populate form comprehensively with patient data
    const form = $("#patientForm");
    if (form) {
      const comp = getComprehensiveData(patient);
      // Fallback name parsing for legacy records
      if (!comp.firstName || !comp.lastName) {
        const nameStr = patient.name || '';
        const parts = nameStr.trim().split(/\s+/).filter(Boolean);
        comp.firstName = comp.firstName || (parts[0] || '');
        comp.lastName = comp.lastName || (parts.length > 1 ? parts[parts.length - 1] : '');
        comp.middleName = comp.middleName || (parts.length > 2 ? parts.slice(1, -1).join(' ') : '');
      }
      if (!comp.contactNumber && patient.mobile) comp.contactNumber = patient.mobile;
      if (!comp.dateOfBirth && patient.date_of_birth) comp.dateOfBirth = patient.date_of_birth;
      fillFormWithComprehensiveData(comp);
    }

    // Update modal for editing
    const modal = $("#addPatientModal");
    const modalTitle = modal.querySelector(".modal-header h2");
    const submitBtn = $("#savePatientBtn");
    const submitBtnText = submitBtn.querySelector(".btn-text");

    if (modalTitle) modalTitle.textContent = "Edit Patient";
    if (submitBtnText) submitBtnText.textContent = "Update Patient";

    // Hide treatment/payment and items sections in edit mode
    configureEditPatientView();

    // Reset progressive modal to step 1 for editing
    currentStep = 1;
    setupProgressiveModal();
    updateProgressiveModalDisplay();

    // Setup multiple phone numbers
    setupMultiplePhoneNumbers();

    currentEditPatientId = id;
    // Load and render patient consents
    tempNewPatientConsents = [];
    renderPatientConsentList(id);
    showModal("#addPatientModal");
  };

  window.deletePatient = function (id, name) {
    const deletePatientName = $("#deletePatientName");
    if (deletePatientName) {
      deletePatientName.textContent = name;
    }

    // Store the ID for deletion
    window.patientToDelete = id;
    showModal("#deleteModal");
  };

  window.viewPatientDetails = function (id) {
    showPatientDetailsModal(id);
  };

  window.addAppointmentToPatient = function (id) {
    showAddAppointmentModal(id);
  };

  // Expose appointment functions globally
  window.setAppointmentReminder = setAppointmentReminder;
  window.checkAndSendReminders = checkAndSendReminders;

  // ========================================
  // APPOINTMENT NOTIFICATION SYSTEM
  // ========================================

  // Get pending appointments (not yet added/completed)
  function getPendingAppointmentNotifications() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get notifications that haven't been marked as resolved
    const resolvedNotifications = storage.get('resolvedAppointmentNotifications') || [];

    // Filter appointments that:
    // 1. Are scheduled for the future (excluding today - today's are auto-recorded)
    // 2. Haven't been marked as resolved
    // 3. Belong to a patient in the system
    const pending = (appointments || [])
      .filter(apt => {
        // Check if this appointment notification has been resolved
        if (resolvedNotifications.includes(String(apt.id))) {
          return false;
        }

        // Skip auto-added test appointments
        if (String(apt.id) === '49') {
          return false;
        }

        // Get appointment date
        const aptDate = new Date(apt.date);
        const aptDay = new Date(aptDate.getFullYear(), aptDate.getMonth(), aptDate.getDate());

        // Include appointments for future dates only (tomorrow and beyond)
        // Today's appointments are automatically recorded and should not appear in pending
        const nextDay = new Date(today);
        nextDay.setDate(nextDay.getDate() + 1);
        return aptDay >= nextDay;
      })
      .map(apt => {
        const patient = (patients || []).find(p => String(p.id) === String(apt.patientId));
        return {
          ...apt,
          patientName: patient?.name || 'Unknown Patient',
          patientMobile: patient?.mobile || 'N/A'
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return pending;
  }

  // Render appointment notifications
  function renderAppointmentNotifications() {
    const section = document.getElementById('appointmentNotificationsSection');
    const list = document.getElementById('appointmentNotificationsList');
    const count = document.getElementById('appointmentNotificationsCount');

    if (!section || !list) return;

    const notifications = getPendingAppointmentNotifications();

    // Update count
    if (count) {
      count.textContent = `(${notifications.length})`;
    }

    // Show/hide section based on notifications
    if (notifications.length === 0) {
      section.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    section.style.display = 'block';

    // Render notification cards
    list.innerHTML = notifications.map(apt => {
      const appointmentDate = new Date(apt.date);
      const dateStr = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const timeStr = appointmentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const staffName = apt.staff || 'Not assigned';

      return `
        <div class="notification-card" data-appointment-id="${apt.id}" data-patient-id="${apt.patientId}">
          <div class="notification-card-header">
            <div class="notification-patient-name">${apt.patientName}</div>
            <div class="notification-date">${dateStr}</div>
          </div>
          <div class="notification-card-body">
            <div class="notification-treatment">${apt.treatment}</div>
            <div class="notification-staff">${staffName}</div>
            <div style="color: var(--gray-500); font-size: 12px;">
              <strong>Time:</strong> ${timeStr}
            </div>
            ${apt.notes ? `<div style="color: var(--gray-600); font-size: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--gray-200);"><strong>Notes:</strong> ${apt.notes}</div>` : ''}
          </div>
          <div class="notification-action-buttons">
            <button class="notification-action-btn add-btn" onclick="handleNotificationClick(${apt.id}, ${apt.patientId})">
              Confirm Appointment
            </button>
            <button class="notification-action-btn edit-btn" onclick="editAppointmentFromNotification(${apt.id}, ${apt.patientId})">
              Edit Appointment
            </button>
            <button class="notification-action-btn cancel-btn" onclick="cancelAppointmentNotification(${apt.id}, ${apt.patientId})">
              Cancel
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Handle notification card click - open appointment modal with auto-filled data
  window.handleNotificationClick = function(appointmentId, patientId) {
    const apt = (appointments || []).find(a => String(a.id) === String(appointmentId));
    if (!apt) return;

    const appointmentDate = new Date(apt.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = appointmentDate.toDateString() === today.toDateString();
    const isPast = appointmentDate < today;

    // If appointment is for today, auto-confirm and record
    if (isToday) {
      confirmAppointment(appointmentId, patientId);
      return;
    }

    // If appointment is in the past, ask for confirmation
    if (isPast) {
      const patient = (patients || []).find(p => String(p.id) === String(patientId));
      const patientName = patient?.name || 'Unknown Patient';
      const confirmMsg = `This appointment is for a past date (${new Date(apt.date).toLocaleDateString()}). Do you still want to confirm it?`;
      if (!confirm(confirmMsg)) {
        return;
      }
    }

    // For future dates, show edit modal so user can confirm before saving
    editAppointmentFromNotification(appointmentId, patientId);
  };

  // Edit appointment from notification
  window.editAppointmentFromNotification = function(appointmentId, patientId) {
    const apt = (appointments || []).find(a => String(a.id) === String(appointmentId));
    if (!apt) return;

    // Set the appointment ID being edited
    appointmentIdBeingEdited = appointmentId;

    // Show the appointment modal
    showAddAppointmentModal(patientId);

    // Update button text and modal title for editing
    setTimeout(() => {
      const submitBtn = document.getElementById('saveAppointmentBtn');
      const btnText = submitBtn?.querySelector(".btn-text");
      const modalTitle = document.querySelector("#addAppointmentModal .modal-header h2");

      if (btnText) btnText.textContent = "Update Appointment";
      if (modalTitle) modalTitle.textContent = "Edit Appointment";

      // Auto-fill the form with appointment data
      const dateInput = document.getElementById('appointmentDate');
      const treatmentSelect = document.getElementById('appointmentTreatment');
      const staffSelect = document.getElementById('appointmentStaff');
      const notesInput = document.getElementById('appointmentNotes');
      const amountInput = document.getElementById('appointmentAmount');

      if (dateInput) dateInput.value = apt.date;
      if (treatmentSelect) treatmentSelect.value = apt.treatment || '';
      if (staffSelect && apt.staff) staffSelect.value = apt.staff;
      if (notesInput) notesInput.value = apt.notes || '';
      if (amountInput && apt.amount) amountInput.value = apt.amount;

      // Trigger change events to update dependent fields
      if (treatmentSelect) {
        treatmentSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Compute totals if amount is set
      if (apt.amount) {
        computeAppointmentTotals();
      }
    }, 300);
  };

  // Confirm appointment from notification (direct recording without modal)
  function confirmAppointment(appointmentId, patientId) {
    const apt = (appointments || []).find(a => String(a.id) === String(appointmentId));
    if (!apt) {
      showToast('Appointment not found', 'error');
      return;
    }

    const patient = (patients || []).find(p => String(p.id) === String(patientId));
    if (!patient) {
      showToast('Patient not found', 'error');
      return;
    }

    // Mark appointment as confirmed
    apt.confirmed = true;
    apt.confirmedAt = new Date().toISOString();

    // Mark notification as resolved so it doesn't appear in upcoming appointments
    markNotificationAsResolved(appointmentId);

    // Save updated appointment
    storage.set('appointments', appointments);

    showToast(`Appointment for ${patient.name} on ${new Date(apt.date).toLocaleDateString()} has been confirmed and recorded.`, 'success');

    // Refresh the display
    renderAppointmentNotifications();

    // Refresh patient details if the modal is open
    if (currentViewPatientId && String(currentViewPatientId) === String(patientId)) {
      setTimeout(() => showPatientDetailsModal(patientId), 100);
    }
  }

  // Export confirmAppointment globally
  window.confirmAppointment = confirmAppointment;

  // Mark notification as resolved
  function markNotificationAsResolved(appointmentId) {
    const resolved = storage.get('resolvedAppointmentNotifications') || [];
    if (!resolved.includes(String(appointmentId))) {
      resolved.push(String(appointmentId));
      storage.set('resolvedAppointmentNotifications', resolved);
    }
    renderAppointmentNotifications();
  }

  // Cancel appointment notification
  window.cancelAppointmentNotification = function(appointmentId, patientId) {
    const apt = (appointments || []).find(a => String(a.id) === String(appointmentId));
    if (!apt) {
      showToast('Appointment not found', 'error');
      return;
    }

    const patient = (patients || []).find(p => String(p.id) === String(patientId));
    const patientName = patient?.name || 'Unknown Patient';

    // Confirm cancellation
    const confirmMsg = `Are you sure you want to cancel the appointment for ${patientName}?`;
    if (confirm(confirmMsg)) {
      // Remove from appointments array
      const index = appointments.findIndex(a => String(a.id) === String(appointmentId));
      if (index > -1) {
        appointments.splice(index, 1);
        // Update global reference
        window.appointments = appointments;

        // Save to storage
        storage.set('appointments', appointments);

        // Mark as resolved to remove from notifications
        markNotificationAsResolved(appointmentId);

        showToast(`Appointment cancelled for ${patientName}`, 'success');
      }
    }
  };

  // Clear resolved notification when user opens appointment modal
  function clearResolvedNotificationForAppointment(appointmentId) {
    const resolved = storage.get('resolvedAppointmentNotifications') || [];
    const filtered = resolved.filter(id => String(id) !== String(appointmentId));
    storage.set('resolvedAppointmentNotifications', filtered);
  }

  // Toggle notifications list collapse
  function setupNotificationToggle() {
    const toggle = document.getElementById('appointmentNotificationsToggle');
    const list = document.getElementById('appointmentNotificationsList');

    if (toggle && list) {
      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        list.classList.toggle('collapsed');
        toggle.style.transform = list.classList.contains('collapsed') ? 'rotate(180deg)' : 'rotate(0deg)';
      });
    }
  }

  // Initialize appointment notifications on page load
  function initializeAppointmentNotifications() {
    renderAppointmentNotifications();
    setupNotificationToggle();
  }

  // ========================================
  // APPOINTMENT REMINDERS
  // ========================================

  // Set appointment reminder for a specific date/time
  function setAppointmentReminder(appointmentId, reminderDateTime) {
    const reminders = storage.get('appointmentReminders') || {};

    reminders[String(appointmentId)] = {
      appointmentId: appointmentId,
      reminderTime: reminderDateTime instanceof Date ? reminderDateTime.toISOString() : reminderDateTime,
      createdAt: new Date().toISOString(),
      sent: false,
      sentAt: null
    };

    storage.set('appointmentReminders', reminders);
  }

  // Get reminders due for sending
  function getRemindersToSend() {
    const reminders = storage.get('appointmentReminders') || {};
    const now = new Date();
    const remindersDue = [];

    Object.values(reminders).forEach(reminder => {
      if (!reminder.sent) {
        const apt = (appointments || []).find(a => String(a.id) === String(reminder.appointmentId));
        if (apt) {
          const reminderTime = new Date(reminder.reminderTime);

          // Send reminder if current time is within 1 minute of scheduled reminder time
          const timeDiff = Math.abs(now - reminderTime);
          if (timeDiff < 60000) { // Within 1 minute
            remindersDue.push({
              ...reminder,
              appointment: apt
            });
          }
        }
      }
    });

    return remindersDue;
  }

  // Send appointment reminder
  function sendAppointmentReminder(appointmentId) {
    const reminders = storage.get('appointmentReminders') || {};

    if (reminders[String(appointmentId)]) {
      const reminder = reminders[String(appointmentId)];
      const apt = (appointments || []).find(a => String(a.id) === String(appointmentId));
      const patient = (patients || []).find(p => String(p.id) === String(apt?.patientId));

      if (apt && patient) {
        const appointmentDate = new Date(apt.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        // Show notification
        const message = `Reminder: ${patient.name} has an appointment on ${appointmentDate}`;
        showToast(message, 'info');

        // Mark reminder as sent
        reminder.sent = true;
        reminder.sentAt = new Date().toISOString();
        storage.set('appointmentReminders', reminders);

        console.log(`✅ Appointment reminder sent for ${patient.name}`);
      }
    }
  }

  // Check and send due reminders (call periodically)
  function checkAndSendReminders() {
    const remindersDue = getRemindersToSend();
    remindersDue.forEach(reminder => {
      sendAppointmentReminder(reminder.appointmentId);
    });
  }

  // ========================================
  // RECEIPT GENERATION & PRINTING
  // ========================================

  // Get clinic information
  function getClinicInfo() {
    return {
      name: localStorage.getItem('clinicName') || 'Ink and Arch',
      contact: localStorage.getItem('clinicContact') || '',
      email: localStorage.getItem('clinicEmail') || '',
      address: localStorage.getItem('clinicAddress') || ''
    };
  }

  // Store receipt in history
  function storeReceipt(appointmentId, patientId, receiptData) {
    const receipts = storage.get('receiptHistory') || {};
    receipts[String(appointmentId)] = {
      appointmentId: appointmentId,
      patientId: patientId,
      generatedAt: new Date().toISOString(),
      data: receiptData
    };
    storage.set('receiptHistory', receipts);
  }

  // Generate receipt for an appointment
  window.generateReceipt = function(appointmentId, patientId) {
    const apt = (appointments || []).find(a => String(a.id) === String(appointmentId));
    const patient = (patients || []).find(p => String(p.id) === String(patientId));

    if (!apt || !patient) {
      showToast('Could not generate receipt - missing appointment or patient data', 'error');
      return;
    }

    // Format dates
    const appointmentDate = new Date(apt.date);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Get clinic info from settings or use defaults
    const clinic = getClinicInfo();
    const clinicName = clinic.name;
    const clinicContact = clinic.contact;

    // Prepare payment details
    const totalAmount = apt.total_after_discount || apt.amount || 0;
    const downPayment = apt.down_payment || 0;
    const cashPayment = apt.cash_payment || 0;
    const bankTransfer = apt.bank_transfer || 0;
    const totalPaid = downPayment + cashPayment + bankTransfer;
    const balanceRemaining = Math.max(0, totalAmount - totalPaid);

    // Get payment method
    const getPaymentMethodDisplay = () => {
      if (downPayment > 0 && cashPayment === 0 && bankTransfer === 0) {
        return 'Down Payment';
      }
      if (cashPayment > 0 && downPayment === 0 && bankTransfer === 0) {
        return 'Cash';
      }
      if (bankTransfer > 0 && downPayment === 0 && cashPayment === 0) {
        return 'Bank Transfer / E-wallet';
      }
      if (totalPaid > 0) {
        const methods = [];
        if (downPayment > 0) methods.push('Down Payment');
        if (cashPayment > 0) methods.push('Cash');
        if (bankTransfer > 0) methods.push('Bank Transfer / E-wallet');
        return methods.join(', ');
      }
      return 'Not Paid';
    };

    // Generate receipt HTML
    const receiptHTML = `
      <div class="receipt-header">
        <div class="receipt-clinic-name">${escapeHtml(clinicName)}</div>
        <div class="receipt-clinic-contact">${escapeHtml(clinicContact)}</div>
        <div class="receipt-clinic-contact">Receipt</div>
      </div>

      <div class="receipt-title">Patient Information</div>
      <div class="receipt-line">
        <span class="receipt-label">Name:</span>
        <span class="receipt-value">${escapeHtml(patient.name || 'N/A')}</span>
      </div>
      <div class="receipt-line">
        <span class="receipt-label">Contact:</span>
        <span class="receipt-value">${escapeHtml(patient.mobile || 'N/A')}</span>
      </div>
      <div class="receipt-line">
        <span class="receipt-label">Email:</span>
        <span class="receipt-value">${escapeHtml(patient.email || 'N/A')}</span>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-title">Appointment Details</div>
      <div class="receipt-line">
        <span class="receipt-label">Date:</span>
        <span class="receipt-value">${formattedDate}</span>
      </div>
      <div class="receipt-line">
        <span class="receipt-label">Treatment:</span>
        <span class="receipt-value">${escapeHtml(apt.treatment || 'N/A')}</span>
      </div>
      <div class="receipt-line">
        <span class="receipt-label">Staff:</span>
        <span class="receipt-value">${escapeHtml(apt.staff || 'Not assigned')}</span>
      </div>
      ${apt.notes ? `<div class="receipt-line">
        <span class="receipt-label">Notes:</span>
        <span class="receipt-value">${escapeHtml(apt.notes)}</span>
      </div>` : ''}

      <div class="receipt-divider"></div>

      <div class="receipt-title">Payment Summary</div>
      <div class="receipt-total-line">
        <span class="receipt-label">Total Amount:</span>
        <span class="receipt-value">${formatCurrency(totalAmount)}</span>
      </div>

      ${downPayment > 0 ? `<div class="receipt-line">
        <span class="receipt-label">Down Payment:</span>
        <span class="receipt-value">${formatCurrency(downPayment)}</span>
      </div>` : ''}

      ${cashPayment > 0 ? `<div class="receipt-line">
        <span class="receipt-label">Cash Payment:</span>
        <span class="receipt-value">${formatCurrency(cashPayment)}</span>
      </div>` : ''}

      ${bankTransfer > 0 ? `<div class="receipt-line">
        <span class="receipt-label">Bank/E-wallet:</span>
        <span class="receipt-value">${formatCurrency(bankTransfer)}</span>
      </div>` : ''}

      ${totalPaid > 0 ? `<div class="receipt-total-line" style="margin-top: 10px; border-top: 1px dashed var(--gray-900); padding-top: 10px;">
        <span class="receipt-label">Total Paid:</span>
        <span class="receipt-value">${formatCurrency(totalPaid)}</span>
      </div>` : ''}

      ${balanceRemaining > 0 ? `<div class="receipt-line" style="color: #d32f2f; font-weight: bold;">
        <span class="receipt-label">Balance Due:</span>
        <span class="receipt-value">${formatCurrency(balanceRemaining)}</span>
      </div>` : ''}

      ${totalPaid > 0 ? `<div class="receipt-payment-method">
        <strong>Payment Method:</strong> ${getPaymentMethodDisplay()}
      </div>` : ''}

      ${apt.payment_reference ? `<div class="receipt-ref-number">
        <strong>Reference #:</strong> ${escapeHtml(apt.payment_reference)}
      </div>` : ''}

      <div class="receipt-divider"></div>

      <div class="receipt-footer">
        <div>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        <div>Receipt #${appointmentId}</div>
        <div style="margin-top: 10px;">Thank you for your business!</div>
      </div>
    `;

    // Display receipt in modal
    const modal = document.getElementById('receiptModal');
    const content = document.getElementById('receiptContent');
    if (modal && content) {
      content.innerHTML = receiptHTML;
      modal.style.display = 'flex';

      // Store receipt in history
      storeReceipt(appointmentId, patientId, {
        patientName: patient.name,
        patientMobile: patient.mobile,
        patientEmail: patient.email,
        treatment: apt.treatment,
        staff: apt.staff,
        date: apt.date,
        amount: totalAmount,
        downPayment: downPayment,
        cashPayment: cashPayment,
        bankTransfer: bankTransfer,
        paymentStatus: apt.payment_status,
        referenceNumber: apt.payment_reference
      });
    }
  };

  // Close receipt modal
  window.closeReceiptModal = function() {
    const modal = document.getElementById('receiptModal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  // Print receipt
  window.printReceipt = function() {
    const printWindow = window.open('', 'PRINT', 'height=600,width=800');
    const receiptContent = document.getElementById('receiptContent');

    if (!receiptContent) {
      showToast('Receipt content not found', 'error');
      return;
    }

    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: 'Courier New', monospace;
              background: white;
            }
            .receipt-content {
              width: 80mm;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #ddd;
            }
            .receipt-header, .receipt-title, .receipt-divider, .receipt-footer {
              text-align: center;
              margin-bottom: 15px;
            }
            .receipt-clinic-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .receipt-clinic-contact {
              font-size: 10px;
              margin: 2px 0;
            }
            .receipt-title {
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
              margin-top: 10px;
            }
            .receipt-line, .receipt-total-line {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              margin: 4px 0;
            }
            .receipt-divider {
              border-top: 1px dashed black;
              margin: 15px 0;
              height: 0;
            }
            .receipt-footer {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid black;
              font-size: 10px;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .receipt-content {
                border: none;
                width: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-content">
            ${receiptContent.innerHTML}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.print();
  };

  // Download receipt as PDF
  window.downloadReceiptPDF = function() {
    const receiptContent = document.getElementById('receiptContent');
    if (!receiptContent) {
      showToast('Receipt content not found', 'error');
      return;
    }

    const element = document.createElement('div');
    element.innerHTML = receiptContent.innerHTML;
    element.style.padding = '20px';
    element.style.fontFamily = "'Courier New', monospace";

    const opt = {
      margin: 5,
      filename: `receipt-${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(opt).from(element).save();
    } else {
      showToast('PDF export not available', 'warning');
      printReceipt();
    }
  };

  // Helper function to escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // Consent helpers (global)
  function getGlobalConsents() {
    const globalArr = storage.get('consentFormsGlobal') || [];
    if (globalArr && globalArr.length) return globalArr;
    // Fallback: flatten any per-patient consents as templates
    const legacyMap = storage.get('consentForms') || {};
    const merged = Object.values(legacyMap).flat().map(c => ({ id: c.id, title: c.title, content: c.content }));
    return merged || [];
  }
  function setGlobalConsents(arr) {
    storage.set('consentFormsGlobal', arr);
  }

  // Legacy per-patient consent helpers (kept for compatibility)
  function getConsents(patientId) {
    const map = storage.get('consentForms') || {};
    return map[String(patientId)] || [];
  }
  function setConsents(patientId, arr) {
    const map = storage.get('consentForms') || {};
    map[String(patientId)] = arr;
    storage.set('consentForms', map);
  }

  function renderPatientConsentList(patientId = null) {
    const listEl = document.getElementById('patientConsentList');
    if (!listEl) return;
    const pid = patientId || currentEditPatientId;
    const consents = pid ? getConsents(pid) : tempNewPatientConsents;
    if (!consents || consents.length === 0) {
      listEl.innerHTML = '<div class="no-items-text">No consent forms yet</div>';
      return;
    }
    listEl.innerHTML = consents.map(c => `
      <div class="consent-item">
        <div class="consent-title">${c.title}</div>
        <div class="consent-actions">
          <button type="button" class="btn btn-secondary" data-action="edit" data-id="${c.id}">Edit</button>
          <button type="button" class="btn btn-danger" data-action="delete" data-id="${c.id}">Delete</button>
        </div>
      </div>`).join('');
    listEl.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const arr = pid ? getConsents(pid) : tempNewPatientConsents;
      const found = arr.find(c => String(c.id) === String(id));
      if (!found) return;
      if (action === 'edit') {
        editingConsentId = found.id;
        document.getElementById('consentTitleInput').value = found.title;
        document.getElementById('consentContentInput').value = found.content;
        document.getElementById('addConsentBtn').classList.add('hidden');
        document.getElementById('updateConsentBtn').classList.remove('hidden');
        document.getElementById('cancelConsentEditBtn').classList.remove('hidden');
      } else if (action === 'delete') {
        const next = arr.filter(c => String(c.id) !== String(id));
        if (pid) setConsents(pid, next); else tempNewPatientConsents = next;
        renderPatientConsentList(pid);
      }
    };
  }
  function resetPatientConsentEditor() {
    editingConsentId = null;
    const t = document.getElementById('consentTitleInput');
    const c = document.getElementById('consentContentInput');
    if (t) t.value = '';
    if (c) c.value = '';
    document.getElementById('addConsentBtn')?.classList.remove('hidden');
    document.getElementById('updateConsentBtn')?.classList.add('hidden');
    document.getElementById('cancelConsentEditBtn')?.classList.add('hidden');
  }
  function savePatientConsent(isUpdate = false) {
    const title = (document.getElementById('consentTitleInput')?.value || '').trim();
    const content = (document.getElementById('consentContentInput')?.value || '').trim();
    if (!title || !content) { showToast('Enter consent title and content', 'warning'); return; }
    const pid = currentEditPatientId || null;
    const arr = pid ? getConsents(pid) : tempNewPatientConsents;
    if (isUpdate && editingConsentId) {
      const idx = arr.findIndex(c => String(c.id) === String(editingConsentId));
      if (idx !== -1) arr[idx] = { ...arr[idx], title, content, updatedAt: new Date().toISOString() };
    } else {
      arr.push({ id: Date.now(), title, content, updatedAt: new Date().toISOString() });
    }
    if (pid) setConsents(pid, arr); else tempNewPatientConsents = arr;
    resetPatientConsentEditor();
    renderPatientConsentList(pid);
  }

  // Remove inline appointment consent editor; consents are managed via global modal

  // Manage Consents modal functions
  function showManageConsentsModal() {
    renderGlobalConsentsList();
    showModal('#manageConsentsModal');
  }
  function hideManageConsentsModal() { hideModal('#manageConsentsModal'); renderConsentCheckboxes('patient'); renderConsentCheckboxes('appointment'); }
  function renderGlobalConsentsList() {
    const list = document.getElementById('consentsList');
    if (!list) return;
    const consents = getGlobalConsents();
    if (consents.length === 0) {
      list.innerHTML = '<li class="no-items-text">No consent forms yet</li>';
      // If editing but list empty, reset editor
      if (globalConsentEditingId) resetGlobalConsentEditor();
      return;
    }
    list.innerHTML = consents.map(c => `
      <li>
        <div class="title">${c.title}</div>
        <div class="actions">
          <button class="btn btn-secondary" data-action="edit" data-id="${c.id}">Edit</button>
          <button class="btn btn-danger" data-action="delete" data-id="${c.id}">Delete</button>
        </div>
      </li>`).join('');

    // If current editing id no longer exists, reset editor
    if (globalConsentEditingId && !consents.some(c => String(c.id) === String(globalConsentEditingId))) {
      resetGlobalConsentEditor();
    }

    list.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const consentsArr = getGlobalConsents();
      const found = consentsArr.find(c => String(c.id) === String(id));
      if (!found) { resetGlobalConsentEditor(); return; }
      if (action === 'edit') {
        globalConsentEditingId = found.id;
        document.getElementById('consentTitleGlobal').value = found.title;
        document.getElementById('consentContentGlobal').value = found.content;
        document.getElementById('addConsentGlobalBtn').classList.add('hidden');
        document.getElementById('updateConsentGlobalBtn').classList.remove('hidden');
        document.getElementById('cancelConsentGlobalEditBtn').classList.remove('hidden');
      } else if (action === 'delete') {
        const next = consentsArr.filter(c => String(c.id) !== String(id));
        setGlobalConsents(next);
        // If deleting the one being edited, reset editor
        if (String(globalConsentEditingId) === String(id)) resetGlobalConsentEditor();
        renderGlobalConsentsList();
        // Update checkboxes in other modals
        renderConsentCheckboxes('patient');
        renderConsentCheckboxes('appointment');
      }
    };
  }
  function resetGlobalConsentEditor() {
    globalConsentEditingId = null;
    document.getElementById('consentTitleGlobal').value = '';
    document.getElementById('consentContentGlobal').value = '';
    document.getElementById('addConsentGlobalBtn').classList.remove('hidden');
    document.getElementById('updateConsentGlobalBtn').classList.add('hidden');
    document.getElementById('cancelConsentGlobalEditBtn').classList.add('hidden');
  }
  function saveGlobalConsent(isUpdate = false) {
    const title = (document.getElementById('consentTitleGlobal')?.value || '').trim();
    const content = (document.getElementById('consentContentGlobal')?.value || '').trim();
    if (!title || !content) { showToast('Enter consent title and content', 'warning'); return; }
    const arr = getGlobalConsents();
    if (isUpdate && globalConsentEditingId) {
      const idx = arr.findIndex(c => String(c.id) === String(globalConsentEditingId));
      if (idx !== -1) arr[idx] = { ...arr[idx], title, content, updatedAt: new Date().toISOString() };
    } else {
      arr.push({ id: Date.now(), title, content, updatedAt: new Date().toISOString() });
    }
    setGlobalConsents(arr);
    resetGlobalConsentEditor();
    renderGlobalConsentsList();
    // Update checkboxes in Add Patient and Add Appointment
    renderConsentCheckboxes('patient');
    renderConsentCheckboxes('appointment');
  }

  // Render global consent checkboxes into target containers
  function renderConsentCheckboxes(scope) {
    const targetId = scope === 'appointment' ? 'appointmentConsentCheckboxes' : 'patientConsentCheckboxes';
    const container = document.getElementById(targetId);
    if (!container) return;
    const consents = getGlobalConsents();
    if (!consents || consents.length === 0) {
      container.innerHTML = '<div class="no-items-text">No consent forms available. Use Manage Consents.</div>';
      return;
    }
    container.innerHTML = consents.map(c => {
      const group = `consent_${scope}_${c.id}`;
      const placeholder = c.content || 'Please describe...';
      return `
        <div class="consent-item-block">
          <label class="form-label">${c.title}</label>
          ${c.content ? `<div class="consent-helper">${c.content}</div>` : ''}
          <div class="radio-group" role="radiogroup" aria-label="${c.title}">
            <label class="radio-option"><input type="radio" name="${group}" value="no" checked /><span>No</span></label>
            <label class="radio-option"><input type="radio" name="${group}" value="yes" /><span>Yes</span></label>
          </div>
          <div class="consent-remark" id="remark_${group}" style="display:none;">
            <textarea class="form-textarea" rows="2" placeholder="${placeholder}"></textarea>
          </div>
        </div>`;
    }).join('');

    // Toggle remarks on change (delegated, overwrite handler to avoid duplicates)
    container.onchange = function (e) {
      const t = e.target;
      if (t && t.name && t.name.startsWith(`consent_${scope}_`)) {
        const remark = document.getElementById(`remark_${t.name}`);
        if (remark) remark.style.display = (t.value === 'yes') ? 'block' : 'none';
      }
    };
  }

  function getComprehensiveData(patient) {
    if (!patient) return {};
    const comp = patient.comprehensive_data || patient.comprehensiveData || {};
    // Fallback merge from top-level fields for newly-created records
    const fields = ['hasAllergies', 'allergiesSpecify', 'takingMedication', 'medicationSpecify', 'hasSkinConditions', 'skinConditionsSpecify', 'hadSurgeries', 'surgeriesSpecify', 'isPregnant', 'smokes', 'currentSkincare', 'usedNewProducts', 'newProductsSpecify', 'hadAdverseReactions', 'adverseReactionsSpecify'];
    const merged = { ...comp };
    fields.forEach(f => { if (patient[f] !== undefined && merged[f] === undefined) merged[f] = patient[f]; });
    return merged;
  }

  function renderApplicableInfoChips() {
    const chipsEl = document.getElementById('applicableInfoChips');
    if (!chipsEl) return;
    const patient = patients.find(p => String(p.id) === String(currentViewPatientId));
    const comp = getComprehensiveData(patient);
    const chips = [];
    if (comp.currentSkincare && comp.currentSkincare.trim()) chips.push('Has skincare routine');
    if (comp.hasAllergies === 'yes') chips.push(`Allergies${comp.allergiesSpecify ? ': ' + comp.allergiesSpecify : ''}`);
    if (comp.takingMedication === 'yes') chips.push(`Medication${comp.medicationSpecify ? ': ' + comp.medicationSpecify : ''}`);
    if (comp.hasSkinConditions === 'yes') chips.push(`Skin conditions${comp.skinConditionsSpecify ? ': ' + comp.skinConditionsSpecify : ''}`);
    if (comp.hadSurgeries === 'yes') chips.push(`Surgeries${comp.surgeriesSpecify ? ': ' + comp.surgeriesSpecify : ''}`);
    if (comp.usedNewProducts === 'yes') chips.push(`Used new products${comp.newProductsSpecify ? ': ' + comp.newProductsSpecify : ''}`);
    if (comp.hadAdverseReactions === 'yes') chips.push(`Adverse reactions${comp.adverseReactionsSpecify ? ': ' + comp.adverseReactionsSpecify : ''}`);
    chipsEl.innerHTML = chips.length ? chips.map(t => `<span class=\"consent-chip\">${t}</span>`).join('') : '<div class="no-items-text">No applicable info</div>';
  }

  window.openTreatmentCards = function (id) {
    try {
      const pid = String(id);
      const allCards = (typeof getTreatmentCards === 'function' ? getTreatmentCards() : {}) || {};
      const patientCards = allCards[pid] || [];

      if (patientCards.length === 0) {
        if (typeof showToast === 'function') showToast('No treatment card available for this patient', 'info');
        return;
      }

      if (patientCards.length === 1) {
        openTreatmentCardForPatient(id, patientCards[0].id);
        return;
      }

      const modalId = 'treatmentSelectModal';
      const existing = document.getElementById(modalId);
      if (existing) existing.remove();

      const optionsHTML = patientCards.map(card => {
        const filled = (card.entries || []).filter(Boolean).length;
        const total = card.slots;
        const createdDate = new Date(card.createdAt).toLocaleDateString('en-US');
        return `
          <div class="appointment-item" style="cursor:pointer" onclick="openTreatmentCardForPatient(${id}, '${card.id}')">
            <div class="appointment-header">
              <div class="appointment-treatment">${card.treatment}</div>
              <div class="appointment-amount">${filled}/${total} sessions</div>
            </div>
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">Created: ${createdDate}</div>
          </div>
        `;
      }).join('');

      const modalHTML = `
        <div class="modal" id="${modalId}" style="display:flex;">
          <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header">
              <h2>Select Treatment Card</h2>
              <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="appointments-list">${optionsHTML}</div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Close</button>
            </div>
          </div>
        </div>`;

      document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (e) {
      console.error('Error opening treatment cards:', e);
      if (typeof showToast === 'function') showToast('Unable to open treatment cards', 'error');
    }
  };

  window.goToPage = function (page) {
    currentPage = page;
    renderPatientsTable();
    updatePagination();
  };

  async function confirmDelete() {
    const id = window.patientToDelete;
    if (!id) {
      showToast('No patient selected for deletion', 'warning');
      hideDeleteModal();
      return;
    }

    // Find patient data before archiving
    const patientToArchive = patients.find(p => String(p.id) === String(id));
    if (!patientToArchive) {
      showToast('Patient not found', 'warning');
      hideDeleteModal();
      return;
    }

    try {
      // Call API endpoint to soft-delete patient (mark as archived)
      const response = await fetch(`/api/patients/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to archive patient');
      }

      // Get archive settings for retention period
      const settings = getArchiveSettings();
      const expiryDate = calculateArchiveExpiryDate(settings.retentionDays);

      // Move patient to archive instead of hard delete (soft-delete)
      const archives = getPatientArchives();
      const key = String(id);
      archives[key] = archives[key] || [];
      archives[key].push({
        archivedAt: new Date().toISOString(),
        name: patientToArchive.name,
        expiryDate: expiryDate.toISOString(),
        reason: 'Manually deleted by user'
      });
      setPatientArchives(archives);

      // NOTE: We keep appointments and records - they are NOT deleted
      // Only remove patient from active list
      patients = patients.filter(p => String(p.id) !== String(id));
      window.patients = patients;

      // Remove any locally stored treatment cards for this patient
      try {
        const cards = storage.get('treatmentCards') || {};
        const pid = String(id);
        if (cards[pid]) {
          delete cards[pid];
          storage.set('treatmentCards', cards);
        }
      } catch { }

      // Log patient archival
      if (window.auditLogger && patientToArchive) {
        await window.auditLogger.logPatient('archive', {
          id: patientToArchive.id,
          name: patientToArchive.name,
          ...patientToArchive
        }, {
          reason: 'Patient archived (soft-deleted)',
          expiryDate: expiryDate.toISOString(),
          retentionDays: settings.retentionDays
        }).catch(e => console.warn('Audit logging failed:', e));
      }

      // Persist local backup
      storage.set('patients', patients);
      // NOTE: Appointments are kept for records

      applyFilters();
      showToast(`Patient archived successfully. Will be permanently deleted on ${formatDate(expiryDate)}.`, 'success');
      hideDeleteModal();
    } catch (error) {
      console.error('Error archiving patient:', error);
      showToast('Error archiving patient: ' + error.message, 'error');
    }
  }

  function hideDeleteModal() {
    hideModal("#deleteModal");
    window.patientToDelete = null;
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Escape key to close modals
    if (e.key === "Escape") {
      hideAddPatientModal();
      hideAddAppointmentModal();
      hidePatientDetailsModal();
      hideDeleteModal();
    }

    // Ctrl/Cmd + N to add new patient
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      showAddPatientModal();
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

// Helper function for conditional field setup
function setupConditionalField(radioName, rowId, inputId) {
  const radioButtons = document.querySelectorAll(`input[name="${radioName}"]`);
  const targetRow = $(`#${rowId}`);
  const targetInput = $(`#${inputId}`);

  radioButtons.forEach(radio => {
    radio.addEventListener("change", function () {
      if (this.value === "yes") {
        if (targetRow) targetRow.style.display = "block";
        if (targetInput) targetInput.required = true;
      } else {
        if (targetRow) targetRow.style.display = "none";
        if (targetInput) {
          targetInput.required = false;
          targetInput.value = "";
        }
      }
    });
  });
}

// Print/Export functionality
function handlePrintExport() {
  const formData = collectFormData();
  if (!formData) {
    showToast("Please fill in the required fields first", "warning");
    return;
  }

  // Create printable HTML
  const printContent = generatePrintableHTML(formData);

  // Open print window
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = function () {
    printWindow.print();
  };
}

// Collect form data
function collectFormData() {
  const form = $("#patientForm");
  if (!form) return null;

  const formData = new FormData(form);
  const data = {};

  // Basic fields
  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }

  // Collect title field
  const titleSelect = document.getElementById('title');
  if (titleSelect) {
    data.title = titleSelect.value;
  }

  // Collect multiple phone numbers
  const phoneInputs = document.querySelectorAll('#phoneNumbersContainer .phone-number-field');
  data.phoneNumbers = [];
  phoneInputs.forEach(input => {
    const number = input.value.trim();
    if (number && number.match(/^\d{11}$/)) {
      data.phoneNumbers.push(number);
    }
  });

  // Use first phone number as primary contactNumber if not already set
  if (data.phoneNumbers.length > 0 && !data.contactNumber) {
    data.contactNumber = data.phoneNumbers[0];
  }

  // Collect emergency contact phone numbers
  const emergencyPhoneInputs = document.querySelectorAll('#emergencyPhoneNumbersContainer .emergency-phone-field');
  data.emergencyPhoneNumbers = [];
  emergencyPhoneInputs.forEach(input => {
    const number = input.value.trim();
    if (number && number.match(/^\d{11}$/)) {
      data.emergencyPhoneNumbers.push(number);
    }
  });

  // Use first emergency phone number as primary if not already set
  if (data.emergencyPhoneNumbers.length > 0 && !data.emergencyContactNumber) {
    data.emergencyContactNumber = data.emergencyPhoneNumbers[0];
  }

  // Radio button fields
  const radioFields = ['hasAllergies', 'takingMedication', 'hasSkinConditions', 'hadSurgeries', 'isPregnant', 'smokes', 'usedNewProducts', 'hadAdverseReactions', 'paymentStatus', 'paymentMethod'];
  radioFields.forEach(field => {
    const checked = document.querySelector(`input[name="${field}"]:checked`);
    if (checked) {
      data[field] = checked.value;
    }
  });

  return data;
}

// Generate printable HTML
function generatePrintableHTML(data) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Guest Information Sheet - ${data.firstName} ${data.lastName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.4; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .header h1 { color: #2563eb; margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 16px; font-weight: bold; color: #2563eb; margin-bottom: 10px; border-left: 4px solid #2563eb; padding-left: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
          .info-item { margin-bottom: 8px; }
          .label { font-weight: bold; color: #555; }
          .value { margin-left: 10px; }
          .full-width { grid-column: 1 / -1; }
          @media print { body { margin: 0; font-size: 12px; } .section { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Guest Information Sheet</h1>
          <p>Ink and Arch Medical Clinic</p>
          <p>Date: ${currentDate}</p>
        </div>

        <div class="section">
          <div class="section-title">Guest Information</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">Name:</span><span class="value">${data.lastName}, ${data.firstName} ${data.middleName || ''}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Personal Details</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">Date of Birth:</span><span class="value">${data.dateOfBirth || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Age:</span><span class="value">${data.age || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Gender:</span><span class="value">${data.gender === 'other' ? data.otherGender : data.gender || 'Not provided'}</span></div>
            <div class="info-item full-width"><span class="label">Address:</span><span class="value">${data.address || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">City:</span><span class="value">${data.city || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">State/Province:</span><span class="value">${data.state || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">ZIP Code:</span><span class="value">${data.zipCode || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Contact Number:</span><span class="value">${data.contactNumber || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Email:</span><span class="value">${data.email || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Occupation:</span><span class="value">${data.occupation || 'Not provided'}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Emergency Contact</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">Name:</span><span class="value">${data.emergencyContactName || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Relationship:</span><span class="value">${data.emergencyRelationship || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Contact Number:</span><span class="value">${data.emergencyContactNumber || 'Not provided'}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Medical History</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">Allergies:</span><span class="value">${data.hasAllergies === 'yes' ? 'Yes - ' + (data.allergiesSpecify || 'Not specified') : 'No'}</span></div>
            <div class="info-item"><span class="label">Current Medication:</span><span class="value">${data.takingMedication === 'yes' ? 'Yes - ' + (data.medicationSpecify || 'Not specified') : 'No'}</span></div>
            <div class="info-item"><span class="label">Skin Conditions:</span><span class="value">${data.hasSkinConditions === 'yes' ? 'Yes - ' + (data.skinConditionsSpecify || 'Not specified') : 'No'}</span></div>
            <div class="info-item"><span class="label">Previous Surgeries:</span><span class="value">${data.hadSurgeries === 'yes' ? 'Yes - ' + (data.surgeriesSpecify || 'Not specified') : 'No'}</span></div>
            <div class="info-item"><span class="label">Pregnant:</span><span class="value">${data.isPregnant === 'yes' ? 'Yes' : 'No'}</span></div>
            <div class="info-item"><span class="label">Smokes:</span><span class="value">${data.smokes === 'yes' ? 'Yes' : 'No'}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Skin Care Routine</div>
          <div class="info-grid">
            <div class="info-item full-width"><span class="label">Current Routine:</span><span class="value">${data.currentSkincare || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">New Products (6 months):</span><span class="value">${data.usedNewProducts === 'yes' ? 'Yes - ' + (data.newProductsSpecify || 'Not specified') : 'No'}</span></div>
            <div class="info-item"><span class="label">Adverse Reactions:</span><span class="value">${data.hadAdverseReactions === 'yes' ? 'Yes - ' + (data.adverseReactionsSpecify || 'Not specified') : 'No'}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Treatment & Payment Information</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">Staff/Employee:</span><span class="value">${getStaffName(data.staffEmployee) || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Treatment Date:</span><span class="value">${data.treatmentDate || 'Not provided'}</span></div>
            <div class="info-item"><span class="label">Total Sales:</span><span class="value">����${parseFloat(data.totalSales || 0).toLocaleString()}</span></div>
            <div class="info-item"><span class="label">Discount Type:</span><span class="value">${data.paymentDiscountType ? (data.paymentDiscountType === 'percent' ? 'Percent (%)' : 'Amount (₱)') : 'None'}</span></div>
            <div class="info-item"><span class="label">Discount:</span><span class="value">₱${parseFloat(data.paymentDiscount || 0).toLocaleString()}</span></div>
            <div class="info-item"><span class="label">Total After Discount:</span><span class="value">₱${parseFloat(data.paymentTotalAfterDiscount || data.totalSales || 0).toLocaleString()}</span></div>
            <div class="info-item"><span class="label">Payment Status:</span><span class="value">${data.paymentStatus === 'full' ? 'Paid in Full' : 'Partial Payment'}</span></div>
            <div class="info-item"><span class="label">Down Payment:</span><span class="value">₱${parseFloat(data.downPayment || 0).toLocaleString()}</span></div>
            <div class="info-item"><span class="label">Cash Payment:</span><span class="value">��${parseFloat(data.cashPayment || 0).toLocaleString()}</span></div>
            <div class="info-item"><span class="label">Bank/E-wallet/Credit:</span><span class="value">₱${parseFloat((data.bankTransferEWalletCredit || data.bankTransferGcashCredit || 0)).toLocaleString()}</span></div>
            <div class="info-item"><span class="label">Expenses:</span><span class="value">₱${parseFloat(data.expenses || 0).toLocaleString()}</span></div>
            <div class="info-item"><span class="label">Payment Method:</span><span class="value">${formatPaymentMethod(data.paymentMethod)}</span></div>
          </div>
        </div>

        <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 11px; color: #666;">
          <p><strong>Patient Signature:</strong> _________________________________ <strong>Date:</strong> _____________</p>
          <p><strong>Staff Signature:</strong> _________________________________ <strong>Date:</strong> _____________</p>
        </div>
      </body>
      </html>
    `;
}

// Helper function to get staff name by ID
function getStaffName(staffId) {
  if (!staffId) return 'Not specified';

  const employees = storage.get("employees") || [];
  const staff = employees.find(emp => emp.id === staffId);
  return staff ? staff.name : 'Unknown Staff';
}

// Helper function to format payment method
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

// Payment settlement for partial appointments
function showSettlePaymentModal(appointmentId) {
  const list = (window.appointments || storage.get('appointments') || []);
  const appt = list.find(a => String(a.id) === String(appointmentId));
  if (!appt) { showToast('Appointment not found', 'error'); return; }

  const paid = (appt.down_payment || appt.downPayment || 0) + (appt.cash_payment || appt.cashPayment || 0) + (appt.bank_transfer || appt.bankTransfer || 0);
  const total = appt.total_after_discount || appt.amount || 0;
  const remaining = Math.max(0, total - paid);
  if (remaining <= 0) { showToast('No remaining balance', 'info'); return; }

  const modalId = 'settlePaymentModal';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();
  const today = new Date().toISOString().split('T')[0];

  const html = `
    <div class="modal" id="${modalId}" style="display:flex;">
      <div class="modal-content" style="max-width:480px;">
        <div class="modal-header">
          <h2>Settle Remaining Balance</h2>
          <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Remaining Amount (₱)</label>
            <input type="number" class="form-input no-spinner" value="${remaining.toFixed(2)}" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">Payment Date</label>
            <input type="date" id="settlePaymentDate" class="form-input" value="${today}" />
          </div>
          <div class="form-group">
            <label class="form-label">Payment Method</label>
            <div class="radio-group">
              <label class="radio-option"><input type="radio" name="settleMethod" value="cash" checked /><span>Cash</span></label>
              <label class="radio-option"><input type="radio" name="settleMethod" value="bank_transfer" /><span>Bank Transfer</span></label>
              <label class="radio-option"><input type="radio" name="settleMethod" value="e_wallet" /><span>E-Wallet</span></label>
              <label class="radio-option"><input type="radio" name="settleMethod" value="credit_card" /><span>Credit Card</span></label>
            </div>
            <div class="form-group" id="settleReferenceGroup" style="display:none;">
              <label class="form-label">Reference Number</label>
              <input type="text" id="settleReference" class="form-input" placeholder="Enter reference number" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
          <button type="button" class="btn btn-primary" id="confirmSettleBtn">Settle</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  const toggleSettleRef = () => {
    const method = document.querySelector('input[name="settleMethod"]:checked')?.value || 'cash';
    const show = method !== 'cash';
    const grp = document.getElementById('settleReferenceGroup');
    const inp = document.getElementById('settleReference');
    if (grp) grp.style.display = show ? 'block' : 'none';
    if (inp) inp.required = show;
  };
  document.querySelectorAll('input[name="settleMethod"]').forEach(r => r.addEventListener('change', toggleSettleRef));
  toggleSettleRef();
  document.getElementById('confirmSettleBtn').addEventListener('click', () => {
    const method = document.querySelector('input[name="settleMethod"]:checked')?.value || 'cash';
    const date = document.getElementById('settlePaymentDate')?.value || today;

    if (method === 'cash') {
      appt.cash_payment = (appt.cash_payment || appt.cashPayment || 0) + remaining;
    } else {
      appt.bank_transfer = (appt.bank_transfer || appt.bankTransfer || 0) + remaining;
    }

    const refVal = document.getElementById('settleReference')?.value?.trim();
    appt.payments = Array.isArray(appt.payments) ? appt.payments : [];
    appt.payments.push({ amount: remaining, method, date, ...(method !== 'cash' && refVal ? { reference: refVal } : {}) });
    appt.payment_status = 'full';
    appt.paid_in_full_date = date;
    appt.balance_remaining = 0;
    delete appt.cashPayment; delete appt.bankTransfer; delete appt.downPayment;

    const idx = list.findIndex(a => String(a.id) === String(appt.id));
    if (idx !== -1) list[idx] = appt;
    window.appointments = list;
    storage.set('appointments', list);

    // Update appointment on server
    fetch(`/api/appointments/${appt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_status: appt.payment_status,
        payment_method: appt.payment_method || appt.paymentMethod,
        down_payment: appt.down_payment || appt.downPayment || 0,
        cash_payment: appt.cash_payment || appt.cashPayment || 0,
        bank_transfer: appt.bank_transfer || appt.bankTransfer || 0,
        payment_reference: appt.payment_reference
      })
    }).catch(syncError => {
      console.warn('⚠️ Could not sync payment update to server:', syncError);
    });

    showToast('Payment settled', 'success');
    document.getElementById(modalId).remove();

    // Show receipt after settling payment
    setTimeout(() => {
      generateReceipt(appt.id, appt.patientId);
    }, 300);

    // Refresh patient details modal
    setTimeout(() => {
      showPatientDetailsModal(appt.patientId);
    }, 600);
  });
}

window.settleAppointmentPayment = function (id) {
  showSettlePaymentModal(id);
};

// ===== Treatment Card / Loyalty Modal =====
function getTreatmentCards() {
  return storage.get('treatmentCards') || {};
}

function saveTreatmentCards(data) {
  storage.set('treatmentCards', data);
}

function generateCardId() {
  return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function ensureTreatmentCard(patientId, treatment, slots = 7, forceNew = false) {
  const allCards = getTreatmentCards();
  const pid = String(patientId);
  if (!allCards[pid]) allCards[pid] = [];

  const clamp = (n) => Math.min(8, Math.max(1, parseInt(n, 10) || 7));

  // Always create a new card (forceNew parameter kept for API compatibility)
  const cardId = generateCardId();
  const newCard = {
    id: cardId,
    treatment: treatment,
    slots: clamp(slots),
    entries: Array(clamp(slots)).fill(''),
    createdAt: new Date().toISOString()
  };
  allCards[pid].push(newCard);

  saveTreatmentCards(allCards);
  return newCard;
}

function getCardById(patientId, cardId) {
  const allCards = getTreatmentCards();
  const pid = String(patientId);
  const cardsRaw = allCards[pid];
  const cards = Array.isArray(cardsRaw) ? cardsRaw : (cardsRaw ? (typeof cardsRaw === 'object' ? Object.values(cardsRaw) : []) : []);
  return cards.find(c => c.id === cardId);
}

function renderTreatmentCardsList(patientId) {
  const listEl = document.getElementById('treatmentCardsList');
  if (!listEl) return;
  const pid = String(patientId);
  const allCards = getTreatmentCards();
  const cardsRaw = allCards[pid];
  const cards = Array.isArray(cardsRaw) ? cardsRaw : (cardsRaw ? (typeof cardsRaw === 'object' ? Object.values(cardsRaw) : []) : []);

  if (cards.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>No treatment cards yet.</p></div>';
    return;
  }

  listEl.innerHTML = cards.map(card => {
    const filled = (card.entries || []).filter(Boolean).length;
    const total = card.slots;
    const createdDate = new Date(card.createdAt).toLocaleDateString('en-US');
    return `
      <div class="appointment-item" style="cursor:pointer" onclick="openTreatmentCardForPatient(${patientId}, '${card.id}')">
        <div class="appointment-header">
          <div class="appointment-treatment">${card.treatment}</div>
          <div class="appointment-amount">${filled}/${total} sessions</div>
        </div>
        <div style="font-size:12px; color:#6b7280; margin-top:4px;">Created: ${createdDate}</div>
      </div>
    `;
  }).join('');
}

function showTreatmentCardModal(patientId, cardIdOrTreatment, slots) {
  const patient = (window.patients || storage.get('patients') || []).find(p => String(p.id) === String(patientId));
  if (!patient) { showToast('Patient not found', 'error'); return; }
  const pid = String(patientId);

  let card;

  // If cardIdOrTreatment looks like a card ID (starts with 'card_'), fetch by ID
  if (typeof cardIdOrTreatment === 'string' && cardIdOrTreatment.startsWith('card_')) {
    card = getCardById(patientId, cardIdOrTreatment);
    if (!card) {
      showToast('Treatment card not found', 'error');
      return;
    }
  } else {
    // Otherwise, it's a treatment name - create new card
    const treatment = cardIdOrTreatment;
    if (typeof slots !== 'number') {
      showToast('No treatment card exists for this treatment', 'info');
      return;
    }
    card = ensureTreatmentCard(patientId, treatment, Math.min(8, Math.max(1, slots)), true);
  }

  // Build modal HTML
  const modalId = 'treatmentCardModal';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const circles = Array.from({ length: card.slots }).map((_, i) => {
    const ts = card.entries[i] || '';
    const label = ts ? new Date(ts).toLocaleString('en-US') : '';
    return `
      <div class="loyalty-circle ${ts ? 'filled' : ''}" data-index="${i}">
        ${label ? `<span class="circle-label">${label}</span>` : ''}
      </div>
    `;
  }).join('');

  const apts2 = (window.appointments || storage.get('appointments') || []);
  const lastAptAmount = apts2.filter(a => String(a.patientId) === String(patientId) && a.treatment === card.treatment).slice(-1)[0]?.amount || 0;
  const cardCreatedDate = new Date(card.createdAt).toLocaleDateString('en-US');

  const modalHTML = `
    <div class="modal" id="${modalId}" style="display:flex;">
      <div class="modal-content" style="max-width: 520px;">
        <div class="modal-header">
          <h2>Ink & Arch Loyalty Card</h2>
          <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="loyalty-info">
            <div class="loyalty-row"><span class="loyalty-label">Name:</span><span class="loyalty-value">${patient.name}</span></div>
            <div class="loyalty-row"><span class="loyalty-label">Contact #:</span><span class="loyalty-value">${patient.mobile || patient.contactNumber || 'N/A'}</span></div>
            <div class="loyalty-row"><span class="loyalty-label">Date:</span><span class="loyalty-value">${new Date().toLocaleString('en-US')}</span></div>
            <div class="loyalty-row"><span class="loyalty-label">Amount Paid:</span><span class="loyalty-value">${formatCurrency(lastAptAmount)}</span></div>
          </div>

          <div class="loyalty-grid">${circles}</div>

          <div class="loyalty-procedure">Procedure: <strong>${card.treatment}</strong> (Created: ${cardCreatedDate})</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Close</button>
        </div>
      </div>
      <style>
        .loyalty-info { background:#111; color:#fff; padding:12px; border-radius:8px; }
        .loyalty-row { display:flex; gap:8px; font-size:14px; }
        .loyalty-label { width:110px; display:inline-block; opacity:.9; }
        .loyalty-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:14px; padding:16px 6px; justify-items:center; }
        .loyalty-circle { width:84px; height:84px; border-radius:50%; background:#fff; border:2px solid #e5e7eb; display:flex; align-items:center; justify-content:center; position:relative; cursor:pointer; }
        .loyalty-circle.filled { background:#f3f4f6; border-color:#9ca3af; }
        .circle-label { font-size:10px; color:#111; text-align:center; padding:6px; line-height:1.2; }
        .loyalty-procedure { margin-top:8px; }
        @media (max-width: 480px) { .loyalty-grid { grid-template-columns: repeat(3, 1fr); } .loyalty-circle { width:74px; height:74px; } }
      </style>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Attach circle handlers
  const modalEl = document.getElementById(modalId);
  modalEl.querySelectorAll('.loyalty-circle').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-index'));
      const allCards = getTreatmentCards();
      const patientCards = allCards[pid] || [];
      const currentCard = patientCards.find(c => c.id === card.id);

      if (!currentCard) return;

      const entry = (currentCard.entries || [])[idx];
      if (entry) {
        const confirmClear = confirm('Clear this session timestamp?');
        if (confirmClear) {
          currentCard.entries[idx] = '';
          saveTreatmentCards(allCards);
          el.classList.remove('filled');
          el.innerHTML = '';
          renderTreatmentCardsList(patientId);
        }
      } else {
        const now = new Date().toISOString();
        currentCard.entries[idx] = now;
        saveTreatmentCards(allCards);
        el.classList.add('filled');
        el.innerHTML = `<span class=\"circle-label\">${new Date(now).toLocaleString('en-US')}</span>`;
        renderTreatmentCardsList(patientId);
      }
    });
  });
}

window.openTreatmentCardForPatient = function (id, treatment, slots) {
  showTreatmentCardModal(id, treatment, slots);
};

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
