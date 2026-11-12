import { Alert, Platform } from 'react-native';

let dialogHandler = null;

export function registerDialogHandler(handler) {
  dialogHandler = handler;
}

/**
 * Cross-platform modern confirmation dialog with application styling.
 * Automatically delegates to AppDialog, falling back to Alert.alert / window.confirm.
 */
export function confirmAction(title, message, onConfirm, options = {}) {
  if (dialogHandler) {
    dialogHandler.showConfirm({
      title,
      message,
      onConfirm,
      type: options.type || 'danger',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      icon: options.icon,
    });
    return;
  }

  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && window.confirm(text)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: options.cancelText || 'Cancel', style: 'cancel' },
      { text: options.confirmText || 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

/**
 * Cross-platform modern notification / tooltip with application styling.
 * Displays as a non-reactive bottom-center tooltip without blocking the screen.
 */
export function notifyAction(title, message, options = {}) {
  if (dialogHandler) {
    const handler = dialogHandler.showToast || dialogHandler.showAlert;
    handler({
      title,
      message,
      type: options.type || (title.toLowerCase().includes('success') || title.toLowerCase().includes('complete') ? 'success' : 'info'),
      icon: options.icon,
    });
    return;
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
  } else {
    Alert.alert(title, message);
  }
}

export function showToast(title, message, options = {}) {
  notifyAction(title, message, options);
}
