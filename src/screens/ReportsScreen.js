import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import TransactionItem from '../components/TransactionItem';

const PERIOD_MODES = [
  { id: 'DAILY', label: 'Daily' },
  { id: 'WEEKLY', label: 'Weekly' },
  { id: 'MONTHLY', label: 'Monthly' },
  { id: 'YEARLY', label: 'Yearly' },
  { id: 'CUSTOM', label: 'Custom' },
];

const CUSTOM_PRESETS = [
  { id: '7D', label: 'Last 7 Days', days: 7 },
  { id: '30D', label: 'Last 30 Days', days: 30 },
  { id: '90D', label: 'Last 90 Days', days: 90 },
  { id: 'ALL', label: 'All Time', days: 3650 },
];

export default function ReportsScreen({ navigation }) {
  const { transactions, accounts, categories, theme } = useFinance();

  const [periodMode, setPeriodMode] = useState('MONTHLY');
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = current, -1 = previous, etc.
  const [customPreset, setCustomPreset] = useState('30D');
  const [drillDownCategory, setDrillDownCategory] = useState(null);
  const [drillDownAccount, setDrillDownAccount] = useState(null);

  // Detailed Transaction Report Filter & Grouping States
  const [reportAccountFilter, setReportAccountFilter] = useState('ALL');
  const [reportCategoryFilter, setReportCategoryFilter] = useState('ALL');
  const [reportGrouping, setReportGrouping] = useState('DAILY'); // 'DAILY' | 'WEEKLY' | 'MONTHLY'

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [categories]);

  const accountMap = useMemo(() => {
    const map = {};
    accounts.forEach((a) => {
      map[a.id] = a;
    });
    return map;
  }, [accounts]);

  // Compute date range based on period mode and offset
  const { rangeStart, rangeEnd, periodLabel } = useMemo(() => {
    const now = new Date();

    if (periodMode === 'DAILY') {
      const current = new Date(now);
      current.setDate(now.getDate() + periodOffset);
      const start = new Date(current);
      start.setHours(0, 0, 0, 0);
      const end = new Date(current);
      end.setHours(23, 59, 59, 999);

      const dayName = current.toLocaleDateString('en-IN', { weekday: 'short' });
      const dateStr = `${current.getDate()} ${current.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
      const label =
        periodOffset === 0
          ? `Today (${dateStr})`
          : periodOffset === -1
          ? `Yesterday (${dateStr})`
          : `${dayName}, ${dateStr}`;

      return {
        rangeStart: start,
        rangeEnd: end,
        periodLabel: label,
      };
    }

    if (periodMode === 'WEEKLY') {
      const current = new Date(now);
      current.setDate(now.getDate() + periodOffset * 7);
      const day = current.getDay();
      const start = new Date(current);
      start.setDate(current.getDate() - day);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const startStr = `${start.getDate()} ${start.toLocaleDateString('en-IN', { month: 'short' })}`;
      const endStr = `${end.getDate()} ${end.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;

      return {
        rangeStart: start,
        rangeEnd: end,
        periodLabel: periodOffset === 0 ? `This Week (${startStr} - ${endStr})` : `${startStr} - ${endStr}`,
      };
    }

    if (periodMode === 'MONTHLY') {
      const start = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1, 0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthName = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return {
        rangeStart: start,
        rangeEnd: end,
        periodLabel: periodOffset === 0 ? `This Month (${monthName})` : monthName,
      };
    }

    if (periodMode === 'YEARLY') {
      const year = now.getFullYear() + periodOffset;
      const start = new Date(year, 0, 1, 0, 0, 0, 0);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);

      return {
        rangeStart: start,
        rangeEnd: end,
        periodLabel: periodOffset === 0 ? `This Year (${year})` : `Year ${year}`,
      };
    }

    // Custom Range Preset
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const preset = CUSTOM_PRESETS.find((p) => p.id === customPreset) || CUSTOM_PRESETS[1];
    const start = new Date(now);
    start.setDate(now.getDate() - preset.days);
    start.setHours(0, 0, 0, 0);

    return {
      rangeStart: start,
      rangeEnd: end,
      periodLabel: preset.label,
    };
  }, [periodMode, periodOffset, customPreset]);

  // Filter transactions within range (excluding reminders from financial spend/income aggregates)
  const filteredTx = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (tx.isReminder) return false;
        const txDate = new Date(tx.date);
        if (isNaN(txDate.getTime())) return false;
        return txDate >= rangeStart && txDate <= rangeEnd;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, rangeStart, rangeEnd]);

  // Financial aggregates
  const {
    totalExpense,
    totalIncome,
    netSavings,
    savingsRate,
    dailyAverageSpend,
    highestSpendDay,
    categoryBreakdown,
    accountBreakdown,
    topMerchants,
    trendBars,
  } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    const catTotals = {};
    const accTotals = {};
    const merchantTotals = {};
    const dayTotals = {};

    filteredTx.forEach((tx) => {
      const amt = tx.amount || 0;
      if (tx.type === 'expense') {
        exp += amt;

        // Category
        const cId = tx.categoryId || 'cat_other';
        if (!catTotals[cId]) catTotals[cId] = { amount: 0, count: 0 };
        catTotals[cId].amount += amt;
        catTotals[cId].count += 1;

        // Merchant
        const m = (tx.counterparty || 'General Expense').trim();
        if (!merchantTotals[m]) merchantTotals[m] = { amount: 0, count: 0 };
        merchantTotals[m].amount += amt;
        merchantTotals[m].count += 1;

        // Day
        const dKey = new Date(tx.date).toISOString().split('T')[0];
        dayTotals[dKey] = (dayTotals[dKey] || 0) + amt;
      } else if (tx.type === 'income') {
        inc += amt;
      }

      // Account activity
      const aId = tx.accountId;
      if (aId) {
        if (!accTotals[aId]) accTotals[aId] = { expense: 0, income: 0, count: 0 };
        if (tx.type === 'expense') accTotals[aId].expense += amt;
        else if (tx.type === 'income') accTotals[aId].income += amt;
        accTotals[aId].count += 1;
      }
    });

    const net = inc - exp;
    const rate = inc > 0 ? Math.max(0, Math.round((net / inc) * 100)) : 0;

    // Days in period
    const diffDays = Math.max(1, Math.round((rangeEnd - rangeStart) / (24 * 3600 * 1000)));
    const avgDaily = exp / diffDays;

    // Highest spend day
    let highestDay = { date: 'None', amount: 0 };
    Object.entries(dayTotals).forEach(([dStr, val]) => {
      if (val > highestDay.amount) {
        highestDay = { date: dStr, amount: val };
      }
    });

    // Category sorted list
    const catList = Object.entries(catTotals)
      .map(([id, data]) => ({
        id,
        category: categoryMap[id] || { name: 'Other', icon: 'card', color: '#94A3B8' },
        amount: data.amount,
        count: data.count,
        percent: exp > 0 ? Math.round((data.amount / exp) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Account sorted list
    const accList = Object.entries(accTotals)
      .map(([id, data]) => ({
        id,
        account: accountMap[id] || { name: 'Bank Account', icon: 'wallet-outline', color: '#6366F1' },
        expense: data.expense,
        income: data.income,
        count: data.count,
      }))
      .sort((a, b) => b.expense - a.expense);

    // Top 5 merchants
    const merchantList = Object.entries(merchantTotals)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Trend bars (e.g. 7 days or 4 weeks or 12 months)
    const bars = [];
    if (periodMode === 'WEEKLY') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(rangeStart);
        d.setDate(rangeStart.getDate() + i);
        const k = d.toISOString().split('T')[0];
        bars.push({
          label: days[d.getDay()],
          amount: dayTotals[k] || 0,
        });
      }
    } else {
      // Group into 4-5 buckets
      const bucketCount = periodMode === 'YEARLY' ? 12 : 4;
      const stepMs = (rangeEnd - rangeStart) / bucketCount;
      for (let i = 0; i < bucketCount; i++) {
        const bStart = new Date(rangeStart.getTime() + i * stepMs);
        const bEnd = new Date(rangeStart.getTime() + (i + 1) * stepMs);

        let bucketSum = 0;
        filteredTx.forEach((tx) => {
          if (tx.type === 'expense') {
            const t = new Date(tx.date).getTime();
            if (t >= bStart.getTime() && t < bEnd.getTime()) {
              bucketSum += tx.amount;
            }
          }
        });

        const label =
          periodMode === 'YEARLY'
            ? bStart.toLocaleDateString('en-IN', { month: 'short' })
            : `Wk ${i + 1}`;
        bars.push({ label, amount: bucketSum });
      }
    }

    const maxBar = Math.max(...bars.map((b) => b.amount), 1);
    const normalizedBars = bars.map((b) => ({
      ...b,
      heightPercent: Math.max(8, Math.round((b.amount / maxBar) * 100)),
    }));

    return {
      totalExpense: exp,
      totalIncome: inc,
      netSavings: net,
      savingsRate: rate,
      dailyAverageSpend: avgDaily,
      highestSpendDay: highestDay,
      categoryBreakdown: catList,
      accountBreakdown: accList,
      topMerchants: merchantList,
      trendBars: normalizedBars,
    };
  }, [filteredTx, rangeStart, rangeEnd, periodMode, categoryMap, accountMap]);

  // Grouped transaction report for day-to-day, weekly, and monthly drill-down
  const groupedTransactions = useMemo(() => {
    const filtered = filteredTx.filter((tx) => {
      if (reportAccountFilter !== 'ALL' && tx.accountId !== reportAccountFilter) return false;
      if (reportCategoryFilter !== 'ALL' && tx.categoryId !== reportCategoryFilter) return false;
      return true;
    });

    const groupsMap = {};

    filtered.forEach((tx) => {
      const d = new Date(tx.date);
      let key = '';
      let title = '';

      if (reportGrouping === 'DAILY') {
        key = d.toISOString().slice(0, 10);
        const dayStr = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        title = dayStr;
      } else if (reportGrouping === 'WEEKLY') {
        const weekNum = Math.ceil(d.getDate() / 7);
        const monthStr = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        key = `${d.getFullYear()}_W${Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))}`;
        title = `Week ${weekNum} of ${monthStr}`;
      } else {
        key = `${d.getFullYear()}_${d.getMonth()}`;
        title = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }

      if (!groupsMap[key]) {
        groupsMap[key] = {
          key,
          title,
          totalExpense: 0,
          totalIncome: 0,
          catSpends: {},
          accSpends: {},
          items: [],
        };
      }

      groupsMap[key].items.push(tx);
      const amt = tx.amount || 0;
      if (tx.type === 'expense' && tx.categoryId !== 'cat_transfer') {
        groupsMap[key].totalExpense += amt;
        const catName = categoryMap[tx.categoryId]?.name || 'Other';
        groupsMap[key].catSpends[catName] = (groupsMap[key].catSpends[catName] || 0) + amt;
        const accName = accountMap[tx.accountId]?.name || 'Account';
        groupsMap[key].accSpends[accName] = (groupsMap[key].accSpends[accName] || 0) + amt;
      } else if (tx.type === 'income' && tx.categoryId !== 'cat_transfer') {
        groupsMap[key].totalIncome += amt;
      }
    });

    return Object.values(groupsMap).map((g) => {
      const topCat = Object.entries(g.catSpends).sort((a, b) => b[1] - a[1])[0];
      const topAcc = Object.entries(g.accSpends).sort((a, b) => b[1] - a[1])[0];
      let summaryHighlights = '';
      if (topCat && topAcc) {
        summaryHighlights = `Top: ₹${topCat[1].toFixed(0)} on ${topCat[0]} via ${topAcc[0]}`;
      } else if (topCat) {
        summaryHighlights = `Top: ₹${topCat[1].toFixed(0)} on ${topCat[0]}`;
      }
      return {
        ...g,
        summaryHighlights,
      };
    });
  }, [filteredTx, reportAccountFilter, reportCategoryFilter, reportGrouping, categoryMap, accountMap]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.headerIconBadge, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="bar-chart" size={20} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Reports & Analytics</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Category breakdowns, cashflow charts & parameters
              </Text>
            </View>
          </View>
        </View>

        {/* Period Selector Tabs */}
        <View style={[styles.periodTabsRow, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
          {PERIOD_MODES.map((mode) => {
            const isSelected = periodMode === mode.id;
            return (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.periodTab,
                  isSelected && { backgroundColor: theme.primary, shadowColor: theme.primary },
                ]}
                onPress={() => {
                  setPeriodMode(mode.id);
                  setPeriodOffset(0);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    { color: isSelected ? '#FFFFFF' : theme.textSecondary, fontWeight: isSelected ? '700' : '600' },
                  ]}
                >
                  {mode.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Period Navigation Bar */}
        {periodMode !== 'CUSTOM' ? (
          <View style={[styles.periodNavBar, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[styles.navArrowBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
              onPress={() => setPeriodOffset((prev) => prev - 1)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color={theme.text} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.periodNavLabel, { color: theme.text }]}>{periodLabel}</Text>
              <Text style={[styles.periodNavSub, { color: theme.textMuted }]}>
                {filteredTx.length} transactions recorded
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.navArrowBtn,
                { backgroundColor: theme.cardSubtle, borderColor: theme.border },
                periodOffset >= 0 && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (periodOffset < 0) setPeriodOffset((prev) => prev + 1);
              }}
              disabled={periodOffset >= 0}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={16} color={theme.text} />
            </TouchableOpacity>
          </View>
        ) : (
          /* Custom Preset Selector */
          <View style={styles.customPresetsRow}>
            {CUSTOM_PRESETS.map((preset) => {
              const isSelected = customPreset === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.customChip,
                    { backgroundColor: isSelected ? theme.primaryLight : theme.card, borderColor: isSelected ? theme.primary : theme.border },
                    isSelected && { borderWidth: 1.5 },
                  ]}
                  onPress={() => setCustomPreset(preset.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.customChipText,
                      { color: isSelected ? theme.accent : theme.textSecondary, fontWeight: isSelected ? '700' : '600' },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* KPI Summary Cards Grid */}
        <View style={styles.kpiGrid}>
          {/* Total Expense */}
          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderTopWidth: 3, borderTopColor: theme.danger }]}>
            <View style={styles.kpiTop}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]} numberOfLines={1}>
                OUTFLOW
              </Text>
              <Ionicons name="arrow-up-circle" size={15} color={theme.danger} />
            </View>
            <Text style={[styles.kpiAmount, { color: theme.danger }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalExpense)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textSecondary }]} numberOfLines={1}>
              Avg {formatCurrency(dailyAverageSpend)} / day
            </Text>
          </View>

          {/* Total Income */}
          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderTopWidth: 3, borderTopColor: theme.success }]}>
            <View style={styles.kpiTop}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]} numberOfLines={1}>
                INFLOW
              </Text>
              <Ionicons name="arrow-down-circle" size={15} color={theme.success} />
            </View>
            <Text style={[styles.kpiAmount, { color: theme.success }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalIncome)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textSecondary }]} numberOfLines={1}>
              Savings: {savingsRate}%
            </Text>
          </View>
        </View>

        {/* Net Savings & Flow Card */}
        <View style={[styles.netCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.netHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.netLabel, { color: theme.textMuted }]}>NET CASH MOVEMENT</Text>
              <Text style={[styles.netAmount, { color: netSavings >= 0 ? theme.success : theme.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                {netSavings >= 0 ? `+${formatCurrency(netSavings)}` : formatCurrency(netSavings)}
              </Text>
            </View>
            <View style={[styles.netBadge, { backgroundColor: netSavings >= 0 ? theme.successLight : theme.dangerLight }]}>
              <Text style={[styles.netBadgeText, { color: netSavings >= 0 ? theme.success : theme.danger }]}>
                {netSavings >= 0 ? 'Surplus' : 'Deficit'}
              </Text>
            </View>
          </View>

          {/* Cashflow visual comparison bar */}
          <View style={[styles.flowBarBg, { backgroundColor: theme.cardSubtle }]}>
            <View
              style={[
                styles.flowBarExpense,
                {
                  backgroundColor: theme.danger,
                  flex: totalExpense > 0 ? totalExpense : 0.01,
                },
              ]}
            />
            <View
              style={[
                styles.flowBarIncome,
                {
                  backgroundColor: theme.success,
                  flex: totalIncome > 0 ? totalIncome : 0.01,
                },
              ]}
            />
          </View>
          <View style={styles.flowLegendRow}>
            <View style={styles.flowLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.danger }]} />
              <Text style={[styles.legendText, { color: theme.danger }]} numberOfLines={1}>
                Expense: {formatCurrency(totalExpense)}
              </Text>
            </View>
            <View style={styles.flowLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.legendText, { color: theme.success }]} numberOfLines={1}>
                Income: {formatCurrency(totalIncome)}
              </Text>
            </View>
          </View>
        </View>

        {/* Visual Rhythm / Trend Bar Graph */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="trending-up-outline" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Spending Rhythm</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Expenditure pattern across {periodLabel}
              </Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <View style={styles.barsRow}>
              {trendBars.map((bar, idx) => (
                <View key={idx} style={styles.barCol}>
                  <Text style={[styles.barValueText, { color: theme.textMuted }]}>
                    {bar.amount > 0 ? `₹${Math.round(bar.amount / 1000)}k` : ''}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: theme.cardSubtle }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${bar.heightPercent}%`,
                          backgroundColor: bar.amount > 0 ? theme.primary : 'transparent',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabelText, { color: theme.textSecondary }]}>
                    {bar.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Category Breakdown Section */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
              <Ionicons name="pie-chart-outline" size={16} color="#EC4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Category Breakdown</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Sorted by highest expenditure
              </Text>
            </View>
          </View>

          {/* Segmented Distribution Bar */}
          {categoryBreakdown.length > 0 ? (
            <View style={styles.segmentedBar}>
              {categoryBreakdown.map((cat) => (
                <View
                  key={cat.id}
                  style={{
                    backgroundColor: cat.category.color,
                    flex: Math.max(1, cat.percent),
                    height: 8,
                  }}
                />
              ))}
            </View>
          ) : null}

          {categoryBreakdown.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No expenses recorded in this period.
            </Text>
          ) : (
            categoryBreakdown.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.categoryRow, { borderBottomColor: theme.border }]}
                onPress={() => setDrillDownCategory(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.catIconBox, { backgroundColor: `${item.category.color}22` }]}>
                  <Ionicons name={item.category.icon} size={16} color={item.category.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.catNameRow}>
                    <Text style={[styles.catName, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {item.category.name}
                    </Text>
                    <Text style={[styles.catAmount, { color: theme.text }]} numberOfLines={1}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                  <View style={styles.catProgressRow}>
                    <View style={[styles.catProgressTrack, { backgroundColor: theme.cardSubtle }]}>
                      <View
                        style={[
                          styles.catProgressBar,
                          { backgroundColor: item.category.color, width: `${Math.min(100, Math.max(2, item.percent))}%` },
                        ]}
                      />
                    </View>
                    <Text style={[styles.catPercentText, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.percent}% ({item.count} {item.count === 1 ? 'txn' : 'txns'})
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Account Activity Breakdown */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
              <Ionicons name="wallet-outline" size={16} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Account & Bank Activity</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Flow across active wallets and accounts
              </Text>
            </View>
          </View>

          {accountBreakdown.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No account activity for this period.
            </Text>
          ) : (
            accountBreakdown.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.accountActivityRow,
                  {
                    backgroundColor: theme.cardSubtle,
                    borderColor: theme.border,
                    borderLeftColor: item.account.color || theme.primary,
                    borderLeftWidth: 4,
                  },
                ]}
                onPress={() => setDrillDownAccount(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.accountIconBox, { backgroundColor: `${item.account.color || theme.primary}20` }]}>
                  <Ionicons name={item.account.icon || 'card-outline'} size={18} color={item.account.color || theme.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={[styles.accountActName, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.account.name}
                  </Text>
                  <Text style={[styles.accountActSub, { color: theme.textMuted }]} numberOfLines={1}>
                    {item.count} {item.count === 1 ? 'Transaction' : 'Transactions'} • Tap to view
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  {item.expense > 0 && (
                    <Text style={[styles.accExpenseText, { color: theme.danger }]} numberOfLines={1}>
                      -{formatCurrency(item.expense)}
                    </Text>
                  )}
                  {item.income > 0 && (
                    <Text style={[styles.accIncomeText, { color: theme.success }]} numberOfLines={1}>
                      +{formatCurrency(item.income)}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Top Counterparties / Merchants */}
        {topMerchants.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="ribbon-outline" size={16} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Spends</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  Largest counterparty destinations
                </Text>
              </View>
            </View>

            {topMerchants.map((m, idx) => (
              <View key={idx} style={[styles.merchantItemRow, { borderBottomColor: theme.border }]}>
                <View style={[styles.rankBadge, { backgroundColor: theme.cardSubtle }]}>
                  <Text style={[styles.rankText, { color: theme.accent }]}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={[styles.merchantItemName, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
                    {m.name}
                  </Text>
                  <Text style={[styles.merchantItemSub, { color: theme.textMuted }]} numberOfLines={1}>
                    {m.count} {m.count === 1 ? 'payment' : 'payments'}
                  </Text>
                </View>
                <Text style={[styles.merchantItemAmount, { color: theme.danger }]} numberOfLines={1}>
                  -{formatCurrency(m.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Detailed Transaction Report with Grouping & Filters */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="receipt-outline" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Detailed Transaction Report</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Grouped breakdown with bank and category filters
              </Text>
            </View>
          </View>

          {/* Grouping selector pills: Day-to-Day / Weekly / Monthly */}
          <Text style={[styles.filterGroupTitle, { color: theme.textMuted }]}>GROUP BY</Text>
          <View style={[styles.groupingTabsRow, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
            {[
              { id: 'DAILY', label: 'Day-to-Day' },
              { id: 'WEEKLY', label: 'Weekly' },
              { id: 'MONTHLY', label: 'Monthly' },
            ].map((g) => {
              const active = reportGrouping === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[
                    styles.groupingTab,
                    active && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setReportGrouping(g.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.groupingTabText,
                      { color: active ? '#FFFFFF' : theme.textSecondary, fontWeight: active ? '700' : '600' },
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Account Filter horizontal pills */}
          <Text style={[styles.filterGroupTitle, { color: theme.textMuted, marginTop: 12 }]}>FILTER BY BANK ACCOUNT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            <TouchableOpacity
              style={[
                styles.reportFilterChip,
                {
                  backgroundColor: reportAccountFilter === 'ALL' ? theme.primaryLight : theme.cardSubtle,
                  borderColor: reportAccountFilter === 'ALL' ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setReportAccountFilter('ALL')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.reportFilterChipText,
                  { color: reportAccountFilter === 'ALL' ? theme.primary : theme.textSecondary, fontWeight: reportAccountFilter === 'ALL' ? '700' : '600' },
                ]}
              >
                All Accounts
              </Text>
            </TouchableOpacity>

            {accounts.map((acc) => {
              const active = reportAccountFilter === acc.id;
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.reportFilterChip,
                    {
                      backgroundColor: active ? theme.primaryLight : theme.cardSubtle,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setReportAccountFilter(acc.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.reportFilterChipText,
                      { color: active ? theme.primary : theme.textSecondary, fontWeight: active ? '700' : '600' },
                    ]}
                  >
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category Filter horizontal pills */}
          <Text style={[styles.filterGroupTitle, { color: theme.textMuted, marginTop: 12 }]}>FILTER BY CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            <TouchableOpacity
              style={[
                styles.reportFilterChip,
                {
                  backgroundColor: reportCategoryFilter === 'ALL' ? theme.primaryLight : theme.cardSubtle,
                  borderColor: reportCategoryFilter === 'ALL' ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setReportCategoryFilter('ALL')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.reportFilterChipText,
                  { color: reportCategoryFilter === 'ALL' ? theme.primary : theme.textSecondary, fontWeight: reportCategoryFilter === 'ALL' ? '700' : '600' },
                ]}
              >
                All Categories
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const active = reportCategoryFilter === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.reportFilterChip,
                    {
                      backgroundColor: active ? theme.primaryLight : theme.cardSubtle,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setReportCategoryFilter(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.reportFilterChipText,
                      { color: active ? theme.primary : theme.textSecondary, fontWeight: active ? '700' : '600' },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Grouped results */}
          <View style={{ marginTop: 16 }}>
            {groupedTransactions.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No transactions found matching selected report filters.
              </Text>
            ) : (
              groupedTransactions.map((grp) => (
                <View key={grp.key} style={[styles.reportGroupCard, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
                  {/* Group header with summary stats */}
                  <View style={[styles.reportGroupHeader, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.reportGroupTitle, { color: theme.text }]}>{grp.title}</Text>
                      {grp.summaryHighlights ? (
                        <Text style={[styles.reportGroupHighlights, { color: theme.textSecondary }]}>
                          {grp.summaryHighlights}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {grp.totalExpense > 0 && (
                        <Text style={[styles.reportGroupExpense, { color: theme.danger }]}>
                          -{formatCurrency(grp.totalExpense)}
                        </Text>
                      )}
                      {grp.totalIncome > 0 && (
                        <Text style={[styles.reportGroupIncome, { color: theme.success }]}>
                          +{formatCurrency(grp.totalIncome)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Transactions inside this group */}
                  <View style={{ paddingVertical: 4 }}>
                    {grp.items.map((tx) => (
                      <TransactionItem
                        key={tx.id}
                        transaction={tx}
                        category={categoryMap[tx.categoryId]}
                        account={accountMap[tx.accountId]}
                        onSelectCategory={(cId) => {
                          const catObj = categoryMap[cId];
                          if (catObj) setDrillDownCategory({ id: cId, category: catObj, count: 1, amount: tx.amount, percent: 0 });
                        }}
                        onSelectAccount={(aId) => {
                          const accObj = accountMap[aId];
                          if (accObj) setDrillDownAccount({ id: aId, account: accObj, count: 1, expense: tx.type === 'expense' ? tx.amount : 0, income: tx.type === 'income' ? tx.amount : 0 });
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Category Drill-Down Internal View */}
      {drillDownCategory && (
        <Modal
          visible={!!drillDownCategory}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setDrillDownCategory(null)}
        >
          <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.drillHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.drillBackBtn, { backgroundColor: theme.cardSubtle }]}
                onPress={() => setDrillDownCategory(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.drillBackText, { color: theme.text }]}>Back</Text>
              </TouchableOpacity>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.drillPeriodText, { color: theme.textSecondary }]}>{periodLabel}</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }}>
              <View
                style={[
                  styles.drillSummaryCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                    borderLeftColor: drillDownCategory.category.color,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                <View style={[styles.catIconBox, { backgroundColor: `${drillDownCategory.category.color}22`, width: 44, height: 44, borderRadius: 12 }]}>
                  <Ionicons name={drillDownCategory.category.icon} size={22} color={drillDownCategory.category.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.drillCatTitle, { color: theme.text }]}>{drillDownCategory.category.name}</Text>
                  <Text style={[styles.drillCatSub, { color: theme.textSecondary }]}>
                    {drillDownCategory.percent}% of total expenses • {drillDownCategory.count} transaction(s)
                  </Text>
                </View>
                <Text style={[styles.drillTotalAmount, { color: theme.danger }]}>
                  {formatCurrency(drillDownCategory.amount)}
                </Text>
              </View>

              <Text style={[styles.drillSectionTitle, { color: theme.textMuted }]}>
                TRANSACTIONS IN THIS PERIOD ({drillDownCategory.count})
              </Text>

              {filteredTx
                .filter((tx) => tx.categoryId === drillDownCategory.id)
                .map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    category={drillDownCategory.category}
                    account={accountMap[tx.accountId]}
                  />
                ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Account Drill-Down Internal View */}
      {drillDownAccount && (
        <Modal
          visible={!!drillDownAccount}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setDrillDownAccount(null)}
        >
          <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.drillHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.drillBackBtn, { backgroundColor: theme.cardSubtle }]}
                onPress={() => setDrillDownAccount(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.drillBackText, { color: theme.text }]}>Back</Text>
              </TouchableOpacity>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.drillPeriodText, { color: theme.textSecondary }]}>{periodLabel}</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }}>
              <View
                style={[
                  styles.drillSummaryCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                    borderLeftColor: drillDownAccount.account.color || theme.primary,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                <View style={[styles.accountIconBox, { backgroundColor: `${drillDownAccount.account.color || theme.primary}22`, width: 44, height: 44, borderRadius: 12 }]}>
                  <Ionicons name={drillDownAccount.account.icon || 'card-outline'} size={22} color={drillDownAccount.account.color || theme.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.drillCatTitle, { color: theme.text }]}>{drillDownAccount.account.name}</Text>
                  <Text style={[styles.drillCatSub, { color: theme.textSecondary }]}>
                    Account Activity in {periodLabel}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {drillDownAccount.expense > 0 && (
                    <Text style={[styles.drillTotalAmount, { color: theme.danger }]}>
                      -{formatCurrency(drillDownAccount.expense)}
                    </Text>
                  )}
                  {drillDownAccount.income > 0 && (
                    <Text style={[styles.drillTotalAmount, { color: theme.success }]}>
                      +{formatCurrency(drillDownAccount.income)}
                    </Text>
                  )}
                </View>
              </View>

              <Text style={[styles.drillSectionTitle, { color: theme.textMuted }]}>
                ACCOUNT TRANSACTIONS IN THIS PERIOD
              </Text>

              {filteredTx
                .filter((tx) => tx.accountId === drillDownAccount.id)
                .map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    category={categoryMap[tx.categoryId]}
                    account={drillDownAccount.account}
                  />
                ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  drillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  drillBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },
  drillBackText: {
    fontSize: 13,
    fontWeight: '700',
  },
  drillPeriodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  drillSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  drillCatTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  drillCatSub: {
    fontSize: 11,
    marginTop: 2,
  },
  drillTotalAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  drillSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  periodTabsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabText: {
    fontSize: 12,
  },
  periodNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  periodNavLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  periodNavSub: {
    fontSize: 11,
    marginTop: 2,
  },
  customPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  customChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  customChipText: {
    fontSize: 11,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    minWidth: 0,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  kpiAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  kpiSub: {
    fontSize: 11,
  },
  netCard: {
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  netHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  netLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  netAmount: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
  },
  netBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  netBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  flowBarBg: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  flowBarExpense: {
    height: '100%',
  },
  flowBarIncome: {
    height: '100%',
  },
  flowLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  flowLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  chartContainer: {
    marginTop: 8,
    paddingTop: 8,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingHorizontal: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 80,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabelText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  segmentedBar: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  catNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  catProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  catPercentText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
  accountActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  accountIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  accountActName: {
    fontSize: 13,
    fontWeight: '700',
  },
  accountActSub: {
    fontSize: 11,
    marginTop: 2,
  },
  accExpenseText: {
    fontSize: 12,
    fontWeight: '700',
  },
  accIncomeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  merchantItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  merchantItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  merchantItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  merchantItemAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterGroupTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  groupingTabsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    marginBottom: 8,
  },
  groupingTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupingTabText: {
    fontSize: 11,
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  reportFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  reportFilterChipText: {
    fontSize: 11,
  },
  reportGroupCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 10,
  },
  reportGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
  },
  reportGroupTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  reportGroupHighlights: {
    fontSize: 11,
    marginTop: 2,
  },
  reportGroupExpense: {
    fontSize: 13,
    fontWeight: '800',
  },
  reportGroupIncome: {
    fontSize: 13,
    fontWeight: '800',
  },
});
