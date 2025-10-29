# Blockcart Mobile App

A React Native mobile application built with Expo that allows users to upload receipts, earn rewards, and track their earnings. The app integrates with Supabase for backend services and provides a seamless experience for receipt-based reward collection.

## 📱 Features

- **Receipt Upload**: Capture or select receipt images from your device
- **OCR Processing**: Automatic receipt parsing using Supabase Edge Functions
- **Reward System**: Earn USDT$ tokens for approved receipts
- **Campaign Promotions**: View and participate in active reward campaigns
- **User Profiles**: Manage personal information and wallet addresses
- **Referral System**: Invite friends and earn referral bonuses
- **Wallet Management**: Track earnings and connect Solana wallet for withdrawals
- **Real-time Updates**: Live notifications for receipt status changes
- **Receipt History**: View all submitted receipts with status tracking
- **Comprehensive Error Handling**: User-friendly error messages with toast notifications

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **Expo CLI** installed globally: `npm install -g @expo/cli`
- **Supabase Account** with a project set up
- **Mobile Device** (for testing) or **Expo Go** app installed from the App Store/Google Play

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   Create a `.env` file in the root directory:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   You can find these values in your Supabase Dashboard under **Settings > API**.

3. **Set up the backend (Required):**

   Before running the app, you need to set up the Supabase backend:

   - Follow the setup instructions in `../supabase-backend/README.md`
   - Ensure the database schema is deployed
   - Deploy all Edge Functions
   - Configure Row Level Security (RLS) policies

## 🏃 Running the Application

### Development Mode

```bash
# Start the development server
npm start

# Or use Expo CLI directly
npx expo start

# Start with web support (for web development)
npx expo start --web
```

This will start the Metro bundler and show a QR code. You can then:

- **Scan the QR code** with the Expo Go app on your phone
- **Press 'w'** in the terminal to open in web browser
- **Press 'a'** for Android emulator
- **Press 'i'** for iOS simulator

### Platform-specific Commands

```bash
# Android
npm run android
# or
npx expo start --android

# iOS
npm run ios
# or
npx expo start --ios

# Web only
npm run web
# or
npx expo start --web
```

### Production Build

```bash
# Build for production
npx expo build

# Build for specific platforms
npx expo build:android
npx expo build:ios
```

## 👥 User Guide

### Getting Started

#### 1. Account Creation

1. **Launch the app** on your mobile device
2. **Tap "Create Account"** if you're a new user
3. **Enter your email and password**
4. **Complete registration** - your account is created automatically

#### 2. Login

1. **Open the app**
2. **Enter your email and password**
3. **Tap "Sign In"** to access your account

### Core Features

#### Uploading Receipts

**Steps:**
1. From the **Home** screen, tap the **"Upload"** button or use the floating action button (FAB)
2. **Choose image source:**
   - **Camera**: Take a new photo of your receipt
   - **Gallery**: Select an existing receipt photo
3. **Review the preview** - ensure the receipt is clear and readable
4. **Confirm upload** - the app will process your receipt using OCR
5. **Wait for processing** - you'll receive a notification when processing is complete

**Tips:**
- Ensure good lighting when taking photos
- Keep the receipt flat and in focus
- Include the entire receipt in the frame
- Wait for OCR processing to complete before uploading another receipt

**Daily Limits:**
- You can upload up to **2 receipts per day**
- The limit resets at midnight

#### Viewing Receipt Status

**Steps:**
1. Navigate to **Wallet** tab (bottom navigation)
2. Scroll to **Recent Receipts** section
3. Tap on any receipt to view details
4. Check the status chip:
   - **Pending**: Awaiting initial processing
   - **Pending Review**: Under review by administrators
   - **Approved**: Verified and rewarded
   - **Rejected**: Not eligible for rewards
   - **Flagged**: Requires additional review
   - **Error**: Processing failed

**Status Details:**
- Tap any receipt card to see:
  - Receipt image
  - OCR extracted data
  - Processing status
  - Reward amount (if approved)
  - Campaign bonuses (if applicable)

#### Earning Rewards

**How Rewards Work:**
1. **Upload receipts** following the upload process above
2. **Wait for approval** - receipts go through automated and manual review
3. **Receive notification** when your receipt is approved
4. **Rewards are added** to your wallet balance automatically

**Reward Types:**
- **Base Rewards**: Standard rewards for approved receipts
- **Campaign Bonuses**: Additional rewards during active campaigns
- **Referral Bonuses**: Earned when people you refer earn rewards

#### Managing Your Profile

**Access Profile:**
1. Tap the **Profile** tab in bottom navigation
2. View your account information

**Profile Features:**
- **Personal Information**: Update name, age, gender, location
- **Wallet Connection**: Add Solana wallet address for withdrawals
- **Referral Code**: View and share your unique referral code
- **Settings**: Access app settings and preferences

**Connecting Solana Wallet:**
1. Open **Profile** tab
2. Navigate to wallet settings
3. Enter your Solana wallet address
4. Save your changes

#### Referral Program

**How to Refer:**
1. Navigate to **Referral** screen from Profile
2. **Copy your referral code** or share the referral link
3. **Share with friends** via any messaging platform
4. **Track referrals**: See who you've referred and their status

**Earning Referral Bonuses:**
- When someone uses your referral code, they become your referral
- You earn bonuses when:
  - They sign up (immediate bonus)
  - They earn rewards from receipts (percentage of their rewards)
- Track your referral earnings in the **Referral** screen

**Using a Referral Code:**
1. If you're a new user, you can enter a referral code during signup
2. Existing users can enter a code in the **Referral** screen
3. Enter the code and tap **"Apply Referral Code"**
4. Start earning with your referrer's bonuses

#### Viewing Your Wallet

**Wallet Screen:**
1. Navigate to **Wallet** tab
2. View your **Total Balance** in USDT$
3. See **Recent Transactions** and reward history
4. Check **Pending Receipts** awaiting review

**Balance Information:**
- **Total Balance**: Your current USDT$ earnings
- **Recent Transactions**: History of all rewards and adjustments
- **Wallet Address**: Shows connected Solana wallet (if set)

#### Campaigns and Promotions

**Viewing Active Campaigns:**
1. Navigate to **Home** screen
2. Scroll to **Active Campaigns** section
3. View campaign details:
   - Campaign name and description
   - Bonus amount or multiplier
   - Expiration date
   - Eligibility requirements

**Participating in Campaigns:**
- Campaigns are automatically applied to eligible receipts
- No additional action needed - just upload receipts during the campaign period
- Campaign bonuses appear in your reward notifications

**Campaign Types:**
- **Double Rewards**: 2x multiplier on base rewards
- **Fixed Bonuses**: Additional fixed amount per receipt
- **Store-specific**: Bonuses for specific merchant receipts
- **Referral Boosts**: Extra rewards for referred users

### Navigation

**Bottom Navigation Tabs:**
- **Home**: Dashboard with balance, campaigns, and quick actions
- **Wallet**: Detailed balance, transaction history, and receipts
- **Profile**: Account settings, referral code, and preferences

**Screen Navigation:**
- Use back button or swipe gestures to navigate between screens
- Tap cards and buttons to drill into details
- Use floating action buttons (FAB) for primary actions

### Notifications

**Notification Types:**
- **Receipt Approved**: When your receipt is verified and rewarded
- **Receipt Rejected**: When your receipt doesn't meet requirements
- **New Campaign**: When new promotions become available
- **Status Updates**: When receipt status changes

**Managing Notifications:**
- Notifications appear as toast messages in the app
- Enable push notifications in your device settings
- View notification history in relevant screens

## 🛠️ Error Handling System

The app includes a comprehensive error handling system that provides:

### Toast Notifications

- **Mobile-friendly**: Toast notifications instead of intrusive alerts
- **Multiple types**: Success, error, warning, and info toasts
- **Auto-dismiss**: Configurable duration with manual close option
- **Action buttons**: Optional action buttons for user interaction

### Error Parsing

- **Supabase errors**: Automatically parses PostgrestError responses
- **User-friendly messages**: Converts technical errors to readable messages
- **Error categorization**: Network, authentication, and database errors
- **Context awareness**: Provides context about where errors occurred

### Usage Examples

```typescript
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useToast } from "../components/ToastProvider";

function MyComponent() {
  const { handleError } = useErrorHandler({ context: "My Feature" });
  const { showSuccess, showError } = useToast();

  const handleApiCall = async () => {
    try {
      const { data, error } = await supabase.from("table").select("*");
      if (error) throw error;
      showSuccess("Data loaded successfully!");
    } catch (error) {
      handleError(error, "Loading data");
    }
  };
}
```

### Error Types Handled

- **Database errors** (42703, 23505, etc.): Column/table not found, constraint violations
- **Authentication errors**: Session expired, unauthorized access
- **Network errors**: Connection issues, timeouts
- **Generic errors**: Fallback for unknown error types

## 🔧 Technology Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **Supabase** for backend services
- **React Native Paper** for UI components
- **React Navigation** for navigation
- **Expo Image Picker** for camera/gallery access
- **Expo Notifications** for push notifications

## 📁 Project Structure

```
expo-blockcart/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Toast.tsx       # Toast notification component
│   │   ├── ToastProvider.tsx # Toast context provider
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   ├── useErrorHandler.ts # Error handling hook
│   │   └── ...
│   ├── lib/                # Utility libraries
│   │   ├── supabase.ts     # Supabase client configuration
│   │   ├── errorHandling.ts # Error parsing utilities
│   │   └── ...
│   ├── screens/            # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── UploadReceiptScreen.tsx
│   │   ├── WalletScreen.tsx
│   │   └── ...
│   ├── navigation/         # Navigation configuration
│   ├── context/           # React context providers
│   ├── theme/             # Theme configuration
│   └── types.ts           # TypeScript type definitions
├── assets/                # Images and static assets
├── App.tsx               # Main app component
└── package.json          # Dependencies and scripts
```

## 🔍 Development Workflow

1. **Make changes** to your code
2. **Save files** - changes will hot-reload automatically
3. **Test on device** using Expo Go app or simulators
4. **Debug** using React Native Debugger or console logs

## 🐛 Troubleshooting

### Common Issues

#### "Metro bundler process exited" Error

```bash
# Clear Metro cache
npx expo start --clear

# Or clear cache manually
rm -rf node_modules/.cache
```

#### Supabase Connection Issues

- Verify your `.env` file contains correct Supabase credentials
- Check that your Supabase project is active
- Ensure Row Level Security policies are properly configured
- Check network connectivity

#### Permission Errors

If you get "permission denied" errors:

1. Ensure RLS policies are set up correctly in Supabase
2. Check that your user is properly authenticated
3. Verify API keys in your `.env` file

#### Camera/Gallery Access Issues

- Check app permissions in device settings
- Grant camera and photo library permissions when prompted
- Ensure you're testing on a physical device or simulator with permissions enabled

#### Build Issues

```bash
# Clear all caches
npx expo start --clear
rm -rf .expo
rm -rf node_modules
npm install
```

### Error Handling Best Practices

1. **Always use the error handler**: Wrap API calls with `handleError`
2. **Provide context**: Include meaningful context in error messages
3. **Use appropriate toast types**: Choose success, error, warning, or info based on the situation
4. **Handle edge cases**: Consider network failures, empty responses, etc.
5. **Log for debugging**: Errors are automatically logged with original details

## 📱 App Screens Overview

- **HomeScreen**: Dashboard with balance, active campaigns, and quick actions
- **LoginScreen**: Authentication and account creation
- **UploadReceiptScreen**: Receipt capture and upload interface
- **WalletScreen**: Balance display, transaction history, and receipts
- **ReceiptListScreen**: List of all submitted receipts
- **ReceiptDetailScreen**: Detailed view of individual receipt
- **ProfileScreen**: User profile and settings
- **ReferralScreen**: Referral code management and tracking
- **CampaignDetailScreen**: Detailed campaign information

## 🤝 Contributing

When adding new features:

1. Use the error handling system for all API calls
2. Provide user-friendly feedback through toasts
3. Include proper TypeScript types
4. Test error scenarios thoroughly
5. Follow existing code patterns and conventions

## 📄 License

This project is licensed under the MIT License.

---

**Need Help?** Check the main [README.md](../README.md) for project overview and additional resources.
