import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Settings, Bell, Database, Shield } from "lucide-react";

export function AdminPage() {
  const [systemName, setSystemName] = useState("ThermaSense Primary");
  const [retentionDays, setRetentionDays] = useState(90);

  const handleSaveGeneral = () => {
    alert("General settings saved successfully!");
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-gray-400">System configuration and global settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-neon-cyan" />
            <h2 className="text-xl font-bold text-white">General Settings</h2>
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Data Retention Period (Days)</label>
              <input 
                type="number" 
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-cyan" 
              />
            </div>
            <button 
              onClick={handleSaveGeneral}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-6 h-6 text-neon-pink" />
            <h2 className="text-xl font-bold text-white">Alert Configuration</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-navy-900 rounded-xl border border-white/5">
              <div>
                <div className="text-white font-medium">Critical Heat Index Alert</div>
                <div className="text-gray-400 text-sm">Notify authorities via email when HI &gt;= 40.0°C</div>
              </div>
              <div className="w-12 h-6 rounded-full relative bg-neon-pink">
                <div className="absolute top-1 w-4 h-4 bg-white rounded-full right-1" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              * Email alerts require EMAIL_USER and EMAIL_PASS to be configured in the server environment.
            </p>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
