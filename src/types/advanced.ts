// Advanced TypeScript types and utilities

import type { CreditRecord, ReminderRecord, User } from './index';

// ====================
// Generics and Utility Types
// ====================

/**
 * Generic API Response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
  timestamp: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Generic form field with validation
 */
export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  required: boolean;
}

/**
 * Generic select option
 */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
  group?: string;
}

// ====================
// Discriminated Unions
// ====================

/**
 * Notification types with discriminated unions
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface BaseNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  persistent?: boolean;
}

export interface SuccessNotification extends BaseNotification {
  type: 'success';
  actionUrl?: string;
}

export interface ErrorNotification extends BaseNotification {
  type: 'error';
  errorCode?: string;
  retryable?: boolean;
}

export interface WarningNotification extends BaseNotification {
  type: 'warning';
  acknowledgeRequired?: boolean;
}

export interface InfoNotification extends BaseNotification {
  type: 'info';
  category?: string;
}

export type Notification =
  | SuccessNotification
  | ErrorNotification
  | WarningNotification
  | InfoNotification;

/**
 * API Request states
 */
export type RequestState = 'idle' | 'loading' | 'success' | 'error';

export interface IdleRequest {
  state: 'idle';
}

export interface LoadingRequest {
  state: 'loading';
  progress?: number;
}

export interface SuccessRequest<T = any> {
  state: 'success';
  data: T;
  timestamp: number;
}

export interface ErrorRequest {
  state: 'error';
  error: string;
  errorCode?: string;
  retryable?: boolean;
}

export type ApiRequest<T = any> =
  | IdleRequest
  | LoadingRequest
  | SuccessRequest<T>
  | ErrorRequest;

/**
 * User permissions with discriminated unions
 */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

export interface BasePermission {
  resource: string;
  level: PermissionLevel;
}

export interface ReadPermission extends BasePermission {
  level: 'read';
  allowedFields?: string[];
}

export interface WritePermission extends BasePermission {
  level: 'write' | 'admin';
  allowedFields?: string[];
  canDelete?: boolean;
  canCreate?: boolean;
}

export type Permission = ReadPermission | WritePermission;

// ====================
// Advanced Utility Types
// ====================

/**
 * Deep partial for nested objects
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific properties required
 */
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Extract nested property types
 */
export type NestedValue<T, K extends keyof T> = T[K] extends infer U ? U : never;

/**
 * Flatten union types
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * Get keys of object that match a type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Non-nullable version of a type
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Function parameter types
 */
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;

/**
 * Component props extraction
 */
export type ComponentProps<T> = T extends React.ComponentType<infer P> ? P : never;

// ====================
// Domain-Specific Types
// ====================

/**
 * Credit processing pipeline stages
 */
export type ProcessingStage =
  | 'received'
  | 'validated'
  | 'processed'
  | 'completed'
  | 'rejected';

export interface ProcessingStep {
  stage: ProcessingStage;
  timestamp: string;
  actor: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ProcessedCredit extends CreditRecord {
  processingHistory: ProcessingStep[];
  currentStage: ProcessingStage;
  nextAction?: {
    type: 'review' | 'approve' | 'reject' | 'escalate';
    dueDate?: string;
    assignee?: string;
  };
}

/**
 * Reminder scheduling with advanced types
 */
export interface ReminderSchedule {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  daysOfMonth?: number[]; // 1-31
  timezone: string;
  enabled: boolean;
}

export interface ScheduledReminder extends ReminderRecord {
  schedule: ReminderSchedule;
  nextOccurrence: string;
  lastTriggered?: string;
  triggerCount: number;
}

/**
 * Analytics and reporting types
 */
export interface MetricValue {
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  change?: number;
  changePercent?: number;
}

export interface ReportData<T = any> {
  id: string;
  title: string;
  description?: string;
  data: T;
  generatedAt: string;
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'list';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  config: Record<string, any>;
  data?: any;
  loading?: boolean;
  error?: string;
}

// ====================
// API Layer Types
// ====================

/**
 * HTTP Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API Endpoint configuration
 */
export interface ApiEndpoint<TRequest = any, TResponse = any> {
  path: string;
  method: HttpMethod;
  requestSchema?: TRequest;
  responseSchema?: TResponse;
  requiresAuth?: boolean;
  cacheable?: boolean;
  timeout?: number;
}

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
  interceptors?: {
    request?: Array<(config: any) => any>;
    response?: Array<(response: any) => any>;
  };
}

/**
 * Firebase query constraints
 */
export interface FirebaseQuery {
  orderBy?: string;
  limit?: number;
  startAt?: any;
  endAt?: any;
  where?: Array<{
    field: string;
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';
    value: any;
  }>;
}

/**
 * Real-time subscription
 */
export interface Subscription<T = any> {
  id: string;
  path: string;
  query?: FirebaseQuery;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  active: boolean;
  unsubscribe?: () => void;
}

// ====================
// Event System Types
// ====================

/**
 * Application events
 */
export type AppEventType =
  | 'user:login'
  | 'user:logout'
  | 'data:updated'
  | 'reminder:triggered'
  | 'error:occurred'
  | 'navigation:changed';

export interface BaseAppEvent {
  type: AppEventType;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface UserLoginEvent extends BaseAppEvent {
  type: 'user:login';
  user: User;
  loginMethod: string;
}

export interface DataUpdatedEvent extends BaseAppEvent {
  type: 'data:updated';
  collection: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  changes?: Record<string, { from: any; to: any }>;
}

export interface ReminderTriggeredEvent extends BaseAppEvent {
  type: 'reminder:triggered';
  reminderId: string;
  creditId?: string;
  triggerType: 'scheduled' | 'manual';
}

export type AppEvent =
  | UserLoginEvent
  | DataUpdatedEvent
  | ReminderTriggeredEvent
  | BaseAppEvent;

// ====================
// Export convenience types
// ====================

export type CreditFormData = Omit<CreditRecord, 'id' | 'created_at' | 'updated_at'>;
export type ReminderFormData = Omit<ReminderRecord, 'id' | 'created_at' | 'updated_at' | 'firebaseKey'>;
export type UserProfile = Pick<User, 'uid' | 'email' | 'displayName'>;
