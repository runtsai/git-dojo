import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { Layout } from '@/components/layout';
import { Home } from '@/pages/home';
import { TestCenter } from '@/pages/test-center';
import { LessonView } from '@/pages/lesson';
import { LearnModuleView } from '@/pages/learn';
import { BreakthroughsIndex } from '@/pages/breakthroughs-index';
import { BreakthroughView } from '@/pages/breakthrough-view';
import { MapView } from '@/pages/map';
import { GoLive } from '@/pages/go-live';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/test-center" component={TestCenter} />
          <Route path="/test-center/:lessonId" component={LessonView} />
          <Route path="/learn/:moduleId" component={LearnModuleView} />
          <Route path="/breakthroughs" component={BreakthroughsIndex} />
          <Route path="/breakthroughs/:id" component={BreakthroughView} />
          <Route path="/map" component={MapView} />
          <Route path="/go-live" component={GoLive} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Layout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
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

export default App;
