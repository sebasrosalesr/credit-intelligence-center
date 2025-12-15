// Type-safe API client with advanced TypeScript features
import type {
  ApiResponse,
  ApiClientConfig,
  ApiEndpoint,
  PaginatedResponse,
  FirebaseQuery,
  Subscription
} from '../types/advanced';

/**
 * Generic API client with full TypeScript support
 */
export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  /**
   * Generic HTTP request method with full type safety
   */
  private async request<TRequest = any, TResponse = any>(
    endpoint: ApiEndpoint<TRequest, TResponse>,
    data?: TRequest,
    options?: {
      timeout?: number;
      retries?: number;
      headers?: Record<string, string>;
    }
  ): Promise<ApiResponse<TResponse>> {
    const url = `${this.config.baseUrl}${endpoint.path}`;
    const method = endpoint.method;
    const timeout = options?.timeout ?? endpoint.timeout ?? this.config.timeout;
    const retries = options?.retries ?? this.config.retries;

    // Apply request interceptors
    let requestConfig = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : null,
    };

    if (this.config.interceptors?.request) {
      for (const interceptor of this.config.interceptors.request) {
        requestConfig = await interceptor(requestConfig);
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestConfig,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Apply response interceptors
        let processedResponse = response;
        if (this.config.interceptors?.response) {
          for (const interceptor of this.config.interceptors.response) {
            processedResponse = await interceptor(processedResponse);
          }
        }

        if (!processedResponse.ok) {
          throw new Error(`HTTP ${processedResponse.status}: ${processedResponse.statusText}`);
        }

        const result = await processedResponse.json();

        return {
          data: result,
          success: true,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === retries) {
          break;
        }

        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return {
      data: null as any,
      success: false,
      errors: [lastError?.message || 'Request failed'],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET request with type safety
   */
  async get<TResponse = any>(
    path: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<TResponse>> {
    return this.request({ path, method: 'GET' }, undefined, options);
  }

  /**
   * POST request with type safety
   */
  async post<TRequest = any, TResponse = any>(
    path: string,
    data: TRequest,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<TResponse>> {
    return this.request({ path, method: 'POST' }, data, options);
  }

  /**
   * PUT request with type safety
   */
  async put<TRequest = any, TResponse = any>(
    path: string,
    data: TRequest,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<TResponse>> {
    return this.request({ path, method: 'PUT' }, data, options);
  }

  /**
   * DELETE request with type safety
   */
  async delete<TResponse = any>(
    path: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<TResponse>> {
    return this.request({ path, method: 'DELETE' }, undefined, options);
  }

  /**
   * Paginated request helper
   */
  async getPaginated<T>(
    path: string,
    page: number = 1,
    limit: number = 20,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    return this.get<PaginatedResponse<T>>(`${path}?${params}`, options);
  }
}

/**
 * Firebase-specific API client
 */
export class FirebaseApiClient {
  private subscriptions = new Map<string, Subscription>();

  constructor(_db: any) {} // Firebase database instance

  /**
   * Query Firebase with type safety
   */
  async query<T = any>(
    _collection: string,
    _query?: FirebaseQuery
  ): Promise<T[]> {
    // This would implement Firebase querying with full type safety
    // For now, return a placeholder
    return [] as T[];
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe<T = any>(
    subscription: Omit<Subscription<T>, 'active' | 'unsubscribe'>
  ): () => void {
    const fullSubscription: Subscription<T> = {
      ...subscription,
      active: true,
    };

    this.subscriptions.set(subscription.id, fullSubscription);

    // Implement Firebase subscription logic here
    // For now, return a placeholder unsubscribe function
    return () => {
      fullSubscription.active = false;
      this.subscriptions.delete(subscription.id);
    };
  }

  /**
   * Create a new document
   */
  async create<T = any>(
    _collection: string,
    data: Omit<T, 'id'>
  ): Promise<T> {
    // Implement Firebase create logic
    return { ...data, id: 'generated-id' } as T;
  }

  /**
   * Update an existing document
   */
  async update<T = any>(
    _collection: string,
    _id: string,
    data: Partial<T>
  ): Promise<T> {
    // Implement Firebase update logic
    return { id: 'placeholder-id', ...data } as T;
  }

  /**
   * Delete a document
   */
  async delete(_collection: string, _id: string): Promise<void> {
    // Implement Firebase delete logic
  }
}

/**
 * Credit-specific API endpoints
 */
export const creditEndpoints = {
  list: { path: '/credits', method: 'GET' as const },
  create: { path: '/credits', method: 'POST' as const },
  update: { path: '/credits/:id', method: 'PUT' as const },
  delete: { path: '/credits/:id', method: 'DELETE' as const },
  bulkImport: { path: '/credits/import', method: 'POST' as const },
} as const;

/**
 * Reminder-specific API endpoints
 */
export const reminderEndpoints = {
  list: { path: '/reminders', method: 'GET' as const },
  create: { path: '/reminders', method: 'POST' as const },
  update: { path: '/reminders/:id', method: 'PUT' as const },
  delete: { path: '/reminders/:id', method: 'DELETE' as const },
  trigger: { path: '/reminders/:id/trigger', method: 'POST' as const },
} as const;

/**
 * Type-safe API hooks using generics
 */
export function useApiRequest<TData = any>() {
  // This would be a React hook that manages API request state
  // Using the discriminated union types for perfect type safety
  return {
    state: { state: 'idle' as const },
    execute: async () => {
      // Implementation would go here
      return { state: 'success' as const, data: {} as TData, timestamp: Date.now() };
    },
  };
}

/**
 * Pre-configured API client instance
 */
export const apiClient = new ApiClient({
  baseUrl: process.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  retries: 3,
  headers: {
    'Accept': 'application/json',
  },
});

// Export types for external use
export type { ApiResponse, ApiClientConfig, ApiEndpoint };
