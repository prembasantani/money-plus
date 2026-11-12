import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatters';
import { useFinance } from '../context/FinanceContext';

function AccountItem({ account, onAdjustPress }) {
  const { theme } = useFinance();

  const isCredit = account.ledgerCategory === 'credit';
  const balanceVal = account.balance || 0;
  const isPositive = balanceVal >= 0;

  // Credit card debt is red; positive bank balance is green; overdraft is red
  const balanceColor = isCredit
    ? '#EF4444'
    : isPositive
    ? '#10B981'
    : '#EF4444';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          borderLeftWidth: 4,
          borderLeftColor: account.color || (isCredit ? '#EF4444' : theme.primary),
          borderWidth: 1.5,
        },
      ]}
    >
      <View style={styles.leftRow}>
        <View style={[styles.iconContainer, { backgroundColor: `${account.color || '#6366F1'}22` }]}>
          <Ionicons
            name={account.icon || (isCredit ? 'card-outline' : 'business-outline')}
            size={20}
            color={account.color || (isCredit ? '#EF4444' : theme.primary)}
          />
        </View>
        <View style={styles.infoCol}>
          <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
            {account.name}
          </Text>
          <Text style={[styles.accountNumber, { color: theme.textSecondary }]}>
            {account.type} • {account.number || 'Primary'}
          </Text>
          {Array.isArray(account.aliases) && account.aliases.length > 0 && (
            <Text style={[styles.aliasText, { color: theme.accent }]}>
              IDs: {account.aliases.map((a) => `**${a}`).join(', ')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightRow}>
        <Text style={[styles.balanceText, { color: balanceColor }]}>
          {isCredit && balanceVal > 0 ? '-' : ''}
          {formatCurrency(balanceVal)}
        </Text>
        <TouchableOpacity
          style={[styles.adjustBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
          onPress={() => onAdjustPress && onAdjustPress(account)}
          activeOpacity={0.7}
        >
          <Text style={[styles.adjustBtnText, { color: theme.accent }]}>Override</Text>
          <Ionicons name="create-outline" size={12} color={theme.accent} style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(AccountItem);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  accountNumber: {
    fontSize: 12,
    fontWeight: '500',
  },
  aliasText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  rightRow: {
    alignItems: 'flex-end',
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  adjustBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
