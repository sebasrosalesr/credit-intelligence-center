import { useReducer, useCallback } from "react";

// Initial state for complex app state
const initialState = {
  // Edit mode state
  editMode: false,
  pendingEdits: {},
  editUpsert: false,
  editPushState: { loading: false, message: "", error: "" },

  // Delete state
  deleteState: { loading: false, message: "", error: "" },

  // Selection state
  selectedRowKeys: new Set(),

  // CSV import state
  csvPushState: { loading: false, message: "", error: "", progress: null },
  csvPushFile: null,
  csvPreview: { parsed: false, rows: [], issues: [], summary: null },

  // Reminder notifications state
  reminderQueue: [],
  reminderFiredKeys: new Set(),
  reminderDismissed: new Set(),
  reminderSuppressUntil: 0,

  // Alerts filters
  alertsFilters: {
    search: "",
    bulk: "",
    action: "all",
    slaBucket: "all",
  },
};

// Action types
const ACTION_TYPES = {
  // Edit actions
  TOGGLE_EDIT_MODE: "TOGGLE_EDIT_MODE",
  SET_PENDING_EDITS: "SET_PENDING_EDITS",
  CLEAR_PENDING_EDITS: "CLEAR_PENDING_EDITS",
  SET_EDIT_UPSERT: "SET_EDIT_UPSERT",
  SET_EDIT_PUSH_STATE: "SET_EDIT_PUSH_STATE",

  // Delete actions
  SET_DELETE_STATE: "SET_DELETE_STATE",

  // Selection actions
  TOGGLE_ROW_SELECTION: "TOGGLE_ROW_SELECTION",
  TOGGLE_ALL_SELECTION: "TOGGLE_ALL_SELECTION",
  CLEAR_SELECTION: "CLEAR_SELECTION",

  // CSV actions
  SET_CSV_FILE: "SET_CSV_FILE",
  SET_CSV_PUSH_STATE: "SET_CSV_PUSH_STATE",
  SET_CSV_PREVIEW: "SET_CSV_PREVIEW",
  CLEAR_CSV_DATA: "CLEAR_CSV_DATA",

  // Reminder actions
  SET_REMINDER_QUEUE: "SET_REMINDER_QUEUE",
  ADD_REMINDER_NOTIFICATIONS: "ADD_REMINDER_NOTIFICATIONS",
  DISMISS_REMINDER_GROUP: "DISMISS_REMINDER_GROUP",
  CLEAR_ALL_REMINDERS: "CLEAR_ALL_REMINDERS",
  SUPPRESS_REMINDERS: "SUPPRESS_REMINDERS",
  SET_REMINDER_FIRED_KEYS: "SET_REMINDER_FIRED_KEYS",
  SET_REMINDER_DISMISSED: "SET_REMINDER_DISMISSED",

  // Alerts actions
  SET_ALERTS_FILTERS: "SET_ALERTS_FILTERS",
};

// Reducer function
function appStateReducer(state, action) {
  switch (action.type) {
    // Edit mode actions
    case ACTION_TYPES.TOGGLE_EDIT_MODE:
      return { ...state, editMode: !state.editMode };

    case ACTION_TYPES.SET_PENDING_EDITS:
      if (typeof action.value === "function") {
        return { ...state, pendingEdits: action.value(state.pendingEdits) };
      }
      return { ...state, pendingEdits: { ...state.pendingEdits, [action.key]: action.value } };

    case ACTION_TYPES.CLEAR_PENDING_EDITS:
      return { ...state, pendingEdits: {}, editMode: false };

    case ACTION_TYPES.SET_EDIT_UPSERT:
      return { ...state, editUpsert: action.value };

    case ACTION_TYPES.SET_EDIT_PUSH_STATE:
      return {
        ...state,
        editPushState:
          typeof action.value === "function"
            ? action.value(state.editPushState)
            : action.value,
      };

    // Delete actions
    case ACTION_TYPES.SET_DELETE_STATE:
      return {
        ...state,
        deleteState:
          typeof action.value === "function"
            ? action.value(state.deleteState)
            : action.value,
      };

    // Selection actions
    case ACTION_TYPES.TOGGLE_ROW_SELECTION: {
      const next = new Set(state.selectedRowKeys);
      if (action.checked) {
        next.add(action.key);
      } else {
        next.delete(action.key);
      }
      return { ...state, selectedRowKeys: next };
    }

    case ACTION_TYPES.TOGGLE_ALL_SELECTION: {
      const next = new Set(state.selectedRowKeys);
      action.visibleRecords.forEach((rec, idx) => {
        const key = action.getRecordKey(rec, idx);
        if (action.checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      return { ...state, selectedRowKeys: next };
    }

    case ACTION_TYPES.CLEAR_SELECTION:
      return { ...state, selectedRowKeys: new Set() };

    // CSV actions
    case ACTION_TYPES.SET_CSV_FILE:
      return { ...state, csvPushFile: action.file };

    case ACTION_TYPES.SET_CSV_PUSH_STATE:
      return {
        ...state,
        csvPushState:
          typeof action.value === "function"
            ? action.value(state.csvPushState)
            : action.value,
      };

    case ACTION_TYPES.SET_CSV_PREVIEW:
      return { ...state, csvPreview: action.value };

    case ACTION_TYPES.CLEAR_CSV_DATA:
      return {
        ...state,
        csvPushFile: null,
        csvPreview: { parsed: false, rows: [], issues: [], summary: null }
      };

    // Reminder actions
    case ACTION_TYPES.SET_REMINDER_QUEUE:
      return { ...state, reminderQueue: action.queue };

    case ACTION_TYPES.ADD_REMINDER_NOTIFICATIONS:
      return {
        ...state,
        reminderQueue: [...state.reminderQueue, ...action.notifications],
        reminderFiredKeys: new Set([...state.reminderFiredKeys, ...action.firedKeys])
      };

    case ACTION_TYPES.DISMISS_REMINDER_GROUP: {
      const nextDismissed = new Set(state.reminderDismissed);
      action.keys.forEach(key => nextDismissed.add(key));
      return {
        ...state,
        reminderQueue: state.reminderQueue.filter(r => !action.keys.includes(r.key)),
        reminderDismissed: nextDismissed
      };
    }

    case ACTION_TYPES.CLEAR_ALL_REMINDERS:
      return { ...state, reminderQueue: [] };

    case ACTION_TYPES.SUPPRESS_REMINDERS:
      return { ...state, reminderSuppressUntil: action.until, reminderQueue: [] };

    case ACTION_TYPES.SET_REMINDER_FIRED_KEYS:
      return { ...state, reminderFiredKeys: action.keys };

    case ACTION_TYPES.SET_REMINDER_DISMISSED:
      return { ...state, reminderDismissed: action.keys };

    // Alerts actions
    case ACTION_TYPES.SET_ALERTS_FILTERS:
      return { ...state, alertsFilters: action.filters };

    default:
      return state;
  }
}

// Custom hook
export function useAppState() {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  // Action creators
  const toggleEditMode = useCallback(() => {
    dispatch({ type: ACTION_TYPES.TOGGLE_EDIT_MODE });
  }, []);

  const setPendingEdits = useCallback((keyOrUpdater, value) => {
    if (typeof keyOrUpdater === "function") {
      dispatch({ type: ACTION_TYPES.SET_PENDING_EDITS, key: null, value: keyOrUpdater });
      return;
    }
    dispatch({ type: ACTION_TYPES.SET_PENDING_EDITS, key: keyOrUpdater, value });
  }, []);

  const clearPendingEdits = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_PENDING_EDITS });
  }, []);

  const setEditUpsert = useCallback((value) => {
    dispatch({ type: ACTION_TYPES.SET_EDIT_UPSERT, value });
  }, []);

  const setEditPushState = useCallback((value) => {
    dispatch({ type: ACTION_TYPES.SET_EDIT_PUSH_STATE, value });
  }, []);

  const setDeleteState = useCallback((value) => {
    dispatch({ type: ACTION_TYPES.SET_DELETE_STATE, value });
  }, []);

  const toggleRowSelection = useCallback((key, checked) => {
    dispatch({ type: ACTION_TYPES.TOGGLE_ROW_SELECTION, key, checked });
  }, []);

  const toggleAllSelection = useCallback((checked, visibleRecords, getRecordKey) => {
    dispatch({
      type: ACTION_TYPES.TOGGLE_ALL_SELECTION,
      checked,
      visibleRecords,
      getRecordKey
    });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_SELECTION });
  }, []);

  const setCsvFile = useCallback((file) => {
    dispatch({ type: ACTION_TYPES.SET_CSV_FILE, file });
  }, []);

  const setCsvPushState = useCallback((value) => {
    dispatch({ type: ACTION_TYPES.SET_CSV_PUSH_STATE, value });
  }, []);

  const setCsvPreview = useCallback((value) => {
    dispatch({ type: ACTION_TYPES.SET_CSV_PREVIEW, value });
  }, []);

  const clearCsvData = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_CSV_DATA });
  }, []);

  const setReminderQueue = useCallback((queue) => {
    dispatch({ type: ACTION_TYPES.SET_REMINDER_QUEUE, queue });
  }, []);

  const addReminderNotifications = useCallback((notifications, firedKeys) => {
    dispatch({
      type: ACTION_TYPES.ADD_REMINDER_NOTIFICATIONS,
      notifications,
      firedKeys
    });
  }, []);

  const dismissReminderGroup = useCallback((keys) => {
    dispatch({ type: ACTION_TYPES.DISMISS_REMINDER_GROUP, keys });
  }, []);

  const clearAllReminders = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_ALL_REMINDERS });
  }, []);

  const suppressReminders = useCallback((until) => {
    dispatch({ type: ACTION_TYPES.SUPPRESS_REMINDERS, until });
  }, []);

  const setReminderFiredKeys = useCallback((keys) => {
    dispatch({ type: ACTION_TYPES.SET_REMINDER_FIRED_KEYS, keys });
  }, []);

  const setReminderDismissed = useCallback((keys) => {
    dispatch({ type: ACTION_TYPES.SET_REMINDER_DISMISSED, keys });
  }, []);

  const setAlertsFilters = useCallback((filtersOrUpdater) => {
    const nextFilters =
      typeof filtersOrUpdater === "function"
        ? filtersOrUpdater(state.alertsFilters)
        : filtersOrUpdater;
    dispatch({
      type: ACTION_TYPES.SET_ALERTS_FILTERS,
      filters: nextFilters || state.alertsFilters,
    });
  }, [state.alertsFilters]);

  return {
    // State
    ...state,

    // Actions
    toggleEditMode,
    setPendingEdits,
    clearPendingEdits,
    setEditUpsert,
    setEditPushState,
    setDeleteState,
    toggleRowSelection,
    toggleAllSelection,
    clearSelection,
    setCsvFile,
    setCsvPushState,
    setCsvPreview,
    clearCsvData,
    setReminderQueue,
    addReminderNotifications,
    dismissReminderGroup,
    clearAllReminders,
    suppressReminders,
    setReminderFiredKeys,
    setReminderDismissed,
    setAlertsFilters,
  };
}
