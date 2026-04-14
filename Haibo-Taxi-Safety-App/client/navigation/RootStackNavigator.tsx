import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import EmergencyScreen from "@/screens/EmergencyScreen";
import TripShareScreen from "@/screens/TripShareScreen";
import ReportScreen from "@/screens/ReportScreen";
import EmergencyContactsScreen from "@/screens/EmergencyContactsScreen";
import EmergencyServicesScreen from "@/screens/EmergencyServicesScreen";
import AddLocationScreen from "@/screens/AddLocationScreen";
import LocationDetailsScreen from "@/screens/LocationDetailsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import ContributeRouteScreen from "@/screens/ContributeRouteScreen";
import MenuScreen from "@/screens/MenuScreen";
import HubScreen from "@/screens/HubScreen";
import SendPackageScreen from "@/screens/SendPackageScreen";
import TrackPackageScreen from "@/screens/TrackPackageScreen";
import PackageHistoryScreen from "@/screens/PackageHistoryScreen";
import OTPVerificationScreen from "@/screens/OTPVerificationScreen";
import ProfileSetupScreen from "@/screens/ProfileSetupScreen";
import LostFoundScreen from "@/screens/LostFoundScreen";
import PostLostFoundScreen from "@/screens/PostLostFoundScreen";
import LostFoundDetailsScreen from "@/screens/LostFoundDetailsScreen";
import HaiboFamScreen from "@/screens/HaiboFamScreen";
import QAForumScreen from "@/screens/QAForumScreen";
import GroupRidesScreen from "@/screens/GroupRidesScreen";
import CreateReelScreen from "@/screens/CreateReelScreen";
import ReferralScreen from "@/screens/ReferralScreen";
import JobsScreen from "@/screens/JobsScreen";
import EventsScreen from "@/screens/EventsScreen";
import CityExplorerScreen from "@/screens/CityExplorerScreen";
import SafetyDirectoryScreen from "@/screens/SafetyDirectoryScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import RatingScreen from "@/screens/RatingScreen";
import RouteDetailScreen from "@/screens/RouteDetailScreen";
import WalletScreen from "@/screens/WalletScreen";
import AuthScreen from "@/screens/AuthScreen";
import RouteDrawingScreen from "@/screens/RouteDrawingScreen";
import RouteSubmissionScreen from "@/screens/RouteSubmissionScreen";
import CommunityRoutesScreen from "@/screens/CommunityRoutesScreen";
import CommunityRouteDetailScreen from "@/screens/CommunityRouteDetailScreen";
import ContributorProfileScreen from "@/screens/ContributorProfileScreen";
import CommunityScreen from "@/screens/CommunityScreen";
import PushaScreen from "@/screens/PushaScreen";
import TaxiFareScreen from "@/screens/TaxiFareScreen";
import DriverDashboardScreen from "@/screens/DriverDashboardScreen";
import DriverOnboardingScreen from "@/screens/DriverOnboardingScreen";
import VendorOnboardingScreen from "@/screens/VendorOnboardingScreen";
import PayVendorScreen from "@/screens/PayVendorScreen";
import PasopFeedScreen from "@/screens/PasopFeedScreen";
import PasopReportScreen from "@/screens/PasopReportScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";

export type RootStackParamList = {
  Auth: undefined;
  OTPVerification: { phone: string };
  ProfileSetup: undefined;
  MainTabs: undefined;
  Main: undefined;
  Emergency: undefined;
  TripShare: undefined;
  Report: undefined;
  EmergencyContacts: undefined;
  EmergencyServices: undefined;
  AddLocation: { latitude?: number; longitude?: number } | undefined;
  LocationDetails: { locationId: string };
  Profile: undefined;
  ContributeRoute: undefined;
  Menu: undefined;
  Hub: undefined;
  SendPackage: undefined;
  TrackPackage: undefined;
  PackageHistory: undefined;
  LostFound: undefined;
  PostLostFound: undefined;
  LostFoundDetails: { itemId: string };
  HaiboFam: undefined;
  QAForum: undefined;
  GroupRides: undefined;
  CreateReel: undefined;
  Referral: undefined;
  Jobs: undefined;
  Events: undefined;
  CityExplorer: undefined;
  SafetyDirectory: undefined;
  Settings: undefined;
  Rating: undefined;
  RouteDetail: { routeId: string };
  Wallet: undefined;
  RouteDrawing: undefined;
  RouteSubmission: { waypoints: any[]; color: string };
  CommunityRoutes: undefined;
  CommunityRouteDetail: { routeId: string };
  ContributorProfile: undefined;
  Community: undefined;
  Pusha: undefined;
  TaxiFare: undefined;
  DriverDashboard: undefined;
  DriverOnboarding: undefined;
  VendorOnboarding: undefined;
  PayVendor: { vendorRef?: string } | undefined;
  PasopFeed: undefined;
  PasopReport: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });
  const { isAuthenticated, isGuest } = useAuth();

  const initialRoute = (isAuthenticated || isGuest) ? "Main" : "Auth";

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OTPVerification"
        component={OTPVerificationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Emergency"
        component={EmergencyScreen}
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TripShare"
        component={TripShareScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Report"
        component={ReportScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EmergencyContacts"
        component={EmergencyContactsScreen}
        options={{
          presentation: "card",
          headerTitle: "Emergency Contacts",
        }}
      />
      <Stack.Screen
        name="EmergencyServices"
        component={EmergencyServicesScreen}
        options={{
          presentation: "card",
          headerTitle: "Emergency Services",
        }}
      />
      <Stack.Screen
        name="AddLocation"
        component={AddLocationScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="LocationDetails"
        component={LocationDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          presentation: "card",
          headerTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="ContributeRoute"
        component={ContributeRouteScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          presentation: "card",
          headerTitle: "Menu",
        }}
      />
      <Stack.Screen
        name="Hub"
        component={HubScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SendPackage"
        component={SendPackageScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TrackPackage"
        component={TrackPackageScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PackageHistory"
        component={PackageHistoryScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="LostFound"
        component={LostFoundScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PostLostFound"
        component={PostLostFoundScreen}
        options={{
          presentation: "modal",
          headerTitle: "Report Item",
        }}
      />
      <Stack.Screen
        name="LostFoundDetails"
        component={LostFoundDetailsScreen}
        options={{
          presentation: "card",
          headerTitle: "Item Details",
        }}
      />
      <Stack.Screen
        name="HaiboFam"
        component={HaiboFamScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QAForum"
        component={QAForumScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="GroupRides"
        component={GroupRidesScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CreateReel"
        component={CreateReelScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{
          presentation: "card",
          headerTitle: "Refer Friends",
        }}
      />
      <Stack.Screen
        name="Jobs"
        component={JobsScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Events"
        component={EventsScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CityExplorer"
        component={CityExplorerScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SafetyDirectory"
        component={SafetyDirectoryScreen}
        options={{
          presentation: "card",
          headerTitle: "Safety Directory",
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: "card",
          headerTitle: "Settings",
        }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RouteDetail"
        component={RouteDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          presentation: "card",
          headerTitle: "Wallet",
        }}
      />
      <Stack.Screen
        name="RouteDrawing"
        component={RouteDrawingScreen}
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RouteSubmission"
        component={RouteSubmissionScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CommunityRoutes"
        component={CommunityRoutesScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CommunityRouteDetail"
        component={CommunityRouteDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ContributorProfile"
        component={ContributorProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Pusha"
        component={PushaScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TaxiFare"
        component={TaxiFareScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DriverDashboard"
        component={DriverDashboardScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DriverOnboarding"
        component={DriverOnboardingScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="VendorOnboarding"
        component={VendorOnboardingScreen}
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PayVendor"
        component={PayVendorScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PasopFeed"
        component={PasopFeedScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PasopReport"
        component={PasopReportScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
