import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Cpu, DollarSign, Users, Activity, TrendingDown, Zap, Clock, Percent, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- DATA GAMBAR KARAKTER ---
const characterImages = [
    "https://placehold.co/400x600/0f172a/FFFFFF/png?text=SapuSapu88&font=raleway",
    "https://placehold.co/400x600/0c0a09/FFFFFF/png?text=Gatotkaca&font=raleway",
    "https://placehold.co/400x600/1e1b4b/FFFFFF/png?text=Gundala&font=raleway",
    "https://placehold.co/400x600/4c1d95/FFFFFF/png?text=Sri+Asih&font=raleway",
    "https://placehold.co/400x600/831843/FFFFFF/png?text=Wiro+Sableng&font=raleway",
];

// Komponen untuk menampilkan data detail dari robot yang dipilih
const RobotDataDisplay = ({ eaStats, onDelete }) => {
    const [activeTab, setActiveTab] = useState('performance');
    const tabs = [{ id: 'performance', label: 'Performance' }, { id: 'risk', label: 'Risk & Ratio' }];

    const equityCurveData = useMemo(() => {
        if (!eaStats || !eaStats.history || eaStats.history.length === 0) return [];
        const sortedHistory = [...eaStats.history].sort((a, b) => new Date(a.closeDate.replace(/\./g, '-')) - new Date(b.closeDate.replace(/\./g, '-')));
        const totalClosedPL = sortedHistory.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
        const startingEquity = eaStats.totalEquity - totalClosedPL;
        
        let currentEquity = startingEquity;
        const processedData = sortedHistory.map((trade, index) => {
            currentEquity += parseFloat(trade.pl) || 0;
            return { name: `Trade ${index + 1}`, equity: currentEquity };
        });
        
        return [{name: 'Start', equity: startingEquity}, ...processedData];
    }, [eaStats]);

    const StatTab = ({ icon: Icon, label, value, color }) => (
        <div className="text-center p-2 bg-slate-800/50 rounded-lg">
            <Icon className={`mx-auto mb-2 ${color}`} size={24} />
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
        </div>
    );

    if (!eaStats) {
        return <div className="mt-8 h-96 flex items-center justify-center text-slate-500">Memuat data robot...</div>;
    }

    return (
        <div className="mt-8 bg-slate-800/50 rounded-2xl border border-slate-700 shadow-lg overflow-hidden animate-fade-in">
             <div className="p-5 bg-slate-900/50 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">{eaStats.eaName}</h3>
                    <p className="text-sm text-slate-400">{eaStats.accounts.length} Akun terhubung</p>
                </div>
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(eaStats.eaName, eaStats.eaId);
                    }}
                    title="Hapus Robot"
                    className="p-2 rounded-full text-slate-500 bg-slate-900/50 hover:bg-red-500/80 hover:text-white transition-all duration-200"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="p-5">
                {activeTab === 'performance' && (
                    <div className="animate-fade-in">
                        <div className="h-48 bg-slate-900/50 rounded-lg p-2 mb-4">
                             {equityCurveData.length > 1 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={equityCurveData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="equityColor" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} domain={['auto', 'auto']} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                                            formatter={(value) => [`$${value.toFixed(2)}`, 'Equity']}
                                        />
                                        <Area type="monotone" dataKey="equity" stroke="#38bdf8" fill="url(#equityColor)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                             ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">Data tidak cukup untuk grafik</div>
                             )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <StatTab icon={DollarSign} label="Total P/L (Closed)" value={`$${eaStats.totalClosedPL.toFixed(2)}`} color={eaStats.totalClosedPL >= 0 ? "text-green-400" : "text-red-400"} />
                            <StatTab icon={Activity} label="Current Floating" value={`$${eaStats.totalFloatingPL.toFixed(2)}`} color={eaStats.totalFloatingPL >= 0 ? "text-green-400" : "text-red-400"} />
                            <StatTab icon={Users} label="Accounts Reach" value={eaStats.accounts.length} color="text-slate-300" />
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

// --- KOMPONEN SLIDER UNTUK MOBILE ---
const MobileHologramSlider = ({ eaData, selectedEaIndex, setSelectedEaIndex }) => {
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const scrollable = scrollContainerRef.current;
        if (!scrollable) return;

        let scrollTimeout;
        const handleScroll = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollLeft = scrollable.scrollLeft;
                const cardWidth = scrollable.children[0]?.offsetWidth || 0;
                const newIndex = Math.round(scrollLeft / cardWidth);
                if (newIndex !== selectedEaIndex && newIndex < eaData.length) {
                    setSelectedEaIndex(newIndex);
                }
            }, 150);
        };

        scrollable.addEventListener('scroll', handleScroll);
        return () => scrollable.removeEventListener('scroll', handleScroll);
    }, [eaData, selectedEaIndex, setSelectedEaIndex]);

    return (
        <div ref={scrollContainerRef} className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar w-full">
            {eaData.map((ea, index) => {
                const characterImageUrl = `/images/robots/${ea.eaName.split('(')[0].trim().replace(/\s+/g, '')}.png`;
                const eaBaseName = ea.eaName.split('(')[0].trim().replace(/\s+/g, '').toUpperCase();
                return (
                    <div key={ea.eaId} className="snap-center flex-shrink-0 w-full h-[350px] p-4 flex flex-col items-center justify-center">
                        <div className="w-64 h-80 relative">
                            <h3 className="absolute inset-0 flex items-center justify-center text-7xl font-black text-slate-700/50 break-all leading-none text-center pointer-events-none">
                                {eaBaseName}
                            </h3>
                            <img
                                src={characterImageUrl}
                                alt={ea.eaName}
                                className="w-full h-full object-contain animate-float relative z-10"
                                style={{ filter: `drop-shadow(0 0 15px rgba(0, 255, 255, 0.4))` }}
                                onError={(e) => { e.target.onerror = null; e.target.src = characterImages[(parseInt(ea.eaId) || 0) % characterImages.length]; }}
                            />
                        </div>
                        <div className="w-48 h-2 bg-cyan-400 rounded-full blur-md"></div>
                        <div className="w-24 h-1 bg-white rounded-full mt-[-2px]"></div>
                        <h3 className="mt-2 text-xl font-bold text-white text-center">{ea.eaName}</h3>
                    </div>
                );
            })}
        </div>
    );
};

// --- KOMPONEN CAROUSEL UNTUK DESKTOP ---
const DesktopHologramCarousel = ({ eaData, selectedEaIndex, setSelectedEaIndex }) => {
    const handleNav = (direction) => {
        const newIndex = (selectedEaIndex + direction + eaData.length) % eaData.length;
        setSelectedEaIndex(newIndex);
    };

    return (
        <div className="h-80 flex flex-col items-center justify-center">
            <button onClick={() => handleNav(-1)} className="absolute left-0 z-20 p-2 bg-slate-700/50 hover:bg-slate-600 rounded-full transition-all" disabled={eaData.length <= 1}>
                <ChevronLeft size={24} />
            </button>
            <button onClick={() => handleNav(1)} className="absolute right-0 z-20 p-2 bg-slate-700/50 hover:bg-slate-600 rounded-full transition-all" disabled={eaData.length <= 1}>
                <ChevronRight size={24} />
            </button>

            <div className="w-64 h-80 relative transition-all duration-300" style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
                {eaData.map((ea, index) => {
                    const characterImageUrl = `/images/robots/${ea.eaName.split('(')[0].trim().replace(/\s+/g, '')}.png`;
                    const eaBaseName = ea.eaName.split('(')[0].trim().replace(/\s+/g, '').toUpperCase();
                    const isActive = index === selectedEaIndex;
                    const rotation = (index - selectedEaIndex) * 45;
                    const distance = Math.abs(index - selectedEaIndex);
                    
                    return (
                        <div
                            key={ea.eaId}
                            className="absolute w-full h-full transition-all duration-500 ease-out"
                            style={{
                                transform: `rotateY(${rotation}deg) translateZ(${distance * 50}px)`,
                                opacity: isActive ? 1 : 0,
                                zIndex: eaData.length - distance,
                            }}
                        >
                            <h3 className="absolute inset-0 flex items-center justify-center text-7xl font-black text-slate-700/50 break-all leading-none text-center pointer-events-none">
                                {eaBaseName}
                            </h3>
                            <img
                                src={characterImageUrl}
                                alt={ea.eaName}
                                className="w-full h-full object-contain animate-float relative z-10"
                                style={{ filter: `drop-shadow(0 0 15px rgba(0, 255, 255, 0.4))` }}
                                onError={(e) => { e.target.onerror = null; e.target.src = characterImages[(parseInt(ea.eaId) || 0) % characterImages.length]; }}
                            />
                        </div>
                    );
                })}
            </div>
            
            <div className="w-48 h-2 bg-cyan-400 rounded-full blur-md mt-4"></div>
            <div className="w-24 h-1 bg-white rounded-full mt-[-2px]"></div>
            <h3 className="mt-4 text-2xl font-bold text-white text-center transition-opacity duration-300">
                {eaData[selectedEaIndex].eaName}
            </h3>
        </div>
    );
};


export default function EAOverviewPage({ eaData, onDeleteEa }) {
  const [selectedEaIndex, setSelectedEaIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!eaData || eaData.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <Cpu size={48} className="mx-auto text-slate-500 mb-4" />
        <h2 className="text-3xl font-bold text-white mb-2">Tidak Ada Data EA</h2>
        <p className="text-slate-400">Pastikan akun Anda memiliki properti "tradingRobotName" di Firebase.</p>
      </div>
    );
  }

  const selectedEa = eaData[selectedEaIndex];

  return (
    <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-2 mt-[-2rem]">Ringkasan Kinerja EA</h2>
        <p className="text-slate-400 mb-4">Pilih robot untuk melihat detail performa.</p>
        
        <div className="relative group">
            {isDesktop ? (
                <DesktopHologramCarousel 
                    eaData={eaData} 
                    selectedEaIndex={selectedEaIndex} 
                    setSelectedEaIndex={setSelectedEaIndex} 
                />
            ) : (
                <MobileHologramSlider 
                    eaData={eaData} 
                    selectedEaIndex={selectedEaIndex} 
                    setSelectedEaIndex={setSelectedEaIndex} 
                />
            )}
        </div>

        {selectedEa && <RobotDataDisplay eaStats={selectedEa} onDelete={onDeleteEa} />}
    </div>
  );
}
