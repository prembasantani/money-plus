export const REMINDER_ACCOUNT = {
  id: 'acc_reminders',
  name: 'Reminders & Mandates',
  number: 'Advisory / Mandates',
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
    id: 'acc_cash',
    name: 'Cash in Hand',
    number: 'Physical Cash',
    aliases: ['cash'],
    type: 'Cash',
    ledgerCategory: 'cash',
    balance: 0.00,
    color: '#10B981',
    accentColor: '#059669',
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

export const INITIAL_TRANSACTIONS = [];

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
