import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { TodoTask } from "@microsoft/microsoft-graph-types";
import { cn } from "../../../shared/lib/utils";
import { Circle, CheckCircle2, Star, Mail, Trash2 } from "lucide-react";

interface TaskItemProps {
  task: TodoTask;
  isFromFlaggedEmails: boolean;
  onDelete?: (taskId: string) => void;
  onToggleComplete?: (task: TodoTask) => void;
  onUpdate?: (taskId: string, patch: Partial<TodoTask>) => void;
}

export function TaskItem({
  task,
  isFromFlaggedEmails,
  onDelete,
  onToggleComplete,
  onUpdate,
}: TaskItemProps) {
  const isCompleted = task.status === "completed";
  const isImportant = task.importance === "high";
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync editTitle when task.title changes from outside (e.g., server update)
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(task.title ?? "");
    }
  }, [task.title, isEditing]);

  const handleTitleSave = () => {
    setIsEditing(false);
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === task.title) return;
    if (task.id && onUpdate) {
      onUpdate(task.id, { title: trimmed });
    }
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setEditTitle(task.title ?? "");
      setIsEditing(false);
    }
  };

  const handleImportanceToggle = () => {
    if (!task.id || !onUpdate) return;
    const newImportance = isImportant ? "normal" : "high";
    onUpdate(task.id, { importance: newImportance });
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-md border",
        "hover:bg-accent/50 transition-colors",
        isCompleted && "opacity-60"
      )}
    >
      {/* Status icon -- clickable to toggle complete */}
      <button
        onClick={() => onToggleComplete?.(task)}
        className="shrink-0 focus:outline-none"
        aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>

      {/* Task title -- click to edit inline */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleTitleKeyDown}
          className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={cn(
            "flex-1 text-sm truncate cursor-text",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {task.title ?? "Untitled"}
        </span>
      )}

      {/* Badges and actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isFromFlaggedEmails && (
          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded">
            <Mail className="h-3 w-3" />
            Outlook
          </span>
        )}
        {/* Importance toggle -- clickable */}
        <button
          onClick={handleImportanceToggle}
          className={cn(
            "p-0.5 rounded transition-colors",
            isImportant
              ? "text-amber-500"
              : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-500"
          )}
          aria-label={isImportant ? "Remove importance" : "Mark important"}
        >
          <Star className={cn("h-4 w-4", isImportant && "fill-amber-500")} />
        </button>
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
