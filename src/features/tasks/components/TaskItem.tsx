import type { TodoTask } from "@microsoft/microsoft-graph-types";
import { cn } from "../../../shared/lib/utils";
import { Circle, CheckCircle2, Star, Mail, Trash2 } from "lucide-react";

interface TaskItemProps {
  task: TodoTask;
  isFromFlaggedEmails: boolean;
  onDelete?: (taskId: string) => void;
}

export function TaskItem({ task, isFromFlaggedEmails, onDelete }: TaskItemProps) {
  const isCompleted = task.status === "completed";
  const isImportant = task.importance === "high";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-md border",
        "hover:bg-accent/50 transition-colors",
        isCompleted && "opacity-60"
      )}
    >
      {/* Status icon */}
      {isCompleted ? (
        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
      ) : (
        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
      )}

      {/* Task title */}
      <span
        className={cn(
          "flex-1 text-sm truncate",
          isCompleted && "line-through text-muted-foreground"
        )}
      >
        {task.title ?? "Untitled"}
      </span>

      {/* Badges and actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isFromFlaggedEmails && (
          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded">
            <Mail className="h-3 w-3" />
            Outlook
          </span>
        )}
        {isImportant && (
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
        )}
        {/* Delete button -- visible on hover */}
        {onDelete && task.id && (
          <button
            onClick={() => onDelete(task.id!)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
