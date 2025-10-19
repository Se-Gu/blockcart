import type { Receipt } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface RecentReceiptsTableProps {
  receipts: Receipt[]
}

export function RecentReceiptsTable({ receipts }: RecentReceiptsTableProps) {
  const getStatusBadge = (status: Receipt["status"]) => {
    const variants = {
      pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
      approved: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
      rejected: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
    }
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status}
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Receipts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No receipts found
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">{receipt.user_name}</TableCell>
                  <TableCell>{receipt.store_name}</TableCell>
                  <TableCell>${receipt.total_amount.toFixed(2)}</TableCell>
                  <TableCell>{new Date(receipt.purchase_date).toLocaleDateString()}</TableCell>
                  <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
