import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppBuildInfo } from "@/lib/appBuildInfo";

/** Shows auto-generated app version and last deploy/build time. */
export function AppAboutCard() {
  const { displayVersion, buildDateLabel, buildId } = getAppBuildInfo();
  const shortBuildId = buildId.length > 12 ? buildId.slice(0, 12) : buildId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">About this app</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">App version</span>
          <span className="font-medium tabular-nums" data-testid="text-app-version">
            v{displayVersion}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Last updated</span>
          <span className="font-medium text-right" data-testid="text-app-last-updated">
            {buildDateLabel}
          </span>
        </div>
        {shortBuildId && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Build</span>
            <span className="font-mono text-xs text-muted-foreground">{shortBuildId}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
