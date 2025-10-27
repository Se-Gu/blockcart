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

## Campaign templates & eligibility tooling

Blockcart partnerships can now launch promotions without touching raw JSON. The
dashboard surfaces curated templates that map directly to the structured
`rule_json` schema:

- **Double Rewards Weekend** – toggles the `multiplier_overrides.double_base`
  flag while enforcing a `$25` `min_spend`.
- **Grocery Basket Bonus** – uses the `fixed_bonus` reward type with
  store-specific targeting via `eligible_stores` and a `$40` minimum receipt
  total.
- **Referral Boost** – enables the `referral_boost` reward type, requires a
  referral relationship (`referral.required`) and enforces verified identities
  through the demographic filters.

While configuring a campaign you can select one of these templates, tweak
individual fields through structured inputs (store pickers, demographic
filters, and multiplier toggles), and view live eligibility counts powered by
the Supabase `campaign_eligibility_snapshots` view and `preview_campaign_rule`
RPC.

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

### Reviewer Invite Flow

1. **Invite Sent**: Admin sends invite via `/dashboard/settings` (calls `invite-reviewer` edge function)
2. **Email Received**: Reviewer receives invite email from Supabase with verification link
3. **Link Clicked**: Reviewer clicks link which redirects to `/reviewer-verify?token=...`
4. **Token Verification**: Page verifies the token and establishes Supabase session
5. **Password Setup**: Reviewer sets their password
6. **Session Established**: User is authenticated and redirected to `/dashboard`
7. **Access Granted**: Reviewer can now access reviewer-only pages (e.g., `/dashboard/receipts`)

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

## Prerequisites

- **Node.js** 18+ installed
- **npm**, **yarn**, or **pnpm** package manager
- **Supabase Account** with a project set up
- **Git** for version control

## Installation

1. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

2. **Set up environment variables:**

   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

   You can find these values in your Supabase Dashboard under **Settings > API**.

3. **Set up the backend (Required):**

   Before running the dashboard, you need to set up the Supabase backend:

   - Follow the setup instructions in `../supabase-backend/README.md`
   - Ensure the database schema is deployed
   - Deploy all Edge Functions
   - Configure Row Level Security (RLS) policies
   - Create admin user accounts in the `web_users` table

## Running the Application

### Development Mode

```bash
# Start the development server
npm run dev
# or
yarn dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Production Mode

```bash
# Build the application
npm run build
# or
yarn build
# or
pnpm build

# Start the production server
npm start
# or
yarn start
# or
pnpm start
```

### Additional Commands

```bash
# Lint the code
npm run lint
# or
yarn lint
# or
pnpm lint

# Type checking (if using TypeScript)
npm run type-check
# or
yarn type-check
# or
pnpm type-check
```

## Project Structure

```
next-blockcart/
├── app/                          # Next.js 13+ app directory
│   ├── dashboard/                # Admin dashboard pages
│   │   ├── _components/         # Dashboard components
│   │   ├── analytics/           # Analytics pages
│   │   ├── campaigns/           # Campaign management
│   │   ├── receipts/            # Receipt management
│   │   ├── referrals/           # Referral tracking
│   │   ├── rewards/             # Reward management
│   │   ├── settings/            # Admin settings
│   │   ├── users/               # User management
│   │   ├── layout.tsx           # Dashboard layout
│   │   └── page.tsx             # Main dashboard page
│   ├── login/                   # Authentication page
│   ├── reviewer-verify/         # Reviewer invite acceptance & password setup
│   ├── globals.css              # Global styles
│   └── layout.tsx               # Root layout
├── components/                  # Reusable components
│   ├── ui/                      # UI component library
│   ├── dashboard-layout.tsx     # Dashboard layout component
│   └── ...
├── hooks/                       # Custom React hooks
├── lib/                         # Utility libraries
│   ├── supabase/                # Supabase client configuration
│   ├── auth-context.tsx         # Authentication context
│   └── ...
├── middleware.ts                # Next.js middleware for auth
├── styles/                      # Additional styles
└── public/                      # Static assets
```

## Authentication Setup

The application uses Supabase for authentication with the following features:

- **Email/password authentication**
- **Email invite system** for reviewers
- **Password reset flow** for invited users
- **JWT token management**
- **Protected routes via middleware**
- **Role-based access control** (admin, reviewer)

### Creating Admin Users

1. **Via Supabase Dashboard:**

   - Go to **Authentication > Users**
   - Create users with email/password
   - Add user roles in the `web_users` table

2. **Via SQL:**
   ```sql
   INSERT INTO web_users (id, email, role, created_at)
   VALUES (gen_random_uuid(), 'admin@example.com', 'admin', NOW());
   ```

## Database Integration

The application expects the following Supabase tables to be set up:

- **`web_users`**: Admin and reviewer accounts with roles
- **`receipts`**: Receipt submissions with status tracking
- **`campaigns`**: Reward campaigns with rules and dates
- **`rewards`**: User rewards and point balances
- **`referrals`**: Referral tracking and commission data

See `../supabase-backend/database/schema.sql` for the complete schema.

## Development Workflow

1. **Start the development server** with `npm run dev`
2. **Make changes** to your code - Next.js will hot-reload automatically
3. **Test authentication** by creating admin users in Supabase
4. **Test database operations** using the Supabase Dashboard
5. **Debug** using browser dev tools or VS Code debugger

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. **Deploy** - Vercel will automatically build and deploy

### Other Platforms

For manual deployment:

```bash
# Build for production
npm run build

# The .next folder will be created with optimized build
```

## Common Issues and Solutions

### Authentication Issues

- **"Invalid login credentials"**: Check user exists in `web_users` table
- **"Unauthorized" errors**: Verify user role and permissions
- **Session issues**: Clear browser cookies and try again

### Database Connection Issues

- Verify environment variables are correct
- Check Supabase project is active
- Ensure RLS policies allow dashboard access
- Check network connectivity

### Build Issues

```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Clear node_modules if needed
rm -rf node_modules
npm install
```

### TypeScript Issues

```bash
# Check types
npm run type-check

# Fix common TypeScript issues
npm run lint
```

## API Routes

The application uses Next.js API routes for server-side operations:

- **Authentication endpoints**
- **Data fetching for dashboard**
- **Admin operations**

## Monitoring and Analytics

- **Error monitoring**: Check browser console for client errors
- **Performance**: Use Next.js built-in analytics
- **Database**: Monitor through Supabase Dashboard
