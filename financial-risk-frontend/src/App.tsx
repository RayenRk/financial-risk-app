import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider }    from "./context/ThemeContext.tsx";
import { AuthProvider }     from "./context/AuthContext.tsx";
import { ConfigProvider }   from "./context/ConfigContext.tsx";
import { RefreshProvider }  from "./context/RefreshContext.tsx";
import ProtectedRoute       from "./components/ProtectedRoute.tsx";
import ToastNotifications   from "./components/ToastNotifications.tsx";
import Login                from "./pages/Login.tsx";
import Register             from "./pages/Register.tsx";
import Dashboard            from "./pages/Dashboard.tsx";
import Financials           from "./pages/Financials.tsx";
import RiskAnalysis         from "./pages/RiskAnalysis.tsx";
import Alerts               from "./pages/Alerts.tsx";
import Users                from "./pages/Users.tsx";
import Analyze              from "./pages/Analyze.tsx";
import CompanyDetail        from "./pages/CompanyDetail.tsx";
import Profile              from "./pages/Profile.tsx";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfigProvider>
          <RefreshProvider>
            <BrowserRouter>
              <ToastNotifications />
              <Routes>
                <Route path="/login"    element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/financials" element={<ProtectedRoute><Financials /></ProtectedRoute>} />
                <Route path="/risk"       element={<ProtectedRoute><RiskAnalysis /></ProtectedRoute>} />
                <Route path="/alerts"     element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                <Route path="/analyze"    element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
                <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/users"      element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
                <Route path="/companies/:ticker" element={<ProtectedRoute><CompanyDetail /></ProtectedRoute>} />
                <Route path="/"  element={<Navigate to="/dashboard" replace />} />
                <Route path="*"  element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </RefreshProvider>
        </ConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
