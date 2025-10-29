# Blockcart Admin Dashboard

A comprehensive Next.js admin dashboard for managing receipt submissions, user referrals, reward campaigns, and platform analytics. Built with Next.js 15, TypeScript, and Supabase for a powerful administrative interface.

## 🎯 Features

- **User Management**: View and manage user accounts, roles, and permissions
- **Receipt Review**: Review, approve, or reject receipt submissions
- **Campaign Management**: Create and manage reward campaigns with rule builder
- **Reward Distribution**: Track and manage user rewards and payouts
- **Referral Tracking**: Monitor referral relationships and commissions
- **Analytics Dashboard**: Comprehensive analytics and reporting
- **Role-Based Access**: Separate admin and reviewer roles with appropriate permissions
- **Real-time Updates**: Live data updates and notifications
- **Campaign Templates**: Pre-built templates for common promotion types

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **npm**, **yarn**, or **pnpm** package manager
- **Supabase Account** with a project set up
- **Git** for version control

### Installation

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

### Running the Application

#### Development Mode

```bash
# Start the development server
npm run dev
# or
yarn dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`.

#### Production Mode

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

## 👥 User Guide

### Getting Started

#### Login

1. Navigate to the dashboard URL (default: `http://localhost:3000`)
2. You'll be redirected to `/login` if not authenticated
3. Enter your **email** and **password**
4. Click **"Sign In"** to access the dashboard

**Note**: Admin and reviewer accounts must be created in the `web_users` table in Supabase.

#### First-Time Setup

1. **Create Admin Account** (via Supabase Dashboard or SQL):
   ```sql
   INSERT INTO web_users (id, email, role, created_at)
   VALUES (gen_random_uuid(), 'admin@example.com', 'admin', NOW());
   ```
2. **Set Password** in Supabase Authentication
3. **Login** with your credentials

### Dashboard Overview

#### Main Dashboard (`/dashboard`)

The main dashboard provides an overview of platform activity:

**Statistics Cards:**
- **Total Receipts**: All receipts submitted
- **Pending Review**: Receipts awaiting reviewer action
- **Total Users**: All registered users (Admin only)
- **Active Users**: Users active in last 30 days (Admin only)
- **Active Campaigns**: Currently running campaigns (Admin only)
- **Approved Receipts**: Successfully verified receipts
- **Rejected Receipts**: Receipts that didn't meet criteria

**Sections:**
- **Recent Receipts**: Latest receipt submissions
- **Recent Activity**: Platform activity feed

#### Navigation

The dashboard uses a sidebar navigation with the following sections:

**For Admins:**
- Dashboard (Overview)
- Receipts (View and manage)
- Users (User management)
- Campaigns (Campaign management)
- Rewards (Reward tracking)
- Referrals (Referral program)
- Analytics (Reports and insights)
- Settings (Platform configuration)

**For Reviewers:**
- Dashboard (Overview)
- Receipts (Review and approve)

### Receipt Management

#### Viewing Receipts

**Steps:**
1. Navigate to **Receipts** in the sidebar
2. View the receipts table with:
   - Receipt ID
   - User information
   - Submission date
   - Status
   - Total amount
   - Actions

**Filtering:**
- Filter by status (Pending, Approved, Rejected, etc.)
- Filter by date range
- Search by user email or receipt ID

#### Reviewing Receipts

**Steps:**
1. Navigate to **Receipts** page
2. Click on a receipt row or **"View Details"** button
3. Review receipt details:
   - Receipt image
   - OCR extracted data
   - User information
   - Submission metadata
4. **Make a decision:**
   - **Approve**: Click "Approve" - user receives rewards
   - **Reject**: Click "Reject" - provide rejection reason
   - **Flag**: Mark for additional review
5. Save your decision

**Reviewer Workflow:**
- Reviewers see assigned receipts in their queue
- Focus on pending receipts requiring action
- Bulk actions available for multiple receipts

### Campaign Management

#### Viewing Campaigns

1. Navigate to **Campaigns** (Admin only)
2. View all active and inactive campaigns
3. See campaign details:
   - Name and description
   - Start/end dates
   - Reward configuration
   - Eligibility rules

#### Creating Campaigns

**Steps:**
1. Navigate to **Campaigns** page
2. Click **"Create Campaign"** button
3. **Basic Information:**
   - Campaign name
   - Description
   - Start date and end date
   - Active status

4. **Campaign Template** (optional):
   - Select a template:
     - **Double Rewards Weekend**: 2x multiplier with $25 minimum
     - **Grocery Basket Bonus**: Fixed bonus for grocery stores with $40 minimum
     - **Referral Boost**: Extra rewards for referred users
   - Templates pre-configure common settings

5. **Reward Configuration:**
   - **Reward Type**: Choose multiplier, fixed bonus, or percentage
   - **Reward Amount**: Set the reward value
   - **Multiplier**: Set multiplier (e.g., 2x for double rewards)

6. **Eligibility Rules:**
   - **Store Filtering**: Select eligible stores
   - **Minimum Spend**: Set minimum receipt total
   - **Demographics**: Filter by age, gender, location
   - **Referral Requirements**: Require referral relationship

7. **Preview Eligibility:**
   - Use the eligibility preview tool
   - See how many users/receipts would qualify
   - Adjust rules as needed

8. Click **"Create Campaign"** to save

#### Campaign Templates

**Double Rewards Weekend:**
- Multiplier: 2x base rewards
- Minimum spend: $25
- Quick setup for weekend promotions

**Grocery Basket Bonus:**
- Fixed bonus per receipt
- Store targeting: Grocery stores
- Minimum spend: $40
- Perfect for grocery-specific promotions

**Referral Boost:**
- Bonus for referred users
- Requires referral relationship
- Demographic verification enabled

#### Editing Campaigns

1. Navigate to **Campaigns** page
2. Find the campaign to edit
3. Click **"Edit"** button
4. Modify settings as needed
5. Click **"Save Changes"**

**Note**: Changes take effect immediately for active campaigns.

### User Management

#### Viewing Users

1. Navigate to **Users** (Admin only)
2. View user table with:
   - User ID
   - Email
   - Registration date
   - Total receipts
   - Total rewards
   - Status

**Filtering:**
- Filter by registration date
- Search by email
- Filter by activity status

#### User Details

1. Click on a user row
2. View comprehensive user information:
   - Profile details
   - Receipt history
   - Reward history
   - Referral information
   - Activity timeline

#### Managing Users

**Actions Available:**
- View user profile
- Review user receipts
- See reward history
- Check referral relationships
- View activity logs

### Reward Management

#### Viewing Rewards

1. Navigate to **Rewards** (Admin only)
2. View reward statistics:
   - Total rewards issued
   - Reward distribution chart
   - Top earners
   - Reward trends over time

#### Reward Details

- **Individual Rewards**: View each reward transaction
- **User Rewards**: See rewards per user
- **Campaign Rewards**: Track campaign-based rewards
- **Referral Bonuses**: Monitor referral rewards

#### Reward Status

- **Pending**: Awaiting approval
- **Approved**: Reward issued
- **Paid**: Withdrawal processed
- **Failed**: Processing error

### Referral Management

#### Viewing Referrals

1. Navigate to **Referrals** (Admin only)
2. View referral relationships:
   - Referrer information
   - Referee information
   - Status
   - Commission earned
   - Total referrals per user

#### Referral Analytics

- Total referral pairs
- Active referrals
- Commission totals
- Top referrers
- Referral conversion rates

### Analytics Dashboard

#### Accessing Analytics

1. Navigate to **Analytics** (Admin only)
2. View comprehensive platform metrics

#### Analytics Sections

**Overview Metrics:**
- Total receipts
- Approval rate
- Average processing time
- Total rewards issued

**Charts and Visualizations:**
- Receipt submission trends
- Reward distribution
- User growth
- Campaign performance
- Store category breakdown

**Time Range Selection:**
- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

**Export Options:**
- Export data as CSV
- Generate reports
- Download charts

### Settings

#### Platform Settings

1. Navigate to **Settings** (Admin only)
2. Configure platform-wide settings:

**Maintenance Mode:**
- Enable/disable maintenance mode
- Set maintenance message
- Schedule maintenance windows

**Admin Notifications:**
- Email notifications
- Review assignment alerts
- System alerts

**Invite Reviewers:**
- Send reviewer invitations
- Manage reviewer access
- View pending invitations

#### Reviewer Invitation Flow

1. Navigate to **Settings**
2. Scroll to **Reviewer Management**
3. Click **"Invite Reviewer"**
4. Enter reviewer email address
5. Click **"Send Invitation"**
6. Reviewer receives email with verification link
7. Reviewer clicks link and sets password
8. Reviewer can now access dashboard

### Role-Based Access

#### Admin Role

**Full Access:**
- All dashboard pages
- User management
- Campaign creation and management
- Analytics and reports
- Settings and configuration
- Reviewer invitation

#### Reviewer Role

**Limited Access:**
- Dashboard overview
- Receipt review (assigned receipts)
- View receipt details
- Approve/reject receipts
- Cannot access:
  - User management
  - Campaign management
  - Analytics
  - Settings

## 🔐 Authentication & Security

### Authentication Flow

1. **Login**: Users authenticate with email/password via Supabase
2. **Session Management**: JWT tokens stored in httpOnly cookies
3. **Role Verification**: User role checked from `web_users` table
4. **Route Protection**: Middleware validates sessions and roles

### Reviewer Invite Flow

1. **Admin sends invite** via Settings page
2. **Email sent** with verification token
3. **Reviewer clicks link** → redirects to `/reviewer-verify`
4. **Token verified** and session established
5. **Password setup** by reviewer
6. **Access granted** to reviewer-only pages

### Security Best Practices

- Use strong passwords for admin accounts
- Regularly review user access
- Monitor login attempts
- Keep Supabase credentials secure
- Enable 2FA when available

## 🛠️ Technology Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **React 19** for UI
- **Supabase** for backend and authentication
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Recharts** for data visualization

## 📁 Project Structure

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
│   ├── reviewer-verify/         # Reviewer invite acceptance
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

## 🔍 Development Workflow

1. **Start the development server** with `npm run dev`
2. **Make changes** to your code - Next.js will hot-reload automatically
3. **Test authentication** by creating admin users in Supabase
4. **Test database operations** using the Supabase Dashboard
5. **Debug** using browser dev tools or VS Code debugger

## 🚀 Deployment

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

## 🐛 Troubleshooting

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

### Reviewer Access Issues

- Verify reviewer account exists in `web_users` table
- Check role is set to "reviewer"
- Ensure reviewer completed invitation flow
- Verify token hasn't expired

## 📊 Campaign Templates & Eligibility

### Template System

The dashboard includes pre-built campaign templates that map to the `rule_json` schema:

- **Double Rewards Weekend**: Toggles multiplier with minimum spend
- **Grocery Basket Bonus**: Fixed bonus with store targeting
- **Referral Boost**: Bonus for referral relationships

### Eligibility Preview

When creating campaigns:
1. Configure campaign rules
2. Use **eligibility preview** tool
3. See how many users/receipts qualify
4. Adjust rules based on preview
5. Create campaign with confidence

The preview uses:
- `campaign_eligibility_snapshots` view
- `preview_campaign_rule` RPC function

## 🤝 Contributing

When adding new features:

1. Follow existing code patterns
2. Use TypeScript for type safety
3. Maintain role-based access control
4. Test with both admin and reviewer roles
5. Update documentation

## 📄 License

This project is licensed under the MIT License.

---

**Need Help?** Check the main [README.md](../README.md) for project overview and additional resources.
