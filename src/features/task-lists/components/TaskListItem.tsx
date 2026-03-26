import type { TodoTaskList } from "@microsoft/microsoft-graph-types";
import { cn } from "../../../shared/lib/utils";
import { Mail } from "lucide-react";

interface TaskListItemProps {
  list: TodoTaskList;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function TaskListItem({ list, isSelected, onSelect }: TaskListItemProps) {
  const isFlaggedEmails = list.wellknownListName === "flaggedEmails";

  return (
    <button
      onClick={() => list.id && onSelect(list.id)}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground font-medium"
      )}
    >
      <div className="flex items-center gap-2">
        {isFlaggedEmails && <Mail className="h-4 w-4 shrink-0" />}
        <span className="truncate">{list.displayName ?? "Untitled List"}</span>
      </div>
    </button>
  );
}
