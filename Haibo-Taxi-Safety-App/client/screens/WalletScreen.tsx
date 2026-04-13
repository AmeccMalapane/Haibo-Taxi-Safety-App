import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { useWalletBalance, useWalletTransactions } from "@/hooks/useApiData";
import { getApiUrl } from "@/lib/query-client";
import {
  getWalletBalance,
  saveWalletBalance,
  getTransactions,
  addTransaction,
  generateId,
} from "@/lib/storage";
import { WalletBalance, Transaction } from "@/lib/types";

// typeui-clean rework — Haibo Pay as a fintech dashboard:
//   1. Rose gradient balance card as the brand centerpiece
//   2. 3-up action grid (Top up / Withdraw / History) instead of tabs
//   3. Inline expanding form for the active action
//   4. Recent activity list with thin income/expense accent borders
//
// Also surfaces the demo state honestly: top-up + withdraw don't yet hit
// the real /api/wallet/topup or /api/wallet/withdraw endpoints — those
// require Paystack hosted-checkout flow + bank-code picker. The simulation
// is locally consistent and uses AsyncStorage so the demo feels real, but
// a "Demo mode" banner makes the limitation visible.

type WalletAction = "topup" | "withdraw" | "history" | null;

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { data: apiBalance, refetch: refetchBalance } = useWalletBalance();
  const { data: apiTransactions, refetch: refetchTransactions } = useWalletTransactions();

  const [balance, setBalance] = useState<WalletBalance>({
    amount: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeAction, setActiveAction] = useState<WalletAction>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amountFocused, setAmountFocused] = useState(false);
  const [bankFocused, setBankFocused] = useState(false);
  const [accountFocused, setAccountFocused] = useState(false);

  useEffect(() => {
    if (apiBalance?.balance !== undefined) {
      setBalance({
        amount: apiBalance.balance,
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [apiBalance]);

  useEffect(() => {
    if (apiTransactions?.data?.length > 0) {
      setTransactions(
        apiTransactions.data.map((t: any) => ({
          id: t.id,
          type: t.type || "top_up",
          amount: t.amount,
          description: t.description || "",
          createdAt: t.createdAt,
        }))
      );
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

  const triggerHaptic = (
    type: "selection" | "success" | "error" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = require("expo-haptics");
      if (type === "selection") Haptics.selectionAsync();
      if (type === "success")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (type === "error")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  };

  const handleActionPress = (action: WalletAction) => {
    triggerHaptic("selection");
    setActiveAction(activeAction === action ? null : action);
    if (action !== "withdraw") {
      setBankName("");
      setAccountNumber("");
    }
    setAmount("");
  };

  const handleAddFunds = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      triggerHaptic("error");
      Alert.alert("Invalid amount", "Please enter a valid amount to top up.");
      return;
    }

    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const newBalance = {
      amount: balance.amount + numAmount,
      lastUpdated: new Date().toISOString(),
    };

    const transaction: Transaction = {
      id: generateId(),
      type: "top_up",
      amount: numAmount,
      description: `Top-up via Haibo Pay (demo)`,
      createdAt: new Date().toISOString(),
    };

    await saveWalletBalance(newBalance);
    await addTransaction(transaction);

    setBalance(newBalance);
    setTransactions((prev) => [transaction, ...prev]);
    setAmount("");
    setIsProcessing(false);
    setActiveAction(null);
    triggerHaptic("success");
    Alert.alert("Top-up complete", `R${numAmount.toFixed(2)} added to your wallet.`);
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      triggerHaptic("error");
      Alert.alert("Invalid amount", "Please enter a valid amount to withdraw.");
      return;
    }
    if (withdrawAmount > balance.amount) {
      triggerHaptic("error");
      Alert.alert(
        "Insufficient funds",
        "Your wallet doesn't have enough for this withdrawal."
      );
      return;
    }
    if (!bankName || !accountNumber) {
      triggerHaptic("error");
      Alert.alert(
        "Missing details",
        "Please enter your bank name and account number."
      );
      return;
    }

    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newBalance = {
      amount: balance.amount - withdrawAmount,
      lastUpdated: new Date().toISOString(),
    };

    const transaction: Transaction = {
      id: generateId(),
      type: "fare_payment",
      amount: withdrawAmount,
      description: `Withdrawal to ${bankName} (•••${accountNumber.slice(-4)})`,
      createdAt: new Date().toISOString(),
    };

    await saveWalletBalance(newBalance);
    await addTransaction(transaction);

    setBalance(newBalance);
    setTransactions((prev) => [transaction, ...prev]);
    setAmount("");
    setBankName("");
    setAccountNumber("");
    setIsProcessing(false);
    setActiveAction(null);
    triggerHaptic("success");
    Alert.alert(
      "Withdrawal requested",
      `R${withdrawAmount.toFixed(2)} on its way to ${bankName}. EFT typically clears in 24–48 hours.`
    );
  };

  const recentTransactions = transactions.slice(0, 8);

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        {/* Hero — Haibo Pay header + brand badge */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + Spacing.lg }]}>
          <Animated.View entering={FadeIn.duration(400)}>
            <ThemedText style={[styles.eyebrow, { color: theme.textSecondary }]}>
              HAIBO PAY
            </ThemedText>
            <ThemedText style={styles.heroTitle}>Your wallet</ThemedText>
          </Animated.View>
        </View>

        {/* Balance card — rose gradient centerpiece */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          style={styles.balanceCardWrap}
        >
          <LinearGradient
            colors={BrandColors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceTopRow}>
              <View style={styles.secureBadge}>
                <Feather name="shield" size={12} color="#FFFFFF" />
                <ThemedText style={styles.secureBadgeText}>SECURE</ThemedText>
              </View>
              <Feather name="more-horizontal" size={20} color="rgba(255,255,255,0.7)" />
            </View>

            <ThemedText style={styles.balanceLabel}>Available balance</ThemedText>
            <View style={styles.balanceAmountRow}>
              <ThemedText style={styles.balanceCurrency}>R</ThemedText>
              <ThemedText style={styles.balanceAmount}>
                {balance.amount.toFixed(2)}
              </ThemedText>
            </View>

            <View style={styles.balanceFooter}>
              <Feather name="clock" size={11} color="rgba(255,255,255,0.7)" />
              <ThemedText style={styles.balanceFooterText}>
                Updated {new Date(balance.lastUpdated).toLocaleString("en-ZA", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                })}
              </ThemedText>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Demo banner — honest about Paystack not being wired */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(150)}
          style={[
            styles.demoBanner,
            {
              backgroundColor: BrandColors.status.warning + "15",
              borderColor: BrandColors.status.warning + "40",
            },
          ]}
        >
          <Feather name="info" size={14} color={BrandColors.status.warning} />
          <ThemedText style={[styles.demoBannerText, { color: theme.text }]}>
            Demo mode — Paystack checkout coming soon
          </ThemedText>
        </Animated.View>

        {/* Action grid — 3 quick-access pills */}
        <Animated.View
          entering={FadeInUp.duration(500).delay(200)}
          style={styles.actionGrid}
        >
          <ActionTile
            icon="plus-circle"
            label="Top up"
            active={activeAction === "topup"}
            onPress={() => handleActionPress("topup")}
            theme={theme}
          />
          <ActionTile
            icon="upload-cloud"
            label="Withdraw"
            active={activeAction === "withdraw"}
            onPress={() => handleActionPress("withdraw")}
            theme={theme}
          />
          <ActionTile
            icon="list"
            label="History"
            active={activeAction === "history"}
            onPress={() => handleActionPress("history")}
            theme={theme}
          />
        </Animated.View>

        {/* Inline expanding form — top-up */}
        {activeAction === "topup" && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[
              styles.formCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <ThemedText style={styles.formTitle}>Top up your wallet</ThemedText>
            <ThemedText
              style={[styles.formHint, { color: theme.textSecondary }]}
            >
              Add funds to pay for fares cashlessly across Mzansi.
            </ThemedText>

            <BrandLabel>AMOUNT (R)</BrandLabel>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: amountFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              editable={!isProcessing}
            />

            <View style={styles.quickAmounts}>
              {[50, 100, 200, 500].map((quick) => (
                <Pressable
                  key={quick}
                  onPress={() => setAmount(String(quick))}
                  disabled={isProcessing}
                  style={({ pressed }) => [
                    styles.quickAmountChip,
                    {
                      backgroundColor:
                        amount === String(quick)
                          ? BrandColors.primary.gradientStart + "18"
                          : theme.backgroundDefault,
                      borderColor:
                        amount === String(quick)
                          ? BrandColors.primary.gradientStart
                          : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.quickAmountText,
                      {
                        color:
                          amount === String(quick)
                            ? BrandColors.primary.gradientStart
                            : theme.text,
                      },
                    ]}
                  >
                    R{quick}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.formCta}>
              <GradientButton
                onPress={handleAddFunds}
                disabled={isProcessing || !amount}
                size="large"
                icon={isProcessing ? undefined : "arrow-right"}
                iconPosition="right"
              >
                {isProcessing ? "Processing..." : "Add funds"}
              </GradientButton>
            </View>
          </Animated.View>
        )}

        {/* Inline expanding form — withdraw */}
        {activeAction === "withdraw" && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[
              styles.formCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <ThemedText style={styles.formTitle}>Withdraw to bank</ThemedText>
            <ThemedText
              style={[styles.formHint, { color: theme.textSecondary }]}
            >
              Send your earnings to your South African bank account via EFT.
            </ThemedText>

            <BrandLabel>BANK NAME</BrandLabel>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: bankFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder="FNB, Capitec, Nedbank, Absa..."
              placeholderTextColor={theme.textSecondary}
              value={bankName}
              onChangeText={setBankName}
              onFocus={() => setBankFocused(true)}
              onBlur={() => setBankFocused(false)}
              editable={!isProcessing}
            />

            <BrandLabel>ACCOUNT NUMBER</BrandLabel>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: accountFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder="1234567890"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={accountNumber}
              onChangeText={setAccountNumber}
              onFocus={() => setAccountFocused(true)}
              onBlur={() => setAccountFocused(false)}
              editable={!isProcessing}
            />

            <BrandLabel>AMOUNT (R)</BrandLabel>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: amountFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              editable={!isProcessing}
            />

            <View
              style={[
                styles.eftInfo,
                {
                  backgroundColor: BrandColors.primary.gradientStart + "08",
                  borderColor: BrandColors.primary.gradientStart + "20",
                },
              ]}
            >
              <Feather name="clock" size={14} color={BrandColors.primary.gradientStart} />
              <ThemedText
                style={[styles.eftInfoText, { color: theme.textSecondary }]}
              >
                EFT withdrawals clear in 24–48 hours.
              </ThemedText>
            </View>

            <View style={styles.formCta}>
              <GradientButton
                onPress={handleWithdraw}
                disabled={isProcessing || !amount || !bankName || !accountNumber}
                size="large"
                icon={isProcessing ? undefined : "arrow-right"}
                iconPosition="right"
              >
                {isProcessing ? "Initiating EFT..." : "Withdraw funds"}
              </GradientButton>
            </View>
          </Animated.View>
        )}

        {/* Recent activity — always visible, expands on "History" */}
        <Animated.View
          entering={FadeInUp.duration(500).delay(300)}
          style={styles.activitySection}
        >
          <View style={styles.activityHeader}>
            <ThemedText style={styles.activityTitle}>Recent activity</ThemedText>
            {transactions.length > 8 && activeAction !== "history" ? (
              <Pressable
                onPress={() => handleActionPress("history")}
                hitSlop={8}
              >
                <ThemedText
                  style={[
                    styles.seeAllText,
                    { color: BrandColors.primary.gradientStart },
                  ]}
                >
                  See all
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {(activeAction === "history" ? transactions : recentTransactions).length === 0 ? (
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: BrandColors.primary.gradientStart + "10" },
                ]}
              >
                <Feather
                  name="inbox"
                  size={22}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>No activity yet</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Your top-ups, payments and withdrawals will show up here.
              </ThemedText>
            </View>
          ) : (
            (activeAction === "history" ? transactions : recentTransactions).map(
              (tx, index) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  index={index}
                  theme={theme}
                />
              )
            )
          )}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActionTile({
  icon,
  label,
  active,
  onPress,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  theme: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        {
          backgroundColor: active
            ? BrandColors.primary.gradientStart + "12"
            : theme.surface,
          borderColor: active
            ? BrandColors.primary.gradientStart
            : theme.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View
        style={[
          styles.actionIcon,
          {
            backgroundColor: active
              ? BrandColors.primary.gradientStart
              : BrandColors.primary.gradientStart + "12",
          },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={active ? "#FFFFFF" : BrandColors.primary.gradientStart}
        />
      </View>
      <ThemedText
        style={[
          styles.actionLabel,
          {
            color: active ? BrandColors.primary.gradientStart : theme.text,
          },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function BrandLabel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
      {children}
    </ThemedText>
  );
}

function TransactionRow({
  tx,
  index,
  theme,
}: {
  tx: Transaction;
  index: number;
  theme: any;
}) {
  const isIncome = tx.type === "top_up" || tx.type === "refund";
  const accent = isIncome ? BrandColors.status.success : BrandColors.primary.gradientStart;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(Math.min(index * 30, 200))}
    >
      <View
        style={[
          styles.txItem,
          {
            backgroundColor: theme.surface,
            borderLeftColor: accent,
          },
        ]}
      >
        <View
          style={[
            styles.txIcon,
            { backgroundColor: accent + "12" },
          ]}
        >
          <Feather
            name={isIncome ? "arrow-down-left" : "arrow-up-right"}
            size={16}
            color={accent}
          />
        </View>
        <View style={styles.txInfo}>
          <ThemedText style={styles.txDesc} numberOfLines={1}>
            {tx.description}
          </ThemedText>
          <ThemedText
            style={[styles.txDate, { color: theme.textSecondary }]}
          >
            {new Date(tx.createdAt).toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </ThemedText>
        </View>
        <ThemedText style={[styles.txAmount, { color: accent }]}>
          {isIncome ? "+" : "−"}R{tx.amount.toFixed(2)}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  heroHeader: {
    paddingBottom: Spacing.lg,
  },
  eyebrow: {
    ...Typography.label,
    letterSpacing: 1.6,
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    ...Typography.h1,
  },

  // Balance card
  balanceCardWrap: {
    marginBottom: Spacing.md,
  },
  balanceCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  balanceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  secureBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
  },
  balanceLabel: {
    ...Typography.small,
    color: "rgba(255,255,255,0.85)",
    marginBottom: Spacing.xs,
  },
  balanceAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  balanceCurrency: {
    ...Typography.h3,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  balanceAmount: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  balanceFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.md,
  },
  balanceFooterText: {
    ...Typography.small,
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
  },

  // Demo banner
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  demoBannerText: {
    ...Typography.small,
    fontSize: 12,
    flex: 1,
  },

  // Action grid
  actionGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionTile: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    ...Typography.small,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  // Form card (inline)
  formCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  formTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  formHint: {
    ...Typography.small,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  quickAmounts: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  quickAmountChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  quickAmountText: {
    ...Typography.small,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  eftInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  eftInfoText: {
    ...Typography.small,
    fontSize: 12,
    flex: 1,
  },
  formCta: {
    marginTop: Spacing.lg,
  },

  // Activity section
  activitySection: {
    marginTop: Spacing.md,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    paddingHorizontal: 2,
  },
  activityTitle: {
    ...Typography.h4,
  },
  seeAllText: {
    ...Typography.small,
    fontWeight: "700",
  },

  // Transaction row
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.md,
    borderLeftWidth: 3,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    ...Typography.body,
    fontWeight: "600",
  },
  txDate: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    ...Typography.body,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 260,
  },
});
