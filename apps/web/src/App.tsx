import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './lib/auth';
import { RequireAuth } from './components/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { EmployeesListPage } from './pages/EmployeesListPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ImportPage } from './pages/ImportPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/employees" element={<EmployeesListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/import" element={<ImportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/employees" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
