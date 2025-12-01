// Debug script for patients.js errors
// Add this temporarily to debug the [object Object] error

console.log('🔍 Debug script loaded for patients.js error investigation');

// Override console methods to catch [object Object] errors
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = function(...args) {
  args.forEach((arg, index) => {
    if (typeof arg === 'object' && arg !== null && Object.prototype.toString.call(arg) === '[object Object]') {
      console.trace(`🚨 [object Object] detected in console.error at argument ${index}:`, arg);
      originalConsoleError.apply(console, ['🚨 OBJECT ERROR DETECTED:', JSON.stringify(arg, null, 2)]);
    }
  });
  originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  args.forEach((arg, index) => {
    if (typeof arg === 'object' && arg !== null && Object.prototype.toString.call(arg) === '[object Object]') {
      console.trace(`⚠️ [object Object] detected in console.warn at argument ${index}:`, arg);
      originalConsoleWarn.apply(console, ['⚠️ OBJECT WARNING DETECTED:', JSON.stringify(arg, null, 2)]);
    }
  });
  originalConsoleWarn.apply(console, args);
};

// Monitor for unhandled exceptions
window.addEventListener('error', function(e) {
  originalConsoleError('🔥 Unhandled Error Event:', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error,
    errorString: e.error ? e.error.toString() : 'No error object',
    errorType: typeof e.error,
    stack: e.error ? e.error.stack : 'No stack trace'
  });
});

// Monitor for unhandled promise rejections
window.addEventListener('unhandledrejection', function(e) {
  originalConsoleError('🔥 Unhandled Promise Rejection:', {
    reason: e.reason,
    reasonString: e.reason ? e.reason.toString() : 'No reason',
    reasonType: typeof e.reason,
    stack: e.reason && e.reason.stack ? e.reason.stack : 'No stack trace'
  });
});

// Monitor loadData function calls
if (typeof window.loadData === 'function') {
  const originalLoadData = window.loadData;
  window.loadData = async function() {
    try {
      originalConsoleLog('🔄 loadData called');
      return await originalLoadData.apply(this, arguments);
    } catch (error) {
      originalConsoleError('❌ Error in loadData wrapper:', {
        error: error,
        errorString: error ? error.toString() : 'No error object',
        errorType: typeof error,
        message: error ? error.message : 'No message',
        stack: error ? error.stack : 'No stack trace'
      });
      throw error;
    }
  };
}

originalConsoleLog('✅ Debug monitoring active');
