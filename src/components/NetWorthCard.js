import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatters';
import { useFinance } from '../context/FinanceContext';

export default function NetWorthCard({ totalNetWorth, monthlyInflow, monthlyOutflow, onSyncPress, onAdjustPress, monthLabel }) {
  const { theme, currentMonthName } = useFinance();
  const [showBalance, setShowBalance] = useState(false);
  const activeMonth = monthLabel || currentMonthName || '';

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.primary, borderWidth: 2 }]}>
      {/* Background Accent glow */}
      <View style={styles.glowCircle} />

      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={[styles.subTitle, { color: theme.textMuted }]}>TOTAL NET WORTH</Text>
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowBalance(!showBalance)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showBalance ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.badge, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
          <View style={styles.liveDot} />
          <Text style={[styles.badgeText, { color: theme.success }]}>Local Ledger</Text>
        </View>
      </View>

      <Text style={[styles.balanceText, { color: theme.text }]}>
        {showBalance ? formatCurrency(totalNetWorth) : '••••••••'}
      </Text>

      {/* Monthly Inflow / Outflow Summary */}
      <View style={[styles.statsRow, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
        <View style={styles.statBox}>
          <View style={[styles.statIconBox, { backgroundColor: theme.successLight }]}>
            <Ionicons name="arrow-down-outline" size={14} color={theme.success} />
          </View>
          <View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>
              {activeMonth ? `${activeMonth} Income` : 'Month Income'}
            </Text>
            <Text style={[styles.statIncome, { color: theme.success }]}>
              {showBalance ? `+${formatCurrency(monthlyInflow)}` : '••••'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.statBox}>
          <View style={[styles.statIconBox, { backgroundColor: theme.dangerLight }]}>
            <Ionicons name="arrow-up-outline" size={14} color={theme.danger} />
          </View>
          <View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>
              {activeMonth ? `${activeMonth} Spent` : 'Month Spent'}
            </Text>
            <Text style={[styles.statExpense, { color: theme.danger }]}>
              {showBalance ? `-${formatCurrency(monthlyOutflow)}` : '••••'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtnPrimary, { backgroundColor: theme.primary }]}
          onPress={onSyncPress}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnTextPrimary}>Sync SMS Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtnSecondary, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
          onPress={onAdjustPress}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-vertical" size={16} color={theme.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.actionBtnTextSecondary, { color: theme.accent }]}>Adjust Balance</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 22,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glowCircle: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  eyeBtn: {
    marginLeft: 8,
    padding: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  divider: {
    width: 1,
    height: 28,
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statIncome: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  statExpense: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  actionBtnTextSecondary: {
    fontWeight: '600',
    fontSize: 13,
  },
});
