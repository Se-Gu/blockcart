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

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.local.example .env.local
   # Add your Supabase URL and API key
   ```

3. **Configure Supabase Row Level Security (RLS)**:

   Before running the app, you must set up RLS policies in your Supabase database:

   - Open your Supabase Dashboard
   - Navigate to: **SQL Editor**
   - Copy the contents of `SUPABASE_RLS_SETUP.sql`
   - Paste and run the SQL commands

   This step is **required** to allow the app to access the database. Without RLS policies, you'll get "permission denied" errors.

4. Start the development server:
   ```bash
   npx expo start --web
   ```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Toast.tsx       # Toast notification component
│   ├── ToastProvider.tsx # Toast context provider
│   └── ...
├── hooks/              # Custom React hooks
│   └── useErrorHandler.ts # Error handling hook
├── lib/                # Utility libraries
│   ├── supabase.ts     # Supabase client configuration
│   └── errorHandling.ts # Error parsing utilities
├── screens/            # App screens
├── navigation/         # Navigation configuration
└── types.ts           # TypeScript type definitions
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
