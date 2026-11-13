import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { parseDeviceSmsList, parseRawSmsBatch } from '../utils/parser';
import { runDeduplicationEngine } from '../utils/deduplication';
import { SAMPLE_SMS_BATCH, REAL_BANK_TEMPLATES } from '../types/finance';
import SyncPreviewItem from '../components/SyncPreviewItem';
import LoadingOverlay from '../components/LoadingOverlay';
import { notifyAction } from '../utils/dialogs';
import { readDeviceSms, isDeviceSmsAvailable } from '../../modules/sms-reader';

export default function SyncScreen({ navigation }) {
  const {
    accounts,
    transactions,
    categories,
    batchAddTransactions,
    blacklistedFingerprints,
    blacklistFingerprint,
    unblacklistFingerprint,
    ignoreTransaction,
    ignoredTransactions,
    restoreIgnoredTransaction,
    theme,
  } = useFinance();
  const [rawText, setRawText] = useState('');
  const [previewList, setPreviewList] = useState([]);
  const [discoveredAccounts, setDiscoveredAccounts] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanningSms, setIsScanningSms] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [syncDoneSummary, setSyncDoneSummary] = useState(null);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [confirmedDisplayLimit, setConfirmedDisplayLimit] = useState(30);
  const [syncDatePreset, setSyncDatePreset] = useState('THIS_MONTH'); // THIS_MONTH, LAST_30_DAYS, LAST_7_DAYS, ALL_TIME

  // Collapsible section visibility states
  const [accountsCollapsed, setAccountsCollapsed] = useState(false);
  const [uncertainCollapsed, setUncertainCollapsed] = useState(false);
  const [confirmedCollapsed, setConfirmedCollapsed] = useState(false);
  const [acceptedDuplicatesCollapsed, setAcceptedDuplicatesCollapsed] = useState(false);
  const [duplicatesCollapsed, setDuplicatesCollapsed] = useState(true);
  const [ignoredCollapsed, setIgnoredCollapsed] = useState(true);

  // Compute active sync date timeline
  const syncRange = useMemo(() => {
    const now = new Date();
    if (syncDatePreset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthStr = now.toLocaleDateString('en-IN', { month: 'short' });
      return {
        start,
        end: now,
        label: `1 ${monthStr} - Today`,
      };
    }
    if (syncDatePreset === 'LAST_30_DAYS') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return {
        start,
        end: now,
        label: 'Last 30 Days',
      };
    }
    if (syncDatePreset === 'LAST_7_DAYS') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return {
        start,
        end: now,
        label: 'Last 7 Days',
      };
    }
    return {
      start: new Date(0),
      end: now,
      label: 'All Time (Up to 1000)',
    };
  }, [syncDatePreset]);

  const handleUpdateComment = useCallback((targetItem, newComment) => {
    setPreviewList((prev) =>
      prev.map((item) => {
        if (item.id === targetItem.id) {
          return { ...item, comment: newComment };
        }
        return item;
      })
    );
  }, []);

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
    discoveredAccounts.forEach((a) => {
      map[a.id] = a;
    });
    return map;
  }, [accounts, discoveredAccounts]);

  // Partition preview items into Uncertain, Confirmed, Accepted Duplicates, Duplicate Alerts, and Ignored (Strict Descending Order)
  const uncertainItems = useMemo(
    () =>
      previewList
        .filter((item) => item.isUncertain && item.status === 'ready')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [previewList]
  );
  const confirmedItems = useMemo(
    () =>
      previewList
        .filter((item) => !item.isUncertain && item.status === 'ready')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [previewList]
  );
  const acceptedDuplicates = useMemo(
    () =>
      previewList
        .filter((item) => item.status === 'accepted_duplicate')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [previewList]
  );
  const duplicateAlerts = useMemo(
    () =>
      previewList
        .filter((item) => item.status === 'duplicate')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [previewList]
  );
  const ignoredItems = useMemo(
    () =>
      [...ignoredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [ignoredTransactions]
  );

  const handleDismissItem = useCallback(
    (item) => {
      setPreviewList((prev) => prev.filter((p) => p.id !== item.id));
      ignoreTransaction(item);
      notifyAction(
        'Transaction Ignored',
        'Discarded and permanently blacklisted. You can review and restore it from Settings anytime.',
        { type: 'info', icon: 'trash-outline' }
      );
    },
    [ignoreTransaction]
  );

  const handleSetTypeAndReminder = useCallback((targetItem, newType, isReminder) => {
    setPreviewList((prev) =>
      prev.map((item) => {
        if (item.id === targetItem.id) {
          let newCategory = item.categoryId;
          if (newType === 'income') {
            newCategory =
              item.categoryId === 'cat_salary' ||
              item.categoryId === 'cat_investment' ||
              item.categoryId === 'cat_transfer'
                ? item.categoryId
                : 'cat_investment';
          } else {
            newCategory =
              item.categoryId === 'cat_salary' || item.categoryId === 'cat_investment'
                ? 'cat_other'
                : item.categoryId;
          }
          return {
            ...item,
            type: newType,
            categoryId: newCategory,
            isReminder: !!isReminder,
            itemKind: isReminder ? 'reminder' : 'transaction',
            isUncertain: false, // User explicitly reviewed and confirmed!
          };
        }
        return item;
      })
    );
    notifyAction(
      isReminder ? 'Marked as Reminder' : newType === 'income' ? 'Marked as + Credit' : 'Marked as - Debit',
      isReminder
        ? 'Stored as informational reminder (zero balance impact).'
        : `Active ledger transaction: will ${newType === 'income' ? 'credit' : 'debit'} account on import.`,
      { type: isReminder ? 'warning' : 'info' }
    );
  }, []);

  const handleSetType = useCallback((targetItem, newType) => {
    handleSetTypeAndReminder(targetItem, newType, targetItem.isReminder);
  }, [handleSetTypeAndReminder]);

  const handleAcceptDuplicate = useCallback((targetItem) => {
    setPreviewList((prev) =>
      prev.map((item) => {
        if (item.id === targetItem.id) {
          return {
            ...item,
            status: 'accepted_duplicate',
            statusReason: 'Manually accepted duplicate by user',
          };
        }
        return item;
      })
    );
    notifyAction(
      'Duplicate Accepted',
      `"${targetItem.counterparty}" moved to Accepted Duplicates and will be imported.`,
      { type: 'success' }
    );
  }, []);

  const handleUndoDuplicate = useCallback((targetItem) => {
    setPreviewList((prev) =>
      prev.map((item) => {
        if (item.id === targetItem.id) {
          return {
            ...item,
            status: 'duplicate',
            statusReason: 'Duplicate notification in SMS dump (within 2-min window)',
          };
        }
        return item;
      })
    );
    notifyAction(
      'Duplicate Reverted',
      `"${targetItem.counterparty}" moved back to Duplicate Alerts.`,
      { type: 'info' }
    );
  }, []);

  const handleRestoreIgnored = useCallback(
    async (targetItem) => {
      await restoreIgnoredTransaction(targetItem.id, targetItem.accountId, targetItem.type, targetItem.categoryId);
      notifyAction(
        'Transaction Restored',
        `"${targetItem.counterparty}" has been restored back to your active transactions.`,
        { type: 'success' }
      );
    },
    [restoreIgnoredTransaction]
  );

  const handleToggleReminder = useCallback((targetItem) => {
    setPreviewList((prev) =>
      prev.map((item) => {
        if (item.id === targetItem.id) {
          const nextReminder = !item.isReminder;
          return {
            ...item,
            isReminder: nextReminder,
            itemKind: nextReminder ? 'reminder' : 'transaction',
          };
        }
        return item;
      })
    );
    notifyAction(
      targetItem.isReminder ? 'Marked as Active Transaction' : 'Marked as Reminder',
      targetItem.isReminder
        ? 'Will affect account balance when imported.'
        : 'Saved as reminder only; will not deduct from balance.',
      { type: 'info' }
    );
  }, []);

  const handleAutoScanInbox = async () => {
    setIsScanningSms(true);
    setSyncDoneSummary(null);
    try {
      if (!isDeviceSmsAvailable()) {
        notifyAction(
          'APK Native Feature',
          'Automatic inbox scanning queries the Android device inbox (content://sms/inbox). This native feature runs directly in your installed Android APK! On Web or Expo Go preview, you can test anytime using the paste box or tapping "Sample SMS" below.',
          { type: 'info' }
        );
        setIsScanningSms(false);
        return;
      }

      const smsMessages = await readDeviceSms(2000);
      if (!smsMessages || smsMessages.length === 0) {
        notifyAction('Inbox Empty', 'No SMS messages found in your inbox, or permission was not granted.', { type: 'warning' });
        setIsScanningSms(false);
        return;
      }

      // Filter SMS messages by selected timeline range
      let eligibleSms = smsMessages;
      if (syncDatePreset !== 'ALL_TIME') {
        const startMs = syncRange.start.getTime();
        const endMs = syncRange.end.getTime();
        eligibleSms = smsMessages.filter((m) => {
          const d = m.date || 0;
          return d >= startMs && d <= endMs;
        });
      }

      if (eligibleSms.length === 0) {
        notifyAction(
          'No SMS in Timeline',
          `Found 0 messages in inbox for ${syncRange.label}. Try selecting "Last 30 Days" or "All Time".`,
          { type: 'info' }
        );
        setIsScanningSms(false);
        return;
      }

      // Directly parse structured SMS list, excluding blacklisted transactions
      const { transactions: parsedItems, newAccounts } = parseDeviceSmsList(
        eligibleSms,
        accounts,
        blacklistedFingerprints
      );
      setDiscoveredAccounts(newAccounts);

      if (parsedItems.length === 0) {
        notifyAction(
          'No Bank Transactions',
          `Scanned ${eligibleSms.length} SMS messages within ${syncRange.label}, but none matched debit/credit patterns for your accounts.`,
          { type: 'warning' }
        );
        setIsScanningSms(false);
        return;
      }

      const evaluatedItems = runDeduplicationEngine(
        parsedItems,
        transactions,
        blacklistedFingerprints
      );
      setPreviewList(evaluatedItems);
      setConfirmedDisplayLimit(30);
      const readyNum = evaluatedItems.filter((i) => i.status === 'ready').length;

      let msg = `Scanned ${eligibleSms.length} inbox messages (${syncRange.label}). Found ${readyNum} new transactions ready to import.`;
      if (newAccounts.length > 0) {
        msg += ` Automatically identified ${newAccounts.length} new bank account(s) to create!`;
      }

      notifyAction('Scan Complete!', msg, { type: 'success' });
    } catch (err) {
      notifyAction('Scan Notice', err.message || 'Could not access device SMS inbox.', { type: 'warning' });
    } finally {
      setIsScanningSms(false);
    }
  };

  const handleParseAndDeduplicate = () => {
    if (!rawText.trim()) {
      notifyAction('Empty Input', 'Please paste some SMS or notification text to parse.', { type: 'warning' });
      return;
    }

    setIsProcessing(true);
    setSyncDoneSummary(null);

    setTimeout(() => {
      const parsedItems = parseRawSmsBatch(rawText, accounts, blacklistedFingerprints);
      const newAccounts = parsedItems.discoveredAccounts || [];
      setDiscoveredAccounts(newAccounts);

      // Filter by timeline range if active
      let eligibleItems = parsedItems;
      if (syncDatePreset !== 'ALL_TIME') {
        const startMs = syncRange.start.getTime();
        const endMs = syncRange.end.getTime();
        eligibleItems = parsedItems.filter((item) => {
          const t = new Date(item.date).getTime();
          return isNaN(t) || (t >= startMs && t <= endMs);
        });
      }

      if (eligibleItems.length === 0) {
        notifyAction(
          'No Transactions Found',
          `No transactions matched within ${syncRange.label}. Make sure bank keywords and dates are within timeline.`,
          { type: 'warning' }
        );
        setIsProcessing(false);
        return;
      }

      const evaluatedItems = runDeduplicationEngine(
        eligibleItems,
        transactions,
        blacklistedFingerprints
      );
      setPreviewList(evaluatedItems);
      setConfirmedDisplayLimit(30);
      setIsProcessing(false);
    }, 200);
  };

  const handleLoadSample = () => {
    setRawText(SAMPLE_SMS_BATCH);
    setPreviewList([]);
    setDiscoveredAccounts([]);
    setSyncDoneSummary(null);
  };

  const handleClear = () => {
    setRawText('');
    setPreviewList([]);
    setDiscoveredAccounts([]);
    setSyncDoneSummary(null);
  };

  const handleCommitSync = async () => {
    const readyItems = previewList.filter((item) => item.status === 'ready');
    if (readyItems.length === 0 && discoveredAccounts.length === 0) {
      notifyAction('No New Transactions', 'All parsed records were either duplicates or already in your ledger.', { type: 'info' });
      return;
    }

    setIsCommitting(true);
    try {
      const count = await batchAddTransactions(
        readyItems.map((item) => ({
          ...item,
          comment: item.comment || '',
        })),
        discoveredAccounts
      );
      setSyncDoneSummary({
        imported: count,
        newAccounts: discoveredAccounts.length,
        duplicates: previewList.filter((item) => item.status === 'duplicate').length,
        existing: previewList.filter((item) => item.status === 'existing').length,
      });

      setPreviewList([]);
      setDiscoveredAccounts([]);
      setRawText('');

      let successMsg = `Successfully imported ${count} transactions into your ledger. Balances have been updated.`;
      if (discoveredAccounts.length > 0) {
        successMsg += ` Automatically created ${discoveredAccounts.length} new bank account(s).`;
      }

      notifyAction('Sync Completed!', successMsg, { type: 'success' });
      navigation.navigate('Dashboard');
    } catch (err) {
      notifyAction('Import Error', err.message || 'Failed to commit transactions to ledger.', { type: 'danger' });
    } finally {
      setIsCommitting(false);
    }
  };

  const readyCount = previewList.filter((i) => i.status === 'ready' || i.status === 'accepted_duplicate').length;
  const duplicateCount = duplicateAlerts.length;
  const acceptedDuplicateCount = acceptedDuplicates.length;
  const ignoredCount = ignoredItems.length;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Screen Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="flash" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>SMS Auto-Sync</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Automatic account detection & accurate transaction amounts
            </Text>
          </View>
        </View>

        {/* Primary Hero: Automatic Inbox Scan for Android APK */}
        <View
          style={[
            styles.autoScanHero,
            {
              backgroundColor: theme.card,
              borderColor: '#6366F1',
              borderWidth: 2,
            },
          ]}
        >
          <View style={styles.autoScanHeader}>
            <View style={[styles.heroIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="phone-portrait" size={24} color="#6366F1" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.heroTitle, { color: theme.text }]}>One-Tap Device Auto-Scan</Text>
                <View style={[styles.apkBadge, { backgroundColor: theme.successLight }]}>
                  <Text style={[styles.apkBadgeText, { color: theme.success }]}>APK Native</Text>
                </View>
              </View>
              <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
                Directly reads incoming bank & UPI SMS from your device inbox (content://sms/inbox). Automatically discovers your bank accounts and imports transactions.
              </Text>
            </View>
          </View>

          {/* Timeline Date Filter Selector */}
          <View style={styles.syncTimelineContainer}>
            <Text style={[styles.timelineLabel, { color: theme.textMuted }]}>
              SELECT TIMELINE TO SYNC:
            </Text>
            <View style={styles.timelinePillsRow}>
              {[
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'LAST_30_DAYS', label: 'Last 30D' },
                { id: 'LAST_7_DAYS', label: 'Last 7D' },
                { id: 'ALL_TIME', label: 'All Time' },
              ].map((p) => {
                const isSel = syncDatePreset === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.timelinePill,
                      {
                        backgroundColor: isSel ? '#6366F1' : theme.cardSubtle,
                        borderColor: isSel ? '#6366F1' : theme.border,
                      },
                    ]}
                    onPress={() => setSyncDatePreset(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.timelinePillText,
                        { color: isSel ? '#FFFFFF' : theme.textSecondary, fontWeight: isSel ? '700' : '600' },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.activeTimelineBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
              <Ionicons name="calendar-outline" size={13} color="#6366F1" style={{ marginRight: 6 }} />
              <Text style={[styles.activeTimelineText, { color: '#6366F1' }]}>
                Filtering Range: {syncRange.label}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.heroScanBtn, { backgroundColor: '#6366F1' }, isScanningSms && { opacity: 0.7 }]}
            onPress={handleAutoScanInbox}
            disabled={isScanningSms}
            activeOpacity={0.85}
          >
            {isScanningSms ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.heroScanBtnText}>⚡ Scan Inbox ({syncRange.label})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Newly Discovered Accounts Collapsible Section */}
        {discoveredAccounts.length > 0 && (
          <View style={[styles.collapsibleSection, { backgroundColor: theme.card, borderColor: theme.primary, borderWidth: 1.5 }]}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => setAccountsCollapsed(!accountsCollapsed)}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleHeaderLeft}>
                <View style={[styles.sectionIconBadge, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="business" size={16} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.collapsibleTitle, { color: theme.text }]}>Identified Bank Accounts</Text>
                    <View style={[styles.countBadge, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[styles.countBadgeText, { color: theme.accent }]}>{discoveredAccounts.length}</Text>
                    </View>
                  </View>
                  <Text style={[styles.collapsibleSubtitle, { color: theme.textSecondary }]}>
                    Auto-detected bank ledgers to configure
                  </Text>
                </View>
              </View>
              <Ionicons
                name={accountsCollapsed ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {!accountsCollapsed && (
              <View style={styles.discoveredAccountsList}>
                {discoveredAccounts.map((acc) => (
                  <View
                    key={acc.id}
                    style={[
                      styles.discoveredAccChip,
                      {
                        backgroundColor: theme.cardSubtle,
                        borderColor: acc.color,
                        borderLeftWidth: 4,
                        borderLeftColor: acc.color,
                      },
                    ]}
                  >
                    <Ionicons name={acc.icon || 'card-outline'} size={16} color={acc.color} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.discoveredAccName, { color: theme.text }]}>{acc.name}</Text>
                      <Text style={[styles.discoveredAccType, { color: theme.textSecondary }]}>
                        {acc.type} • {acc.number} ({acc.ledgerCategory || 'debit'})
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Sync Result Summary Banner */}
        {syncDoneSummary ? (
          <View style={[styles.successBanner, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
            <Ionicons name="checkmark-done-circle" size={24} color={theme.success} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.successTitle, { color: theme.success }]}>Sync Completed Successfully</Text>
              <Text style={[styles.successText, { color: theme.textSecondary }]}>
                {syncDoneSummary.imported} Imported • {syncDoneSummary.newAccounts} Accounts Configured • {syncDoneSummary.duplicates} Duplicates Discarded
              </Text>
            </View>
          </View>
        ) : null}

        {/* Live Parse Preview Section */}
        {previewList.length > 0 ? (
          <View style={styles.previewSection}>
            <View style={styles.summaryBar}>
              <Text style={[styles.summaryTitle, { color: theme.textMuted }]}>TRANSACTIONS PREVIEW</Text>
              <View style={styles.statsRow}>
                <View style={[styles.statChip, { backgroundColor: theme.successLight }]}>
                  <Text style={[styles.statChipText, { color: theme.success }]}>
                    {readyCount} Ready
                  </Text>
                </View>
                {uncertainItems.length > 0 && (
                  <View style={[styles.statChip, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Text style={[styles.statChipText, { color: '#F59E0B' }]}>
                      {uncertainItems.length} Review
                    </Text>
                  </View>
                )}
                {duplicateCount > 0 && (
                  <View style={[styles.statChip, { backgroundColor: theme.cardSubtle }]}>
                    <Text style={[styles.statChipText, { color: theme.textSecondary }]}>
                      {duplicateCount} Dups
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Immediate Top Commit Button */}
            {readyCount > 0 ? (
              <TouchableOpacity
                style={[styles.commitBtnTop, { backgroundColor: theme.success }]}
                onPress={handleCommitSync}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.commitBtnText} numberOfLines={2}>
                  Import {readyCount} Transactions {discoveredAccounts.length > 0 ? `(${discoveredAccounts.length} Accounts)` : ''}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* SECTION 1: UNCERTAIN TRANSACTIONS COLLAPSIBLE */}
            {uncertainItems.length > 0 && (
              <View style={[styles.collapsibleSection, { backgroundColor: theme.card, borderColor: '#F59E0B', borderWidth: 1.5 }]}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setUncertainCollapsed(!uncertainCollapsed)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                      <Ionicons name="help-circle" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.collapsibleTitle, { color: theme.text }]}>Uncertain Transactions</Text>
                        <View style={[styles.countBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                          <Text style={[styles.countBadgeText, { color: '#F59E0B' }]}>{uncertainItems.length}</Text>
                        </View>
                      </View>
                      <Text style={[styles.collapsibleSubtitle, { color: theme.textSecondary }]}>
                        Tap Debit (-) or Credit (+) switch on any card to verify
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={uncertainCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>

                {!uncertainCollapsed && (
                  <View style={{ paddingTop: 6 }}>
                    <Text style={[styles.sectionNotice, { color: theme.textMuted }]}>
                      These SMS have ambiguous wording or reversals. Tap - Debit or + Credit on any card to confirm:
                    </Text>
                    {uncertainItems.map((item) => (
                      <SyncPreviewItem
                        key={item.id}
                        item={item}
                        accountName={accountMap[item.accountId]?.name || item.accountName || 'Bank Account'}
                        categoryName={categoryMap[item.categoryId]?.name || 'General'}
                        onDismiss={handleDismissItem}
                        onSetType={handleSetType}
                        onSetTypeAndReminder={handleSetTypeAndReminder}
                        onUpdateComment={handleUpdateComment}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* SECTION 2: CONFIRMED TRANSACTIONS COLLAPSIBLE */}
            {confirmedItems.length > 0 && (
              <View style={[styles.collapsibleSection, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1.5 }]}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setConfirmedCollapsed(!confirmedCollapsed)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={[styles.sectionIconBadge, { backgroundColor: theme.successLight }]}>
                      <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.collapsibleTitle, { color: theme.text }]}>Confirmed Transactions</Text>
                        <View style={[styles.countBadge, { backgroundColor: theme.successLight }]}>
                          <Text style={[styles.countBadgeText, { color: theme.success }]}>{confirmedItems.length}</Text>
                        </View>
                      </View>
                      <Text style={[styles.collapsibleSubtitle, { color: theme.textSecondary }]}>
                        Ready to import (debits, credits, and inter-ledger transfers)
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={confirmedCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>

                {!confirmedCollapsed && (
                  <View style={{ paddingTop: 6 }}>
                    {confirmedItems.slice(0, confirmedDisplayLimit).map((item) => (
                      <SyncPreviewItem
                        key={item.id}
                        item={item}
                        accountName={accountMap[item.accountId]?.name || item.accountName || 'Bank Account'}
                        categoryName={categoryMap[item.categoryId]?.name || 'General'}
                        onDismiss={handleDismissItem}
                        onSetType={handleSetType}
                        onSetTypeAndReminder={handleSetTypeAndReminder}
                        onToggleReminder={handleToggleReminder}
                        onUpdateComment={handleUpdateComment}
                      />
                    ))}

                    {confirmedItems.length > confirmedDisplayLimit && (
                      <TouchableOpacity
                        style={[styles.loadMoreSyncBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
                        onPress={() => setConfirmedDisplayLimit((prev) => prev + 30)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.loadMoreSyncText, { color: theme.accent }]}>
                          Load More Confirmed ({confirmedItems.length - confirmedDisplayLimit} remaining)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* SECTION 3: ACCEPTED DUPLICATES (MANUALLY INCLUDED BY USER) */}
            {acceptedDuplicates.length > 0 && (
              <View style={[styles.collapsibleSection, { backgroundColor: theme.card, borderColor: '#10B981', borderWidth: 1.5 }]}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setAcceptedDuplicatesCollapsed(!acceptedDuplicatesCollapsed)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
                      <Ionicons name="checkmark-done-circle" size={18} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.collapsibleTitle, { color: theme.text }]}>Accepted Duplicates</Text>
                        <View style={[styles.countBadge, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
                          <Text style={[styles.countBadgeText, { color: '#10B981' }]}>{acceptedDuplicates.length}</Text>
                        </View>
                      </View>
                      <Text style={[styles.collapsibleSubtitle, { color: '#10B981' }]}>
                        Duplicates you chose to include. Tap Undo to revert back to duplicate alerts.
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={acceptedDuplicatesCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color="#10B981"
                  />
                </TouchableOpacity>

                {!acceptedDuplicatesCollapsed && (
                  <View style={{ paddingTop: 6 }}>
                    {acceptedDuplicates.map((item) => (
                      <SyncPreviewItem
                        key={item.id}
                        item={item}
                        accountName={accountMap[item.accountId]?.name || item.accountName || 'Bank Account'}
                        categoryName={categoryMap[item.categoryId]?.name || 'General'}
                        onDismiss={handleDismissItem}
                        onSetType={handleSetType}
                        onSetTypeAndReminder={handleSetTypeAndReminder}
                        onUndoDuplicate={handleUndoDuplicate}
                        onToggleReminder={handleToggleReminder}
                        onUpdateComment={handleUpdateComment}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* SECTION 4: DUPLICATE ALERTS WITHIN BATCH */}
            {duplicateAlerts.length > 0 && (
              <View style={[styles.collapsibleSection, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setDuplicatesCollapsed(!duplicatesCollapsed)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                      <Ionicons name="copy-outline" size={16} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.collapsibleTitle, { color: theme.textSecondary }]}>Duplicate Alerts</Text>
                        <View style={[styles.countBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                          <Text style={[styles.countBadgeText, { color: '#F59E0B' }]}>{duplicateAlerts.length}</Text>
                        </View>
                      </View>
                      <Text style={[styles.collapsibleSubtitle, { color: theme.textMuted }]}>
                        Repeated alerts within 2 minutes. Tap + Import to accept and move to Accepted Duplicates.
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={duplicatesCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>

                {!duplicatesCollapsed && (
                  <View style={{ paddingTop: 6 }}>
                    {duplicateAlerts.map((item) => (
                      <SyncPreviewItem
                        key={item.id}
                        item={item}
                        accountName={accountMap[item.accountId]?.name || item.accountName || 'Bank Account'}
                        categoryName={categoryMap[item.categoryId]?.name || 'General'}
                        onDismiss={handleDismissItem}
                        onSetType={handleSetType}
                        onSetTypeAndReminder={handleSetTypeAndReminder}
                        onAcceptDuplicate={handleAcceptDuplicate}
                        onToggleReminder={handleToggleReminder}
                        onUpdateComment={handleUpdateComment}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* SECTION 5: IGNORED / PREVIOUSLY DELETED (EXCLUDED FROM LEDGER) */}
            {ignoredItems.length > 0 && (
              <View style={[styles.collapsibleSection, { backgroundColor: theme.card, borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1 }]}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setIgnoredCollapsed(!ignoredCollapsed)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <Ionicons name="trash-bin-outline" size={16} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.collapsibleTitle, { color: '#EF4444' }]}>Ignored / Previously Deleted</Text>
                        <View style={[styles.countBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                          <Text style={[styles.countBadgeText, { color: '#EF4444' }]}>{ignoredItems.length}</Text>
                        </View>
                      </View>
                      <Text style={[styles.collapsibleSubtitle, { color: theme.textMuted }]}>
                        Filtered out by previous deletes or spam filters (0 balance impact). Tap Restore to include.
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={ignoredCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color="#EF4444"
                  />
                </TouchableOpacity>

                {!ignoredCollapsed && (
                  <View style={{ paddingTop: 6 }}>
                    {ignoredItems.map((item) => (
                      <SyncPreviewItem
                        key={item.id}
                        item={item}
                        accountName={accountMap[item.accountId]?.name || item.accountName || 'Bank Account'}
                        categoryName={categoryMap[item.categoryId]?.name || 'General'}
                        onDismiss={handleDismissItem}
                        onSetType={handleSetType}
                        onSetTypeAndReminder={handleSetTypeAndReminder}
                        onRestoreIgnored={handleRestoreIgnored}
                        onToggleReminder={handleToggleReminder}
                        onUpdateComment={handleUpdateComment}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.commitBtn,
                { backgroundColor: theme.success },
                readyCount === 0 && styles.commitBtnDisabled,
              ]}
              onPress={handleCommitSync}
              disabled={readyCount === 0}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.commitBtnText} numberOfLines={2}>
                {readyCount > 0
                  ? `Import ${readyCount} Transactions ${discoveredAccounts.length > 0 ? `(${discoveredAccounts.length} Accounts)` : ''}`
                  : 'No New Transactions to Import'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Secondary Collapsible: Manual Paste (Kept clean for Web / Dev testing without cluttering APK) */}
        <View style={styles.accordionContainer}>
          <TouchableOpacity
            style={[styles.accordionHeader, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => setShowManualPaste(!showManualPaste)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="code-working-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.accordionTitle, { color: theme.textSecondary }]}>
                {showManualPaste ? 'Hide Manual SMS Paste' : 'Optional: Paste Raw SMS Text (Web & Dev)'}
              </Text>
            </View>
            <Ionicons
              name={showManualPaste ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {showManualPaste && (
            <View style={[styles.inputCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.inputCardHeader}>
                <Text style={[styles.inputLabel, { color: theme.textMuted }]}>TESTING RAW TEXT</Text>
                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={[styles.sampleBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary, borderWidth: 1 }]}
                    onPress={handleLoadSample}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="document-text-outline" size={12} color={theme.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.sampleBtnText, { color: theme.accent }]}>Sample SMS</Text>
                  </TouchableOpacity>
                  {rawText ? (
                    <TouchableOpacity
                      style={[styles.clearBtn, { backgroundColor: theme.dangerLight }]}
                      onPress={handleClear}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.clearBtnText, { color: theme.danger }]}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Quick Bank Presets */}
              <View style={styles.presetContainer}>
                <Text style={[styles.presetLabel, { color: theme.textMuted }]}>Presets:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
                  {REAL_BANK_TEMPLATES.map((tmpl) => (
                    <TouchableOpacity
                      key={tmpl.name}
                      style={[styles.presetChip, { backgroundColor: theme.cardSubtle, borderColor: theme.border, borderWidth: 1 }]}
                      onPress={() => {
                        setRawText(tmpl.sms);
                        setPreviewList([]);
                        setDiscoveredAccounts([]);
                        setSyncDoneSummary(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, { color: theme.accent }]}>{tmpl.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TextInput
                style={[styles.textArea, { backgroundColor: theme.cardSubtle, borderColor: theme.border, borderWidth: 1, color: theme.text }]}
                placeholder="Paste SMS messages to test parsing..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={5}
                value={rawText}
                onChangeText={setRawText}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.parseBtn, { backgroundColor: theme.primary }, isProcessing && styles.parseBtnDisabled]}
                onPress={handleParseAndDeduplicate}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.parseBtnText}>Run Parser & Deduplication</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Global Loading Overlay for SMS Scan, Deduplication, and Ledger Commit */}
      <LoadingOverlay
        visible={isScanningSms || isCommitting || isProcessing}
        title={
          isScanningSms
            ? 'Scanning SMS Inbox...'
            : isCommitting
            ? 'Writing to Ledger...'
            : 'Parsing Bank SMS...'
        }
        message={
          isScanningSms
            ? 'Reading up to 1,000 banking messages & identifying accounts. Please wait...'
            : isCommitting
            ? `Importing ${readyCount} transactions and updating account balances...`
            : 'Evaluating transactions and deduplicating records...'
        }
        icon={isScanningSms ? 'phone-portrait-outline' : isCommitting ? 'cloud-download-outline' : 'sync-outline'}
        iconColor={isScanningSms ? '#6366F1' : isCommitting ? theme.success : theme.primary}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerIcon: {
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
    marginTop: 3,
  },
  autoScanHero: {
    borderRadius: 22,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  autoScanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  apkBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  apkBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  heroSub: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  heroScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  heroScanBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  collapsibleSection: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  collapsibleTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  collapsibleSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
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
  sectionNotice: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  paginationRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  paginationBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  paginationBtnSecondary: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBtnTextSec: {
    fontSize: 12,
    fontWeight: '600',
  },
  collapsedSummaryText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  discoveredSection: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  discoveredHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  discoveredBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  discoveredTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  discoveredSub: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  discoveredAccountsList: {
    gap: 8,
  },
  discoveredAccChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  discoveredAccName: {
    fontSize: 13,
    fontWeight: '700',
  },
  discoveredAccType: {
    fontSize: 11,
    marginTop: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  successText: {
    fontSize: 11,
    marginTop: 2,
  },
  previewSection: {
    marginTop: 6,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  commitBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  commitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  commitBtnDisabled: {
    opacity: 0.5,
  },
  commitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  accordionContainer: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  accordionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    marginTop: 10,
  },
  inputCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sampleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sampleBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  presetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 6,
  },
  presetScroll: {
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  textArea: {
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    minHeight: 100,
    marginBottom: 10,
  },
  parseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  parseBtnDisabled: {
    opacity: 0.6,
  },
  parseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  syncTimelineContainer: {
    marginTop: 12,
    marginBottom: 6,
  },
  timelineLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  timelinePillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  timelinePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  timelinePillText: {
    fontSize: 11,
  },
  activeTimelineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  activeTimelineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadMoreSyncBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  loadMoreSyncText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
