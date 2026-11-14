export const REMINDER_ACCOUNT = {
  id: 'acc_reminders',
  name: 'Reminders & Mandates',
  number: 'Advisory (Zero Balance)',
  aliases: ['reminder', 'mandate', 'autopay', 'policybazaar'],
  type: 'Upcoming Reminders',
  ledgerCategory: 'reminder',
  balance: 0.00,
  color: '#F59E0B',
  accentColor: '#D97706',
  icon: 'notifications-outline',
  isVirtual: true,
};

export const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_icici',
    name: 'ICICI Bank',
    number: '**5678',
    aliases: ['5678'],
    type: 'Bank Account',
    ledgerCategory: 'debit',
    balance: 84500.00,
    color: '#F59E0B',
    accentColor: '#B45309',
    icon: 'business-outline',
  },
  {
    id: 'acc_hdfc',
    name: 'HDFC Bank',
    number: '**1234',
    aliases: ['1234'],
    type: 'Salary Account',
    ledgerCategory: 'debit',
    balance: 142250.00,
    color: '#3B82F6',
    accentColor: '#1D4ED8',
    icon: 'card-outline',
  },
  {
    id: 'acc_gpay',
    name: 'Google Pay',
    number: 'UPI / prem@okaxis',
    aliases: ['gpay', 'okaxis'],
    type: 'UPI Wallet',
    ledgerCategory: 'wallet',
    balance: 5620.00,
    color: '#10B981',
    accentColor: '#047857',
    icon: 'flash-outline',
  },
  {
    id: 'acc_paytm',
    name: 'Paytm Wallet',
    number: 'Wallet Balance',
    aliases: ['paytm'],
    type: 'Digital Wallet',
    ledgerCategory: 'wallet',
    balance: 1200.00,
    color: '#06B6D4',
    accentColor: '#0E7490',
    icon: 'wallet-outline',
  },
  {
    id: 'acc_cash',
    name: 'Cash in Hand',
    number: 'Physical Cash',
    aliases: ['cash'],
    type: 'Cash',
    ledgerCategory: 'cash',
    balance: 3500.00,
    color: '#8B5CF6',
    accentColor: '#6D28D9',
    icon: 'cash-outline',
  },
  REMINDER_ACCOUNT,
];

export const CATEGORIES = [
  { id: 'cat_food', name: 'Food & Dining', icon: 'restaurant-outline', color: '#F43F5E', type: 'expense' },
  { id: 'cat_groceries', name: 'Groceries', icon: 'cart-outline', color: '#10B981', type: 'expense' },
  { id: 'cat_shopping', name: 'Shopping', icon: 'bag-handle-outline', color: '#EC4899', type: 'expense' },
  { id: 'cat_transport', name: 'Transport & Fuel', icon: 'car-outline', color: '#3B82F6', type: 'expense' },
  { id: 'cat_entertainment', name: 'Entertainment', icon: 'film-outline', color: '#8B5CF6', type: 'expense' },
  { id: 'cat_bills', name: 'Bills & Utilities', icon: 'receipt-outline', color: '#F59E0B', type: 'expense' },
  { id: 'cat_transfer', name: 'Account Transfer', icon: 'swap-horizontal-outline', color: '#06B6D4', type: 'transfer' },
  { id: 'cat_salary', name: 'Salary & Income', icon: 'cash-outline', color: '#22C55E', type: 'income' },
  { id: 'cat_investment', name: 'Interest & Gains', icon: 'trending-up-outline', color: '#6366F1', type: 'income' },
  { id: 'cat_adjustment', name: 'Balance Adjustment', icon: 'swap-horizontal-outline', color: '#64748B', type: 'adjustment' },
  { id: 'cat_reminder', name: 'Reminders & Alerts', icon: 'notifications-outline', color: '#F59E0B', type: 'reminder' },
  { id: 'cat_other', name: 'Other / General', icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8', type: 'expense' },
];

export const INITIAL_TRANSACTIONS = [
  {
    id: 'tx_seed_1',
    amount: 450.00,
    type: 'expense',
    accountId: 'acc_hdfc',
    categoryId: 'cat_food',
    counterparty: 'Zomato India',
    date: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hours ago
    note: 'Dinner Delivery',
    fingerprint: 'tx_seed_1_fp',
  },
  {
    id: 'tx_seed_2',
    amount: 3420.00,
    type: 'expense',
    accountId: 'acc_icici',
    categoryId: 'cat_groceries',
    counterparty: 'DMart Supercenter',
    date: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    note: 'Monthly essentials & groceries',
    fingerprint: 'tx_seed_2_fp',
  },
  {
    id: 'tx_seed_3',
    amount: 125000.00,
    type: 'income',
    accountId: 'acc_hdfc',
    categoryId: 'cat_salary',
    counterparty: 'TechCorp Solutions Pvt Ltd',
    date: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
    note: 'Monthly Salary Credit',
    fingerprint: 'tx_seed_3_fp',
  },
  {
    id: 'tx_seed_4',
    amount: 640.00,
    type: 'expense',
    accountId: 'acc_icici',
    categoryId: 'cat_food',
    counterparty: 'Starbucks Coffee',
    date: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    note: 'Cold brew & pastry',
    fingerprint: 'tx_seed_4_fp',
  },
  {
    id: 'tx_seed_5',
    amount: 500.00,
    type: 'expense',
    accountId: 'acc_gpay',
    categoryId: 'cat_transport',
    counterparty: 'Metro Rail Corp',
    date: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    note: 'Smart Card auto-topup',
    fingerprint: 'tx_seed_5_fp',
  },
  {
    id: 'tx_seed_6',
    amount: 482.00,
    type: 'income',
    accountId: 'acc_icici',
    categoryId: 'cat_investment',
    counterparty: 'ICICI Bank Savings Interest',
    date: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    note: 'Q3 Savings Interest Credit',
    fingerprint: 'tx_seed_6_fp',
  },
];

export const SAMPLE_SMS_BATCH = `Sent Rs.450.00 from HDFC Bank A/C **1234 to SWIGGY on 10-Nov-26 09:30:15 via UPI Ref 439281. Bal: Rs. 1,41,800.00.

Dear Customer, INR 1,850.00 debited from ICICI Bank A/C XX5678 on 10-Nov-2026 10:14:00 towards AMAZON RETAIL. Avail Bal: INR 82,650.00.

Sent Rs.450.00 from HDFC Bank A/C **1234 to SWIGGY on 10-Nov-26 09:31:02 via UPI Ref 439281. (Duplicate Alert sent within 47s)

Rs 85,000.00 credited to your HDFC Bank A/C **1234 on 09-Nov-2026 by TECH CORP INFOTECH SALARY. Avail Bal: Rs. 2,26,800.00.

Paid Rs.180.00 to Chai Point using Google Pay UPI on 10 Nov 2026 08:45 AM. UPI Ref: 9812401.

Axis/ICICI Alert: INR 1,850.00 spent at AMAZON RETAIL using Card XX5678 on 10-Nov-2026 10:14:45. (Multi-bank duplicate notification)`;

export const REAL_BANK_TEMPLATES = [
  {
    name: 'SBI UPI',
    sms: 'Dear UPI user A/C **5678 debited by 320.00 on date 10Nov26 trf to Blinkit Commerce Ref 4291823. Bal Rs 18,450.00',
  },
  {
    name: 'HDFC Sent',
    sms: 'Sent Rs.650.00 from HDFC Bank A/C **1234 to SWIGGY on 10-Nov-26 13:15:00 via UPI Ref 928371. Bal: Rs. 1,41,600.00',
  },
  {
    name: 'ICICI Card',
    sms: 'Dear Customer, INR 2,499.00 debited from ICICI Bank A/C XX5678 on 10-Nov-2026 14:20:00 towards ZARA RETAIL. Avail Bal: INR 79,900.00.',
  },
  {
    name: 'Salary Credit',
    sms: 'Rs 95,000.00 credited to your HDFC Bank A/C **1234 on 10-Nov-2026 by INFOSYS TECH SALARY. Avail Bal: Rs. 2,36,800.00.',
  },
];
