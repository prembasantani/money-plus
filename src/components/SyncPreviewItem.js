import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useFinance } from '../context/FinanceContext';

function SyncPreviewItem({
  item,
  accountName,
  categoryName,
  onDismiss,
  onSetType,
  onAcceptDuplicate,
  onUndoDuplicate,
  onRestoreIgnored,
  onToggleReminder,
  onUpdateComment,
}) {
  const { theme } = useFinance();
  const [expanded, setExpanded] = useState(false);

  const isReady = item.status === 'ready';
  const isAcceptedDuplicate = item.status === 'accepted_duplicate';
  const isDuplicate = item.status === 'duplicate';
  const isIgnored = item.status === 'ignored';
  const isReminder = !!item.isReminder;

  let badgeBg = theme.cardSubtle;
  let badgeColor = theme.textSecondary;
  let badgeIcon = 'information-circle-outline';
  let badgeText = 'Already in Ledger';

  if (isReady) {
    badgeBg = isReminder ? 'rgba(245, 158, 11, 0.18)' : theme.successLight;
    badgeColor = isReminder ? '#F59E0B' : theme.success;
    badgeIcon = isReminder ? 'notifications-outline' : 'checkmark-circle-outline';
    badgeText = isReminder ? 'Reminder (No Balance)' : 'Ready';
  } else if (isAcceptedDuplicate) {
    badgeBg = 'rgba(16, 185, 129, 0.18)';
    badgeColor = '#10B981';
    badgeIcon = 'checkmark-done-circle-outline';
    badgeText = 'Accepted Duplicate';
  } else if (isDuplicate) {
    badgeBg = 'rgba(245, 158, 11, 0.15)';
    badgeColor = '#F59E0B';
    badgeIcon = 'alert-circle-outline';
    badgeText = 'Duplicate (2m)';
  } else if (isIgnored) {
    badgeBg = 'rgba(239, 68, 68, 0.15)';
    badgeColor = '#EF4444';
    badgeIcon = 'trash-bin-outline';
    badgeText = 'Previously Deleted';
  }

  const isAutoDiscovered = !!item.discoveredAccount;
  const descriptionText = item.note || item.rawText || '';
  const ledgerCat = item.ledgerCategory || item.discoveredAccount?.ledgerCategory;

  const leftBorderColor = isIgnored
    ? '#EF4444'
    : isAcceptedDuplicate
    ? '#10B981'
    : item.isUncertain
    ? '#F59E0B'
    : isReminder
    ? '#F59E0B'
    : item.transferPairId
    ? '#06B6D4'
    : badgeColor;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: isReminder ? '#F59E0B' : item.isUncertain ? '#F59E0B' : theme.cardBorder,
          borderLeftWidth: 4,
          borderLeftColor: leftBorderColor,
          borderWidth: 1.5,
        },
        (!isReady && !isAcceptedDuplicate) && { opacity: 0.85, backgroundColor: theme.cardSubtle },
      ]}
    >
      {/* Top Row: Counterparty / Merchant & Amount */}
      <View style={styles.topRow}>
        <View style={styles.merchantCol}>
          <Text style={[styles.merchantName, { color: theme.text }]} numberOfLines={1}>
            {item.counterparty}
          </Text>
          <View style={styles.accountCategoryRow}>
            <Text style={[styles.accountText, { color: theme.accent }]}>
              {accountName || item.accountName}
            </Text>
            <Text style={[styles.dot, { color: theme.textMuted }]}>•</Text>
            <Text style={[styles.categoryText, { color: theme.textSecondary }]}>
              {categoryName}
            </Text>
          </View>
        </View>

        <View style={styles.amountCol}>
          <Text
            style={[
              styles.amountText,
              { color: item.type === 'income' ? theme.success : theme.danger },
            ]}
          >
            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
        </View>
      </View>

      {/* Prominent Side-by-Side Debit / Credit Selector */}
      <View style={styles.typeSelectorRow}>
        <TouchableOpacity
          style={[
            styles.typeSelectorBtn,
            item.type === 'expense'
              ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
              : { backgroundColor: theme.cardSubtle, borderColor: theme.border },
          ]}
          onPress={() => onSetType && onSetType(item, 'expense')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="arrow-down-circle"
            size={13}
            color={item.type === 'expense' ? '#FFFFFF' : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.typeSelectorText,
              { color: item.type === 'expense' ? '#FFFFFF' : theme.textSecondary },
              item.type === 'expense' && { fontWeight: '800' },
            ]}
          >
            - Debit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeSelectorBtn,
            item.type === 'income'
              ? { backgroundColor: '#10B981', borderColor: '#10B981' }
              : { backgroundColor: theme.cardSubtle, borderColor: theme.border },
          ]}
          onPress={() => onSetType && onSetType(item, 'income')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="arrow-up-circle"
            size={13}
            color={item.type === 'income' ? '#FFFFFF' : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.typeSelectorText,
              { color: item.type === 'income' ? '#FFFFFF' : theme.textSecondary },
              item.type === 'income' && { fontWeight: '800' },
            ]}
          >
            + Credit
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reminder Notification Banner with Toggle Option */}
      {isReminder ? (
        <View style={[styles.reminderBanner, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
            <Ionicons name="notifications-outline" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={[styles.reminderText, { color: '#F59E0B' }]} numberOfLines={2}>
              🔔 <Text style={{ fontWeight: '800' }}>Reminder Only:</Text> Will not deduct from account balance.
            </Text>
          </View>
          {onToggleReminder && (
            <TouchableOpacity
              style={[styles.toggleReminderBtn, { backgroundColor: '#F59E0B' }]}
              onPress={() => onToggleReminder(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.toggleReminderBtnText}>Consider as Txn</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        onToggleReminder && isReady && (
          <TouchableOpacity
            style={styles.keepAsReminderRow}
            onPress={() => onToggleReminder(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={12} color={theme.accent} style={{ marginRight: 4 }} />
            <Text style={[styles.keepAsReminderText, { color: theme.accent }]}>
              Mark as Reminder (Exclude from account balance)
            </Text>
          </TouchableOpacity>
        )
      )}

      {/* Inter-Ledger Fund Transfer Pairing Banner */}
      {item.transferPairId && (
        <View style={[styles.transferBanner, { backgroundColor: 'rgba(6, 182, 212, 0.12)', borderColor: '#06B6D4' }]}>
          <Ionicons name="swap-horizontal" size={13} color="#06B6D4" style={{ marginRight: 6 }} />
          <Text style={[styles.transferText, { color: '#06B6D4' }]} numberOfLines={2}>
            🔄 Inter-Ledger Transfer: <Text style={{ fontWeight: '800' }}>Paired with {item.transferPartnerAccount}</Text>
          </Text>
        </View>
      )}

      {/* Uncertainty Review Banner */}
      {item.isUncertain && (
        <View style={[styles.uncertainBanner, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' }]}>
          <Ionicons name="help-circle" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={[styles.uncertainText, { color: '#F59E0B' }]} numberOfLines={2}>
            Review: <Text style={{ fontWeight: '700' }}>{item.uncertaintyReason || 'Tap - Debit or + Credit above to verify'}</Text>
          </Text>
        </View>
      )}

      {/* Auto-discovered account banner */}
      {isAutoDiscovered && (
        <View style={[styles.autoAccBanner, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
          <Ionicons name="sparkles" size={13} color={theme.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.autoAccText, { color: theme.accent }]}>
            Auto-Detected Account: <Text style={{ fontWeight: '800' }}>{item.discoveredAccount.name}</Text>
          </Text>
        </View>
      )}

      {/* Full SMS Description */}
      {descriptionText ? (
        <View style={[styles.descriptionContainer, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
          <View style={styles.descriptionHeader}>
            <Ionicons name="chatbox-ellipses-outline" size={12} color={theme.textMuted} style={{ marginRight: 5 }} />
            <Text style={[styles.descriptionLabel, { color: theme.textMuted }]}>SMS ALERT DETAILS</Text>
          </View>
          <Text
            style={[styles.descriptionText, { color: theme.text }]}
            numberOfLines={expanded ? undefined : 3}
          >
            {descriptionText}
          </Text>
          {descriptionText.length > 120 && (
            <TouchableOpacity
              onPress={() => setExpanded(!expanded)}
              style={styles.expandBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.expandBtnText, { color: theme.accent }]}>
                {expanded ? 'Show Less' : 'Show Full Message'}
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={theme.accent}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Editable Comment Row during SMS Sync */}
      <View style={[styles.commentRow, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
        <Ionicons name="chatbubble-outline" size={13} color={theme.accent} style={{ marginRight: 6 }} />
        <TextInput
          style={[styles.commentInput, { color: theme.text }]}
          placeholder="Add custom comment / tag (optional)..."
          placeholderTextColor={theme.textMuted}
          value={item.comment || ''}
          onChangeText={(txt) => onUpdateComment && onUpdateComment(item, txt)}
        />
      </View>

      {/* Status Badges, Date & Actions Row */}
      <View style={styles.bottomRow}>
        <View style={styles.badgesGroup}>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Ionicons name={badgeIcon} size={12} color={badgeColor} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>

          {ledgerCat && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    ledgerCat === 'credit'
                      ? 'rgba(225, 29, 72, 0.15)'
                      : ledgerCat === 'wallet'
                      ? 'rgba(6, 182, 212, 0.15)'
                      : theme.primaryLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      ledgerCat === 'credit'
                        ? '#E11D48'
                        : ledgerCat === 'wallet'
                        ? '#06B6D4'
                        : theme.accent,
                  },
                ]}
              >
                {ledgerCat === 'credit' ? 'Credit Card' : ledgerCat === 'wallet' ? 'Wallet' : 'Bank Account'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsGroup}>
          <Text style={[styles.dateText, { color: theme.textMuted }]}>
            {formatDate(item.date)}
          </Text>

          {/* Import button for Duplicates (Moves to Accepted Duplicates section) */}
          {isDuplicate && onAcceptDuplicate && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.successLight, borderColor: theme.success }]}
              onPress={() => onAcceptDuplicate(item)}
              activeOpacity={0.75}
              accessibilityLabel="Accept this duplicate and move to Accepted Duplicates"
            >
              <Ionicons name="add-circle" size={13} color={theme.success} style={{ marginRight: 3 }} />
              <Text style={[styles.actionBtnText, { color: theme.success }]}>Import</Text>
            </TouchableOpacity>
          )}

          {/* Undo button for Accepted Duplicates (Moves back to Duplicates) */}
          {isAcceptedDuplicate && onUndoDuplicate && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
              onPress={() => onUndoDuplicate(item)}
              activeOpacity={0.75}
              accessibilityLabel="Undo accepting this duplicate"
            >
              <Ionicons name="arrow-undo-outline" size={13} color={theme.textSecondary} style={{ marginRight: 3 }} />
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Undo</Text>
            </TouchableOpacity>
          )}

          {/* Restore button for Previously Ignored items */}
          {isIgnored && onRestoreIgnored && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
              onPress={() => onRestoreIgnored(item)}
              activeOpacity={0.75}
              accessibilityLabel="Restore this previously deleted transaction"
            >
              <Ionicons name="refresh-outline" size={13} color={theme.accent} style={{ marginRight: 3 }} />
              <Text style={[styles.actionBtnText, { color: theme.accent }]}>Restore</Text>
            </TouchableOpacity>
          )}

          {/* Dismiss / Delete / Spam button */}
          {onDismiss && (
            <TouchableOpacity
              style={[styles.dismissBtn, { backgroundColor: theme.dangerLight }]}
              onPress={() => onDismiss(item)}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Discard this transaction"
            >
              <Ionicons name="trash-outline" size={13} color={theme.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {item.statusReason && !isReady && !isAcceptedDuplicate ? (
        <Text style={styles.reasonText}>⚠️ {item.statusReason}</Text>
      ) : null}
    </View>
  );
}

function areEqual(prevProps, nextProps) {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.type === nextProps.item.type &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.amount === nextProps.item.amount &&
    prevProps.item.isReminder === nextProps.item.isReminder &&
    prevProps.item.isUncertain === nextProps.item.isUncertain &&
    prevProps.item.transferPairId === nextProps.item.transferPairId &&
    prevProps.accountName === nextProps.accountName &&
    prevProps.categoryName === nextProps.categoryName
  );
}

export default memo(SyncPreviewItem, areEqual);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  merchantCol: {
    flex: 1,
    marginRight: 10,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  accountCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  accountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dot: {
    marginHorizontal: 5,
    fontSize: 10,
  },
  categoryText: {
    fontSize: 11,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeSelectorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  reminderText: {
    fontSize: 11,
    lineHeight: 15,
  },
  toggleReminderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleReminderBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  keepAsReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 6,
  },
  keepAsReminderText: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  transferBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  transferText: {
    fontSize: 11,
    flex: 1,
  },
  uncertainBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  uncertainText: {
    fontSize: 11,
    flex: 1,
  },
  autoAccBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  autoAccText: {
    fontSize: 11,
    fontWeight: '600',
  },
  descriptionContainer: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  descriptionLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 18,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  expandBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 10.5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    marginBottom: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 11.5,
    padding: 0,
  },
  reasonText: {
    fontSize: 10,
    color: '#F59E0B',
    marginTop: 6,
    fontStyle: 'italic',
  },
});
