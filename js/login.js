// Login page functionality
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = $("#loginForm");
  const emailInput = $("#email");
  const passwordInput = $("#password");
  const loginBtn = $("#loginBtn");
  const btnText = loginBtn.querySelector(".btn-text");
  const btnSpinner = loginBtn.querySelector(".btn-spinner");

  let isLoggingIn = false; // Prevent multiple simultaneous login attempts

  // Prevent browser caching by clearing history when on login page
  window.history.pushState({ isLoginPage: true }, null, window.location.href);

  // Add handler for back button on login page
  window.addEventListener('popstate', function (event) {
    // If user tries to go back from login page, stay on login page
    if (event.state?.isLoginPage || !storage.get("authToken")) {
      window.history.pushState({ isLoginPage: true }, null, window.location.href);
    }
  });

  // Add handler for page restoration from cache
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      // Page was restored from bfcache
      const token = storage.get("authToken");
      if (token) {
        // User is already logged in, redirect to dashboard
        navigate("dashboard.html");
      }
    }
  });

  // Check if user is already logged in
  const token = storage.get("authToken");
  if (token) {
    navigate("dashboard.html");
    return;
  }

  // Form submission handler
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Prevent multiple simultaneous login attempts
    if (isLoggingIn) {
      console.log("⚠️ Login already in progress, ignoring duplicate request");
      return;
    }

    const emailOrUsername = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Validate form inputs
    if (!validateForm(emailOrUsername, password)) {
      return;
    }

    // Show loading state and set login flag
    isLoggingIn = true;
    setLoadingState(true);

    try {
      console.log("🔐 Starting login process for:", emailOrUsername);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Login request timed out. Please try again.")), 30000);
      });

      // Make actual API call to server with timeout
      const apiResponse = await Promise.race([
        fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailOrUsername: emailOrUsername,
            password: password
          })
        }),
        timeoutPromise
      ]).catch(networkError => {
        console.error("🌐 Network error during login:", networkError);
        throw new Error("Network connection failed. Please check your internet connection and try again.");
      });

      console.log("📡 Login API response status:", apiResponse.status);
      console.log("📡 Login API response ok:", apiResponse.ok);

      if (!apiResponse.ok) {
        // Try to get error message from response, but handle body consumption carefully
        let errorMessage = `HTTP ${apiResponse.status}: ${apiResponse.statusText}`;

        // Provide more specific error messages based on status code
        if (apiResponse.status === 401) {
          // Check for common login credential patterns
          const commonCredentials = [
            'admin/admin', 'admin123/admin123', 'frontdesk123/password123',
            'employee123/employee123', 'test/test', 'admin/password'
          ];

          errorMessage = "Invalid email/username or password. Please check your credentials and try again.";

          // Add helpful hint for 401 errors
          if (emailOrUsername.includes('@')) {
            errorMessage += "\n\nTip: Try using your username instead of email, or contact your administrator for the correct login credentials.";
          } else {
            errorMessage += "\n\nTip: Make sure you're using the correct username and password provided by your administrator.";
          }
        } else if (apiResponse.status === 403) {
          errorMessage = "Access denied. Your account may be inactive.";
        } else if (apiResponse.status === 500) {
          errorMessage = "Server error. Please try again later.";
        } else if (apiResponse.status === 503) {
          errorMessage = "Service unavailable. Please try again later.";
        }

        try {
          const errorData = await apiResponse.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If JSON parsing fails, keep the default error message
          console.warn("Could not parse error response as JSON");
        }

        console.error("❌ Login API error:", errorMessage);
        throw new Error(errorMessage);
      }

      let response;
      try {
        response = await apiResponse.json();
        console.log("✅ Login response parsed successfully");
      } catch (jsonError) {
        console.error("❌ Failed to parse login response as JSON:", jsonError);
        throw new Error("Server returned invalid response. Please try again.");
      }

      if (!response.success) {
        throw new Error(response.message || 'Login failed');
      }

      // Store authentication data
      storage.set("authToken", response.token);
      storage.set("currentUser", response.user);

      // Clear any logout flags
      sessionStorage.removeItem('logoutInProgress');

      // Clean up any stale time tracking data from previous sessions
      cleanupStaleTimeData();

      // Clear history to prevent back button returning to login
      window.history.replaceState({ isLoggedIn: true }, null, window.location.href);

      // Log successful login
      if (window.auditLogger) {
        await window.auditLogger.logUser('login', {
          email: response.user.email,
          name: response.user.name,
          role: response.user.role,
          loginMethod: 'standard'
        });
      }

      // Handle remember me functionality
      const rememberCheckbox = $("#remember");
      if (rememberCheckbox && rememberCheckbox.checked) {
        storage.set("rememberedEmail", emailOrUsername);
        storage.set("rememberedPassword", password);
      } else if (rememberCheckbox && !rememberCheckbox.checked) {
        storage.remove("rememberedEmail");
        storage.remove("rememberedPassword");
      }

      // Show success message with role
      const roleDisplayMap = {
        admin: "Administrator",
        front_desk: "Front Desk",
        employee: "Employee",
      };
      const roleDisplay = roleDisplayMap[response.user.role] || "User";
      showToast(
        `Welcome ${response.user.name} (${roleDisplay})! Redirecting...`,
        "success",
      );

      // Handle post-login flow for different user roles
      setTimeout(() => {
        console.log("Post-login flow for user role:", response.user.role); // Debug log

        if (
          response.user.role === "front_desk" ||
          response.user.role === "employee"
        ) {
          // Check if user already timed in today
          const today = new Date().toISOString().split('T')[0];
          const lastTimeIn = storage.get(`lastTimeIn_${response.user.email}`);
          const lastTimeOut = storage.get(`lastTimeOut_${response.user.email}`);

          console.log("Front desk/Employee login - checking time status:", { today, lastTimeIn, lastTimeOut }); // Debug log

          // If already timed in today and haven't timed out, ask if they want to time out or proceed
          if (lastTimeIn === today && (!lastTimeOut || lastTimeOut !== today)) {
            console.log("Showing time out prompt"); // Debug log
            showTimeOutPrompt(response.user);
          } else {
            console.log("Showing employee time modal"); // Debug log
            // Not timed in today or already timed out, show time tracking modal
            showEmployeeTimeModal();
          }
        } else if (response.user.role === "admin") {
          console.log("Admin login - showing time in prompt"); // Debug log
          // Show prompt for admin users - they choose whether to time in or proceed
          showAdminTimeInPrompt(response.user);
        } else {
          console.log("Other role - navigating to dashboard"); // Debug log
          navigate("dashboard.html");
        }
      }, 1000);
    } catch (error) {
      console.error("❌ Login error:", error);
      // Show error message
      showToast(error.message || "Login failed. Please try again.", "error");
      setLoadingState(false);
    } finally {
      // Always reset the login flag
      isLoggingIn = false;
    }
  });

  // Email/Username input validation
  emailInput.addEventListener("blur", function () {
    const emailOrUsername = emailInput.value.trim();
    if (emailOrUsername && emailOrUsername.includes('@') && !validateEmail(emailOrUsername)) {
      showFieldError(emailInput, "Please enter a valid email address");
    } else {
      clearFieldError(emailInput);
    }
  });

  // Password input validation
  passwordInput.addEventListener("input", function () {
    clearFieldError(passwordInput);
  });

  // Form validation function
  function validateForm(emailOrUsername, password) {
    let isValid = true;

    // Email/Username validation
    if (!emailOrUsername) {
      showFieldError(emailInput, "Email or username is required");
      isValid = false;
    } else if (emailOrUsername.includes('@') && !validateEmail(emailOrUsername)) {
      showFieldError(emailInput, "Please enter a valid email address");
      isValid = false;
    } else {
      clearFieldError(emailInput);
    }

    // Password validation
    if (!password) {
      showFieldError(passwordInput, "Password is required");
      isValid = false;
    } else if (password.length < 6) {
      showFieldError(passwordInput, "Password must be at least 6 characters");
      isValid = false;
    } else {
      clearFieldError(passwordInput);
    }

    return isValid;
  }

  // Show field error
  function showFieldError(input, message) {
    clearFieldError(input);

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

  // Clear field error
  function clearFieldError(input) {
    input.style.borderColor = "";
    const existingError = input.parentNode.querySelector(".field-error");
    if (existingError) {
      existingError.remove();
    }
  }

  // Set loading state
  function setLoadingState(loading) {
    if (loading) {
      loginBtn.disabled = true;
      btnText.classList.add("hidden");
      btnSpinner.classList.remove("hidden");
    } else {
      loginBtn.disabled = false;
      btnText.classList.remove("hidden");
      btnSpinner.classList.add("hidden");
    }
  }

  // Demo credentials section removed - using real database only

  // Keyboard navigation
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && document.activeElement !== loginBtn) {
      if (loginBtn.disabled) {
        return;
      }

      e.preventDefault();

      if (typeof loginForm.requestSubmit === "function") {
        loginForm.requestSubmit(loginBtn);
      } else {
        loginBtn.click();
      }
    }
  });

  // Auto-focus on email input
  emailInput.focus();

  // Add debug helper in development
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('.dev')) {
    console.log('🔧 Debug: Common test credentials that should work:');
    console.log('   - admin123 / admin123');
    console.log('   - frontdesk123 / password123');
    console.log('   - employee123 / employee123');
    console.log('   - employee2 / employee2 (found in database)');
  }

  // QR Code functionality (demo)
  const qrCode = $(".qr-code");
  if (qrCode) {
    qrCode.addEventListener("click", function () {
      showToast(
        "QR Code clicked! In a real app, this would open the mobile time tracking interface.",
        "info",
      );
    });

    // Add click cursor
    qrCode.style.cursor = "pointer";
    qrCode.title = "Click to simulate QR code scanning";
  }

  // Feature items interaction
  const featureItems = $$(".feature-item");
  featureItems.forEach((item) => {
    item.style.cursor = "pointer";
    item.addEventListener("click", function () {
      const featureText = this.querySelector("span").textContent;
      showToast(`${featureText} feature coming soon!`, "info");
    });
  });

  // Remember me functionality
  const rememberCheckbox = $("#remember");
  const savedEmail = storage.get("rememberedEmail");
  const savedPassword = storage.get("rememberedPassword");

  if (savedEmail) {
    emailInput.value = savedEmail;
    if (savedPassword) {
      passwordInput.value = savedPassword;
    }
    rememberCheckbox.checked = true;
  }

  rememberCheckbox.addEventListener("change", function () {
    if (this.checked) {
      if (emailInput.value) {
        storage.set("rememberedEmail", emailInput.value);
      }
      if (passwordInput.value) {
        storage.set("rememberedPassword", passwordInput.value);
      }
    } else {
      storage.remove("rememberedEmail");
      storage.remove("rememberedPassword");
    }
  });

  emailInput.addEventListener("input", function () {
    if (rememberCheckbox.checked) {
      storage.set("rememberedEmail", this.value);
    }
  });

  passwordInput.addEventListener("input", function () {
    if (rememberCheckbox.checked) {
      storage.set("rememberedPassword", this.value);
    }
  });

  // Forgot password functionality
  const forgotPasswordLink = $(".forgot-password");
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", function (e) {
      e.preventDefault();
      showToast(
        "Password reset functionality would be implemented here.",
        "info",
      );
    });
  }

  // Sign up link functionality
  const signupLink = $(".signup-link");
  if (signupLink) {
    signupLink.addEventListener("click", function (e) {
      e.preventDefault();
      showToast("Sign up page would be implemented here.", "info");
    });
  }

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

  // Function to prompt admin users if they want to time in or proceed to app
  function showAdminTimeInPrompt(user) {
    const modal = document.createElement("div");
    modal.id = "adminTimeInPromptModal";
    modal.className = "employee-modal";
    modal.style.display = "flex";

    modal.innerHTML = `
      <div class="employee-modal-content">
        <div class="employee-modal-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="2" fill="none"/>
            <path d="M12 6v6l4 2" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 class="employee-modal-title">Welcome, Administrator</h2>
        </div>

        <div class="employee-modal-info" style="text-align: center; padding: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">
            Welcome back, ${user.name}!
          </p>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Would you like to time in for today or proceed directly to the application?
          </p>
        </div>

        <div class="employee-modal-body">
          <div class="time-tracking-buttons">
            <button class="time-button" id="timeInBtn" style="background: #10b981; border-color: #10b981;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
                <path d="M12 6v6l4 2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Time In Now
            </button>
            <button class="time-button" id="proceedDirectlyBtn" style="background: #3b82f6; border-color: #3b82f6;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
              </svg>
              Proceed to App
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Handle time in
    const timeInBtn = modal.querySelector("#timeInBtn");
    timeInBtn.addEventListener("click", function () {
      document.body.removeChild(modal);
      document.body.style.overflow = "auto";

      // Record time in for admin
      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      storage.set(`lastTimeIn_${user.email}`, today);
      storage.set(`lastTimeInTime_${user.email}`, currentTime);

      showToast(`Timed in successfully at ${currentTime}`, "success");

      // Navigate to dashboard after a short delay
      setTimeout(() => {
        navigate("dashboard.html");
      }, 1000);
    });

    // Handle proceed directly
    const proceedBtn = modal.querySelector("#proceedDirectlyBtn");
    proceedBtn.addEventListener("click", function () {
      document.body.removeChild(modal);
      document.body.style.overflow = "auto";
      navigate("dashboard.html");
    });

    // Prevent modal from closing on outside click since this is a required choice
  }

  // Function to prompt user if they want to time out when already timed in
  function showTimeOutPrompt(user) {
    const modal = document.createElement("div");
    modal.id = "timeOutPromptModal";
    modal.className = "employee-modal";
    modal.style.display = "flex";

    modal.innerHTML = `
      <div class="employee-modal-content">
        <div class="employee-modal-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#f59e0b" stroke-width="2" fill="none"/>
            <path d="M12 6v6l4 2" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 class="employee-modal-title">Already Timed In</h2>
        </div>

        <div class="employee-modal-info" style="text-align: center; padding: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">
            You are already timed in for today.
          </p>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Would you like to time out or proceed to the application?
          </p>
        </div>

        <div class="employee-modal-body">
          <div class="time-tracking-buttons">
            <button class="time-button" id="proceedToAppBtn" style="background: #3b82f6; border-color: #3b82f6;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
              </svg>
              Proceed to App
            </button>
            <button class="time-button" id="timeOutNowBtn" style="background: #ef4444; border-color: #ef4444;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.5 14H3.83333C3.47971 14 3.14057 13.8595 2.89052 13.6095C2.64048 13.3594 2.5 13.0203 2.5 12.6667V3.33333C2.5 2.97971 2.64048 2.64057 2.89052 2.39052C3.14057 2.14048 3.47971 2 3.83333 2H6.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M11.1667 11.3334L14.5001 8.00008L11.1667 4.66675" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14.5 8H6.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Time Out Now
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Handle proceed to app
    const proceedBtn = modal.querySelector("#proceedToAppBtn");
    proceedBtn.addEventListener("click", function () {
      document.body.removeChild(modal);
      document.body.style.overflow = "auto";

      // Navigate to appropriate page
      if (user.role === "employee") {
        navigate("timetracking.html");
      } else {
        navigate("dashboard.html");
      }
    });

    // Handle time out
    const timeOutBtn = modal.querySelector("#timeOutNowBtn");
    timeOutBtn.addEventListener("click", function () {
      // Time out the user
      const today = new Date().toISOString().split('T')[0];
      storage.set(`lastTimeOut_${user.email}`, today);

      // Clear current session completely to force fresh login
      storage.remove("authToken");
      storage.remove("currentUser");

      showToast("Successfully timed out! Please log in again.", "success");

      document.body.removeChild(modal);
      document.body.style.overflow = "auto";

      // Reload the page to reset all states and ensure clean login form
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    });

    // Prevent modal from closing on outside click since this is a required choice
  }

  // Make functions available globally
  window.showAdminTimeInPrompt = showAdminTimeInPrompt;
  window.showTimeOutPrompt = showTimeOutPrompt;
});

// Export for potential use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
