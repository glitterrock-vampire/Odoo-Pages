import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Classes from './pages/Classes';
import Contacts from './pages/Contacts';
import Donations from './pages/Donations';
import Finances from './pages/Finances';
import Performances from './pages/Performances';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Team from './pages/Team';
import Repertoire from './pages/Repertoire';
import Media from './pages/Media';
import WebsiteSettings from './pages/WebsiteSettings';
import Tuition from './pages/Tuition';
import Engagement from './pages/Engagement';
import Attendance from './pages/Attendance';
import NotFound from './pages/not-found';
import { PreferencesProvider, getStoredPreferences, usePreferences } from './lib/preferences';

function queryDefaults(automaticOdooRefresh: boolean) {
  return {
    refetchOnMount: automaticOdooRefresh ? 'always' as const : false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: automaticOdooRefresh ? 0 : Infinity,
    gcTime: automaticOdooRefresh ? 5 * 60 * 1000 : Infinity,
  };
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/students" component={Students} />
        <Route path="/classes" component={Classes} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/donations" component={Donations} />
        <Route path="/finances" component={Finances} />
        <Route path="/tuition" component={Tuition} />
        <Route path="/performances" component={Performances} />
        <Route path="/engagement" component={Engagement} />
        <Route path="/team" component={Team} />
        <Route path="/repertoire" component={Repertoire} />
        <Route path="/media" component={Media} />
        <Route path="/website-settings" component={WebsiteSettings} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AppWithDataPreferences() {
  const { preferences } = usePreferences();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: queryDefaults(getStoredPreferences().automaticOdooRefresh),
    },
  }));

  useEffect(() => {
    queryClient.setDefaultOptions({
      queries: queryDefaults(preferences.automaticOdooRefresh),
    });
  }, [preferences.automaticOdooRefresh, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <PreferencesProvider>
      <AppWithDataPreferences />
    </PreferencesProvider>
  );
}

export default App;
