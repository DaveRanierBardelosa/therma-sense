import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Users, Search, Trash2, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export function MembersPage() {
  const [members, setMembers] = useState<UserData[]>([]);
  const { user } = useAuth();

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`);
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/users/${id}/approve`, { method: "POST" });
      fetchUsers();
    } catch (err) {
      console.error("Failed to approve user", err);
    }
  };

  const handleRemoveMember = async (id: number) => {
    if (!confirm("Are you sure you want to remove this user?")) return;
    try {
      await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" });
      fetchUsers();
    } catch (err) {
      console.error("Failed to remove user", err);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Authorities List</h1>
          <p className="text-gray-400">Manage system administrators and authorities</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search authorities..." 
              className="w-full bg-navy-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
            />
          </div>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-sm">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Status</th>
              {user?.role === "Admin" && <th className="p-4 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple font-bold text-xs">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-medium">{member.name}</div>
                      <div className="text-gray-500 text-xs">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    member.role === 'Admin' ? 'bg-neon-pink/10 text-neon-pink' : 'bg-neon-cyan/10 text-neon-cyan'
                  }`}>
                    {member.role}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${member.status === 'approved' ? 'bg-neon-green' : 'bg-yellow-500'}`} />
                    <span className="text-gray-300 text-sm capitalize">{member.status}</span>
                  </div>
                </td>
                {user?.role === "Admin" && (
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {member.status === "pending" && (
                        <button 
                          onClick={() => handleApprove(member.id)}
                          className="p-2 hover:bg-neon-green/10 rounded-lg transition-colors text-gray-400 hover:text-neon-green"
                          title="Approve User"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {member.id !== user.id && (
                        <button 
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 hover:bg-neon-pink/10 rounded-lg transition-colors text-gray-400 hover:text-neon-pink"
                          title="Remove User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={user?.role === "Admin" ? 4 : 3} className="p-8 text-center text-gray-400">
                  No authorities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
