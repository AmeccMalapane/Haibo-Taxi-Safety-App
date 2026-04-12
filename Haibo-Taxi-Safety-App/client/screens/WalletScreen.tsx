import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BrandColors, BorderRadius } from '@/constants/theme';
import { Button } from '@/components/Button';
import { useWalletBalance, useWalletTransactions } from '@/hooks/useApiData';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { getWalletBalance, saveWalletBalance, getTransactions, addTransaction, generateId } from '@/lib/storage';
import { WalletBalance, Transaction } from '@/lib/types';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const { isAuthenticated } = useAuth();
  const { data: apiBalance, refetch: refetchBalance } = useWalletBalance();
  const { data: apiTransactions, refetch: refetchTransactions } = useWalletTransactions();

  const [balance, setBalance] = useState<WalletBalance>({ amount: 0, lastUpdated: new Date().toISOString() });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [tab, setTab] = useState<'balance' | 'transfer' | 'withdraw' | 'history'>('balance');

  // Sync API balance when available
  useEffect(() => {
    if (apiBalance?.balance !== undefined) {
      setBalance({ amount: apiBalance.balance, lastUpdated: new Date().toISOString() });
    }
  }, [apiBalance]);

  useEffect(() => {
    if (apiTransactions?.data?.length > 0) {
      setTransactions(apiTransactions.data.map((t: any) => ({
        id: t.id,
        type: t.type || 'top_up',
        amount: t.amount,
        description: t.description || '',
        createdAt: t.createdAt,
      })));
    }
  }, [apiTransactions]);

  const loadData = useCallback(async () => {
    if (isAuthenticated && getApiUrl()) {
      refetchBalance();
      refetchTransactions();
    } else {
      const savedBalance = await getWalletBalance();
      const savedTransactions = await getTransactions();
      setBalance(savedBalance);
      setTransactions(savedTransactions);
    }
  }, [isAuthenticated, refetchBalance, refetchTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAddFunds = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to add.');
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newBalance = {
      amount: balance.amount + numAmount,
      lastUpdated: new Date().toISOString()
    };

    const transaction: Transaction = {
      id: generateId(),
      type: 'top_up',
      amount: numAmount,
      description: 'Wallet Top-up via Paystack',
      createdAt: new Date().toISOString()
    };

    await saveWalletBalance(newBalance);
    await addTransaction(transaction);
    
    setBalance(newBalance);
    setTransactions(prev => [transaction, ...prev]);
    setAmount('');
    setIsLoading(false);
    Alert.alert('Success', `Successfully added R${numAmount} to your wallet`);
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to withdraw.');
      return;
    }

    if (withdrawAmount > balance.amount) {
      Alert.alert('Insufficient Funds', 'You do not have enough balance for this withdrawal.');
      return;
    }

    if (!bankName || !accountNumber) {
      Alert.alert('Missing Info', 'Please provide your bank name and account number.');
      return;
    }

    setIsLoading(true);
    // Simulate EFT processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newBalance = {
      amount: balance.amount - withdrawAmount,
      lastUpdated: new Date().toISOString()
    };

    const transaction: Transaction = {
      id: generateId(),
      type: 'fare_payment', // Using existing type for withdrawal simulation
      amount: withdrawAmount,
      description: `Withdrawal to ${bankName} (Acc: ${accountNumber.slice(-4)})`,
      createdAt: new Date().toISOString()
    };

    await saveWalletBalance(newBalance);
    await addTransaction(transaction);

    setBalance(newBalance);
    setTransactions(prev => [transaction, ...prev]);
    setAmount('');
    setBankName('');
    setAccountNumber('');
    setIsLoading(false);
    Alert.alert('Withdrawal Requested', `Your withdrawal of R${withdrawAmount} has been initiated. Funds will reflect in your ${bankName} account within 24-48 hours.`);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'top_up' || item.type === 'refund';
    const color = isIncome ? BrandColors.primary.green : BrandColors.primary.red;

    return (
      <View style={[styles.txItem, { borderBottomColor: theme.border }]}>
        <View style={[styles.txIcon, { backgroundColor: color + '15' }]}>
          <Feather 
            name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} 
            size={16} 
            color={color} 
          />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText style={styles.txDesc}>{item.description}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{new Date(item.createdAt).toLocaleDateString()}</ThemedText>
        </View>
        <ThemedText style={[styles.txAmount, { color }]}>
          {isIncome ? '+' : '-'}R{item.amount.toFixed(2)}
        </ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
        <View style={styles.header}>
          <ThemedText type="h2">Haibo Pay</ThemedText>
          <ThemedText style={{ color: theme.textSecondary }}>Safe and cashless taxi payments</ThemedText>
        </View>

        <View style={[styles.balanceCard, { backgroundColor: BrandColors.primary.blue }]}>
          <ThemedText style={styles.balanceLabel}>Current Balance</ThemedText>
          <ThemedText style={styles.balanceAmount}>R{balance.amount.toFixed(2)}</ThemedText>
          <View style={styles.cardFooter}>
            <Feather name="shield" size={14} color="rgba(255,255,255,0.7)" />
            <ThemedText style={styles.secureText}>Secure Wallet</ThemedText>
          </View>
        </View>

        <View style={styles.tabs}>
          {(['balance', 'withdraw', 'history'] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <ThemedText style={[styles.tabText, tab === t && { color: BrandColors.primary.red, fontWeight: '700' }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.content}>
          {tab === 'balance' && (
            <View style={[styles.actionSection, { backgroundColor: theme.surface }]}>
              <ThemedText type="h4" style={styles.sectionTitle}>Top Up Wallet</ThemedText>
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Amount (R)</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <Button 
                title={isLoading ? "Processing..." : "Add Funds"} 
                onPress={handleAddFunds} 
                loading={isLoading}
                style={{ backgroundColor: BrandColors.primary.green }} 
              />
            </View>
          )}

          {tab === 'withdraw' && (
            <View style={[styles.actionSection, { backgroundColor: theme.surface }]}>
              <ThemedText type="h4" style={styles.sectionTitle}>Withdraw to Bank</ThemedText>
              <ThemedText style={[styles.withdrawInfo, { color: theme.textSecondary }]}>
                Withdraw your earnings directly to your bank account via secure EFT.
              </ThemedText>
              
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Bank Name</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. FNB, Capitec, Nedbank"
                  placeholderTextColor={theme.textSecondary}
                  value={bankName}
                  onChangeText={setBankName}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Account Number</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  placeholder="1234567890"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Amount to Withdraw (R)</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              <Button 
                title={isLoading ? "Initiating EFT..." : "Withdraw Funds"} 
                onPress={handleWithdraw} 
                loading={isLoading}
                style={{ backgroundColor: BrandColors.primary.blue }} 
              />
              
              <View style={[styles.infoBox, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="clock" size={16} color={theme.textSecondary} />
                <ThemedText style={styles.infoText}>EFT withdrawals take 24-48 hours to reflect.</ThemedText>
              </View>
            </View>
          )}

          {tab === 'history' && (
            <View style={styles.historySection}>
              {transactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="clock" size={40} color={theme.textSecondary} opacity={0.5} />
                  <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>No transactions yet</ThemedText>
                </View>
              ) : (
                transactions.map((tx) => renderTransaction({ item: tx }))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.lg },
  balanceCard: { marginHorizontal: Spacing.lg, padding: Spacing.xl, borderRadius: BorderRadius.lg, elevation: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  balanceAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', marginVertical: Spacing.xs },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  secureText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 4 },
  tabs: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.xl, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: BrandColors.primary.red },
  tabText: { fontSize: 14, color: BrandColors.gray[500] },
  content: { padding: Spacing.lg },
  actionSection: { padding: Spacing.lg, borderRadius: BorderRadius.lg, elevation: 2 },
  sectionTitle: { marginBottom: Spacing.md },
  withdrawInfo: { fontSize: 13, marginBottom: Spacing.lg, lineHeight: 18 },
  inputContainer: { marginBottom: Spacing.md },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, opacity: 0.7 },
  input: { height: 50, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 16 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.lg, padding: 12, borderRadius: 8 },
  infoText: { fontSize: 12, opacity: 0.7 },
  historySection: { gap: Spacing.xs },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontWeight: '600' },
  txAmount: { fontWeight: '700', fontSize: 16 },
});
