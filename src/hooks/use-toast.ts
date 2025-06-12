'use client';
// Inspired by react-hot-toast library
import * as React from 'react';

import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000; // Effectively infinite, toasts are dismissed manually or by duration prop

/**
 * Represents a toast object within the toaster.
 * @typedef {object} ToasterToast
 * @property {string} id - Unique identifier for the toast.
 * @property {React.ReactNode} [title] - The title of the toast.
 * @property {React.ReactNode} [description] - The description/content of the toast.
 * @property {ToastActionElement} [action] - An optional action button for the toast.
 * @augments ToastProps
 */
export type ToasterToast = ToastProps & {
  // Export ToasterToast type
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

let count = 0;

/**
 * Generates a unique ID for a toast.
 * @returns {string} A unique string ID.
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

/**
 * @typedef {object} AddToastAction
 * @property {ActionType["ADD_TOAST"]} type
 * @property {ToasterToast} toast
 */

/**
 * @typedef {object} UpdateToastAction
 * @property {ActionType["UPDATE_TOAST"]} type
 * @property {Partial<ToasterToast>} toast
 */

/**
 * @typedef {object} DismissToastAction
 * @property {ActionType["DISMISS_TOAST"]} type
 * @property {ToasterToast["id"]} [toastId]
 */

/**
 * @typedef {object} RemoveToastAction
 * @property {ActionType["REMOVE_TOAST"]} type
 * @property {ToasterToast["id"]} [toastId]
 */

/**
 * Represents an action that can be dispatched to the toast reducer.
 * @typedef {AddToastAction | UpdateToastAction | DismissToastAction | RemoveToastAction} Action
 */
type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: ToasterToast['id'];
    };

/**
 * Represents the state of the toaster.
 * @typedef {object} State
 * @property {ToasterToast[]} toasts - An array of active toasts.
 */
interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Adds a toast ID to a queue for removal after a delay.
 * This is used to manage the lifecycle of toasts if they are not dismissed manually.
 * @param {string} toastId - The ID of the toast to remove.
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

/**
 * Reducer function for managing toast state.
 * @param {State} state - The current state.
 * @param {Action} action - The action to perform.
 * @returns {State} The new state.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

/**
 * Dispatches an action to the toast state reducer and notifies listeners.
 * @param {Action} action - The action to dispatch.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

/**
 * Represents the properties of a toast, excluding the ID.
 * @typedef {Omit<ToasterToast, "id">} Toast
 */
export type ToastSignature = Omit<ToasterToast, 'id'>; // Export ToastSignature type for external use

/**
 * Displays a toast notification.
 * @param {ToastSignature} props - The properties of the toast to display.
 * @returns {{ id: string; dismiss: () => void; update: (props: ToasterToast) => void }}
 * An object containing the ID of the toast, a dismiss function, and an update function.
 */
function toast({ ...props }: ToastSignature) {
  // Use exported ToastSignature
  const id = genId();

  const update = (
    newProps: ToasterToast // Changed props to newProps to avoid conflict
  ) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...newProps, id },
    });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

/**
 * Custom hook for managing and displaying toast notifications.
 * @returns {{
 *  toasts: ToasterToast[];
 *  toast: (props: ToastSignature) => { id: string; dismiss: () => void; update: (props: ToasterToast) => void };
 *  dismiss: (toastId?: string) => void;
 * }}
 * An object containing the current toasts, a function to display a new toast, and a function to dismiss toasts.
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast, toast };
