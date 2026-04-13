import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { WalletBalance, Transaction } from "@/lib/types";
import {
  getWalletBalance,
  saveWalletBalance,
  getTransactions,
  addTransaction,
  generateId,
} from "@/lib/storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";

const TOP_UP_AMOUNTS = [50, 100, 200, 500];

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuth();

  const [balance, setBalance] = useState<WalletBalance>({
    amount: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [paystackConfigured, setPaystackConfigured] = useState(false);

  const loadData = useCallback(async () => {
    if (isAuthenticated && getApiUrl()) {
      try {
        const balRes = await apiRequest("/api/wallet/balance");
        setBalance({ amount: balRes.balance || 0, lastUpdated: new Date().toISOString() });
        const txnRes = await apiRequest("/api/wallet/transactions");
        if (txnRes?.data) {
          setTransactions(txnRes.data.map((t: any) => ({
            id: t.id,
            type: t.type || "top_up",
            amount: t.amount,
            description: t.description || "",
            createdAt: t.createdAt,
          })));
        }
      } catch {
        const savedBalance = await getWalletBalance();
        const savedTransactions = await getTransactions();
        setBalance(savedBalance);
        setTransactions(savedTransactions);
      }
    } else {
      const savedBalance = await getWalletBalance();
      const savedTransactions = await getTransactions();
      setBalance(savedBalance);
      setTransactions(savedTransactions);
    }
  }, [isAuthenticated]);

  const checkPaystackStatus = useCallback(async () => {
    try {
      const data = await apiRequest("/api/paystack/status", { method: "GET" });
      setPaystackConfigured(!!data?.configured);
    } catch (error) {
      console.log("Paystack status check failed, using local mode");
      setPaystackConfigured(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkPaystackStatus();
    }, [loadData, checkPaystackStatus])
  );

  const triggerHaptics = async (type: "impact" | "success" | "error") => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        if (type === "impact") {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (type === "success") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch {}
    }
  };

  const handleTopUpPress = (amount: number) => {
    triggerHaptics("impact");
    
    if (paystackConfigured) {
      setSelectedAmount(amount);
      setShowTopUpModal(true);
    } else {
      handleLocalTopUp(amount);
    }
  };

  const handleLocalTopUp = async (amount: number) => {
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newBalance: WalletBalance = {
      amount: balance.amount + amount,
      lastUpdated: new Date().toISOString(),
    };

    const transaction: Transaction = {
      id: generateId(),
      type: "top_up",
      amount: amount,
      description: `Wallet top-up (Demo)`,
      createdAt: new Date().toISOString(),
    };

    await saveWalletBalance(newBalance);
    await addTransaction(transaction);

    setBalance(newBalance);
    setTransactions((prev) => [transaction, ...prev]);
    setIsLoading(false);

    triggerHaptics("success");
    Alert.alert("Success", `R${amount} has been added to your wallet (Demo mode).`);
  };

  const handlePaystackTopUp = async () => {
    if (!email || !selectedAmount) return;

    if (!email.includes("@") || !email.includes(".")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    triggerHaptics("impact");

    try {
      const deviceId = await getDeviceId();
      const response = await apiRequest("/api/paystack/initialize", {
        method: "POST",
        body: JSON.stringify({
          email,
          amount: selectedAmount,
          userId: deviceId,
          purpose: "haibo_wallet_topup",
        }),
      });

      if (response.success && response.authorization_url) {
        setShowTopUpModal(false);
        
        const result = await WebBrowser.openBrowserAsync(response.authorization_url, {
          showTitle: true,
          enableBarCollapsing: true,
        });

        if (result.type === "cancel" || result.type === "dismiss") {
          const verifyResponse = await apiRequest(
            `/api/paystack/verify/${response.reference}`,
            { method: "GET" }
          );

          if (verifyResponse.verified) {
            const newBalance: WalletBalance = {
              amount: balance.amount + selectedAmount,
              lastUpdated: new Date().toISOString(),
            };

            const transaction: Transaction = {
              id: generateId(),
              type: "top_up",
              amount: selectedAmount,
              description: `Wallet top-up via Paystack`,
              createdAt: new Date().toISOString(),
            };

            await saveWalletBalance(newBalance);
            await addTransaction(transaction);

            setBalance(newBalance);
            setTransactions((prev) => [transaction, ...prev]);

            triggerHaptics("success");
            Alert.alert("Success", `R${selectedAmount} has been added to your wallet.`);
          }
        }
      } else {
        throw new Error(response.message || "Failed to initialize payment");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      triggerHaptics("error");
      Alert.alert("Payment Failed", error.message || "Failed to process payment. Please try again.");
    } finally {
      setIsLoading(false);
      setSelectedAmount(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "top_up":
        return "plus-circle";
      case "fare_payment":
        return "minus-circle";
      case "refund":
        return "rotate-ccw";
      default:
        return "circle";
    }
  };

  const getTransactionColor = (type: Transaction["type"]) => {
    switch (type) {
      case "top_up":
        return BrandColors.primary.green;
      case "fare_payment":
        return BrandColors.primary.red;
      case "refund":
        return BrandColors.primary.blue;
      default:
        return theme.textSecondary;
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={[styles.transactionCard, { backgroundColor: theme.backgroundDefault }]}>
      <View
        style={[
          styles.transactionIcon,
          { backgroundColor: getTransactionColor(item.type) + "15" },
        ]}
      >
        <Feather
          name={getTransactionIcon(item.type) as any}
          size={18}
          color={getTransactionColor(item.type)}
        />
      </View>
      <View style={styles.transactionInfo}>
        <ThemedText style={styles.transactionDesc}>{item.description}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formatDate(item.createdAt)}
        </ThemedText>
      </View>
      <ThemedText
        style={[
          styles.transactionAmount,
          {
            color:
              item.type === "fare_payment"
                ? BrandColors.primary.red
                : BrandColors.primary.green,
          },
        ]}
      >
        {item.type === "fare_payment" ? "-" : "+"}R{item.amount}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.balanceSection}>
        <View style={[styles.balanceCard, { backgroundColor: BrandColors.primary.blue }]}>
          <View style={styles.balanceHeader}>
            <Feather name="credit-card" size={24} color="#FFFFFF" />
            <ThemedText style={styles.balanceLabel}>Haibo Pay Balance</ThemedText>
          </View>
          <ThemedText style={styles.balanceAmount}>R{balance.amount.toFixed(2)}</ThemedText>
          <ThemedText style={styles.balanceUpdated}>
            Last updated: {formatDate(balance.lastUpdated)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.topUpSection}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Quick Top-Up</ThemedText>
          {!paystackConfigured ? (
            <View style={styles.demoBadge}>
              <ThemedText style={styles.demoBadgeText}>Demo Mode</ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.topUpGrid}>
          {TOP_UP_AMOUNTS.map((amount) => (
            <Pressable
              key={amount}
              style={[styles.topUpButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => handleTopUpPress(amount)}
              disabled={isLoading}
            >
              <ThemedText style={styles.topUpAmount}>R{amount}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.transactionsSection}>
        <ThemedText style={styles.sectionTitle}>Recent Transactions</ThemedText>
        {transactions.length > 0 ? (
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.transactionsList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyTransactions}>
            <Feather name="list" size={40} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No transactions yet
            </ThemedText>
          </View>
        )}
      </View>

      <Modal
        visible={showTopUpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopUpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Top-Up Wallet</ThemedText>
              <Pressable onPress={() => setShowTopUpModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            <ThemedText style={styles.modalLabel}>
              You are adding R{selectedAmount} to your wallet.
            </ThemedText>
            
            <TextInput
              style={[
                styles.emailInput,
                { 
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border
                }
              ]}
              placeholder="Enter your email"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Button
              title={isLoading ? "Initializing..." : `Pay R${selectedAmount}`}
              onPress={handlePaystackTopUp}
              disabled={isLoading || !email}
              style={styles.payButton}
            />
            
            <ThemedText type="small" style={styles.secureText}>
              <Feather name="lock" size={12} /> Secure payment via Paystack
            </ThemedText>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balanceSection: {
    padding: Spacing.lg,
  },
  balanceCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  balanceLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "600",
  },
  balanceAmount: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: Spacing.sm,
  },
  balanceUpdated: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  topUpSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  demoBadge: {
    backgroundColor: BrandColors.secondary.orange + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  demoBadgeText: {
    color: BrandColors.secondary.orange,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  topUpGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  topUpButton: {
    flex: 1,
    height: 60,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  topUpAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  transactionsSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  transactionsList: {
    paddingBottom: Spacing.xl,
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 15,
    fontWeight: "600",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyTransactions: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: Spacing.xl,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  emailInput: {
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  payButton: {
    marginBottom: Spacing.md,
  },
  secureText: {
    textAlign: "center",
    opacity: 0.6,
  },
});
