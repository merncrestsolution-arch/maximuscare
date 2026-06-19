import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { useBroadcastNotification } from "@/hooks/useData";
import { useBranchOptions } from "@/hooks/use-branch-options";
import { useToast } from "@/hooks/use-toast";

export function SendNotificationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { options: branchOptions } = useBranchOptions();
  const broadcast = useBroadcastNotification();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");

  const reset = () => {
    setTitle("");
    setMessage("");
    setAudience("all");
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    try {
      const res = await broadcast.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        type: "announcement",
        branch: audience,
      });
      const count = res?.count ?? 0;
      toast({ title: `Notification sent to ${count} staff` });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
          <DialogDescription>
            Broadcast a message to active staff. They will see it in their Notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              placeholder="e.g. Clinic closed tomorrow"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-message">Message</Label>
            <Textarea
              id="notif-message"
              placeholder="Write your announcement..."
              rows={4}
              value={message}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Recipients</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger>
                <SelectValue placeholder="All active staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All active staff</SelectItem>
                {branchOptions.map((b) => (
                  <SelectItem key={b.id} value={b.value}>
                    {b.label} branch only
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={broadcast.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={broadcast.isPending} className="gap-2">
            {broadcast.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}