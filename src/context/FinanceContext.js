import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_ACCOUNTS,
  CATEGORIES,
  INITIAL_TRANSACTIONS,
} from '../types/finance';
import { generateFingerprint, normalizeSmsText } from '../utils/deduplication';
import { THEMES } from '../utils/theme';

const STORAGE_KEYS = {
  ACCOUNTS: '@money_plus_accounts_v1',
  TRANSACTIONS: '@money_plus_transactions_v1',
  THEME: '@money_plus_theme_v1',
  BLACKLISTED: '@money_plus_blacklisted_v1',
  IGNORED_TRANSACTIONS: '@money_plus_ignored_transactions_v1',
};

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories] = useState(CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeModeState] = useState('dark');
  const [blacklistedFingerprints, setBlacklistedFingerprints] = useState([]);
  const [ignoredTransactions, setIgnoredTransactions] = useState([]);

  const theme = THEMES[themeMode] || THEMES.dark;

  const toggleTheme = async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeModeState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, next);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  };

  const setThemeMode = async (mode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, mode);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  };

  // Load state from AsyncStorage on boot
  useEffect(() => {
    async function loadData() {
      try {
        const storedAccounts = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS);
        const storedTx = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
        const storedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
        const storedBlacklist = await AsyncStorage.getItem(STORAGE_KEYS.BLACKLISTED);

        if (storedTheme) {
          setThemeModeState(storedTheme);
        }

        if (storedBlacklist) {
          try {
            setBlacklistedFingerprints(JSON.parse(storedBlacklist));
          } catch {
            // ignore
          }
        }

        const storedIgnored = await AsyncStorage.getItem(STORAGE_KEYS.IGNORED_TRANSACTIONS);
        if (storedIgnored) {
          try {
            setIgnoredTransactions(JSON.parse(storedIgnored));
          } catch {
            // ignore
          }
        }

        if (storedAccounts) {
          setAccounts(JSON.parse(storedAccounts));
        } else {
          setAccounts(DEFAULT_ACCOUNTS);
          await AsyncStorage.setItem(
            STORAGE_KEYS.ACCOUNTS,
            JSON.stringify(DEFAULT_ACCOUNTS)
          );
        }

        if (storedTx) {
          setTransactions(JSON.parse(storedTx));
        } else {
          setTransactions(INITIAL_TRANSACTIONS);
          await AsyncStorage.setItem(
            STORAGE_KEYS.TRANSACTIONS,
            JSON.stringify(INITIAL_TRANSACTIONS)
          );
        }
      } catch (error) {
        console.error('Failed to load local data from AsyncStorage:', error);
        setAccounts(DEFAULT_ACCOUNTS);
        setTransactions(INITIAL_TRANSACTIONS);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Save changes to AsyncStorage (non-blocking for instant 0ms UI responsiveness)
  const saveState = async (newAccounts, newTransactions) => {
    try {
      if (newAccounts) {
        setAccounts(newAccounts);
        AsyncStorage.setItem(
          STORAGE_KEYS.ACCOUNTS,
          JSON.stringify(newAccounts)
        ).catch((e) => console.warn('AsyncStorage accounts persist error:', e));
      }
      if (newTransactions) {
        setTransactions(newTransactions);
        AsyncStorage.setItem(
          STORAGE_KEYS.TRANSACTIONS,
          JSON.stringify(newTransactions)
        ).catch((e) => console.warn('AsyncStorage transactions persist error:', e));
      }
    } catch (err) {
      console.error('AsyncStorage persist error:', err);
    }
  };

  /**
   * Add a single transaction and update account balance
   */
  const addTransaction = async (txData) => {
    const id = txData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const date = txData.date || new Date().toISOString();
    const amount = parseFloat(txData.amount);
    const fingerprint =
      txData.fingerprint ||
      generateFingerprint(date, amount, txData.accountId, txData.counterparty);

    const newTx = {
      ...txData,
      id,
      date,
      amount,
      fingerprint,
    };

    const isReminder = !!newTx.isReminder;
    let updatedAccounts = accounts;
    if (!isReminder) {
      updatedAccounts = accounts.map((acc) => {
        if (acc.id === newTx.accountId) {
          let newBalance = acc.balance;
          if (newTx.type === 'expense') {
            newBalance -= amount;
          } else if (newTx.type === 'income') {
            newBalance += amount;
          }
          return { ...acc, balance: parseFloat(newBalance.toFixed(2)) };
        }
        return acc;
      });
    }

    const updatedTxList = [newTx, ...transactions];
    updatedTxList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    await saveState(updatedAccounts, updatedTxList);
    return newTx;
  };

  /**
   * Batch add transactions from SMS Sync with automatic account creation
   */
  const batchAddTransactions = async (candidates, newAccountsToCreate = []) => {
    const toImport = candidates.filter((c) => c.status === 'ready' || c.status === 'accepted_duplicate');
    if (toImport.length === 0 && (!newAccountsToCreate || newAccountsToCreate.length === 0)) return 0;

    // 1. Merge any newly discovered accounts into the accounts list
    // User requirement: Only add discovered accounts that have at least 1 transaction being imported!
    const activeDiscoveredAccounts = (newAccountsToCreate || []).filter((newAcc) => {
      return toImport.some((tx) => tx.accountId === newAcc.id);
    });

    const existingIds = new Set(accounts.map((a) => a.id));
    const mergedAccounts = [...accounts];

    for (const na of activeDiscoveredAccounts) {
      if (!existingIds.has(na.id)) {
        mergedAccounts.push({
          id: na.id,
          name: na.name,
          number: na.number,
          aliases: na.aliases || [],
          type: na.type || (na.ledgerCategory === 'wallet' ? 'Digital Wallet' : na.ledgerCategory === 'credit' ? 'Credit Card' : 'Bank Account'),
          ledgerCategory: na.ledgerCategory || 'debit',
          balance: na.balance || 0,
          color: na.color || (na.ledgerCategory === 'wallet' ? '#06B6D4' : na.ledgerCategory === 'credit' ? '#E11D48' : '#6366F1'),
          accentColor: na.accentColor || (na.ledgerCategory === 'wallet' ? '#0891B2' : na.ledgerCategory === 'credit' ? '#BE123C' : '#4F46E5'),
          icon: na.icon || (na.ledgerCategory === 'wallet' ? 'wallet-outline' : na.ledgerCategory === 'credit' ? 'card-outline' : 'business-outline'),
          isAutoDiscovered: true,
        });
        existingIds.add(na.id);
      }
    }

    // 2. Clone accounts map for quick balance recalculation
    const accountBalances = {};
    mergedAccounts.forEach((a) => {
      accountBalances[a.id] = a.balance || 0;
    });

    const formattedList = toImport.map((c) => {
      const amount = parseFloat(c.amount);
      const accId = c.accountId;
      const isReminder = !!c.isReminder;

      // Only alter account balances if it's NOT a reminder!
      if (!isReminder && accountBalances[accId] !== undefined) {
        if (c.type === 'expense') {
          accountBalances[accId] -= amount;
        } else if (c.type === 'income') {
          accountBalances[accId] += amount;
        }
      }
      return {
        id: c.id,
        amount,
        type: c.type,
        accountId: c.accountId,
        categoryId: c.categoryId,
        counterparty: c.counterparty,
        date: c.date,
        note: c.note || 'Synced from SMS / Notification',
        fingerprint: c.fingerprint,
        isReminder,
        itemKind: isReminder ? 'reminder' : 'transaction',
      };
    });

    const updatedAccounts = mergedAccounts.map((acc) => ({
      ...acc,
      balance: parseFloat((accountBalances[acc.id] ?? acc.balance).toFixed(2)),
    }));

    const updatedTxList = [...formattedList, ...transactions];
    // Always maintain descending chronological sorting (latest at the top)
    updatedTxList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    await saveState(updatedAccounts, updatedTxList);
    return toImport.length;
  };

  /**
   * Delete a transaction, reverse balance, and blacklist fingerprint so it never re-syncs
   */
  const deleteTransaction = async (txId) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;

    // 1. Blacklist fingerprint and note so it NEVER pops up again in SMS Sync
    const fp = target.fingerprint || generateFingerprint(target);
    await blacklistFingerprint(fp, target.note || target.counterparty);

    // 2. Also record in ignoredTransactions so user can review and restore from Settings if desired
    const ignoredItem = {
      id: target.id || `ign_${Date.now()}`,
      amount: target.amount,
      type: target.type,
      accountId: target.accountId,
      accountName: accounts.find((a) => a.id === target.accountId)?.name || 'Account',
      categoryId: target.categoryId,
      counterparty: target.counterparty,
      date: target.date,
      note: target.note || '',
      rawText: target.note || '',
      fingerprint: fp,
      ignoredAt: new Date().toISOString(),
    };
    const updatedIgnored = [ignoredItem, ...ignoredTransactions.filter((i) => i.id !== txId && i.fingerprint !== fp)];
    setIgnoredTransactions(updatedIgnored);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IGNORED_TRANSACTIONS, JSON.stringify(updatedIgnored));
    } catch (e) {
      console.warn('Failed to save ignored transactions on delete', e);
    }

    // 3. Reverse account balance
    let updatedAccounts = accounts.map((acc) => {
      if (acc.id === target.accountId) {
        let newBalance = acc.balance;
        if (target.type === 'expense') {
          newBalance += target.amount; // reverse expense
        } else if (target.type === 'income') {
          newBalance -= target.amount; // reverse income
        }
        return { ...acc, balance: parseFloat(newBalance.toFixed(2)) };
      }
      return acc;
    });

    const updatedTxList = transactions.filter((t) => t.id !== txId);

    // 4. User requirement: "if all the transactions under a category or deleted and no existing transactions exists under that ledger overall and all transactions count is 0 under that ledger - delete that ledger automatically, no import needed for that"
    const remainingTxInAccount = updatedTxList.filter((t) => t.accountId === target.accountId);
    if (remainingTxInAccount.length === 0) {
      const targetAcc = updatedAccounts.find((a) => a.id === target.accountId);
      if (targetAcc && (targetAcc.isAutoDiscovered || !DEFAULT_ACCOUNTS.some((d) => d.id === targetAcc.id))) {
        updatedAccounts = updatedAccounts.filter((a) => a.id !== target.accountId);
      }
    }

    await saveState(updatedAccounts, updatedTxList);
  };

  /**
   * Edit an existing transaction and dynamically recalculate account balances
   */
  const updateTransaction = async (updatedTx) => {
    const original = transactions.find((t) => t.id === updatedTx.id);
    if (!original) return;

    const origAmount = parseFloat(original.amount);
    const newAmount = parseFloat(updatedTx.amount);

    // Revert original transaction impact and apply updated impact to accounts
    const updatedAccounts = accounts.map((acc) => {
      let bal = acc.balance;

      // 1. Revert original transaction
      if (acc.id === original.accountId) {
        if (original.type === 'expense') bal += origAmount;
        else if (original.type === 'income') bal -= origAmount;
      }

      // 2. Apply updated transaction
      if (acc.id === updatedTx.accountId) {
        if (updatedTx.type === 'expense') bal -= newAmount;
        else if (updatedTx.type === 'income') bal += newAmount;
      }

      return { ...acc, balance: parseFloat(bal.toFixed(2)) };
    });

    const updatedTxList = transactions.map((t) =>
      t.id === updatedTx.id ? { ...t, ...updatedTx, amount: newAmount } : t
    );

    await saveState(updatedAccounts, updatedTxList);
  };

  /**
   * Direct balance override: Reconciles an account balance and records an adjustment log
   */
  const overrideAccountBalance = async (accountId, targetBalance, reason = 'Balance Reconciliation') => {
    const targetAccount = accounts.find((a) => a.id === accountId);
    if (!targetAccount) return;

    const currentBalance = targetAccount.balance;
    const diff = targetBalance - currentBalance;

    if (Math.abs(diff) < 0.01) {
      return; // Already exact
    }

    const adjustmentTx = {
      id: `adj_${Date.now()}`,
      amount: Math.abs(diff),
      type: diff > 0 ? 'income' : 'expense',
      accountId,
      categoryId: 'cat_adjustment',
      counterparty: `Balance Override (${targetAccount.name})`,
      date: new Date().toISOString(),
      note: `${reason} | Previous: ₹${currentBalance.toFixed(2)} -> New: ₹${targetBalance.toFixed(2)}`,
      fingerprint: `override_${accountId}_${Date.now()}`,
    };

    const updatedAccounts = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, balance: parseFloat(targetBalance.toFixed(2)) } : acc
    );

    const updatedTxList = [adjustmentTx, ...transactions];
    await saveState(updatedAccounts, updatedTxList);
  };

  /**
   * Export all data as JSON
   */
  const exportBackupJson = () => {
    const payload = {
      appName: 'Money+ Cute Expense Tracker',
      exportedAt: new Date().toISOString(),
      version: 1,
      accounts,
      transactions,
    };
    return JSON.stringify(payload, null, 2);
  };

  /**
   * Import data from JSON
   */
  const importBackupJson = async (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.accounts && Array.isArray(parsed.accounts)) {
        await saveState(parsed.accounts, parsed.transactions || []);
        return { success: true, count: (parsed.transactions || []).length };
      }
      return { success: false, error: 'Invalid backup file format' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  /**
   * Reset to initial sample state
   */
  const resetToDemoData = async () => {
    await saveState(DEFAULT_ACCOUNTS, INITIAL_TRANSACTIONS);
  };

  /**
   * Clear all transactions, delete all accounts EXCEPT Cash, and clear uncertain/ignored/blacklist queues
   * Allows starting completely fresh with only physical cash in hand.
   */
  const clearLedgerData = async () => {
    // Retain only Cash account (or create standard default Cash account if none)
    const existingCash = accounts.find(
      (a) => a.ledgerCategory === 'cash' || a.id === 'acc_cash' || /cash/i.test(a.name)
    );
    const cashAccount = existingCash
      ? { ...existingCash, balance: 0.0 }
      : {
          id: 'acc_cash',
          name: 'Cash in Hand',
          number: 'Physical Cash',
          aliases: ['cash'],
          type: 'Cash',
          ledgerCategory: 'cash',
          balance: 0.0,
          color: '#10B981',
          accentColor: '#059669',
          icon: 'cash-outline',
        };

    const freshAccounts = [cashAccount];
    await saveState(freshAccounts, []);

    // Also wipe ignored transactions and persistent blacklist so everything starts fresh
    setIgnoredTransactions([]);
    setBlacklistedFingerprints([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.IGNORED_TRANSACTIONS);
      await AsyncStorage.removeItem(STORAGE_KEYS.BLACKLISTED);
    } catch (e) {
      console.warn('Failed to clean ignored / blacklisted storage on reset', e);
    }
  };

  /**
   * Reset to zeroed fresh slate (keeps account list with 0 balances, 0 transactions)
   */
  const resetToCleanSlate = async () => {
    const zeroAccounts = accounts.map((acc) => ({ ...acc, balance: 0.0 }));
    await saveState(zeroAccounts, []);
  };

  /**
   * Add fingerprint or raw text to persistent blacklist so it's never parsed again
   */
  const blacklistFingerprint = async (fingerprint, rawText = null) => {
    const updated = [...blacklistedFingerprints];
    if (fingerprint && !updated.includes(fingerprint)) {
      updated.push(fingerprint);
    }
    if (rawText) {
      const trimmed = rawText.trim();
      if (!updated.includes(trimmed)) {
        updated.push(trimmed);
      }
      const norm = normalizeSmsText(rawText);
      if (norm && !updated.includes(norm)) {
        updated.push(norm);
      }
    }
    setBlacklistedFingerprints(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BLACKLISTED, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save blacklisted fingerprint', e);
    }
  };

  /**
   * Remove fingerprint or raw text from persistent blacklist (un-ignore)
   */
  const unblacklistFingerprint = async (fingerprint, rawText = null) => {
    const raw = rawText ? rawText.trim() : null;
    const norm = rawText ? normalizeSmsText(rawText) : null;
    const updated = blacklistedFingerprints.filter(
      (b) => b !== fingerprint && b !== raw && b !== norm
    );
    setBlacklistedFingerprints(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BLACKLISTED, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to unblacklist fingerprint', e);
    }
  };

  /**
   * Update user comment / note for a transaction
   */
  const updateTransactionComment = async (txId, newComment) => {
    const updated = transactions.map((t) => {
      if (t.id === txId) {
        return { ...t, comment: newComment };
      }
      return t;
    });
    setTransactions(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update transaction comment', e);
    }
  };

  /**
   * Ignore a transaction from sync or preview:
   * Adds to persistent blacklist AND stores full record in ignoredTransactions for review in Settings
   */
  const ignoreTransaction = async (item) => {
    if (!item) return;
    const fp = item.fingerprint || generateFingerprint(item);
    const raw = item.rawText || item.note;

    // 1. Permanently blacklist fingerprint so it never re-appears in SMS sync
    await blacklistFingerprint(fp, raw);

    // 2. Save structured record in ignoredTransactions
    const ignoredItem = {
      id: item.id || `ign_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: parseFloat(item.amount) || 0,
      type: item.type || 'expense',
      accountId: item.accountId,
      accountName: item.accountName,
      accountNumber: item.accountNumber,
      categoryId: item.categoryId || 'cat_other',
      counterparty: item.counterparty || 'Ignored Item',
      date: item.date || new Date().toISOString(),
      note: item.note || item.rawText || '',
      rawText: item.rawText || item.note || '',
      fingerprint: fp,
      ignoredAt: new Date().toISOString(),
    };

    const updatedIgnored = [ignoredItem, ...ignoredTransactions.filter((i) => i.fingerprint !== fp && i.id !== ignoredItem.id)];
    setIgnoredTransactions(updatedIgnored);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IGNORED_TRANSACTIONS, JSON.stringify(updatedIgnored));
    } catch (e) {
      console.warn('Failed to save ignored transactions', e);
    }
  };

  /**
   * Restore an ignored transaction into the user's active ledger
   */
  const restoreIgnoredTransaction = async (txId, targetAccountId, type, categoryId) => {
    const target = ignoredTransactions.find((i) => i.id === txId);
    if (!target) return;

    const chosenAccountId = targetAccountId || target.accountId || (accounts[0] && accounts[0].id);
    const chosenType = type || target.type || 'expense';
    const chosenCategory = categoryId || target.categoryId || 'cat_other';
    const amount = parseFloat(target.amount) || 0;

    // 1. Remove from ignored list
    const updatedIgnored = ignoredTransactions.filter((i) => i.id !== txId);
    setIgnoredTransactions(updatedIgnored);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IGNORED_TRANSACTIONS, JSON.stringify(updatedIgnored));
    } catch (e) {
      console.warn('Failed to update ignored transactions on restore', e);
    }

    // 2. Un-blacklist fingerprint
    const fp = target.fingerprint;
    if (fp) {
      const updatedBl = blacklistedFingerprints.filter((b) => b !== fp && b !== target.rawText && b !== target.note);
      setBlacklistedFingerprints(updatedBl);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.BLACKLISTED, JSON.stringify(updatedBl));
      } catch (e) {
        console.warn('Failed to update blacklist on restore', e);
      }
    }

    // 3. Update account balance and append transaction
    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === chosenAccountId) {
        let newBalance = acc.balance;
        if (chosenType === 'expense') newBalance -= amount;
        else if (chosenType === 'income') newBalance += amount;
        return { ...acc, balance: parseFloat(newBalance.toFixed(2)) };
      }
      return acc;
    });

    const restoredTx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount,
      type: chosenType,
      accountId: chosenAccountId,
      categoryId: chosenCategory,
      counterparty: target.counterparty,
      date: target.date,
      note: target.note || 'Restored from Ignored Transactions',
      fingerprint: target.fingerprint,
    };

    const updatedTxList = [restoredTx, ...transactions];
    await saveState(updatedAccounts, updatedTxList);
  };

  /**
   * Permanently purge an ignored transaction from the review list (keeps fingerprint blacklisted)
   */
  const purgeIgnoredTransaction = async (txId) => {
    const updated = ignoredTransactions.filter((i) => i.id !== txId);
    setIgnoredTransactions(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IGNORED_TRANSACTIONS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to purge ignored transaction', e);
    }
  };

  /**
   * Add a new account (bank, wallet, cash)
   */
  const addAccount = async (accountData) => {
    const id = accountData.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cat = accountData.ledgerCategory || 'debit';
    const defaultType =
      cat === 'credit'
        ? 'Credit Card'
        : cat === 'cash'
        ? 'Cash'
        : cat === 'wallet'
        ? 'Digital Wallet'
        : 'Bank Account';
    const defaultColor =
      cat === 'credit'
        ? '#E11D48'
        : cat === 'cash'
        ? '#10B981'
        : cat === 'wallet'
        ? '#06B6D4'
        : '#6366F1';
    const defaultAccent =
      cat === 'credit'
        ? '#BE123C'
        : cat === 'cash'
        ? '#047857'
        : cat === 'wallet'
        ? '#0E7490'
        : '#4F46E5';
    const defaultIcon =
      cat === 'credit'
        ? 'card-outline'
        : cat === 'cash'
        ? 'cash-outline'
        : cat === 'wallet'
        ? 'wallet-outline'
        : 'business-outline';

    const newAcc = {
      id,
      name: accountData.name || 'New Account',
      number: accountData.number || '**0000',
      type: accountData.type || defaultType,
      ledgerCategory: cat,
      balance: parseFloat(accountData.balance || 0),
      color: accountData.color || defaultColor,
      accentColor: accountData.accentColor || defaultAccent,
      icon: accountData.icon || defaultIcon,
    };
    const updatedAccounts = [...accounts, newAcc];
    await saveState(updatedAccounts, transactions);
    return newAcc;
  };

  /**
   * Edit existing account
   */
  const updateAccount = async (accountId, updatedFields) => {
    const updatedAccounts = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, ...updatedFields } : acc
    );
    await saveState(updatedAccounts, transactions);
  };

  /**
   * Delete an account
   */
  const deleteAccount = async (accountId) => {
    const updatedAccounts = accounts.filter((a) => a.id !== accountId);
    const updatedTx = transactions.filter((t) => t.accountId !== accountId);
    await saveState(updatedAccounts, updatedTx);
  };

  /**
   * Merge / Club two accounts into a single ledger:
   * - Primary account inherits the target account's number and aliases
   * - Target account's past transactions are reassigned to Primary account
   * - Balances are combined (summed)
   * - Target account is removed
   */
  const mergeAccounts = async (primaryAccountId, targetAccountId) => {
    if (!primaryAccountId || !targetAccountId || primaryAccountId === targetAccountId) {
      throw new Error('Please select two distinct accounts to club.');
    }

    const primaryAcc = accounts.find((a) => a.id === primaryAccountId);
    const targetAcc = accounts.find((a) => a.id === targetAccountId);

    if (!primaryAcc || !targetAcc) {
      throw new Error('Could not locate one or both accounts to merge.');
    }

    // 1. Combine aliases and numbers
    const pAliases = Array.isArray(primaryAcc.aliases) ? [...primaryAcc.aliases] : [];
    const tAliases = Array.isArray(targetAcc.aliases) ? [...targetAcc.aliases] : [];
    const pDigits = (primaryAcc.number || '').replace(/\D/g, '');
    const tDigits = (targetAcc.number || '').replace(/\D/g, '');

    const combinedAliases = Array.from(
      new Set(
        [...pAliases, ...tAliases, pDigits, tDigits, targetAcc.number].filter(
          (x) => !!x && x.length > 0
        )
      )
    );

    // 2. Combine balance
    const combinedBalance = parseFloat(
      ((primaryAcc.balance || 0) + (targetAcc.balance || 0)).toFixed(2)
    );

    // 3. Update primary account
    const updatedPrimary = {
      ...primaryAcc,
      balance: combinedBalance,
      aliases: combinedAliases,
    };

    // 4. Update accounts list
    const updatedAccounts = accounts
      .filter((a) => a.id !== targetAccountId)
      .map((a) => (a.id === primaryAccountId ? updatedPrimary : a));

    // 5. Reassign all past transactions
    const updatedTx = transactions.map((t) => {
      if (t.accountId === targetAccountId) {
        return {
          ...t,
          accountId: primaryAccountId,
          accountName: primaryAcc.name,
        };
      }
      return t;
    });

    await saveState(updatedAccounts, updatedTx);

    return {
      success: true,
      mergedAccount: updatedPrimary,
    };
  };

  // Total Net Worth computation
  const totalNetWorth = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  // In-Memory Indexed Views (Pre-computed for 0ms reactivity)
  const accountsById = {};
  accounts.forEach((a) => {
    accountsById[a.id] = a;
  });

  const accountsByType = {
    bank: accounts.filter((a) => a.ledgerCategory === 'debit'),
    credit: accounts.filter((a) => a.ledgerCategory === 'credit'),
    wallet: accounts.filter((a) => a.ledgerCategory === 'wallet'),
    cash: accounts.filter((a) => a.ledgerCategory === 'cash'),
  };

  const totalBankBalance = accountsByType.bank.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalCreditDebt = accountsByType.credit.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalWalletCash = accountsByType.wallet.reduce((sum, a) => sum + (a.balance || 0), 0) +
    accountsByType.cash.reduce((sum, a) => sum + (a.balance || 0), 0);

  // Monthly stats computation
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let monthlyInflow = 0;
  let monthlyOutflow = 0;

  transactions.forEach((tx) => {
    if (tx.isReminder) return; // Reminders do not alter monthly inflow/outflow
    const txDate = new Date(tx.date);
    if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
      if (tx.type === 'income') {
        monthlyInflow += tx.amount;
      } else if (tx.type === 'expense') {
        monthlyOutflow += tx.amount;
      }
    }
  });

  return (
    <FinanceContext.Provider
      value={{
        accounts,
        transactions,
        categories,
        isLoading,
        totalNetWorth,
        totalBankBalance,
        totalCreditDebt,
        totalWalletCash,
        accountsById,
        accountsByType,
        monthlyInflow,
        monthlyOutflow,
        addTransaction,
        batchAddTransactions,
        deleteTransaction,
        updateTransaction,
        updateTransactionComment,
        overrideAccountBalance,
        exportBackupJson,
        importBackupJson,
        resetToDemoData,
        clearLedgerData,
        resetToCleanSlate,
        addAccount,
        updateAccount,
        deleteAccount,
        mergeAccounts,
        blacklistedFingerprints,
        blacklistFingerprint,
        unblacklistFingerprint,
        ignoredTransactions,
        ignoreTransaction,
        restoreIgnoredTransaction,
        purgeIgnoredTransaction,
        theme,
        themeMode,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
