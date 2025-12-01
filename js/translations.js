// Translation system for multi-language support
const translations = {
  en: {
    // Navigation
    "Dashboard": "Dashboard",
    "Patients": "Patients",
    "Inventory": "Inventory",
    "Employees": "Employees",
    "Time Tracking": "Time Tracking",
    "Records": "Records",
    "Attendance": "Attendance",
    
    // Login page
    "Welcome back": "Welcome back",
    "Please sign in to your account to continue": "Please sign in to your account to continue",
    "Email address": "Email address",
    "Enter your email": "Enter your email",
    "Password": "Password",
    "Enter your password": "Enter your password",
    "Remember me": "Remember me",
    "Sign in": "Sign in",
    "Welcome to": "Welcome to",
    "Professional Time Management System": "Professional Time Management System",
    "Elevating beauty standards with precision and artistry": "Elevating beauty standards with precision and artistry",
    "Instant Clock Management": "Instant Clock Management",
    "Mobile Optimized": "Mobile Optimized",
    "Enterprise Security": "Enterprise Security",
    "Real-time Analytics": "Real-time Analytics",
    
    // Time Tracking
    "Track employee work hours and manage attendance": "Track employee work hours and manage attendance",
    "Employee Time Clock": "Employee Time Clock",
    "Select an employee...": "Select an employee...",
    "QR Scan": "QR Scan",
    "Clock In": "Clock In",
    "Clock Out": "Clock Out",
    "End My Shift": "End My Shift",
    "Today's Activity": "Today's Activity",
    "All Status": "All Status",
    "Present": "Present",
    "Absent": "Absent",
    "Late": "Late",
    "Export": "Export",
    "Active Sessions": "Active Sessions",
    "Recent Clock-ins": "Recent Clock-ins",
    "Last updated": "Last updated",
    "Attendance Overview": "Attendance Overview",
    "View Full Report": "View Full Report",
    "Present Today": "Present Today",
    "Late Arrivals": "Late Arrivals",
    "Avg Hours": "Avg Hours",
    
    // Settings
    "Settings": "Settings",
    "Appearance": "Appearance",
    "Choose between light and dark theme": "Choose between light and dark theme",
    "Dark Mode": "Dark Mode",
    "Light Mode": "Light Mode",
    "Color Palette": "Color Palette",
    "Choose your preferred color scheme": "Choose your preferred color scheme",
    "Default Blue": "Default Blue",
    "Nature Green": "Nature Green",
    "Royal Purple": "Royal Purple",
    "Warm Orange": "Warm Orange",
    "Vibrant Pink": "Vibrant Pink",
    "Ocean Teal": "Ocean Teal",
    "Font Size": "Font Size",
    "Adjust text size for better readability": "Adjust text size for better readability",
    "Small": "Small",
    "Medium": "Medium",
    "Large": "Large",
    "Language": "Language",
    "Select your preferred language": "Select your preferred language",
    "English": "English",
    "Filipino": "Filipino",
    "Database Configuration": "Database Configuration",
    "Configure your database connection and storage options": "Configure your database connection and storage options",
    "Local Database (Default)": "Local Database (Default)",
    "Uses localStorage for offline functionality": "Uses localStorage for offline functionality",
    "MongoDB Atlas": "MongoDB Atlas",
    "Cloud database for production use": "Cloud database for production use",
    "SQLite Local": "SQLite Local",
    "Local file database via Node.js": "Local file database via Node.js",
    "MongoDB Connection String": "MongoDB Connection String",
    "Database Name": "Database Name",
    "Test Connection": "Test Connection",
    "Save Configuration": "Save Configuration",
    "Using Mock Database": "Using Mock Database",
    "Data Synchronization": "Data Synchronization",
    "Manage data sync with cloud storage": "Manage data sync with cloud storage",
    "Checking...": "Checking...",
    "Last sync: Never": "Last sync: Never",
    "Sync Now": "Sync Now",
    "Reset": "Reset",
    "Reset all settings to default values": "Reset all settings to default values",
    "Reset to Defaults": "Reset to Defaults"
  },
  
  fil: {
    // Navigation
    "Dashboard": "Pantalaan",
    "Patients": "Mga Pasyente",
    "Inventory": "Imbentaryo",
    "Employees": "Mga Empleyado",
    "Time Tracking": "Pagsusunod sa Oras",
    "Records": "Mga Rekord",
    "Attendance": "Pagdalo",
    
    // Login page
    "Welcome back": "Maligayang pagbabalik",
    "Please sign in to your account to continue": "Pakimagpasok sa inyong account upang magpatuloy",
    "Email address": "Email address",
    "Enter your email": "Ilagay ang inyong email",
    "Password": "Password",
    "Enter your password": "Ilagay ang inyong password",
    "Remember me": "Tandaan mo ako",
    "Sign in": "Mag-sign in",
    "Welcome to": "Maligayang pagdating sa",
    "Professional Time Management System": "Propesyonal na Sistema ng Pamamahala ng Oras",
    "Elevating beauty standards with precision and artistry": "Pagtataas ng mga pamantayan ng kagandahan na may tumpak at sining",
    "Instant Clock Management": "Agarang Pamamahala ng Orasan",
    "Mobile Optimized": "Mobile na Na-optimize",
    "Enterprise Security": "Seguridad ng Kumpanya",
    "Real-time Analytics": "Real-time na Analytics",
    
    // Time Tracking
    "Track employee work hours and manage attendance": "Subaybayan ang mga oras ng trabaho ng empleyado at pamahalaan ang pagdalo",
    "Employee Time Clock": "Orasan ng Empleyado",
    "Select an employee...": "Pumili ng empleyado...",
    "QR Scan": "QR Scan",
    "Clock In": "Mag-Clock In",
    "Clock Out": "Mag-Clock Out",
    "End My Shift": "Tapusin ang Aking Shift",
    "Today's Activity": "Aktibidad Ngayon",
    "All Status": "Lahat ng Status",
    "Present": "Naroroon",
    "Absent": "Absent",
    "Late": "Nahuli",
    "Export": "I-export",
    "Active Sessions": "Mga Aktibong Session",
    "Recent Clock-ins": "Kamakailang Clock-ins",
    "Last updated": "Huling na-update",
    "Attendance Overview": "Pangkalahatang Tingin sa Pagdalo",
    "View Full Report": "Tingnan ang Buong Ulat",
    "Present Today": "Naroroon Ngayon",
    "Late Arrivals": "Mga Nahuling Pagdating",
    "Avg Hours": "Avg na Oras",
    
    // Settings
    "Settings": "Mga Setting",
    "Appearance": "Hitsura",
    "Choose between light and dark theme": "Pumili sa pagitan ng light at dark theme",
    "Dark Mode": "Dark Mode",
    "Light Mode": "Light Mode",
    "Color Palette": "Color Palette",
    "Choose your preferred color scheme": "Pumili ng inyong nais na color scheme",
    "Default Blue": "Default Blue",
    "Nature Green": "Nature Green",
    "Royal Purple": "Royal Purple",
    "Warm Orange": "Warm Orange",
    "Vibrant Pink": "Vibrant Pink",
    "Ocean Teal": "Ocean Teal",
    "Font Size": "Laki ng Font",
    "Adjust text size for better readability": "I-adjust ang laki ng text para sa mas magandang pagbabasa",
    "Small": "Maliit",
    "Medium": "Katamtaman",
    "Large": "Malaki",
    "Language": "Wika",
    "Select your preferred language": "Piliin ang inyong nais na wika",
    "English": "English",
    "Filipino": "Filipino",
    "Database Configuration": "Database Configuration",
    "Configure your database connection and storage options": "I-configure ang inyong database connection at storage options",
    "Local Database (Default)": "Local Database (Default)",
    "Uses localStorage for offline functionality": "Gumagamit ng localStorage para sa offline functionality",
    "MongoDB Atlas": "MongoDB Atlas",
    "Cloud database for production use": "Cloud database para sa production use",
    "SQLite Local": "SQLite Local",
    "Local file database via Node.js": "Local file database sa pamamagitan ng Node.js",
    "MongoDB Connection String": "MongoDB Connection String",
    "Database Name": "Pangalan ng Database",
    "Test Connection": "Test Connection",
    "Save Configuration": "I-save ang Configuration",
    "Using Mock Database": "Gumagamit ng Mock Database",
    "Data Synchronization": "Data Synchronization",
    "Manage data sync with cloud storage": "Pamahalaan ang data sync sa cloud storage",
    "Checking...": "Tinitingnan...",
    "Last sync: Never": "Huling sync: Hindi pa",
    "Sync Now": "Mag-sync Ngayon",
    "Reset": "I-reset",
    "Reset all settings to default values": "I-reset ang lahat ng settings sa default values",
    "Reset to Defaults": "I-reset sa Defaults"
  }
};

let currentLanguage = "en";

function translateText(key) {
  return translations[currentLanguage][key] || translations["en"][key] || key;
}

function changeLanguage(lang) {
  currentLanguage = lang;
  applyTranslations();
}

function applyTranslations() {
  // Translate all elements with data-translate attribute
  const translatableElements = document.querySelectorAll("[data-translate]");
  translatableElements.forEach(element => {
    const key = element.getAttribute("data-translate");
    const translation = translateText(key);
    
    if (element.tagName === "INPUT" && (element.type === "text" || element.type === "email" || element.type === "password")) {
      element.placeholder = translation;
    } else {
      element.textContent = translation;
    }
  });
  
  // Translate common text content by class or id
  const elementsToTranslate = [
    // Page titles
    { selector: "h1, h2, h3", property: "textContent" },
    // Navigation items
    { selector: ".sidebar-item", property: "textContent" },
    // Buttons
    { selector: "button", property: "textContent" },
    // Labels
    { selector: "label", property: "textContent" },
    // Options
    { selector: "option", property: "textContent" }
  ];
  
  elementsToTranslate.forEach(({ selector, property }) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      const originalText = element.textContent.trim();
      if (originalText && translations[currentLanguage][originalText]) {
        element[property] = translations[currentLanguage][originalText];
      }
    });
  });
}

// Initialize translations when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
  // Load saved language preference
  const savedLanguage = getUserPreference ? getUserPreference("language", "en") : "en";
  if (savedLanguage) {
    currentLanguage = savedLanguage;
    applyTranslations();
  }
});

// Make functions available globally
if (typeof window !== "undefined") {
  window.translateText = translateText;
  window.changeLanguage = changeLanguage;
  window.applyTranslations = applyTranslations;

  // Make currentLanguage accessible via getter/setter
  Object.defineProperty(window, 'currentLanguage', {
    get: function() { return currentLanguage; },
    set: function(value) { currentLanguage = value; }
  });
}
