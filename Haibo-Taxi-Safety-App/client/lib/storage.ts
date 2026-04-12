import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EmergencyContact,
  UserProfile,
  CommunityPost,
  Report,
  TripShare,
  WalletBalance,
  Transaction,
  MediaEvidence,
} from "./types";

const STORAGE_KEYS = {
  USER_PROFILE: "haibo_user_profile",
  EMERGENCY_CONTACTS: "haibo_emergency_contacts",
  COMMUNITY_POSTS: "haibo_community_posts",
  REPORTS: "haibo_reports",
  ACTIVE_TRIP: "haibo_active_trip",
  WALLET_BALANCE: "haibo_wallet_balance",
  TRANSACTIONS: "haibo_transactions",
  LIKED_POSTS: "haibo_liked_posts",
  DRAFT_REPORT: "haibo_draft_report",
  PENDING_EVIDENCE: "haibo_pending_evidence",
};

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
}

export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_CONTACTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS, JSON.stringify(contacts));
}

export async function addEmergencyContact(contact: EmergencyContact): Promise<void> {
  const contacts = await getEmergencyContacts();
  contacts.push(contact);
  await saveEmergencyContacts(contacts);
}

export async function removeEmergencyContact(contactId: string): Promise<void> {
  const contacts = await getEmergencyContacts();
  const updated = contacts.filter((c) => c.id !== contactId);
  await saveEmergencyContacts(updated);
}

export async function getCommunityPosts(): Promise<CommunityPost[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.COMMUNITY_POSTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveCommunityPosts(posts: CommunityPost[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.COMMUNITY_POSTS, JSON.stringify(posts));
}

export async function addCommunityPost(post: CommunityPost): Promise<void> {
  const posts = await getCommunityPosts();
  posts.unshift(post);
  await saveCommunityPosts(posts);
}

export async function getLikedPosts(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_POSTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function toggleLikePost(postId: string): Promise<boolean> {
  const likedPosts = await getLikedPosts();
  const isLiked = likedPosts.includes(postId);
  
  if (isLiked) {
    const updated = likedPosts.filter((id) => id !== postId);
    await AsyncStorage.setItem(STORAGE_KEYS.LIKED_POSTS, JSON.stringify(updated));
    return false;
  } else {
    likedPosts.push(postId);
    await AsyncStorage.setItem(STORAGE_KEYS.LIKED_POSTS, JSON.stringify(likedPosts));
    return true;
  }
}

export async function getReports(): Promise<Report[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.REPORTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveReport(report: Report): Promise<void> {
  const reports = await getReports();
  reports.unshift(report);
  await AsyncStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
}

export async function getActiveTrip(): Promise<TripShare | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TRIP);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveActiveTrip(trip: TripShare | null): Promise<void> {
  if (trip) {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TRIP, JSON.stringify(trip));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_TRIP);
  }
}

export async function getWalletBalance(): Promise<WalletBalance> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WALLET_BALANCE);
    return data ? JSON.parse(data) : { amount: 0, lastUpdated: new Date().toISOString() };
  } catch {
    return { amount: 0, lastUpdated: new Date().toISOString() };
  }
}

export async function saveWalletBalance(balance: WalletBalance): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.WALLET_BALANCE, JSON.stringify(balance));
}

export async function getTransactions(): Promise<Transaction[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addTransaction(transaction: Transaction): Promise<void> {
  const transactions = await getTransactions();
  transactions.unshift(transaction);
  await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}

export async function getDraftReport(): Promise<Partial<Report> | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_REPORT);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveDraftReport(report: Partial<Report>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.DRAFT_REPORT, JSON.stringify(report));
}

export async function clearDraftReport(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT);
}

export async function getPendingEvidence(): Promise<MediaEvidence[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_EVIDENCE);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addPendingEvidence(evidence: MediaEvidence): Promise<void> {
  const items = await getPendingEvidence();
  items.push(evidence);
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_EVIDENCE, JSON.stringify(items));
}

export async function removePendingEvidence(evidenceId: string): Promise<void> {
  const items = await getPendingEvidence();
  const updated = items.filter((e) => e.id !== evidenceId);
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_EVIDENCE, JSON.stringify(updated));
}

export async function clearPendingEvidence(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EVIDENCE);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateReportId(): string {
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `INC-${year}-${sequence}`;
}
