# 🚀 Quick Start - Build APK in 5 Minutes

**Goal**: Get Haibo app running on your Android phone  
**Time**: 5-15 minutes  
**Difficulty**: Easy

---

## ⚡ The Fastest Way (Recommended)

### Step 1: Open Terminal
```bash
cd /Users/mac/clawd/Haibo_info/Haibo-Taxi-Safety-App
```

### Step 2: Run Build Script
```bash
chmod +x build-apk.sh
./build-apk.sh
```

Follow the prompts and choose **Option 1 (EAS Build)** - it's the easiest.

### Step 3: Download APK
- Copy the APK URL from the build output
- Open link on your Android phone
- Tap "Download"

### Step 4: Install
1. Go to Downloads
2. Tap the `.apk` file
3. Tap "Install"
4. Tap "Open"

**Done!** ✨ App is now running

---

## 🤖 Manual Steps (If Script Doesn't Work)

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
eas login
# Visit https://expo.dev to create free account
```

### Step 3: Build APK
```bash
cd /Users/mac/clawd/Haibo_info/Haibo-Taxi-Safety-App
eas build --platform android --type apk
```

### Step 4: Wait for Build
- Estimated time: 5-10 minutes
- Watch progress in terminal
- Save the APK download URL when ready

### Step 5: Install on Phone
- Download APK on phone
- Enable "Unknown Sources" in Settings
- Tap APK file to install
- Grant permissions
- Launch app

---

## ✅ Testing After Installation

### First Launch
1. App opens → **✓ Success**
2. See splash screen → **✓ Good**
3. See login screen → **✓ Ready to test**

### Test OTP Authentication
1. Enter your phone number
2. Tap "Request OTP"
3. Check terminal output for dev code (in development mode)
4. Enter code and tap "Verify"
5. Should see app home screen

### Test Navigation
- Tap each bottom tab
- Verify screens load
- Check no crashes

### Test API Connection
1. Open app logs: `adb logcat -s "Haibo"`
2. Perform an action (login, fetch data)
3. Look for successful API responses
4. Check for errors

---

## 🔧 Common Quick Fixes

### "App won't open"
```bash
# Clear app and reinstall
adb uninstall com.haiboapp
# Then reinstall APK
```

### "Build failed"
```bash
# Clear cache and rebuild
npm run build:clean
# Then run build-apk.sh again
```

### "Can't connect to API"
- Ensure backend is running: `npm run server:dev`
- Check your phone's network
- Update API URL in `.env` to use computer IP (not localhost)

### "APK is slow to download"
- Try on WiFi instead of mobile data
- Use mobile data saver disabled
- Download on computer first, transfer via USB

---

## 📱 Phone Setup (One-time)

### Enable USB Debugging
1. Settings → About phone
2. Tap "Build number" 7 times
3. Back to Settings → Developer options
4. Enable "USB Debugging"

### Allow Installation from Unknown Sources
1. Settings → Apps & notifications → Advanced
2. "Install unknown apps"
3. Select your browser
4. Enable permission

### Connect via USB (Optional for ADB)
1. Plug phone into computer with USB cable
2. Allow "USB Debugging" on phone
3. Test: `adb devices` (should list your phone)

---

## 🎯 Testing Checklist

After app installs:

- [ ] App launches without crashing
- [ ] Can see login screen
- [ ] Can request OTP
- [ ] Can verify OTP
- [ ] Can see main app screens
- [ ] Can navigate between tabs
- [ ] API calls complete
- [ ] No permission errors
- [ ] App doesn't freeze
- [ ] Battery usage reasonable

---

## 📊 Expected Results

### On First Launch
```
1. Splash screen (2-3 seconds)
2. Login screen appears
3. Phone input field ready
4. "Request OTP" button works
5. OTP verification works
6. App home screen loads
7. All features accessible
```

### In Logs (adb logcat)
```
✓ No red ERROR messages
✓ No CRASH stack traces
✓ API requests successful
✓ Navigation working
✓ Permissions granted
```

---

## 🆘 If Something Goes Wrong

### Check Logs
```bash
adb logcat | grep -i "error"
```

### Check Network
```bash
# On phone
Settings → WiFi → Check connection
# Or use mobile data
```

### Check API
```bash
# From computer
curl http://localhost:5000/api/auth/me
# Should work (or show 401 unauthorized)
```

### Uninstall & Rebuild
```bash
adb uninstall com.haiboapp
# Then rebuild and reinstall
```

---

## 🚀 Next Steps

### After Basic Testing
1. Test more features
2. Try different screens
3. Test with bad network
4. Check battery usage
5. Take screenshots

### For Production
1. Update version in app.json
2. Build release APK
3. Sign APK
4. Submit to Play Store

---

## ⏱️ Time Breakdown

| Step | Time |
|------|------|
| Install EAS CLI | 2 min |
| Login to Expo | 1 min |
| Build APK | 5-10 min |
| Download on phone | 1-2 min |
| Install APK | 1 min |
| Test app | 5 min |
| **Total** | **15-20 min** |

---

## 📞 Need Help?

**Build fails?**
→ See: ANDROID_APK_BUILD_GUIDE.md

**API not working?**
→ Start backend: `npm run server:dev`

**Questions?**
→ Check: QUICK_REFERENCE_IMPLEMENTATION.md

---

## ✨ Success Indicators

✓ App icon appears on home screen  
✓ App launches without crashing  
✓ Login screen displays  
✓ Can interact with UI  
✓ API calls complete  
✓ No permission warnings  
✓ Performance acceptable  

---

**You're ready to test!** 🎉

Run: `./build-apk.sh` and follow prompts.

Estimated time: **5-15 minutes**
