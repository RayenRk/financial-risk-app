import { NavLink, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.tsx";
import { useConfig } from "../context/ConfigContext.tsx";
import {
  LayoutDashboard,
  TrendingUp,
  ShieldAlert,
  Bell,
  Users,
  LogOut,
  Activity,
  Search,
  ChevronDown,
  ChevronUp,
  Building2,
  Trash2,
} from "lucide-react";
import api from "../api/axios.ts";
import { useRefresh } from "../context/RefreshContext.tsx";
import ConfirmDialog from "./ConfirmDialog.tsx";
import ThemeToggle from "./ThemeToggle.tsx";

interface Company {
  id: number;
  ticker: string;
  name: string;
  current_risk: string;
  risk_color: string;
}

export default function Sidebar() {
  const { primary_display_name, primary_ticker } = useConfig();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { unreadAlerts: unreadCount } = useRefresh();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCompanies, setShowCompanies] = useState(false);

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/financials", icon: TrendingUp, label: "Financials" },
    { to: "/risk", icon: ShieldAlert, label: "Risk Analysis" },
    { to: "/alerts", icon: Bell, label: "Alerts" },
    { to: "/analyze", icon: Search, label: "Analyze Company" },
  ];

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");

  const fetchCompanies = () => {
    api
      .get("/companies")
      .then((res) => setCompanies(res.data.companies ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const riskDot = (color: string) => (
    <div
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: color ?? "#6b7280" }}
    />
  );

  const nonPrimaryCompanies = companies.filter(
    (c) => c.ticker !== primary_ticker,
  );

  const deleteCompany = async () => {
    if (!confirmDeleteId) return;
    setConfirmDeleteOpen(false);
    try {
      await api.delete(`/companies/${confirmDeleteId}`);
      setCompanies((prev) => prev.filter((c) => c.id !== confirmDeleteId));
      if (window.location.pathname.includes("/companies/")) {
        navigate("/analyze");
      }
    } catch (err: any) {
      console.error("Delete failed:", err.response?.data?.message);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-10 transition-colors duration-200">
      {/* Logo + theme toggle */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">
            FinXG
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Primary company badge */}
      <div className="px-4 py-3 mx-3 mt-4 bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-600/20 rounded-xl">
        <p className="text-blue-600 dark:text-blue-400 text-xs font-medium uppercase tracking-wider mb-1">
          Primary
        </p>
        <p className="text-gray-900 dark:text-white font-semibold text-sm">
          {primary_display_name}
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-xs">{primary_ticker}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto scrollbar-none">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
            {/* Unread badge — Alerts only */}
            {to === "/alerts" && unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </NavLink>
        ))}

        {/* Admin only — Users */}
        {isAdmin() && (
          <NavLink
            to="/users"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`
            }
          >
            <Users className="w-4 h-4" />
            Users
          </NavLink>
        )}

        {/* Analyzed companies */}
        {nonPrimaryCompanies.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowCompanies(!showCompanies)}
              className="w-full flex items-center justify-between px-3 py-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3 h-3" />
                <span className="text-xs uppercase tracking-wider font-medium">
                  Analyzed ({nonPrimaryCompanies.length})
                </span>
              </div>
              {showCompanies ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {showCompanies && (
              <div className="mt-1 space-y-0.5">
                {nonPrimaryCompanies.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/companies/${c.ticker}`)}
                    >
                      {riskDot(c.risk_color)}
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300 shrink-0">
                        {c.ticker}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs truncate min-w-0">
                        {c.name}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setConfirmDeleteId(c.id);
                        setConfirmDeleteName(c.name);
                        setConfirmDeleteOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-all shrink-0"
                      title={`Remove ${c.ticker}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User + logout */}
      <div className="px-3 pb-4 border-t border-gray-200 dark:border-gray-800 pt-4">
        <div
          onClick={() => navigate("/profile")}
          className="flex items-center gap-3 px-3 py-2 mb-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
        >
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-gray-800 dark:text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white text-sm font-medium truncate">
              {user?.name}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Remove Company"
        message={`Remove ${confirmDeleteName} and all its data from the system? This cannot be undone.`}
        confirmText="Remove"
        danger={true}
        onConfirm={deleteCompany}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setConfirmDeleteId(null);
        }}
      />
    </aside>
  );
}
