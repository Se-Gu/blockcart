# Blockcart - Receipt Rewards App

A React Native app built with Expo that allows users to upload receipts and earn rewards through Supabase integration.

## Features

- **Receipt Upload**: Capture or select receipt images
- **OCR Processing**: Automatic receipt parsing using Supabase Edge Functions
- **Reward System**: Earn BCT$ tokens for approved receipts
- **User Profiles**: Manage personal information and referral codes
- **Real-time Updates**: Live notifications for receipt status changes
- **Comprehensive Error Handling**: User-friendly error messages with toast notifications

## Error Handling System

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

## Technology Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **Supabase** for backend services
- **React Native Paper** for UI components
- **React Navigation** for navigation
- **Expo Image Picker** for camera/gallery access
- **Expo Notifications** for push notifications

## Prerequisites

- **Node.js** 18+ installed
- **Expo CLI** installed globally: `npm install -g @expo/cli`
- **Supabase Account** with a project set up
- **Mobile Device** (for testing) or **Expo Go** app installed

## Installation

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

## Running the Application

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

## Development Workflow

1. **Make changes** to your code
2. **Save files** - changes will hot-reload automatically
3. **Test on device** using Expo Go app or simulators
4. **Debug** using React Native Debugger or console logs

## Common Issues and Solutions

### "Metro bundler process exited" Error

```bash
# Clear Metro cache
npx expo start --clear

# Or clear cache manually
rm -rf node_modules/.cache
```

### Supabase Connection Issues

- Verify your `.env` file contains correct Supabase credentials
- Check that your Supabase project is active
- Ensure Row Level Security policies are properly configured
- Check network connectivity

### Permission Errors

If you get "permission denied" errors:

1. Ensure RLS policies are set up correctly in Supabase
2. Check that your user is properly authenticated
3. Verify API keys in your `.env` file

### Build Issues

```bash
# Clear all caches
npx expo start --clear
rm -rf .expo
rm -rf node_modules
npm install
```

## Project Structure

```
expo-blockcart/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Toast.tsx       # Toast notification component
│   │   ├── ToastProvider.tsx # Toast context provider
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   └── useErrorHandler.ts # Error handling hook
│   ├── lib/                # Utility libraries
│   │   ├── supabase.ts     # Supabase client configuration
│   │   ├── errorHandling.ts # Error parsing utilities
│   │   └── ...
│   ├── screens/            # App screens
│   ├── navigation/         # Navigation configuration
│   ├── context/           # React context providers
│   ├── theme/             # Theme configuration
│   └── types.ts           # TypeScript type definitions
├── assets/                # Images and static assets
├── App.tsx               # Main app component
└── package.json          # Dependencies and scripts
```

## Error Handling Best Practices

1. **Always use the error handler**: Wrap API calls with `handleError`
2. **Provide context**: Include meaningful context in error messages
3. **Use appropriate toast types**: Choose success, error, warning, or info based on the situation
4. **Handle edge cases**: Consider network failures, empty responses, etc.
5. **Log for debugging**: Errors are automatically logged with original details

## Contributing

When adding new features:

1. Use the error handling system for all API calls
2. Provide user-friendly feedback through toasts
3. Include proper TypeScript types
4. Test error scenarios thoroughly
