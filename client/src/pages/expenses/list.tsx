import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { useExpenses, useMyExpenses, useDeleteExpense } from "@/hooks/useData";
import { isManagementRole } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ExpensesListPage() {
  const { user } = useAuth();
  const isMgmt = isManagementRole(user?.role);
  // Bug 12: Managers / Branch Managers / Nexus MD can VIEW all branch expenses, but
  // editing/deleting/adding stays with Admin & MD (view-only for branch leads).
  const isBranchLead = ["Manager", "Branch Manager", "Nexus MD"].includes(user?.role || "");
  const canSeeAllExpenses = isMgmt || isBranchLead;
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const { data: mgmtExpenses = [], isLoading: loadingMgmt } = useExpenses(
    { startDate, endDate },
    canSeeAllExpenses
  );
  const { data: myExpenses = [], isLoading: loadingMine } = useMyExpenses(!canSeeAllExpenses);
  const deleteExpense = useDeleteExpense();

  const expenses = canSeeAllExpenses ? mgmtExpenses : myExpenses;
  const isLoading = canSeeAllExpenses ? loadingMgmt : loadingMine;

  const total = useMemo(
    () => expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0),
    [expenses]
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        {!isBranchLead && (
          <Button asChild>
            <Link href="/expenses/add">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Link>
          </Button>
        )}
      </div>

      {canSeeAllExpenses && (
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Total: LKR {total.toLocaleString()}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No expenses found</p>
          ) : (
            <div className="space-y-2">
              {expenses.map((e: any) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <div className="font-medium">{e.category}</div>
                    <div className="text-sm text-muted-foreground">
                      {e.expenseDate} · LKR {Number(e.amount).toLocaleString()}
                      {e.description ? ` · ${e.description}` : ""}
                    </div>
                    {canSeeAllExpenses && (
                      <div className="text-xs text-muted-foreground">By {e.createdByName}</div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isMgmt && (
                      <>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/expenses/edit/${e.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteExpense.mutate(e.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
