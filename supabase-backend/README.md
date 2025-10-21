# Blockcart Supabase Backend

This directory contains the backend infrastructure for the Blockcart receipt rewards application, including database migrations, SQL schemas, and Supabase Edge Functions.

## Overview

The backend consists of:

- **Database migrations** and schema definitions
- **Supabase Edge Functions** for serverless backend logic
- **SQL views** for complex queries and data aggregation

## Project Structure

```
supabase-backend/
├── database/
│   ├── migration_add_email_to_web_users.sql    # Migration to add email to web_users
│   ├── migration_fix_schema_discrepancies.sql  # Schema fixes migration
│   ├── migration_scripts/                      # Additional migration scripts
│   ├── schema.sql                             # Main database schema
│   └── views.sql                              # Database views
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

## Prerequisites

- **Supabase Account**: You need a Supabase project set up
- **Supabase CLI**: Install the Supabase CLI for local development
- **Node.js**: For running Edge Functions locally (optional)

## Setup Instructions

### 1. Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Note down your project URL and anon key from the project settings

### 2. Database Schema Setup

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run the schema files in order:

   ```sql
   -- Run schema.sql first (main schema)
   -- Then run migration_fix_schema_discrepancies.sql
   -- Finally run migration_add_email_to_web_users.sql
   ```

4. Alternatively, use the Supabase CLI:

   ```bash
   # Link to your project
   supabase link --project-ref your-project-ref

   # Push database changes
   supabase db push
   ```

### 3. Enable Row Level Security (RLS)

The application uses Row Level Security for data access control. Make sure RLS is enabled on all tables and appropriate policies are set up.

### 4. Edge Functions Setup

#### Deploy Edge Functions

1. **Via Supabase Dashboard:**

   - Go to **Edge Functions** in your Supabase Dashboard
   - Create each function by copying the contents of the respective `.ts` files
   - Deploy each function

2. **Via Supabase CLI (Recommended):**

   ```bash
   # Link to your project
   supabase link --project-ref your-project-ref

   # Deploy all functions
   supabase functions deploy --project-ref your-project-ref

   # Or deploy specific functions
   supabase functions deploy ocr-parser --project-ref your-project-ref
   supabase functions deploy upload-receipt --project-ref your-project-ref
   # ... deploy other functions as needed
   ```

## Running Locally (Development)

### Database Development

```bash
# Start local Supabase instance
supabase start

# Generate types from your database schema
supabase gen types typescript --local > types/supabase.ts

# Run migrations
supabase db reset
```

### Edge Functions Development

```bash
# Serve functions locally
supabase functions serve --env-file .env.local

# The functions will be available at:
# http://localhost:54321/functions/v1/function-name
```

## Environment Variables

Create a `.env.local` file for local development:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

For production, set these in your Supabase Dashboard under **Settings > API**:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
```

## Edge Functions Overview

### Core Functions

- **`ocr-parser.ts`**: Processes receipt images using OCR technology
- **`upload-receipt.ts`**: Handles receipt upload and initial processing
- **`review-handler.ts`**: Manages the receipt review workflow
- **`reward-handler.ts`**: Distributes rewards for approved receipts

### Admin Functions

- **`admin-settings.ts`**: Manages admin configuration settings
- **`invite-reviewer.ts`**: Handles reviewer invitation process
- **`analytics-dashboard.ts`**: Aggregates analytics data
- **`set-maintenance-mode.ts`**: Toggles maintenance mode
- **`run-maintenance-task.ts`**: Executes system maintenance tasks

## Database Schema

The main entities in the database include:

- **`receipts`**: User-submitted receipts
- **`web_users`**: Admin and reviewer accounts
- **`campaigns`**: Reward campaigns
- **`rewards`**: User rewards and points
- **`referrals`**: Referral tracking

See `database/schema.sql` for the complete schema definition.

## Deployment

### Production Deployment

1. **Database**: Deploy schema changes through Supabase Dashboard or CLI
2. **Edge Functions**: Deploy via CLI or Dashboard as described above
3. **Environment Variables**: Set production values in Supabase Dashboard

### Monitoring

Monitor your Edge Functions and database performance through:

- Supabase Dashboard **Analytics** tab
- Edge Functions **Logs** in the Dashboard
- Database **Performance** monitoring

## Troubleshooting

### Common Issues

1. **Edge Functions not deploying**:

   - Check that your Supabase CLI is authenticated: `supabase login`
   - Ensure your project is linked: `supabase link --project-ref your-project-ref`

2. **Database connection errors**:

   - Verify RLS policies are correctly set up
   - Check that your API keys are correct

3. **OCR Function errors**:
   - Ensure proper environment variables for OCR service
   - Check function logs in Supabase Dashboard

### Getting Help

- Check Supabase [documentation](https://supabase.com/docs)
- Review Edge Functions [logs](https://supabase.com/dashboard/functions) in your Dashboard
- Monitor database [performance](https://supabase.com/dashboard/database/performance)

## Contributing

When adding new Edge Functions:

1. Follow the existing naming convention (`kebab-case.ts`)
2. Include proper error handling and logging
3. Add JSDoc comments for function parameters
4. Test thoroughly before deployment

