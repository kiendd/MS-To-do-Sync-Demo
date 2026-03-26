import { useState, type FormEvent } from "react";
import { useCreateTask } from "../hooks/useCreateTask";
import { Plus } from "lucide-react";

interface AddTaskFormProps {
  listId: string;
}

export function AddTaskForm({ listId }: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const createTask = useCreateTask(listId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask.mutate(trimmed);
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
      <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        disabled={createTask.isPending}
      />
    </form>
  );
}
