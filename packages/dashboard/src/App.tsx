import { Routes, Route, Navigate } from "react-router-dom";
import { isAuthenticated } from "./lib/api.js";
import { UserProvider } from "./lib/userContext.js";
import LoginPage from "./pages/LoginPage.js";
import AuthCallbackPage from "./pages/AuthCallbackPage.js";
import DashboardPage from "./pages/DashboardPage.js";
import StudentsPage from "./pages/StudentsPage.js";
import GroupsPage from "./pages/GroupsPage.js";
import ProjectDetailPage from "./pages/ProjectDetailPage.js";
import MemoriesPage from "./pages/MemoriesPage.js";
import SessionsPage from "./pages/SessionsPage.js";
import ReposPage from "./pages/ReposPage.js";
import SettingsPage from "./pages/SettingsPage.js";
import Layout from "./components/Layout.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <UserProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/students" element={<StudentsPage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/memories" element={<MemoriesPage />} />
                  <Route path="/sessions" element={<SessionsPage />} />
                  <Route path="/repos" element={<ReposPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </UserProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
