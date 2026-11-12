import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';

export default function CategorySelector({ categories, selectedId, onSelect }) {
  const { theme } = useFinance();

  return (
    <View style={styles.wrappedContainer}>
      {categories.map((cat) => {
        const isSelected = cat.id === selectedId;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? `${cat.color}22` : theme.cardSubtle,
                borderColor: isSelected ? cat.color : theme.border,
              },
              isSelected && styles.selectedChip,
            ]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: `${cat.color}20` },
                isSelected && { backgroundColor: cat.color },
              ]}
            >
              <Ionicons
                name={cat.icon}
                size={14}
                color={isSelected ? '#FFFFFF' : cat.color}
              />
            </View>
            <Text
              style={[
                styles.chipLabel,
                { color: isSelected ? (theme.mode === 'dark' ? '#FFFFFF' : cat.color) : theme.textSecondary },
                isSelected && { fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrappedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1.5,
    marginBottom: 2,
    maxWidth: '100%',
  },
  selectedChip: {
    borderWidth: 2,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
    flexShrink: 0,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
