#!/bin/bash

# Haibo APK Build Script - Quick Start
# Run this to build and test APK on Android phone

set -e

echo "🚀 Haibo Taxi Safety App - Android APK Build"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found${NC}"

# Check if eas-cli is installed globally
if ! command -v eas &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installing EAS CLI...${NC}"
    npm install -g eas-cli
fi
echo -e "${GREEN}✓ EAS CLI available${NC}"

echo ""
echo "📦 Build Method Selection"
echo "========================"
echo "1. EAS Build (Recommended - Cloud-based, easiest)"
echo "2. Local Build (Advanced - No internet required)"
echo ""
read -p "Choose method (1 or 2): " build_method

case $build_method in
    1)
        echo ""
        echo -e "${YELLOW}Building with EAS Cloud Build...${NC}"
        echo ""
        
        # Check if logged in to Expo
        if ! eas whoami &> /dev/null; then
            echo "You need to login to Expo. Visit https://expo.dev to create an account."
            echo ""
            read -p "Press Enter to open login in browser..."
            eas login
        fi
        
        echo ""
        echo "🔨 Building APK (this will take 5-10 minutes)..."
        eas build --platform android --profile preview
        
        echo ""
        echo -e "${GREEN}✅ Build complete!${NC}"
        echo "📱 Download the APK from the link above"
        echo ""
        echo "Installation options:"
        echo "  1. Download directly on your Android phone and tap to install"
        echo "  2. Use ADB if connected: adb install path/to/haibo-app.apk"
        ;;
        
    2)
        echo ""
        echo -e "${YELLOW}Building APK locally...${NC}"
        echo ""
        
        # Check for Android SDK
        if [ -z "$ANDROID_HOME" ]; then
            echo -e "${YELLOW}⚠️  ANDROID_HOME not set. Setting to default...${NC}"
            export ANDROID_HOME="$HOME/Library/Android/sdk"
            export PATH="$ANDROID_HOME/platform-tools:$PATH"
        fi
        
        if [ ! -d "$ANDROID_HOME" ]; then
            echo -e "${RED}❌ Android SDK not found at $ANDROID_HOME${NC}"
            echo "Please install Android Studio and set ANDROID_HOME environment variable"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Android SDK found${NC}"
        echo ""
        
        read -p "Enter build type (debug/release) [debug]: " build_type
        build_type=${build_type:-debug}
        
        echo "🔨 Prebuild project..."
        npx expo@latest prebuild --clean --platform android
        
        echo ""
        echo "🔨 Building APK..."
        cd android
        if [ "$build_type" = "release" ]; then
            ./gradlew bundleRelease
        else
            ./gradlew assembleDebug
        fi
        cd ..
        
        # Find APK file
        if [ "$build_type" = "release" ]; then
            APK_PATH="android/app/build/outputs/bundle/release/app.aab"
            echo ""
            echo -e "${YELLOW}Note: Release build creates AAB (not APK). To get APK:${NC}"
            echo "  1. Upload to Google Play (requires account)"
            echo "  2. Or use bundletool to convert AAB to APK"
        else
            APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
            if [ -f "$APK_PATH" ]; then
                echo -e "${GREEN}✅ APK built successfully!${NC}"
                echo "📍 Location: $APK_PATH"
                echo ""
                read -p "Install on phone now? (y/n): " install_now
                if [ "$install_now" = "y" ] || [ "$install_now" = "Y" ]; then
                    if command -v adb &> /dev/null; then
                        adb install "$APK_PATH"
                    else
                        echo -e "${YELLOW}⚠️  ADB not found. Please install Android SDK tools${NC}"
                    fi
                fi
            else
                echo -e "${RED}❌ APK not found at expected location${NC}"
                echo "Build may have failed. Check output above."
                exit 1
            fi
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "📱 Next Steps:"
echo "  1. Enable USB Debugging on your Android phone:"
echo "     Settings → About phone → Tap Build number 7 times"
echo "     Settings → Developer options → Enable USB Debugging"
echo ""
echo "  2. Connect phone via USB cable"
echo ""
echo "  3. Install APK:"
echo "     - Option A: Download directly on phone and tap to install"
echo "     - Option B: adb install haibo-app.apk"
echo ""
echo "  4. Launch app from app drawer or:"
echo "     adb shell am start -n com.haiboapp/.MainActivity"
echo ""
echo "📖 For detailed guide, see: ANDROID_APK_BUILD_GUIDE.md"
echo ""
echo -e "${GREEN}Happy testing! 🚀${NC}"
