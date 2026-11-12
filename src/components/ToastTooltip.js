import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ToastTooltip({ visible, message, title, type = 'info', icon, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 8,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (onDismiss) onDismiss();
        });
      }, 2400);

      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
      translateY.setValue(14);
    }
  }, [visible, message, title]);

  if (!visible && opacity._value === 0) return null;

  const getIconConfig = () => {
    if (icon) return { name: icon, color: '#38BDF8' };
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle', color: '#10B981' };
      case 'danger':
        return { name: 'trash-bin-outline', color: '#F43F5E' };
      case 'warning':
        return { name: 'alert-circle-outline', color: '#F59E0B' };
      default:
        return { name: 'information-circle-outline', color: '#6366F1' };
    }
  };

  const iconCfg = getIconConfig();

  return (
    <View style={styles.outerContainer} pointerEvents="none">
      <Animated.View
        style={[
          styles.toastCard,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Ionicons name={iconCfg.name} size={18} color={iconCfg.color} style={styles.icon} />
        <View style={styles.textContainer}>
          {title ? <Text style={styles.titleText} numberOfLines={1}>{title}</Text> : null}
          {message ? (
            <Text style={[styles.messageText, !title && styles.standaloneMessage]} numberOfLines={2}>
              {message}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 88 : 96,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginRight: 10,
    flexShrink: 0,
  },
  textContainer: {
    flexShrink: 1,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  messageText: {
    color: 'rgba(243, 244, 246, 0.88)',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
    lineHeight: 15,
  },
  standaloneMessage: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 0,
  },
});
