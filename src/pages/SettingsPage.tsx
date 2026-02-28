import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">My Settings</h1>
        <p className="text-gray-400">Manage your personal preferences and account details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 rounded-xl font-medium transition-colors">
            <User className="w-5 h-5" />
            Profile Information
          </button>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6">Profile Information</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple font-bold text-2xl uppercase">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                  <input type="text" value={user?.name || ''} readOnly className="w-full bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-gray-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input type="email" value={user?.email || ''} readOnly className="w-full bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-gray-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <input type="text" value={user?.role || ''} readOnly className="w-full bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-gray-400 focus:outline-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
