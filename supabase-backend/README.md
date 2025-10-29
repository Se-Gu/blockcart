# Blockcart Supabase Backend

Backend infrastructure for the Blockcart receipt rewards platform, including database migrations, SQL schemas, and Supabase Edge Functions for serverless backend logic.

## 📋 Overview

The backend consists of:

- **Database migrations** and schema definitions
- **Supabase Edge Functions** for serverless backend logic
- **SQL views** for complex queries and data aggregation
- **Row Level Security (RLS)** policies for data access control

## 🏗️ Project Structure

```
supabase-backend/
├── database/
│   ├── migrations/
│   │   ├── migration_add_email_to_web_users.sql         # Add email to web_users
│   │   ├── migration_fix_schema_discrepancies.sql       # Schema fixes
│   │   ├── migration_add_reviewer_notifications.sql     # Create notifications table
│   │   ├── migration_add_notification_fields.sql        # Add title, message, status columns
│   │   ├── migration_add_campaign_rule_helpers.sql       # Campaign rule helper functions
│   │   ├── migration_add_match_active_campaigns_function.sql # Campaign matching
│   │   ├── migration_add_referral_code_function.sql     # Referral code generation
│   │   ├── migration_add_status_and_paid_at_to_rewards.sql # Reward status tracking
│   │   ├── migration_add_unique_index_to_rewards_receipt_id.sql # Unique receipts
│   │   ├── migration_add_user_review_notifications.sql   # User notification system
│   │   ├── migration_auto_update_auth_raw_data_from_web_users.sql # Auth sync
│   │   └── ...                                          # Other migrations
│   ├── schema.sql                                       # Main database schema
│   └── views.sql                                        # Database views
└── edge-functions/
    ├── admin-settings.ts                      # Admin configuration management
    ├── analytics-dashboard.ts                 # Analytics data aggregation
    ├── invite-reviewer.ts                     # Reviewer invitation system
    ├── ocr-parser.ts                          # Receipt OCR processing
    ├── review-handler.ts                      # Receipt review workflow
    ├── reward-handler.ts                      # Reward distribution logic
    ├── run-maintenance-task.ts                # System maintenance tasks
    ├── set-maintenance-mode.ts                # Maintenance mode toggle
    └── upload-receipt.ts                      # Receipt upload handling
```

## 🚀 Prerequisites

- **Supabase Account**: You need a Supabase project set up
- **Supabase CLI**: Install the Supabase CLI for local development
  ```bash
  npm install -g supabase
  ```
- **Node.js**: For running Edge Functions locally (optional)

## 📦 Setup Instructions

### 1. Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Note down your project URL and anon key from the project settings
3. Access your project dashboard

### 2. Database Schema Setup

#### Option A: Using Supabase Dashboard (Recommended for beginners)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run the migration files in order from the `database/migrations/` directory:

   ```sql
   -- Run migrations in chronological order:
   -- 1. migration_fix_schema_discrepancies.sql
   -- 2. migration_add_email_to_web_users.sql
   -- 3. migration_add_reviewer_notifications.sql
   -- 4. migration_add_notification_fields.sql
   -- 5. ... (continue with other migrations)
   ```

4. Copy and paste each migration file's contents into the SQL editor
5. Execute each migration in order

#### Option B: Using Supabase CLI (Recommended for developers)

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push database changes
supabase db push

# Or apply migrations individually
supabase migration up
```

#### Option C: Using the Main Schema File

1. Go to **SQL Editor** in Supabase Dashboard
2. Open `database/schema.sql`
3. Copy and execute the entire schema file
4. Then apply any additional migrations as needed

### 3. Database Views Setup

1. Go to **SQL Editor** in Supabase Dashboard
2. Open `database/views.sql`
3. Copy and execute the views file
4. These views provide convenient queries for common operations

### 4. Enable Row Level Security (RLS)

The application uses Row Level Security for data access control. RLS should be enabled on all tables with appropriate policies. Check the schema.sql file for RLS policy definitions.

**Important**: Verify RLS policies are correctly set up:
- Users can only access their own data
- Admins can access all data
- Reviewers can access assigned receipts
- Public access is restricted appropriately

### 5. Edge Functions Setup

#### Deploy Edge Functions

**Option A: Via Supabase Dashboard**

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **"Create Function"** for each function
3. Copy the contents of the respective `.ts` files from `edge-functions/`
4. Paste into the function editor
5. Deploy each function

**Option B: Via Supabase CLI (Recommended)**

```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy --project-ref your-project-ref

# Or deploy specific functions
supabase functions deploy ocr-parser --project-ref your-project-ref
supabase functions deploy upload-receipt --project-ref your-project-ref
supabase functions deploy review-handler --project-ref your-project-ref
supabase functions deploy reward-handler --project-ref your-project-ref
supabase functions deploy invite-reviewer --project-ref your-project-ref
supabase functions deploy admin-settings --project-ref your-project-ref
supabase functions deploy analytics-dashboard --project-ref your-project-ref
supabase functions deploy set-maintenance-mode --project-ref your-project-ref
supabase functions deploy run-maintenance-task --project-ref your-project-ref
```

### 6. Configure Edge Function Secrets

Some Edge Functions may require environment variables or secrets. Set these in the Supabase Dashboard:

1. Go to **Edge Functions** > **Settings**
2. Add secrets as needed (e.g., API keys for external services)

## 🧪 Running Locally (Development)

### Database Development

```bash
# Start local Supabase instance
supabase start

# This starts:
# - Local PostgreSQL database
# - Local Supabase API
# - Local Edge Functions runtime
# - Local Studio at http://localhost:54323

# Generate types from your database schema
supabase gen types typescript --local > types/supabase.ts

# Reset database (applies all migrations)
supabase db reset

# Create a new migration
supabase migration new migration_name

# Apply pending migrations
supabase migration up
```

### Edge Functions Development

```bash
# Serve functions locally
supabase functions serve --env-file .env.local

# Serve specific function
supabase functions serve ocr-parser --env-file .env.local

# The functions will be available at:
# http://localhost:54321/functions/v1/function-name
```

### Testing Edge Functions Locally

1. Start local Supabase: `supabase start`
2. Serve functions: `supabase functions serve`
3. Test endpoints using curl or Postman:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/upload-receipt \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

## 🔐 Environment Variables

### For Local Development

Create a `.env.local` file:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# Optional: Configure transactional email delivery for receipt updates
# RESEND_API_KEY=your-resend-api-key
# RESEND_FROM_EMAIL=Blockcart <no-reply@yourdomain.com>

# Optional: OCR service configuration
# OCR_API_KEY=your-ocr-service-api-key
```

### For Production

Set these in your Supabase Dashboard under **Settings > API** and **Edge Functions > Settings**:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Optional: Configure transactional email delivery
# RESEND_API_KEY=your-resend-api-key
# RESEND_FROM_EMAIL=Blockcart <no-reply@yourdomain.com>
```

## 🔧 Edge Functions Overview

### Core Functions

#### `ocr-parser.ts`
- **Purpose**: Processes receipt images using OCR technology
- **Triggers**: Called by `upload-receipt` function
- **Input**: Base64 encoded receipt image
- **Output**: Extracted receipt data (store, items, total, date)
- **Dependencies**: OCR service API (configure via secrets)

#### `upload-receipt.ts`
- **Purpose**: Handles receipt upload and initial processing
- **Triggers**: Called from mobile app
- **Input**: Receipt image and metadata
- **Output**: Receipt record in database
- **Flow**:
  1. Validates user and daily limits
  2. Stores receipt image
  3. Calls OCR parser
  4. Creates receipt record
  5. Matches active campaigns
  6. Returns receipt ID

#### `review-handler.ts`
- **Purpose**: Manages the receipt review workflow
- **Triggers**: Called from admin dashboard
- **Input**: Receipt ID and review decision
- **Output**: Updated receipt status
- **Actions**:
  - Approve receipt
  - Reject receipt with reason
  - Flag for additional review
  - Assign to reviewers
  - Send notifications

#### `reward-handler.ts`
- **Purpose**: Distributes rewards for approved receipts
- **Triggers**: Called automatically when receipt is approved
- **Input**: Receipt ID
- **Output**: Reward record and updated balance
- **Functionality**:
  - Calculates base reward
  - Applies campaign bonuses
  - Processes referral bonuses
  - Updates user balance
  - Creates reward transaction

### Admin Functions

#### `admin-settings.ts`
- **Purpose**: Manages admin configuration settings
- **Triggers**: Called from admin dashboard settings
- **Functions**:
  - Get/update maintenance mode
  - Get/update platform settings
  - Manage system configuration

#### `invite-reviewer.ts`
- **Purpose**: Handles reviewer invitation process
- **Triggers**: Called from admin dashboard
- **Input**: Reviewer email
- **Output**: Invitation email sent
- **Flow**:
  1. Validates admin permissions
  2. Creates invite token
  3. Sends email via Supabase Auth
  4. Creates reviewer record

#### `analytics-dashboard.ts`
- **Purpose**: Aggregates analytics data for dashboard
- **Triggers**: Called from admin dashboard
- **Output**: Aggregated metrics and statistics
- **Data Provided**:
  - Receipt statistics
  - User statistics
  - Reward statistics
  - Campaign performance
  - Time-series data

#### `set-maintenance-mode.ts`
- **Purpose**: Toggles maintenance mode
- **Triggers**: Called from admin dashboard
- **Input**: Maintenance status and message
- **Output**: Updated maintenance settings

#### `run-maintenance-task.ts`
- **Purpose**: Executes system maintenance tasks
- **Triggers**: Scheduled or manual execution
- **Functions**:
  - Clean up old data
  - Process pending items
  - Generate reports
  - Data integrity checks

## 🗄️ Database Schema

### Main Entities

#### `users`
- Mobile app users (managed by Supabase Auth)
- Fields: id, referral_code, referred_by, wallet_address, profile data
- RLS: Users can read/update own data

#### `receipts`
- User-submitted receipts with OCR data
- Fields: id, user_id, image_url, ocr_data, status, total, store, date
- RLS: Users can read own receipts, reviewers can read assigned

#### `web_users`
- Admin and reviewer accounts
- Fields: id, email, role, created_at, updated_at
- RLS: Only admins can read all, users can read own

#### `campaigns`
- Reward campaigns with rules and dates
- Fields: id, name, description, start_date, end_date, rule_json, reward_amount, multiplier
- RLS: Public read for active campaigns, admin write

#### `rewards`
- User rewards and point balances
- Fields: id, user_id, receipt_id, amount, campaign_id, status, paid_at
- RLS: Users can read own rewards, admins can read all

#### `referrals`
- Referral tracking and commission data
- Fields: id, referrer, referee, status, bonus, commission_rate
- RLS: Users can read own referrals

#### `reviewer_notifications`
- Notifications for reviewers when receipts are assigned
- Fields: id, reviewer_id, receipt_id, title, message, status, read_at
- RLS: Reviewers can read own notifications

#### `receipt_assignments`
- Tracks which receipts are assigned to which reviewers
- Fields: id, receipt_id, reviewer_id, assigned_at
- RLS: Reviewers can read own assignments

### Views

#### `campaign_eligibility_snapshots`
- Snapshot of users/receipts eligible for campaigns
- Used for campaign preview and analytics

#### Other Views
- Check `views.sql` for complete list of database views

### Recent Schema Changes

**Migration: Add Notification Fields**
- Added `title`, `message`, and `status` columns to `reviewer_notifications` table
- These fields enable rich notifications in the mobile app
- A trigger automatically syncs `status` with `read_at` timestamp
- See `database/migrations/migration_add_notification_fields.sql`

## 🔒 Security Best Practices

1. **Row Level Security (RLS)**: Always enabled on all tables
2. **Service Role Key**: Never expose in client-side code
3. **Anon Key**: Safe for public client use
4. **Edge Functions**: Validate authentication in function logic
5. **SQL Injection**: Use parameterized queries (Supabase handles this)
6. **Rate Limiting**: Implement in Edge Functions where needed

## 📊 Database Maintenance

### Regular Maintenance Tasks

1. **Clean up old data**: Archive or delete old receipts/rewards
2. **Optimize indexes**: Monitor query performance
3. **Backup regularly**: Use Supabase automatic backups
4. **Monitor usage**: Track database size and API calls
5. **Review RLS policies**: Ensure security policies are current

### Running Maintenance

```bash
# Call maintenance function
supabase functions invoke run-maintenance-task \
  --project-ref your-project-ref \
  --method POST
```

## 🚀 Deployment

### Production Deployment Checklist

1. **Database Migrations**
   - [ ] Review all pending migrations
   - [ ] Test migrations on staging
   - [ ] Apply migrations to production
   - [ ] Verify schema matches

2. **Edge Functions**
   - [ ] Test all functions locally
   - [ ] Deploy all functions to production
   - [ ] Set production secrets
   - [ ] Test function endpoints

3. **RLS Policies**
   - [ ] Verify all policies are active
   - [ ] Test access from different roles
   - [ ] Verify public access restrictions

4. **Monitoring**
   - [ ] Set up error alerts
   - [ ] Monitor function performance
   - [ ] Track database performance
   - [ ] Monitor API usage

### Deployment Commands

```bash
# Deploy all functions
supabase functions deploy --project-ref your-project-ref

# Deploy specific function
supabase functions deploy function-name --project-ref your-project-ref

# Push database changes
supabase db push --project-ref your-project-ref
```

## 🔍 Monitoring

### Supabase Dashboard

Monitor your Edge Functions and database performance through:

- **Edge Functions Logs**: View function execution logs
- **Database Performance**: Monitor query performance
- **API Usage**: Track API call volume
- **Error Logs**: View and debug errors
- **Analytics**: Platform usage statistics

### Key Metrics to Monitor

- Edge Function execution time
- Database query performance
- API call volume
- Error rates
- Receipt processing time
- Reward calculation accuracy

## 🐛 Troubleshooting

### Common Issues

#### Edge Functions not deploying

```bash
# Check authentication
supabase login

# Verify project is linked
supabase link --project-ref your-project-ref

# Check function syntax
supabase functions serve --env-file .env.local
```

#### Database connection errors

- Verify RLS policies are correctly set up
- Check that your API keys are correct
- Ensure project is active in Supabase Dashboard
- Review connection string format

#### OCR Function errors

- Ensure proper environment variables for OCR service
- Check function logs in Supabase Dashboard
- Verify image format and size limits
- Check OCR service API status

#### Migration conflicts

- Review migration order
- Check for conflicting schema changes
- Use `supabase migration repair` if needed
- Test migrations on staging first

### Getting Help

- Check Supabase [documentation](https://supabase.com/docs)
- Review Edge Functions [logs](https://supabase.com/dashboard/functions) in your Dashboard
- Monitor database [performance](https://supabase.com/dashboard/database/performance)
- Check migration history in SQL Editor

## 🤝 Contributing

When adding new Edge Functions or migrations:

### Edge Functions

1. **Follow naming convention**: Use `kebab-case.ts`
2. **Include error handling**: Catch and log errors properly
3. **Add JSDoc comments**: Document function parameters and returns
4. **Test thoroughly**: Test locally before deployment
5. **Type safety**: Use TypeScript types for all inputs/outputs

### Migrations

1. **Naming**: Use descriptive names like `migration_add_feature_name.sql`
2. **Idempotency**: Ensure migrations can be run multiple times safely
3. **Documentation**: Add comments explaining the migration
4. **Backward compatibility**: Consider rolling back when needed
5. **Test on staging**: Always test migrations before production

### Example Migration Template

```sql
-- Migration: migration_add_feature_name.sql
-- Description: Brief description of what this migration does
-- Date: YYYY-MM-DD

-- Add new table/column/function
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON new_table FOR SELECT
  USING (auth.uid() = user_id);
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 📄 License

This project is licensed under the MIT License.

---

**Need Help?** Check the main [README.md](../README.md) for project overview and additional resources.
