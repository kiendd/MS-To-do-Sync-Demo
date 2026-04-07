import { useEffect } from "react";
import type { TodoTask } from "@microsoft/microsoft-graph-types";
import { X } from "lucide-react";

interface TaskDetailDialogProps {
  task: TodoTask;
  onClose: () => void;
}

export function TaskDetailDialog({ task, onClose }: TaskDetailDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-xs text-muted-foreground font-mono">task.id = {task.id}</p>
            <h2 className="text-sm font-semibold mt-0.5 truncate max-w-lg">{task.title ?? "Untitled"}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors ml-4 shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Raw JSON */}
        <div className="overflow-auto flex-1 p-4">
          <pre className="text-xs font-mono bg-muted rounded p-3 whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(task, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
