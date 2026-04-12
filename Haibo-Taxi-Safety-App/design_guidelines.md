# Haibo! Taxi Safety App - Design Guidelines

## Brand Identity

### Primary Brand Gradient
The brand uses a vibrant pink/red gradient for primary actions and highlights:
- **Gradient Start**: `#E72369`
- **Gradient End**: `#EA4F52`
- **Direction**: Horizontal (left to right)

### Color Palette

**Primary Colors**
- `--primary-color-start`: #E72369 (Vibrant Pink)
- `--primary-color-end`: #EA4F52 (Coral Red)
- `--background-color`: #FFFFFF (Clean white)
- `--text-color-dark`: #212529 (High contrast text)
- `--text-color-light`: #FFFFFF (White for buttons)
- `--safety-indicator-color`: #28A745 (Safety green)

**Status Colors**
- Emergency: `#C62828`
- Warning: `#FFA000`
- Success: `#28A745`
- Info: `#0288D1`

**Grays**
- Text Primary: `#212121`
- Text Secondary: `#757575`
- Borders: `#BDBDBD`
- Background: `#F5F5F5`
- Surface: `#FFFFFF`

### Typography

**Font Family**: Nunito (Google Fonts)
- Regular: `Nunito_400Regular`
- Medium: `Nunito_500Medium`
- SemiBold: `Nunito_600SemiBold`
- Bold: `Nunito_700Bold`
- ExtraBold: `Nunito_800ExtraBold`

**Type Scale**
- **H1**: 32px Bold
- **H2**: 28px Bold
- **H3**: 24px SemiBold
- **H4**: 20px SemiBold
- **Body**: 16px Regular
- **Small**: 14px Regular
- **Caption**: 12px Regular

## Components

### Gradient Buttons (Primary CTA)
Use `GradientButton` component for all main call-to-action buttons:
```tsx
import { GradientButton } from "@/components/GradientButton";

<GradientButton onPress={handleAction} icon="arrow-right" iconPosition="right">
  Get Started
</GradientButton>
```

**Variants**:
- `primary` (default): Full gradient background with white text
- `outline`: Transparent with gradient border and gradient text

**Sizes**:
- `small`: 40px height
- `medium` (default): 52px height
- `large`: 56px height

### SOS FAB
- **Size**: 72x72 circle
- **Color**: Emergency red `#C62828`
- **Animation**: Pulse 1.0→1.05 every 2s
- **Position**: `bottom: tabBarHeight + 80, right: 16`

### Input Fields
- **Height**: 48px
- **Border Radius**: 8px
- **Border**: 1px gray-300
- **Focus State**: 2px primary gradient border
- **Error State**: Red border + helper text

### Cards
- **Border Radius**: 16px
- **Background**: White
- **Padding**: 16px
- **Shadow**: offset(0,2), opacity 0.08, radius 4

## Architecture

### Authentication
**Required**: Phone OTP (+27), Email/Password, Social Login (Google, Facebook)
**Features**: Biometric authentication for returning users, Guest mode
**Screens**: `AuthScreen`, `VerifyOTPScreen`

### Navigation
**Tab Bar (4 tabs)**: Home | Routes | SOS | Phusha!
**FAB**: Red SOS button always visible
**Modals**: Emergency, TripShare, Report, Payment, EmergencyContacts

## Screen Specifications

### 1. Home (Map View)
- **Header**: Transparent, search bar, menu button
- **Content**: Full-screen map, draggable bottom sheet
- **Markers**: Ranks (blue), stops (orange), user (pulsing dot)

### 2. Routes & Fares
- **Header**: "Routes & Fares", filter icon
- **Content**: Searchable list, categorized by region

### 3. SOS
- **FAB**: Large SOS button with pulse animation
- **Modal**: Emergency contact options, location sharing

### 4. Phusha! (Community)
- **Header**: Semi-transparent, "Phusha!"
- **Content**: Reels-style content, comments, sharing

### 5. Menu
- **Dashboard Login**: Gold button (#D4AF37) with pulse animation
- **Features**: City Explorer, Theme settings, Profile, Support

## Design Principles

### Accessibility
- **Touch targets**: Minimum 44x44
- **Contrast**: 4.5:1 text, 3:1 UI elements
- **Support**: VoiceOver/TalkBack labels

### Visual Language
- **Gradient Pink/Red**: Primary actions, CTAs
- **Red**: Emergency/SOS only
- **Green**: Safe/success states
- **Gold**: Premium/special features

### Simplicity
- Minimize visual clutter
- Clear visual hierarchy
- Large, touch-friendly interactive elements
- Consistent spacing using theme constants

### Iconography
- **Base**: Feather icons from @expo/vector-icons
- **Size**: 24x24 UI, 20x20 lists
- **NO emojis**

## Required Assets

### Avatars (3 presets)
1. Commuter: Backpack, earth tones
2. Driver: Cap/uniform, blue tones
3. Operator: Clipboard, purple tones

### Hand Signals (8)
Line art + accent color + text labels

### Onboarding (4 screens)
Safety, Routes, Community, Get Started
