import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import { confirmAction, notifyAction } from '../utils/dialogs';
import AccountsManagerModal from '../components/AccountsManagerModal';
import IgnoredTransactionsModal from '../components/IgnoredTransactionsModal';

export default function SettingsScreen({ navigation }) {
  const {
    accounts,
    transactions,
    totalNetWorth,
    exportBackupJson,
    importBackupJson,
    resetToDemoData,
    clearLedgerData,
    addAccount,
    deleteAccount,
    ignoredTransactions,
    theme,
    themeMode,
    setThemeMode,
  } = useFinance();

  const [importJsonText, setImportJsonText] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedString, setExportedString] = useState('');
  const [showRestoreBox, setShowRestoreBox] = useState(false);
  const [showAccountsManager, setShowAccountsManager] = useState(false);
  const [showIgnoredModal, setShowIgnoredModal] = useState(false);

  // Add Account form states
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccCategory, setNewAccCategory] = useState('debit'); // 'debit' | 'credit' | 'cash' | 'wallet'

  const handleBackupLedger = () => {
    const json = exportBackupJson();
    setExportedString(json);
    setShowExportModal(true);
    notifyAction(
      'Backup Generated!',
      `Snapshot created with ${accounts.length} accounts and ${transactions.length} transactions. You can copy the JSON payload below.`,
      { type: 'success', icon: 'cloud-done-outline' }
    );
  };

  const handleImport = async () => {
    if (!importJsonText.trim()) {
      notifyAction('Empty Input', 'Please paste valid Money+ backup JSON text.', { type: 'warning' });
      return;
    }

    confirmAction(
      'Confirm Restore',
      'Importing will replace your current accounts and transactions with the backup file data. Continue?',
      async () => {
        const res = await importBackupJson(importJsonText);
        if (res.success) {
          notifyAction('Backup Restored', `Restored ${res.count} transactions successfully.`, { type: 'success' });
          setImportJsonText('');
          setShowRestoreBox(false);
          navigation.navigate('Dashboard');
        } else {
          notifyAction('Restore Failed', res.error || 'Invalid JSON backup format.', { type: 'danger' });
        }
      },
      { type: 'warning', confirmText: 'Yes, Restore' }
    );
  };

  const handleClearTestData = () => {
    confirmAction(
      'Clear Test Data & Start Fresh?',
      'This will delete all test ledgers, transactions, and sync queues, keeping ONLY your Cash account (at ₹0.00) so your app is completely clean and fresh.',
      async () => {
        await clearLedgerData();
        notifyAction(
          'Ledger Reset Complete',
          'All transactions and secondary ledgers cleared. Only Cash preserved.',
          { type: 'success', icon: 'sparkles' }
        );
        navigation.navigate('Dashboard');
      },
      { type: 'danger', confirmText: 'Yes, Start Fresh', icon: 'trash-bin' }
    );
  };

  const handleResetData = () => {
    confirmAction(
      'Reset Ledger to Demo Data?',
      'This will restore the original demo sample accounts and seed transactions. Continue?',
      async () => {
        await resetToDemoData();
        notifyAction('Reset Complete', 'Restored to clean demo sample data.', { type: 'success' });
        navigation.navigate('Dashboard');
      },
      { type: 'warning', confirmText: 'Reset Demo Data', icon: 'refresh-circle' }
    );
  };

  const handleDeleteAccount = (accId, accName) => {
    confirmAction(
      'Delete Account',
      `Are you sure you want to remove ${accName}? Any associated transactions will also be removed.`,
      async () => {
        await deleteAccount(accId);
        notifyAction('Account Deleted', `${accName} has been removed.`, { type: 'info' });
      },
      { type: 'danger', confirmText: 'Delete' }
    );
  };

  const handleSaveAccount = async () => {
    if (!newAccName.trim()) {
      notifyAction('Missing Name', 'Please enter a name for the account (e.g. State Bank of India, RBL Credit Card).', { type: 'warning' });
      return;
    }

    const startingBal = parseFloat(newAccBalance.trim()) || 0;
    const defaultType =
      newAccCategory === 'credit'
        ? 'Credit Card'
        : newAccCategory === 'cash'
        ? 'Cash'
        : newAccCategory === 'wallet'
        ? 'Digital Wallet'
        : 'Bank Account';

    await addAccount({
      name: newAccName.trim(),
      number: newAccNumber.trim() || (newAccCategory === 'cash' ? 'Cash' : '**0000'),
      type: defaultType,
      ledgerCategory: newAccCategory,
      balance: startingBal,
    });

    setNewAccName('');
    setNewAccNumber('');
    setNewAccBalance('');
    setNewAccCategory('debit');
    setShowAddAccount(false);
    notifyAction('Account Added', `Account "${newAccName.trim()}" created successfully!`, { type: 'success' });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings & Accounts</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            100% offline device storage, account manager, and theme controls
          </Text>
        </View>

        {/* 1. Manage Accounts & Add Bank Card (KEPT AT THE TOP AS REQUESTED) */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderTopWidth: 3, borderTopColor: theme.primary }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.titleIconBadge, { backgroundColor: 'rgba(2, 132, 199, 0.2)' }]}>
              <Ionicons name="wallet" size={18} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Manage Accounts & Ledgers</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Add Debit cards, Credit cards, Wallets & Cash. SMS sync links to these automatically.
              </Text>
            </View>
          </View>

          {/* Dedicated Club / Merge / Rename Manager Modal Button */}
          <TouchableOpacity
            style={[
              styles.primaryActionBtn,
              { backgroundColor: theme.primary, marginBottom: 14 },
            ]}
            onPress={() => setShowAccountsManager(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="git-merge-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionBtnText}>Manage, Rename & Club Accounts</Text>
          </TouchableOpacity>

          {/* Accounts List */}
          {accounts.map((acc) => {
            const cat = acc.ledgerCategory || 'debit';
            const catColor =
              cat === 'credit'
                ? '#E11D48'
                : cat === 'cash'
                ? '#10B981'
                : cat === 'wallet'
                ? '#06B6D4'
                : '#3B82F6';
            const catLabel =
              cat === 'credit'
                ? 'Credit Card'
                : cat === 'cash'
                ? 'Cash'
                : cat === 'wallet'
                ? 'Wallet'
                : 'Debit A/C';

            return (
              <View
                key={acc.id}
                style={[
                  styles.accountManageItem,
                  {
                    backgroundColor: theme.cardSubtle,
                    borderColor: theme.border,
                    borderLeftWidth: 5,
                    borderLeftColor: acc.color || catColor,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.accountManageName, { color: theme.text }]}>{acc.name}</Text>
                  <View style={styles.accMetaRow}>
                    <Text style={[styles.accountManageSub, { color: theme.textSecondary }]}>
                      {acc.number} • {formatCurrency(acc.balance)}
                    </Text>
                    <View style={[styles.accCatBadge, { backgroundColor: `${catColor}20` }]}>
                      <Text style={[styles.accCatBadgeText, { color: catColor }]}>{catLabel}</Text>
                    </View>
                  </View>
                </View>

                {accounts.length > 1 && (
                  <TouchableOpacity
                    style={[styles.accountDeleteBtn, { backgroundColor: theme.dangerLight }]}
                    onPress={() => handleDeleteAccount(acc.id, acc.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                    accessibilityLabel={`Delete account ${acc.name}`}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Add Account Inline Form */}
          {showAddAccount ? (
            <View style={[styles.addAccountForm, { backgroundColor: theme.cardSubtle, borderColor: theme.primary }]}>
              {/* Account Category Selector */}
              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>ACCOUNT CATEGORY / TYPE</Text>
              <View style={styles.catPillGrid}>
                {[
                  { id: 'debit', label: 'Debit Account', icon: 'business-outline', color: '#3B82F6' },
                  { id: 'credit', label: 'Credit Card', icon: 'card-outline', color: '#E11D48' },
                  { id: 'cash', label: 'Cash in Hand', icon: 'cash-outline', color: '#10B981' },
                  { id: 'wallet', label: 'Digital Wallet', icon: 'wallet-outline', color: '#06B6D4' },
                ].map((c) => {
                  const isSelected = newAccCategory === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.catPillBtn,
                        {
                          backgroundColor: isSelected ? `${c.color}20` : theme.card,
                          borderColor: isSelected ? c.color : theme.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => setNewAccCategory(c.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={c.icon}
                        size={14}
                        color={isSelected ? c.color : theme.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.catPillText,
                          { color: isSelected ? c.color : theme.textSecondary },
                          isSelected && { fontWeight: '700' },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Account / Bank Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder={
                  newAccCategory === 'credit'
                    ? 'e.g. RBL Bank Credit Card, ICICI Coral Card'
                    : newAccCategory === 'cash'
                    ? 'e.g. Physical Cash, Wallet Pocket'
                    : 'e.g. State Bank of India, Axis Bank'
                }
                placeholderTextColor={theme.textMuted}
                value={newAccName}
                onChangeText={setNewAccName}
              />

              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Last 4 Digits / Identifier</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. **4723 or XX6001"
                placeholderTextColor={theme.textMuted}
                value={newAccNumber}
                onChangeText={setNewAccNumber}
              />

              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Starting Balance (₹)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={newAccBalance}
                onChangeText={setNewAccBalance}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.actionBtnPrimary, { flex: 1, backgroundColor: theme.primary }]}
                  onPress={handleSaveAccount}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnTextPrimary}>Save Account</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { flex: 1, backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setShowAddAccount(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionBtnTextSecondary, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.addBankBtn,
                { backgroundColor: theme.primaryLight, borderColor: theme.primary },
              ]}
              onPress={() => setShowAddAccount(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color={theme.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.addBankBtnText, { color: theme.accent }]}>+ Add New Account / Card</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. Theme Mode Selector Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.titleIconBadge, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="color-palette" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>App Theme</Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Choose between dark slate or clean light mode.
          </Text>

          <View style={styles.themeToggleRow}>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                { backgroundColor: theme.cardSubtle, borderColor: theme.border },
                themeMode === 'dark' && { backgroundColor: theme.primaryLight, borderColor: theme.primary, borderWidth: 2 },
              ]}
              onPress={() => setThemeMode('dark')}
              activeOpacity={0.7}
            >
              <Ionicons name="moon" size={18} color={themeMode === 'dark' ? theme.accent : theme.textSecondary} style={{ marginRight: 8 }} />
              <Text style={[styles.themeBtnText, { color: themeMode === 'dark' ? theme.accent : theme.textSecondary }]}>
                Dark Slate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeBtn,
                { backgroundColor: theme.cardSubtle, borderColor: theme.border },
                themeMode === 'light' && { backgroundColor: theme.primaryLight, borderColor: theme.primary, borderWidth: 2 },
              ]}
              onPress={() => setThemeMode('light')}
              activeOpacity={0.7}
            >
              <Ionicons name="sunny" size={18} color={themeMode === 'light' ? theme.primary : theme.textSecondary} style={{ marginRight: 8 }} />
              <Text style={[styles.themeBtnText, { color: themeMode === 'light' ? theme.primary : theme.textSecondary }]}>
                Clean Light
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. 1-Tap Ledger Actions: Clear Test Data, Backup Ledger, Reset Ledger */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.titleIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="layers" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Ledger & Data Actions</Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Manage your ledger data with quick one-click actions:
          </Text>

          {/* 1. Clear Test Data & Start Fresh (Single Primary Button) */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: '#EF4444' }]}
            onPress={handleClearTestData}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionBtnText}>Clear Test Data & Start Fresh</Text>
          </TouchableOpacity>

          {/* Review Ignored Transactions Button */}
          <TouchableOpacity
            style={[
              styles.secondaryActionBtn,
              { backgroundColor: theme.cardSubtle, borderColor: '#EF4444', borderWidth: 1.5 },
            ]}
            onPress={() => setShowIgnoredModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-off-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryActionBtnText, { color: theme.text }]}>
              Review Ignored Transactions ({ignoredTransactions.length})
            </Text>
          </TouchableOpacity>

          {/* 2. Backup Ledger (Single Button) */}
          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.primary, borderWidth: 1.5 }]}
            onPress={handleBackupLedger}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={theme.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryActionBtnText, { color: theme.accent }]}>Backup Ledger (Export JSON)</Text>
          </TouchableOpacity>

          {/* 3. Reset Ledger (Single Button) */}
          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border, borderWidth: 1 }]}
            onPress={handleResetData}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryActionBtnText, { color: theme.textSecondary }]}>Reset Ledger (Reload Sample Data)</Text>
          </TouchableOpacity>

          {/* Export JSON Modal Box */}
          {showExportModal ? (
            <View style={[styles.jsonPreviewBox, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
              <View style={styles.jsonHeaderRow}>
                <Text style={[styles.jsonHeaderTitle, { color: theme.accent }]}>Backup Payload (JSON)</Text>
                <TouchableOpacity
                  style={styles.closeJsonBtn}
                  onPress={() => setShowExportModal(false)}
                >
                  <Text style={[styles.closeJsonBtnText, { color: theme.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.jsonTextArea, { color: theme.textSecondary }]}
                multiline
                editable={false}
                value={exportedString}
                numberOfLines={7}
              />
            </View>
          ) : null}
        </View>

        {/* 4. Restore From JSON (Collapsible) */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={styles.restoreHeaderRow}
            onPress={() => setShowRestoreBox(!showRestoreBox)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.titleIconBadge, { backgroundColor: theme.successLight }]}>
                <Ionicons name="cloud-download" size={18} color={theme.success} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Restore Ledger from JSON</Text>
            </View>
            <Ionicons
              name={showRestoreBox ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {showRestoreBox && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                Paste previously exported Money+ JSON to restore accounts and balances.
              </Text>
              <TextInput
                style={[styles.importInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                placeholder="Paste your JSON backup payload here..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={4}
                value={importJsonText}
                onChangeText={setImportJsonText}
              />
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: theme.success },
                  !importJsonText.trim() && { opacity: 0.5 },
                ]}
                onPress={handleImport}
                disabled={!importJsonText.trim()}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionBtnText}>Restore From JSON</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 5. Database Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.statsCardHeader}>
            <View style={[styles.dbIcon, { backgroundColor: theme.successLight }]}>
              <Ionicons name="server" size={18} color={theme.success} />
            </View>
            <View>
              <Text style={[styles.dbTitle, { color: theme.text }]}>Local Device Storage</Text>
              <Text style={[styles.dbSub, { color: theme.textSecondary }]}>Powered by AsyncStorage (Zero Cloud)</Text>
            </View>
          </View>

          <View style={[styles.statGrid, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.text }]}>{accounts.length}</Text>
              <Text style={[styles.statDesc, { color: theme.textMuted }]}>Accounts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.text }]}>{transactions.length}</Text>
              <Text style={[styles.statDesc, { color: theme.textMuted }]}>Transactions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.text }]}>{formatCurrency(totalNetWorth)}</Text>
              <Text style={[styles.statDesc, { color: theme.textMuted }]}>Net Worth</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Accounts & Ledgers Manager Modal */}
      <AccountsManagerModal
        visible={showAccountsManager}
        onClose={() => setShowAccountsManager(false)}
      />

      {/* Ignored Transactions Manager Modal */}
      <IgnoredTransactionsModal
        visible={showIgnoredModal}
        onClose={() => setShowIgnoredModal(false)}
      />
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
    paddingBottom: 110,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionCard: {
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  restoreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  accountManageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
  },
  accountManageName: {
    fontSize: 13,
    fontWeight: '700',
  },
  accMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  accountManageSub: {
    fontSize: 11,
  },
  accCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accCatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  accountDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    marginTop: 8,
  },
  addBankBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addAccountForm: {
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 2,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 6,
  },
  catPillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  catPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  catPillText: {
    fontSize: 11,
  },
  textInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    borderWidth: 1.5,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 11,
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1.5,
  },
  actionBtnTextSecondary: {
    fontWeight: '700',
    fontSize: 13,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 10,
  },
  secondaryActionBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
  },
  themeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsCard: {
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dbIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dbTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dbSub: {
    fontSize: 11,
  },
  statGrid: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  statDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  importInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    minHeight: 80,
    borderWidth: 1.5,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  jsonPreviewBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
  },
  jsonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jsonHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeJsonBtn: {
    padding: 2,
  },
  closeJsonBtnText: {
    fontSize: 11,
  },
  jsonTextArea: {
    fontSize: 10,
    fontFamily: 'monospace',
    maxHeight: 140,
  },
});
