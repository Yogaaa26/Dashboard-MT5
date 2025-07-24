import React, { useState } from 'react';
import { Cpu, DollarSign, Users, Activity, TrendingDown, Zap, Clock, Percent, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Komponen untuk setiap tab data di dalam kartu
const StatTab = ({ icon, label, value, color }) => {
    const Icon = icon;
    return (
        <div className="text-center p-2">
            <Icon className={`mx-auto mb-2 ${color}`} size={24} />
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
        </div>
    );
};

// Komponen untuk kartu robot tunggal
const RobotCard = ({ eaStats, onDelete }) => {
    const [activeTab, setActiveTab] = useState('performance');

    const tabs = [
        { id: 'performance', label: 'Performance' },
        { id: 'risk', label: 'Risk & Ratio' },
    ];

    // Placeholder data untuk grafik
    const equityCurveData = [
        { name: 'Start', equity: 10000 },
        { name: 'W1', equity: 10200 },
        { name: 'W2', equity: 10150 },
        { name: 'W3', equity: 10500 },
        { name: 'W4', equity: 10800 },
        { name: 'Now', equity: eaStats.totalEquity },
    ];

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 shadow-lg overflow-hidden relative group">
            <div className="p-5 bg-slate-900/50">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 p-3 rounded-lg border border-blue-500/30">
                        <Cpu size={28} className="text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{eaStats.eaName}</h3>
                        <p className="text-sm text-slate-400">{eaStats.accounts.length} Akun terhubung</p>
                    </div>
                </div>
            </div>

            <button 
                onClick={(e) => {
                    e.stopPropagation(); // Mencegah kartu ikut terklik
                    onDelete(eaStats.eaName);
                }}
                title="Hapus Robot"
                className="absolute top-4 right-4 p-2 rounded-full text-slate-500 bg-slate-900/50 hover:bg-red-500/80 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100"
            >
                <Trash2 size={16} />
            </button>

            <div className="p-5">
                {activeTab === 'performance' && (
                    <div className="animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <StatTab icon={DollarSign} label="Total P/L (Closed)" value={`$${eaStats.totalClosedPL.toFixed(2)}`} color={eaStats.totalClosedPL >= 0 ? "text-green-400" : "text-red-400"} />
                            <StatTab icon={Activity} label="Current Floating" value={`$${eaStats.totalFloatingPL.toFixed(2)}`} color={eaStats.totalFloatingPL >= 0 ? "text-green-400" : "text-red-400"} />
                            <StatTab icon={Users} label="Accounts Reach" value={eaStats.accounts.length} color="text-slate-300" />
                        </div>
                        <div className="h-48 bg-slate-900/50 rounded-lg p-2">
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={equityCurveData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="equityColor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} domain={['dataMin - 500', 'dataMax + 500']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                                        formatter={(value) => [`$${value.toFixed(2)}`, 'Equity']}
                                    />
                                    <Area type="monotone" dataKey="equity" stroke="#38bdf8" fill="url(#equityColor)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'risk' && (
                     <div className="animate-fade-in grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatTab icon={Percent} label="Winrate" value={`${eaStats.winrate.toFixed(1)}%`} color="text-cyan-400" />
                        <StatTab icon={Zap} label="Weekly Trade Ratio" value={eaStats.weeklyTradeRatio.toFixed(1)} color="text-slate-300" />
                        <StatTab icon={TrendingDown} label="Avg. Drawdown" value={`$${eaStats.avgDrawdown.toFixed(2)}`} color="text-red-400" />
                        <StatTab icon={Clock} label="Avg. Trade Duration" value="N/A" color="text-slate-400" />
                    </div>
                )}
            </div>

            <div className="bg-slate-900/50 mt-2 p-1 flex justify-center rounded-b-2xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default function EAOverviewPage({ eaData, onDeleteEa }) {
  if (!eaData || eaData.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <Cpu size={48} className="mx-auto text-slate-500 mb-4" />
        <h2 className="text-3xl font-bold text-white mb-2">Tidak Ada Data EA</h2>
        <p className="text-slate-400">Pastikan akun Anda memiliki properti "tradingRobotName" di Firebase.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-2">Ringkasan Kinerja EA</h2>
        <p className="text-slate-400 mb-8">Analisis agregat dari semua akun yang dikelola oleh setiap robot trading.</p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {eaData.map(ea => (
                <RobotCard 
                    key={ea.eaName} 
                    eaStats={ea} 
                    onDelete={onDeleteEa} 
                />
            ))}
        </div>
    </div>
  );
}
