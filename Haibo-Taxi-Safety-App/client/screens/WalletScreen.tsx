import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
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
import {
  useWalletBalance,
  useWalletTransactions,
  useMyWithdrawals,
  type MyWithdrawalRow,
} from "@/hooks/useApiData";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getWalletBalance, getTransactions } from "@/lib/storage";
import { checkPaystackStatus, runPaystackTopup } from "@/lib/paystack";
import { SA_BANKS, SABank } from "@/constants/saBanks";
import { WalletBalance, Transaction } from "@/lib/types";

// typeui-clean rework — Haibo Pay as a fintech dashboard:
//   1. Rose gradient balance card as the brand centerpiece
//   2. 3-up action grid (Top up / Withdraw / History) instead of tabs
//   3. Inline expanding form for the active action
//   4. Recent activity list with thin income/expense accent borders
//
// Top-up uses the real Paystack hosted-checkout flow via client/lib/paystack.ts
// (server credits the wallet on verify, we just refetch). Withdraw hits the
// real /api/wallet/withdraw with a SA bank picker. When the API is unreachable
// or Paystack isn't configured, a "Demo mode" banner shows and top-up falls
// back to local AsyncStorage so the screen stays demonstrable.

type WalletAction = "topup" | "withdraw" | "history" | null;

export default function WalletScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated, user } = useAuth();
  const { data: apiBalance, refetch: refetchBalance } = useWalletBalance();
  const { data: apiTransactions, refetch: refetchTransactions } = useWalletTransactions();
  const { data: withdrawalsData, refetch: refetchWithdrawals } = useMyWithdrawals();
  const withdrawals: MyWithdrawalRow[] = withdrawalsData?.data || [];
  const [withdrawalsExpanded, setWithdrawalsExpanded] = useState(false);

  const [balance, setBalance] = useState<WalletBalance>({
    amount: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeAction, setActiveAction] = useState<WalletAction>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paystackConfigured, setPaystackConfigured] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [selectedBank, setSelectedBank] = useState<SABank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [amountFocused, setAmountFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
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
      refetchWithdrawals();
    } else {
      const savedBalance = await getWalletBalance();
      const savedTransactions = await getTransactions();
      setBalance(savedBalance);
      setTransactions(savedTransactions);
    }
  }, [isAuthenticated, refetchBalance, refetchTransactions, refetchWithdrawals]);

  const refreshPaystackStatus = useCallback(async () => {
    setPaystackConfigured(await checkPaystackStatus());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshPaystackStatus();
    }, [loadData, refreshPaystackStatus])
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

  const demoMode = !isAuthenticated || !getApiUrl() || !paystackConfigured;

  const handleActionPress = (action: WalletAction) => {
    triggerHaptic("selection");
    setActiveAction(activeAction === action ? null : action);
    if (action !== "withdraw") {
      setSelectedBank(null);
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

    // Demo fallback — no server or Paystack is unavailable. Keep the local
    // AsyncStorage path so the screen stays usable in offline builds.
    if (demoMode) {
      setIsProcessing(true);
      const { saveWalletBalance, addTransaction, generateId } = await import("@/lib/storage");
      const newBalance = {
        amount: balance.amount + numAmount,
        lastUpdated: new Date().toISOString(),
      };
      const transaction: Transaction = {
        id: generateId(),
        type: "top_up",
        amount: numAmount,
        description: "Top-up via Haibo Pay (demo)",
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
      Alert.alert("Top-up complete", `R${numAmount.toFixed(2)} added to your wallet (demo).`);
      return;
    }

    if (!email || !email.includes("@") || !email.includes(".")) {
      triggerHaptic("error");
      Alert.alert("Email required", "Paystack needs a valid email for the receipt.");
      return;
    }

    setIsProcessing(true);
    triggerHaptic("selection");

    const result = await runPaystackTopup({ email, amount: numAmount });

    if (result.status === "success") {
      await loadData();
      setAmount("");
      setActiveAction(null);
      triggerHaptic("success");
      Alert.alert(
        "Top-up complete",
        `R${result.amount.toFixed(2)} has been added to your wallet.`
      );
    } else if (result.status === "cancelled") {
      triggerHaptic("error");
      Alert.alert(
        "Payment not completed",
        "Paystack didn't confirm the payment. If you did pay, it'll show up once the bank confirms."
      );
    } else {
      triggerHaptic("error");
      Alert.alert("Payment failed", result.message);
    }

    setIsProcessing(false);
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
    if (!selectedBank || !accountNumber) {
      triggerHaptic("error");
      Alert.alert(
        "Missing details",
        "Please pick a bank and enter your account number."
      );
      return;
    }

    if (!isAuthenticated || !getApiUrl()) {
      triggerHaptic("error");
      Alert.alert(
        "Sign in to withdraw",
        "Withdrawals need a verified Haibo account. Please sign in with your phone."
      );
      return;
    }

    setIsProcessing(true);

    try {
      await apiRequest("/api/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amount: withdrawAmount,
          bankCode: selectedBank.code,
          accountNumber,
          accountName: user?.displayName || undefined,
          narration: "Haibo wallet withdrawal",
        }),
      });

      await loadData();
      setAmount("");
      setSelectedBank(null);
      setAccountNumber("");
      setActiveAction(null);
      triggerHaptic("success");
      Alert.alert(
        "Withdrawal requested",
        `R${withdrawAmount.toFixed(2)} on its way to ${selectedBank.name}. EFT typically clears in 24–48 hours.`
      );
    } catch (err: any) {
      triggerHaptic("error");
      Alert.alert(
        "Withdrawal failed",
        err?.message || "Could not submit your withdrawal. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
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
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)}>
            <ThemedText style={[styles.eyebrow, { color: theme.textSecondary }]}>
              HAIBO PAY
            </ThemedText>
            <ThemedText style={styles.heroTitle}>Your wallet</ThemedText>
          </Animated.View>
        </View>

        {/* Balance card — rose gradient centerpiece */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(100)}
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
              <Feather name="clock" size={12} color="rgba(255,255,255,0.7)" />
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

        {/* Demo banner — only when server/Paystack isn't reachable */}
        {demoMode ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={[
              styles.demoBanner,
              {
                backgroundColor: BrandColors.status.warning + "15",
                borderColor: BrandColors.status.warning + "40",
              },
            ]}
          >
            <Feather name="info" size={16} color={BrandColors.status.warning} />
            <ThemedText style={[styles.demoBannerText, { color: theme.text }]}>
              Demo mode — top-ups stay local until you sign in and Paystack is configured.
            </ThemedText>
          </Animated.View>
        ) : null}

        {/* Action grid — 3 quick-access pills */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
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

        {/* Haibo Vault vendor entries — one row to pay, one row to sell. */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(250)}
        >
          <Pressable
            onPress={() => navigation.navigate("VendorDirectory")}
            style={({ pressed }) => [
              styles.vendorEntry,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Browse vendors"
          >
            <View
              style={[
                styles.vendorEntryIcon,
                { backgroundColor: BrandColors.status.info + "12" },
              ]}
            >
              <Feather name="credit-card" size={18} color={BrandColors.status.info} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.vendorEntryTitle}>
                Pay a vendor
              </ThemedText>
              <ThemedText
                style={[styles.vendorEntryHint, { color: theme.textSecondary }]}
              >
                Browse verified vendors or enter a HBV code
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("VendorOnboarding")}
            style={({ pressed }) => [
              styles.vendorEntry,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Become a vendor"
          >
            <View
              style={[
                styles.vendorEntryIcon,
                { backgroundColor: BrandColors.primary.gradientStart + "12" },
              ]}
            >
              <Feather
                name="shopping-bag"
                size={18}
                color={BrandColors.primary.gradientStart}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.vendorEntryTitle}>
                Accept payments as a vendor
              </ThemedText>
              <ThemedText
                style={[styles.vendorEntryHint, { color: theme.textSecondary }]}
              >
                Rank vendors, hawkers, and accessory sellers
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Inline expanding form — top-up */}
        {activeAction === "topup" && (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
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

            {!demoMode ? (
              <>
                <BrandLabel>EMAIL (FOR RECEIPT)</BrandLabel>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: emailFocused
                        ? BrandColors.primary.gradientStart
                        : theme.border,
                    },
                  ]}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  editable={!isProcessing}
                />
              </>
            ) : null}

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
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
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

            <BrandLabel>BANK</BrandLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bankChipRow}
            >
              {SA_BANKS.map((bank) => {
                const active = selectedBank?.code === bank.code;
                return (
                  <Pressable
                    key={bank.code}
                    onPress={() => setSelectedBank(bank)}
                    disabled={isProcessing}
                    style={({ pressed }) => [
                      styles.bankChip,
                      {
                        backgroundColor: active
                          ? BrandColors.primary.gradientStart + "18"
                          : theme.backgroundDefault,
                        borderColor: active
                          ? BrandColors.primary.gradientStart
                          : theme.border,
                      },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${bank.name}`}
                    accessibilityState={{ selected: active }}
                  >
                    <ThemedText
                      style={[
                        styles.bankChipText,
                        {
                          color: active
                            ? BrandColors.primary.gradientStart
                            : theme.text,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {bank.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

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
              <Feather name="clock" size={16} color={BrandColors.primary.gradientStart} />
              <ThemedText
                style={[styles.eftInfoText, { color: theme.textSecondary }]}
              >
                EFT withdrawals clear in 24–48 hours.
              </ThemedText>
            </View>

            <View style={styles.formCta}>
              <GradientButton
                onPress={handleWithdraw}
                disabled={isProcessing || !amount || !selectedBank || !accountNumber}
                size="large"
                icon={isProcessing ? undefined : "arrow-right"}
                iconPosition="right"
              >
                {isProcessing ? "Initiating EFT..." : "Withdraw funds"}
              </GradientButton>
            </View>
          </Animated.View>
        )}

        {/* Withdrawals status strip — only renders when the user has
            at least one withdrawal request on file. The endpoint
            (/api/wallet/withdrawals/me) is the canonical source of
            truth for approve/reject decisions that arrive via FCM; if
            a push drops, the user can still pull down to refresh and
            see the current status. Collapsed view shows per-status
            chip counts; expanded view lists each request with its
            bank, amount, timestamp, and rejection reason if any. */}
        {isAuthenticated && withdrawals.length > 0 ? (
          <WithdrawalsStatusStrip
            withdrawals={withdrawals}
            expanded={withdrawalsExpanded}
            onToggle={() => {
              triggerHaptic("selection");
              setWithdrawalsExpanded((e) => !e);
            }}
            theme={theme}
          />
        ) : null}

        {/* Recent activity — always visible, expands on "History" */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(300)}
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
  const reducedMotion = useReducedMotion();
  const isIncome = tx.type === "top_up" || tx.type === "refund";
  const accent = isIncome ? BrandColors.status.success : BrandColors.primary.gradientStart;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(Math.min(index * 30, 200))}
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

// Status-aware pill metadata. "approved" and "processing" both mean
// ops has cleared the EFT but the bank hasn't confirmed receipt yet;
// we group them under a single "approved" chip to keep the summary
// row tight — the expanded list still shows the specific stage.
const WITHDRAWAL_STATUS_META: Record<
  string,
  { label: string; tint: string; icon: keyof typeof Feather.glyphMap }
> = {
  pending: { label: "Pending", tint: BrandColors.status.warning, icon: "clock" },
  approved: { label: "Approved", tint: BrandColors.status.info, icon: "check-circle" },
  processing: { label: "Processing", tint: BrandColors.status.info, icon: "loader" },
  completed: { label: "Completed", tint: BrandColors.status.success, icon: "check-circle" },
  rejected: { label: "Rejected", tint: BrandColors.status.emergency, icon: "x-circle" },
};

function formatWithdrawalTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WithdrawalsStatusStrip({
  withdrawals,
  expanded,
  onToggle,
  theme,
}: {
  withdrawals: MyWithdrawalRow[];
  expanded: boolean;
  onToggle: () => void;
  theme: any;
}) {
  // Count by collapsed status buckets. "approved" absorbs processing
  // so the summary reads as 3 chips max (pending / approved / rejected)
  // rather than 5 — same bucketing the status meta uses for display
  // tint, inverse for the chip count.
  const counts = withdrawals.reduce(
    (acc, w) => {
      if (w.status === "pending") acc.pending += 1;
      else if (w.status === "rejected") acc.rejected += 1;
      else if (w.status === "completed") acc.completed += 1;
      else acc.approved += 1;
      return acc;
    },
    { pending: 0, approved: 0, completed: 0, rejected: 0 },
  );

  return (
    <Animated.View
      entering={FadeInUp.duration(400).delay(250)}
      style={styles.withdrawalsSection}
    >
      <Pressable
        onPress={onToggle}
        style={styles.withdrawalsHeader}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? "Collapse withdrawal status" : "Expand withdrawal status"
        }
      >
        <ThemedText style={styles.activityTitle}>Withdrawals</ThemedText>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>

      <View style={styles.withdrawalChipsRow}>
        {counts.pending > 0 ? (
          <StatusChip
            label={`${counts.pending} pending`}
            tint={BrandColors.status.warning}
          />
        ) : null}
        {counts.approved > 0 ? (
          <StatusChip
            label={`${counts.approved} approved`}
            tint={BrandColors.status.info}
          />
        ) : null}
        {counts.completed > 0 ? (
          <StatusChip
            label={`${counts.completed} completed`}
            tint={BrandColors.status.success}
          />
        ) : null}
        {counts.rejected > 0 ? (
          <StatusChip
            label={`${counts.rejected} rejected`}
            tint={BrandColors.status.emergency}
          />
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.withdrawalsList}>
          {withdrawals.map((w) => {
            const meta =
              WITHDRAWAL_STATUS_META[w.status] ||
              WITHDRAWAL_STATUS_META.pending;
            return (
              <View
                key={w.id}
                style={[
                  styles.withdrawalRow,
                  { borderLeftColor: meta.tint },
                ]}
              >
                <View style={styles.withdrawalRowMain}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText style={styles.withdrawalAmount}>
                      R{Number(w.amount).toFixed(2)}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.withdrawalMeta,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {w.bankCode} · ····{w.accountNumber.slice(-4)} ·{" "}
                      {formatWithdrawalTime(w.requestedAt)}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.withdrawalStatusPill,
                      { backgroundColor: `${meta.tint}18` },
                    ]}
                  >
                    <Feather name={meta.icon} size={11} color={meta.tint} />
                    <ThemedText
                      style={[styles.withdrawalStatusText, { color: meta.tint }]}
                    >
                      {meta.label}
                    </ThemedText>
                  </View>
                </View>
                {w.status === "rejected" && w.rejectionReason ? (
                  <ThemedText
                    style={[
                      styles.withdrawalReason,
                      { color: BrandColors.status.emergency },
                    ]}
                    numberOfLines={2}
                  >
                    {w.rejectionReason}
                  </ThemedText>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Animated.View>
  );
}

function StatusChip({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: `${tint}18` }]}>
      <View style={[styles.statusChipDot, { backgroundColor: tint }]} />
      <ThemedText style={[styles.statusChipText, { color: tint }]}>
        {label}
      </ThemedText>
    </View>
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

  // Vendor entry row (subtle upsell under the action grid)
  vendorEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  vendorEntryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  vendorEntryTitle: {
    ...Typography.body,
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 2,
  },
  vendorEntryHint: {
    ...Typography.small,
    fontSize: 12,
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
  bankChipRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  bankChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    minWidth: 100,
    alignItems: "center",
  },
  bankChipText: {
    ...Typography.small,
    fontWeight: "600",
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

  // Withdrawals strip
  withdrawalsSection: {
    marginTop: Spacing.md,
  },
  withdrawalsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  withdrawalChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  withdrawalsList: {
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  withdrawalRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    borderRadius: BorderRadius.xs,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  withdrawalRowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  withdrawalAmount: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  withdrawalMeta: {
    ...Typography.label,
    fontSize: 11,
    marginTop: 2,
  },
  withdrawalStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  withdrawalStatusText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  withdrawalReason: {
    ...Typography.label,
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
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
