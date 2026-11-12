import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';

export default function AppDialog({ visible, config, onClose }) {
  const { theme } = useFinance();

  if (!visible || !config) return null;

  const {
    title = 'Notice',
    message = '',
    type = 'info', // 'success' | 'danger' | 'warning' | 'info'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isConfirm = false,
    onConfirm,
    icon,
  } = config;

  let iconName = icon;
  let accentColor = '#6366F1';
  let badgeBg = 'rgba(99, 102, 241, 0.15)';

  if (type === 'success') {
    accentColor = '#10B981';
    badgeBg = 'rgba(16, 185, 129, 0.15)';
    if (!iconName) iconName = 'checkmark-circle';
  } else if (type === 'danger') {
    accentColor = '#F43F5E';
    badgeBg = 'rgba(244, 63, 94, 0.15)';
    if (!iconName) iconName = 'trash-outline';
  } else if (type === 'warning') {
    accentColor = '#F59E0B';
    badgeBg = 'rgba(245, 158, 11, 0.15)';
    if (!iconName) iconName = 'alert-circle';
  } else {
    accentColor = theme.primary || '#6366F1';
    badgeBg = theme.primaryLight || 'rgba(99, 102, 241, 0.15)';
    if (!iconName) iconName = 'sparkles';
  }

  const handleConfirm = () => {
    onClose();
    if (onConfirm) {
      setTimeout(() => {
        onConfirm();
      }, 50);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={isConfirm ? undefined : onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              borderTopColor: accentColor,
              borderTopWidth: 4,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Top glowing icon badge */}
          <View style={[styles.iconWrapper, { backgroundColor: badgeBg }]}>
            <Ionicons name={iconName} size={28} color={accentColor} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          {/* Message */}
          {message ? (
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actionsRow}>
            {isConfirm && (
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn, { borderColor: theme.border, backgroundColor: theme.cardSubtle }]}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.btn,
                styles.confirmBtn,
                { backgroundColor: accentColor },
                !isConfirm && { flex: 1 },
              ]}
              onPress={isConfirm ? handleConfirm : onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>
                {isConfirm ? confirmText : (config.buttonText || 'Got It')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1.5,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
