import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import WatchlistPage from "@/pages/watchlist";
import NomineePage from "@/pages/nominee-page";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/nominees/:id" component={NomineePage} />
          <ProtectedRoute path="/watchlist" component={WatchlistPage} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return <Router />;
}

export default App;