# 🧪 Android APK Testing Checklist & Feature Guide

**App**: Haibo Taxi Safety App  
**Version**: 2.0.0  
**Date**: January 28, 2026

---

## 📱 Installation Verification

### ✅ Pre-Installation
- [ ] Phone has 500MB+ free space
- [ ] Android 8.0+ (API 26+)
- [ ] WiFi or mobile data connected
- [ ] USB Debugging enabled (if using ADB)
- [ ] Unknown sources allowed (Settings → Security)

### ✅ Installation Process
- [ ] APK downloads successfully
- [ ] File size shows ~50-100MB
- [ ] No corrupted file errors
- [ ] Installation doesn't timeout
- [ ] App permissions screen appears

### ✅ Post-Installation
- [ ] App icon appears on home screen
- [ ] App name: "Haibo! App"
- [ ] Can open from app drawer
- [ ] Splash screen shows properly
- [ ] No immediate crash

---

## 🚀 Feature Testing Guide

### 1️⃣ AUTHENTICATION - OTP Flow

#### Request OTP
```
1. Launch app
2. See login screen
3. Enter phone: +27123456789 (or your number)
4. Tap "Request OTP"
```

**Expected Results**:
- [ ] Loading indicator shows
- [ ] Success message appears
- [ ] "Code sent to +27123456789" displays
- [ ] OTP input field appears
- [ ] No error messages

#### Verify OTP
```
1. Check terminal for dev code: eas build output
2. Or check Twilio SMS (if SMS enabled)
3. Enter the 6-digit code
4. Tap "Verify"
```

**Expected Results**:
- [ ] Code validates
- [ ] Loading shows briefly
- [ ] Redirected to home screen
- [ ] User profile displays
- [ ] Bottom tabs visible

---

### 2️⃣ NAVIGATION - Tab Testing

#### Bottom Tab Bar
```
Tap each tab and verify:
```

**Home Tab**:
- [ ] Home screen loads
- [ ] Shows welcome message
- [ ] Lists available features
- [ ] No crashes

**Rides Tab**:
- [ ] Rides screen loads
- [ ] Shows ride history
- [ ] Can start new ride
- [ ] Displays properly

**Profile Tab**:
- [ ] Profile screen opens
- [ ] Shows user info
- [ ] Edit option available
- [ ] Can logout

**Other Tabs**:
- [ ] All tabs accessible
- [ ] No missed screens
- [ ] Tab icons highlight

---

### 3️⃣ API CONNECTION - Network Testing

#### Monitor Network Calls
```bash
# Open terminal on computer
adb logcat | grep -i "api\|http\|network"
```

#### Test Login API
```
1. Complete OTP login
2. Check logs for:
   - [SUCCESS] Verify OTP
   - [SUCCESS] Get user profile
   - Token received
   - No 401/403 errors
```

#### Expected HTTP Responses
```
✓ 200 OK - Request successful
✓ 201 Created - User created
✗ 400 Bad Request - Fix input
✗ 401 Unauthorized - No token
✗ 500 Server Error - Backend issue
```

---

### 4️⃣ PERMISSIONS - Grant & Test

#### Location Permissions
```
1. Try to use location feature
2. Popup appears: "Allow location?"
3. Tap "Allow while using app"
4. Location works
```

**Expected Behavior**:
- [ ] Permission request shows
- [ ] Clear explanation provided
- [ ] Can accept/deny
- [ ] App works without permission

#### Camera Permissions
```
1. Try photo upload/capture
2. Permission popup shows
3. Tap "Allow"
4. Camera opens
```

**Expected Behavior**:
- [ ] Camera launches
- [ ] Can take photo
- [ ] Photo saves/uploads
- [ ] No crashes

#### Contact Permissions
```
1. Access emergency contacts
2. Permission request shows
3. Tap "Allow"
4. Can select contacts
```

---

### 5️⃣ UI/UX - Visual Testing

#### Design Elements
- [ ] Colors match brand (pink/blue)
- [ ] Fonts are readable
- [ ] Images load properly
- [ ] Icons display correctly
- [ ] No overlapping text

#### Layout & Spacing
- [ ] Content not cut off
- [ ] Buttons properly sized
- [ ] Text margins adequate
- [ ] Form fields aligned
- [ ] No unusable areas

#### Dark Mode (if supported)
```
Settings → Display → Dark theme
```
- [ ] Colors invert properly
- [ ] Text still readable
- [ ] No eye strain
- [ ] Looks professional

---

### 6️⃣ PERFORMANCE - Speed & Responsiveness

#### Load Times
```
Measure (rough estimate):
```
- [ ] Splash screen: < 2 seconds
- [ ] Login screen: < 1 second
- [ ] Home screen: < 2 seconds
- [ ] Tab switches: < 0.5 seconds
- [ ] API calls: < 3 seconds

#### Responsiveness
- [ ] Buttons respond instantly
- [ ] Scrolling is smooth
- [ ] No input lag
- [ ] No freezing
- [ ] No stuttering

#### Battery & Data
- [ ] App doesn't drain battery (use battery stat)
- [ ] Data usage reasonable
- [ ] Background tasks minimal
- [ ] No excessive logging

---

### 7️⃣ ERROR HANDLING - Network Issues

#### No Network
```
1. Disable WiFi/Mobile data
2. Try to use app features
```

**Expected Behavior**:
- [ ] Shows "No connection" message
- [ ] Offers retry button
- [ ] Doesn't crash
- [ ] Graceful degradation

#### Slow Network
```
1. Use slower WiFi or throttle connection
2. Try to load data
```

**Expected Behavior**:
- [ ] Shows loading spinner
- [ ] Timeout error appears (> 30s)
- [ ] User can retry
- [ ] No stuck UI

#### API Errors
```
1. Shut down backend server
2. Try login
```

**Expected Behavior**:
- [ ] Shows "Server error" message
- [ ] Suggests contacting support
- [ ] Provides retry option
- [ ] Logs error (in console)

---

### 8️⃣ PAYMENT - Paystack Integration

#### Initiate Payment
```
1. Go to Wallet/Payment section
2. Tap "Add Money" or "Top up"
3. Enter amount: 100
4. Tap "Proceed to Payment"
```

**Expected Results**:
- [ ] Paystack form opens
- [ ] Amount shows correctly
- [ ] Email pre-filled
- [ ] Payment methods visible

#### Test Payment
```
1. Use Paystack test card:
   Number: 4111 1111 1111 1111
   Expiry: 01/30
   CVV: 123
2. Complete payment
```

**Expected Results**:
- [ ] Payment processes
- [ ] Success message shows
- [ ] Receipt appears
- [ ] Wallet updated
- [ ] Notification received

---

### 9️⃣ NOTIFICATIONS - Push Alerts

#### FCM Token Registration
```bash
# Check logs
adb logcat | grep "FCM"
```

**Expected**:
- [ ] Token registers on app launch
- [ ] No registration errors
- [ ] Token valid format
- [ ] Shows in logs

#### Send Test Notification
```bash
# From computer
curl -X POST http://localhost:5000/api/notifications/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "title": "Test",
    "body": "This is a test notification"
  }'
```

**Expected**:
- [ ] Phone notification appears
- [ ] Sound/vibration works
- [ ] Can tap notification
- [ ] Shows notification data

---

### 🔟 SECURITY - Permission & Privacy

#### Data Privacy
- [ ] No sensitive data in logs
- [ ] Passwords never logged
- [ ] Tokens stored securely
- [ ] No cleartext passwords

#### Permission Requests
- [ ] Only necessary permissions asked
- [ ] Clear explanation provided
- [ ] Can deny and still use app
- [ ] No forced permissions

#### SSL/HTTPS
```bash
curl -v https://api.yourserver.com/
```
- [ ] Certificate valid
- [ ] No SSL warnings
- [ ] Secure connection established

---

## 📊 Testing Results Template

```markdown
## Test Results - [Date]

**Device**: [Model]  
**Android Version**: [Version]  
**App Version**: 2.0.0  
**Tester**: [Name]

### Summary
- Total Tests: [X]
- Passed: [X]
- Failed: [X]
- Success Rate: [X%]

### Critical Issues
- [ ] None found
- [ ] List any critical bugs

### Major Issues
- [ ] None found
- [ ] List any major issues

### Minor Issues
- [ ] None found
- [ ] List any cosmetic issues

### Recommendations
- [List improvements]

### Sign-off
- Tested by: [Name]
- Date: [Date]
- Status: [PASS/FAIL/CONDITIONAL]
```

---

## 🐛 Bugs - How to Report

### Bug Report Template
```
Title: [Brief description]

Device: [Model, Android version]
App Version: 2.0.0
Date: [Date]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Result:
[What should happen]

Actual Result:
[What actually happened]

Logs:
[Relevant error logs]

Screenshot:
[If possible, attach screenshot]
```

### Where to Send
1. GitHub Issues: https://github.com/yourrepo/issues
2. Email: support@haibo.app
3. Slack/Discord: #bug-reports

---

## 🎯 Test Coverage Matrix

| Feature | Unit | Integration | E2E | Status |
|---------|------|-------------|-----|--------|
| OTP Auth | ✓ | ✓ | ✓ | Ready |
| Email Login | ✓ | ✓ | Ready | Ready |
| Navigation | ✓ | ✓ | ✓ | Ready |
| API Calls | ✓ | ✓ | ✓ | Ready |
| Permissions | ✓ | ✓ | ✓ | Ready |
| Payments | ✓ | Ready | Ready | Ready |
| Notifications | ✓ | Ready | Ready | Ready |

---

## ✅ Sign-Off Checklist

Before marking as "Ready":

- [ ] All core features working
- [ ] No critical bugs
- [ ] API integration verified
- [ ] Performance acceptable
- [ ] Security verified
- [ ] UI looks good
- [ ] Error handling tested
- [ ] On multiple Android versions (if possible)
- [ ] Documentation updated
- [ ] Ready for production

---

## 📱 Device Testing Matrix

### Minimum Devices to Test
- [ ] Android 8.0 (API 26)
- [ ] Android 10.0 (API 29)
- [ ] Android 12.0 (API 31)
- [ ] Latest Android (API 34+)

### Screen Sizes
- [ ] Phone (small: 4.5")
- [ ] Phone (regular: 5.0"-6.0")
- [ ] Phone (large: 6.0"+)
- [ ] Tablet (if applicable)

---

## 🚀 Ready for Release When

- ✅ All critical tests pass
- ✅ No blocking bugs
- ✅ Performance acceptable
- ✅ Security verified
- ✅ All features working
- ✅ Error handling complete
- ✅ Tested on multiple devices
- ✅ Documentation complete
- ✅ Team approval obtained

---

## 📝 Notes

**Testing Environment**:
- Backend: http://[computer-ip]:5000
- Firebase: Configured
- Twilio: Enabled (for OTP)
- Paystack: Test keys

**Known Issues**:
- [List any known issues]

**Workarounds**:
- [If issues exist, list workarounds]

---

**Start Testing!** 🧪

Follow this guide systematically and mark each section as you test. Good luck! 🚀
