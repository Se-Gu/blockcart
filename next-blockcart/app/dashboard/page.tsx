import { Receipt, Users, CheckCircle, XCircle, DollarSign, UserCheck } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { RecentReceiptsTable } from "@/components/recent-receipts-table"
import type { DashboardStats, Receipt as ReceiptType } from "@/lib/types"

// Mock data - in production, fetch from Supabase
const mockStats: DashboardStats = {
  totalReceipts: 1247,
  pendingReceipts: 23,
  approvedReceipts: 1189,
  rejectedReceipts: 35,
  totalUsers: 456,
  activeUsers: 342,
  totalRewards: 45678.5,
  pendingRewards: 2340.0,
}

const mockRecentReceipts: ReceiptType[] = [
  {
    id: "1",
    user_id: "u1",
    user_email: "john@example.com",
    user_name: "John Doe",
    image_url: "/receipts/1.jpg",
    total_amount: 45.67,
    store_name: "Whole Foods",
    purchase_date: "2025-01-15",
    status: "pending",
    created_at: "2025-01-15T10:30:00Z",
  },
  {
    id: "2",
    user_id: "u2",
    user_email: "jane@example.com",
    user_name: "Jane Smith",
    image_url: "/receipts/2.jpg",
    total_amount: 123.45,
    store_name: "Trader Joes",
    purchase_date: "2025-01-14",
    status: "approved",
    reviewer_id: "r1",
    reviewer_name: "Admin User",
    reviewed_at: "2025-01-14T15:20:00Z",
    created_at: "2025-01-14T12:00:00Z",
  },
  {
    id: "3",
    user_id: "u3",
    user_email: "bob@example.com",
    user_name: "Bob Johnson",
    image_url: "/receipts/3.jpg",
    total_amount: 67.89,
    store_name: "Safeway",
    purchase_date: "2025-01-14",
    status: "approved",
    reviewer_id: "r1",
    reviewer_name: "Admin User",
    reviewed_at: "2025-01-14T14:10:00Z",
    created_at: "2025-01-14T11:30:00Z",
  },
  {
    id: "4",
    user_id: "u4",
    user_email: "alice@example.com",
    user_name: "Alice Williams",
    image_url: "/receipts/4.jpg",
    total_amount: 234.56,
    store_name: "Costco",
    purchase_date: "2025-01-13",
    status: "rejected",
    reviewer_id: "r1",
    reviewer_name: "Admin User",
    reviewed_at: "2025-01-13T16:45:00Z",
    rejection_reason: "Receipt image unclear",
    created_at: "2025-01-13T09:15:00Z",
  },
  {
    id: "5",
    user_id: "u5",
    user_email: "charlie@example.com",
    user_name: "Charlie Brown",
    image_url: "/receipts/5.jpg",
    total_amount: 89.12,
    store_name: "Target",
    purchase_date: "2025-01-13",
    status: "pending",
    created_at: "2025-01-13T08:00:00Z",
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your Blockcart operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Receipts"
          value={mockStats.totalReceipts}
          icon={Receipt}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Pending Review"
          value={mockStats.pendingReceipts}
          icon={Receipt}
          description="Awaiting verification"
        />
        <StatCard
          title="Total Users"
          value={mockStats.totalUsers}
          icon={Users}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard title="Active Users" value={mockStats.activeUsers} icon={UserCheck} description="Last 30 days" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Approved"
          value={mockStats.approvedReceipts}
          icon={CheckCircle}
          description={`${((mockStats.approvedReceipts / mockStats.totalReceipts) * 100).toFixed(1)}% approval rate`}
        />
        <StatCard
          title="Rejected"
          value={mockStats.rejectedReceipts}
          icon={XCircle}
          description={`${((mockStats.rejectedReceipts / mockStats.totalReceipts) * 100).toFixed(1)}% rejection rate`}
        />
        <StatCard
          title="Total Rewards"
          value={`$${mockStats.totalRewards.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Pending Rewards"
          value={`$${mockStats.pendingRewards.toLocaleString()}`}
          icon={DollarSign}
          description="Awaiting payment"
        />
      </div>

      {/* Recent Receipts */}
      <RecentReceiptsTable receipts={mockRecentReceipts} />
    </div>
  )
}
