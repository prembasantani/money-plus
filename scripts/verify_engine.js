import { parseRawSmsBatch, parseSingleMessage, parseDeviceSmsList } from '../src/utils/parser.js';
import { runDeduplicationEngine, generateFingerprint } from '../src/utils/deduplication.js';
import { DEFAULT_ACCOUNTS, INITIAL_TRANSACTIONS, SAMPLE_SMS_BATCH } from '../src/types/finance.js';

console.log('=== MONEY+ ENGINE VERIFICATION TEST ===\n');

// 1. Test Parser with Sample SMS
console.log('--- 1. Testing SMS Batch Parser ---');
const parsed = parseRawSmsBatch(SAMPLE_SMS_BATCH, DEFAULT_ACCOUNTS);
console.log(`Parsed ${parsed.length} transactions from raw SMS batch.`);

if (parsed.length < 5) {
  console.error('❌ Failed: Expected at least 5 parsed transactions, got:', parsed.length);
  process.exit(1);
}

parsed.forEach((tx, idx) => {
  console.log(`  [#${idx + 1}] ${tx.type.toUpperCase()} ₹${tx.amount} | Account: ${tx.accountId} | Counterparty: ${tx.counterparty} | Date: ${tx.date}`);
});

// Verify no bogus balance transactions exist
const bogusBal = parsed.find((p) => p.amount === 82650 || p.amount === 141800);
if (bogusBal) {
  console.error('❌ Failed: Closing balance was mistakenly parsed as transaction amount!', bogusBal);
  process.exit(1);
} else {
  console.log('  ✅ Verified: Closing bank balances are properly excluded from transaction amounts.');
}

// 2. Test Deduplication Engine
console.log('\n--- 2. Testing 2-Minute Window Deduplication & Idempotency ---');
const evaluated = runDeduplicationEngine(parsed, INITIAL_TRANSACTIONS);

const ready = evaluated.filter((e) => e.status === 'ready');
const duplicates = evaluated.filter((e) => e.status === 'duplicate');
const existing = evaluated.filter((e) => e.status === 'existing');

console.log(`Total Evaluated: ${evaluated.length}`);
console.log(`  - Ready to Import: ${ready.length}`);
console.log(`  - Duplicates Discarded (within 2-min window): ${duplicates.length}`);
console.log(`  - Existing in Ledger: ${existing.length}`);

// Assertions
if (duplicates.length === 0) {
  console.error('❌ Failed: Deduplication engine did not catch the 2-minute duplicates!');
  process.exit(1);
}

if (ready.length === 0) {
  console.error('❌ Failed: Expected valid transactions to be marked ready!');
  process.exit(1);
}

// 3. Test SBI & tricky format amounts
console.log('\n--- 3. Testing Complex Bank Formats & Amount Isolation ---');
const sbiSms = 'Dear UPI user A/C **5678 debited by 320.00 on date 10Nov26 trf to Blinkit Commerce Ref 4291823. Bal Rs 18,450.00';
const parsedSbi = parseSingleMessage(sbiSms, DEFAULT_ACCOUNTS);

if (!parsedSbi || parsedSbi.amount !== 320) {
  console.error('❌ Failed: SBI amount parsed incorrectly! Expected 320, got:', parsedSbi?.amount);
  process.exit(1);
}
console.log(`  ✅ SBI parsed correctly: ₹${parsedSbi.amount} (ignored balance ₹18,450)`);

// 4. Test Automatic Account Creation from SMS
console.log('\n--- 4. Testing Automatic Account Detection & Discovery ---');
// Empty accounts array (e.g. after clearing test data)
const unknownBankSms = 'Sent Rs.950.00 from Axis Bank A/C **9876 to ZOMATO on 10-Nov-26 via UPI. Bal: Rs. 14,000.00';
const parsedUnknown = parseSingleMessage(unknownBankSms, []);

if (!parsedUnknown.discoveredAccount) {
  console.error('❌ Failed: Discovered account was not created for unknown bank SMS!');
  process.exit(1);
}
console.log(`  ✅ Auto-discovered new account: "${parsedUnknown.discoveredAccount.name}" (ID: ${parsedUnknown.discoveredAccount.id}, Number: ${parsedUnknown.discoveredAccount.number})`);

// 5. Test Non-truncation of descriptions
console.log('\n--- 5. Testing Description Integrity (No 1-line truncation) ---');
const longSms = 'Sent Rs.1250.00 from HDFC Bank A/C **1234 to Reliance Fresh Supermarket on 10-Nov-26 18:30:15 via UPI Ref 928371891283912. Available Balance: Rs. 45,200.00. Thank you for banking with HDFC.';
const parsedLong = parseSingleMessage(longSms, DEFAULT_ACCOUNTS);

if (!parsedLong.note || parsedLong.note.length < 100) {
  console.error('❌ Failed: Description was truncated! Note length:', parsedLong.note?.length);
  process.exit(1);
}
console.log(`  ✅ Description preserved in full (${parsedLong.note.length} chars, not truncated): "${parsedLong.note.substring(0, 60)}..."`);

// 6. Test RBL Bank Credit Card (Parentheses account number) & Auto-Detection
console.log('\n--- 6. Testing RBL Bank Credit Card & Parentheses Account Pattern ---');
const rblSms = 'INR869.00 spent at AMAZON SELLER SERVICES on RBL Bank credit card (4723) on 10-11-2026.AVL limit-INR55,260.26. Not you? Call 02262327777';
const parsedRbl = parseSingleMessage(rblSms, []);

if (!parsedRbl) {
  console.error('❌ Failed: RBL SMS failed to parse!');
  process.exit(1);
}
if (parsedRbl.amount !== 869) {
  console.error('❌ Failed: RBL amount parsed incorrectly! Expected 869, got:', parsedRbl.amount);
  process.exit(1);
}
if (!parsedRbl.discoveredAccount || !parsedRbl.discoveredAccount.name.includes('RBL Bank')) {
  console.error('❌ Failed: Discovered account did not recognize RBL Bank!', parsedRbl.discoveredAccount);
  process.exit(1);
}
if (parsedRbl.discoveredAccount.ledgerCategory !== 'credit' || !parsedRbl.discoveredAccount.type.includes('Credit Card')) {
  console.error('❌ Failed: Discovered account was not categorized as credit card!', parsedRbl.discoveredAccount);
  process.exit(1);
}
console.log(`  ✅ RBL Bank Credit Card successfully auto-discovered: "${parsedRbl.discoveredAccount.name}" (Type: ${parsedRbl.discoveredAccount.type}, Ledger: ${parsedRbl.discoveredAccount.ledgerCategory}, Number: ${parsedRbl.discoveredAccount.number})`);

// 7. Test Statement / Bill Due Alerts (Ignored / Non-Transactions)
console.log('\n--- 7. Testing Statement / Due Bill Filter ---');
const statementSms = 'ICICI Bank Credit Card XX6001 Statement is sent to pr************03@gmail.com. Total of Rs 94,216.31 or minimum of Rs 5,310.00 is due by 20-NOV-26.';
const parsedStatement = parseSingleMessage(statementSms, []);

if (parsedStatement !== null) {
  console.error('❌ Failed: Statement alert was incorrectly parsed as transaction!', parsedStatement);
  process.exit(1);
}
console.log('  ✅ Verified: Credit card statement / bill due alerts are properly ignored.');

// 8. Test Blacklist / Dismissed Item Persistence
console.log('\n--- 8. Testing Blacklist / Dismiss Engine ---');
const testFingerprint = generateFingerprint(parsedRbl);
const blacklistedSet = [testFingerprint];

// Re-parse with blacklist
const parsedWithBlacklist = parseSingleMessage(rblSms, [], { blacklistedFingerprints: blacklistedSet });
if (parsedWithBlacklist !== null) {
  console.error('❌ Failed: Blacklisted message was parsed instead of ignored!', parsedWithBlacklist);
  process.exit(1);
}

// Deduplication filter with blacklist
const dedupeWithBlacklist = runDeduplicationEngine([parsedRbl], [], blacklistedSet);
if (dedupeWithBlacklist.length !== 0) {
  console.error('❌ Failed: Blacklisted transaction was not excluded by deduplication engine!', dedupeWithBlacklist);
  process.exit(1);
}
console.log('  ✅ Verified: Blacklisted / dismissed transactions are permanently ignored across sync cycles.');

// 9. Test Debited vs Credited: ICICI UPI Debit with Merchant Credited
console.log('\n--- 9. Testing Debited vs Credited Distinction (ICICI Blinkit & Kotak Youtube) ---');
const iciciBlinkitSms = 'ICICI Bank Acct XX417 debited for Rs 391.00 on 08-Nov-26; BLINKIT credited. UPI:631222798279. Call 18002662 for dispute. SMS BLOCK 417 to 9215676766.';
const parsedIcici = parseSingleMessage(iciciBlinkitSms, []);

if (!parsedIcici) {
  console.error('❌ Failed: ICICI SMS failed to parse!');
  process.exit(1);
}
if (parsedIcici.type !== 'expense') {
  console.error('❌ Failed: ICICI debited SMS was mistakenly categorized as:', parsedIcici.type);
  process.exit(1);
}
if (parsedIcici.amount !== 391) {
  console.error('❌ Failed: ICICI amount expected 391, got:', parsedIcici.amount);
  process.exit(1);
}
if (parsedIcici.counterparty !== 'BLINKIT') {
  console.error('❌ Failed: Expected counterparty BLINKIT, got:', parsedIcici.counterparty);
  process.exit(1);
}
if (parsedIcici.categoryId !== 'cat_groceries') {
  console.error('❌ Failed: Expected category cat_groceries, got:', parsedIcici.categoryId);
  process.exit(1);
}
console.log(`  ✅ ICICI debited transaction correctly parsed as EXPENSE: ₹${parsedIcici.amount} to ${parsedIcici.counterparty} (${parsedIcici.categoryId})`);

// Kotak Youtube
const kotakSms = 'Sent Rs.2.00 from Kotak Bank A/c X6574 to Youtube on 08-11-26. UPI Ref 631245646317. Not done by you? Tap https://kotak.bank.in/KBANKT/Fraud';
const parsedKotak = parseSingleMessage(kotakSms, []);

if (!parsedKotak || parsedKotak.type !== 'expense' || parsedKotak.counterparty !== 'Youtube' || parsedKotak.categoryId !== 'cat_entertainment') {
  console.error('❌ Failed: Kotak SMS parsed incorrectly!', parsedKotak);
  process.exit(1);
}
console.log(`  ✅ Kotak transaction correctly parsed as EXPENSE: ₹${parsedKotak.amount} to ${parsedKotak.counterparty} (${parsedKotak.categoryId})`);

// 10. Test Credit Card Bill Payment Alert (Payment received on Credit Card = CREDIT / INCOME +)
console.log('\n--- 10. Testing Credit Card Bill Payment Alert ---');
const sbiPaymentSms = 'We have received payment of Rs.2,023.80 via BBPS & the same has been credited to your SBI Credit Card. Your available limit is Rs.20,965.44.';
const parsedSbiPayment = parseSingleMessage(sbiPaymentSms, []);

if (!parsedSbiPayment) {
  console.error('❌ Failed: SBI bill payment failed to parse!');
  process.exit(1);
}
if (parsedSbiPayment.type !== 'income') {
  console.error('❌ Failed: SBI bill payment was not classified as CREDIT/INCOME! Got:', parsedSbiPayment.type);
  process.exit(1);
}
if (parsedSbiPayment.amount !== 2023.80) {
  console.error('❌ Failed: SBI bill payment amount expected 2023.80, got:', parsedSbiPayment.amount);
  process.exit(1);
}
if (parsedSbiPayment.categoryId !== 'cat_transfer') {
  console.error('❌ Failed: Expected cat_transfer, got:', parsedSbiPayment.categoryId);
  process.exit(1);
}
console.log(`  ✅ SBI bill payment correctly recognized as CREDIT (+): ₹${parsedSbiPayment.amount} on Credit Card ledger (${parsedSbiPayment.categoryId})`);

// 11. Test UPI Debit Certainty (Does NOT get falsely flagged as Uncertain)
console.log('\n--- 11. Testing UPI Debit Certainty ---');
if (parsedIcici.isUncertain) {
  console.error('❌ Failed: Regular UPI debit was falsely flagged as isUncertain!');
  process.exit(1);
}
console.log(`  ✅ Regular UPI debit is 100% CERTAIN (isUncertain = false)`);

// 12. Test Inter-Ledger Transfer Pairing
console.log('\n--- 12. Testing Inter-Ledger Transfer Auto-Pairing ---');
const bankDebitTx = {
  id: 'tx_bank_debit_18k',
  amount: 18000,
  type: 'expense',
  accountId: 'acc_icici',
  accountName: 'ICICI Bank (**417)',
  counterparty: 'SBI Card BBPS',
  date: '2026-11-06T08:28:00.000Z',
  categoryId: 'cat_transfer',
};

const cardCreditTx = {
  id: 'tx_card_credit_18k',
  amount: 18000,
  type: 'income',
  accountId: 'acc_sbi_card',
  accountName: 'SBI Credit Card',
  counterparty: 'Card Bill Payment via BBPS',
  date: '2026-11-06T08:28:30.000Z',
  categoryId: 'cat_transfer',
};

const pairedResult = runDeduplicationEngine([bankDebitTx, cardCreditTx], []);
if (!pairedResult[0].transferPairId || !pairedResult[1].transferPairId) {
  console.error('❌ Failed: Transfer transactions were not paired together!', pairedResult);
  process.exit(1);
}
console.log(`  ✅ Successfully paired inter-ledger transfer: ${pairedResult[0].accountName} (-₹18,000) ➔ ${pairedResult[1].accountName} (+₹18,000)`);

// 13. Test Account Aliases & Clubbing Resolution
console.log('\n--- 13. Testing Account Aliases & Clubbing Resolution ---');
const existingMergedAccount = {
  id: 'acc_sbi_master',
  name: 'State Bank of India (**8417)',
  number: '**8417',
  aliases: ['417', '8417'],
  type: 'Bank Account',
  ledgerCategory: 'debit',
  balance: 50000,
};

const shortAccSms = 'A/c XX417 debited by Rs 500.00 on 09-Nov-26. Info: Swiggy. Bal: Rs 49,500.00';
const parsedWithAlias = parseSingleMessage(shortAccSms, [existingMergedAccount]);

if (parsedWithAlias.accountId !== 'acc_sbi_master') {
  console.error('❌ Failed: SMS with 3-digit XX417 did not resolve to account with alias 417! Got accountId:', parsedWithAlias.accountId);
  process.exit(1);
}
if (parsedWithAlias.discoveredAccount) {
  console.error('❌ Failed: Discovered redundant account instead of resolving to existing aliased account!');
  process.exit(1);
}
console.log(`  ✅ Successfully resolved XX417 to master account "${existingMergedAccount.name}" using aliases.`);

// 14. Test Credit Card Bracket Number
console.log('\n--- 14. Testing Credit Card Bracket Number Formatting ---');
const cardSmsWithNum = 'Payment of Rs. 1500.00 received for SBI Credit Card ending with 2380 on 08-Nov-26.';
const parsedCard = parseSingleMessage(cardSmsWithNum, []);
if (!parsedCard.discoveredAccount || !parsedCard.discoveredAccount.name.includes('(**2380)')) {
  console.error('❌ Failed: Discovered credit card name does not include (**2380)! Got:', parsedCard.discoveredAccount?.name);
  process.exit(1);
}
console.log(`  ✅ Credit card discovered with bracket number: "${parsedCard.discoveredAccount.name}"`);

// 15. Test Loan Application & Request Filter
console.log('\n--- 15. Testing Loan Application & Offer Filter ---');
const loanSms = 'Dear Customer, FlexiLoans: Your loan request of Rs.19,79,000 has been received. Check application status: https://klr.bz/FLLOAN/krRzbc/13TdpB';
const parsedLoan = parseSingleMessage(loanSms, []);
if (parsedLoan !== null) {
  console.error('❌ Failed: Loan request was incorrectly parsed as a transaction!', parsedLoan);
  process.exit(1);
}
console.log('  ✅ Verified: FlexiLoans loan application (₹19,79,000) was correctly blocked as non-transaction.');

// 16. Test Promotional Ads, Coupons & Checkout Discounts Filter
console.log('\n--- 16. Testing Promotional Ads, Coupons & Checkout Discounts Filter ---');
const couponSms = 'Rs.2000 off* coupon credited in Tira account! Plus extra 5% off at checkout...';
const parsedCoupon = parseSingleMessage(couponSms, []);
if (parsedCoupon !== null) {
  console.error('❌ Failed: Promotional discount coupon was incorrectly parsed as a transaction!', parsedCoupon);
  process.exit(1);
}
console.log('  ✅ Verified: Tira promo coupon (₹2000 off) was correctly blocked as non-transaction.');

// 17. Test Digital Wallet Recognition & Naming
console.log('\n--- 17. Testing Digital Wallet Recognition & Naming ---');
const walletSms = 'Paid Rs. 150.00 from Paytm Wallet to Coffee Shop on 10-Nov-26 via Wallet.';
const parsedWallet = parseSingleMessage(walletSms, []);
if (!parsedWallet) {
  console.error('❌ Failed: Paytm Wallet SMS failed to parse!');
  process.exit(1);
}
if (parsedWallet.discoveredAccount?.ledgerCategory !== 'wallet' || !parsedWallet.discoveredAccount?.name.includes('Wallet')) {
  console.error('❌ Failed: Digital Wallet was not named as Wallet! Got:', parsedWallet.discoveredAccount);
  process.exit(1);
}
if (parsedWallet.discoveredAccount?.name.includes('Bank Account')) {
  console.error('❌ Failed: Digital Wallet was incorrectly named Bank Account!');
  process.exit(1);
}
console.log(`  ✅ Digital Wallet correctly auto-identified: "${parsedWallet.discoveredAccount.name}" (Ledger: ${parsedWallet.discoveredAccount.ledgerCategory})`);

// 18. Test Silent Omission of Existing Ledger Items from Sync Preview
console.log('\n--- 18. Testing Silent Omission of Existing Ledger Items ---');
const existingLedgerItem = {
  id: 'tx_existing_in_db',
  amount: 450,
  type: 'expense',
  accountId: 'acc_hdfc',
  counterparty: 'SWIGGY',
  date: '2026-11-10T05:00:00.000Z',
  fingerprint: '2026-11-10T05:00_450.00_acc_hdfc_swiggy',
};

const candidateExisting = {
  id: 'tx_candidate_new_scan',
  amount: 450,
  type: 'expense',
  accountId: 'acc_hdfc',
  counterparty: 'SWIGGY',
  date: '2026-11-10T05:00:00.000Z',
  fingerprint: '2026-11-10T05:00_450.00_acc_hdfc_swiggy',
};

const candidateTrulyNew = {
  id: 'tx_candidate_truly_new',
  amount: 890,
  type: 'expense',
  accountId: 'acc_hdfc',
  counterparty: 'ZOMATO',
  date: '2026-11-10T05:05:00.000Z',
  fingerprint: '2026-11-10T05:05_890.00_acc_hdfc_zomato',
};

const dedupedResults = runDeduplicationEngine([candidateExisting, candidateTrulyNew], [existingLedgerItem]);
if (dedupedResults.some((r) => r.fingerprint === candidateExisting.fingerprint)) {
  console.error('❌ Failed: Already-imported existing transaction appeared in sync results!', dedupedResults);
  process.exit(1);
}
if (dedupedResults.length !== 1 || dedupedResults[0].fingerprint !== candidateTrulyNew.fingerprint) {
  console.error('❌ Failed: Expected exactly 1 new transaction in sync preview, got:', dedupedResults);
  process.exit(1);
}
console.log(`  ✅ Verified: Existing ledger transaction was silently omitted from sync preview. Only 1 truly new transaction returned.`);

// --- 19. Testing Spam / Fake Salary / WhatsApp Scam Filter ---
console.log('--- 19. Testing Spam / Fake Salary / WhatsApp Scam Filter ---');
const spamJobSms = 'PatName Dear, Appoitment for Salary Rs35800 is scheduled for you, Simple Working in spare time at api.whatsapp.com/send?phone=447346731822 From DRTOPRANI LABS';
const parsedSpam = parseSingleMessage(spamJobSms, DEFAULT_ACCOUNTS);
if (parsedSpam !== null) {
  console.error('❌ Failed: Spam WhatsApp / fake appointment salary pitch must be blocked as non-transaction, got:', parsedSpam);
  process.exit(1);
}
console.log('  ✅ Verified: Spam fake salary message with WhatsApp link properly blocked.');

// --- 20. Testing Informational Refund Reference Ticket Filter ---
console.log('--- 20. Testing Informational Refund Reference Ticket Filter ---');
const refundNoticeSms = 'Dear Swiggy customer, your refund reference number for Rs 8 is 200033868544. https://r.swiggy.com/ref...';
const parsedRefundNotice = parseSingleMessage(refundNoticeSms, DEFAULT_ACCOUNTS);
if (parsedRefundNotice !== null) {
  console.error('❌ Failed: Informational Swiggy refund reference ticket must NOT be parsed as bank credit, got:', parsedRefundNotice);
  process.exit(1);
}
console.log('  ✅ Verified: Informational refund reference ticket correctly blocked.');

// --- 21. Testing Single x Account Number Resolution (x1074 vs UPI payee RBL Bank) ---
console.log('--- 21. Testing Single x Account Number Resolution (x1074) ---');
const accountsWith1074 = [
  ...DEFAULT_ACCOUNTS,
  {
    id: 'acc_sbi_1074',
    name: 'State Bank of India',
    number: '**1074',
    aliases: ['1074'],
    type: 'Bank Account',
    ledgerCategory: 'debit',
    balance: 5000,
  },
];
const rblUpiSms = 'Rs. 4560.23 Sent from x1074 on 16-Oct-2026 Info: UPI/DR/665540980995/RBL Bank C Not you? Call 18008907070 - JPBL';
const parsedRblUpi = parseSingleMessage(rblUpiSms, accountsWith1074);
if (!parsedRblUpi) {
  console.error('❌ Failed: Transaction must parse successfully');
  process.exit(1);
}
if (parsedRblUpi.amount !== 4560.23) {
  console.error(`❌ Failed: Amount must be 4560.23, got ${parsedRblUpi.amount}`);
  process.exit(1);
}
if (parsedRblUpi.accountId !== 'acc_sbi_1074') {
  console.error(`❌ Failed: Account must resolve to existing **1074 account, got ${parsedRblUpi.accountId} (${parsedRblUpi.accountName})`);
  process.exit(1);
}
if (parsedRblUpi.accountNumber === '**4560') {
  console.error('❌ Failed: Account digits must NOT be 4560 from amount');
  process.exit(1);
}
console.log('  ✅ Verified: x1074 resolved to master account **1074 (not hijacked by payee RBL Bank or amount 4560).');

console.log('\n✅ All Parser, Auto-Account Creation, Transfer Pairing, Loan/Ad Filtering & Deduplication Unit Tests Passed Successfully!\n');
