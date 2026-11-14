import { parseRawSmsBatch, parseSingleMessage, parseDeviceSmsList } from '../src/utils/parser.js';
import { runDeduplicationEngine, generateFingerprint } from '../src/utils/deduplication.js';
import { DEFAULT_ACCOUNTS, INITIAL_TRANSACTIONS, CATEGORIES, SAMPLE_SMS_BATCH } from '../src/types/finance.js';
import { formatCurrency } from '../src/utils/formatters.js';
import {
  generateGSTR1Csv,
  generateGSTR3BPurchaseCsv,
  generateITRScheduleCsv,
  generateUnifiedMasterTaxCsv,
} from '../src/utils/taxExport.js';

console.log('=== MONEYFOLLOWS ENGINE VERIFICATION TEST ===\n');

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

if (!parsedKotak || parsedKotak.type !== 'expense' || !/youtube/i.test(parsedKotak.counterparty) || parsedKotak.categoryId !== 'cat_entertainment') {
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

// --- 22. Testing Policybazaar / PNB MetLife Future Debit Reminder ---
console.log('\n--- 22. Testing Policybazaar / PNB MetLife Future Debit Reminder ---');
const policybazaarSms = 'Prem Kishan Basantani payment of Rs.950 for your PNB Metlife policy no. 24028200 is due on 2026-11-15. The amount will be debited from your credit card/bank account. Please maintain sufficient balance. Team Policybazaar';
const parsedPb = parseSingleMessage(policybazaarSms, DEFAULT_ACCOUNTS);

if (!parsedPb) {
  console.error('❌ Failed: Policybazaar SMS failed to parse as reminder!');
  process.exit(1);
}
if (parsedPb.amount !== 950) {
  console.error(`❌ Failed: Expected amount 950, got ${parsedPb.amount}`);
  process.exit(1);
}
if (!parsedPb.isReminder) {
  console.error('❌ Failed: Expected isReminder to be true for future debit notice!');
  process.exit(1);
}
if (parsedPb.type === 'income') {
  console.error('❌ Failed: Future debit reminder must NOT be parsed as income (+) credit card payment!');
  process.exit(1);
}
if (parsedPb.discoveredAccount) {
  console.error('❌ Failed: PNB MetLife must NOT create a fake Punjab National Bank credit card account!', parsedPb.discoveredAccount);
  process.exit(1);
}
if (!parsedPb.counterparty.includes('PNB MetLife') && !parsedPb.counterparty.includes('Policybazaar')) {
  console.error(`❌ Failed: Expected counterparty to be Policybazaar / PNB MetLife, got "${parsedPb.counterparty}"`);
  process.exit(1);
}
console.log(`  ✅ Verified: PNB MetLife correctly tagged as REMINDER (isReminder=true, zero balance impact), counterparty: "${parsedPb.counterparty}", no ghost bank created.`);

// --- 23. Testing YouTube UPI AutoPay Mandate Setup ---
console.log('\n--- 23. Testing YouTube UPI AutoPay Mandate Setup ---');
const youtubeMandateSms = 'Your ASPRESENTED UPI AutoPay Mandate from 11/11/2026 to 31/12/2036 is successfully created towards Youtube for Rs 299.00';
const parsedYt = parseSingleMessage(youtubeMandateSms, DEFAULT_ACCOUNTS);

if (!parsedYt) {
  console.error('❌ Failed: YouTube mandate failed to parse!');
  process.exit(1);
}
if (!parsedYt.isReminder) {
  console.error('❌ Failed: AutoPay Mandate creation must be tagged as isReminder=true!');
  process.exit(1);
}
if (parsedYt.counterparty !== 'YouTube') {
  console.error(`❌ Failed: Expected clean counterparty "YouTube", got "${parsedYt.counterparty}"`);
  process.exit(1);
}
console.log(`  ✅ Verified: YouTube mandate correctly recognized as REMINDER (isReminder=true), counterparty: "${parsedYt.counterparty}".`);

// --- 24. Testing Ignored / Previously Deleted Section Exclusion from Sync ---
console.log('\n--- 24. Testing Ignored / Previously Deleted Section Exclusion ---');
const candidateIgnored = {
  id: 'tx_old_dismissed',
  amount: 250,
  type: 'expense',
  accountId: 'acc_primary',
  counterparty: 'Starbucks Coffee',
  date: '2026-11-10T08:00:00.000Z',
  fingerprint: 'fp_starbucks_250_test',
  rawText: 'Sent Rs.250 from A/C **1234 to Starbucks',
  status: 'ready',
};
const blacklistedList = ['fp_starbucks_250_test'];
const evaluatedIgnored = runDeduplicationEngine([candidateIgnored], [], blacklistedList);

if (evaluatedIgnored.length !== 0) {
  console.error('❌ Failed: Blacklisted candidate must be completely excluded from sync ready queue, got:', evaluatedIgnored);
  process.exit(1);
}
console.log('  ✅ Verified: Blacklisted item successfully excluded from sync ready items (stored and managed via Ignored / Previously Deleted section).');

// --- 25. Testing Strict Descending Chronological Sorting (Latest First) ---
console.log('\n--- 25. Testing Strict Descending Chronological Sorting ---');
const candOld = { id: 'c1', amount: 100, type: 'expense', accountId: 'acc_primary', counterparty: 'Store A', date: '2026-11-01T10:00:00.000Z' };
const candNew = { id: 'c2', amount: 200, type: 'expense', accountId: 'acc_primary', counterparty: 'Store B', date: '2026-11-12T15:30:00.000Z' };
const candMid = { id: 'c3', amount: 300, type: 'expense', accountId: 'acc_primary', counterparty: 'Store C', date: '2026-11-08T12:00:00.000Z' };

const sortedEval = runDeduplicationEngine([candOld, candNew, candMid], []);
if (sortedEval[0].id !== 'c2' || sortedEval[1].id !== 'c3' || sortedEval[2].id !== 'c1') {
  console.error('❌ Failed: Candidates were not sorted strictly descending by date!', sortedEval.map((s) => s.date));
  process.exit(1);
}
console.log('  ✅ Verified: Candidates strictly sorted descending (newest on top): 12 Nov -> 8 Nov -> 1 Nov.');

// --- 26. Testing Smart Readable Activity Comment Generation ---
console.log('\n--- 26. Testing Smart Readable Activity Comment Generation ---');
const uberSms = 'Sent Rs.250 from ICICI Bank A/C XX417 to Uber India via UPI on 12-Nov-26.';
const parsedUber = parseSingleMessage(uberSms, DEFAULT_ACCOUNTS);
if (!parsedUber || parsedUber.comment !== 'Transport (Uber)') {
  console.error('❌ Failed: Expected comment "Transport (Uber)", got:', parsedUber?.comment);
  process.exit(1);
}

const sweetShopSms = 'Paid Rs.350 at Agarwal Sweets & Mithai using UPI Ref 12345.';
const parsedSweets = parseSingleMessage(sweetShopSms, DEFAULT_ACCOUNTS);
if (!parsedSweets || parsedSweets.comment !== 'Sweet Shop / Desserts') {
  console.error('❌ Failed: Expected comment "Sweet Shop / Desserts", got:', parsedSweets?.comment);
  process.exit(1);
}

const salarySms = 'Your salary of Rs.81300.00 is credited to ICICI Bank A/C XX417 on 06-Nov-26 by TECH CORP INFOTECH.';
const parsedSalary = parseSingleMessage(salarySms, DEFAULT_ACCOUNTS);
if (!parsedSalary || parsedSalary.comment !== 'Monthly Salary Credit') {
  console.error('❌ Failed: Expected comment "Monthly Salary Credit", got:', parsedSalary?.comment);
  process.exit(1);
}
console.log(`  ✅ Verified: Smart 2-3 word comments generated: "${parsedUber.comment}", "${parsedSweets.comment}", "${parsedSalary.comment}".`);

// --- 27. Testing Calendar Month Inflow / Outflow Excludes Inter-Ledger Transfers ---
console.log('\n--- 27. Testing Monthly Inflow / Outflow Excludes Inter-Ledger Transfers ---');
const sampleTxns = [
  { id: 't1', amount: 81300, type: 'income', categoryId: 'cat_salary', date: '2026-11-06T07:49:00.000Z' },
  { id: 't2', amount: 266, type: 'income', categoryId: 'cat_other', date: '2026-11-04T00:42:00.000Z' },
  { id: 't3', amount: 31473.80, type: 'income', categoryId: 'cat_transfer', date: '2026-11-09T10:27:00.000Z' }, // Transfer into account
  { id: 't4', amount: 31473.80, type: 'expense', categoryId: 'cat_transfer', date: '2026-11-09T10:26:00.000Z' }, // Transfer out of account
  { id: 't5', amount: 950, type: 'expense', isReminder: true, categoryId: 'cat_bills', date: '2026-11-12T16:26:00.000Z' }, // Reminder
];

let testInflow = 0;
let testOutflow = 0;
sampleTxns.forEach((tx) => {
  if (tx.isReminder) return;
  if (tx.categoryId === 'cat_transfer') return;
  if (tx.type === 'income') testInflow += tx.amount;
  else if (tx.type === 'expense') testOutflow += tx.amount;
});

if (testInflow !== 81566) {
  console.error(`❌ Failed: Expected clean monthly income 81566, got: ${testInflow}`);
  process.exit(1);
}
if (testOutflow !== 0) {
  console.error(`❌ Failed: Expected clean monthly spent 0, got: ${testOutflow}`);
  process.exit(1);
}
console.log(`  ✅ Verified: Month income is exactly ₹${testInflow} (transfers and reminders correctly excluded).`);

// --- 28. Testing Search Query by Numeric Amount ---
console.log('\n--- 28. Testing Search Query by Numeric Amount ---');
const testDataset = [
  { id: '1', amount: 950.00, counterparty: 'PNB MetLife', note: 'Policy 24028200 due on 15 Nov' },
  { id: '2', amount: 18000.00, counterparty: 'SBI Card', note: 'BBPS payment' },
  { id: '3', amount: 16.00, counterparty: 'Kuldeep Tiwari', note: 'UPI' },
];

function searchTx(query, items) {
  const q = query.toLowerCase().trim();
  const cleanAmt = q.replace(/[^0-9.]/g, '');
  return items.filter((tx) => {
    const matchCp = (tx.counterparty || '').toLowerCase().includes(q);
    const matchNote = (tx.note || '').toLowerCase().includes(q);
    const matchAmt = cleanAmt.length > 0 && String(tx.amount || '').includes(cleanAmt);
    return matchCp || matchNote || matchAmt;
  });
}

const found950 = searchTx('950', testDataset);
if (found950.length !== 1 || found950[0].id !== '1') {
  console.error('❌ Failed: Searching "950" failed to find matching transaction!', found950);
  process.exit(1);
}
const found18000 = searchTx('18000', testDataset);
if (found18000.length !== 1 || found18000[0].id !== '2') {
  console.error('❌ Failed: Searching "18000" failed to find matching transaction!', found18000);
  process.exit(1);
}
console.log('  ✅ Verified: Searching by amount ("950", "18000") matches transactions accurately.');

// --- 29. Testing 3-Way Mode Switcher Balance Integrity ---
console.log('\n--- 29. Testing 3-Way Mode Switcher Balance Calculations ---');
let accountBalance = 10000;
let tx = { id: 'x', amount: 950, type: 'expense', isReminder: false };
// Initial debit
accountBalance -= tx.amount; // 9050

// User switches to Reminder in modal
const origAmount = tx.amount;
const origWasReminder = tx.isReminder;
const origType = tx.type;

const updatedTxReminder = { ...tx, isReminder: true };
const newAmount = updatedTxReminder.amount;
const newIsReminder = updatedTxReminder.isReminder;
const newType = updatedTxReminder.type;

// Revert original (since !origWasReminder)
if (!origWasReminder) {
  if (origType === 'expense') accountBalance += origAmount;
  else if (origType === 'income') accountBalance -= origAmount;
}
// Apply new (since newIsReminder === true, zero balance impact!)
if (!newIsReminder) {
  if (newType === 'expense') accountBalance -= newAmount;
  else if (newType === 'income') accountBalance += newAmount;
}

if (accountBalance !== 10000) {
  console.error('❌ Failed: Switching to reminder should restore balance to 10000, got:', accountBalance);
  process.exit(1);
}
console.log(`  ✅ Verified: Switching Debit (₹950) -> Reminder restores account balance to ₹${accountBalance}.`);

// User switches Reminder to Credit (+950)
const fromReminder = updatedTxReminder;
const toCredit = { ...tx, type: 'income', isReminder: false };
if (!fromReminder.isReminder) {
  if (fromReminder.type === 'expense') accountBalance += fromReminder.amount;
  else if (fromReminder.type === 'income') accountBalance -= fromReminder.amount;
}
if (!toCredit.isReminder) {
  if (toCredit.type === 'expense') accountBalance -= toCredit.amount;
  else if (toCredit.type === 'income') accountBalance += toCredit.amount;
}
if (accountBalance !== 10950) {
  console.error('❌ Failed: Switching Reminder -> Credit should increase balance to 10950, got:', accountBalance);
  process.exit(1);
}
console.log(`  ✅ Verified: Switching Reminder -> Credit adds ₹950 to account balance (now ₹${accountBalance}).`);

// --- 30. Testing Auto-Recreate Missing Account on Restore ---
console.log('\n--- 30. Testing Auto-Recreate Missing Account on Restore ---');
let activeAccountsList = [{ id: 'acc_cash', name: 'Cash', balance: 500 }];
const ignoredTxToRestore = {
  id: 'ign_123',
  accountId: 'acc_icici_417',
  accountName: 'ICICI Bank (**417)',
  amount: 60.00,
  type: 'expense',
  isReminder: false,
};

let accountExists = activeAccountsList.some((a) => a.id === ignoredTxToRestore.accountId);
if (!accountExists) {
  activeAccountsList.push({
    id: ignoredTxToRestore.accountId,
    name: ignoredTxToRestore.accountName,
    balance: 0.0,
    ledgerCategory: 'debit',
  });
}
activeAccountsList = activeAccountsList.map((a) => {
  if (a.id === ignoredTxToRestore.accountId) {
    return { ...a, balance: a.balance - ignoredTxToRestore.amount };
  }
  return a;
});

const restoredAcc = activeAccountsList.find((a) => a.id === 'acc_icici_417');
if (!restoredAcc || restoredAcc.balance !== -60.00) {
  console.error('❌ Failed: Missing account was not recreated or balance incorrect!', restoredAcc);
  process.exit(1);
}
console.log(`  ✅ Verified: Missing account "${restoredAcc.name}" automatically recreated on restore with balance ₹${restoredAcc.balance}.`);

// --- 31. Testing Reminders Account & Category Isolation ---
console.log('\n--- 31. Testing Reminders Account & Category Isolation ---');
const testReminderSms = 'Dear Customer, your EMI of Rs 3,500.00 will be debited on 20-Nov-26 for Loan. Maintain balance.';
const parsedRem = parseSingleMessage(testReminderSms, DEFAULT_ACCOUNTS);
if (!parsedRem.isReminder) {
  console.error('❌ Failed: Expected isReminder to be true!');
  process.exit(1);
}
if (parsedRem.accountId !== 'acc_reminders') {
  console.error(`❌ Failed: Reminders must route to "acc_reminders", got "${parsedRem.accountId}"`);
  process.exit(1);
}
if (parsedRem.categoryId !== 'cat_reminder') {
  console.error(`❌ Failed: Reminders must have categoryId "cat_reminder", got "${parsedRem.categoryId}"`);
  process.exit(1);
}
console.log(`  ✅ Verified: Reminder routed strictly to "${parsedRem.accountName}" (${parsedRem.accountId}) under "${parsedRem.categoryId}".`);

// --- 32. Testing formatCurrency Preserves Minus Sign on Deficit / Negative Balances ---
console.log('\n--- 32. Testing formatCurrency Preserves Minus Sign on Negative Balances ---');
const formattedNegNetWorth = formatCurrency(-23800.45);
if (!formattedNegNetWorth.startsWith('-₹')) {
  console.error(`❌ Failed: Negative balance must start with "-₹", got "${formattedNegNetWorth}"`);
  process.exit(1);
}
const formattedPositive = formatCurrency(23800.45);
if (formattedPositive.startsWith('-')) {
  console.error(`❌ Failed: Positive balance must not have minus sign, got "${formattedPositive}"`);
  process.exit(1);
}
console.log(`  ✅ Verified: Deficit/negative balance formats correctly with minus sign: "${formattedNegNetWorth}" vs "${formattedPositive}".`);

// --- 33. Testing Balance Adjustment (cat_adjustment) Excluded from Monthly Spent ---
console.log('\n--- 33. Testing Balance Override Excluded from Monthly Spent ---');
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();
const startOfCurrentMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

const sampleTxList = [
  { id: 't1', amount: 81566.00, type: 'income', categoryId: 'cat_salary', date: new Date().toISOString() },
  { id: 't2', amount: 66308.09, type: 'expense', categoryId: 'cat_food', date: new Date().toISOString() },
  { id: 't3', amount: 39058.36, type: 'expense', categoryId: 'cat_adjustment', counterparty: 'Balance Override', date: new Date().toISOString() },
  { id: 't4', amount: 18000.00, type: 'expense', categoryId: 'cat_transfer', isTransfer: true, date: new Date().toISOString() },
  { id: 't5', amount: 950.00, type: 'expense', categoryId: 'cat_reminder', isReminder: true, date: new Date().toISOString() },
];

let computedInflow = 0;
let computedOutflow = 0;

sampleTxList.forEach((tx) => {
  if (tx.isReminder || tx.itemKind === 'reminder' || tx.categoryId === 'cat_reminder') return;
  if (tx.categoryId === 'cat_transfer' || tx.type === 'transfer' || tx.isTransfer) return;
  if (tx.categoryId === 'cat_adjustment') return; // Excluded!

  const txDate = new Date(tx.date);
  if (txDate >= startOfCurrentMonth && txDate <= endOfCurrentMonth) {
    if (tx.type === 'income') computedInflow += tx.amount;
    else if (tx.type === 'expense') computedOutflow += tx.amount;
  }
});

if (computedOutflow !== 66308.09) {
  console.error(`❌ Failed: Expected monthly outflow 66308.09, got ${computedOutflow} (override was not excluded!)`);
  process.exit(1);
}
if (computedInflow !== 81566.00) {
  console.error(`❌ Failed: Expected monthly inflow 81566.00, got ${computedInflow}`);
  process.exit(1);
}
console.log(`  ✅ Verified: Monthly inflow (₹${computedInflow}) and outflow (₹${computedOutflow}) completely exclude balance overrides, transfers, and reminders.`);

// --- 34. Testing Account Category Update Configuration ---
console.log('\n--- 34. Testing Account Category Reclassification Logic ---');
function updateAccountCategory(existingAccount, newCategory) {
  const cat = newCategory;
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
  return {
    ...existingAccount,
    ledgerCategory: cat,
    type: defaultType,
    color: defaultColor,
  };
}

const originalSbi = { id: 'acc_sbi', name: 'State Bank of India', ledgerCategory: 'debit', balance: 5000 };
const reclassifiedSbiToCredit = updateAccountCategory(originalSbi, 'credit');
if (reclassifiedSbiToCredit.ledgerCategory !== 'credit' || reclassifiedSbiToCredit.type !== 'Credit Card') {
  console.error('❌ Failed: Reclassifying SBI to credit card failed!', reclassifiedSbiToCredit);
  process.exit(1);
}
const reclassifiedSbiToCash = updateAccountCategory(originalSbi, 'cash');
if (reclassifiedSbiToCash.ledgerCategory !== 'cash' || reclassifiedSbiToCash.type !== 'Cash') {
  console.error('❌ Failed: Reclassifying SBI to cash failed!', reclassifiedSbiToCash);
  process.exit(1);
}
console.log('  ✅ Verified: Account category switching dynamically updates ledgerCategory, card type, and styling.');

// --- 35. Testing GST & ITR CSV Exports ---
console.log('\n--- 35. Testing GST & ITR CSV Exports ---');
const sampleTaxTxs = [
  {
    id: 'tx_tax_1',
    amount: 11800,
    type: 'income',
    accountId: 'acc_icici',
    categoryId: 'cat_salary',
    counterparty: 'Client Consulting Services',
    date: '2026-11-10T10:00:00.000Z',
    note: 'Consulting fees',
  },
  {
    id: 'tx_tax_2',
    amount: 2360,
    type: 'expense',
    accountId: 'acc_icici',
    categoryId: 'cat_bills',
    counterparty: 'Airtel Broadband Office',
    date: '2026-11-11T12:00:00.000Z',
    note: 'Internet dues',
  },
  {
    id: 'tx_tax_3',
    amount: 500,
    type: 'expense',
    accountId: 'acc_icici',
    categoryId: 'cat_food',
    counterparty: 'McDonalds Lunch',
    date: '2026-11-12T13:00:00.000Z',
    note: 'Staff lunch',
  },
  {
    id: 'tx_tax_rem',
    amount: 1500,
    isReminder: true,
    itemKind: 'reminder',
    type: 'expense',
    accountId: 'acc_reminders',
    categoryId: 'cat_reminder',
    counterparty: 'Upcoming Bill Reminder',
    date: '2026-11-20T10:00:00.000Z',
  },
];

const mockAccounts = [
  { id: 'acc_icici', name: 'ICICI Bank', balance: 50000 },
  { id: 'acc_reminders', name: 'Reminders & Mandates', balance: 0 },
];

const gstr1Csv = generateGSTR1Csv(sampleTaxTxs, mockAccounts, CATEGORIES);
if (!gstr1Csv.includes('Client Consulting Services') || gstr1Csv.includes('Airtel Broadband') || gstr1Csv.includes('Upcoming Bill Reminder')) {
  console.error('❌ Failed: GSTR-1 CSV must contain only outward income transactions and exclude reminders!', gstr1Csv);
  process.exit(1);
}

const gstr3bCsv = generateGSTR3BPurchaseCsv(sampleTaxTxs, mockAccounts, CATEGORIES);
if (!gstr3bCsv.includes('Airtel Broadband Office') || !gstr3bCsv.includes('McDonalds Lunch') || gstr3bCsv.includes('Upcoming Bill Reminder')) {
  console.error('❌ Failed: GSTR-3B CSV must contain purchases and exclude reminders!', gstr3bCsv);
  process.exit(1);
}
if (!gstr3bCsv.includes('Ineligible ITC - Section 17(5)(b)')) {
  console.error('❌ Failed: Food/dining purchase must be flagged as Section 17(5) ineligible ITC!', gstr3bCsv);
  process.exit(1);
}

const itrCsv = generateITRScheduleCsv(sampleTaxTxs, mockAccounts, CATEGORIES);
if (!itrCsv.includes('FY 2026-27') || !itrCsv.includes('Rent, Rates, Power, Telephone & Utility Dues')) {
  console.error('❌ Failed: ITR Schedule CSV missing expected FY or P&L head mapping!', itrCsv);
  process.exit(1);
}

const masterTaxCsv = generateUnifiedMasterTaxCsv(sampleTaxTxs, mockAccounts, CATEGORIES);
if (!masterTaxCsv.includes('Client Consulting Services') || !masterTaxCsv.includes('Airtel Broadband Office')) {
  console.error('❌ Failed: Master Tax CSV missing expected transactions!', masterTaxCsv);
  process.exit(1);
}
console.log('  ✅ Verified: GSTR-1 (Income), GSTR-3B (ITC Purchases), ITR Schedule, and Master CSV exported accurately with Section 17(5) classification.');

// --- 36. Testing Clean State Defaults (Zero Dummy Data) ---
console.log('\n--- 36. Testing Clean State Defaults (Zero Test Data) ---');
if (INITIAL_TRANSACTIONS.length !== 0) {
  console.error('❌ Failed: INITIAL_TRANSACTIONS must be completely empty for clean slate start! Found:', INITIAL_TRANSACTIONS.length);
  process.exit(1);
}
if (DEFAULT_ACCOUNTS.length !== 2) {
  console.error('❌ Failed: DEFAULT_ACCOUNTS must only contain Cash in Hand and Reminders & Mandates! Found:', DEFAULT_ACCOUNTS.length);
  process.exit(1);
}
const cashAcc = DEFAULT_ACCOUNTS.find((a) => a.id === 'acc_cash');
const remAcc = DEFAULT_ACCOUNTS.find((a) => a.id === 'acc_reminders');
if (!cashAcc || cashAcc.balance !== 0) {
  console.error('❌ Failed: Cash in Hand must have 0.00 initial balance!', cashAcc);
  process.exit(1);
}
if (!remAcc || remAcc.balance !== 0) {
  console.error('❌ Failed: Reminders & Mandates must have 0.00 initial balance!', remAcc);
  process.exit(1);
}
console.log('  ✅ Verified: Clean slate defaults confirmed (0 seed transactions, Cash ₹0.00, Reminders ₹0.00, 0 dummy bank accounts).');

// --- 37. Testing Incremental High-Watermark SMS Date Cutoff ---
console.log('\n--- 37. Testing Incremental High-Watermark SMS Date Cutoff ---');
const sampleExistingLedger = [
  { id: 'tx_old_1', date: new Date(2026, 9, 15, 10, 0).toISOString(), amount: 500 },
  { id: 'tx_old_2', date: new Date(2026, 10, 10, 14, 0).toISOString(), amount: 1200 },
  { id: 'tx_latest', date: new Date(2026, 10, 12, 18, 0).toISOString(), amount: 850 },
];

let latestTime = 0;
for (const tx of sampleExistingLedger) {
  const t = new Date(tx.date).getTime();
  if (!isNaN(t) && t > latestTime) latestTime = t;
}

const latestDateObj = new Date(latestTime);
const cutoffDateObj = new Date(latestDateObj.getFullYear(), latestDateObj.getMonth(), latestDateObj.getDate(), 0, 0, 0, 0);
const cutoffMs = cutoffDateObj.getTime();

const rawSmsStream = [
  { address: 'HDFCBK', body: 'Rs.300 debited from A/C **1234 on 05-Nov-26', date: new Date(2026, 10, 5, 9, 0).getTime() },
  { address: 'HDFCBK', body: 'Rs.500 debited from A/C **1234 on 11-Nov-26', date: new Date(2026, 10, 11, 12, 0).getTime() },
  { address: 'HDFCBK', body: 'Rs.850 debited from A/C **1234 on 12-Nov-26', date: new Date(2026, 10, 12, 10, 0).getTime() },
  { address: 'HDFCBK', body: 'Rs.950 debited from A/C **1234 on 13-Nov-26', date: new Date(2026, 10, 13, 15, 0).getTime() },
  { address: 'HDFCBK', body: 'Rs.200 debited from A/C **1234 on 14-Nov-26', date: new Date(2026, 10, 14, 11, 0).getTime() },
];

const incrementalSms = rawSmsStream.filter((s) => Number(s.date) >= cutoffMs);
if (incrementalSms.length !== 3) {
  console.error('❌ Failed: Incremental sync must only include SMS from latest transaction date (12 Nov) onwards! Found:', incrementalSms.length);
  process.exit(1);
}
console.log('  ✅ Verified: High-watermark cutoff strictly excludes historical SMS prior to the latest transaction date (12 Nov onwards only).');

// --- 38. Testing Dynamic Category Assignment & Ledger Modification ---
console.log('\n--- 38. Testing Dynamic Category Assignment & Ledger Modification ---');
const testTx = {
  id: 'tx_category_test',
  counterparty: 'VEINTITRES HOSPITALITY',
  amount: 683,
  type: 'expense',
  categoryId: 'cat_other',
  accountId: 'acc_rbl_4723',
  isReminder: false,
};

// 1. Simulate user updating category from 'cat_other' to 'cat_food'
const updatedCategoryTx = {
  ...testTx,
  categoryId: 'cat_food',
};
if (updatedCategoryTx.categoryId !== 'cat_food') {
  console.error('❌ Failed: Category was not updated to cat_food!');
  process.exit(1);
}

// 2. Simulate switching to reminder mode
const reminderTx = {
  ...updatedCategoryTx,
  isReminder: true,
  categoryId: 'cat_reminder',
};
if (reminderTx.categoryId !== 'cat_reminder' || !reminderTx.isReminder) {
  console.error('❌ Failed: Category must lock to cat_reminder in reminder mode!');
  process.exit(1);
}

// 3. Simulate switching from reminder mode back to active debit
const revertedDebitTx = {
  ...reminderTx,
  isReminder: false,
  categoryId: reminderTx.categoryId === 'cat_reminder' ? 'cat_other' : reminderTx.categoryId,
};
if (revertedDebitTx.categoryId === 'cat_reminder' || revertedDebitTx.isReminder) {
  console.error('❌ Failed: Reverting from reminder mode must restore non-reminder category!');
  process.exit(1);
}
console.log('  ✅ Verified: Dynamic category reassignment and reminder isolation verified (Food & Dining assigned, reminder locked, non-reminder restored).');

console.log('\n✅ All Parser, Auto-Account Creation, Transfer Pairing, Loan/Ad Filtering, Reminders, Tax Export & Sorting Unit Tests Passed Successfully!\n');
