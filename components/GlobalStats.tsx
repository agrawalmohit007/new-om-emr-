
import React, { useState } from 'react';
import { VisitRecord, Patient, Consultant, SavedReport, InventoryItem } from '../types';
import StatisticsScreen from './StatisticsScreen';
import DetailedLogScreen from './DetailedLogScreen';

interface GlobalStatsProps {
    visits: VisitRecord[];
    patients: Patient[];
    consultants: Consultant[];
    reportHistory: SavedReport[];
    inventory: InventoryItem[];
    onUpdateInventory: (data: InventoryItem[]) => void;
    onUpdateReports: (data: SavedReport[]) => void;
    onBack: () => void;
}

const GlobalStats: React.FC<GlobalStatsProps> = ({ 
    visits, patients, consultants, reportHistory, inventory, onUpdateInventory, onUpdateReports, onBack 
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'patient_logs' | 'lab_stats'>('overview');

    const HospitalStatsView = () => {
        const totalVisits = visits.length;
        const totalRevenue = visits.reduce((acc, v) => acc + (v.finalBill?.grandTotal || v.fees || 0), 0);
        const newPatients = visits.filter(v => v.visitType === 'new').length;
        
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl">
                        <p className="text-xs font-black uppercase opacity-70">Total OPD Volume</p>
                        <p className="text-4xl font-black mt-2">{totalVisits}</p>
                    </div>
                    <div className="bg-green-600 p-6 rounded-2xl text-white shadow-xl">
                        <p className="text-xs font-black uppercase opacity-70">Total Revenue</p>
                        <p className="text-4xl font-black mt-2">₹{totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-600 p-6 rounded-2xl text-white shadow-xl">
                        <p className="text-xs font-black uppercase opacity-70">New Registrations</p>
                        <p className="text-4xl font-black mt-2">{newPatients}</p>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                    <h3 className="font-black text-slate-800 uppercase tracking-tight mb-4">Doctor Performance</h3>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 uppercase text-xs font-black text-slate-500">
                            <tr><th className="p-3">Doctor</th><th className="p-3">Visits</th><th className="p-3 text-right">Revenue</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {consultants.map(doc => {
                                const docVisits = visits.filter(v => v.assignedDoctor === doc.name);
                                const rev = docVisits.reduce((s, v) => s + (v.finalBill?.grandTotal || v.fees || 0), 0);
                                return (
                                    <tr key={doc.id}>
                                        <td className="p-3 font-bold">{doc.name}</td>
                                        <td className="p-3">{docVisits.length}</td>
                                        <td className="p-3 text-right font-mono">₹{rev.toLocaleString()}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div className="flex space-x-2 bg-slate-200 p-1 rounded-2xl w-fit">
                    <button onClick={() => setActiveTab('overview')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>Hospital Overview</button>
                    <button onClick={() => setActiveTab('patient_logs')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'patient_logs' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>All Patient Logs</button>
                    <button onClick={() => setActiveTab('lab_stats')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'lab_stats' ? 'bg-white text-green-600 shadow' : 'text-slate-500'}`}>Lab Statistics</button>
                </div>
                <button onClick={onBack} className="bg-red-50 text-red-600 border border-red-200 px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-100">Exit Stats</button>
            </div>

            <div className="min-h-[500px]">
                {activeTab === 'overview' && <HospitalStatsView />}
                {/* Reusing DetailedLogScreen but we pass limited props as we are in view-only mode primarily or admin mode */}
                {activeTab === 'patient_logs' && <DetailedLogScreen onBack={() => setActiveTab('overview')} userRole={'superadmin'} onReprint={() => {}} />}
                {activeTab === 'lab_stats' && <StatisticsScreen onBack={() => setActiveTab('overview')} userRole={'superadmin'} />}
            </div>
        </div>
    );
};

export default GlobalStats;
