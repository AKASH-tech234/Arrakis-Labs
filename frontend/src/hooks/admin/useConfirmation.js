// src/hooks/admin/useConfirmation.js
// Hook for managing confirmation modal state

import { useState, useCallback } from "react";

/**
 * Hook to manage confirmation modal state
 */
export const useConfirmation = () => {
  const [state, setState] = useState({
    isOpen: false,
    title: "Confirm Action",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "warning",
    requireTyping: false,
    typingPhrase: "",
    loading: false,
    onConfirm: null,
  });

  /**
   * Open confirmation modal
   * @param {Object} options - Modal options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Confirmation message
   * @param {string} [options.confirmText='Confirm'] - Confirm button text
   * @param {string} [options.cancelText='Cancel'] - Cancel button text
   * @param {'warning'|'danger'|'info'} [options.variant='warning'] - Modal variant
   * @param {boolean} [options.requireTyping=false] - Require typing to confirm
   * @param {string} [options.typingPhrase=''] - Phrase to type for confirmation
   * @param {Function} options.onConfirm - Callback on confirm
   * @returns {Promise} Resolves when confirmed, rejects when cancelled
   */
  const confirm = useCallback((options) => {
    return new Promise((resolve, reject) => {
      setState({
        isOpen: true,
        title: options.title || "Confirm Action",
        message: options.message || "Are you sure?",
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        variant: options.variant || "warning",
        requireTyping: options.requireTyping || false,
        typingPhrase: options.typingPhrase || "",
        loading: false,
        onConfirm: async () => {
          setState((prev) => ({ ...prev, loading: true }));
          try {
            if (options.onConfirm) {
              await options.onConfirm();
            }
            resolve(true);
          } catch (error) {
            reject(error);
          } finally {
            setState((prev) => ({ ...prev, isOpen: false, loading: false }));
          }
        },
        onCancel: () => {
          setState((prev) => ({ ...prev, isOpen: false }));
          reject(new Error("Cancelled"));
        },
      });
    });
  }, []);

  /**
   * Close the modal
   */
  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * Shorthand for delete confirmation
   */
  const confirmDelete = useCallback(
    (itemName, onConfirm) => {
      return confirm({
        title: "Delete Confirmation",
        message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        confirmText: "Delete",
        variant: "danger",
        requireTyping: true,
        typingPhrase: itemName,
        onConfirm,
      });
    },
    [confirm],
  );

  /**
   * Shorthand for dangerous action confirmation
   */
  const confirmDangerous = useCallback(
    (title, message, onConfirm) => {
      return confirm({
        title,
        message,
        confirmText: "Proceed",
        variant: "danger",
        requireTyping: true,
        typingPhrase: "CONFIRM",
        onConfirm,
      });
    },
    [confirm],
  );

  return {
    ...state,
    confirm,
    confirmDelete,
    confirmDangerous,
    close,
    onClose: close,
  };
};

export default useConfirmation;
