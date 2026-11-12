import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import CategorySelector from '../components/CategorySelector';
import { notifyAction } from '../utils/dialogs';

const MODES = [
  { id: 'EXPENSE', label: 'Expense', icon: 'arrow-up-circle-outline', color: '#F43F5E' },
  { id: 'INCOME', label: 'Income', icon: 'arrow-down-circle-outline', color: '#10B981' },
  { id: 'INTEREST', label: 'Interest/Fee', icon: 'trending-up-outline', color: '#6366F1' },
  { id: 'OVERRIDE', label: 'Override', icon: 'swap-vertical-outline', color: '#F59E0B' },
];

export default function AdjustScreen({ route, navigation }) {
  const { accounts, categories, addTransaction, overrideAccountBalance, theme } = useFinance();

  const [mode, setMode] = useState(route.params?.mode || 'EXPENSE');
  const [selectedAccountId, setSelectedAccountId] = useState(
    route.params?.preselectedAccount || (accounts[0] ? accounts[0].id : '')
  );
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('cat_food');
  const [note, setNote] = useState('');

  // For Direct Override
  const [targetBalance, setTargetBalance] = useState('');
  const [overrideReason, setOverrideReason] = useState('Balance Calibration');

  useEffect(() => {
    if (route.params?.mode) {
      setMode(route.params.mode);
    }
    if (route.params?.preselectedAccount) {
      setSelectedAccountId(route.params.preselectedAccount);
    }
  }, [route.params]);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  // Ensure first account is selected by default if nothing preselected
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Adjust categories based on mode
  useEffect(() => {
    if (mode === 'INCOME') {
      setSelectedCategoryId('cat_salary');
    } else if (mode === 'INTEREST') {
      setSelectedCategoryId('cat_investment');
    } else if (mode === 'EXPENSE') {
      setSelectedCategoryId('cat_food');
    }
  }, [mode]);

  const handleSubmit = async () => {
    if (mode === 'OVERRIDE') {
      const numTarget = parseFloat(targetBalance);
      if (isNaN(numTarget)) {
        notifyAction('Invalid Balance', 'Please enter a valid numeric target balance.');
        return;
      }

      await overrideAccountBalance(
        selectedAccountId,
        numTarget,
        overrideReason.trim() || 'Direct Balance Override'
      );

      notifyAction(
        'Balance Reconciled',
        `${activeAccount?.name || 'Account'} balance updated to ${formatCurrency(numTarget)}. An adjustment log has been recorded.`
      );
      setTargetBalance('');
      navigation.navigate('Dashboard');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      notifyAction('Invalid Amount', 'Please enter an amount greater than 0.');
      return;
    }

    if (!counterparty.trim()) {
      notifyAction('Missing Merchant / Counterparty', 'Please enter who you paid or received money from.');
      return;
    }

    const txType = mode === 'INCOME' || (mode === 'INTEREST' && selectedCategoryId === 'cat_investment')
      ? 'income'
      : 'expense';

    await addTransaction({
      amount: numAmount,
      type: txType,
      accountId: selectedAccountId,
      categoryId: selectedCategoryId,
      counterparty: counterparty.trim(),
      note: note.trim(),
    });

    notifyAction(
      'Transaction Saved',
      `${formatCurrency(numAmount)} recorded for ${activeAccount?.name}.`
    );

    setAmount('');
    setCounterparty('');
    setNote('');
    navigation.navigate('Dashboard');
  };

  const delta = mode === 'OVERRIDE' && targetBalance !== '' && !isNaN(parseFloat(targetBalance))
    ? parseFloat(targetBalance) - (activeAccount?.balance || 0)
    : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Manual Entry & Adjustments</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Log cash, interest, custom charges, or calibrate wallet balances
          </Text>
        </View>

        {/* Mode Selector Tabs */}
        <View style={styles.modeTabsRow}>
          {MODES.map((m) => {
            const isSelected = mode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modeTab,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  isSelected && { backgroundColor: `${m.color}20`, borderColor: m.color, borderWidth: 1.5 },
                ]}
                onPress={() => setMode(m.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={m.icon}
                  size={15}
                  color={isSelected ? m.color : theme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    { color: isSelected ? m.color : theme.textSecondary, fontWeight: isSelected ? '700' : '600' },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Account Selector Pill Carousel */}
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>SELECT ACCOUNT / WALLET</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountScroll}>
            {accounts.map((acc) => {
              const isSelected = acc.id === selectedAccountId;
              const isCredit = acc.ledgerCategory === 'credit';
              const isPositive = (acc.balance || 0) >= 0;
              const balanceColor = isCredit
                ? '#EF4444' // Credit card debt is red
                : isPositive
                ? '#10B981' // Positive bank balance is green
                : '#EF4444'; // Overdraft is red

              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountPill,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                    isSelected && { borderColor: acc.color || theme.primary, backgroundColor: `${acc.color || '#6366F1'}20`, borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedAccountId(acc.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={acc.icon || (isCredit ? 'card-outline' : 'business-outline')}
                    size={18}
                    color={isSelected ? (acc.color || theme.primary) : theme.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flexShrink: 1, maxWidth: 170 }}>
                    <Text
                      style={[styles.accountPillName, { color: theme.text }, isSelected && { fontWeight: '800' }]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </Text>
                    <Text style={[styles.accountPillBalance, { color: balanceColor }]}>
                      {isCredit && (acc.balance || 0) > 0 ? '-' : ''}
                      {formatCurrency(acc.balance || 0)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Direct Balance Override Mode UI */}
        {mode === 'OVERRIDE' ? (
          <View style={[styles.overrideContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderTopWidth: 3, borderTopColor: '#F59E0B' }]}>
            <View style={[styles.currentBalanceBox, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
              <Text style={[styles.currentBalanceLabel, { color: theme.textMuted }]}>CURRENT LEDGER BALANCE</Text>
              <Text style={[styles.currentBalanceValue, { color: theme.text }]}>
                {formatCurrency(activeAccount?.balance || 0)}
              </Text>
              <Text style={[styles.accountDetailSub, { color: theme.textSecondary }]}>
                {activeAccount?.name} ({activeAccount?.number})
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.innerFieldLabel, { color: theme.textMuted }]}>ACTUAL CURRENT BALANCE (₹)</Text>
              <TextInput
                style={[styles.amountInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. 85000.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={targetBalance}
                onChangeText={setTargetBalance}
              />
            </View>

            {delta !== null ? (
              <View style={[styles.deltaBox, { backgroundColor: theme.cardSubtle }]}>
                <Text style={[styles.deltaLabel, { color: theme.textSecondary }]}>Reconciliation Difference:</Text>
                <Text
                  style={[
                    styles.deltaValue,
                    { color: delta >= 0 ? theme.success : theme.danger },
                  ]}
                >
                  {delta >= 0 ? `+${formatCurrency(delta)}` : formatCurrency(delta)}
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldContainer}>
              <Text style={[styles.innerFieldLabel, { color: theme.textMuted }]}>REASON / AUDIT NOTE</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. Reconciled with passbook statement"
                placeholderTextColor={theme.textMuted}
                value={overrideReason}
                onChangeText={setOverrideReason}
              />
            </View>

            <TouchableOpacity
              style={[styles.overrideSubmitBtn, { backgroundColor: theme.primary }]}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Apply Balance Override</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Normal Transaction Form (Expense / Income / Interest) */
          <View style={[styles.formContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderTopWidth: 3, borderTopColor: MODES.find((m) => m.id === mode)?.color || theme.primary }]}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.innerFieldLabel, { color: theme.textMuted }]}>AMOUNT (₹)</Text>
              <TextInput
                style={[styles.amountInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.innerFieldLabel, { color: theme.textMuted }]}>
                {mode === 'INCOME' ? 'SOURCE / EMPLOYER' : mode === 'INTEREST' ? 'BANK / INSTITUTION' : 'MERCHANT / COUNTERPARTY'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                placeholder={
                  mode === 'INCOME'
                    ? 'e.g. Salary, Client Payout'
                    : mode === 'INTEREST'
                    ? 'e.g. ICICI Savings Interest, Annual Fee'
                    : 'e.g. Swiggy, Amazon, Metro, Grocery'
                }
                placeholderTextColor={theme.textMuted}
                value={counterparty}
                onChangeText={setCounterparty}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.innerFieldLabel, { color: theme.textMuted }]}>CATEGORY</Text>
              <CategorySelector
                categories={categories}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.innerFieldLabel, { color: theme.textMuted }]}>OPTIONAL NOTE / TAGS</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.cardSubtle, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. Team lunch, weekend grocery"
                placeholderTextColor={theme.textMuted}
                value={note}
                onChangeText={setNote}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: MODES.find((m) => m.id === mode)?.color || theme.primary }]}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Save {mode}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  modeTabsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 20, // Perfectly aligned with screen margins!
  },
  innerFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  accountScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  accountPillName: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountPillBalance: {
    fontSize: 11,
    marginTop: 1,
  },
  formContainer: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  overrideContainer: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  currentBalanceBox: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  currentBalanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  currentBalanceValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  accountDetailSub: {
    fontSize: 12,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  amountInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '700',
    borderWidth: 1,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    borderWidth: 1,
  },
  deltaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  deltaLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  deltaValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  overrideSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
