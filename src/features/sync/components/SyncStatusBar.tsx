import { useSyncStore } from "../../../stores/sync.store";
import { RefreshCw, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../../../shared/lib/utils";

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function SyncStatusBar() {
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground px-4 py-1.5 border-t bg-muted/30">
      {/* Status icon */}
      {syncStatus === "syncing" && (
        <Loader2 className={cn("h-3 w-3 animate-spin")} />
      )}
      {syncStatus === "resyncing" && (
        <RefreshCw className={cn("h-3 w-3 animate-spin text-amber-500")} />
      )}
      {syncStatus === "idle" && (
        <Check className="h-3 w-3 text-green-500" />
      )}
      {syncStatus === "error" && (
        <AlertCircle className="h-3 w-3 text-destructive" />
      )}

      {/* Status text */}
      {syncStatus === "syncing" && <span>Syncing...</span>}
      {syncStatus === "resyncing" && (
        <span className="text-amber-600 dark:text-amber-400">Re-syncing...</span>
      )}
      {syncStatus === "idle" && lastSyncedAt && (
        <span>Synced {formatRelativeTime(lastSyncedAt)}</span>
      )}
      {syncStatus === "idle" && !lastSyncedAt && <span>Not synced yet</span>}
      {syncStatus === "error" && (
        <span className="text-destructive">Sync error</span>
      )}
    </div>
  );
}
