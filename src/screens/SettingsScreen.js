import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import { confirmAction, notifyAction } from '../utils/dialogs';
import IgnoredTransactionsModal from '../components/IgnoredTransactionsModal';
import {
  generateGSTR1Csv,
  generateGSTR3BPurchaseCsv,
  generateITRScheduleCsv,
  generateUnifiedMasterTaxCsv,
  shareTaxCsv,
} from '../utils/taxExport';

export default function SettingsScreen({ navigation }) {
  const {
    accounts,
    transactions,
    categories,
    totalNetWorth,
    exportBackupJson,
    importBackupJson,
    resetToDemoData,
    clearLedgerData,
    ignoredTransactions,
    autoSyncEnabled,
    setAutoSyncEnabled,
    theme,
    themeMode,
    setThemeMode,
  } = useFinance();

  const [importJsonText, setImportJsonText] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedString, setExportedString] = useState('');
  const [showRestoreBox, setShowRestoreBox] = useState(false);
  const [showIgnoredModal, setShowIgnoredModal] = useState(false);

  // Tax CSV Modal State
  const [taxModalVisible, setTaxModalVisible] = useState(false);
  const [taxModalTitle, setTaxModalTitle] = useState('');
  const [taxModalCsv, setTaxModalCsv] = useState('');
  const [taxModalCount, setTaxModalCount] = useState(0);

  const handleExportTax = async (type) => {
    let csv = '';
    let title = '';
    let count = 0;

    if (type === 'GSTR1') {
      title = 'GSTR-1 Outward Supplies (Income CSV)';
      csv = generateGSTR1Csv(transactions, accounts, categories);
      count = transactions.filter((t) => t.type === 'income' && !t.isReminder).length;
    } else if (type === 'GSTR3B') {
      title = 'GSTR-3B Purchase Register (ITC Expenses CSV)';
      csv = generateGSTR3BPurchaseCsv(transactions, accounts, categories);
      count = transactions.filter((t) => t.type === 'expense' && !t.isReminder).length;
    } else if (type === 'ITR') {
      title = 'ITR P&L Schedule Breakdown (CSV)';
      csv = generateITRScheduleCsv(transactions, accounts, categories);
      count = transactions.filter((t) => !t.isReminder && t.type !== 'transfer' && t.type !== 'adjustment').length;
    } else {
      title = 'Master Tax & Financial Ledger (CSV)';
      csv = generateUnifiedMasterTaxCsv(transactions, accounts, categories);
      count = transactions.filter((t) => !t.isReminder && t.type !== 'transfer' && t.type !== 'adjustment').length;
    }

    setTaxModalTitle(title);
    setTaxModalCsv(csv);
    setTaxModalCount(count);
    setTaxModalVisible(true);
  };

  const handleShareCurrentCsv = async () => {
    try {
      await shareTaxCsv(taxModalTitle, taxModalCsv);
    } catch (err) {
      notifyAction('Share Error', 'Could not open native share dialog.', { type: 'danger' });
    }
  };

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
      notifyAction('Empty Input', 'Please paste valid MoneyFollows backup JSON text.', { type: 'warning' });
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings & Data</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Personalize MoneyFollows and manage your local data
          </Text>
        </View>

        {/* 1. Theme Mode Selector Card */}
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

        {/* 2. Sync & Automation Preferences */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.titleIconBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="sync-circle-outline" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Sync & Background Automation</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Automated inbox sync settings for MoneyFollows
              </Text>
            </View>
          </View>

          <View style={[styles.prefRow, { borderColor: theme.border, backgroundColor: theme.cardSubtle }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.prefTitle, { color: theme.text }]}>Auto-Sync on App Open</Text>
              <Text style={[styles.prefSub, { color: theme.textSecondary }]}>
                Silently checks SMS inbox in background on app launch and prompts you with a loading confirmation before refreshing ledger data.
              </Text>
            </View>
            <Switch
              value={autoSyncEnabled}
              onValueChange={setAutoSyncEnabled}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={autoSyncEnabled ? '#FFFFFF' : '#F4F4F5'}
            />
          </View>
        </View>

        {/* 3. Ignored & Discarded Transactions Section Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.titleIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="eye-off-outline" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Ignored Transactions</Text>
                <View style={[styles.countPill, { backgroundColor: theme.dangerLight }]}>
                  <Text style={[styles.countPillText, { color: theme.danger }]}>{ignoredTransactions.length}</Text>
                </View>
              </View>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Review discarded entries or restore them to active ledgers
              </Text>
            </View>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary, marginTop: 4 }]}>
            Deleted and ignored transactions are held here. Restoring an entry automatically updates account balances and recreates any deleted account ledger.
          </Text>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: '#F59E0B', marginTop: 8 }]}
            onPress={() => setShowIgnoredModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="eye-outline" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionBtnText}>Review & Restore Transactions ({ignoredTransactions.length})</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Tax, GST & ITR Exports Section Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.titleIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="document-text-outline" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Tax, GST & ITR Exports</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Offline CSV exports tailored for Indian GST returns & Income Tax filing
              </Text>
            </View>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Export your transactions into structured spreadsheets for filing GSTR-1, claiming GSTR-3B Input Tax Credit (ITC), and reporting ITR business P&L heads.
          </Text>

          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={[styles.taxExportBtn, { backgroundColor: theme.cardSubtle, borderColor: '#10B981' }]}
              onPress={() => handleExportTax('GSTR1')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up-circle-outline" size={20} color="#10B981" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.taxExportBtnTitle, { color: theme.text }]}>GSTR-1 Outward Supplies (Income CSV)</Text>
                <Text style={[styles.taxExportBtnSub, { color: theme.textSecondary }]}>
                  Customer receipts, sales & professional income with taxable base and GST breakdown
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.taxExportBtn, { backgroundColor: theme.cardSubtle, borderColor: '#3B82F6' }]}
              onPress={() => handleExportTax('GSTR3B')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down-circle-outline" size={20} color="#3B82F6" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.taxExportBtnTitle, { color: theme.text }]}>GSTR-3B Purchase Register (ITC Expenses CSV)</Text>
                <Text style={[styles.taxExportBtnSub, { color: theme.textSecondary }]}>
                  Vendor purchases with Section 17(5) blocked ITC and Table 4A(5) eligible credits
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.taxExportBtn, { backgroundColor: theme.cardSubtle, borderColor: '#8B5CF6' }]}
              onPress={() => handleExportTax('ITR')}
              activeOpacity={0.8}
            >
              <Ionicons name="calculator-outline" size={20} color="#8B5CF6" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.taxExportBtnTitle, { color: theme.text }]}>ITR P&L Schedule Breakdown (CSV)</Text>
                <Text style={[styles.taxExportBtnSub, { color: theme.textSecondary }]}>
                  Income & expense heads classified by Indian Income Tax Act P&L categories & Financial Year
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.taxExportBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.primary }]}
              onPress={() => handleExportTax('MASTER')}
              activeOpacity={0.8}
            >
              <Ionicons name="layers-outline" size={20} color={theme.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.taxExportBtnTitle, { color: theme.text }]}>Master Tax & Financial Ledger (Complete CSV)</Text>
                <Text style={[styles.taxExportBtnSub, { color: theme.textSecondary }]}>
                  Comprehensive spreadsheet combining all bank refs, notes, tax heads, and audit columns
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Ledger & Data Actions (Temporarily Commented Out) */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.titleIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="layers" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Ledger & Data Actions</Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary, marginBottom: 4 }]}>
            Ledger data management buttons are currently hidden. Your local accounts and transactions remain safe and fully persistent on this device.
          </Text>

          {/* User Requested: Commented out all Ledger & Data Action buttons for now
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: '#EF4444' }]}
            onPress={handleClearTestData}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionBtnText}>Clear Test Data & Start Fresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.primary, borderWidth: 1.5 }]}
            onPress={handleBackupLedger}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={theme.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryActionBtnText, { color: theme.accent }]}>Backup Ledger (Export JSON)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border, borderWidth: 1 }]}
            onPress={handleResetData}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryActionBtnText, { color: theme.textSecondary }]}>Reset Ledger (Reload Sample Data)</Text>
          </TouchableOpacity>

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
                Paste previously exported MoneyFollows JSON to restore accounts and balances.
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
          */}
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

      {/* Ignored Transactions Manager Modal */}
      <IgnoredTransactionsModal
        visible={showIgnoredModal}
        onClose={() => setShowIgnoredModal(false)}
      />

      {/* Tax CSV Preview & Share Modal */}
      <Modal
        visible={taxModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTaxModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.taxModalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.taxModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.taxModalTitle, { color: theme.text }]} numberOfLines={1}>
                  {taxModalTitle}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  {taxModalCount} transaction records formatted for tax filing
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTaxModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.taxCsvPreviewArea, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
              multiline
              editable={false}
              value={taxModalCsv}
              numberOfLines={12}
            />

            <View style={styles.taxModalActions}>
              <TouchableOpacity
                style={[styles.taxShareBtn, { backgroundColor: '#10B981' }]}
                onPress={handleShareCurrentCsv}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.taxShareBtnText}>Share / Save CSV File</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.taxCloseBtn, { borderColor: theme.border, backgroundColor: theme.cardSubtle }]}
                onPress={() => setTaxModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.taxCloseBtnText, { color: theme.textSecondary }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  accountsShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  accountsShortcutBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
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
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 6,
  },
  prefTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  prefSub: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  taxExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  taxExportBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  taxExportBtnSub: {
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  taxModalContent: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  taxModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taxModalTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  taxCsvPreviewArea: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    fontSize: 10.5,
    fontFamily: 'monospace',
    maxHeight: 280,
    textAlignVertical: 'top',
  },
  taxModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  taxShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  taxShareBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  taxCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxCloseBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
