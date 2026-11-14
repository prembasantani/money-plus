import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useFinance } from '../context/FinanceContext';

function TransactionItem({
  transaction,
  category,
  account,
  onPress,
  onDelete,
  onEdit,
  onEditComment,
  onSelectAccount,
  onSelectCategory,
}) {
  const { theme } = useFinance();

  const isIncome = transaction.type === 'income';
  const isAdjustment = transaction.type === 'adjustment' || transaction.categoryId === 'cat_adjustment';
  const isReminder = !!transaction.isReminder;

  const amountColor = isReminder ? '#F59E0B' : isIncome ? '#10B981' : isAdjustment ? '#818CF8' : '#F43F5E';
  const signPrefix = isReminder ? '🔔 ' : isIncome ? '+' : isAdjustment ? '±' : '-';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          borderLeftWidth: 3.5,
          borderLeftColor: amountColor,
          borderWidth: 1.5,
        },
      ]}
      onPress={() => onPress && onPress(transaction)}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {/* 1st Flex Group: Transaction Details (Icon, Title, Account, Date, Note, Comment) */}
      <View style={styles.infoGroup}>
        <TouchableOpacity
          style={[
            styles.iconBox,
            { backgroundColor: category ? `${category.color}22` : theme.primaryLight },
          ]}
          onPress={() => onSelectCategory && onSelectCategory(transaction.categoryId)}
          activeOpacity={onSelectCategory ? 0.7 : 1}
        >
          <Ionicons
            name={category ? category.icon : 'cash-outline'}
            size={18}
            color={category ? category.color : theme.accent}
          />
        </TouchableOpacity>

        <View style={styles.centerInfo}>
          <Text style={[styles.counterpartyText, { color: theme.text }]}>
            {transaction.counterparty || 'Transaction'}
          </Text>

          <View style={styles.metaRow}>
            <TouchableOpacity
              onPress={() => onSelectAccount && onSelectAccount(transaction.accountId)}
              activeOpacity={onSelectAccount ? 0.7 : 1}
            >
              <Text style={[styles.metaAccount, { color: theme.accent }]}>
                {account ? account.name : 'Unknown Account'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.dotSeparator, { color: theme.textMuted }]}>•</Text>
            <Text style={[styles.metaDate, { color: theme.textSecondary }]}>
              {formatDate(transaction.date)}
            </Text>
            {isReminder ? (
              <View style={[styles.reminderChip, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                <Ionicons name="notifications-outline" size={10} color="#F59E0B" style={{ marginRight: 2 }} />
                <Text style={styles.reminderChipText}>Reminder</Text>
              </View>
            ) : null}
          </View>

          {/* User Comment / Annotation */}
          {transaction.comment ? (
            <TouchableOpacity
              style={[styles.commentBubble, { backgroundColor: theme.primaryLight, borderColor: theme.border }]}
              onPress={() => onEditComment && onEditComment(transaction)}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={11} color={theme.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.commentText, { color: theme.primary }]} numberOfLines={1}>
                {transaction.comment}
              </Text>
              <Ionicons name="pencil" size={10} color={theme.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ) : null}

          {transaction.note ? (
            <Text style={[styles.noteText, { color: theme.textMuted }]} numberOfLines={2}>
              {transaction.note}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 2nd Flex Group: Amount & Action Icons (Edit Comment & Delete) */}
      <View style={styles.actionsGroup}>
        <Text style={[styles.amountText, { color: amountColor }]}>
          {signPrefix}{formatCurrency(transaction.amount)}
        </Text>

        <View style={styles.buttonsRow}>
          {onEditComment && !transaction.comment ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.cardSubtle }]}
              onPress={() => onEditComment(transaction)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityLabel="Add comment"
            >
              <Ionicons name="chatbubble-outline" size={13} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}

          {onDelete ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.dangerLight }]}
              onPress={() => onDelete(transaction.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityLabel="Delete transaction"
            >
              <Ionicons name="trash-outline" size={13} color={theme.danger} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 13,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
  },
  // 1st Flex Group
  infoGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  centerInfo: {
    flex: 1,
  },
  counterpartyText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaAccount: {
    fontSize: 11,
    fontWeight: '600',
  },
  dotSeparator: {
    marginHorizontal: 5,
    fontSize: 10,
  },
  metaDate: {
    fontSize: 11,
  },
  commentBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  commentText: {
    fontSize: 10.5,
    fontWeight: '700',
    maxWidth: 180,
  },
  noteText: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },
  // 2nd Flex Group
  actionsGroup: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 6,
  },
  reminderChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
});

export default memo(TransactionItem);
