# Blockcart Admin Dashboard

A Next.js application for managing receipt submissions, user referrals, and reward campaigns.

## Features

- User authentication and authorization
- Receipt management and approval
- User management
- Campaign creation and management
- Reward distribution
- Referral tracking
- Analytics dashboard

## Authentication

### Supabase Authentication Setup

This application uses Supabase for authentication. Make sure you have the following environment variables configured:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Authentication Flow

1. **Login Process**: Users enter their email and password
2. **Supabase Response**: Returns user session and user data
3. **Session Management**: JWT tokens are stored in httpOnly cookies
4. **Route Protection**: Middleware checks for valid sessions

### Expected Supabase Authentication Responses

#### Successful Login Response

```typescript
{
  data: {
    user: {
      id: "uuid",
      email: "user@example.com",
      email_confirmed_at: "2024-01-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      aud: "authenticated",
      role: "authenticated"
    },
    session: {
      access_token: "jwt_token",
      refresh_token: "refresh_token",
      expires_in: 3600,
      expires_at: 1704067200,
      token_type: "bearer",
      user: {
        id: "uuid",
        email: "user@example.com",
        // ... user data
      }
    }
  },
  error: null
}
```

#### Authentication Error Responses

```typescript
// Invalid credentials
{
  data: { user: null, session: null },
  error: {
    message: "Invalid login credentials",
    status: 400
  }
}

// User not found
{
  data: { user: null, session: null },
  error: {
    message: "User not found",
    status: 400
  }
}

// Too many requests
{
  data: { user: null, session: null },
  error: {
    message: "Too many requests. Please try again later.",
    status: 429
  }
}
```

#### Session Check Response

```typescript
{
  data: {
    session: {
      access_token: "jwt_token",
      refresh_token: "refresh_token",
      // ... session data
    }
  },
  error: null
}
```

#### Current User Response

```typescript
{
  data: {
    user: {
      id: "uuid",
      email: "user@example.com",
      email_confirmed_at: "2024-01-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      aud: "authenticated",
      role: "authenticated"
    }
  },
  error: null
}
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn or pnpm

### Installation

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Running Locally

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Schema

The application expects the following Supabase tables:

- `web_users` - Web dashboard users with roles (admin, reviewer)
- `receipts` - Receipt submissions
- `campaigns` - Reward campaigns
- `rewards` - User rewards
- `referrals` - Referral tracking
