import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import { confirmAction, notifyAction } from '../utils/dialogs';

export default function AccountsManagerModal({ visible, onClose }) {
  const {
    accounts,
    theme,
    updateAccount,
    deleteAccount,
    addAccount,
    mergeAccounts,
  } = useFinance();

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'debit' | 'credit' | 'wallet'
  const [editingAccount, setEditingAccount] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');

  // Merge modal states
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [primaryAccId, setPrimaryAccId] = useState('');
  const [sourceAccId, setSourceAccId] = useState('');

  // Add account states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNumber, setAddNumber] = useState('');
  const [addCategory, setAddCategory] = useState('debit');
  const [addBalance, setAddBalance] = useState('0');

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    if (activeFilter === 'ALL') return accounts;
    if (activeFilter === 'wallet') {
      return accounts.filter((a) => a.ledgerCategory === 'wallet' || a.ledgerCategory === 'cash');
    }
    return accounts.filter((a) => a.ledgerCategory === activeFilter);
  }, [accounts, activeFilter]);

  // Aggregate totals
  const totalBankAssets = useMemo(() => {
    return accounts
      .filter((a) => a.ledgerCategory === 'debit')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const totalCreditDebt = useMemo(() => {
    return accounts
      .filter((a) => a.ledgerCategory === 'credit')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  // Actions
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

  const handleDelete = (acc) => {
    confirmAction(
      'Delete Ledger Account',
      `Are you sure you want to delete "${acc.name}"? Transactions associated with this account will also be deleted.`,
      async () => {
        await deleteAccount(acc.id);
        notifyAction('Account Deleted', `"${acc.name}" was removed.`, { type: 'info' });
      },
      { type: 'danger', confirmText: 'Yes, Delete Account' }
    );
  };

  const handleOpenMerge = (preselectedPrimary = null) => {
    if (accounts.length < 2) {
      notifyAction('Cannot Merge', 'You need at least 2 accounts to use the Club / Merge feature.', { type: 'warning' });
      return;
    }
    const firstPrimary = preselectedPrimary ? preselectedPrimary.id : accounts[0]?.id;
    const remaining = accounts.filter((a) => a.id !== firstPrimary);
    setPrimaryAccId(firstPrimary);
    setSourceAccId(remaining[0]?.id || '');
    setShowMergeModal(true);
  };

  const handleExecuteMerge = async () => {
    if (!primaryAccId || !sourceAccId || primaryAccId === sourceAccId) {
      notifyAction('Invalid Selection', 'Please select two different accounts to club.', { type: 'warning' });
      return;
    }

    const pAcc = accounts.find((a) => a.id === primaryAccId);
    const sAcc = accounts.find((a) => a.id === sourceAccId);

    confirmAction(
      'Confirm Ledger Merge',
      `Club "${sAcc?.name}" into "${pAcc?.name}"?\n\n• Both identifiers will be linked as aliases.\n• All past transactions will belong to "${pAcc?.name}".\n• Balances will be combined.`,
      async () => {
        try {
          const res = await mergeAccounts(primaryAccId, sourceAccId);
          if (res.success) {
            notifyAction(
              'Accounts Clubbed Successfully!',
              `"${sAcc?.name}" was merged into "${pAcc?.name}". Combined Balance: ${formatCurrency(res.mergedAccount.balance)}`,
              { type: 'success' }
            );
            setShowMergeModal(false);
          }
        } catch (err) {
          notifyAction('Merge Error', err.message, { type: 'danger' });
        }
      },
      { type: 'warning', confirmText: 'Yes, Merge Ledgers' }
    );
  };

  const handleCreateAccount = async () => {
    if (!addName.trim()) {
      notifyAction('Missing Name', 'Please enter an account name.', { type: 'warning' });
      return;
    }
    const digits = addNumber.replace(/\D/g, '').slice(-4);
    const formattedNum = digits ? `**${digits}` : addNumber.trim() || '**0000';
    await addAccount({
      name: `${addName.trim()}${digits ? ` (**${digits})` : ''}`,
      number: formattedNum,
      ledgerCategory: addCategory,
      balance: parseFloat(addBalance) || 0,
      aliases: digits ? [digits] : [],
    });
    notifyAction('Account Created', `"${addName.trim()}" ledger created.`, { type: 'success' });
    setShowAddModal(false);
    setAddName('');
    setAddNumber('');
    setAddBalance('0');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Accounts & Ledgers</Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
              {accounts.length} active ledgers • Club duplicate identifiers
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.cardSubtle }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Overview Balance Cards */}
          <View style={styles.overviewRow}>
            <View style={[styles.overviewCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.overviewLabel, { color: theme.textMuted }]}>BANK ASSETS</Text>
              <Text style={[styles.overviewAmount, { color: '#10B981' }]}>
                +{formatCurrency(totalBankAssets)}
              </Text>
            </View>

            <View style={[styles.overviewCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.overviewLabel, { color: theme.textMuted }]}>CREDIT CARD DEBT</Text>
              <Text style={[styles.overviewAmount, { color: '#EF4444' }]}>
                -{formatCurrency(Math.abs(totalCreditDebt))}
              </Text>
            </View>
          </View>

          {/* Quick Action Bar: Club / Merge Accounts & Add Account */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.clubBtn, { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: '#6366F1' }]}
              onPress={() => handleOpenMerge()}
              activeOpacity={0.75}
            >
              <Ionicons name="git-merge-outline" size={16} color="#6366F1" style={{ marginRight: 6 }} />
              <Text style={[styles.clubBtnText, { color: '#6366F1' }]}>Club / Merge 2 Accounts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.addBtnText}>New Account</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {[
              { id: 'ALL', label: `All (${accounts.length})` },
              { id: 'debit', label: `Bank A/Cs (${accounts.filter((a) => a.ledgerCategory === 'debit').length})` },
              { id: 'credit', label: `Credit Cards (${accounts.filter((a) => a.ledgerCategory === 'credit').length})` },
              { id: 'wallet', label: `Wallets & Cash (${accounts.filter((a) => a.ledgerCategory === 'wallet' || a.ledgerCategory === 'cash').length})` },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: activeFilter === f.id ? theme.primary : theme.cardSubtle,
                    borderColor: activeFilter === f.id ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: activeFilter === f.id ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Accounts List */}
          <View style={styles.accountsList}>
            {filteredAccounts.map((acc) => {
              const isCredit = acc.ledgerCategory === 'credit';
              const isPositive = (acc.balance || 0) >= 0;
              const balanceColor = isCredit
                ? '#EF4444' // Credit card debt is always red!
                : isPositive
                ? '#10B981' // Positive bank balance is green
                : '#EF4444'; // Overdraft/negative is red

              return (
                <View
                  key={acc.id}
                  style={[
                    styles.accCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                      borderLeftColor: acc.color || (isCredit ? '#EF4444' : theme.primary),
                    },
                  ]}
                >
                  <View style={styles.accCardTop}>
                    <View style={[styles.accIconBadge, { backgroundColor: `${acc.color || '#6366F1'}20` }]}>
                      <Ionicons
                        name={acc.icon || (isCredit ? 'card-outline' : 'business-outline')}
                        size={18}
                        color={acc.color || (isCredit ? '#EF4444' : theme.primary)}
                      />
                    </View>

                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.accName, { color: theme.text }]} numberOfLines={1}>
                        {acc.name}
                      </Text>
                      <Text style={[styles.accNumber, { color: theme.textSecondary }]}>
                        {acc.type} • {acc.number || 'Primary'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.accBalance, { color: balanceColor }]}>
                        {isCredit && (acc.balance || 0) > 0 ? '-' : ''}
                        {formatCurrency(acc.balance || 0)}
                      </Text>
                      <View
                        style={[
                          styles.catBadge,
                          {
                            backgroundColor: isCredit
                              ? 'rgba(239, 68, 68, 0.12)'
                              : acc.ledgerCategory === 'cash' || acc.ledgerCategory === 'wallet'
                              ? 'rgba(16, 185, 129, 0.12)'
                              : theme.primaryLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catBadgeText,
                            {
                              color: isCredit
                                ? '#EF4444'
                                : acc.ledgerCategory === 'cash' || acc.ledgerCategory === 'wallet'
                                ? '#10B981'
                                : theme.accent,
                            },
                          ]}
                        >
                          {isCredit ? 'Credit Card' : acc.ledgerCategory === 'cash' ? 'Cash' : acc.ledgerCategory === 'wallet' ? 'Wallet' : 'Bank Account'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Aliases / Linked Identifiers */}
                  {Array.isArray(acc.aliases) && acc.aliases.length > 0 && (
                    <View style={styles.aliasesRow}>
                      <Text style={[styles.aliasLabel, { color: theme.textMuted }]}>Linked IDs:</Text>
                      {acc.aliases.map((al, idx) => (
                        <View key={idx} style={[styles.aliasChip, { backgroundColor: theme.cardSubtle }]}>
                          <Text style={[styles.aliasChipText, { color: theme.accent }]}>**{al}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Card Action Buttons */}
                  <View style={[styles.accCardBottom, { borderTopColor: theme.border }]}>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => handleOpenEdit(acc)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.actionItemText, { color: theme.textSecondary }]}>Rename</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => handleOpenMerge(acc)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="git-merge-outline" size={14} color="#6366F1" style={{ marginRight: 4 }} />
                      <Text style={[styles.actionItemText, { color: '#6366F1' }]}>Club Account</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => handleDelete(acc)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.danger} style={{ marginRight: 4 }} />
                      <Text style={[styles.actionItemText, { color: theme.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* MODAL 1: Rename / Edit Account */}
        <Modal visible={!!editingAccount} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Rename Ledger Account</Text>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                Change the display name or card/bank identifier
              </Text>

              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>ACCOUNT NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="e.g. Kotak Salary Account (**6574)"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>IDENTIFIER / NUMBER</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={editNumber}
                onChangeText={setEditNumber}
                placeholder="e.g. **6574"
                placeholderTextColor={theme.textMuted}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setEditingAccount(null)}
                >
                  <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MODAL 2: Club / Merge Two Accounts */}
        <Modal visible={showMergeModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder, maxHeight: '85%' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <Ionicons name="git-merge" size={20} color="#6366F1" />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Club / Merge 2 Accounts</Text>
              </View>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                Unify two account records into one. For example: if **8417 and **417 are the same bank ledger, clubbing them combines both balances and links their IDs.
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
                {/* Step 1: Select Primary Account */}
                <Text style={[styles.inputLabel, { color: theme.textMuted }]}>1. KEEP AS PRIMARY LEDGER:</Text>
                <View style={styles.pickerContainer}>
                  {accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.pickerItem,
                        {
                          backgroundColor: primaryAccId === acc.id ? 'rgba(99, 102, 241, 0.15)' : theme.cardSubtle,
                          borderColor: primaryAccId === acc.id ? '#6366F1' : theme.border,
                        },
                      ]}
                      onPress={() => {
                        setPrimaryAccId(acc.id);
                        if (sourceAccId === acc.id) {
                          const remaining = accounts.find((a) => a.id !== acc.id);
                          setSourceAccId(remaining ? remaining.id : '');
                        }
                      }}
                    >
                      <Text style={[styles.pickerItemText, { color: primaryAccId === acc.id ? '#6366F1' : theme.text }]}>
                        {acc.name} ({formatCurrency(acc.balance || 0)})
                      </Text>
                      {primaryAccId === acc.id && <Ionicons name="checkmark-circle" size={16} color="#6366F1" />}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Step 2: Select Secondary Account to Merge */}
                <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 14 }]}>
                  2. SECONDARY ACCOUNT TO MERGE & REMOVE:
                </Text>
                <View style={styles.pickerContainer}>
                  {accounts
                    .filter((a) => a.id !== primaryAccId)
                    .map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.pickerItem,
                          {
                            backgroundColor: sourceAccId === acc.id ? 'rgba(239, 68, 68, 0.12)' : theme.cardSubtle,
                            borderColor: sourceAccId === acc.id ? '#EF4444' : theme.border,
                          },
                        ]}
                        onPress={() => setSourceAccId(acc.id)}
                      >
                        <Text style={[styles.pickerItemText, { color: sourceAccId === acc.id ? '#EF4444' : theme.text }]}>
                          {acc.name} ({formatCurrency(acc.balance || 0)})
                        </Text>
                        {sourceAccId === acc.id && <Ionicons name="checkmark-circle" size={16} color="#EF4444" />}
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowMergeModal(false)}
                >
                  <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: '#6366F1' }]}
                  onPress={handleExecuteMerge}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Merge Ledgers</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL 3: Create New Account */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Ledger Account</Text>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                Add a new bank account, credit card, cash, or wallet
              </Text>

              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>ACCOUNT / BANK NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={addName}
                onChangeText={setAddName}
                placeholder="e.g. Axis Bank, HDFC Card, Cash"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>LAST 4 DIGITS / NUMBER</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={addNumber}
                onChangeText={setAddNumber}
                placeholder="e.g. 9876"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>LEDGER CATEGORY</Text>
              <View style={styles.catSelectRow}>
                {[
                  { id: 'debit', label: 'Bank A/C' },
                  { id: 'credit', label: 'Credit Card' },
                  { id: 'cash', label: 'Cash' },
                  { id: 'wallet', label: 'Wallet' },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: addCategory === c.id ? theme.primaryLight : theme.cardSubtle,
                        borderColor: addCategory === c.id ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setAddCategory(c.id)}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        { color: addCategory === c.id ? theme.accent : theme.textSecondary },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>OPENING BALANCE (₹)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                value={addBalance}
                onChangeText={setAddBalance}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleCreateAccount}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  overviewCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  overviewAmount: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  clubBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  clubBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  accountsList: {
    gap: 10,
  },
  accCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderLeftWidth: 4,
  },
  accCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  accName: {
    fontSize: 14,
    fontWeight: '800',
  },
  accNumber: {
    fontSize: 11,
    marginTop: 2,
  },
  accBalance: {
    fontSize: 14,
    fontWeight: '800',
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  aliasesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  aliasLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  aliasChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  aliasChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  accCardBottom: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionItemText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    borderWidth: 1,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickerContainer: {
    gap: 6,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pickerItemText: {
    fontSize: 12,
    fontWeight: '700',
  },
  catSelectRow: {
    flexDirection: 'row',
    gap: 6,
  },
  catChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  catChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
