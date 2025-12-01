// API Configuration Helper
// This file helps resolve network errors by ensuring API calls go to the correct server

const API_CONFIG = {
  // Determine the correct API base URL based on the current environment
  getBaseUrl() {
    // For cloud development environments, we need to use the current origin
    // The proxy should handle routing to the backend
    if (window.location.hostname.includes('fly.dev') || window.location.hostname.includes('builder.io')) {
      // Cloud development environment: Use current origin (proxy will route to backend)
      return window.location.origin;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Local development: Use the backend server port directly
      return 'http://localhost:3001';
    } else {
      // Production: Use the same domain
      return window.location.origin;
    }
  },

  // Construct full API URL
  getApiUrl(endpoint) {
    const baseUrl = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return `${baseUrl}${cleanEndpoint}`;
  },

  // Enhanced fetch with better error handling
  async apiCall(endpoint, options = {}) {
    const url = this.getApiUrl(endpoint);
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      // Only log for non-health endpoints to reduce noise
      if (!endpoint.includes('/health')) {
        console.log(`🌐 Making API call to: ${url}`);
      }

      const response = await fetch(url, defaultOptions);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        if (!endpoint.includes('/health')) {
          console.error(`❌ HTTP Error ${response.status}: ${errorText}`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      if (!endpoint.includes('/health')) {
        console.log(`✅ API call successful for: ${url}`);
      }
      return response;
    } catch (error) {
      // Reduce noise for health check errors
      if (!endpoint.includes('/health')) {
        console.error(`❌ API call failed for ${url}:`, error);
      }

      // Provide more specific error messages (but quieter for health checks)
      if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        if (!endpoint.includes('/health')) {
          const errorMsg = `Network error: Could not connect to server at ${url}. Please check if the server is running.`;
          throw new Error(errorMsg);
        } else {
          // Silent fail for health checks - server might just be offline
          throw new Error('Server offline');
        }
      } else if (error.message.includes('CORS')) {
        throw new Error(`CORS error: Cross-origin request blocked for ${url}. Check server CORS configuration.`);
      }

      throw error;
    }
  },

  // Check if server is reachable
  async checkServerStatus() {
    try {
      const response = await fetch(this.getApiUrl('/api/health'), {
        method: 'GET',
        timeout: 3000
      });
      return response.ok ? 'Online' : `Error ${response.status}`;
    } catch (error) {
      return `Offline (${error.message})`;
    }
  },

  // Test server connectivity
  async testConnection() {
    try {
      console.log('🔍 Testing server connectivity...');
      console.log('🔗 Server URL:', this.getBaseUrl());

      const response = await this.apiCall('/api/health');
      const data = await response.json();
      console.log('✅ Server connection test successful:', data);

      // Show success toast
      if (typeof showToast === 'function') {
        showToast('Server connection established', 'success');
      }

      return true;
    } catch (error) {
      console.error('❌ Server connection test failed:', error);

      // Show error toast
      if (typeof showToast === 'function') {
        showToast('Server connection failed - using offline mode', 'warning');
      }

      return false;
    }
  }
};

// Make API_CONFIG available globally
if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}
