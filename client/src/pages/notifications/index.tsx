import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useArchiveNotification,
  useDeleteNotification,
} from "@/hooks/useData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Archive, Trash2, CheckCheck, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"unread" | "read" | "archived">("unread");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const opts =
    tab === "unread"
      ? { unreadOnly: true, archived: false }
      : tab === "archived"
        ? { archived: true }
        : { archived: false };

  const { data: notifications = [], isLoading } = useNotifications(opts);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const archive = useArchiveNotification();
  const remove = useDeleteNotification();

  if (!user) return null;

  const visible =
    tab === "read"
      ? notifications.filter((n: any) => n.isRead && !n.isArchived)
      : notifications;

  const toggleOpen = (n: any) => {
    if (!n.isRead) markRead.mutate(n.id);
    setExpandedId((current) => (current === n.id ? null : n.id));
  };

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate(undefined, { onSuccess: () => toast({ title: "All marked read" }) })}
        >
          <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab);
          setExpandedId(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications.</p>
          ) : (
            visible.map((n: any) => {
              const isExpanded = expandedId === n.id;
              return (
                <Card
                  key={n.id}
                  className={!n.isRead ? "border-primary/40 bg-primary/5" : ""}
                >
                  <CardContent className="p-4 space-y-2">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => toggleOpen(n)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold">{n.title}</div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                          </div>
                          <p
                            className={`text-sm text-muted-foreground mt-1 ${
                              isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"
                            }`}
                          >
                            {n.message}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">
                          {n.type}
                        </span>
                      </div>
                    </button>

                    <div className="text-xs text-muted-foreground">
                      {format(new Date(n.createdAt), "dd MMM yyyy, hh:mm a")}
                      {n.readAt ? ` · Read ${format(new Date(n.readAt), "dd MMM")}` : ""}
                    </div>

                    {isExpanded && n.type === "app_update" && (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => window.location.reload()}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh app
                      </Button>
                    )}

                    <div className="flex gap-2 pt-1">
                      {!n.isRead && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate(n.id);
                          }}
                        >
                          Mark read
                        </Button>
                      )}
                      {!n.isArchived && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            archive.mutate(n.id, { onSuccess: () => toast({ title: "Archived" }) });
                          }}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove.mutate(n.id, { onSuccess: () => toast({ title: "Deleted" }) });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
