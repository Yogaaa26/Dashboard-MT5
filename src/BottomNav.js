import React from 'react';
import { LayoutGrid, History, Cpu } from 'lucide-react';

export default function BottomNav({ activePage, setPage }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'history', label: 'History', icon: History },
    { id: 'ea-overview', label: 'EA Overview', icon: Cpu },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-800/80 backdrop-blur-lg border-t border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-around h-16">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex flex-col items-center justify-center w-full transition-colors duration-200 ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
