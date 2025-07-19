import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// Added new icons for the EA Overview page
import { Briefcase, TrendingUp, TrendingDown, DollarSign, List, Clock, Search, X, CheckCircle, Bell, ArrowLeft, History, Activity, Check, Power, Trash2, Volume2, VolumeX, BellRing, Robot, Users, BarChart3, Timer, MinusCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseConfig } from './firebaseConfig';

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper function
const formatCurrency = (value, includeSign = true) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : (includeSign ? '+' : '');
    return `${sign}$${absValue.toFixed(2)}`;
};

// --- React Components ---

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-6 w-full max-w-sm mx-4 shadow-2xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Batal</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Hapus</button>
                </div>
            </div>
        </div>
    );
};

const Notification = ({ notification, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => onClose(notification.id), 5000);
        return () => clearTimeout(timer);
    }, [notification.id, onClose]);

    const isProfit = notification.type === 'take_profit_profit';
    const isLoss = notification.type === 'take_profit_loss';
    const Icon = isProfit ? CheckCircle : (isLoss ? X : Bell);
    const iconColor = isProfit ? 'text-green-400' : (isLoss ? 'text-red-400' : 'text-blue-400');

    return (
        <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl p-4 flex items-start space-x-3 animate-fade-in-up">
            <Icon className={`${iconColor} mt-1 flex-shrink-0`} size={20} />
            <div className="flex-1">
                <p className="text-sm text-white font-semibold">{notification.title}</p>
                <p className="text-xs text-slate-300">{notification.message}</p>
            </div>
            <button onClick={() => onClose(notification.id)} className="text-slate-500 hover:text-white">
                <X size={18} />
            </button>
        </div>
    );
};

const NotificationContainer = ({ notifications, removeNotification }) => (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-3">
        {notifications.map(n => <Notification key={n.id} notification={n} onClose={removeNotification} />)}
    </div>
);

const SummaryStat = ({ icon, title, value, colorClass = 'text-white' }) => (
    <div className="bg-slate-800/70 backdrop-blur-sm p-4 rounded-xl shadow-lg flex items-center space-x-4 border border-slate-700 transition-all duration-300 hover:bg-slate-700/80">
        <div className="bg-slate-900/80 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-sm text-slate-400">{title}</p>
            <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
        </div>
    </div>
);

const SummaryDashboard = ({ accounts }) => {
    const summary = useMemo(() => {
        let totalPL = 0;
        let profitableAccounts = 0;
        let losingAccounts = 0;
        let pendingOrdersCount = 0;

        accounts.forEach(acc => {
            if (acc.status === 'active') {
                const accountPL = (acc.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0);
                totalPL += accountPL;
                if (accountPL > 0) profitableAccounts++;
                if (accountPL < 0) losingAccounts++;
                pendingOrdersCount += (acc.orders || []).length;
            }
        });
        
        return { 
            totalAccounts: accounts.length, 
            activeAccountsCount: accounts.filter(acc => acc.status === 'active').length, 
            profitableAccounts, 
            losingAccounts, 
            pendingOrdersCount, 
            totalPL 
        };
    }, [accounts]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <SummaryStat icon={<Briefcase size={24} className="text-blue-400" />} title="Total Akun" value={summary.totalAccounts} />
            <SummaryStat icon={<List size={24} className="text-cyan-400" />} title="Akun Aktif" value={summary.activeAccountsCount} />
            <SummaryStat icon={<TrendingUp size={24} className="text-green-400" />} title="Akun Profit" value={summary.profitableAccounts} colorClass="text-green-500" />
            <SummaryStat icon={<TrendingDown size={24} className="text-red-400" />} title="Akun Minus" value={summary.losingAccounts} colorClass="text-red-500" />
            <SummaryStat icon={<Clock size={24} className="text-yellow-400" />} title="Order Pending" value={summary.pendingOrdersCount} colorClass="text-yellow-500" />
            <SummaryStat icon={<DollarSign size={24} className={summary.totalPL >= 0 ? 'text-green-400' : 'text-red-400'} />} title="Total P/L" value={formatCurrency(summary.totalPL, false)} colorClass={summary.totalPL >= 0 ? 'text-green-500' : 'text-red-500'} />
        </div>
    );
};

const AccountCard = ({ account, onToggleRobot, onDelete, handleDragStart, handleDragEnter, handleDragEnd, index, isDragging }) => {
    const totalPL = useMemo(() => (account.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0), [account.positions]);
    const isProfitable = totalPL > 0;
    
    const getGlowEffect = () => {
        if (account.status !== 'active') return 'shadow-slate-900/50';
        if (isProfitable) return 'shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)]';
        if (totalPL < 0) return 'shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]';
        return 'shadow-slate-900/50';
    };

    const getTypePill = (type) => {
        let bgColor = 'bg-gray-500', textColor = 'text-white';
        if (type === 'buy_stop' || type === 'buy_limit') { bgColor = 'bg-white'; textColor = 'text-black'; }
        else if (type === 'sell_stop' || type === 'sell_limit') { bgColor = 'bg-yellow-600'; }
        else if (type === 'buy') { bgColor = 'bg-blue-600'; }
        else if (type === 'sell') { bgColor = 'bg-red-600'; }
        return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${bgColor} ${textColor}`}>{type.replace('_', ' ').toUpperCase()}</span>;
    }
    
    const totalActivities = (account.positions?.length || 0) + (account.orders?.length || 0);
    const singleItem = totalActivities === 1 ? (account.positions?.[0] || account.orders?.[0]) : null;
    const isSingleItemPending = singleItem && (singleItem.executionType.includes('limit') || singleItem.executionType.includes('stop'));

    return (
        <div className={`bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700 flex flex-col transition-all duration-300 cursor-grab relative ${getGlowEffect()} ${isDragging ? 'opacity-50 scale-105' : 'opacity-100'}`}
            draggable="true" onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}>
            
            <div className="p-4 flex flex-col flex-grow min-h-0">
                <div className="flex-shrink-0 flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-x-2 mb-1">
                            <h3 className="text-lg font-bold text-white">{account.accountName}</h3>
                            <button onClick={(e) => { e.stopPropagation(); onToggleRobot(account.accountId, account.robotStatus === 'on' ? 'off' : 'on'); }} title={`Robot ${account.robotStatus === 'on' ? 'ON' : 'OFF'}`} className="p-1 rounded-full hover:bg-slate-700 transition-colors">
                                <Power size={18} className={`${account.robotStatus === 'on' ? 'text-green-500' : 'text-slate-500'} transition-colors`} />
                            </button>
                        </div>
                        {account.tradingRobotName && <p className="text-xs text-cyan-400 -mt-1">{account.tradingRobotName}</p>}
                        {totalActivities > 1 && <p className={`text-xl font-bold mt-1 ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalPL)}</p>}
                    </div>
                    {totalActivities === 1 && singleItem && (
                        <div className="flex-shrink-0">{getTypePill(singleItem.executionType)}</div>
                    )}
                </div>
                
                <div className="flex-1 flex flex-col min-h-0">
                    {account.status === 'inactive' && (
                        <div className="flex-1 flex items-center justify-center"><p className="text-slate-400 italic">Tidak ada order aktif</p></div>
                    )}

                    {account.status === 'active' && totalActivities === 1 && singleItem && (
                        <div className="grid grid-cols-3 gap-x-4 text-sm flex-1">
                                <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-4">
                                    <div><p className="text-slate-500 text-xs">Pair</p><p className="font-semibold text-lg">{singleItem.pair}</p></div>
                                    <div><p className="text-slate-500 text-xs">Lot</p><p className="font-semibold text-lg">{singleItem.lotSize.toFixed(2)}</p></div>
                                    <div><p className="text-slate-500 text-xs">{isSingleItemPending ? 'Harga Akan Eksekusi' : 'Harga Eksekusi'}</p><p className="font-semibold text-lg">{singleItem.entryPrice.toFixed(3)}</p></div>
                                    <div><p className="text-slate-500 text-xs">Harga Sekarang</p><p className="font-semibold text-lg">{singleItem.currentPrice ? singleItem.currentPrice.toFixed(3) : '...'}</p></div>
                                </div>
                                <div className="flex flex-col justify-start items-end">
                                    <p className="text-slate-500 text-xs mb-1">Status</p>
                                    {isSingleItemPending ? 
                                        <div className="text-right"><p className="text-lg font-bold text-yellow-400 flex items-center justify-end"><Clock size={16} className="mr-2"/> Pending</p></div> :
                                        <div className="text-right"><p className={`text-lg font-bold ${singleItem.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(singleItem.profit)}</p></div>
                                    }
                                </div>
                        </div>
                    )}

                    {account.status === 'active' && totalActivities > 1 && (
                        <div className="space-y-2 text-xs overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                            {(account.positions || []).map(pos => (
                                <div key={pos.ticket} className="grid grid-cols-4 gap-x-2 items-center bg-slate-900/50 p-2 rounded-md">
                                    <div>{getTypePill(pos.executionType)}</div>
                                    <div className="text-slate-300 font-semibold">{pos.pair}</div>
                                    <div className="text-slate-400 text-right">Lot {pos.lotSize.toFixed(2)}</div>
                                    <div className={`font-bold text-right ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(pos.profit)}</div>
                                </div>
                            ))}
                            {(account.orders || []).map(ord => (
                                <div key={ord.ticket} className="grid grid-cols-4 gap-x-2 items-center bg-slate-900/50 p-2 rounded-md">
                                    <div>{getTypePill(ord.executionType)}</div>
                                    <div className="text-slate-300 font-semibold">{ord.pair}</div>
                                    <div className="text-slate-400 text-right">Lot {ord.lotSize.toFixed(2)}</div>
                                    <div className="text-yellow-400 text-right">@ {ord.entryPrice.toFixed(3)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(account.accountId, account.accountName); }} title="Hapus Akun" className="absolute bottom-3 right-3 p-1 rounded-full text-slate-600 hover:bg-slate-900/50 hover:text-red-500 transition-all duration-200 opacity-50 hover:opacity-100">
                <Trash2 size={16} />
            </button>
        </div>
    );
};

const HistoryPage = ({ accounts, tradeHistory }) => {
    const accountSummary = useMemo(() => {
        const allHistory = Object.values(tradeHistory).flat();

        return accounts.map(account => {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const weeklyTrades = allHistory.filter(trade => {
                if (trade.accountName !== account.accountName) return false;
                // Assuming date format is 'YYYY.MM.DD HH:mm:ss'
                const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                return tradeDate > oneWeekAgo;
            });

            const totalPL = weeklyTrades.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);

            return {
                id: account.id,
                name: account.accountName,
                totalOrders: weeklyTrades.length,
                totalPL: totalPL,
                status: account.status,
            };
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [accounts, tradeHistory]);

    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-4">Riwayat Kinerja Akun (7 Hari Terakhir)</h2>
            <div className="bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700 overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nama Akun</th>
                            <th scope="col" className="px-6 py-3 text-center">Total Transaksi</th>
                            <th scope="col" className="px-6 py-3 text-right">Total P/L</th>
                            <th scope="col" className="px-6 py-3 text-center">Status Saat Ini</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accountSummary.map(summary => (
                            <tr key={summary.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="px-6 py-4 font-medium text-white">{summary.name}</td>
                                <td className="px-6 py-4 text-center">{summary.totalOrders}</td>
                                <td className={`px-6 py-4 font-semibold text-right ${summary.totalPL > 0 ? 'text-green-500' : summary.totalPL < 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                    {formatCurrency(summary.totalPL)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${summary.status === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {summary.status === 'active' ? <Activity className="mr-2" size={14} /> : <Check className="mr-2" size={14} />}
                                        {summary.status === 'active' ? 'Floating' : 'Clear'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- NEW EA OVERVIEW COMPONENTS ---

const EquityGrowthChart = ({ data }) => {
    // Placeholder for a real chart. Consider using a library like Recharts or Chart.js.
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-48 bg-slate-900/50 rounded-lg text-slate-400">Tidak ada data riwayat untuk membuat grafik.</div>
    }
    return (
        <div className="p-4 bg-slate-900/50 rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-2">Grafik Pertumbuhan Ekuitas (Historis)</h4>
            <div className="flex items-center justify-center h-40 text-center text-slate-400 border border-dashed border-slate-600 rounded-md">
                <p>Placeholder Grafik.<br/>Integrasikan library seperti Recharts untuk visualisasi data.</p>
            </div>
        </div>
    );
};

const RobotCard = ({ robot }) => {
    const [activeTab, setActiveTab] = useState('performance');

    const StatPill = ({ icon, label, value, valueColor }) => (
        <div className="bg-slate-900/70 p-3 rounded-lg flex-1">
            <div className="flex items-center text-slate-400 text-xs mb-1">
                {icon}
                <span className="ml-2">{label}</span>
            </div>
            <p className={`text-lg font-bold ${valueColor || 'text-white'}`}>{value}</p>
        </div>
    );

    const tabs = [
        { id: 'performance', label: 'Performance' },
        { id: 'metrics', label: 'Metrics' },
        { id: 'growth', label: 'Growth' },
    ];

    return (
        <div className="bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700 flex flex-col p-4 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center"><Robot size={22} className="mr-3 text-cyan-400"/>{robot.name}</h3>
                    <p className="text-sm text-slate-300 flex items-center mt-1"><Users size={14} className="mr-2 text-slate-400"/> {robot.accountsReach} Akun</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400">Total P/L (Historis)</p>
                    <p className={`text-2xl font-bold ${robot.totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(robot.totalPL, false)}</p>
                </div>
            </div>

            <div className="border-b border-slate-700">
                <nav className="flex space-x-4" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`${activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'}
                                whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'performance' && (
                    <div className="flex flex-col md:flex-row gap-4">
                        <StatPill icon={<TrendingUp size={16}/>} label="Current Floating" value={formatCurrency(robot.currentFloating, false)} valueColor={robot.currentFloating > 0 ? 'text-green-400' : robot.currentFloating < 0 ? 'text-red-400' : 'text-slate-300'}/>
                        <StatPill icon={<CheckCircle size={16}/>} label="Winrate" value={`${robot.winrate.toFixed(1)}%`} valueColor="text-cyan-400"/>
                    </div>
                )}
                {activeTab === 'metrics' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <StatPill icon={<Activity size={16}/>} label="Weekly Trades" value={robot.weeklyTradeRatio} />
                        <StatPill icon={<MinusCircle size={16}/>} label="Avg. Loss" value={formatCurrency(robot.drawdownRatio, false)} valueColor="text-red-400"/>
                        <StatPill icon={<Timer size={16}/>} label="Avg. Duration" value={`${robot.tradeDurationRatio.toFixed(1)} min`} />
                    </div>
                )}
                {activeTab === 'growth' && (
                    <EquityGrowthChart data={robot.equityGrowthData} />
                )}
            </div>
        </div>
    );
}

const EAOverviewPage = ({ accounts, tradeHistory }) => {
    const robotStats = useMemo(() => {
        const robotsData = {};
        const allHistory = Object.values(tradeHistory).flat();
        const accountMap = new Map(accounts.map(acc => [acc.accountName, acc]));
        
        // 1. Group accounts and current floating by robot name
        accounts.forEach(acc => {
            if (acc.tradingRobotName) {
                if (!robotsData[acc.tradingRobotName]) {
                    robotsData[acc.tradingRobotName] = { 
                        name: acc.tradingRobotName, 
                        accounts: [], 
                        history: [],
                        currentFloating: 0 
                    };
                }
                robotsData[acc.tradingRobotName].accounts.push(acc);
                const accountPL = (acc.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0);
                robotsData[acc.tradingRobotName].currentFloating += accountPL;
            }
        });

        // 2. Group historical trades by robot name
        allHistory.forEach(trade => {
            const account = accountMap.get(trade.accountName);
            if(account && account.tradingRobotName && robotsData[account.tradingRobotName]) {
                robotsData[account.tradingRobotName].history.push(trade);
            }
        });

        // 3. Calculate final metrics for each robot
        return Object.values(robotsData).map(robot => {
            const totalTrades = robot.history.length;
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            let winTrades = 0;
            let lossTrades = 0;
            let totalLossAmount = 0;
            let totalPL = 0;
            let totalDurationMs = 0;

            robot.history.forEach(trade => {
                const pl = parseFloat(trade.pl) || 0;
                totalPL += pl;
                if (pl >= 0) {
                    winTrades++;
                } else {
                    lossTrades++;
                    totalLossAmount += pl;
                }
                if (trade.openDate && trade.closeDate) {
                    const openTime = new Date(trade.openDate.replace(/\./g, '-')).getTime();
                    const closeTime = new Date(trade.closeDate.replace(/\./g, '-')).getTime();
                    if (!isNaN(openTime) && !isNaN(closeTime)) {
                        totalDurationMs += (closeTime - openTime);
                    }
                }
            });

            const weeklyTrades = robot.history.filter(t => new Date(t.closeDate.replace(/\./g, '-')) > oneWeekAgo);

            const sortedHistory = [...robot.history].sort((a,b) => new Date(a.closeDate.replace(/\./g, '-')) - new Date(b.closeDate.replace(/\./g, '-')));
            let cumulativePL = 0;
            const equityGrowthData = sortedHistory.map(trade => {
                cumulativePL += (parseFloat(trade.pl) || 0);
                return { date: trade.closeDate, cumulativePL };
            });

            return {
                ...robot,
                accountsReach: robot.accounts.length,
                totalPL: totalPL,
                winrate: totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0,
                weeklyTradeRatio: weeklyTrades.length,
                drawdownRatio: lossTrades > 0 ? totalLossAmount / lossTrades : 0,
                tradeDurationRatio: totalTrades > 0 ? (totalDurationMs / totalTrades) / (1000 * 60) : 0, // in minutes
                equityGrowthData,
            };
        }).sort((a,b) => a.name.localeCompare(b.name));

    }, [accounts, tradeHistory]);

    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">EA Overview</h2>
             {robotStats.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {robotStats.map(robot => <RobotCard key={robot.name} robot={robot} />)}
                </div>
             ) : (
                <div className="flex items-center justify-center h-48 bg-slate-800/70 rounded-lg text-slate-400 border border-slate-700">
                    Tidak ada data robot (EA) yang ditemukan di akun manapun.
                </div>
             )}
        </div>
    );
};


// Main App Component
export default function App() {
    const [accountsData, setAccountsData] = useState({});
    const [accountOrder, setAccountOrder] = useState([]);
    const [tradeHistory, setTradeHistory] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [page, setPage] = useState('dashboard'); // 'dashboard', 'ea_overview', 'history'
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, accountId: null, accountName: '' });
    
    const [isNotifEnabled, setIsNotifEnabled] = useState(false);
    const [notifPermission, setNotifPermission] = useState('default');
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const prevPositionsRef = useRef({});
    const initialLoadComplete = useRef(false);

    const dragItem = useRef(null);
    const dragOverItem = useRef(null);
    const [dragging, setDragging] = useState(false);

    const addNotification = (title, message, type) => {
        setNotifications(prev => [{ id: Date.now(), title, message, type }, ...prev].slice(0, 5));
    };
    const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
    
    const speak = useCallback((text) => {
        if (!isSoundEnabled || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        window.speechSynthesis.speak(utterance);
    }, [isSoundEnabled]);

    const showNotification = useCallback((title, options) => {
        if (!isNotifEnabled || !("Notification" in window) || notifPermission !== "granted") {
            return;
        }
        new Notification(title, options);
    }, [isNotifEnabled, notifPermission]);
    
    const handleNotifToggle = () => {
        if (!("Notification" in window)) {
            alert("Browser ini tidak mendukung notifikasi desktop.");
            return;
        }

        if (notifPermission === 'granted') {
            setIsNotifEnabled(!isNotifEnabled);
        } else if (notifPermission === 'denied') {
            alert("Anda telah memblokir notifikasi. Mohon aktifkan melalui pengaturan browser.");
        } else {
            Notification.requestPermission().then(permission => {
                setNotifPermission(permission);
                if (permission === 'granted') {
                    setIsNotifEnabled(true);
                    addNotification('Sukses', 'Notifikasi berhasil diaktifkan.', 'take_profit_profit');
                }
            });
        }
    };

    useEffect(() => {
        if ("Notification" in window) {
            setNotifPermission(Notification.permission);
        }

        const accountsRef = ref(db, 'accounts/');
        const historyRef = ref(db, 'trade_history/');
        const orderRef = ref(db, 'dashboard_config/accountOrder');

        const unsubscribeAccounts = onValue(accountsRef, (snapshot) => {
            const data = snapshot.val() || {};
            
            if(initialLoadComplete.current) {
                Object.values(data).forEach(acc => {
                    const prevPosTickets = new Set(prevPositionsRef.current[acc.accountId] || []);
                    const currentPositions = acc.positions || [];

                    currentPositions.forEach(pos => {
                        if (!prevPosTickets.has(pos.ticket)) {
                            const message = `Posisi ${pos.executionType} dibuka pada ${pos.pair} lot ${pos.lotSize.toFixed(2)}`;
                            showNotification(`Aktivitas Baru: ${acc.accountName}`, { body: message, icon: '/logo192.png' });
                            speak(message);
                        }
                    });
                });
            }

            const newPositions = {};
            Object.values(data).forEach(acc => {
                newPositions[acc.accountId] = (acc.positions || []).map(p => p.ticket);
            });
            prevPositionsRef.current = newPositions;
            
            if(!initialLoadComplete.current) {
                initialLoadComplete.current = true;
            }

            setAccountsData(data);
        });

        const unsubscribeHistory = onValue(historyRef, (snapshot) => {
            const data = snapshot.val() || {};
            setTradeHistory(data);
        });

        const unsubscribeOrder = onValue(orderRef, (snapshot) => {
            const data = snapshot.val() || [];
            setAccountOrder(data);
        });

        return () => {
            unsubscribeAccounts();
            unsubscribeHistory();
            unsubscribeOrder();
        };
    }, [speak, showNotification]);

    const accounts = useMemo(() => {
        const allAccounts = Object.values(accountsData);
        
        if (accountOrder && accountOrder.length > 0) {
            const accountMap = new Map(allAccounts.map(acc => [String(acc.id), acc]));
            const orderedIdSet = new Set(accountOrder.map(id => String(id)));

            const orderedList = accountOrder
                .map(id => accountMap.get(String(id)))
                .filter(Boolean);
                
            const unorderedList = allAccounts
                .filter(acc => !orderedIdSet.has(String(acc.id)))
                .sort((a, b) => a.accountName.localeCompare(b.accountName));

            return [...orderedList, ...unorderedList];
        }

        return allAccounts.sort((a, b) => a.accountName.localeCompare(b.accountName));
    }, [accountsData, accountOrder]);


    const handleToggleRobot = async (accountId, newStatus) => {
        try {
            await fetch('/api/robot-toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, newStatus })
            });
        } catch (error) {
            addNotification('Error', 'Gagal mengirim perintah ke server.', 'take_profit_loss');
        }
    };

    const openDeleteModal = (accountId, accountName) => {
        setDeleteModal({ isOpen: true, accountId, accountName });
    };

    const closeDeleteModal = () => {
        setDeleteModal({ isOpen: false, accountId: null, accountName: '' });
    };

    const handleDeleteAccount = async () => {
        const { accountId, accountName } = deleteModal;
        if (!accountId) return;
        try {
            await fetch('/api/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId })
            });
            addNotification('Sukses', `Akun ${accountName} telah dihapus.`, 'take_profit_profit');
        } catch (error) {
            addNotification('Error', 'Gagal menghapus akun. Mohon refresh halaman.', 'take_profit_loss');
        }
        closeDeleteModal();
    };

    const handleDragStart = (e, pos) => {
        dragItem.current = pos;
        setDragging(true);
    };

    const handleDragEnter = (e, pos) => {
        dragOverItem.current = pos;
    };

    const handleDragEnd = async () => {
        if (dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            setDragging(false);
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }

        const reorderedAccounts = [...accounts];
        const dragItemContent = reorderedAccounts[dragItem.current];
        reorderedAccounts.splice(dragItem.current, 1);
        reorderedAccounts.splice(dragOverItem.current, 0, dragItemContent);
        
        const newOrderIds = reorderedAccounts.map(acc => acc.id);
        // Optimistically update UI
        setAccountOrder(newOrderIds); 

        dragItem.current = null;
        dragOverItem.current = null;
        setDragging(false);

        try {
            await fetch('/api/save-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrderIds })
            });
        } catch (error) {
            addNotification('Error', 'Gagal menyimpan urutan kartu. Urutan akan direset.', 'take_profit_loss');
            // Revert on failure
             const orderRef = ref(db, 'dashboard_config/accountOrder');
             onValue(orderRef, (snapshot) => setAccountOrder(snapshot.val() || []), { onlyOnce: true });
        }
    };

    const filteredAccounts = useMemo(() => {
        if (!searchTerm) return accounts;
        return accounts.filter(account => account.accountName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [accounts, searchTerm]);

    const NavButton = ({ targetPage, label, icon }) => {
        const isActive = page === targetPage;
        const Icon = icon;
        return (
             <button onClick={() => setPage(targetPage)} className={`flex items-center space-x-2 py-2 px-4 rounded-lg font-semibold transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/70'}`}>
                <Icon size={18}/>
                <span>{label}</span>
            </button>
        )
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 to-gray-900 min-h-screen text-white font-sans p-4 sm:p-6 lg:p-8">
            <style>{`
                @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.5s ease-in-out; }
                @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
            `}</style>
            <div className="max-w-7xl mx-auto">
                <header className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">MJA Monitoring Dashboard</h1>
                        <p className="text-slate-400 mt-1">Ringkasan global dan status akun individual.</p>
                    </div>
                    <div className="flex items-center self-end sm:self-center gap-2">
                        <button onClick={handleNotifToggle} title="Notifikasi Browser" className={`p-2 rounded-lg transition-colors ${isNotifEnabled && notifPermission === 'granted' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'} ${notifPermission === 'denied' ? 'text-red-500' : ''}`}>
                            <BellRing size={20} />
                        </button>
                        <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} title="Pemberitahuan Suara" className={`p-2 rounded-lg transition-colors ${isSoundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                            {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </button>
                    </div>
                </header>

                <nav className="my-6 p-2 bg-slate-800/60 backdrop-blur-sm border border-slate-700 rounded-xl flex flex-wrap items-center justify-start gap-2">
                    <NavButton targetPage="dashboard" label="Dashboard" icon={Briefcase} />
                    <NavButton targetPage="ea_overview" label="EA Overview" icon={Robot} />
                    <NavButton targetPage="history" label="History" icon={History} />
                    {page === 'dashboard' && (
                        <div className="flex-1 min-w-[200px] relative ml-auto">
                           <input type="text" placeholder="Cari nama akun..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900/70 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        </div>
                    )}
                </nav>

                <main>
                    {page === 'dashboard' && (
                        <div className="animate-fade-in">
                            <SummaryDashboard accounts={accounts} />
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                  {filteredAccounts.map((account, index) => (
                                      <AccountCard
                                          key={account.id}
                                          account={account}
                                          onToggleRobot={handleToggleRobot}
                                          onDelete={openDeleteModal}
                                          index={index}
                                          handleDragStart={handleDragStart}
                                          handleDragEnter={handleDragEnter}
                                          handleDragEnd={handleDragEnd}
                                          isDragging={dragging && dragItem.current === index}
                                      />
                                  ))}
                            </div>
                        </div>
                    )}
                    {page === 'ea_overview' && <EAOverviewPage accounts={accounts} tradeHistory={tradeHistory} /> }
                    {page === 'history' && <HistoryPage accounts={accounts} tradeHistory={tradeHistory} /> }
                </main>
            </div>
            <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                title="Konfirmasi Penghapusan"
                message={`Apakah Anda yakin ingin menghapus akun "${deleteModal.accountName}"? Tindakan ini akan menghapus data dari dasbor. Anda juga harus mematikan EA di akun ini agar tidak muncul kembali.`}
                onConfirm={handleDeleteAccount}
                onCancel={closeDeleteModal}
            />
        </div>
    );
}