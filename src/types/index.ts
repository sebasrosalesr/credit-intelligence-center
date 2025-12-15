// Common types used throughout the application

export interface CreditRecord {
  id?: string;
  "Invoice Number"?: string | number;
  "Item Number"?: string | number;
  "Customer Number"?: string;
  "Ticket Number"?: string;
  RTN_CR_No?: string;
  "Reason for Credit"?: string;
  "Credit Type"?: string;
  "Sales Rep"?: string;
  Date?: string;
  "Credit Request Total"?: string | number;
  QTY?: string | number;
  Status?: string;
  combo_key?: string;
  __reminder?: ReminderRecord;
  __actionKey?: string | null | undefined;
  __isReminderRecord?: boolean;
  [key: string]: any; // Allow additional properties
}

export interface ReminderRecord {
  alert_id?: string;
  id?: string;
  firebaseKey?: string;
  customer_number?: string;
  invoice_number?: string;
  item_number?: string;
  ticket_number?: string;
  due_date?: string;
  remind_time?: string;
  remind_day_before?: boolean;
  note?: string;
  priority?: string;
  status?: string;
  type?: string;
  source?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  completed_at?: string;
  snoozed_until?: string;
  [key: string]: any;
}

export interface FirebaseStatus {
  status: "live" | "loading" | "error" | "mock";
  lastLiveRefresh?: Date;
}

export interface WorkflowState {
  label: string;
  color: string;
  bgColor: string;
}

export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
}

export interface AppState {
  editMode: boolean;
  pendingEdits: Record<string, Record<string, any>>;
  editUpsert: boolean;
  editPushState: PushState;
  deleteState: PushState;
  selectedRowKeys: Set<string>;
  csvPushState: PushState;
  csvPushFile: File | null;
  csvPreview: CsvPreview;
  reminderQueue: ReminderNotification[];
  reminderFiredKeys: Set<string>;
  reminderDismissed: Set<string>;
  reminderSuppressUntil: number | null;
  alertsFilters: AlertsFilters;
}

export interface PushState {
  loading: boolean;
  message: string;
  error: string;
  progress?: {
    step: number;
    total: number;
    label: string;
  };
}

export interface CsvPreview {
  parsed: boolean;
  rows: Record<string, any>[];
  issues: string[];
  summary?: {
    total: number;
    updates: number;
    inserts: number;
  };
  diffEntries?: Array<{
    id: string;
    combo: string;
    changed: Record<string, { from: any; to: any }>;
  }>;
}

export interface ReminderNotification {
  key: string;
  ticket: string;
  invoice: string;
  message: string;
}

export interface AlertsFilters {
  search: string;
  bulk: string;
  action: string;
  slaBucket: string;
}

export interface SummaryMetrics {
  total: number;
  count: number;
  avg: number;
  pending: number;
}

export interface RiskMetrics {
  slaBuckets: Record<string, { count: number; total: number }>;
  highDollarTickets: Array<[string, number]>;
  highDollarTotal: number;
  pendingTrend: {
    current: number;
    previous: number;
    pctChange: number;
  };
}

export interface Analytics {
  volumeByDate: Array<[string, number]>;
  topReps: Array<[string, number]>;
  largestCredits: CreditRecord[];
  slaBuckets: Array<[string, number]>;
}

export type SortDirection = "asc" | "desc";
export type SortColumn = "Date" | "Customer" | "Invoice" | "CreditTotal";
export type StatusFilter = "All" | "Pending" | "Completed";
