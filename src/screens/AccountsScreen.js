import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { confirmAction, notifyAction } from '../utils/dialogs';
import TransactionItem from '../components/TransactionItem';

export default function AccountsScreen({ navigation }) {
  const {
    accounts,
    transactions,
    categories,
    theme,
    updateAccount,
    deleteAccount,
    addAccount,
    mergeAccounts,
    deleteTransaction,
  } = useFinance();

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'debit' | 'credit' | 'wallet'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountForTx, setSelectedAccountForTx] = useState(null);

  // Edit account modal
  const [editingAccount, setEditingAccount] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');

  // Add account modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNumber, setAddNumber] = useState('');
  const [addCategory, setAddCategory] = useState('debit');
  const [addBalance, setAddBalance] = useState('0');

  // Merge modal
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [primaryAccId, setPrimaryAccId] = useState('');
  const [sourceAccId, setSourceAccId] = useState('');

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

  // Aggregate totals
  const totalAssets = useMemo(() => {
    return accounts
      .filter((a) => a.ledgerCategory === 'debit' || a.ledgerCategory === 'wallet' || a.ledgerCategory === 'cash')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const totalCreditDebt = useMemo(() => {
    return accounts
      .filter((a) => a.ledgerCategory === 'credit')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (activeFilter !== 'ALL') {
        if (activeFilter === 'wallet') {
          if (acc.ledgerCategory !== 'wallet' && acc.ledgerCategory !== 'cash') return false;
        } else if (acc.ledgerCategory !== activeFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (acc.name || '').toLowerCase().includes(q);
        const matchNum = (acc.number || '').toLowerCase().includes(q);
        return matchName || matchNum;
      }

      return true;
    });
  }, [accounts, activeFilter, searchQuery]);

  // Transactions belonging to selected account
  const accountTransactions = useMemo(() => {
    if (!selectedAccountForTx) return [];
    return transactions.filter((t) => t.accountId === selectedAccountForTx.id);
  }, [transactions, selectedAccountForTx]);

  const handleOpenEdit = (acc) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditNumber(acc.number || '');
  };

  const handleSaveEdit = async () => {
    if (!editingAccount || !editName.trim()) return;
    await updateAccount(editingAccount.id, {
      name: editName.trim(),
      number: editNumber.trim() || editingAccount.number,
    });
    notifyAction('Account Updated', `"${editName.trim()}" details have been updated.`, { type: 'success' });
    setEditingAccount(null);
  };

  const handleDeleteAccount = (acc) => {
    confirmAction(
      'Delete Account',
      `Are you sure you want to delete "${acc.name}"? Transactions associated with this account will also be removed.`,
      async () => {
        await deleteAccount(acc.id);
        notifyAction('Account Deleted', `"${acc.name}" was removed.`, { type: 'info', icon: 'trash-outline' });
        if (selectedAccountForTx?.id === acc.id) {
          setSelectedAccountForTx(null);
        }
      }
    );
  };

  const handleCreateAccount = async () => {
    if (!addName.trim()) {
      notifyAction('Missing Name', 'Please enter an account name.', { type: 'warning' });
      return;
    }

    const startingBal = parseFloat(addBalance.trim()) || 0;
    await addAccount({
      name: addName.trim(),
      number: addNumber.trim() ? (addNumber.trim().startsWith('**') ? addNumber.trim() : `**${addNumber.trim()}`) : '**Manual',
      ledgerCategory: addCategory,
      type: addCategory === 'credit' ? 'Credit Card' : addCategory === 'cash' ? 'Cash' : addCategory === 'wallet' ? 'Digital Wallet' : 'Bank Account',
      balance: startingBal,
    });

    notifyAction('Account Created', `"${addName.trim()}" ledger created.`, { type: 'success' });
    setAddName('');
    setAddNumber('');
    setAddBalance('0');
    setShowAddModal(false);
  };

  const handleMergeAccounts = async () => {
    if (!primaryAccId || !sourceAccId) {
      notifyAction('Select Accounts', 'Please select both master and source accounts to club.', { type: 'warning' });
      return;
    }
    if (primaryAccId === sourceAccId) {
      notifyAction('Invalid Selection', 'Please select two different accounts.', { type: 'warning' });
      return;
    }

    const primary = accounts.find((a) => a.id === primaryAccId);
    const source = accounts.find((a) => a.id === sourceAccId);

    confirmAction(
      'Club Accounts',
      `Merge "${source?.name}" into master account "${primary?.name}"? All transactions will be re-assigned.`,
      async () => {
        const res = await mergeAccounts(primaryAccId, sourceAccId);
        if (res.success) {
          notifyAction('Accounts Clubbed', `Transactions merged into ${primary?.name}.`, { type: 'success' });
          setShowMergeModal(false);
        } else {
          notifyAction('Merge Error', res.error || 'Failed to merge accounts.', { type: 'danger' });
        }
      }
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Accounts & Ledgers</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {accounts.length} active ledgers • Tap any account to view entries
            </Text>
          </View>

          <View style={styles.headerBtnGroup}>
            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={16} color={theme.primary} />
              <Text style={[styles.headerActionBtnText, { color: theme.primary }]}>Add</Text>
            </TouchableOpacity>

            {accounts.length >= 2 && (
              <TouchableOpacity
                style={[styles.headerActionBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
                onPress={() => setShowMergeModal(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="git-merge-outline" size={15} color={theme.textSecondary} />
                <Text style={[styles.headerActionBtnText, { color: theme.textSecondary }]}>Club</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>TOTAL ASSETS (BANKS & CASH)</Text>
            <Text style={[styles.summaryValue, { color: theme.success }]}>{formatCurrency(totalAssets)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>CREDIT CARD LIABILITIES</Text>
            <Text style={[styles.summaryValue, { color: theme.danger }]}>{formatCurrency(totalCreditDebt)}</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[
            { id: 'ALL', label: `All (${accounts.length})` },
            { id: 'debit', label: `Banks (${accounts.filter((a) => a.ledgerCategory === 'debit').length})` },
            { id: 'credit', label: `Credit Cards (${accounts.filter((a) => a.ledgerCategory === 'credit').length})` },
            { id: 'wallet', label: `Wallets / Cash (${accounts.filter((a) => a.ledgerCategory === 'wallet' || a.ledgerCategory === 'cash').length})` },
          ].map((tab) => {
            const isSel = activeFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSel ? theme.primary : theme.cardSubtle,
                    borderColor: isSel ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setActiveFilter(tab.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, { color: isSel ? '#FFFFFF' : theme.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Input */}
        <View style={[styles.searchBox, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search account name or last digits (e.g. 1074)..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Accounts List */}
        <View style={styles.accountsList}>
          {filteredAccounts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={36} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No accounts match your filter.</Text>
            </View>
          ) : (
            filteredAccounts.map((acc) => {
              const txCount = transactions.filter((t) => t.accountId === acc.id).length;
              const isCredit = acc.ledgerCategory === 'credit';
              const balanceColor = isCredit ? (acc.balance > 0 ? theme.danger : theme.text) : (acc.balance >= 0 ? theme.text : theme.danger);

              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                      borderLeftColor: acc.color || theme.primary,
                      borderLeftWidth: 4,
                    },
                  ]}
                  onPress={() => setSelectedAccountForTx(acc)}
                  activeOpacity={0.75}
                >
                  <View style={styles.accountCardHeader}>
                    <View style={[styles.accountIconBox, { backgroundColor: `${acc.color || theme.primary}20` }]}>
                      <Ionicons name={acc.icon || 'card-outline'} size={20} color={acc.color || theme.primary} />
                    </View>

                    <View style={styles.accountNameCol}>
                      <Text style={[styles.accountNameText, { color: theme.text }]} numberOfLines={1}>
                        {acc.name}
                      </Text>
                      <View style={styles.accountMetaRow}>
                        <Text style={[styles.accountNumberBadge, { color: theme.textSecondary }]}>
                          {acc.number || 'Primary'}
                        </Text>
                        <Text style={[styles.dotSeparator, { color: theme.textMuted }]}>•</Text>
                        <Text style={[styles.accountTxCountText, { color: theme.accent }]}>
                          {txCount} {txCount === 1 ? 'entry' : 'entries'} (tap to view)
                        </Text>
                      </View>
                    </View>

                    <View style={styles.accountBalanceCol}>
                      <Text style={[styles.balanceAmountText, { color: balanceColor }]} numberOfLines={1}>
                        {formatCurrency(acc.balance || 0)}
                      </Text>
                      <Text style={[styles.balanceSubText, { color: theme.textMuted }]}>
                        {isCredit ? 'Outstanding' : 'Available'}
                      </Text>
                    </View>
                  </View>

                  {/* Account Quick Action Buttons */}
                  <View style={[styles.accountCardFooter, { borderTopColor: theme.border }]}>
                    <TouchableOpacity
                      style={[styles.accFooterBtn, { backgroundColor: theme.primaryLight }]}
                      onPress={() => navigation.navigate('Adjust', { preselectedAccount: acc.id, mode: 'OVERRIDE' })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="swap-vertical" size={13} color={theme.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.accFooterBtnText, { color: theme.accent }]}>Calibrate Balance</Text>
                    </TouchableOpacity>

                    <View style={styles.footerIconActions}>
                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: theme.cardSubtle }]}
                        onPress={() => handleOpenEdit(acc)}
                        activeOpacity={0.7}
                        accessibilityLabel="Edit account"
                      >
                        <Ionicons name="pencil" size={13} color={theme.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: theme.dangerLight }]}
                        onPress={() => handleDeleteAccount(acc)}
                        activeOpacity={0.7}
                        accessibilityLabel="Delete account"
                      >
                        <Ionicons name="trash-outline" size={13} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Account Transactions Drill-Down Modal */}
      {selectedAccountForTx && (
        <Modal
          visible={!!selectedAccountForTx}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setSelectedAccountForTx(null)}
        >
          <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.backBtn, { backgroundColor: theme.cardSubtle }]}
                onPress={() => setSelectedAccountForTx(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.backBtnText, { color: theme.text }]}>Accounts</Text>
              </TouchableOpacity>

              <View style={styles.modalTitleBox}>
                <Text style={[styles.modalTitleText, { color: theme.text }]} numberOfLines={1}>
                  {selectedAccountForTx.name}
                </Text>
                <Text style={[styles.modalSubtitleText, { color: theme.textSecondary }]}>
                  {selectedAccountForTx.number} • {accountTransactions.length} records
                </Text>
              </View>

              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }}>
              <View
                style={[
                  styles.accountDrillSummary,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                    borderLeftColor: selectedAccountForTx.color || theme.primary,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                <View style={[styles.accountIconBox, { backgroundColor: `${selectedAccountForTx.color || theme.primary}20`, width: 44, height: 44 }]}>
                  <Ionicons name={selectedAccountForTx.icon || 'card-outline'} size={22} color={selectedAccountForTx.color || theme.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.drillAccName, { color: theme.text }]}>{selectedAccountForTx.name}</Text>
                  <Text style={[styles.drillAccSub, { color: theme.textSecondary }]}>
                    Current Ledger Balance
                  </Text>
                </View>
                <Text style={[styles.drillAccBal, { color: theme.text }]}>
                  {formatCurrency(selectedAccountForTx.balance || 0)}
                </Text>
              </View>

              <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>
                ALL ENTRIES FOR THIS ACCOUNT ({accountTransactions.length})
              </Text>

              {accountTransactions.length === 0 ? (
                <View style={[styles.emptyContainer, { marginTop: 40 }]}>
                  <Ionicons name="receipt-outline" size={32} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    No transactions recorded for this account yet.
                  </Text>
                </View>
              ) : (
                accountTransactions.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    category={categoryMap[tx.categoryId]}
                    account={selectedAccountForTx}
                    onDelete={(id) => {
                      confirmAction(
                        'Delete Record',
                        'Are you sure you want to remove this transaction?',
                        () => deleteTransaction(id)
                      );
                    }}
                  />
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <Modal visible={!!editingAccount} transparent animationType="fade" onRequestClose={() => setEditingAccount(null)}>
          <View style={styles.dialogOverlay}>
            <View style={[styles.dialogBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.dialogTitle, { color: theme.text }]}>Edit Account</Text>
              <TextInput
                style={[styles.dialogInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Account Name"
                placeholderTextColor={theme.textMuted}
              />
              <TextInput
                style={[styles.dialogInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text, marginTop: 10 }]}
                value={editNumber}
                onChangeText={setEditNumber}
                placeholder="Account Digits / Identifier (e.g. **1074)"
                placeholderTextColor={theme.textMuted}
              />
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity style={[styles.dialogCancelBtn, { borderColor: theme.border }]} onPress={() => setEditingAccount(null)}>
                  <Text style={[styles.dialogCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dialogConfirmBtn, { backgroundColor: theme.primary }]} onPress={handleSaveEdit}>
                  <Text style={styles.dialogConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
          <View style={styles.dialogOverlay}>
            <View style={[styles.dialogBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.dialogTitle, { color: theme.text }]}>Create Account Ledger</Text>
              <TextInput
                style={[styles.dialogInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={addName}
                onChangeText={setAddName}
                placeholder="Account Name (e.g. State Bank of India)"
                placeholderTextColor={theme.textMuted}
              />
              <TextInput
                style={[styles.dialogInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text, marginTop: 10 }]}
                value={addNumber}
                onChangeText={setAddNumber}
                placeholder="Last Digits (e.g. 1074 or XX1074)"
                placeholderTextColor={theme.textMuted}
              />
              <TextInput
                style={[styles.dialogInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text, marginTop: 10 }]}
                value={addBalance}
                onChangeText={setAddBalance}
                placeholder="Opening Balance (₹)"
                keyboardType="numeric"
                placeholderTextColor={theme.textMuted}
              />

              <View style={styles.categorySelectRow}>
                {['debit', 'credit', 'wallet', 'cash'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catSelectPill,
                      {
                        backgroundColor: addCategory === cat ? theme.primary : theme.cardSubtle,
                        borderColor: addCategory === cat ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setAddCategory(cat)}
                  >
                    <Text style={[styles.catSelectText, { color: addCategory === cat ? '#FFFFFF' : theme.textSecondary }]}>
                      {cat.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.dialogBtnRow}>
                <TouchableOpacity style={[styles.dialogCancelBtn, { borderColor: theme.border }]} onPress={() => setShowAddModal(false)}>
                  <Text style={[styles.dialogCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dialogConfirmBtn, { backgroundColor: theme.primary }]} onPress={handleCreateAccount}>
                  <Text style={styles.dialogConfirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Club / Merge Accounts Modal */}
      {showMergeModal && (
        <Modal visible={showMergeModal} transparent animationType="fade" onRequestClose={() => setShowMergeModal(false)}>
          <View style={styles.dialogOverlay}>
            <View style={[styles.dialogBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.dialogTitle, { color: theme.text }]}>Club / Merge Accounts</Text>
              <Text style={[styles.dialogDesc, { color: theme.textSecondary }]}>
                Re-assign transactions from source account to master account.
              </Text>

              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>SELECT MASTER (RETAINED) ACCOUNT:</Text>
              <ScrollView style={{ maxHeight: 110 }}>
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={`pri_${a.id}`}
                    style={[styles.selectOptionRow, primaryAccId === a.id && { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
                    onPress={() => setPrimaryAccId(a.id)}
                  >
                    <Text style={[styles.selectOptionText, { color: theme.text }]}>{a.name} ({a.number})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 10 }]}>SELECT SOURCE (TO MERGE & REMOVE) ACCOUNT:</Text>
              <ScrollView style={{ maxHeight: 110 }}>
                {accounts.filter((a) => a.id !== primaryAccId).map((a) => (
                  <TouchableOpacity
                    key={`src_${a.id}`}
                    style={[styles.selectOptionRow, sourceAccId === a.id && { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}
                    onPress={() => setSourceAccId(a.id)}
                  >
                    <Text style={[styles.selectOptionText, { color: theme.text }]}>{a.name} ({a.number})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.dialogBtnRow}>
                <TouchableOpacity style={[styles.dialogCancelBtn, { borderColor: theme.border }]} onPress={() => setShowMergeModal(false)}>
                  <Text style={[styles.dialogCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dialogConfirmBtn, { backgroundColor: theme.primary }]} onPress={handleMergeAccounts}>
                  <Text style={styles.dialogConfirmText}>Merge & Club</Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  filterRow: {
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
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  accountsList: {
    gap: 12,
  },
  accountCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountNameCol: {
    flex: 1,
    minWidth: 0,
  },
  accountNameText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  accountMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  accountNumberBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  dotSeparator: {
    marginHorizontal: 5,
    fontSize: 10,
  },
  accountTxCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  accountBalanceCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  balanceAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  balanceSubText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  accountCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  accFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  accFooterBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerIconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  modalTitleBox: {
    alignItems: 'center',
  },
  modalTitleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalSubtitleText: {
    fontSize: 11,
    fontWeight: '500',
  },
  accountDrillSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  drillAccName: {
    fontSize: 15,
    fontWeight: '800',
  },
  drillAccSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  drillAccBal: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 12,
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
  dialogTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  dialogDesc: {
    fontSize: 12,
    marginBottom: 14,
  },
  dialogInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
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
  categorySelectRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  catSelectPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  catSelectText: {
    fontSize: 10,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  selectOptionRow: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  selectOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
