import { AuthGuard, LoginButton } from "./features/auth";
import { TaskListSidebar } from "./features/task-lists";
import { useSyncStore } from "./stores/sync.store";

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
        <main className="flex-1 p-4 overflow-auto">
          {selectedListId ? (
            <p className="text-muted-foreground">
              Tasks for list {selectedListId} will be displayed here (Plan 02-02).
            </p>
          ) : (
            <p className="text-muted-foreground">Select a list to view tasks.</p>
          )}
        </main>
      </div>
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
