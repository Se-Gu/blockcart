# Blockcart - Receipt Rewards Platform

A full-stack receipt rewards application consisting of a mobile app, admin dashboard, and backend services. Users can upload receipts, earn rewards, and administrators can manage the platform through a comprehensive web interface.

## 🏗️ Project Architecture

This monorepo contains three main applications:

```
blockcart/
├── expo-blockcart/      # React Native mobile app
├── next-blockcart/      # Next.js admin dashboard
└── supabase-backend/    # Supabase database & edge functions
```

### 🏪 **Mobile App** (`expo-blockcart/`)

- **Technology**: React Native with Expo
- **Purpose**: Customer-facing receipt upload and reward tracking
- **Features**: Camera integration, OCR processing, real-time notifications

### 🖥️ **Admin Dashboard** (`next-blockcart/`)

- **Technology**: Next.js with TypeScript
- **Purpose**: Administrative management interface
- **Features**: User management, receipt review, analytics, campaigns

### ⚙️ **Backend** (`supabase-backend/`)

- **Technology**: Supabase (PostgreSQL + Edge Functions)
- **Purpose**: Database, API endpoints, and business logic
- **Features**: OCR processing, reward calculations, data storage

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **Supabase Account** with a project set up
- **Git** for version control

### 1. Set Up the Backend (Required First)

The backend must be set up before running any applications.

```bash
# Navigate to backend directory
cd supabase-backend/

# Follow the setup instructions in supabase-backend/README.md
# This includes:
# - Deploying database schema
# - Setting up Edge Functions
# - Configuring Row Level Security (RLS)
```

**⏱️ Estimated time**: 15-20 minutes

### 2. Set Up the Mobile App

```bash
# Navigate to mobile app directory
cd expo-blockcart/

# Follow setup instructions in expo-blockcart/README.md
# This includes installing dependencies and configuring environment variables
```

### 3. Set Up the Admin Dashboard

```bash
# Navigate to admin dashboard directory
cd next-blockcart/

# Follow setup instructions in next-blockcart/README.md
# This includes installing dependencies and configuring environment variables
```

## 🏃‍♂️ Running the Applications

### Start All Applications

1. **Terminal 1 - Backend** (Supabase Edge Functions)

   ```bash
   cd supabase-backend/
   # Deploy Edge Functions to Supabase (one-time setup)
   supabase functions deploy --project-ref your-project-ref
   ```

2. **Terminal 2 - Mobile App**

   ```bash
   cd expo-blockcart/
   npm start
   # Opens Expo Dev Tools at http://localhost:19006
   # Scan QR code with Expo Go app
   ```

3. **Terminal 3 - Admin Dashboard**
   ```bash
   cd next-blockcart/
   npm run dev
   # Opens admin dashboard at http://localhost:3000
   ```

### Access Points

- **📱 Mobile App**: Scan QR code in Expo Dev Tools or use Expo Go app
- **🖥️ Admin Dashboard**: http://localhost:3000
- **🔧 Supabase Dashboard**: https://supabase.com/dashboard (manage your project)

## 📋 Development Workflow

### For Mobile App Development

1. **Make changes** in `expo-blockcart/src/`
2. **Test on device** using Expo Go app
3. **Debug** using React Native Debugger
4. **Build for production** with `npx expo build`

### For Admin Dashboard Development

1. **Make changes** in `next-blockcart/`
2. **Test in browser** at http://localhost:3000
3. **Debug** using browser dev tools
4. **Deploy** to Vercel or your hosting platform

### For Backend Development

1. **Modify Edge Functions** in `supabase-backend/edge-functions/`
2. **Test locally** with `supabase functions serve`
3. **Deploy** with `supabase functions deploy`
4. **Monitor** through Supabase Dashboard

## 🔧 Environment Variables

Each application requires specific environment variables:

### Mobile App (`.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Admin Dashboard (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get these values from your Supabase Dashboard under **Settings > API**.

## 🗄️ Database Schema

The application uses the following main entities:

- **`users`**: Mobile app users (managed by Supabase Auth)
- **`receipts`**: User-submitted receipts with OCR data
- **`web_users`**: Admin dashboard users with roles
- **`campaigns`**: Reward campaigns and rules
- **`rewards`**: User reward balances and history
- **`referrals`**: Referral tracking and commissions

See `supabase-backend/database/schema.sql` for the complete schema.

## 🔐 Authentication & Authorization

### Mobile App Users

- **Authentication**: Supabase Auth (email/password)
- **Registration**: Automatic on first app launch
- **Session Management**: JWT tokens stored securely

### Admin Dashboard Users

- **Authentication**: Supabase Auth with role-based access
- **Roles**: `admin`, `reviewer`
- **Permissions**: Row Level Security (RLS) policies

## 🚨 Troubleshooting

### Common Issues

1. **"Permission denied" errors**

   - Ensure RLS policies are properly configured
   - Check that users exist in correct tables

2. **Edge Functions not working**

   - Verify functions are deployed to Supabase
   - Check function logs in Supabase Dashboard

3. **Mobile app can't connect**

   - Verify Supabase credentials in `.env` file
   - Check network connectivity
   - Ensure backend is properly set up

4. **Admin dashboard login fails**
   - Ensure user exists in `web_users` table
   - Verify user role is set correctly

### Getting Help

- 📖 **Read the README files** in each directory for detailed instructions
- 🔍 **Check Supabase logs** in your dashboard for errors
- 🐛 **Debug with browser dev tools** for frontend issues
- 💬 **Check the Issues** section in the repository

## 📁 Project Structure

```
blockcart/
├── 📱 expo-blockcart/           # React Native mobile app
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── screens/           # App screens
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and services
│   │   └── navigation/        # Navigation setup
│   ├── assets/                # Images and icons
│   └── package.json
├── 🖥️ next-blockcart/           # Next.js admin dashboard
│   ├── app/                   # Next.js 13+ app router
│   ├── components/            # Reusable components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities and services
│   └── middleware.ts          # Auth middleware
├── ⚙️ supabase-backend/         # Backend infrastructure
│   ├── database/              # SQL migrations and schema
│   ├── edge-functions/        # Serverless functions
│   └── README.md
└── 📚 README.md                 # This file
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Make changes** following the existing code style
4. **Test thoroughly** across all applications
5. **Submit** a pull request

### Development Guidelines

- **Code Style**: Follow existing patterns and conventions
- **Testing**: Test all features across mobile and web platforms
- **Documentation**: Update README files for new features
- **Security**: Ensure RLS policies are maintained

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Supabase** for the amazing backend platform
- **Expo** for the excellent React Native development experience
- **Next.js** for the powerful React framework
- **Vercel** for deployment and hosting

---

**Happy coding! 🎉**

