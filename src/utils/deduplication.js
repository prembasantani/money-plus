/**
 * Idempotent Deduplication Engine
 * Generates composite fingerprint and discards duplicate alerts within a 2-minute window.
 */

const TWO_MINUTES_MS = 2 * 60 * 1000;

/**
 * Normalize counterparty name to prevent trivial naming variations from bypassing deduplication
 * e.g., "SWIGGY" vs "Swiggy India" -> "swiggy"
 * "AMAZON RETAIL" vs "AMAZON" -> "amazon"
 */
export function normalizeCounterparty(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\b(pvt|ltd|retail|india|corp|solutions|store|supermarket|smart)\b/g, '')
    .trim()
    .split(/\s+/)[0] || '';
}

/**
 * Normalize raw SMS body for permanent blacklist matching
 * Strips all whitespace, special characters, and lowercases
 */
export function normalizeSmsText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Generate a composite fingerprint hash key: date_amount_account_counterparty
 * Accepts either (dateIso, amount, accountId, counterparty) or a transaction object
 */
export function generateFingerprint(dateIsoOrTx, amount, accountId, counterparty) {
  let d = dateIsoOrTx;
  let a = amount;
  let acc = accountId;
  let cp = counterparty;

  if (dateIsoOrTx && typeof dateIsoOrTx === 'object') {
    d = dateIsoOrTx.date;
    a = dateIsoOrTx.amount;
    acc = dateIsoOrTx.accountId;
    cp = dateIsoOrTx.counterparty;
  }

  let normDate = '';
  try {
    const parsedDate = new Date(d);
    if (!isNaN(parsedDate.getTime())) {
      normDate = parsedDate.toISOString().slice(0, 16);
    } else {
      normDate = String(d || '');
    }
  } catch {
    normDate = String(d || '');
  }

  const normAmount = Number(a || 0).toFixed(2);
  const normAcc = (acc || '').toLowerCase();
  const normCp = normalizeCounterparty(cp);
  return `${normDate}_${normAmount}_${normAcc}_${normCp}`;
}

/**
 * Check if candidate transaction matches another record within the 2-minute window
 */
export function isDuplicateWithinWindow(candidate, reference) {
  // Amount must match
  const amt1 = Number(candidate.amount).toFixed(2);
  const amt2 = Number(reference.amount).toFixed(2);
  if (amt1 !== amt2) return false;

  // Type must match (income vs expense)
  if (candidate.type !== reference.type) return false;

  // Counterparty normalized match
  const cp1 = normalizeCounterparty(candidate.counterparty);
  const cp2 = normalizeCounterparty(reference.counterparty);
  const counterpartyMatches = cp1 === cp2 || (cp1 && cp2 && (cp1.includes(cp2) || cp2.includes(cp1)));

  // Account matches OR multi-bank transfer alert (e.g. Card vs Bank alert)
  const accountMatches = candidate.accountId === reference.accountId;

  if (!counterpartyMatches && !accountMatches) return false;

  // Temporal proximity: within 2 minutes (120,000 ms)
  const t1 = new Date(candidate.date).getTime();
  const t2 = new Date(reference.date).getTime();

  if (isNaN(t1) || isNaN(t2)) return false;

  const diffMs = Math.abs(t1 - t2);
  return diffMs <= TWO_MINUTES_MS;
}

/**
 * Evaluate a batch of parsed transactions against the existing ledger
 * Returns each candidate with a status:
 * - 'ready': Clean new transaction to be imported
 * - 'duplicate': Flagged and dropped due to 2-minute window duplicate alert
 * - 'existing': Already recorded in the ledger
 */
export function runDeduplicationEngine(parsedCandidates, existingLedger = [], blacklistedFingerprints = []) {
  const results = [];
  const acceptedInBatch = [];

  for (const candidate of parsedCandidates) {
    const candidateFp = candidate.fingerprint || generateFingerprint(
      candidate.date,
      candidate.amount,
      candidate.accountId,
      candidate.counterparty
    );

    // 0. Check if candidate was dismissed / blacklisted by user
    const candidateNorm = normalizeSmsText(candidate.rawText || candidate.note);
    if (
      Array.isArray(blacklistedFingerprints) &&
      (blacklistedFingerprints.includes(candidateFp) ||
        blacklistedFingerprints.includes(candidate.id) ||
        (candidate.rawText && blacklistedFingerprints.includes(candidate.rawText.trim())) ||
        (candidateNorm && blacklistedFingerprints.some((bf) => bf && normalizeSmsText(bf) === candidateNorm)))
    ) {
      continue; // Exclude dismissed transaction from preview and ledger permanently
    }

    // 1. Check exact fingerprint against existing ledger (silently omit from sync preview)
    const exactMatchLedger = existingLedger.find(
      (tx) => tx.fingerprint === candidateFp || tx.id === candidate.id
    );
    if (exactMatchLedger) {
      // User request: "Dont show existing transactions no point of showing same transactions again on sms sync"
      continue;
    }

    // 2. Check 2-minute window against existing ledger (silently omit already recorded items)
    const windowMatchLedger = existingLedger.find((tx) =>
      isDuplicateWithinWindow(candidate, tx)
    );
    if (windowMatchLedger) {
      // Already recorded in user's ledger in a previous sync
      continue;
    }

    // 3. Check 2-minute window against already accepted items in THIS batch
    // (e.g., Bank SMS + UPI app push notification sent 30 seconds apart)
    const windowMatchBatch = acceptedInBatch.find((tx) =>
      isDuplicateWithinWindow(candidate, tx)
    );
    if (windowMatchBatch) {
      results.push({
        ...candidate,
        fingerprint: candidateFp,
        status: 'duplicate',
        statusReason: 'Duplicate notification in SMS dump (within 2-min window)',
      });
      continue;
    }

    // Passed all deduplication gates!
    const cleanCandidate = {
      ...candidate,
      fingerprint: candidateFp,
      status: 'ready',
      statusReason: 'Ready to import',
    };
    results.push(cleanCandidate);
    acceptedInBatch.push(cleanCandidate);
  }

  // Strict descending chronological sorting: newest at the top
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return linkTransferPairs(results);
}

/**
 * Automatically detects and links pairs of transactions representing Inter-Ledger Fund Transfers
 * (e.g. Bank Debit of ₹18,000 paired with Credit Card Payment Receipt of ₹18,000 on the same date)
 */
export function linkTransferPairs(items) {
  const pairedIds = new Set();

  for (let i = 0; i < items.length; i++) {
    const itemA = items[i];
    if (pairedIds.has(itemA.id) || itemA.status !== 'ready') continue;

    for (let j = i + 1; j < items.length; j++) {
      const itemB = items[j];
      if (pairedIds.has(itemB.id) || itemB.status !== 'ready') continue;

      // Amounts must match exactly
      if (Math.abs(itemA.amount - itemB.amount) < 0.01) {
        // Types must be opposite: one expense and one income
        const isOpposite =
          (itemA.type === 'expense' && itemB.type === 'income') ||
          (itemA.type === 'income' && itemB.type === 'expense');

        if (isOpposite && itemA.accountId !== itemB.accountId) {
          const tA = new Date(itemA.date).getTime();
          const tB = new Date(itemB.date).getTime();
          // Within 24 hours of each other
          if (!isNaN(tA) && !isNaN(tB) && Math.abs(tA - tB) <= 24 * 60 * 60 * 1000) {
            const pairId = `pair_${itemA.id}_${itemB.id}`;
            pairedIds.add(itemA.id);
            pairedIds.add(itemB.id);

            itemA.transferPairId = pairId;
            itemA.transferPartnerAccount = itemB.accountName || 'Target Ledger';
            itemA.categoryId = 'cat_transfer';

            itemB.transferPairId = pairId;
            itemB.transferPartnerAccount = itemA.accountName || 'Source Ledger';
            itemB.categoryId = 'cat_transfer';
            break;
          }
        }
      }
    }
  }

  return items;
}
