import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AppDialog from '../components/AppDialog';
import ToastTooltip from '../components/ToastTooltip';
import { registerDialogHandler } from '../utils/dialogs';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  // Modal state (ONLY for explicit confirmations like Delete Confirmation)
  const [dialogState, setDialogState] = useState({
    visible: false,
    config: null,
  });

  // Non-reactive bottom-center tooltip (for deletion feedback, notices, success alerts)
  const [toastState, setToastState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    icon: null,
  });

  // Replaces modal alert with sleek non-reactive bottom-center toast
  const showAlert = useCallback(({ title, message, type = 'info', icon }) => {
    setToastState({
      visible: true,
      title: title || '',
      message: message || '',
      type,
      icon,
    });
  }, []);

  const showToast = useCallback(({ title, message, type = 'info', icon }) => {
    showAlert({ title, message, type, icon });
  }, [showAlert]);

  // Confirmation remains an explicit modal dialog
  const showConfirm = useCallback(({
    title,
    message,
    type = 'danger',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    icon,
  }) => {
    setDialogState({
      visible: true,
      config: {
        title,
        message,
        type,
        confirmText,
        cancelText,
        onConfirm,
        icon,
        isConfirm: true,
      },
    });
  }, []);

  const hideDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, visible: false }));
  }, []);

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    registerDialogHandler({
      showAlert,
      showConfirm,
      hideDialog,
      showToast,
    });
  }, [showAlert, showConfirm, hideDialog, showToast]);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, hideDialog, showToast }}>
      {children}
      <AppDialog
        visible={dialogState.visible}
        config={dialogState.config}
        onClose={hideDialog}
      />
      <ToastTooltip
        visible={toastState.visible}
        title={toastState.title}
        message={toastState.message}
        type={toastState.type}
        icon={toastState.icon}
        onDismiss={hideToast}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
