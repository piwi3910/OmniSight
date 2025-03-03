import React, { lazy, ComponentType } from 'react';

/**
 * Creates a lazy-loaded component with retry functionality
 * 
 * @param componentImport - Function that imports the component
 * @param fallback - Optional fallback component to show while loading
 * @param retryCount - Number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 1000)
 * @returns Lazy-loaded component
 */
export function lazyLoadWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  { fallback = null, retryCount = 3, retryDelay = 1000 } = {}
): React.LazyExoticComponent<T> {
  return lazy(() => {
    let currentRetry = 0;
    
    // Create a function to retry the import
    const retryableImport = (): Promise<{ default: T }> =>
      componentImport().catch((error) => {
        // Retry only if we haven't exceeded the retry count
        if (currentRetry < retryCount) {
          currentRetry++;
          console.warn(`Retrying component load (${currentRetry}/${retryCount})...`, error);
          
          // Delay the retry
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(retryableImport());
            }, retryDelay);
          });
        }
        
        // If we've exceeded the retry count, throw the error
        console.error('Component load failed after retries:', error);
        throw error;
      });
    
    return retryableImport();
  });
}

/**
 * Lazy load with fallback components based on size and importance
 * - Heavyweight: Components that are large and can be loaded later
 * - Standard: Regular components with medium priority
 * - Critical: Important components that should load early
 */

// Lazy load for large, non-critical page components
export const lazyLoadHeavyweight = <T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return lazyLoadWithRetry(componentImport, { retryCount: 3, retryDelay: 1500 });
};

// Lazy load for regular components
export const lazyLoadStandard = <T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return lazyLoadWithRetry(componentImport, { retryCount: 2, retryDelay: 1000 });
};

// Lazy load for critical components with less delay
export const lazyLoadCritical = <T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return lazyLoadWithRetry(componentImport, { retryCount: 5, retryDelay: 500 });
};

// Function to prefetch components that might be needed soon
export const prefetchComponent = (componentImport: () => Promise<any>): void => {
  // Start loading the component in the background
  componentImport()
    .then(() => {
      console.debug('Component prefetched successfully');
    })
    .catch((error) => {
      console.warn('Component prefetch failed:', error);
    });
};