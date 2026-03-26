import { AuthGuard, LoginButton } from "./features/auth";
import { TaskListSidebar } from "./features/task-lists";
import { TaskList } from "./features/tasks";
import { SyncStatusBar } from "./features/sync";
import { useSyncStore } from "./stores/sync.store";
import { Toaster } from "sonner";

function AppContent() {
  const selectedListId = useSyncStore((s) => s.selectedListId);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-semibold">MS To-do Sync</h1>
        <LoginButton />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <TaskListSidebar />
        <main className="flex-1 overflow-auto">
          {selectedListId ? (
            <TaskList listId={selectedListId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Select a list to view tasks</p>
            </div>
          )}
        </main>
      </div>
      <SyncStatusBar />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}

function App() {
  return (
    <AuthGuard>
      <AppContent />
    </AuthGuard>
  );
}

export default App;
