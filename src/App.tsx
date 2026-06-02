import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { ToastProvider } from './components/ui/Toast';

// Pages
import { Login } from './pages/Login/Login';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Employees } from './pages/Employees/Employees';
import { Attendance } from './pages/Attendance/Attendance';
import { Overtime } from './pages/Overtime/Overtime';
import { Salaries } from './pages/Salaries/Salaries';
import { Reports } from './pages/Reports/Reports';
import { Users } from './pages/Users/Users';
import { Settings } from './pages/Settings/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
          <BrowserRouter>
            <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Core App Layout */}
            <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              {/* Dashboard */}
              <Route path="dashboard" element={<Dashboard />} />

              {/* Employees */}
              <Route 
                path="employees" 
                element={
                  <ProtectedRoute permission="employees.view">
                    <Employees />
                  </ProtectedRoute>
                } 
              />

              {/* Attendance */}
              <Route 
                path="attendance" 
                element={
                  <ProtectedRoute permission="attendance.view">
                    <Attendance />
                  </ProtectedRoute>
                } 
              />

              {/* Overtime */}
              <Route 
                path="overtime" 
                element={
                  <ProtectedRoute permission="overtime.view">
                    <Overtime />
                  </ProtectedRoute>
                } 
              />

              {/* Salaries & Payslip */}
              <Route 
                path="salaries" 
                element={
                  <ProtectedRoute permission="salary.view">
                    <Salaries />
                  </ProtectedRoute>
                } 
              />

              {/* Reports */}
              <Route 
                path="reports" 
                element={
                  <ProtectedRoute permission="reports.view">
                    <Reports />
                  </ProtectedRoute>
                } 
              />

              {/* Users & Permissions */}
              <Route 
                path="users" 
                element={
                  <ProtectedRoute permission="users.view">
                    <Users />
                  </ProtectedRoute>
                } 
              />

              {/* General Settings */}
              <Route 
                path="settings" 
                element={
                  <ProtectedRoute permission="settings.view">
                    <Settings />
                  </ProtectedRoute>
                } 
              />

              {/* Home redirect */}
              <Route index element={<Navigate to="/dashboard" replace />} />
            </Route>

            {/* Fallback wildcard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
