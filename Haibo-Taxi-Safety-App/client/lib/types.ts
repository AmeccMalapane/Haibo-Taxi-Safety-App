export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  userType: "commuter" | "driver" | "operator";
  avatarType: number;
  isVerified: boolean;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface TaxiRoute {
  id: string;
  routeNumber?: string;
  origin: string;
  destination: string;
  fare: number | null;
  handSignal?: string;
  handSignalDescription?: string;
  region: string;
  estimatedTime: string;
  originCoords?: Coords;
  destinationCoords?: Coords;
  routeCoords?: Coords[];
  routeType?: "local" | "regional" | "intercity";
  frequency?: string;
  association?: string;
  province?: string;
  safetyScore?: number;
  riskLevel?: string;
  googleMapsLink?: string;
  distance?: number | null;
}

export interface TaxiAssociation {
  id: number;
  name: string;
  contactInfo: string;
  operatingAreas: string[];
  description: string;
  location: string;
  verificationStatus: string;
}

export interface TaxiRank {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  routes: string[];
}

export interface TaxiStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeIds: string[];
}

export type LocationType = "rank" | "formal_stop" | "informal_stop" | "landmark" | "interchange";
export type VerificationStatus = "pending" | "verified" | "rejected" | "needs_review";

export interface TaxiLocation {
  id: string;
  name: string;
  type: LocationType;
  latitude: number;
  longitude: number;
  address?: string;
  description?: string;
  capacity?: number;
  opensAt?: string;
  closesAt?: string;
  operatingDays?: string[];
  addedBy?: string;
  addedDate?: string;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  upvotes: number;
  downvotes: number;
  isActive: boolean;
  routes?: string[];
  lastUpdated?: string;
  images?: LocationImage[];
  handSignals?: HandSignal[];
}

export interface LocationImage {
  id: string;
  locationId: string;
  url: string;
  caption?: string;
  imageType: "entrance" | "sign" | "queue" | "hand_signal" | "general";
  uploadedBy?: string;
  uploadedDate?: string;
  verified: boolean;
}

export interface HandSignal {
  id: string;
  locationId?: string;
  destination: string;
  signal: string;
  description?: string;
  imageUrl?: string;
  region?: string;
}

export interface NewLocationData {
  name: string;
  type: LocationType;
  latitude: number;
  longitude: number;
  address?: string;
  description?: string;
  capacity?: number;
  opensAt?: string;
  closesAt?: string;
  operatingDays?: string[];
}

export interface LocationReview {
  id: string;
  locationId: string;
  deviceId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userType: "commuter" | "driver" | "operator";
  avatarType: number;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likes: number;
  comments: number;
  isLiked: boolean;
}

export interface MediaEvidence {
  id: string;
  type: "photo" | "video" | "audio";
  uri: string;
  thumbnailUri?: string;
  duration?: number;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  caption?: string;
  size?: number;
}

export interface ReportLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  speed?: number;
}

export interface Report {
  id: string;
  issueType: "reckless_driving" | "overcrowding" | "rude_driver" | "vehicle_condition" | "overcharging" | "harassment" | "accident" | "theft" | "other";
  severity?: "low" | "medium" | "high" | "critical";
  vehicleRegistration?: string;
  vehicleDetails?: {
    color?: string;
    make?: string;
    model?: string;
    association?: string;
  };
  routeId?: string;
  description: string;
  evidence?: MediaEvidence[];
  location?: ReportLocation;
  locationHistory?: ReportLocation[];
  isLive?: boolean;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  status: "draft" | "pending" | "reviewed" | "resolved";
}

export interface TripShare {
  id: string;
  isActive: boolean;
  startTime: string;
  routeId?: string;
  sharedWithContactIds: string[];
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface WalletBalance {
  amount: number;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  type: "top_up" | "fare_payment" | "refund";
  amount: number;
  description: string;
  createdAt: string;
}

export type IncidentType = "accident" | "construction" | "hazard" | "congestion" | "police" | "other";

export interface TrafficIncident {
  id: string;
  type: IncidentType;
  latitude: number;
  longitude: number;
  description: string;
  reportedAt: string;
  severity: "low" | "medium" | "high" | "critical";
}
