# 📱 Android APK Build & Testing Guide

**Date**: January 28, 2026  
**App**: Haibo Taxi Safety App  
**Target**: Android Phone Testing

---

## 🎯 Quick Start (Recommended Method)

### Option 1: Using Expo EAS Build (Easiest - Cloud-Based)

#### Prerequisites
- Node.js installed
- `npm` or `yarn` available
- Expo account (free at https://expo.dev)
- Android phone with USB debugging enabled

#### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

#### Step 2: Login to Expo
```bash
eas login
# Follow the prompts to authenticate
```

#### Step 3: Configure EAS Build
```bash
cd /Users/mac/clawd/Haibo_info/Haibo-Taxi-Safety-App
eas init
# Select "Haibo App" when prompted
```

#### Step 4: Build APK for Android
```bash
# Build release APK
eas build --platform android --type apk

# Or for testing (debug):
eas build --platform android --type apk --profile preview
```

**Expected Output**:
```
✓ Build finished!
APK URL: https://eas-builds.expo.dev/builds/XXXXXX.apk
```

#### Step 5: Download & Install APK
- Copy the APK URL from the build output
- Download on your phone or use `adb`
- Tap to install

**Time**: 5-10 minutes  
**Pros**: Easiest, cloud-based, no setup needed  
**Cons**: Requires internet, Expo account

---

### Option 2: Manual Build (Local - Advanced)

#### Prerequisites
- Android Studio installed
- Android SDK (API level 33+)
- Java Development Kit (JDK)
- Gradle

#### Step 1: Set Up Android Environment
```bash
# Check if Android tools are installed
which adb
# If not, install via Android Studio

# Set ANDROID_HOME environment variable
export ANDROID_HOME="/Users/$(whoami)/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export PATH="$ANDROID_HOME/tools:$PATH"
```

#### Step 2: Create Expo Build Configuration
```bash
cd /Users/mac/clawd/Haibo_info/Haibo-Taxi-Safety-App

# Create development client for local testing
npx expo@latest prebuild --clean
```

#### Step 3: Build APK Manually
```bash
# Using Expo CLI with Gradle
eas build --platform android --local

# Or using Android Studio
# Open: android/ folder as project
# Build > Build Bundle(s) / APK(s) > Build APK(s)
```

**Time**: 15-20 minutes (first time)  
**Pros**: No cloud dependency, full control  
**Cons**: Requires Android setup, slower builds

---

## 📲 Testing on Android Phone

### Method 1: Direct Download (Easiest)

#### Step 1: Enable Installation from Unknown Sources
1. Go to **Settings** → **Apps & notifications** → **Advanced**
2. Select **Install unknown apps** or **Special permissions**
3. Select your **browser** and enable **Allow from this source**

#### Step 2: Download APK
1. Open the APK download link on your phone
2. Tap "Download"
3. Wait for download to complete

#### Step 3: Install APK
1. Open **Files** or **Downloads** app
2. Tap the downloaded `.apk` file
3. Tap **Install**
4. Accept permissions
5. Wait for installation
6. Tap **Open** or find app in app drawer

**Time**: 2-5 minutes  
**Requirements**: Just the phone

---

### Method 2: Using ADB (Android Debug Bridge)

#### Step 1: Enable USB Debugging on Phone
1. Go to **Settings** → **About phone**
2. Tap **Build number** 7 times → "Developer mode unlocked"
3. Back to Settings → **System** → **Developer options**
4. Enable **USB Debugging**

#### Step 2: Connect Phone to Computer
```bash
# Connect via USB cable

# Verify connection
adb devices
# Output should show: device_id   device
```

#### Step 3: Install APK via ADB
```bash
# Download APK first, then:
adb install ~/Downloads/haibo-app.apk

# Wait for "Success" message
```

#### Step 4: Launch App
```bash
# Find package name (usually from app.json slug)
adb shell am start -n com.haiboapp/.MainActivity

# Or tap app icon on phone
```

**Time**: 5-10 minutes  
**Requirements**: Computer + USB cable

---

## 🔧 Build Configuration Setup

### Environment Variables Needed

Create `.env` file in project root:
```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# Server API
EXPO_PUBLIC_API_URL=http://your-server-ip:5000

# Twilio (for OTP)
EXPO_PUBLIC_TWILIO_PHONE=+1234567890

# Paystack
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxx

# Google Maps (if needed)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY
```

### Update API URL for Testing

Edit `server/index.ts` or set dynamically:

```typescript
// In client services, use:
const API_URL = "http://your-computer-ip:5000"
// NOT localhost (won't work on phone)

// To find your computer IP:
// macOS: ifconfig | grep "inet " | grep -v 127.0.0.1
// Linux: hostname -I
// Windows: ipconfig | grep "IPv4"
```

---

## ✅ Testing Checklist

### Before Building
- [ ] Code compiles without errors
- [ ] No TypeScript errors
- [ ] Environment variables configured
- [ ] API server is running (or accessible)
- [ ] Firebase configured (optional for testing)
- [ ] Paystack keys available (optional for testing)

### After Installation
- [ ] App opens successfully
- [ ] Splash screen displays
- [ ] No crashes on startup
- [ ] Navigation works
- [ ] Can request OTP
- [ ] Can verify phone
- [ ] Can login with email (if web auth enabled)
- [ ] Can interact with screens
- [ ] API calls work (check network)
- [ ] No permission errors

### Full Testing Flow
1. **Authentication**
   - [ ] Request OTP with phone
   - [ ] Receive OTP via Twilio (or dev code)
   - [ ] Verify OTP and login
   - [ ] See user profile

2. **Navigation**
   - [ ] Bottom tabs work
   - [ ] Screen transitions smooth
   - [ ] Back button functions
   - [ ] Deep linking works

3. **Payments** (if integrated)
   - [ ] View wallet
   - [ ] Initiate payment
   - [ ] See Paystack form
   - [ ] Complete payment

4. **Notifications** (if FCM setup)
   - [ ] Register FCM token
   - [ ] Receive test notification
   - [ ] Tap notification
   - [ ] See notification data

---

## 🐛 Common Issues & Solutions

### Issue: "App crashes on startup"
**Solution**:
```bash
# Check logs
adb logcat | grep -i "myapp"

# Or use Android Studio Logcat tab
```

### Issue: "API calls failing / 404 errors"
**Solution**:
- Ensure API server is running: `npm run server:dev`
- Use computer IP (not localhost) in API URL
- Check network connectivity
- Verify CORS settings in server

```bash
# Test API from computer first
curl http://localhost:5000/api/auth/me
```

### Issue: "Build failed - Gradle error"
**Solution**:
```bash
# Clear cache and rebuild
cd android
./gradlew clean
cd ..
eas build --platform android --clean
```

### Issue: "APK won't install - signature error"
**Solution**:
- Uninstall previous version first: `adb uninstall com.haiboapp`
- Or rebuild with different signature
- Use debug build instead

### Issue: "Can't download APK - file too large"
**Solution**:
- Use mobile hotspot or WiFi
- Enable data saver temporarily
- Build with optimization: `eas build --platform android --type apk`

### Issue: "Permissions denied"
**Solution**:
```bash
# Grant permissions manually
adb shell pm grant com.haiboapp android.permission.INTERNET
adb shell pm grant com.haiboapp android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.haiboapp android.permission.CAMERA
adb shell pm grant com.haiboapp android.permission.READ_EXTERNAL_STORAGE
```

---

## 📊 Build Options Comparison

| Method | Time | Difficulty | Network | Cost |
|--------|------|-----------|---------|------|
| **EAS Build** | 5-10 min | Easy | Required | Free |
| **EAS Preview** | 5-10 min | Easy | Required | Free |
| **Local Android Studio** | 15-20 min | Hard | Not needed | Free |
| **Local eas build** | 10-15 min | Medium | Not needed | Free |

**Recommendation**: Use **EAS Build** for first test, then switch to local builds if speed important.

---

## 📈 Performance Optimization for APK

### Reduce Build Size
```json
// In app.json
{
  "expo": {
    "android": {
      "enableProguard": true,
      "versionCode": 1
    }
  }
}
```

### Enable Code Splitting
```bash
# In package.json scripts
"build:apk": "expo build:android --type apk --release-channel production"
```

### Optimize Bundle
```bash
# Check bundle size
npx expo export --platform android
```

---

## 🔍 Debugging on Android

### View Real-time Logs
```bash
# While app is running on phone
adb logcat -s "HaiboApp"

# Or filter for all JavaScript errors
adb logcat | grep -i "error"
```

### React Native Debugger
```bash
# Install React Native Debugger
# https://github.com/jhen0409/react-native-debugger

# Shake phone or press Ctrl+M to open dev menu
# Select "Debug JS Remotely"
```

### Chrome DevTools
```bash
# If using web debugging
# Open Chrome: chrome://inspect
# Select your device
# Use DevTools to debug
```

---

## 🚀 Advanced: Signed Release Build

### Generate Signing Key
```bash
# One-time setup
eas credentials

# Follow prompts to generate Android keystore
# Expo will manage your signing certificate automatically
```

### Build Signed APK
```bash
eas build --platform android --type apk

# Automatically uses your keystore
```

### Manual Signing (Advanced)
```bash
# Generate keystore
keytool -genkey -v -keystore ~/haibo-release.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias haibo-key

# Build and sign
eas build --platform android --type apk --use-local-build-server
```

---

## 📋 Pre-Deployment Checklist

- [ ] App builds without errors
- [ ] No console warnings
- [ ] All screens accessible
- [ ] API integration working
- [ ] Permissions requested properly
- [ ] App handles network errors
- [ ] Offline mode graceful (if applicable)
- [ ] Battery usage reasonable
- [ ] Performance acceptable
- [ ] UI looks good on phone screen
- [ ] No crashes on heavy use
- [ ] Notifications working (if enabled)
- [ ] Payment flow complete (if enabled)

---

## 📱 Test on Multiple Devices

### Android Emulator (Alternative to Physical Phone)
```bash
# If you have Android Studio
# Create virtual device in AVD Manager
# Or run:
emulator -avd Pixel_6_Pro

# Install APK on emulator
adb -e install haibo-app.apk
```

### Cloud Testing Services
- **Firebase Test Lab**: Run tests on real devices
- **BrowserStack**: Test on cloud devices
- **Saucelabs**: Automated mobile testing

---

## 🎯 Quick Command Reference

```bash
# Build APK via EAS (recommended)
eas build --platform android --type apk

# Install on phone via ADB
adb install ~/Downloads/haibo-app.apk

# View logs
adb logcat -s "MyApp"

# List connected devices
adb devices

# Uninstall app
adb uninstall com.haiboapp

# Open app after install
adb shell am start -n com.haiboapp/.MainActivity

# Clear app data
adb shell pm clear com.haiboapp

# Grant permission
adb shell pm grant com.haiboapp android.permission.INTERNET
```

---

## ✨ Next Steps

1. **Choose build method**: EAS Build (recommended) or local
2. **Prepare environment**: Set up env variables
3. **Build**: Run build command
4. **Download**: Get APK file
5. **Install**: Use direct install or ADB
6. **Test**: Follow testing checklist
7. **Debug**: Use logs if issues
8. **Iterate**: Make fixes and rebuild

---

## 📞 Getting Help

If you encounter issues:

1. **Check logs**:
   ```bash
   adb logcat | grep -i "error"
   ```

2. **Review error message** in console output

3. **Check Expo docs**: https://docs.expo.dev/

4. **Check React Native docs**: https://reactnative.dev/

5. **Search error on GitHub**: https://github.com/expo/expo/issues

---

**Status**: Ready to build and test  
**Estimated Time**: 5-20 minutes (depending on method)  
**Next Action**: Choose method and follow steps above

Need help with any specific step? Let me know! 🚀
