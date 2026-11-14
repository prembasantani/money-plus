import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { confirmAction, notifyAction } from '../utils/dialogs';

export default function IgnoredTransactionsModal({ visible, onClose }) {
  const {
    ignoredTransactions,
    restoreIgnoredTransaction,
    purgeIgnoredTransaction,
    accounts,
    theme,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  // Local overrides for items before accepting: { [itemId]: { type: 'expense'|'income', accountId: string } }
  const [itemConfig, setItemConfig] = useState({});

  const filteredItems = ignoredTransactions.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.counterparty && item.counterparty.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q)) ||
      (item.rawText && item.rawText.toLowerCase().includes(q)) ||
      String(item.amount).includes(q)
    );
  });

  const handleToggleType = (itemId, currentType) => {
    const nextType = currentType === 'expense' ? 'income' : 'expense';
    setItemConfig((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        type: nextType,
      },
    }));
  };

  const handleSelectAccount = (itemId, accountId) => {
    setItemConfig((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        accountId,
      },
    }));
  };

  const handleAcceptItem = async (item) => {
    const cfg = itemConfig[item.id] || {};
    const finalType = cfg.type || item.type || 'expense';
    const finalAccountId = cfg.accountId || item.accountId || (accounts[0] && accounts[0].id) || `acc_${Date.now()}`;

    const targetAccount = accounts.find((a) => a.id === finalAccountId);
    const accName = targetAccount ? targetAccount.name : item.accountName || 'Restored Account';

    await restoreIgnoredTransaction(
      item.id,
      finalAccountId,
      finalType,
      item.categoryId || 'cat_other'
    );

    notifyAction(
      'Transaction Accepted!',
      `Imported ₹${item.amount} as ${finalType.toUpperCase()} into "${accName}". Account balance updated.`,
      { type: 'success', icon: 'checkmark-circle' }
    );
  };

  const handlePurgeItem = (item) => {
    confirmAction(
      'Permanently Delete?',
      'This will remove the transaction from this review list permanently. Its fingerprint will remain blocked from future SMS scans.',
      async () => {
        await purgeIgnoredTransaction(item.id);
        notifyAction('Removed', 'Transaction record purged from review list.', { type: 'info' });
      },
      { type: 'danger', confirmText: 'Yes, Delete' }
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
        {/* Modal Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="eye-off-outline" size={18} color="#EF4444" />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Ignored Transactions</Text>
              <View style={[styles.countBadge, { backgroundColor: theme.dangerLight }]}>
                <Text style={[styles.countBadgeText, { color: theme.danger }]}>{ignoredTransactions.length}</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Review discarded items, switch debit/credit, pick an account, and restore into ledger
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.cardSubtle }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        {ignoredTransactions.length > 3 && (
          <View style={styles.searchContainer}>
            <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search ignored SMS, merchant, or amount..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Content List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBadge, { backgroundColor: theme.successLight }]}>
                <Ionicons name="checkmark-done" size={36} color={theme.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Ignored Transactions</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {searchQuery
                  ? 'No ignored transactions match your search filter.'
                  : 'You have no ignored or dismissed transactions. When you discard an SMS preview item or delete a transaction, it will appear here so you can restore it anytime!'}
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const cfg = itemConfig[item.id] || {};
              const currentType = cfg.type || item.type || 'expense';
              const currentAccountId = cfg.accountId || item.accountId || (accounts[0] && accounts[0].id);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                      borderLeftWidth: 4,
                      borderLeftColor: currentType === 'income' ? theme.success : theme.danger,
                    },
                  ]}
                >
                  {/* Card Header: Amount, Date, and Counterparty */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[styles.counterpartyText, { color: theme.text }]} numberOfLines={1}>
                        {item.counterparty || 'Ignored Transaction'}
                      </Text>
                      <Text style={[styles.dateText, { color: theme.textMuted }]}>
                        {formatDate(item.date)}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.amountText,
                        { color: currentType === 'income' ? theme.success : theme.danger },
                      ]}
                    >
                      {currentType === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </Text>
                  </View>

                  {/* SMS Message Bubble */}
                  {(item.rawText || item.note) ? (
                    <View style={[styles.smsBubble, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="chatbox-ellipses-outline" size={13} color={theme.textSecondary} style={{ marginRight: 5 }} />
                        <Text style={[styles.smsHeader, { color: theme.textSecondary }]}>SMS NOTIFICATION</Text>
                      </View>
                      <Text style={[styles.smsBody, { color: theme.textSecondary }]} numberOfLines={3}>
                        {item.rawText || item.note}
                      </Text>
                    </View>
                  ) : null}

                  {/* Controls: Type Toggle & Account Selector */}
                  <View style={styles.controlsSection}>
                    <Text style={[styles.controlLabel, { color: theme.textMuted }]}>
                      SELECT TRANSACTION TYPE & ACCOUNT:
                    </Text>

                    {/* Debit / Credit Switcher */}
                    <View style={styles.typeToggleRow}>
                      <TouchableOpacity
                        style={[
                          styles.typeToggleBtn,
                          {
                            backgroundColor:
                              currentType === 'expense' ? theme.danger : theme.cardSubtle,
                            borderColor: currentType === 'expense' ? theme.danger : theme.border,
                          },
                        ]}
                        onPress={() => handleToggleType(item.id, 'income')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="arrow-down-circle"
                          size={14}
                          color={currentType === 'expense' ? '#FFFFFF' : theme.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.typeToggleText,
                            { color: currentType === 'expense' ? '#FFFFFF' : theme.textSecondary },
                            currentType === 'expense' && { fontWeight: '800' },
                          ]}
                        >
                          - Debit (Expense)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.typeToggleBtn,
                          {
                            backgroundColor:
                              currentType === 'income' ? theme.success : theme.cardSubtle,
                            borderColor: currentType === 'income' ? theme.success : theme.border,
                          },
                        ]}
                        onPress={() => handleToggleType(item.id, 'expense')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="arrow-up-circle"
                          size={14}
                          color={currentType === 'income' ? '#FFFFFF' : theme.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.typeToggleText,
                            { color: currentType === 'income' ? '#FFFFFF' : theme.textSecondary },
                            currentType === 'income' && { fontWeight: '800' },
                          ]}
                        >
                          + Credit (Income)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Account Selector Chips */}
                    <Text style={[styles.controlLabel, { color: theme.textMuted, marginTop: 10 }]}>
                      ASSIGN TO LEDGER ACCOUNT:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChipsRow}>
                      {/* If the original account was deleted or not in active accounts, show auto-recreate chip */}
                      {!accounts.some((a) => a.id === item.accountId) && item.accountId ? (
                        <TouchableOpacity
                          style={[
                            styles.accChip,
                            {
                              backgroundColor: currentAccountId === item.accountId ? 'rgba(99, 102, 241, 0.2)' : theme.cardSubtle,
                              borderColor: currentAccountId === item.accountId ? '#6366F1' : theme.border,
                              borderWidth: currentAccountId === item.accountId ? 2 : 1,
                            },
                          ]}
                          onPress={() => handleSelectAccount(item.id, item.accountId)}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name="refresh-circle-outline"
                            size={14}
                            color={currentAccountId === item.accountId ? '#6366F1' : theme.textSecondary}
                            style={{ marginRight: 5 }}
                          />
                          <Text
                            style={[
                              styles.accChipText,
                              { color: currentAccountId === item.accountId ? '#6366F1' : theme.textSecondary },
                              currentAccountId === item.accountId && { fontWeight: '700' },
                            ]}
                          >
                            {item.accountName || 'Original Account'} (Auto-Recreate)
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {accounts.map((acc) => {
                        const isSelected = currentAccountId === acc.id;
                        const isWallet = acc.ledgerCategory === 'wallet';
                        const isCredit = acc.ledgerCategory === 'credit';
                        const badgeColor = isCredit ? '#E11D48' : isWallet ? '#06B6D4' : '#3B82F6';

                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.accChip,
                              {
                                backgroundColor: isSelected ? `${badgeColor}25` : theme.cardSubtle,
                                borderColor: isSelected ? badgeColor : theme.border,
                                borderWidth: isSelected ? 2 : 1,
                              },
                            ]}
                            onPress={() => handleSelectAccount(item.id, acc.id)}
                            activeOpacity={0.75}
                          >
                            <Ionicons
                              name={isCredit ? 'card-outline' : isWallet ? 'wallet-outline' : 'business-outline'}
                              size={13}
                              color={isSelected ? badgeColor : theme.textSecondary}
                              style={{ marginRight: 5 }}
                            />
                            <Text
                              style={[
                                styles.accChipText,
                                { color: isSelected ? badgeColor : theme.textSecondary },
                                isSelected && { fontWeight: '700' },
                              ]}
                              numberOfLines={1}
                            >
                              {acc.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Actions Row: Accept into Ledger / Purge */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: theme.primary }]}
                      onPress={() => handleAcceptItem(item)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.acceptBtnText}>Accept & Import into Ledger</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.purgeBtn, { backgroundColor: theme.dangerLight }]}
                      onPress={() => handlePurgeItem(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.75}
                      accessibilityLabel="Permanently Delete"
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  searchContainer: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 60,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  counterpartyText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    marginTop: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  smsBubble: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  smsHeader: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  smsBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  controlsSection: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  typeToggleText: {
    fontSize: 12,
  },
  accountChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  accChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  accChipText: {
    fontSize: 11,
    maxWidth: 120,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  purgeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
