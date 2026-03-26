import { AuthGuard, LoginButton } from "./features/auth";

function App() {
  return (
    <AuthGuard>
      <div className="min-h-screen">
        <header className="border-b px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">MS To-do Sync</h1>
          <LoginButton />
        </header>
        <main className="p-4">
          <p className="text-muted-foreground">Authenticated. Graph API client will be added in Plan 01-02.</p>
        </main>
      </div>
    </AuthGuard>
  );
}

export default App;
