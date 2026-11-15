import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { confirmAction, notifyAction } from '../utils/dialogs';

export default function TransactionDetailModal({
  visible,
  transaction,
  onClose,
}) {
  const {
    accounts,
    categories,
    updateTransaction,
    deleteTransaction,
    addAccount,
    theme,
  } = useFinance();

  const [comment, setComment] = useState('');
  const [selectedMode, setSelectedMode] = useState('debit'); // 'debit' | 'credit' | 'reminder'
  const [selectedCategoryId, setSelectedCategoryId] = useState('cat_other');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccCat, setNewAccCat] = useState('debit');
  const [copiedNote, setCopiedNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setComment(transaction.comment || '');
      setSelectedCategoryId(transaction.categoryId || 'cat_other');
      setSelectedAccountId(transaction.accountId || '');
      setIsCategoryPickerOpen(false);
      setIsAccountPickerOpen(false);
      setIsCreatingAccount(false);
      setNewAccName('');
      setNewAccNumber('');
      setNewAccCat('debit');
      if (transaction.isReminder) {
        setSelectedMode('reminder');
      } else if (transaction.type === 'income') {
        setSelectedMode('credit');
      } else {
        setSelectedMode('debit');
      }
      setCopiedNote(false);
    }
  }, [transaction]);

  if (!transaction) return null;

  const currentAccount =
    accounts.find((a) => a.id === (selectedMode === 'reminder' ? 'acc_reminders' : selectedAccountId)) ||
    accounts.find((a) => a.id === transaction.accountId) ||
    accounts[0];
  const activeCatId = selectedMode === 'reminder' ? 'cat_reminder' : selectedCategoryId;
  const currentCategory =
    categories.find((c) => c.id === activeCatId) ||
    categories.find((c) => c.id === transaction.categoryId) ||
    categories[0];

  const rawAmount = parseFloat(transaction.amount) || 0;

  // Determine active presentation color based on selectedMode
  const modeColor =
    selectedMode === 'reminder'
      ? '#F59E0B'
      : selectedMode === 'credit'
      ? '#10B981'
      : '#DC2626';

  const modeSign =
    selectedMode === 'reminder' ? '🔔 ' : selectedMode === 'credit' ? '+' : '-';

  const handleCopyNote = () => {
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2200);
  };

  const handleModeChange = (newMode) => {
    setSelectedMode(newMode);
    if (newMode === 'reminder') {
      setIsCategoryPickerOpen(false);
      setIsAccountPickerOpen(false);
      setIsCreatingAccount(false);
    } else if (selectedCategoryId === 'cat_reminder') {
      setSelectedCategoryId(newMode === 'credit' ? 'cat_salary' : 'cat_other');
    }
  };

  const handleCreateInlineAccount = async () => {
    if (!newAccName.trim()) {
      notifyAction('Account Name Required', 'Please enter a name for the account.', { type: 'warning' });
      return;
    }
    try {
      const formattedNum = newAccNumber.trim()
        ? (newAccNumber.trim().startsWith('**') ? newAccNumber.trim() : `**${newAccNumber.trim().replace(/\D/g, '') || '0000'}`)
        : '**0000';
      const created = await addAccount({
        name: newAccName.trim(),
        number: formattedNum,
        ledgerCategory: newAccCat,
      });
      if (created) {
        setSelectedAccountId(created.id);
        setIsCreatingAccount(false);
        setIsAccountPickerOpen(false);
        setNewAccName('');
        setNewAccNumber('');
        notifyAction('Account Created', `Created and assigned "${created.name}".`, { type: 'success' });
      }
    } catch (e) {
      console.error('Error creating account:', e);
      notifyAction('Error', 'Could not create account.', { type: 'danger' });
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const isReminder = selectedMode === 'reminder';
      const type = selectedMode === 'credit' ? 'income' : 'expense';
      let accId = isReminder ? 'acc_reminders' : (selectedAccountId || transaction.accountId);
      let catId = isReminder ? 'cat_reminder' : selectedCategoryId;

      if (isReminder) {
        accId = 'acc_reminders';
      } else if (accId === 'acc_reminders') {
        const fallback = accounts.find((a) => a.id !== 'acc_reminders' && !a.isVirtual) || accounts[0];
        accId = fallback ? fallback.id : 'acc_cash';
        if (catId === 'cat_reminder') {
          catId = type === 'income' ? 'cat_salary' : 'cat_other';
        }
      }

      const updated = {
        ...transaction,
        comment: comment.trim(),
        accountId: accId,
        categoryId: catId,
        type,
        isReminder,
        itemKind: isReminder ? 'reminder' : 'transaction',
      };

      await updateTransaction(updated);
      notifyAction(
        'Transaction Updated',
        `Saved changes in ${selectedMode.toUpperCase()} mode under ${currentAccount?.name || 'Account'}.`,
        { type: 'success', icon: 'checkmark-circle' }
      );
      onClose();
    } catch (err) {
      console.error('Error saving transaction changes:', err);
      notifyAction('Error', 'Could not save transaction changes.', { type: 'danger' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    confirmAction(
      'Delete Transaction',
      'Are you sure you want to delete this record? Its balance impact will be reverted from the ledger.',
      async () => {
        await deleteTransaction(transaction.id);
        notifyAction('Transaction Deleted', 'Ledger balance updated.', {
          type: 'info',
          icon: 'trash-outline',
        });
        onClose();
      },
      { type: 'danger', confirmText: 'Yes, Delete' }
    );
  };

  const hasModeChanged =
    (selectedMode === 'reminder' && !transaction.isReminder) ||
    (selectedMode !== 'reminder' && !!transaction.isReminder) ||
    (selectedMode === 'credit' && transaction.type !== 'income') ||
    (selectedMode === 'debit' && transaction.type !== 'expense');

  const hasCommentChanged = (transaction.comment || '') !== comment.trim();
  const hasCategoryChanged = (transaction.categoryId || 'cat_other') !== activeCatId;
  const hasAccountChanged =
    selectedMode !== 'reminder' &&
    !!selectedAccountId &&
    transaction.accountId !== selectedAccountId;
  const hasChanges = hasModeChanged || hasCommentChanged || hasCategoryChanged || hasAccountChanged;

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
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {transaction.counterparty || 'Transaction Details'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {formatDate(transaction.date)}
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount Hero Card */}
            <View
              style={[
                styles.amountHeroCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  borderLeftColor: modeColor,
                  borderLeftWidth: 4.5,
                },
              ]}
            >
              <Text style={[styles.amountLabel, { color: theme.textMuted }]}>
                {selectedMode === 'reminder'
                  ? 'PROSPECTIVE REMINDER AMOUNT'
                  : selectedMode === 'credit'
                  ? 'TOTAL INFLOW / CREDIT'
                  : 'TOTAL OUTFLOW / DEBIT'}
              </Text>
              <Text style={[styles.amountValue, { color: modeColor }]}>
                {modeSign}{formatCurrency(rawAmount)}
              </Text>

              {/* Mode Description Badge */}
              <View
                style={[
                  styles.modeBadge,
                  {
                    backgroundColor:
                      selectedMode === 'reminder'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : selectedMode === 'credit'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(220, 38, 38, 0.15)',
                  },
                ]}
              >
                <Ionicons
                  name={
                    selectedMode === 'reminder'
                      ? 'notifications-outline'
                      : selectedMode === 'credit'
                      ? 'arrow-down-circle-outline'
                      : 'arrow-up-circle-outline'
                  }
                  size={14}
                  color={modeColor}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.modeBadgeText, { color: modeColor }]}>
                  {selectedMode === 'reminder'
                    ? 'Reminder (Zero Balance Impact)'
                    : selectedMode === 'credit'
                    ? 'Active Credit (+ Added to Balance)'
                    : 'Active Debit (- Deducted from Balance)'}
                </Text>
              </View>
            </View>

            {/* 3-Way Mode Switcher (Segmented Control) */}
            <View style={styles.sectionBox}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                TRANSACTION MODE
              </Text>
              <View
                style={[
                  styles.segmentContainer,
                  { backgroundColor: theme.cardSubtle, borderColor: theme.border },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    selectedMode === 'debit' && {
                      backgroundColor: '#DC2626',
                      borderColor: '#DC2626',
                    },
                  ]}
                  onPress={() => handleModeChange('debit')}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={15}
                    color={selectedMode === 'debit' ? '#FFFFFF' : theme.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: selectedMode === 'debit' ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    Debit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    selectedMode === 'credit' && {
                      backgroundColor: '#10B981',
                      borderColor: '#10B981',
                    },
                  ]}
                  onPress={() => handleModeChange('credit')}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={15}
                    color={selectedMode === 'credit' ? '#FFFFFF' : theme.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: selectedMode === 'credit' ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    Credit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    selectedMode === 'reminder' && {
                      backgroundColor: '#F59E0B',
                      borderColor: '#F59E0B',
                    },
                  ]}
                  onPress={() => handleModeChange('reminder')}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="notifications"
                    size={15}
                    color={selectedMode === 'reminder' ? '#FFFFFF' : theme.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: selectedMode === 'reminder' ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    Reminder
                  </Text>
                </TouchableOpacity>
              </View>

              {selectedMode === 'reminder' && (
                <View style={[styles.reminderNoticeBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' }]}>
                  <Ionicons name="information-circle-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={[styles.reminderNoticeText, { color: '#B45309' }]}>
                    Reminder mode excludes this item from ledger balances, monthly income/spent stats, and net worth calculations.
                  </Text>
                </View>
              )}
            </View>

            {/* Account & Category Details Grid */}
            <View style={styles.sectionBox}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                LEDGER INFORMATION
              </Text>

              <View style={[styles.infoGrid, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                {/* Account row - Interactive Selector */}
                <TouchableOpacity
                  style={[styles.infoRow, { paddingVertical: 11 }]}
                  onPress={() => {
                    if (selectedMode !== 'reminder') {
                      setIsAccountPickerOpen(!isAccountPickerOpen);
                      setIsCategoryPickerOpen(false);
                    }
                  }}
                  activeOpacity={selectedMode === 'reminder' ? 1 : 0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Change Account, currently ${currentAccount?.name || 'Account'}`}
                >
                  <View style={styles.infoRowLeft}>
                    <Ionicons name="wallet-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                    <Text style={[styles.infoRowLabel, { color: theme.textSecondary }]}>Account</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, justifyContent: 'flex-end' }}>
                    <View style={[styles.pillBadge, { backgroundColor: theme.primaryLight, flexShrink: 1 }]}>
                      <Ionicons
                        name={currentAccount?.icon || 'business-outline'}
                        size={12}
                        color={theme.accent}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.pillBadgeText, { color: theme.accent }]} numberOfLines={1}>
                        {currentAccount?.name || 'Account'}
                      </Text>
                    </View>
                    {selectedMode !== 'reminder' && (
                      <View style={[styles.categoryChevronBox, { backgroundColor: theme.cardSubtle }]}>
                        <Ionicons
                          name={isAccountPickerOpen ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={theme.accent}
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expandable Account Tray */}
                {isAccountPickerOpen && selectedMode !== 'reminder' && (
                  <View style={[styles.accountPickerTray, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
                    <View style={styles.categoryPickerTrayHeader}>
                      <Text style={[styles.categoryPickerTrayTitle, { color: theme.textMuted }]}>
                        SELECT LEDGER ACCOUNT
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsAccountPickerOpen(false);
                          setIsCreatingAccount(false);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Account list */}
                    <View style={styles.accountChipsColumn}>
                      {accounts
                        .filter((a) => a.id !== 'acc_reminders' && !a.isVirtual)
                        .map((acc) => {
                          const isSelected = (selectedAccountId || transaction.accountId) === acc.id;
                          return (
                            <TouchableOpacity
                              key={acc.id}
                              style={[
                                styles.accountSelectCard,
                                {
                                  backgroundColor: isSelected ? `${acc.color || '#3B82F6'}15` : theme.card,
                                  borderColor: isSelected ? (acc.color || theme.primary) : theme.border,
                                },
                                isSelected && { borderWidth: 1.5 },
                              ]}
                              onPress={() => {
                                setSelectedAccountId(acc.id);
                                setIsAccountPickerOpen(false);
                                setIsCreatingAccount(false);
                              }}
                              activeOpacity={0.75}
                            >
                              <View style={[styles.accountSelectIcon, { backgroundColor: `${acc.color || '#3B82F6'}20` }]}>
                                <Ionicons
                                  name={acc.icon || 'card-outline'}
                                  size={16}
                                  color={acc.color || theme.primary}
                                />
                              </View>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text
                                  style={[
                                    styles.accountSelectName,
                                    {
                                      color: theme.text,
                                      fontWeight: isSelected ? '800' : '600',
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {acc.name}
                                </Text>
                                <Text style={[styles.accountSelectSub, { color: theme.textMuted }]}>
                                  {acc.number || acc.type || 'Account'} • Bal: {formatCurrency(acc.balance || 0)}
                                </Text>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={18} color={acc.color || theme.primary} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </View>

                    {/* Inline Create Account Form or Button */}
                    {!isCreatingAccount ? (
                      <TouchableOpacity
                        style={[styles.addAccountBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                        onPress={() => setIsCreatingAccount(true)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.addAccountBtnText, { color: theme.primary }]}>+ Create New Account</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.inlineCreateBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.inlineCreateTitle, { color: theme.text }]}>Add New Account</Text>
                        <TextInput
                          style={[styles.inlineInput, { backgroundColor: theme.cardSubtle, color: theme.text, borderColor: theme.border }]}
                          placeholder="Account Name (e.g. RBL Bank Credit Card (**59))"
                          placeholderTextColor={theme.textMuted}
                          value={newAccName}
                          onChangeText={setNewAccName}
                        />
                        <TextInput
                          style={[styles.inlineInput, { backgroundColor: theme.cardSubtle, color: theme.text, borderColor: theme.border }]}
                          placeholder="Mask / Digits (e.g. **59 or 59)"
                          placeholderTextColor={theme.textMuted}
                          value={newAccNumber}
                          onChangeText={setNewAccNumber}
                        />
                        <View style={styles.inlineCatRow}>
                          {[
                            { id: 'debit', label: 'Bank' },
                            { id: 'credit', label: 'Credit Card' },
                            { id: 'wallet', label: 'Wallet' },
                            { id: 'cash', label: 'Cash' },
                          ].map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              style={[
                                styles.inlineCatChip,
                                {
                                  backgroundColor: newAccCat === c.id ? theme.primary : theme.cardSubtle,
                                  borderColor: theme.border,
                                },
                              ]}
                              onPress={() => setNewAccCat(c.id)}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: newAccCat === c.id ? '#FFFFFF' : theme.textSecondary,
                                }}
                              >
                                {c.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                          <TouchableOpacity
                            style={[styles.inlineSubmitBtn, { backgroundColor: theme.primary }]}
                            onPress={handleCreateInlineAccount}
                          >
                            <Text style={styles.inlineSubmitText}>Create & Select</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.inlineCancelBtn, { borderColor: theme.border }]}
                            onPress={() => setIsCreatingAccount(false)}
                          >
                            <Text style={[styles.inlineCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                {/* Category row - Interactive Selector */}
                <TouchableOpacity
                  style={[styles.infoRow, { paddingVertical: 11 }]}
                  onPress={() => {
                    if (selectedMode !== 'reminder') {
                      setIsCategoryPickerOpen(!isCategoryPickerOpen);
                    }
                  }}
                  activeOpacity={selectedMode === 'reminder' ? 1 : 0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Change Category, currently ${currentCategory?.name || 'Category'}`}
                >
                  <View style={styles.infoRowLeft}>
                    <Ionicons name="pricetag-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                    <Text style={[styles.infoRowLabel, { color: theme.textSecondary }]}>Category</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.pillBadge, { backgroundColor: `${currentCategory?.color || '#6366F1'}20` }]}>
                      <Ionicons
                        name={currentCategory?.icon || 'pricetag-outline'}
                        size={12}
                        color={currentCategory?.color || theme.accent}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.pillBadgeText, { color: currentCategory?.color || theme.accent }]}>
                        {currentCategory?.name || 'Category'}
                      </Text>
                    </View>
                    {selectedMode !== 'reminder' && (
                      <View style={[styles.categoryChevronBox, { backgroundColor: theme.cardSubtle }]}>
                        <Ionicons
                          name={isCategoryPickerOpen ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={theme.accent}
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expandable Category Tray */}
                {isCategoryPickerOpen && selectedMode !== 'reminder' && (
                  <View style={[styles.categoryPickerTray, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
                    <View style={styles.categoryPickerTrayHeader}>
                      <Text style={[styles.categoryPickerTrayTitle, { color: theme.textMuted }]}>
                        CHOOSE CATEGORY
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsCategoryPickerOpen(false)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.categoryChipsGrid}>
                      {categories
                        .filter((c) => c.id !== 'cat_reminder' && c.id !== 'cat_adjustment')
                        .map((cat) => {
                          const isSelected = cat.id === activeCatId;
                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.categoryChip,
                                {
                                  backgroundColor: isSelected ? `${cat.color}25` : theme.card,
                                  borderColor: isSelected ? cat.color : theme.border,
                                },
                                isSelected && { borderWidth: 2 },
                              ]}
                              onPress={() => {
                                setSelectedCategoryId(cat.id);
                                setIsCategoryPickerOpen(false);
                              }}
                              activeOpacity={0.75}
                            >
                              <View
                                style={[
                                  styles.categoryChipIcon,
                                  { backgroundColor: `${cat.color}20` },
                                  isSelected && { backgroundColor: cat.color },
                                ]}
                              >
                                <Ionicons
                                  name={cat.icon}
                                  size={13}
                                  color={isSelected ? '#FFFFFF' : cat.color}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.categoryChipText,
                                  {
                                    color: isSelected
                                      ? theme.mode === 'dark' ? '#FFFFFF' : cat.color
                                      : theme.textSecondary,
                                    fontWeight: isSelected ? '800' : '600',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                {/* Date & Time row */}
                <View style={styles.infoRow}>
                  <View style={styles.infoRowLeft}>
                    <Ionicons name="time-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                    <Text style={[styles.infoRowLabel, { color: theme.textSecondary }]}>Recorded At</Text>
                  </View>
                  <Text style={[styles.infoRowValue, { color: theme.text }]}>
                    {new Date(transaction.date).toLocaleString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Custom Comment Input Section */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                  CUSTOM COMMENT / TAG
                </Text>
                {transaction.comment ? (
                  <Text style={[styles.savedBadge, { color: theme.success }]}>✓ Saved</Text>
                ) : null}
              </View>

              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.accent} style={{ marginRight: 10, alignSelf: 'flex-start', marginTop: 10 }} />
                <TextInput
                  style={[styles.commentTextInput, { color: theme.text }]}
                  placeholder="e.g. Uber ride, Sweet shop, Dinner with friends..."
                  placeholderTextColor={theme.textMuted}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={2}
                />
                {comment.length > 0 && (
                  <TouchableOpacity onPress={() => setComment('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Raw SMS Alert Message Section */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                  RAW SMS / NOTIFICATION TEXT
                </Text>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: copiedNote ? theme.successLight : theme.cardSubtle }]}
                  onPress={handleCopyNote}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={copiedNote ? 'checkmark' : 'copy-outline'}
                    size={13}
                    color={copiedNote ? theme.success : theme.accent}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.copyBtnText, { color: copiedNote ? theme.success : theme.accent }]}>
                    {copiedNote ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.rawNoteBox, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
                <Text style={[styles.rawNoteText, { color: theme.textSecondary }]}>
                  {transaction.note || 'No raw SMS text recorded for this entry.'}
                </Text>
              </View>
            </View>

            {/* Save / Delete Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.primary },
                  !hasChanges && { opacity: 0.6 },
                ]}
                onPress={handleSaveChanges}
                disabled={!hasChanges || isSaving}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color={theme.danger} style={{ marginRight: 6 }} />
                <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  amountHeroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 6,
    marginBottom: 10,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionBox: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reminderNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
  },
  reminderNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  infoGrid: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRowLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoRowValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChevronBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPickerTray: {
    borderTopWidth: 1,
    padding: 12,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  accountPickerTray: {
    borderTopWidth: 1,
    padding: 12,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  accountChipsColumn: {
    flexDirection: 'column',
    gap: 8,
  },
  accountSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 46,
  },
  accountSelectIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  accountSelectName: {
    fontSize: 13,
  },
  accountSelectSub: {
    fontSize: 11,
    marginTop: 2,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    minHeight: 42,
  },
  addAccountBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineCreateBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  inlineCreateTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    marginBottom: 8,
  },
  inlineCatRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  inlineCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineSubmitBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    minHeight: 38,
  },
  inlineSubmitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineCancelBtn: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
  },
  inlineCancelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPickerTrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  categoryPickerTrayTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  categoryChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 34,
  },
  categoryChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 11.5,
  },
  divider: {
    height: 1,
  },
  savedBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 4,
    minHeight: 64,
  },
  commentTextInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rawNoteBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  rawNoteText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 48,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 48,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
