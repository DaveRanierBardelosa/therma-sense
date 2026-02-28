import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-neon-cyan" />
            <span className="font-bold text-xl tracking-tight text-white neon-text-cyan">
              ThermaSense
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Features
            </Link>
            <Link to="/" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Docs
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium text-neon-cyan hover:text-white transition-colors">
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/20 transition-all neon-border-cyan text-sm font-medium"
              >
                Request Access
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
