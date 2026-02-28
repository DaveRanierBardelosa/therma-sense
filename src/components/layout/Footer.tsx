import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy-900 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-purple" />
          <span className="font-semibold text-gray-300">ThermaSense API</span>
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <a href="#" className="hover:text-neon-cyan transition-colors">Docs</a>
          <a href="#" className="hover:text-neon-cyan transition-colors">API Ref</a>
          <a href="#" className="hover:text-neon-cyan transition-colors">GitHub</a>
          <a href="#" className="hover:text-neon-cyan transition-colors">Privacy</a>
          <a href="#" className="hover:text-neon-cyan transition-colors">Terms</a>
        </div>
      </div>
    </footer>
  );
}
