import { useEffect, useState } from "react";
import {
  Users as UsersIcon,
  Shield,
  UserX,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  X,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import Layout from "../components/Layout.tsx";
import api from "../api/axios.ts";
import { useAuth } from "../context/AuthContext.tsx";
import ConfirmDialog from "../components/ConfirmDialog.tsx";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "analyst";
  created_at: string;
}

const roleBadge = (role: string) =>
  role === "admin"
    ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
    : "bg-blue-500/15 text-blue-400 border border-blue-500/30";

const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "analyst">("analyst");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "analyst">("analyst");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmUserId, setConfirmUserId] = useState<number | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data.users ?? []);
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const startEdit = (user: User) => {
    setEditId(user.id);
    setEditRole(user.role);
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveRole = async (id: number) => {
    setSaving(true);
    try {
      await api.patch(`/users/${id}`, { role: editRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: editRole } : u)),
      );
      setEditId(null);
    } catch {
      setError("Failed to update user role.");
    } finally {
      setSaving(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await api.post("/auth/register", {
        name: newName,
        email: newEmail,
        password: newPassword,
        password_confirmation: newPassword,
        role: newRole,
      });
      setShowCreate(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("analyst");
      fetchUsers();
    } catch (err: any) {
      setCreateError(
        err.response?.data?.errors?.email?.[0] ??
          err.response?.data?.message ??
          "Failed to create user.",
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async () => {
    if (!confirmUserId) return;
    setDeleting(confirmUserId);
    setConfirmOpen(false);
    try {
      await api.delete(`/users/${confirmUserId}`);
      setUsers((prev) => prev.filter((u) => u.id !== confirmUserId));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to delete user.");
    } finally {
      setDeleting(null);
      setConfirmUserId(null);
    }
  };

  const adminCount = users.filter((u) => u.role === "admin").length;
  const analystCount = users.filter((u) => u.role === "analyst").length;

  if (loading)
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-gray-400 mt-1">
              {users.length} users · {adminCount} admins · {analystCount}{" "}
              analysts
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
            <button
              onClick={fetchUsers}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total Users",
              value: users.length,
              color: "text-white",
              icon: UsersIcon,
            },
            {
              label: "Admins",
              value: adminCount,
              color: "text-purple-400",
              icon: Shield,
            },
            {
              label: "Analysts",
              value: analystCount,
              color: "text-blue-400",
              icon: UserX,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-sm">{card.label}</p>
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                  <card.icon className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <X className="w-4 h-4 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Users table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">All Users</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Click the edit icon to change a user's role
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["User", "Email", "Role", "Joined", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-6 py-3 text-gray-400 font-medium text-xs"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`border-b border-gray-800/50 ${i % 2 === 0 ? "bg-gray-800/20" : ""}`}
                  >
                    {/* User */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          {user.id === currentUser?.id && (
                            <p className="text-blue-400 text-xs">You</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-gray-300">{user.email}</td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      {editId === user.id ? (
                        <div className="relative inline-block">
                          <select
                            value={editRole}
                            onChange={(e) =>
                              setEditRole(e.target.value as "admin" | "analyst")
                            }
                            className="appearance-none bg-gray-800 border border-gray-600 text-white rounded-lg pl-2 pr-6 py-1 text-xs focus:outline-none focus:border-blue-500 cursor-pointer [&>option]:bg-gray-800 [&>option]:text-white"
                          >
                            <option value="analyst">Analyst</option>
                            <option value="admin">Admin</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge(user.role)}`}
                        >
                          {user.role}
                        </span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-6 py-4 text-gray-400">
                      {formatDate(user.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      {user.id === currentUser?.id ? (
                        <span className="text-gray-600 text-xs">
                          Current user
                        </span>
                      ) : editId === user.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveRole(user.id)}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white rounded-lg text-xs transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(user)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit role
                          </button>
                          <button
                            onClick={() => {
                              setConfirmUserId(user.id);
                              setConfirmName(user.name);
                              setConfirmOpen(true);
                            }}
                            disabled={deleting === user.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            {deleting === user.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg">
                Create New User
              </h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateError("");
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                <X className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-sm">{createError}</p>
              </div>
            )}

            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="John Doe"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="john@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Min 8 chars, uppercase + number"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Role
                </label>
                <div className="relative">
                  <select
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(e.target.value as "admin" | "analyst")
                    }
                    className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer [&>option]:bg-gray-800 [&>option]:text-white"
                  >
                    <option value="analyst">Analyst</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-xl text-sm transition-colors"
                >
                  {creating ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete User"
        message={`Are you sure you want to delete ${confirmName}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        onConfirm={deleteUser}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmUserId(null);
        }}
      />
    </Layout>
  );
}
