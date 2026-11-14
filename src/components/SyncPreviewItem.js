import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useFinance } from '../context/FinanceContext';

function SyncPreviewItem({
  item,
  accountName,
  categoryName,
  categories,
  onDismiss,
  onSetType,
  onAcceptDuplicate,
  onUndoDuplicate,
  onRestoreIgnored,
  onToggleReminder,
  onSetTypeAndReminder,
  onUpdateComment,
  onUpdateCategory,
}) {
  const { theme } = useFinance();
  const [expanded, setExpanded] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

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
    badgeColor = isReminder ? '#D97706' : theme.success;
    badgeIcon = isReminder ? 'notifications-outline' : 'checkmark-circle-outline';
    badgeText = isReminder ? 'Reminder (No Balance)' : 'Ready to Import';
  } else if (isAcceptedDuplicate) {
    badgeBg = 'rgba(16, 185, 129, 0.18)';
    badgeColor = '#10B981';
    badgeIcon = 'checkmark-done-circle-outline';
    badgeText = 'Accepted Duplicate';
  } else if (isDuplicate) {
    badgeBg = 'rgba(245, 158, 11, 0.15)';
    badgeColor = '#D97706';
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
  const categoryObj = (categories || []).find((c) => c.id === item.categoryId);
  const displayCategoryName = categoryObj?.name || categoryName || 'Category';

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

  // Handle switching between Debit, Credit, and Reminder cleanly
  const handleSelectOption = (option) => {
    if (onSetTypeAndReminder) {
      if (option === 'reminder') {
        onSetTypeAndReminder(item, item.type || 'expense', true);
      } else {
        onSetTypeAndReminder(item, option, false);
      }
      return;
    }

    // Fallback if onSetTypeAndReminder not provided
    if (option === 'reminder') {
      if (!isReminder && onToggleReminder) {
        onToggleReminder(item);
      }
    } else {
      if (isReminder && onToggleReminder) {
        onToggleReminder(item);
      }
      if (onSetType) {
        onSetType(item, option);
      }
    }
  };

  const isDebitActive = !isReminder && item.type === 'expense';
  const isCreditActive = !isReminder && item.type === 'income';
  const isReminderActive = isReminder;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: isReminder ? '#F59E0B' : item.isUncertain ? '#F59E0B' : theme.cardBorder,
          borderLeftWidth: 4,
          borderLeftColor: leftBorderColor,
        },
        (!isReady && !isAcceptedDuplicate) && { opacity: 0.88, backgroundColor: theme.cardSubtle },
      ]}
    >
      {/* 1. Header Row: Counterparty & Amount */}
      <View style={styles.topRow}>
        <View style={styles.merchantCol}>
          <Text style={[styles.merchantName, { color: theme.text }]} numberOfLines={1}>
            {item.counterparty}
          </Text>
          <View style={styles.accountCategoryRow}>
            <Text style={[styles.accountText, { color: theme.accent }]} numberOfLines={1}>
              {accountName || item.accountName}
            </Text>
            <Text style={[styles.dot, { color: theme.textMuted }]}>•</Text>
            <TouchableOpacity
              style={[
                styles.categoryChipBtn,
                {
                  backgroundColor: isReminder
                    ? 'rgba(245, 158, 11, 0.12)'
                    : `${categoryObj?.color || '#6366F1'}18`,
                  borderColor: isReminder
                    ? 'rgba(245, 158, 11, 0.3)'
                    : `${categoryObj?.color || '#6366F1'}35`,
                },
              ]}
              onPress={() => {
                if (!isReminder) {
                  setIsCategoryPickerOpen(!isCategoryPickerOpen);
                }
              }}
              activeOpacity={isReminder ? 1 : 0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${displayCategoryName}. Tap to change.`}
            >
              <Ionicons
                name={categoryObj?.icon || 'pricetag-outline'}
                size={11}
                color={isReminder ? '#D97706' : (categoryObj?.color || theme.accent)}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.categoryChipBtnText,
                  { color: isReminder ? '#D97706' : (categoryObj?.color || theme.accent) },
                ]}
                numberOfLines={1}
              >
                {displayCategoryName}
              </Text>
              {!isReminder && (
                <Ionicons
                  name={isCategoryPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={10}
                  color={categoryObj?.color || theme.textMuted}
                  style={{ marginLeft: 3 }}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.amountCol}>
          <Text
            style={[
              styles.amountText,
              {
                color: isReminder
                  ? '#D97706'
                  : item.type === 'income'
                  ? theme.success
                  : theme.danger,
              },
            ]}
          >
            {isReminder ? '' : item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          {isReminder && (
            <View style={styles.noticePill}>
              <Text style={styles.noticePillText}>Notice Only</Text>
            </View>
          )}
        </View>
      </View>

      {/* Inline Category Picker Tray (expandable on tap) */}
      {isCategoryPickerOpen && !isReminder && (
        <View style={[styles.categoryPickerTray, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
          <View style={styles.categoryPickerHeader}>
            <Text style={[styles.categoryPickerTitle, { color: theme.textMuted }]}>
              ASSIGN CATEGORY FOR THIS TRANSACTION
            </Text>
            <TouchableOpacity
              onPress={() => setIsCategoryPickerOpen(false)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close-circle-outline" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.categoryGrid}>
            {(categories || [])
              .filter((c) => c.id !== 'cat_reminder' && c.id !== 'cat_adjustment')
              .map((cat) => {
                const isSelected = cat.id === item.categoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOptionChip,
                      {
                        backgroundColor: isSelected ? `${cat.color}25` : theme.card,
                        borderColor: isSelected ? cat.color : theme.border,
                      },
                      isSelected && { borderWidth: 2 },
                    ]}
                    onPress={() => {
                      if (onUpdateCategory) {
                        onUpdateCategory(item, cat.id);
                      }
                      setIsCategoryPickerOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.categoryOptionIconBox,
                        { backgroundColor: `${cat.color}20` },
                        isSelected && { backgroundColor: cat.color },
                      ]}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={12}
                        color={isSelected ? '#FFFFFF' : cat.color}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryOptionText,
                        {
                          color: isSelected
                            ? theme.mode === 'dark' ? '#FFFFFF' : cat.color
                            : theme.textSecondary,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>
      )}

      {/* 2. Unified 3-Segment Control: Debit | Credit | Reminder */}
      <View style={[styles.segmentedControl, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
        {/* Option 1: - Debit */}
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            isDebitActive && styles.segmentBtnDebitActive,
          ]}
          onPress={() => handleSelectOption('expense')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="arrow-down-circle"
            size={13}
            color={isDebitActive ? '#FFFFFF' : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.segmentBtnText,
              { color: isDebitActive ? '#FFFFFF' : theme.textSecondary },
              isDebitActive && styles.segmentBtnTextActive,
            ]}
          >
            - Debit
          </Text>
        </TouchableOpacity>

        {/* Option 2: + Credit */}
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            isCreditActive && styles.segmentBtnCreditActive,
          ]}
          onPress={() => handleSelectOption('income')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="arrow-up-circle"
            size={13}
            color={isCreditActive ? '#FFFFFF' : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.segmentBtnText,
              { color: isCreditActive ? '#FFFFFF' : theme.textSecondary },
              isCreditActive && styles.segmentBtnTextActive,
            ]}
          >
            + Credit
          </Text>
        </TouchableOpacity>

        {/* Option 3: 🔔 Reminder */}
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            isReminderActive && styles.segmentBtnReminderActive,
          ]}
          onPress={() => handleSelectOption('reminder')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="notifications"
            size={13}
            color={isReminderActive ? '#FFFFFF' : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.segmentBtnText,
              { color: isReminderActive ? '#FFFFFF' : theme.textSecondary },
              isReminderActive && styles.segmentBtnTextActive,
            ]}
          >
            🔔 Reminder
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Helper Note for Reminder Mode */}
      {isReminder && (
        <View style={styles.reminderNoticeBox}>
          <Ionicons name="information-circle" size={13} color="#D97706" style={{ marginRight: 5 }} />
          <Text style={styles.reminderNoticeText}>
            Informational notice only • Excluded from account balance & reports
          </Text>
        </View>
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
            Review: <Text style={{ fontWeight: '700' }}>{item.uncertaintyReason || 'Tap Debit, Credit, or Reminder above to confirm'}</Text>
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

      {/* 4. Full SMS Description Box */}
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
          {descriptionText.length > 110 && (
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

      {/* 5. Optional Tag/Comment Input */}
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

      {/* 6. Decluttered Two-Tier Footer */}
      {/* Tier 1: Badges */}
      <View style={styles.footerBadgesRow}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Ionicons name={badgeIcon} size={11} color={badgeColor} style={{ marginRight: 4 }} />
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>

        {ledgerCat && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  ledgerCat === 'credit'
                    ? 'rgba(225, 29, 72, 0.12)'
                    : ledgerCat === 'wallet'
                    ? 'rgba(6, 182, 212, 0.12)'
                    : theme.primaryLight,
              },
            ]}
          >
            <Ionicons
              name={ledgerCat === 'credit' ? 'card-outline' : ledgerCat === 'wallet' ? 'wallet-outline' : 'business-outline'}
              size={11}
              color={ledgerCat === 'credit' ? '#E11D48' : ledgerCat === 'wallet' ? '#06B6D4' : theme.accent}
              style={{ marginRight: 3 }}
            />
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

      {/* Tier 2: Date & Action Buttons */}
      <View style={styles.footerActionsRow}>
        <View style={styles.dateCol}>
          <Ionicons name="calendar-outline" size={11} color={theme.textMuted} style={{ marginRight: 4 }} />
          <Text style={[styles.dateText, { color: theme.textMuted }]} numberOfLines={1}>
            {formatDate(item.date)}
          </Text>
        </View>

        <View style={styles.actionButtonsCol}>
          {/* Import Duplicate */}
          {isDuplicate && onAcceptDuplicate && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.successLight, borderColor: theme.success }]}
              onPress={() => onAcceptDuplicate(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="add-circle" size={13} color={theme.success} style={{ marginRight: 3 }} />
              <Text style={[styles.actionBtnText, { color: theme.success }]}>Import</Text>
            </TouchableOpacity>
          )}

          {/* Undo Duplicate */}
          {isAcceptedDuplicate && onUndoDuplicate && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}
              onPress={() => onUndoDuplicate(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-undo-outline" size={13} color={theme.textSecondary} style={{ marginRight: 3 }} />
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Undo</Text>
            </TouchableOpacity>
          )}

          {/* Restore Previously Deleted */}
          {isIgnored && onRestoreIgnored && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
              onPress={() => onRestoreIgnored(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="refresh-outline" size={13} color={theme.accent} style={{ marginRight: 3 }} />
              <Text style={[styles.actionBtnText, { color: theme.accent }]}>Restore</Text>
            </TouchableOpacity>
          )}

          {/* Dismiss / Delete Trash Button */}
          {onDismiss && (
            <TouchableOpacity
              style={[styles.dismissBtn, { backgroundColor: theme.dangerLight }]}
              onPress={() => onDismiss(item)}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Discard this transaction"
            >
              <Ionicons name="trash-outline" size={14} color={theme.danger} />
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
    prevProps.item.categoryId === nextProps.item.categoryId &&
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
    marginBottom: 12,
    borderWidth: 1.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  merchantCol: {
    flex: 1,
    marginRight: 10,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  accountCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  accountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dot: {
    marginHorizontal: 5,
    fontSize: 10,
  },
  categoryText: {
    fontSize: 11,
  },
  categoryChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryChipBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  categoryPickerTray: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  categoryPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  categoryPickerTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryOptionIconBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  categoryOptionText: {
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
  noticePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  noticePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
  },
  segmentBtnDebitActive: {
    backgroundColor: '#DC2626',
  },
  segmentBtnCreditActive: {
    backgroundColor: '#10B981',
  },
  segmentBtnReminderActive: {
    backgroundColor: '#F59E0B',
  },
  segmentBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    fontWeight: '800',
  },
  reminderNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 10,
  },
  reminderNoticeText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
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
    fontSize: 11.5,
    lineHeight: 17,
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
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  commentInput: {
    flex: 1,
    fontSize: 11.5,
    padding: 0,
  },
  footerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  footerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  dateCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  actionButtonsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonText: {
    fontSize: 10,
    color: '#F59E0B',
    marginTop: 6,
    fontStyle: 'italic',
  },
});
