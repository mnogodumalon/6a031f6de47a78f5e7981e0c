import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import ReisepaketePage from '@/pages/ReisepaketePage';
import UnterkuenftePage from '@/pages/UnterkuenftePage';
import AusfluegePage from '@/pages/AusfluegePage';
import ReisebuchungPage from '@/pages/ReisebuchungPage';
import PublicFormReisepakete from '@/pages/public/PublicForm_Reisepakete';
import PublicFormUnterkuenfte from '@/pages/public/PublicForm_Unterkuenfte';
import PublicFormAusfluege from '@/pages/public/PublicForm_Ausfluege';
import PublicFormReisebuchung from '@/pages/public/PublicForm_Reisebuchung';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a031f4c161bbeec8df93d84" element={<PublicFormReisepakete />} />
              <Route path="public/6a031f5397966ce6d6355a09" element={<PublicFormUnterkuenfte />} />
              <Route path="public/6a031f53b08cd498187c08c5" element={<PublicFormAusfluege />} />
              <Route path="public/6a031f549b19e27808c3cc43" element={<PublicFormReisebuchung />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
                <Route path="reisepakete" element={<ReisepaketePage />} />
                <Route path="unterkuenfte" element={<UnterkuenftePage />} />
                <Route path="ausfluege" element={<AusfluegePage />} />
                <Route path="reisebuchung" element={<ReisebuchungPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
