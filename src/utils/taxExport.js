// Safe import of Share from react-native for both Metro bundler and Node test environments
let ReactNativeShare = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rn = require('react-native');
  ReactNativeShare = rn?.Share || null;
} catch {
  // Running in headless Node.js unit tests
}

/**
 * Escape field for CSV compliance (RFC 4180)
 */
export function escapeCsvField(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Format Date as DD-MM-YYYY
 */
export function formatTaxDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Determine Financial Year (FY) from date string (April 1 to March 31)
 */
export function getFinancialYear(dateVal) {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'FY 2026-27';
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 2 = Mar, 3 = Apr
  if (month >= 3) {
    const nextYear = String(year + 1).slice(-2);
    return `FY ${year}-${nextYear}`;
  } else {
    const prevYear = year - 1;
    const currYear = String(year).slice(-2);
    return `FY ${prevYear}-${currYear}`;
  }
}

/**
 * Determine Assessment Year (AY) from date string
 */
export function getAssessmentYear(dateVal) {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'AY 2027-28';
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 3) {
    return `AY ${year + 1}-${String(year + 2).slice(-2)}`;
  } else {
    return `AY ${year}-${String(year + 1).slice(-2)}`;
  }
}

/**
 * Map finance categories to Indian Income Tax Act P&L Heads
 */
export function mapCategoryToITRHead(catId, txType) {
  if (txType === 'income') {
    if (catId === 'cat_salary') return 'Gross Salary / Professional Compensation (Sec 17(1))';
    if (catId === 'cat_investment') return 'Income from Other Sources (Interest / Dividends / Capital Gains)';
    return 'Other Professional / Business Revenue Receipts';
  }

  // Expenses
  switch (catId) {
    case 'cat_food':
      return 'Staff Welfare & Office Refreshments (Sec 37(1))';
    case 'cat_groceries':
      return 'Pantry, Consumables & Office Provisions';
    case 'cat_shopping':
      return 'Office Equipment, Software & Consumables';
    case 'cat_transport':
      return 'Travelling, Fuel & Conveyance Expenses';
    case 'cat_entertainment':
      return 'Business Promotion & Hospitality Expenses';
    case 'cat_bills':
      return 'Rent, Rates, Power, Telephone & Utility Dues';
    case 'cat_transfer':
      return 'Contra Inter-Account Transfer (Non-Taxable)';
    case 'cat_adjustment':
      return 'Book Balance Reconciliation / Audit Override';
    default:
      return 'General Administrative & Miscellaneous Expenses';
  }
}

/**
 * Filter transactions for tax eligibility (exclude reminders, adjustments, and internal contra transfers)
 */
function getEligibleTaxTransactions(transactions) {
  return transactions.filter(
    (t) =>
      !t.isReminder &&
      t.itemKind !== 'reminder' &&
      t.categoryId !== 'cat_reminder' &&
      t.type !== 'adjustment' &&
      t.categoryId !== 'cat_adjustment' &&
      t.type !== 'transfer' &&
      t.categoryId !== 'cat_transfer'
  );
}

/**
 * 1. GSTR-1: Outward Supplies & Receipts Register (Income CSV)
 */
export function generateGSTR1Csv(transactions, accounts, categories) {
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const incomeTxs = getEligibleTaxTransactions(transactions).filter((t) => t.type === 'income');

  const headers = [
    'Date (DD-MM-YYYY)',
    'Financial Year',
    'Voucher / Ref ID',
    'Customer / Source Entity',
    'Bank Account',
    'Income Category',
    'Gross Inward Amount (INR)',
    'Taxable Base Value (INR)',
    'Applicable GST Rate (%)',
    'CGST (INR)',
    'SGST (INR)',
    'IGST (INR)',
    'Mode of Receipt',
    'Reference & Notes',
  ];

  const rows = incomeTxs.map((t) => {
    const gross = (t.amount || 0).toFixed(2);
    // Standard assumed 18% GST calculation (or 0% exempt based on category)
    const isExempt = t.categoryId === 'cat_investment' || t.categoryId === 'cat_salary';
    const rate = isExempt ? '0%' : '18%';
    const taxable = isExempt ? gross : (t.amount / 1.18).toFixed(2);
    const taxTotal = isExempt ? '0.00' : (t.amount - parseFloat(taxable)).toFixed(2);
    const cgst = isExempt ? '0.00' : (parseFloat(taxTotal) / 2).toFixed(2);
    const sgst = isExempt ? '0.00' : (parseFloat(taxTotal) / 2).toFixed(2);
    const igst = '0.00';

    return [
      escapeCsvField(formatTaxDate(t.date)),
      escapeCsvField(getFinancialYear(t.date)),
      escapeCsvField(t.id),
      escapeCsvField(t.counterparty || 'General Client / Source'),
      escapeCsvField(accountMap[t.accountId] || 'Bank Account'),
      escapeCsvField(categoryMap[t.categoryId] || 'Revenue'),
      escapeCsvField(gross),
      escapeCsvField(taxable),
      escapeCsvField(rate),
      escapeCsvField(cgst),
      escapeCsvField(sgst),
      escapeCsvField(igst),
      escapeCsvField(t.note?.includes('UPI') ? 'UPI' : 'Bank / Digital'),
      escapeCsvField(t.comment || t.note || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * 2. GSTR-3B: Inward Supplies & Input Tax Credit (ITC) Purchase Register (Expense CSV)
 */
export function generateGSTR3BPurchaseCsv(transactions, accounts, categories) {
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const expenseTxs = getEligibleTaxTransactions(transactions).filter((t) => t.type === 'expense');

  const headers = [
    'Date (DD-MM-YYYY)',
    'Financial Year',
    'Voucher / Ref ID',
    'Vendor / Supplier Name',
    'Paid From Account',
    'Expense Category',
    'Total Amount Paid (INR)',
    'Estimated Taxable Value (INR)',
    'Estimated Total GST (18%)',
    'Estimated CGST (9%)',
    'Estimated SGST (9%)',
    'ITC Eligibility (GSTR-3B Classification)',
    'ITC Status Reason',
    'Notes / Transaction Comment',
  ];

  const rows = expenseTxs.map((t) => {
    const totalPaid = (t.amount || 0).toFixed(2);
    const isIneligible = t.categoryId === 'cat_food' || t.categoryId === 'cat_entertainment';
    const isExempt = t.categoryId === 'cat_groceries';

    let itcClassification = 'Eligible - All Other ITC (Table 4A(5))';
    let itcReason = 'Valid business purchase with standard GST input tax credit.';

    if (isIneligible) {
      itcClassification = 'Ineligible ITC - Section 17(5)(b)';
      itcReason = 'Food, dining, beverages & personal entertainment blocked under Section 17(5).';
    } else if (isExempt) {
      itcClassification = 'Non-GST / Exempt Supply (Table 5)';
      itcReason = 'Unprocessed agricultural & fresh grocery supplies zero-rated/exempt.';
    }

    const taxable = isExempt ? totalPaid : (t.amount / 1.18).toFixed(2);
    const taxTotal = isExempt ? '0.00' : (t.amount - parseFloat(taxable)).toFixed(2);
    const cgst = isExempt ? '0.00' : (parseFloat(taxTotal) / 2).toFixed(2);
    const sgst = isExempt ? '0.00' : (parseFloat(taxTotal) / 2).toFixed(2);

    return [
      escapeCsvField(formatTaxDate(t.date)),
      escapeCsvField(getFinancialYear(t.date)),
      escapeCsvField(t.id),
      escapeCsvField(t.counterparty || 'Vendor / Merchant'),
      escapeCsvField(accountMap[t.accountId] || 'Payment Account'),
      escapeCsvField(categoryMap[t.categoryId] || 'General Expense'),
      escapeCsvField(totalPaid),
      escapeCsvField(taxable),
      escapeCsvField(taxTotal),
      escapeCsvField(cgst),
      escapeCsvField(sgst),
      escapeCsvField(itcClassification),
      escapeCsvField(itcReason),
      escapeCsvField(t.comment || t.note || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * 3. ITR Schedule: Income Tax P&L Statement Heads (Income & Expenses CSV)
 */
export function generateITRScheduleCsv(transactions, accounts, categories) {
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const eligibleTxs = getEligibleTaxTransactions(transactions);

  const headers = [
    'Financial Year',
    'Assessment Year',
    'Date (DD-MM-YYYY)',
    'Voucher ID',
    'Nature of Entry',
    'ITR Schedule P&L Head',
    'Category Name',
    'Counterparty / Merchant',
    'Account / Source',
    'Amount (INR)',
    'Comments & Description',
  ];

  const rows = eligibleTxs.map((t) => {
    const isIncome = t.type === 'income';
    const nature = isIncome ? 'Income / Receipt' : 'Expense / Deductible';
    const itrHead = mapCategoryToITRHead(t.categoryId, t.type);

    return [
      escapeCsvField(getFinancialYear(t.date)),
      escapeCsvField(getAssessmentYear(t.date)),
      escapeCsvField(formatTaxDate(t.date)),
      escapeCsvField(t.id),
      escapeCsvField(nature),
      escapeCsvField(itrHead),
      escapeCsvField(categoryMap[t.categoryId] || 'General'),
      escapeCsvField(t.counterparty || 'Counterparty'),
      escapeCsvField(accountMap[t.accountId] || 'Account'),
      escapeCsvField((t.amount || 0).toFixed(2)),
      escapeCsvField(t.comment || t.note || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * 4. Master Unified Tax & Accounting Ledger (Complete CSV)
 */
export function generateUnifiedMasterTaxCsv(transactions, accounts, categories) {
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const eligibleTxs = getEligibleTaxTransactions(transactions);

  const headers = [
    'Date (DD-MM-YYYY)',
    'Financial Year',
    'Assessment Year',
    'Voucher / Ref ID',
    'Nature (Income/Expense)',
    'Counterparty / Merchant',
    'Account',
    'Category',
    'ITR P&L Head',
    'Gross Amount (INR)',
    'Est Taxable Value (INR)',
    'Est CGST 9% (INR)',
    'Est SGST 9% (INR)',
    'Est Total GST (INR)',
    'GSTR-3B ITC Status',
    'User Comments',
    'Raw Bank Ref Note',
  ];

  const rows = eligibleTxs.map((t) => {
    const isIncome = t.type === 'income';
    const nature = isIncome ? 'Income' : 'Expense';
    const itrHead = mapCategoryToITRHead(t.categoryId, t.type);
    const gross = (t.amount || 0).toFixed(2);

    const isIneligible = t.categoryId === 'cat_food' || t.categoryId === 'cat_entertainment';
    const isExempt = t.categoryId === 'cat_groceries' || t.categoryId === 'cat_salary' || t.categoryId === 'cat_investment';

    const taxable = isExempt ? gross : (t.amount / 1.18).toFixed(2);
    const taxTotal = isExempt ? '0.00' : (t.amount - parseFloat(taxable)).toFixed(2);
    const cgst = isExempt ? '0.00' : (parseFloat(taxTotal) / 2).toFixed(2);
    const sgst = isExempt ? '0.00' : (parseFloat(taxTotal) / 2).toFixed(2);

    let itcStatus = isIncome ? 'Outward Supply (GSTR-1)' : 'Eligible - All Other ITC';
    if (!isIncome && isIneligible) {
      itcStatus = 'Ineligible ITC - Sec 17(5)';
    } else if (!isIncome && isExempt) {
      itcStatus = 'Exempt / Non-GST Supply';
    }

    return [
      escapeCsvField(formatTaxDate(t.date)),
      escapeCsvField(getFinancialYear(t.date)),
      escapeCsvField(getAssessmentYear(t.date)),
      escapeCsvField(t.id),
      escapeCsvField(nature),
      escapeCsvField(t.counterparty || 'Counterparty'),
      escapeCsvField(accountMap[t.accountId] || 'Account'),
      escapeCsvField(categoryMap[t.categoryId] || 'General'),
      escapeCsvField(itrHead),
      escapeCsvField(gross),
      escapeCsvField(taxable),
      escapeCsvField(cgst),
      escapeCsvField(sgst),
      escapeCsvField(taxTotal),
      escapeCsvField(itcStatus),
      escapeCsvField(t.comment || ''),
      escapeCsvField(t.note || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Share CSV via native Android / iOS share dialog
 */
export async function shareTaxCsv(title, csvContent, filename = 'money_follows_tax_export.csv') {
  if (!ReactNativeShare) {
    console.warn('Share module not available in this environment.');
    return;
  }
  try {
    const result = await ReactNativeShare.share({
      title: title || 'MoneyFollows Tax Export',
      message: csvContent,
    });
    return result;
  } catch (err) {
    console.warn('Share error:', err);
    throw err;
  }
}
