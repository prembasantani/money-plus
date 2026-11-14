import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import NetWorthCard from '../components/NetWorthCard';
import TransactionItem from '../components/TransactionItem';
import SkeletonLoader from '../components/SkeletonLoader';
import { confirmAction, notifyAction } from '../utils/dialogs';
import { formatCurrency } from '../utils/formatters';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    accounts,
    transactions,
    categories,
    isLoading,
    totalNetWorth,
    monthlyInflow,
    monthlyOutflow,
    deleteTransaction,
    updateTransactionComment,
    theme,
    themeMode,
    toggleTheme,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxType, setSelectedTxType] = useState('ALL'); // ALL, EXPENSE, INCOME, TRANSFER
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('ALL'); // 'ALL' | 'THIS_MONTH' | 'PREV_MONTH'
  const [selectedDateFilter, setSelectedDateFilter] = useState(null); // 'YYYY-MM-DD' or null
  const [selectedAccountFilter, setSelectedAccountFilter] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [onlyWithComments, setOnlyWithComments] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(40);

  // Comment Modal state
  const [commentModalTx, setCommentModalTx] = useState(null);
  const [commentInput, setCommentInput] = useState('');

  // Calendar month boundary markers
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  const startOfThisMonth = useMemo(() => new Date(currentYear, currentMonthIdx, 1, 0, 0, 0, 0), [currentYear, currentMonthIdx]);
  const endOfThisMonth = useMemo(() => new Date(currentYear, currentMonthIdx + 1, 0, 23, 59, 59, 999), [currentYear, currentMonthIdx]);

  const startOfPrevMonth = useMemo(() => new Date(currentYear, currentMonthIdx - 1, 1, 0, 0, 0, 0), [currentYear, currentMonthIdx]);
  const endOfPrevMonth = useMemo(() => new Date(currentYear, currentMonthIdx, 0, 23, 59, 59, 999), [currentYear, currentMonthIdx]);

  const thisMonthLabel = now.toLocaleDateString('en-IN', { month: 'short' });
  const prevMonthLabel = new Date(currentYear, currentMonthIdx - 1, 1).toLocaleDateString('en-IN', { month: 'short' });

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

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Account filter (set when tapping account badge)
      if (selectedAccountFilter && tx.accountId !== selectedAccountFilter) {
        return false;
      }

      // 2. Category filter (set when tapping category icon)
      if (selectedCategoryFilter && tx.categoryId !== selectedCategoryFilter) {
        return false;
      }

      // 3. Comments only filter
      if (onlyWithComments && (!tx.comment || !tx.comment.trim())) {
        return false;
      }

      // 4. Transaction type filter
      if (selectedTxType === 'EXPENSE' && (tx.type !== 'expense' || tx.categoryId === 'cat_transfer')) return false;
      if (selectedTxType === 'INCOME' && (tx.type !== 'income' || tx.categoryId === 'cat_transfer')) return false;
      if (selectedTxType === 'TRANSFER' && tx.categoryId !== 'cat_transfer') return false;

      // 5. Month filter (Calendar Month: 1st 00:00:00 to last day 23:59:59)
      const txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) return false;

      if (selectedMonthFilter === 'THIS_MONTH') {
        if (txDate < startOfThisMonth || txDate > endOfThisMonth) return false;
      } else if (selectedMonthFilter === 'PREV_MONTH') {
        if (txDate < startOfPrevMonth || txDate > endOfPrevMonth) return false;
      }

      // 6. Day filter (specific YYYY-MM-DD day)
      if (selectedDateFilter) {
        const txDateKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;
        if (txDateKey !== selectedDateFilter) return false;
      }

      // 7. Search query (matches counterparty, note, comment, or account name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCp = (tx.counterparty || '').toLowerCase().includes(q);
        const matchNote = (tx.note || '').toLowerCase().includes(q);
        const matchComment = (tx.comment || '').toLowerCase().includes(q);
        const matchAcc = (accountMap[tx.accountId]?.name || '').toLowerCase().includes(q);
        return matchCp || matchNote || matchComment || matchAcc;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions,
    selectedAccountFilter,
    selectedCategoryFilter,
    onlyWithComments,
    selectedTxType,
    selectedMonthFilter,
    selectedDateFilter,
    startOfThisMonth,
    endOfThisMonth,
    startOfPrevMonth,
    endOfPrevMonth,
    searchQuery,
    accountMap,
  ]);

  // Group transactions by calendar day (with day labels and daily totals)
  const groupedTransactions = useMemo(() => {
    const groups = [];
    const dateMap = {};

    const itemsToGroup = filteredTransactions.slice(0, displayLimit);

    itemsToGroup.forEach((tx) => {
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return;
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!dateMap[dateKey]) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const isToday =
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear();

        const isYesterday =
          d.getDate() === yesterday.getDate() &&
          d.getMonth() === yesterday.getMonth() &&
          d.getFullYear() === yesterday.getFullYear();

        let label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        if (isToday) {
          label = `Today • ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
        } else if (isYesterday) {
          label = `Yesterday • ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
        }

        dateMap[dateKey] = {
          dateKey,
          label,
          items: [],
          dayInflow: 0,
          dayOutflow: 0,
        };
        groups.push(dateMap[dateKey]);
      }

      dateMap[dateKey].items.push(tx);
      if (!tx.isReminder && tx.categoryId !== 'cat_transfer') {
        if (tx.type === 'income') {
          dateMap[dateKey].dayInflow += tx.amount;
        } else if (tx.type === 'expense') {
          dateMap[dateKey].dayOutflow += tx.amount;
        }
      }
    });

    return groups;
  }, [filteredTransactions, displayLimit]);

  const handleDeleteTransaction = useCallback(
    (id) => {
      confirmAction(
        'Delete Transaction',
        'Are you sure you want to delete this record? Account balance will be reverted.',
        async () => {
          await deleteTransaction(id);
          notifyAction('Transaction Deleted', 'Reverted account balance and removed from ledger.', {
            type: 'info',
            icon: 'trash-outline',
          });
        }
      );
    },
    [deleteTransaction]
  );

  const handleOpenCommentModal = (tx) => {
    setCommentModalTx(tx);
    setCommentInput(tx.comment || '');
  };

  const handleSaveComment = async () => {
    if (!commentModalTx) return;
    await updateTransactionComment(commentModalTx.id, commentInput.trim());
    notifyAction('Comment Saved', 'Custom description updated on transaction.', { type: 'success' });
    setCommentModalTx(null);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Bar / Header */}
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <View style={[styles.brandIcon, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="wallet" size={20} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.appName, { color: theme.text }]}>Money+</Text>
              <Text style={[styles.tagline, { color: theme.textSecondary }]}>High-Performance Ledger Tracker</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
              onPress={toggleTheme}
              activeOpacity={0.7}
              accessibilityLabel="Toggle Theme"
            >
              <Ionicons
                name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={themeMode === 'dark' ? '#F59E0B' : '#6366F1'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Net Worth Card (Balance hidden by default as requested) */}
        <NetWorthCard
          totalNetWorth={totalNetWorth}
          monthlyInflow={monthlyInflow}
          monthlyOutflow={monthlyOutflow}
          onSyncPress={() => navigation.navigate('Sync')}
          onAdjustPress={() => navigation.navigate('Adjust', { mode: 'OVERRIDE' })}
        />

        {/* Transaction History Section */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>TRANSACTION HISTORY</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Tap account or category on any item to filter
            </Text>
          </View>
          <Text style={[styles.sectionCount, { color: theme.accent }]}>
            {filteredTransactions.length} Records
          </Text>
        </View>

        {/* Active Filter Chips (if an account, category, month, or day is selected) */}
        {(selectedAccountFilter || selectedCategoryFilter || onlyWithComments || selectedDateFilter || selectedMonthFilter !== 'ALL') && (
          <View style={styles.activeFiltersRow}>
            {selectedMonthFilter !== 'ALL' && (
              <TouchableOpacity
                style={[styles.activeFilterChip, { backgroundColor: 'rgba(124, 58, 237, 0.15)', borderColor: '#7C3AED' }]}
                onPress={() => setSelectedMonthFilter('ALL')}
              >
                <Text style={[styles.activeFilterText, { color: '#7C3AED' }]}>
                  {selectedMonthFilter === 'THIS_MONTH' ? `Month: ${thisMonthLabel}` : `Month: ${prevMonthLabel}`} ✕
                </Text>
              </TouchableOpacity>
            )}

            {selectedDateFilter && (
              <TouchableOpacity
                style={[styles.activeFilterChip, { backgroundColor: 'rgba(2, 132, 199, 0.15)', borderColor: '#0284C7' }]}
                onPress={() => setSelectedDateFilter(null)}
              >
                <Text style={[styles.activeFilterText, { color: '#0284C7' }]}>
                  Day: {selectedDateFilter} ✕
                </Text>
              </TouchableOpacity>
            )}

            {selectedAccountFilter && (
              <TouchableOpacity
                style={[styles.activeFilterChip, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
                onPress={() => setSelectedAccountFilter(null)}
              >
                <Text style={[styles.activeFilterText, { color: theme.primary }]}>
                  Account: {accountMap[selectedAccountFilter]?.name || 'Account'} ✕
                </Text>
              </TouchableOpacity>
            )}

            {selectedCategoryFilter && (
              <TouchableOpacity
                style={[styles.activeFilterChip, { backgroundColor: 'rgba(236, 72, 153, 0.15)', borderColor: '#EC4899' }]}
                onPress={() => setSelectedCategoryFilter(null)}
              >
                <Text style={[styles.activeFilterText, { color: '#EC4899' }]}>
                  Category: {categoryMap[selectedCategoryFilter]?.name || 'Category'} ✕
                </Text>
              </TouchableOpacity>
            )}

            {onlyWithComments && (
              <TouchableOpacity
                style={[styles.activeFilterChip, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}
                onPress={() => setOnlyWithComments(false)}
              >
                <Text style={[styles.activeFilterText, { color: '#F59E0B' }]}>
                  With Comments Only ✕
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.clearAllFiltersBtn}
              onPress={() => {
                setSelectedAccountFilter(null);
                setSelectedCategoryFilter(null);
                setOnlyWithComments(false);
                setSelectedMonthFilter('ALL');
                setSelectedDateFilter(null);
              }}
            >
              <Text style={[styles.clearAllFiltersText, { color: theme.textMuted }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Ionicons name="search-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search merchant, comments, notes, account..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 1. Month Filter Pills Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthPillsRow}>
          {[
            { id: 'ALL', label: 'All Dates' },
            { id: 'THIS_MONTH', label: `This Month (${thisMonthLabel})` },
            { id: 'PREV_MONTH', label: `Last Month (${prevMonthLabel})` },
          ].map((m) => {
            const isActive = selectedMonthFilter === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.monthPill,
                  {
                    backgroundColor: isActive ? theme.accent : theme.card,
                    borderColor: isActive ? theme.accent : theme.cardBorder,
                  },
                ]}
                onPress={() => {
                  setSelectedMonthFilter(m.id);
                  setSelectedDateFilter(null);
                }}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={isActive ? '#FFFFFF' : theme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.monthPillText,
                    { color: isActive ? '#FFFFFF' : theme.textSecondary, fontWeight: isActive ? '700' : '600' },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2. Transaction Type & Comments Filter Pills Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'EXPENSE', label: 'Expenses (-)' },
            { id: 'INCOME', label: 'Income (+)' },
            { id: 'TRANSFER', label: 'Transfers (🔄)' },
          ].map((f) => {
            const isActive = selectedTxType === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.primary : theme.card,
                    borderColor: isActive ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => setSelectedTxType(f.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isActive ? '#FFFFFF' : theme.textSecondary, fontWeight: isActive ? '700' : '600' },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* With Comments Quick Filter */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              {
                backgroundColor: onlyWithComments ? '#F59E0B' : theme.card,
                borderColor: onlyWithComments ? '#F59E0B' : theme.cardBorder,
              },
            ]}
            onPress={() => setOnlyWithComments(!onlyWithComments)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: onlyWithComments ? '#FFFFFF' : theme.textSecondary, fontWeight: onlyWithComments ? '700' : '600' },
              ]}
            >
              💬 Comments
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Transactions List Grouped by Day */}
        {isLoading ? (
          <SkeletonLoader count={4} />
        ) : filteredTransactions.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Ionicons name="receipt-outline" size={38} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Transactions Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery || selectedAccountFilter || selectedCategoryFilter || selectedDateFilter || selectedMonthFilter !== 'ALL'
                ? 'Try clearing active filters or search terms.'
                : 'Tap "Sync SMS Logs" above to import your bank transactions!'}
            </Text>
          </View>
        ) : (
          groupedTransactions.map((group) => (
            <View key={group.dateKey} style={styles.dayGroupContainer}>
              {/* Day Header with Daily Subtotal Badges */}
              <View style={[styles.dayGroupHeader, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.dayGroupHeaderLeft}
                  onPress={() => setSelectedDateFilter(selectedDateFilter === group.dateKey ? null : group.dateKey)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={13} color={theme.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.dayGroupTitle, { color: theme.text }]}>
                    {group.label}
                  </Text>
                  <Text style={[styles.dayItemCount, { color: theme.textMuted }]}>
                    ({group.items.length})
                  </Text>
                </TouchableOpacity>

                <View style={styles.dayGroupHeaderRight}>
                  {group.dayInflow > 0 && (
                    <Text style={[styles.dayFlowBadge, { color: theme.success }]}>
                      +{formatCurrency(group.dayInflow)}
                    </Text>
                  )}
                  {group.dayOutflow > 0 && (
                    <Text style={[styles.dayFlowBadge, { color: theme.danger, marginLeft: 6 }]}>
                      -{formatCurrency(group.dayOutflow)}
                    </Text>
                  )}
                </View>
              </View>

              {group.items.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  category={categoryMap[tx.categoryId]}
                  account={accountMap[tx.accountId]}
                  onDelete={handleDeleteTransaction}
                  onEditComment={handleOpenCommentModal}
                  onSelectAccount={(accId) => setSelectedAccountFilter(accId)}
                  onSelectCategory={(catId) => setSelectedCategoryFilter(catId)}
                />
              ))}
            </View>
          ))
        )}

        {/* Load More Button if over displayLimit */}
        {filteredTransactions.length > displayLimit && (
          <TouchableOpacity
            style={[styles.loadMoreBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
            onPress={() => setDisplayLimit((prev) => prev + 30)}
            activeOpacity={0.7}
          >
            <Text style={[styles.loadMoreText, { color: theme.accent }]}>
              Load More ({filteredTransactions.length - displayLimit} remaining)
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Comment Modal */}
      {commentModalTx && (
        <Modal visible={!!commentModalTx} transparent animationType="fade" onRequestClose={() => setCommentModalTx(null)}>
          <View style={styles.dialogOverlay}>
            <View style={[styles.dialogBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.dialogHeader}>
                <Ionicons name="chatbubble-ellipses" size={20} color={theme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.dialogTitle, { color: theme.text }]}>Transaction Comment</Text>
              </View>
              <Text style={[styles.dialogSub, { color: theme.textSecondary }]}>
                {commentModalTx.counterparty} • {formatCurrency(commentModalTx.amount)}
              </Text>

              <TextInput
                style={[styles.dialogInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Add a custom note or description (e.g. Dinner with friends)..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                autoFocus
              />

              <View style={styles.dialogBtnRow}>
                <TouchableOpacity style={[styles.dialogCancelBtn, { borderColor: theme.border }]} onPress={() => setCommentModalTx(null)}>
                  <Text style={[styles.dialogCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dialogConfirmBtn, { backgroundColor: theme.primary }]} onPress={handleSaveComment}>
                  <Text style={styles.dialogConfirmText}>Save Comment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearAllFiltersBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  clearAllFiltersText: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  monthPillsRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  monthPillText: {
    fontSize: 11,
  },
  filterPillsRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11.5,
  },
  dayGroupContainer: {
    marginBottom: 6,
  },
  dayGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  dayGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayItemCount: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  dayGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayFlowBadge: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  emptyContainer: {
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  loadMoreBtn: {
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogBox: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  dialogSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 12,
  },
  dialogInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  dialogCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  dialogCancelText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  dialogConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dialogConfirmText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
