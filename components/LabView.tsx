

import React, { useState, useMemo } from 'react';
import { LabOrder, CbcReportData, Patient, SelectedTests, AppPrintSettings, HormoneReportSelection, InventoryItem, SavedReport, Consultant } from '../types';
import ReportForm from './ReportForm';
import { DEFAULT_CBC_REPORT_DATA } from '../services/defaultReportData';
import { extractCbcDataFromImage } from '../services/geminiService';
import ReportPreview from './ReportPreview';
import InventoryScreen from './InventoryScreen';

interface LabViewProps {
  patients: Patient[];
  labOrders: LabOrder[];
  printSettings?: AppPrintSettings;
  inventory: InventoryItem[];
  consultants: Consultant[];
  onUpdateInventory: (data: InventoryItem[]) => void;
  onCompleteOrder: (id: string, data: CbcReportData, tests: SelectedTests) => void;
}

const LabView: React.FC<LabViewProps> = ({ patients, labOrders, printSettings, inventory, consultants, onUpdateInventory, onCompleteOrder }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'completed' | 'inventory'>('queue');
  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<LabOrder | null>(null);
  const [reportData, setReportData] = useState<CbcReportData | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10));

  const pending = useMemo(() => labOrders.filter(o => {
      const orderDate = new Date(o.timestamp).toISOString().slice(0, 10);
      return o.status === 'pending' && !o.ultrasound && orderDate === viewDate;
  }), [labOrders, viewDate]);

  const completed = useMemo(() => labOrders.filter(o => {
      const rDate = o.reportData?.date || new Date(o.timestamp).toISOString().slice(0, 10);
      return o.status === 'completed' && !o.ultrasound && rDate === viewDate;
  }).sort((a,b) => b.timestamp - a.timestamp), [labOrders, viewDate]);

  const handleStartReport = (order: LabOrder) => {
    const patient = patients.find(p => p.id === order.patientId);
    setActiveOrder(order);
    
    if (order.reportData) {
        setReportData(order.reportData);
    } else {
        const effectiveTests = { 
            ...order.tests, 
            other: order.tests.other || order.tests.bloodSugar || order.tests.bloodGroup 
        };
        
        const newReportData = {
          ...DEFAULT_CBC_REPORT_DATA,
          patientName: patient?.name || '',
          age: patient?.age || '',
          address: patient?.address || '',
          serialNumber: Math.floor(Math.random() * 1000),
          billNumber: `L-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10)
        };

        if (order.tests.hormone && order.tests.hormoneDetails) {
            newReportData.hormoneReport.selection = {
                ...newReportData.hormoneReport.selection,
                ...order.tests.hormoneDetails as HormoneReportSelection
            };
        }
        
        setReportData(newReportData);
        setActiveOrder({ ...order, tests: effectiveTests });
    }
  };

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !reportData) return;
    setIsOcrLoading(true);
    try {
      const file = e.target.files[0];
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const extracted = await extractCbcDataFromImage(base64, file.type);
      setReportData({
        ...reportData,
        haematologyParameters: extracted.haematologyParameters || reportData.haematologyParameters,
        whiteBloodCellParameters: extracted.whiteBloodCellParameters || reportData.whiteBloodCellParameters,
        plateletParameters: extracted.plateletParameters || reportData.plateletParameters
      });
      alert("CBC Data Extracted!");
    } catch (error) {
      alert("Extraction failed.");
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Render Report Form if active
  if (activeOrder && reportData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
           <button onClick={() => setActiveOrder(null)} className="bg-slate-800 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">← Back</button>
           {activeOrder.tests.cbc && (
             <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all shadow-xl">
                {isOcrLoading ? "🤖 AI Processing..." : "📸 Photo Analysis (CBC)"}
                <input type="file" className="hidden" accept="image/*" onChange={handleOcrUpload} disabled={isOcrLoading} />
             </label>
           )}
        </div>
        <ReportForm 
          reportData={reportData} 
          selectedTests={activeOrder.tests}
          printSettings={printSettings}
          reportPreviewRef={{ current: null } as any}
          onDataChange={(f, v) => setReportData({...reportData, [f]: v})}
          onParameterChange={(s, i, f, v) => {
             const updated = [...(reportData[s] as any)];
             updated[i] = { ...updated[i], [f]: v };
             setReportData({ ...reportData, [s]: updated });
          }}
          onNestedChange={(path, val) => {
             const newData = JSON.parse(JSON.stringify(reportData));
             let curr = newData;
             for(let i=0; i<path.length-1; i++) curr = curr[path[i]];
             curr[path[path.length-1]] = val;
             setReportData(newData);
          }}
          onPrint={() => {
            window.print();
            onCompleteOrder(activeOrder.id, reportData, activeOrder.tests);
            setTimeout(() => {
                alert("Report Finalized & Synced to Cloud!");
                setActiveOrder(null);
            }, 500);
          }}
          onPrintNoSave={() => window.print()}
          onPrintBill={() => {}}
          onReset={() => setActiveOrder(null)}
          isMobileView={false}
        />
      </div>
    );
  }

  // Render Inventory Screen
  if (activeTab === 'inventory') {
      return <InventoryScreen inventory={inventory} reportHistory={[]} onUpdate={onUpdateInventory} onBack={() => setActiveTab('queue')} />;
  }

  // Main Lab Dashboard
  return (
    <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-200">
      <div className="flex justify-between items-end mb-10 border-b-2 border-slate-50 pb-6">
        <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Laboratory Queue ({viewDate})</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Diagnostic Monitoring</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase">View Date:</span>
                <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="bg-transparent font-bold text-slate-800 outline-none text-xs" />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setActiveTab('queue')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'queue' ? 'bg-white text-blue-600 shadow' : 'text-slate-400 hover:text-slate-600'}`}>Pending</button>
                <button onClick={() => setActiveTab('completed')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'completed' ? 'bg-white text-green-600 shadow' : 'text-slate-400 hover:text-slate-600'}`}>Completed</button>
                <button onClick={() => setActiveTab('inventory')} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all text-slate-400 hover:text-slate-600">Inventory</button>
            </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-6 py-4 rounded-l-xl">Patient Details</th>
              <th className="px-6 py-4">Test Requested</th>
              <th className="px-6 py-4 text-right rounded-r-xl">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(activeTab === 'queue' ? pending : completed).map(order => {
                const patient = patients.find(p => p.id === order.patientId);
                return (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                        <p className="font-black text-slate-800 text-lg">{patient?.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{patient?.age} • {patient?.mobile}</p>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(order.tests).filter(([k, v]) => v && k !== 'hormoneDetails').map(([key]) => (
                                <span key={key} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">{key}</span>
                            ))}
                            {order.tests.hormone && (
                                <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-purple-100">Hormones</span>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        {activeTab === 'queue' ? (
                            <button onClick={() => handleStartReport(order)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95">
                                {order.status === 'pending' ? 'Start Analysis' : 'Continue'}
                            </button>
                        ) : (
                            <button onClick={() => handleStartReport(order)} className="text-green-600 hover:text-green-700 font-black uppercase text-[10px] tracking-widest border border-green-200 px-4 py-2 rounded-xl hover:bg-green-50">
                                Edit Report
                            </button>
                        )}
                    </td>
                  </tr>
                );
            })}
            {(activeTab === 'queue' ? pending : completed).length === 0 && (
                <tr>
                    <td colSpan={3} className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest italic">
                        No {activeTab} orders for this date.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LabView;
