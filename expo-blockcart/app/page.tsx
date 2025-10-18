import { Card } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F9FAFB] to-[#E0F2FE] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-[#1E88E5] to-[#00C48C] bg-clip-text text-transparent">
            Blockcart
          </h1>
          <p className="text-xl text-gray-600">
            A Modern React Native Rewards App
          </p>
        </div>

        <Card className="p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900">
              📱 React Native Mobile App
            </h2>
            <p className="text-gray-600">
              This is an Expo React Native application designed for iOS and
              Android devices. It cannot be previewed directly in the browser.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Features</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-[#00C48C] font-bold">✓</span>
                <span>
                  <strong>Receipt Upload & OCR:</strong> Capture receipts and
                  extract data automatically
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C48C] font-bold">✓</span>
                <span>
                  <strong>BCT$ Rewards:</strong> Earn cryptocurrency rewards for
                  approved receipts
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C48C] font-bold">✓</span>
                <span>
                  <strong>Wallet Management:</strong> Track your balance and
                  transaction history
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C48C] font-bold">✓</span>
                <span>
                  <strong>Referral System:</strong> Earn bonuses by inviting
                  friends
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C48C] font-bold">✓</span>
                <span>
                  <strong>Supabase Backend:</strong> Authentication, storage,
                  and real-time updates
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Design Updates
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-[#1E88E5] font-bold">•</span>
                <span>
                  Modern fintech/Web3 aesthetic with blue (#1E88E5) and mint
                  (#00C48C) colors
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1E88E5] font-bold">•</span>
                <span>Gradient cards for balance displays and headers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1E88E5] font-bold">•</span>
                <span>
                  Rounded corners (16px) and consistent spacing (8/16/24px grid)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1E88E5] font-bold">•</span>
                <span>Enhanced status chips with better contrast</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1E88E5] font-bold">•</span>
                <span>
                  Floating Action Button (FAB) for quick receipt uploads
                </span>
              </li>
            </ul>
          </div>
        </Card>

        <Card className="p-8 space-y-6 bg-gradient-to-r from-[#1E88E5] to-[#00C48C]">
          <div className="space-y-4 text-white">
            <h3 className="text-2xl font-semibold">🚀 How to Run This App</h3>

            <div className="space-y-3">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <h4 className="font-semibold mb-2">1. Download the Project</h4>
                <p className="text-sm text-white/90">
                  Click the three dots menu (⋯) in the top right and select
                  "Download ZIP"
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <h4 className="font-semibold mb-2">2. Install Dependencies</h4>
                <code className="text-sm bg-black/20 px-2 py-1 rounded">
                  npm install
                </code>
                <p className="text-sm text-white/90 mt-2">or</p>
                <code className="text-sm bg-black/20 px-2 py-1 rounded">
                  yarn install
                </code>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <h4 className="font-semibold mb-2">3. Configure Supabase</h4>
                <p className="text-sm text-white/90">
                  Add your Supabase URL and anon key to the environment
                  configuration
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <h4 className="font-semibold mb-2">4. Start the App</h4>
                <code className="text-sm bg-black/20 px-2 py-1 rounded">
                  npx expo start
                </code>
                <p className="text-sm text-white/90 mt-2">
                  Then scan the QR code with Expo Go (Android) or Camera app
                  (iOS)
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gray-50">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              📂 Project Structure
            </h3>
            <div className="text-sm text-gray-700 font-mono space-y-1">
              <div>src/</div>
              <div className="ml-4">
                ├── screens/{" "}
                <span className="text-gray-500">
                  (Home, Upload, Wallet, Profile, etc.)
                </span>
              </div>
              <div className="ml-4">
                ├── components/{" "}
                <span className="text-gray-500">(Reusable UI components)</span>
              </div>
              <div className="ml-4">
                ├── navigation/{" "}
                <span className="text-gray-500">(React Navigation setup)</span>
              </div>
              <div className="ml-4">
                ├── theme/{" "}
                <span className="text-gray-500">
                  (Colors and design tokens)
                </span>
              </div>
              <div className="ml-4">
                └── lib/{" "}
                <span className="text-gray-500">
                  (Supabase client, utilities)
                </span>
              </div>
            </div>
          </div>
        </Card>

        <div className="text-center text-gray-600 text-sm">
          <p>Built with Expo • React Native • Supabase • React Native Paper</p>
        </div>
      </div>
    </div>
  );
}
