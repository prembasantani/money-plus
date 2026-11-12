import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useFinance } from '../context/FinanceContext';

export default function SkeletonLoader({ type = 'card', count = 3, style }) {
  const { theme } = useFinance();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  const items = Array.from({ length: count });

  if (type === 'row') {
    return (
      <View style={[styles.container, style]}>
        {items.map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.rowItem,
              {
                backgroundColor: theme.cardSubtle,
                borderColor: theme.border,
                opacity: opacityAnim,
              },
            ]}
          >
            <View style={[styles.circle, { backgroundColor: theme.border }]} />
            <View style={styles.rowLines}>
              <View style={[styles.lineLong, { backgroundColor: theme.border }]} />
              <View style={[styles.lineShort, { backgroundColor: theme.border }]} />
            </View>
          </Animated.View>
        ))}
      </View>
    );
  }

  // Card Skeleton
  return (
    <View style={[styles.container, style]}>
      {items.map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.cardItem,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.circleSmall, { backgroundColor: theme.border }]} />
            <View style={[styles.lineMedium, { backgroundColor: theme.border }]} />
            <View style={[styles.pillSmall, { backgroundColor: theme.border }]} />
          </View>
          <View style={[styles.lineLong, { backgroundColor: theme.border, marginTop: 10 }]} />
          <View style={[styles.lineShort, { backgroundColor: theme.border, marginTop: 6 }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cardItem: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  pillSmall: {
    width: 60,
    height: 18,
    borderRadius: 9,
    marginLeft: 'auto',
  },
  lineMedium: {
    width: 120,
    height: 14,
    borderRadius: 7,
  },
  lineLong: {
    width: '85%',
    height: 14,
    borderRadius: 7,
  },
  lineShort: {
    width: '50%',
    height: 12,
    borderRadius: 6,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  rowLines: {
    flex: 1,
    gap: 6,
  },
});
