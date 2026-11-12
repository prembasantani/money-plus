/**
 * Advanced SMS & Notification Parser for Indian Banking & UPI Transactions
 * Supports automated account detection, accurate amount extraction, and category classification.
 */

import { generateFingerprint, normalizeSmsText } from './deduplication.js';

export const KNOWN_BANKS = [
  {
    id: 'jpbl',
    name: 'Jio Payments Bank',
    shortName: 'JPBL',
    patterns: [/\bjpbl\b/i, /jio payments? bank/i, /\bjio bank\b/i],
    color: '#0284C7',
    accentColor: '#0369A1',
    icon: 'business-outline',
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    shortName: 'SBI',
    patterns: [/\bsbi\b/i, /state bank/i],
    color: '#2563EB',
    accentColor: '#1D4ED8',
    icon: 'business-outline',
  },
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    shortName: 'HDFC',
    patterns: [/\bhdfc\b/i],
    color: '#0284C7',
    accentColor: '#0369A1',
    icon: 'card-outline',
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    shortName: 'ICICI',
    patterns: [/\bicici\b/i],
    color: '#F97316',
    accentColor: '#EA580C',
    icon: 'business-outline',
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    shortName: 'Axis',
    patterns: [/\baxis\b/i],
    color: '#991B1B',
    accentColor: '#7F1D1D',
    icon: 'business-outline',
  },
  {
    id: 'kotak',
    name: 'Kotak Bank',
    shortName: 'Kotak',
    patterns: [/\bkotak\b/i],
    color: '#DC2626',
    accentColor: '#B91C1C',
    icon: 'business-outline',
  },
  {
    id: 'rbl',
    name: 'RBL Bank',
    shortName: 'RBL Bank',
    patterns: [/\brbl\b/i, /rbl bank/i, /ratnakar/i],
    color: '#E11D48',
    accentColor: '#BE123C',
    icon: 'card-outline',
  },
  {
    id: 'bob',
    name: 'Bank of Baroda',
    shortName: 'Bank of Baroda',
    patterns: [/bank of baroda/i, /\bbob\b/i, /\bbaroda\b/i],
    color: '#EA580C',
    accentColor: '#C2410C',
    icon: 'business-outline',
  },
  {
    id: 'pnb',
    name: 'Punjab National Bank',
    shortName: 'PNB',
    patterns: [/\bpnb\b/i, /punjab national/i],
    color: '#CA8A04',
    accentColor: '#A16207',
    icon: 'business-outline',
  },
  {
    id: 'canara',
    name: 'Canara Bank',
    shortName: 'Canara Bank',
    patterns: [/canara/i],
    color: '#0284C7',
    accentColor: '#0369A1',
    icon: 'business-outline',
  },
  {
    id: 'idfc',
    name: 'IDFC FIRST Bank',
    shortName: 'IDFC FIRST',
    patterns: [/\bidfc\b/i],
    color: '#991B1B',
    accentColor: '#7F1D1D',
    icon: 'business-outline',
  },
  {
    id: 'indusind',
    name: 'IndusInd Bank',
    shortName: 'IndusInd',
    patterns: [/indusind/i],
    color: '#831843',
    accentColor: '#701A75',
    icon: 'business-outline',
  },
  {
    id: 'union',
    name: 'Union Bank of India',
    shortName: 'Union Bank',
    patterns: [/union bank/i, /\bubi\b/i],
    color: '#0284C7',
    accentColor: '#0369A1',
    icon: 'business-outline',
  },
  {
    id: 'au',
    name: 'AU Small Finance Bank',
    shortName: 'AU Bank',
    patterns: [/au small finance/i, /\bau bank\b/i, /\baubank\b/i],
    color: '#7C2D12',
    accentColor: '#9A3412',
    icon: 'business-outline',
  },
  {
    id: 'federal',
    name: 'Federal Bank',
    shortName: 'Federal Bank',
    patterns: [/federal bank/i, /\bfi money\b/i, /\bjupiter\b/i],
    color: '#1E40AF',
    accentColor: '#1E3A8A',
    icon: 'business-outline',
  },
  {
    id: 'scb',
    name: 'Standard Chartered',
    shortName: 'StanChart',
    patterns: [/standard chartered/i, /stanchart/i, /\bscb\b/i],
    color: '#047857',
    accentColor: '#065F46',
    icon: 'card-outline',
  },
  {
    id: 'citi',
    name: 'Citibank',
    shortName: 'Citi',
    patterns: [/citibank/i, /\bciti\b/i],
    color: '#0284C7',
    accentColor: '#0369A1',
    icon: 'card-outline',
  },
  {
    id: 'hsbc',
    name: 'HSBC',
    shortName: 'HSBC',
    patterns: [/\bhsbc\b/i],
    color: '#DC2626',
    accentColor: '#B91C1C',
    icon: 'business-outline',
  },
  {
    id: 'onecard',
    name: 'OneCard',
    shortName: 'OneCard',
    patterns: [/onecard/i, /fpl tech/i],
    color: '#1E293B',
    accentColor: '#0F172A',
    icon: 'card-outline',
  },
  {
    id: 'slice',
    name: 'Slice Card',
    shortName: 'Slice',
    patterns: [/slice/i],
    color: '#9333EA',
    accentColor: '#7E22CE',
    icon: 'card-outline',
  },
  {
    id: 'gpay',
    name: 'Google Pay',
    shortName: 'GPay',
    patterns: [/google pay/i, /\bgpay\b/i],
    color: '#10B981',
    accentColor: '#047857',
    icon: 'flash-outline',
  },
  {
    id: 'paytm',
    name: 'Paytm Wallet',
    shortName: 'Paytm',
    patterns: [/paytm/i],
    color: '#06B6D4',
    accentColor: '#0E7490',
    icon: 'wallet-outline',
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    shortName: 'PhonePe',
    patterns: [/phonepe/i],
    color: '#7C3AED',
    accentColor: '#6D28D9',
    icon: 'flash-outline',
  },
];

// Keyword mapping for automatic category classification
const CATEGORY_RULES = [
  { categoryId: 'cat_food', keywords: ['swiggy', 'zomato', 'starbucks', 'chai', 'coffee', 'mcdonald', 'burger', 'kfc', 'cafe', 'restaurant', 'food', 'pizza', 'diner', 'eats', 'bake', 'bakery', 'tea', 'tiffin'] },
  { categoryId: 'cat_groceries', keywords: ['dmart', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'supermarket', 'grocer', 'spencer', 'more retail', 'milk', 'vegetables', 'nature basket'] },
  { categoryId: 'cat_shopping', keywords: ['amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'ajio', 'retail', 'clothing', 'fashion', 'electronics', 'croma', 'reliance digital', 'store', 'mall', 'shoppers stop'] },
  { categoryId: 'cat_transport', keywords: ['uber', 'ola', 'rapido', 'metro', 'petrol', 'fuel', 'shell', 'hpcl', 'bpcl', 'irctc', 'flight', 'railway', 'bus', 'toll', 'fastag'] },
  { categoryId: 'cat_entertainment', keywords: ['netflix', 'spotify', 'prime', 'hotstar', 'cinema', 'pvr', 'inox', 'movie', 'bookmyshow', 'gaming', 'steam', 'playstation', 'theater', 'youtube', 'yt'] },
  { categoryId: 'cat_bills', keywords: ['airtel', 'jio', 'vi', 'bescom', 'tata play', 'broadband', 'electricity', 'water', 'gas', 'bill', 'recharge', 'utility', 'wifi', 'dth', 'bbps', 'bill payment', 'credit card bill'] },
  { categoryId: 'cat_salary', keywords: ['salary', 'payroll', 'stipend', 'infotech', 'technologies', 'solutions pvt', 'corp', 'infosys', 'tcs', 'wipro', 'consultancy'] },
  { categoryId: 'cat_investment', keywords: ['interest', 'dividend', 'zerodha', 'groww', 'mutual fund', 'nav', 'yield', 'cashback', 'reward', 'fixed deposit', 'fd interest'] },
];

/**
 * Determine category ID from merchant and description text
 */
export function inferCategory(text, type = 'expense') {
  const lower = text.toLowerCase();

  // Transfers & Credit Card Bill Payments
  if (
    lower.includes('credit card bill') ||
    lower.includes('card payment') ||
    (lower.includes('payment') && lower.includes('credit card')) ||
    lower.includes('bbps') ||
    lower.includes('fund transfer') ||
    lower.includes('self transfer')
  ) {
    return 'cat_transfer';
  }

  if (type === 'income') {
    if (lower.includes('salary') || lower.includes('payroll') || lower.includes('corp') || lower.includes('employer')) {
      return 'cat_salary';
    }
    if (lower.includes('interest') || lower.includes('cashback') || lower.includes('reward') || lower.includes('dividend')) {
      return 'cat_investment';
    }
    return 'cat_salary';
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.categoryId;
    }
  }
  return 'cat_other';
}

/**
 * Extract Account info (last digits, bank details, credit vs debit) and resolve or generate a new account
 */
export function resolveAccountInfo(text, availableAccounts = []) {
  const lower = text.toLowerCase();

  // 1. Identify bank if mentioned (strip UPI beneficiary/payee handle so recipient merchant bank doesn't hijack sender bank)
  const textWithoutUpiPayee = text.replace(/UPI\/(?:DR|CR)\/\d+\/[^/\s\n]+/gi, '');
  let detectedBank = null;
  for (const bank of KNOWN_BANKS) {
    if (bank.patterns.some((p) => p.test(textWithoutUpiPayee))) {
      detectedBank = bank;
      break;
    }
  }

  // 2. Identify account digits (e.g. x1074, X1074, **1234, XX5678, ending 5678, A/C 9812, etc.)
  // Strip out amounts, UPI references, phone numbers, and dates to avoid matching amount digits (e.g. 4560 from Rs 4560.23)
  const strippedForDigits = text
    .replace(/(?:Rs\.?|INR|₹)\s*[\d,]+(?:\.\d+)?/gi, '')
    .replace(/UPI\/(?:DR|CR)\/\d+/gi, '')
    .replace(/\b(?:1800\d{6,8}|\d{10,12})\b/g, '')
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '')
    .replace(/\b\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}\b/g, '');

  let digits = '';
  const digitsMatch =
    strippedForDigits.match(/(?:sent\s+from|from|to|in|a\/c|account|acct|card)\s*(?:no\.?)?\s*[:\s-]*\(?([xX*]*\d{3,6})\)?/i) ||
    strippedForDigits.match(/\b([xX*]+\d{3,6})\b/) ||
    strippedForDigits.match(/\(([xX*]*\d{3,6})\)/) ||
    strippedForDigits.match(/(?:Card|A\/C|Acct)\s*([xX*]*\d{3,6})\b/i) ||
    strippedForDigits.match(/ending\s+(?:in\s+|with\s+)?\(?([xX*]*\d{3,6})\)?/i);

  if (digitsMatch && digitsMatch[1]) {
    digits = digitsMatch[1].replace(/\D/g, '');
  }

  // 3. Determine if it's Credit Card vs Debit Account vs Wallet vs Cash
  const isCredit =
    lower.includes('credit card') ||
    (lower.includes('card') && (lower.includes('limit') || lower.includes('avl limit') || lower.includes('credit') || lower.includes('spent at')));
  const isWallet =
    lower.includes('wallet') ||
    lower.includes('gpay') ||
    lower.includes('google pay') ||
    lower.includes('paytm') ||
    lower.includes('phonepe') ||
    lower.includes('amazon pay') ||
    lower.includes('mobikwik') ||
    lower.includes('freecharge');
  const isCash = lower.includes('cash');

  let ledgerCategory = 'debit';
  let accType = 'Bank Account';
  if (isCredit) {
    ledgerCategory = 'credit';
    accType = detectedBank ? `${detectedBank.shortName} Credit Card` : 'Credit Card';
  } else if (isWallet) {
    ledgerCategory = 'wallet';
    accType = detectedBank ? `${detectedBank.shortName} Wallet` : 'Digital Wallet';
  } else if (isCash) {
    ledgerCategory = 'cash';
    accType = 'Cash';
  } else if (detectedBank) {
    accType = `${detectedBank.shortName} Account`;
  }

  // 4. Try to match an existing account by last 3/4 digits OR aliases (e.g. 8417 matches 417, 1074 matches x1074)
  if (digits.length >= 3) {
    const last3or4 = digits.slice(-4);
    for (const acc of availableAccounts) {
      const accDigits = (acc.number || '').replace(/\D/g, '');
      const matchNumber =
        accDigits.length >= 3 &&
        (accDigits.endsWith(last3or4) || last3or4.endsWith(accDigits));

      // Match aliases
      const matchAlias =
        Array.isArray(acc.aliases) &&
        acc.aliases.some((alias) => {
          const aDigits = String(alias).replace(/\D/g, '');
          return aDigits && (aDigits.endsWith(last3or4) || last3or4.endsWith(aDigits));
        });

      if (matchNumber || matchAlias) {
        return {
          accountId: acc.id,
          accountName: acc.name,
          accountNumber: acc.number,
          ledgerCategory: acc.ledgerCategory || ledgerCategory,
          isNew: false,
          discoveredAccount: null,
        };
      }
    }
  }

  // 5. Try to match an existing account by bank name and category
  if (detectedBank) {
    for (const acc of availableAccounts) {
      const accNameLower = (acc.name || '').toLowerCase();
      const matchCat = !acc.ledgerCategory || acc.ledgerCategory === ledgerCategory;
      if (detectedBank.patterns.some((p) => p.test(accNameLower)) && matchCat) {
        return {
          accountId: acc.id,
          accountName: acc.name,
          accountNumber: acc.number,
          ledgerCategory: acc.ledgerCategory || ledgerCategory,
          isNew: false,
          discoveredAccount: null,
        };
      }
    }
  }

  // 6. If no existing account matches, AUTOMATICALLY DISCOVER & CREATE ONE!
  const finalDigits = digits.length >= 3 ? digits.slice(-4) : '';
  const accountIdentifier = finalDigits ? `**${finalDigits}` : (detectedBank ? `${detectedBank.shortName}` : 'Primary');
  const bankKey = detectedBank ? detectedBank.id : (isCredit ? 'credit_card' : 'bank');
  const newAccId = `acc_${bankKey}_${finalDigits || 'active'}`;

  let bankFullName = 'Bank Account';
  if (isCredit) {
    bankFullName = detectedBank
      ? `${detectedBank.name} Credit Card (**${finalDigits || 'Card'})`
      : `Credit Card (**${finalDigits || 'Active'})`;
  } else if (isWallet) {
    if (detectedBank && detectedBank.name.toLowerCase().includes('wallet')) {
      bankFullName = detectedBank.name;
    } else if (detectedBank) {
      bankFullName = `${detectedBank.shortName} Wallet`;
    } else if (lower.includes('paytm')) {
      bankFullName = 'Paytm Wallet';
    } else if (lower.includes('amazon')) {
      bankFullName = 'Amazon Pay Wallet';
    } else if (lower.includes('phonepe')) {
      bankFullName = 'PhonePe Wallet';
    } else if (lower.includes('mobikwik')) {
      bankFullName = 'Mobikwik Wallet';
    } else {
      bankFullName = 'Digital Wallet';
    }
  } else if (detectedBank) {
    bankFullName = `${detectedBank.name}${finalDigits ? ` (**${finalDigits})` : ''}`;
  } else {
    bankFullName = `Bank Account (**${finalDigits || 'Active'})`;
  }

  const discoveredAccount = {
    id: newAccId,
    name: bankFullName,
    number: accountIdentifier,
    aliases: finalDigits ? [finalDigits] : [],
    type: accType,
    ledgerCategory,
    balance: 0.00,
    color: isCredit ? '#E11D48' : isWallet ? '#06B6D4' : isCash ? '#10B981' : (detectedBank ? detectedBank.color : '#6366F1'),
    accentColor: isCredit ? '#BE123C' : isWallet ? '#0891B2' : isCash ? '#059669' : (detectedBank ? detectedBank.accentColor : '#4F46E5'),
    icon: isCredit ? 'card-outline' : isWallet ? 'wallet-outline' : isCash ? 'cash-outline' : (detectedBank ? detectedBank.icon : 'business-outline'),
    isAutoDiscovered: true,
  };

  return {
    accountId: newAccId,
    accountName: discoveredAccount.name,
    accountNumber: discoveredAccount.number,
    ledgerCategory,
    isNew: true,
    discoveredAccount,
  };
}

/**
 * Extract actual transaction amount reliably (ignores closing balances)
 */
export function extractActualAmount(text) {
  // Step 1: Look for transaction action verbs
  const debitMatch = text.match(/(?:debited\s+(?:by|with|for|of)?)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (debitMatch && debitMatch[1]) {
    const val = parseFloat(debitMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  const creditMatch = text.match(/(?:credited\s+(?:by|with|for|to\s+your\s+account)?)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (creditMatch && creditMatch[1]) {
    const val = parseFloat(creditMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  const actionMatch = text.match(/(?:sent|paid|spent|withdrawn|transferred|deducted|trf\s+of)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (actionMatch && actionMatch[1]) {
    const val = parseFloat(actionMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  const prefixMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:debited|credited|spent|paid|withdrawn|sent|transferred|deducted)/i);
  if (prefixMatch && prefixMatch[1]) {
    const val = parseFloat(prefixMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  const txnMatch = text.match(/(?:Txn\s+of|Transaction\s+of|Payment\s+of|Purchase\s+of)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (txnMatch && txnMatch[1]) {
    const val = parseFloat(txnMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  // Step 2: Strip out closing balance clauses before fallback matching
  const strippedText = text.replace(
    /(?:Bal|Balance|Avail\s*Bal|Avl\s*Bal|Avail\s*Lmt|Limit|AVL\s*limit)[\s:\-—]*(?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d{1,2})?/gi,
    ''
  );

  const fallbackMatch = strippedText.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (fallbackMatch && fallbackMatch[1]) {
    const val = parseFloat(fallbackMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  return 0;
}

/**
 * Extract date from SMS text or use provided SMS timestamp
 */
export function extractDate(text, rawTimestamp = null) {
  const tsNum = typeof rawTimestamp === 'number' ? rawTimestamp : parseInt(rawTimestamp, 10);
  if (!isNaN(tsNum) && tsNum > 0) {
    const d = new Date(tsNum);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Pattern 1: DD-MMM-YY(YY) or DD-MM-YYYY (e.g. 10-11-2026 or 10-Nov-26 or 07Oct26)
  const pattern1 = /\b(\d{1,2})[-/ ]?([A-Za-z]{3}|\d{1,2})[-/ ]?(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i;
  const match1 = text.match(pattern1);
  if (match1) {
    try {
      const day = parseInt(match1[1], 10);
      const mStr = match1[2];
      let year = parseInt(match1[3], 10);
      if (year < 100) year += 2000;

      let month = -1;
      if (/^\d+$/.test(mStr)) {
        month = parseInt(mStr, 10) - 1;
      } else {
        const months = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        };
        month = months[mStr.toLowerCase().slice(0, 3)];
      }

      let hour = match1[4] ? parseInt(match1[4], 10) : 12;
      const min = match1[5] ? parseInt(match1[5], 10) : 0;
      const sec = match1[6] ? parseInt(match1[6], 10) : 0;
      const ampm = match1[7];

      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }

      if (month !== undefined && month >= 0 && month <= 11) {
        const d = new Date(year, month, day, hour, min, sec);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    } catch {
      // Fallback
    }
  }

  return new Date().toISOString();
}

/**
 * Extract counterparty or merchant from transaction text
 */
export function extractCounterparty(text, type = 'expense') {
  // 1. Credit card bill payments (e.g. 'received payment of ... credited to your SBI Credit Card')
  if (
    /(?:payment.*?credited to your.*?credit card|received payment.*?credit card)/i.test(text) ||
    /(?:credited\s+to\s+your\s+(?:[A-Za-z\s]+?Credit\s+Card))/i.test(text)
  ) {
    const cardMatch = text.match(/(?:to\s+your\s+([A-Za-z\s]+?Credit\s+Card))/i);
    const card = cardMatch ? cardMatch[1].trim() : 'Credit Card';
    return `${card} Bill Payment`;
  }

  // 2. '; <MERCHANT> credited' pattern (common in ICICI, Axis, HDFC UPI debits: '; BLINKIT credited')
  const mCred = text.match(/[;\.]\s*([A-Za-z][A-Za-z0-9\s.&'\-\/]{1,35}?)\s+credited/i);
  if (mCred && mCred[1]) {
    const c = mCred[1].trim();
    const isBad = /^(?:rs\.?|inr|₹|account|a\/c|amount|user)$/i.test(c) ||
      /^(?:the|your|my)?\s*(?:[A-Za-z\s]+)?(?:account|a\/c|card)$/i.test(c);
    if (!isBad) {
      return c;
    }
  }

  // 3. For genuine income with 'by <employer>' or 'from <sender>'
  if (type === 'income') {
    const mBy = text.match(/(?:by|from)\s+([A-Za-z0-9\s.&'\-\/]{2,40}?)(?:\s+on|\s+via|\s+using|\s+Ref|\s+UPI|\s+Avail|\s+Bal|\.|$|Date)/i);
    if (mBy && mBy[1]) {
      const c = mBy[1].trim().replace(/[.,;:]$/, '');
      const isBad = /^(?:the|your|a|an|account|a\/c|rs\.?|inr|₹)$/i.test(c) ||
        /^(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?$/i.test(c);
      if (!isBad && c.length > 1) {
        return c;
      }
    }
    if (/cashback|reward/i.test(text)) {
      return /google/i.test(text) ? 'Google Pay Reward' : 'Cashback Reward';
    }
    if (/salary/i.test(text)) {
      return 'Salary Inflow';
    }
  }

  // 4. 'spent at', 'trf to', 'paid to', 'transfer to', 'towards', 'to', 'at'
  let matchTo = text.match(/(?:spent\s+at|trf\s+to|paid\s+to|transfer\s+to|towards)\s+([A-Za-z0-9\s.&'\-\/]{2,40}?)(?:\s+on|\s+via|\s+using|\s+Ref|\s+UPI|\s+Avail|\s+Bal|\.|$|Date)/i);
  if (!matchTo) {
    matchTo = text.match(/(?:to|at)\s+([A-Za-z0-9\s.&'\-\/]{2,40}?)(?:\s+on|\s+via|\s+using|\s+Ref|\s+UPI|\s+Avail|\s+Bal|\.|$|Date)/i);
  }

  if (matchTo && matchTo[1]) {
    const cleaned = matchTo[1].trim().replace(/[.,;:]$/, '');
    const isBankOrAcc = /^(?:(?:the|your)\s+)?(?:hdfc|sbi|icici|axis|kotak|pnb|rbl|bank|account|a\/c)\b/i.test(cleaned);
    const isBad = isBankOrAcc ||
      /^(?:the|your|a|an|account|a\/c|rs\.?|inr|₹)$/i.test(cleaned) ||
      /^(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?$/i.test(cleaned);
    if (cleaned.length > 1 && !isBad) {
      return cleaned;
    }
  }

  // 5. Fallback 'by <source>' or 'from <source>'
  const matchBy = text.match(/(?:by|from)\s+([A-Za-z0-9\s.&'\-\/]{2,40}?)(?:\s+on|\s+via|\s+using|\s+Ref|\s+UPI|\s+Avail|\s+Bal|\.|$|Date)/i);
  if (matchBy && matchBy[1]) {
    const cleaned = matchBy[1].trim().replace(/[.,;:]$/, '');
    const isBad = /^(?:the|your|a|an|account|a\/c|rs\.?|inr|₹|rbl|sbi|hdfc|icici|axis|kotak)$/i.test(cleaned) ||
      /^(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?$/i.test(cleaned);
    if (cleaned.length > 1 && !isBad) {
      return cleaned;
    }
  }

  return type === 'income' ? 'Salary / Credit Inflow' : 'General Merchant';
}

/**
 * Parse an individual SMS / notification message
 * Returns structured transaction object and any newly discovered account
 */
export function parseSingleMessage(
  rawText,
  availableAccounts = [],
  rawTimestampOrOptions = null,
  blacklistedFingerprintsParam = []
) {
  let rawTimestamp = null;
  let blacklistedFingerprints = blacklistedFingerprintsParam;

  if (Array.isArray(rawTimestampOrOptions)) {
    blacklistedFingerprints = rawTimestampOrOptions;
  } else if (rawTimestampOrOptions && typeof rawTimestampOrOptions === 'object') {
    rawTimestamp = rawTimestampOrOptions.rawTimestamp || null;
    blacklistedFingerprints = rawTimestampOrOptions.blacklistedFingerprints || [];
  } else {
    rawTimestamp = rawTimestampOrOptions;
  }

  const text = (rawText || '').trim();
  if (!text || text.length < 10) return null;

  const lower = text.toLowerCase();

  // 1. Ignore OTPs, verification codes, and security tokens
  if (/\b(otp|one time password|verification code|secret code|login pin)\b/i.test(lower)) {
    return null;
  }

  // 1a. Block external messaging links and link shorteners (WhatsApp job scams, phishing, telegram tasks)
  if (
    /(?:whatsapp\.com|wa\.me|t\.me|telegram\.me|bit\.ly|tinyurl\.com|cutt\.ly|shorturl\.at|goo\.gl)\b/i.test(text)
  ) {
    return null;
  }

  // 1b. Block fake job offers, work-from-home tasks, appointment pitches, and salary scams
  if (
    /\b(?:simple\s+working|spare\s+time|work\s+from\s+home|part[- ]?time\s+job|daily\s+income|earn\s+daily|earn\s+rs|earn\s+money|hourly\s+rate|scheduled\s+for\s+you|appointment\s+for|appoitment\s+for)\b/i.test(lower) ||
    lower.includes('appointment for salary') ||
    lower.includes('appoitment for salary') ||
    lower.includes('simple working in spare time') ||
    lower.includes('simple working')
  ) {
    return null;
  }

  // 1c. Block Loan applications, requests, status queries, offers, and lending aggregators
  if (
    /\b(?:loan\s+(?:request|application|status|offer|approved|sanctioned|sanction|disburs|amount)|pre[- ]?approved|apply\s+for\s+loan|loan\s+eligible|get\s+loan|instant\s+loan|personal\s+loan|business\s+loan|credit\s+line|paylater\s+limit)\b/i.test(lower) ||
    /\b(?:flexiloans|kreditbee|moneyview|cashe|paysense|rupeelend|bajaj\s+finserv|home\s+credit|earlysalary|zestmoney|mfortune|ring\s+app)\b/i.test(lower) ||
    /\b(?:credit\s+score|cibil\s+score|check\s+your\s+score)\b/i.test(lower) ||
    lower.includes('loan request') ||
    lower.includes('loan application') ||
    (lower.includes('loan') && (lower.includes('received') || lower.includes('status') || lower.includes('apply') || lower.includes('application')))
  ) {
    return null;
  }

  // 1d. Block Promotional ads, discount coupons, voucher credits, and checkout offers
  if (
    /\b(?:coupon|voucher|promo\s+code|discount\s+coupon|%?\s*off\*?|extra\s+\d+%\s+off|at\s+checkout|checkout|exclusive\s+offer|use\s+code|scratch\s+card|flat\s+rs|win\s+up\s+to|reward\s+points|bonus\s+cash|gaming\s+credits|claim\s+voucher|gift\s+card)\b/i.test(lower) ||
    lower.includes('coupon credited') ||
    lower.includes('voucher credited') ||
    lower.includes('off* coupon') ||
    (lower.includes('credited in') && (lower.includes('tira') || lower.includes('myntra') || lower.includes('flipkart') || lower.includes('amazon') || lower.includes('account!') || lower.includes('wallet!'))) ||
    lower.includes('congratulations')
  ) {
    return null;
  }

  // 1e. Block non-transaction informational notices (e.g. Swiggy refund reference number / ticket number without actual bank credit)
  if (
    /\b(?:refund\s+reference\s+(?:no|number)|refund\s+request\s+(?:no|number)|complaint\s+(?:no|number)|service\s+request|ticket\s+(?:no|number)|tracking\s+id)\b/i.test(lower) &&
    !/\b(?:credited\s+to\s+your\s+(?:a\/c|account|bank)|credited\s+by\s+rs|debited)\b/i.test(lower)
  ) {
    return null;
  }

  // 2. Ignore Credit Card Monthly Statements / Bill Due alerts (these are reminders, NOT spend transactions!)
  if (
    lower.includes('statement is sent') ||
    lower.includes('bill generated') ||
    lower.includes('e-statement') ||
    (lower.includes('is due by') && (lower.includes('minimum') || lower.includes('total of'))) ||
    lower.includes('total payment due') ||
    lower.includes('payment due date')
  ) {
    return null;
  }

  // 3. Must have a financial trigger word with actual executed movement of funds
  const hasSalaryExecution =
    lower.includes('salary') &&
    (/\b(?:credited|deposited|received|transfer|inward|a\/c|account|bank)\b/i.test(lower) ||
      /\b(?:tech|corp|solutions|pvt|ltd|infotech|infosys|tcs|wipro)\b/i.test(lower));

  const hasTrigger =
    lower.includes('debited') ||
    lower.includes('credited') ||
    lower.includes('spent') ||
    lower.includes('paid') ||
    lower.includes('sent') ||
    lower.includes('withdrawn') ||
    lower.includes('transferred') ||
    lower.includes('received') ||
    (lower.includes('refund') && /\b(?:credited|processed\s+to|deposited)\b/i.test(lower)) ||
    hasSalaryExecution;

  if (!hasTrigger) return null;

  // 4. Amount
  const amount = extractActualAmount(text);
  if (!amount || isNaN(amount) || amount <= 0) {
    return null;
  }

  // 5. Type: expense vs income
  // CRITICAL RULES:
  // - Credit card bill payment received is INCOME (+) for the credit card account (pays off liability)
  // - If user's bank account was debited/spent/sent/paid, it is EXPENSE (-) even if merchant is credited
  let type = 'expense';

  const isCreditCardPayment =
    /(?:payment\s+of|payment\s+received).*?(?:credit\s+card|card)/i.test(lower) ||
    /(?:credited\s+to\s+your\s+(?:[a-z\s]+)?credit\s+card)/i.test(lower) ||
    /(?:received\s+payment.*?via\s+bbps)/i.test(lower) ||
    /(?:payment\s+received.*?via\s+bbps)/i.test(lower);

  const isExplicitDebit =
    /\b(?:debited|spent|paid|sent|withdrawn|deducted)\b/i.test(lower) ||
    /\b(?:purchase\s+of|dr\s+from|transferred\s+from)\b/i.test(lower);

  if (isCreditCardPayment) {
    // Payment received on Credit Card reduces debt: it's a CREDIT (+) on the credit card ledger!
    type = 'income';
  } else if (isExplicitDebit) {
    type = 'expense';
  } else {
    // Only genuine credits/deposits to the user's account without any debit are income
    const isExplicitCredit =
      /\b(?:salary|payroll|stipend)\b/i.test(lower) ||
      /\b(?:refund|cashback|dividend|interest\s+credited)\b/i.test(lower) ||
      /\b(?:credited\s+(?:by|with|to\s+your\s+account|to\s+your\s+a\/c|in\s+your\s+a\/c))\b/i.test(lower) ||
      /\b(?:received\s+(?:rs\.?|inr|₹|from))\b/i.test(lower) ||
      /\b(?:deposited\s+(?:in|into|to))\b/i.test(lower) ||
      /\b(?:inward\s+remittance|money\s+received)\b/i.test(lower);

    if (isExplicitCredit) {
      type = 'income';
    }
  }

  // 6. Account resolution & auto-discovery (debit vs credit vs wallet)
  const accountResult = resolveAccountInfo(text, availableAccounts);

  // 7. Counterparty (Merchants are strictly counterparties, never ledgers)
  const counterparty = extractCounterparty(text, type);

  // 8. Date
  const date = extractDate(text, rawTimestamp);

  // 9. Category (Card bill payments and inter-ledger fund transfers get cat_transfer)
  let categoryId = inferCategory(`${counterparty} ${text}`, type);
  if (isCreditCardPayment) {
    categoryId = 'cat_transfer';
  }

  // 10. Compute Fingerprint hash
  const fingerprint = generateFingerprint(date, amount, accountResult.accountId, counterparty);

  // 11. Check if user permanently blacklisted this fingerprint or message
  const normText = normalizeSmsText(text);
  if (Array.isArray(blacklistedFingerprints) && blacklistedFingerprints.length > 0) {
    if (
      blacklistedFingerprints.includes(fingerprint) ||
      blacklistedFingerprints.includes(text) ||
      blacklistedFingerprints.includes(normText) ||
      blacklistedFingerprints.some((bf) => bf && normalizeSmsText(bf) === normText)
    ) {
      return null; // Permanently excluded from sync
    }
  }

  // 12. Closing Balance (if present)
  let closingBalance = null;
  const balMatch = text.match(/(?:Bal|Balance|Avail\s*Bal|Avl\s*Bal|AVL\s*limit)[\s:\-—]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    const bVal = parseFloat(balMatch[1].replace(/,/g, ''));
    if (!isNaN(bVal)) closingBalance = bVal;
  }

  // 13. Uncertainty assessment
  // Only truly ambiguous reversals or unresolved accounts are flagged
  let isUncertain = false;
  let uncertaintyReason = null;

  if (lower.includes('refund') || lower.includes('reversal') || lower.includes('reversed')) {
    isUncertain = true;
    uncertaintyReason = 'Refund or payment reversal';
  }

  return {
    id: `tx_parsed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amount,
    type,
    accountId: accountResult.accountId,
    accountName: accountResult.accountName,
    accountNumber: accountResult.accountNumber,
    ledgerCategory: accountResult.ledgerCategory,
    categoryId,
    counterparty,
    date,
    note: text,
    rawText: text,
    fingerprint,
    closingBalance,
    discoveredAccount: accountResult.discoveredAccount,
    isUncertain,
    uncertaintyReason,
  };
}

/**
 * Parse a list of SMS message objects directly from Android inbox (content://sms/inbox)
 */
export function parseDeviceSmsList(smsList, availableAccounts = [], blacklistedFingerprints = []) {
  if (!Array.isArray(smsList) || smsList.length === 0) return { transactions: [], newAccounts: [] };

  const parsedList = [];
  const discoveredAccountsMap = {};
  const currentAccountsPool = [...availableAccounts];

  for (const sms of smsList) {
    const item = parseSingleMessage(sms.body, currentAccountsPool, sms.date, blacklistedFingerprints);
    if (item) {
      if (item.discoveredAccount) {
        const acc = item.discoveredAccount;
        if (!discoveredAccountsMap[acc.id]) {
          discoveredAccountsMap[acc.id] = acc;
          currentAccountsPool.push(acc);
        }
      }
      parsedList.push(item);
    }
  }

  return {
    transactions: parsedList,
    newAccounts: Object.values(discoveredAccountsMap),
  };
}

/**
 * Parse a raw text dump containing one or multiple SMS/notification messages
 */
export function parseRawSmsBatch(rawBatch, availableAccounts = [], blacklistedFingerprints = []) {
  if (!rawBatch || typeof rawBatch !== 'string') return [];

  const chunks = rawBatch
    .split(/\n\s*\n|(?=(?:Dear Customer|Dear UPI user|Sent Rs|Alert:))/gi)
    .map((c) => c.trim())
    .filter((c) => c.length > 10);

  const parsed = [];
  const discoveredAccountsMap = {};
  const currentAccountsPool = [...availableAccounts];

  for (const chunk of chunks) {
    const item = parseSingleMessage(chunk, currentAccountsPool, null, blacklistedFingerprints);
    if (item) {
      if (item.discoveredAccount) {
        const acc = item.discoveredAccount;
        if (!discoveredAccountsMap[acc.id]) {
          discoveredAccountsMap[acc.id] = acc;
          currentAccountsPool.push(acc);
        }
      }
      parsed.push(item);
    }
  }

  parsed.discoveredAccounts = Object.values(discoveredAccountsMap);
  return parsed;
}
