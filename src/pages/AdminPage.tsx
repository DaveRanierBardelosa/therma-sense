import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Settings, Bell, Database, Shield, Trash2, CheckCircle } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [systemName, setSystemName] = useState("ThermaSense Primary");
  const [retentionDays, setRetentionDays] = useState(90);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch users list
    fetch("/api/users")
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch users", err);
        setLoading(false);
      });
  }, []);

  const handleApprove = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: user?.email }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, status: "approved" } : u));
      } else {
        alert(data.message || "Failed to approve user");
      }
    } catch (err) {
      alert("Error approving user");
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: user?.email }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        alert(data.message || "Failed to delete user");
      }
    } catch (err) {
      alert("Error deleting user");
    }
  };

  const handleSaveGeneral = () => {
    alert("General settings saved successfully!");
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-gray-400">System configuration and global settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* System Settings */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-neon-cyan" />
            <h2 className="text-xl font-bold text-white">System Settings</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">System Name</label>
              <input 
                type="text" 
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-cyan" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Data Retention (days)</label>
              <input 
                type="number" 
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-cyan" 
              />
            </div>
            <button 
              onClick={handleSaveGeneral}
              className="w-full bg-neon-cyan/20 border border-neon-cyan text-neon-cyan px-4 py-2 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-neon-purple" />
            <h2 className="text-xl font-bold text-white">Quick Stats</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Users:</span>
              <span className="text-white font-bold">{users.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Admins:</span>
              <span className="text-neon-cyan font-bold">{users.filter(u => u.role === "Admin").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pending Approval:</span>
              <span className="text-yellow-400 font-bold">{users.filter(u => u.status === "pending").length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Users Management */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-neon-green" />
          <h2 className="text-xl font-bold text-white">User Management</h2>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading users...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Role</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-white">{u.name}</td>
                    <td className="py-3 px-4 text-gray-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.role === "Admin" ? "bg-neon-purple/20 text-neon-purple" : "bg-neon-cyan/20 text-neon-cyan"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.status === "approved" ? "bg-neon-green/20 text-neon-green" : "bg-yellow-400/20 text-yellow-400"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 space-x-2">
                      {u.status === "pending" && (
                        <button
                          onClick={() => handleApprove(u.id)}
                          className="inline-flex items-center gap-1 bg-neon-green/20 text-neon-green px-2 py-1 rounded text-xs hover:bg-neon-green/30 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={u.role === "Admin" && users.filter(u => u.role === "Admin").length === 1}
                        className="inline-flex items-center gap-1 bg-red-500/20 text-red-500 px-2 py-1 rounded text-xs hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
