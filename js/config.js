// Configuration Management for Ink and Arch Application

class Config {
  constructor() {
    this.environment = this.detectEnvironment();
    this.config = this.loadConfig();
  }

  detectEnvironment() {
    // Detect if running on Cloudflare Pages
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      if (hostname.includes('.pages.dev') || hostname.includes('cloudflare')) {
        return 'production';
      } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      } else {
        return 'production'; // Custom domain on Cloudflare
      }
    }

    return 'development';
  }

  loadConfig() {
    const baseConfig = {
      appName: 'Ink and Arch Clinic',
      version: '1.0.0',
      currency: 'PHP',
      locale: 'en-PH',

      // Database configuration
      database: {
        type: 'hybrid', // IndexedDB + MongoDB
        indexedDbName: 'InkAndArchDB',
        indexedDbVersion: 2
      },

      // Sync configuration
      sync: {
        enabled: true,
        intervalMinutes: 5,
        retryAttempts: 3,
        batchSize: 50
      },

      // UI configuration
      ui: {
        itemsPerPage: 10,
        maxSearchResults: 100,
        autoSaveDelay: 2000 // ms
      },

      // Feature flags
      features: {
        offlineMode: true,
        exportData: true,
        darkMode: true,
        notifications: true
      }
    };

    // Environment-specific configurations
    if (this.environment === 'production') {
      return {
        ...baseConfig,
        mongodb: {
          // These will be set by Cloudflare Pages environment variables
          connectionString: this.getEnvVar('MONGODB_URI') || 'mongodb+srv://username:password@cluster.mongodb.net/',
          databaseName: this.getEnvVar('MONGODB_DB_NAME') || 'inkandarch',
          dataSource: this.getEnvVar('MONGODB_DATA_SOURCE') || 'Cluster0',
          database: this.getEnvVar('MONGODB_DATABASE') || 'inkandarch'
        },
        debug: false,
        sync: {
          ...baseConfig.sync,
          enabled: true,
          intervalMinutes: 5
        }
      };
    } else {
      return {
        ...baseConfig,
        mongodb: {
          // Development configuration - use environment variables if available
          connectionString: this.getEnvVar('MONGODB_URI') || 'mongodb+srv://username:password@cluster.mongodb.net/',
          databaseName: this.getEnvVar('MONGODB_DB_NAME') || 'inkandarch',
          dataSource: this.getEnvVar('MONGODB_DATA_SOURCE') || 'Cluster0',
          database: this.getEnvVar('MONGODB_DATABASE') || 'inkandarch'
        },
        debug: true,
        sync: {
          ...baseConfig.sync,
          enabled: false, // Disable sync in development by default
          intervalMinutes: 10
        }
      };
    }
  }

  getEnvVar(name) {
    // In a browser environment, environment variables aren't directly accessible
    // They would need to be injected during build time or via a build process

    // For Cloudflare Pages, environment variables would be injected during build
    // This is a placeholder - in practice, you'd use a build step to inject these

    if (typeof window !== 'undefined' && window.ENV) {
      return window.ENV[name];
    }

    // Fallback to check if variables are embedded in a script tag
    const envScript = document.querySelector('script[data-env]');
    if (envScript) {
      try {
        const envData = JSON.parse(envScript.dataset.env);
        return envData[name];
      } catch (e) {
        console.warn('Failed to parse environment data');
      }
    }

    return null;
  }

  get(path) {
    return this.getNestedProperty(this.config, path);
  }

  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  isFeatureEnabled(featureName) {
    return this.get(`features.${featureName}`) === true;
  }

  getMongoDBConfig() {
    return this.get('mongodb');
  }

  getDatabaseConfig() {
    return this.get('database');
  }

  getSyncConfig() {
    return this.get('sync');
  }

  isDebugMode() {
    return this.get('debug') === true;
  }

  getEnvironment() {
    return this.environment;
  }

  // Format currency according to Philippine standards
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: this.get('currency'),
      minimumFractionDigits: 2
    }).format(amount);
  }

  // Validate MongoDB configuration
  validateMongoDBConfig() {
    const mongoConfig = this.getMongoDBConfig();

    const required = ['apiUrl', 'apiKey', 'dataSource', 'database'];
    const missing = required.filter(key => !mongoConfig[key]);

    if (missing.length > 0) {
      console.warn(`Missing MongoDB configuration: ${missing.join(', ')}`);
      return false;
    }

    // Check if API URL looks valid
    if (!mongoConfig.apiUrl.includes('mongodb-api.com')) {
      console.warn('MongoDB API URL appears invalid');
      return false;
    }

    return true;
  }

  // Get application metadata
  getAppInfo() {
    return {
      name: this.get('appName'),
      version: this.get('version'),
      environment: this.environment,
      features: this.get('features'),
      buildTime: new Date().toISOString()
    };
  }
}

// Create global configuration instance
const appConfig = new Config();

// Log configuration info in debug mode
if (appConfig.isDebugMode()) {
  console.log('Application Configuration:', appConfig.getAppInfo());
  console.log('MongoDB Config Valid:', appConfig.validateMongoDBConfig());
}

// Export for use in other modules
if (typeof window !== "undefined") {
  window.appConfig = appConfig;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = Config;
}
