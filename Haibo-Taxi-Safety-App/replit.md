# Haibo! Taxi

## Overview
Haibo! Taxi is a safety and utility mobile application for the South African minibus taxi industry, built with React Native/Expo. It serves commuters, drivers, and operators by providing essential services such as route information, emergency SOS features, community engagement, and a digital payment system (Haibo Pay). The project aims to improve safety and convenience within the industry, utilizing a monorepo architecture for its client (Expo/React Native) and server (Express) components, sharing types and schemas.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: Expo SDK 54 with React Native 0.81.
- **Navigation**: React Navigation v7, utilizing native stack and bottom tab navigators.
- **State Management**: TanStack React Query for server state; React hooks for local state.
- **Styling**: StyleSheet-based theming with light/dark mode support, leveraging a `useTheme` hook.
- **Storage**: AsyncStorage for local persistence of user data (profiles, emergency contacts, community posts).
- **Component Architecture**: Themed base components (e.g., ThemedView, ThemedText, Button, Card) ensure consistent styling.
- **Error Handling**: Class-based error boundaries provide debugging in development and graceful fallbacks in production.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL, managed with Drizzle ORM for type-safe queries.
- **Schema**: Shared schema definitions (`shared/schema.ts`) using Drizzle and Zod for validation.
- **Storage**: Interface-based storage abstraction (`IStorage`) with an in-memory implementation for flexible database migration.

### Key Design Patterns
- **Monorepo Structure**: Organized into `/client`, `/server`, and `/shared` directories.
- **Path Aliases**: `@/` for client, `@shared/` for shared directories.
- **Theme System**: Centralized constants for branding, spacing, typography, and theming via `ThemeContext` with persistence.

### Core Features & Implementations
- **Navigation**: A `RootStackNavigator` manages top-level navigation, modals (Emergency, TripShare, Report, Payment, EmergencyContacts), and the Profile screen. A `MainTabNavigator` handles the primary bottom tab interface (Home, Routes, SOS, Phusha!).
- **Mobile-Specifics**: Includes platform detection, safe area handling, Expo Haptics integration, `react-native-maps` for location, and platform-aware keyboard management.
- **Interactive Taxi Map**: Allows users to add, verify (upvote/downvote), and view taxi stops with location types, images, and hand signals. Integrates `taxi_locations`, `location_images`, `hand_signals`, and `location_votes` tables.
- **Route Details Map**: Displays route polylines and markers on maps within route details, with web fallbacks.
- **Community Features**:
    - **Lost & Found**: A dedicated feature for reporting and claiming lost/found items with search, filters, and claim actions.
    - **Phusha! (Social)**: Enables creation and sharing of reels (videos/photos with captions), includes a comment tray with real-time comments, and a share tray for platform-specific sharing.
    - **Community Dashboard**: Replaces older feeds with a tile-based dashboard for Lost & Found, Haibo Fam (community posts), Q&A Forum, and Group Rides.
    - **NewPostModal**: Full-featured multimedia post creation modal accessible via FAB button. Supports text input with character count, and placeholder buttons for Photo, Video, GIF, and Camera integrations. Located at `client/components/NewPostModal.tsx`.
    - **CommunityTray**: Fixed fullscreen layout for mobile, removed "Community" heading, expanded to 95% screen height. Categories: All, Live, Community, Events.
    - **Q&A Forum Chat Interface**: Real-time chat room style UI with organized question threads. Features include:
        - Live Q&A Chat header with green online indicator
        - Expandable/collapsible threaded replies with left border styling
        - Upvote functionality for questions and replies
        - Verified badges for trusted responders
        - Fixed input bar at bottom with gradient send button
        - Mock data with realistic South African taxi Q&A content
    - **Group Rides Architecture**: Full technical proposal in `docs/GROUP_RIDES_ARCHITECTURE.md` covering Socket.io real-time implementation, database schema, API endpoints, security considerations, and phased implementation plan.
- **Haibo! Hub**: Package tracking and management system with `packages`, `packageStatusHistory`, and `courierHubs` tables, allowing users to track packages scoped by `deviceId`.
- **Ratings & Reviews**: Users can submit 1-5 star ratings and comments for locations, with star rating summaries and a list of reviews.
- **Hero Banner**: An auto-scrolling image slideshow with a "Contribute Route" button for user-submitted routes pending community review.
- **Menu System**: A hamburger menu (`MenuButton`) provides access to theme settings, account management (Profile, Haibo Pay, Emergency Contacts), app information, and social media links.
- **Floating Tab Bar**: A redesigned, pill-shaped floating tab bar with circular icons and an enlarged SOS button, including iOS blur effects.
- **Home Screen Search**: A floating search bar in the bottom sheet header for filtering taxi stops by name, address, and description.
- **Refer-a-Friend System**: A comprehensive affiliate/referral system with:
    - Unique, persistent referral codes (format: HAIBO + 6 alphanumeric chars)
    - Shareable invite links for easy sharing via social media
    - Progress tracking with visual progress bars toward next reward tier
    - Tiered rewards: 5+ signups (R50 wallet credit), 10+ signups (T-shirt), 25+ signups (accessory pack)
    - Recent referrals list showing signup status
    - Database tables: `referral_codes`, `referral_signups`, `referral_rewards`
    - API routes in `server/referralRoutes.ts` for code generation, stats, registration, and reward claims
- **Job Search & Events**: A comprehensive taxi industry employment and events feature:
    - **Job Search**: Browse and filter job postings across 6 categories (driver, marshal, mechanic, admin, security, other)
    - Job listings include: title, company, description, requirements, salary range, location, province, experience level, license requirements, benefits
    - Expandable job cards with Call and WhatsApp contact actions
    - Database tables: `jobs`, `job_applications` with full-text search support
    - **Events**: Browse upcoming taxi industry events with category filtering
    - Event categories: community, safety, training, meeting, celebration, other
    - Calendar-style date boxes, RSVP tracking, capacity management, ticket pricing
    - Support for online events with virtual meeting links
    - Database tables: `events`, `event_rsvps`
    - API routes in `server/jobsEventsRoutes.ts` for CRUD operations, filtering, applications, and RSVPs
- **City Explorer Challenge**: A gamified community contribution system encouraging users to verify fares and add taxi stops:
    - 3-level progression: Fare Detective (verify fares), Stop Spotter (add stops), Direction Hero (upload photos)
    - Points system: 10 points (Level 1), 30 points (Level 2), 40 points (Level 3) = 80 total points
    - Badge awards at each level completion with animated celebrations
    - Featured button in menu with orange gradient styling and points badge
    - Device-based progress tracking via AsyncStorage deviceId (no auth required)
    - Database tables: `explorer_progress`, `fare_surveys`, `stop_contributions`, `photo_contributions`, `explorer_leaderboard`
    - API routes in `server/explorerRoutes.ts` for progress, surveys, contributions, and leaderboard
    - Sample fare questions from 8 South African cities (Paulshof, Bree Rank, Midrand, Park Station, etc.)
- **Authentication System**: Multi-method authentication supporting:
    - Phone OTP login with South African country code (+27)
    - Email/password registration and login
    - Social login placeholders (Google, Facebook - coming soon)
    - Biometric authentication (Face ID, fingerprint) for returning users
    - Guest mode with "Skip for now" option
    - Screens: `AuthScreen` (client/screens/AuthScreen.tsx), `VerifyOTPScreen` (client/screens/VerifyOTPScreen.tsx)
    - Token/user data persistence via AsyncStorage
    - Dashboard Login button in Menu with gold styling (#D4AF37) and pulse animation
- **Floating Search Bar**: Reusable component (`client/components/FloatingSearchBar.tsx`) with:
    - Animated expand/collapse (50px to 200px height)
    - Live filtering of taxi stops by name and address
    - Shows top 5 search results with distance display
    - Smooth keyboard handling
- **Share Tray with Watermarking**: Share content includes "Via Haibo App" watermark for brand visibility
- **Real Taxi Route Data Integration**: Comprehensive real-world South African taxi route data with:
    - 525 routes, 7 taxi associations, and 340 taxi ranks loaded from JSON data files
    - Data loader (`server/data/taxiDataLoader.ts`) processes multiple JSON formats and normalizes into TypeScript interfaces
    - API endpoints (`server/taxiRoutes.ts`) for routes, associations, ranks, search, nearby routes, provinces, and stats
    - Routes include: origin/destination, fares (ZAR), travel times, distances, route types (local/regional/intercity), safety scores (1-5), risk levels, frequencies, and taxi association information
    - Province-based filtering (Gauteng, Western Cape, KwaZulu-Natal, Eastern Cape, Free State, Limpopo, Mpumalanga, North West)
    - Haversine distance calculation for finding nearby routes based on GPS coordinates
    - Google Maps integration for route navigation

## External Dependencies

### Database & ORM
- **PostgreSQL**: The primary relational database.
- **Drizzle ORM**: Used for type-safe database interactions and schema management.
- **Drizzle Kit**: For database migrations and schema pushing.

### Third-Party Services
- **Expo Services**: Utilized for various functionalities including splash screen, constants, linking, web browser, haptics, and blur effects.
- **Google Maps**: Integrated via `react-native-maps` for location and mapping features.
    - Full-screen web map at `/taxi-map` with 710+ taxi locations across South Africa
    - Uses `GOOGLE_API_KEY` secret (with Maps JavaScript API and Geocoding API enabled)
    - GIS bulk import system with CSV parsing, validation, and duplicate detection
    - Geocoding scripts: `server/geocodeMissingLocations.ts`, `server/geocodeMissingLocationsV2.ts`
    - Bulk import API: `server/bulkImportRoutes.ts` with endpoints for locations, template, validate, export, stats, re-geocode
- **Expo Location**: Provides GPS coordinates and handles location permissions.
- **Paystack**: Payment gateway integrated for transaction initialization, verification, and webhook handling, with server-side API services and routes.
- **Google Firebase**: Backend services integration for authentication, Firestore database, and push notifications.
    - Firebase Admin SDK initialized in `server/services/firebase.ts`
    - API routes in `server/firebaseRoutes.ts` for status checks, token verification, and user management
    - Credentials stored as secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
    - Available services: Authentication (verifyIdToken, createCustomToken), Firestore, Cloud Messaging
- **Twilio**: SMS and voice services for OTP verification and notifications.
    - Twilio client initialized in `server/services/twilio.ts` using Replit's connector
    - API routes in `server/twilioRoutes.ts` for SMS sending and OTP verification
    - Supports: SMS messaging, OTP generation and delivery for phone authentication
    - Endpoints: `/api/twilio/status`, `/api/twilio/send-sms`, `/api/twilio/send-otp`

### Key Runtime Dependencies
- **React Query**: Manages server state caching and synchronization.
- **React Native Gesture Handler**: Enables complex touch gesture recognition.
- **React Native Reanimated**: Powers high-performance animations.
- **AsyncStorage**: Provides persistent local storage for React Native applications.
- **Expo Haptics**: For haptic feedback on touch interactions.

### Development Tools
- **tsx**: Used for TypeScript execution in server development.
- **esbuild**: For server bundling in production environments.
- **Babel Module Resolver**: Facilitates path alias support within React Native.