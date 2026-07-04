
import React, { useState, useEffect } from 'react';
import { SavedReport, UserRole, AppPrintSettings } from '../types';
import { generateBillItemsFromReport } from '../services/billingService';
import { numberToWords } from '../services/numberToWords';
import { syncToCloud } from '../services/firebaseService';

interface DetailedLogScreenProps {
    onBack: () => void;
    userRole: UserRole;
    onReprint: (report: SavedReport) => void;
    printSettings?: AppPrintSettings;
}

const DetailedLogScreen: React.FC<DetailedLogScreenProps> = ({ onBack, userRole, onReprint, printSettings }) => {
    const [reports, setReports] = useState<SavedReport[]>([]);
    // Initialize date filters to current date
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [viewMode, setViewMode] = useState<'active' | 'recycle'>('active');
    
    const isAdmin = userRole === 'admin';

    useEffect(() => {
        loadData();
        const handleCloudUpdate = () => loadData();
        window.addEventListener('cloud-data-sync', handleCloudUpdate);
        return () => window.removeEventListener('cloud-data-sync', handleCloudUpdate);
    }, []);

    const loadData = () => {
        const historyJson = localStorage.getItem('reportHistory');
        if (historyJson) {
            try {
                const parsed = JSON.parse(historyJson);
                setReports(Array.isArray(parsed) ? parsed : []);
            } catch (e) {
                console.error("Failed to load reports", e);
                setReports([]);
            }
        }
    };

    const handleDeleteReport = (index: number) => {
        const reason = prompt("Enter reason for deletion:");
        if (!reason) return;
        const updatedReports = [...reports];
        const reportToDelete = viewMode === 'active' ? activeReports[index] : null;
        if (!reportToDelete) return;
        const masterIndex = reports.findIndex(r => (r.id && r.id === reportToDelete.id) || r.timestamp === reportToDelete.timestamp);
        if (masterIndex === -1) return;
        updatedReports[masterIndex].isDeleted = true;
        updatedReports[masterIndex].deletionReason = reason;
        updatedReports[masterIndex].deletionTimestamp = Date.now();
        saveAndSync(updatedReports);
    };

    const handleRestoreReport = (index: number) => {
        const reportToRestore = deletedReports[index];
        const masterIndex = reports.findIndex(r => (r.id && r.id === reportToRestore.id) || r.timestamp === reportToRestore.timestamp);
        if (masterIndex === -1) return;
        const updatedReports = [...reports];
        updatedReports[masterIndex].isDeleted = false;
        saveAndSync(updatedReports);
    };

    const saveAndSync = (updated: SavedReport[]) => {
        setReports(updated);
        localStorage.setItem('reportHistory', JSON.stringify(updated));
        syncToCloud('reportHistory', updated);
    };

    const handlePrintBill = (report: SavedReport) => {
        if (!report.reportData) return;
        let billData = report.billData || {
            billNumber: report.reportData.billNumber,
            serialNumber: report.reportData.serialNumber,
            patientName: report.reportData.patientName,
            refBy: report.reportData.refBy,
            date: report.reportData.date,
            items: generateBillItemsFromReport(report.selectedTests, report.reportData),
            total: generateBillItemsFromReport(report.selectedTests, report.reportData).reduce((s, i) => s + i.price, 0)
        };
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        const rows = billData.items.map((it, idx) => `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">${it.testName}</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${it.price.toFixed(2)}</td></tr>`).join('');
        const layout = printSettings?.bill || { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, headerHeight: 70, footerHeight: 10 };

        const html = `
        <html>
        <head>
          <title>Print Bill</title>
          <style>
            body { 
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                color: #333; 
                margin: 0;
                padding-top: ${layout.marginTop}mm;
                padding-bottom: ${layout.marginBottom}mm;
                padding-left: ${layout.marginLeft}mm;
                padding-right: ${layout.marginRight}mm;
            }
            .header-space { height: ${layout.headerHeight}mm; }
            .container { width: 100%; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
            .header p { margin: 5px 0 0; font-size: 14px; }
            .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .info div { line-height: 1.6; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; padding: 10px; border-bottom: 2px solid #333; font-size: 12px; text-transform: uppercase; }
            .total-row td { border-top: 2px solid #333; font-weight: bold; font-size: 16px; color: #000; padding: 10px; }
            .words { font-style: italic; font-size: 13px; margin-bottom: 40px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; font-weight: bold; }
            .signatures div { border-top: 1px solid #333; padding-top: 5px; width: 40%; text-align: center; }
            @media print {
                body { padding: 0; padding-top: ${layout.marginTop}mm; padding-left: ${layout.marginLeft}mm; }
                @page { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header-space"></div>
          <div class="container">
            <div class="header">
              <h1>J J HOSPITAL DONDAICHA</h1>
              <p>Pathology Bill</p>
            </div>
            <div class="info">
              <div>
                <strong>Patient Details:</strong><br>
                Name: ${billData.patientName}<br>
                Ref By: ${billData.refBy}
              </div>
              <div style="text-align: right;">
                <strong>Bill Details:</strong><br>
                Bill No: ${billData.billNumber}<br>
                Date: ${billData.date}
              </div>
            </div>
            <table>
              <thead>
                <tr><th>Description</th><th style="text-align: right;">Amount</th></tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr class="total-row">
                  <td>Grand Total</td>
                  <td style="text-align: right;">₹${billData.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <div class="words">Amount in Words: Rupees ${numberToWords(Math.floor(billData.total))} Only</div>
            <div class="signatures">
               <div>Patient Signature</div>
               <div>Authorized Signatory</div>
            </div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
        </html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const downloadExcel = () => {
        const headers = ["S.No", "Date", "Patient", "Ref By", "Bill No", "Rev", "Tests", "Hb", "WBC", "PLT", "HIV", "HBsAg", "VDRL", "Widal", "HbA1c", "TSH", "U.Alb", "CRP"];
        const csv = [headers.join(','), ...reportsToDisplay.map(r => {
            if (!r.reportData) return '';
            const rev = r.billData ? r.billData.total : generateBillItemsFromReport(r.selectedTests, r.reportData).reduce((s, i) => s + i.price, 0);
            const getP = (n:string) => r.reportData.haematologyParameters?.find(p=>p.investigation===n)?.result || r.reportData.whiteBloodCellParameters?.find(p=>p.investigation===n)?.result || r.reportData.plateletParameters?.find(p=>p.investigation===n)?.result || '-';
            const hb = r.selectedTests.cbc ? getP('HGB') : '-';
            return [`"${r.reportData.serialNumber}"`,`"${r.reportData.date}"`,`"${r.reportData.patientName}"`,`"${r.reportData.refBy}"`,`"${r.reportData.billNumber}"`,`"${rev}"`,`"${Object.keys(r.selectedTests).filter(k=>r.selectedTests[k as keyof typeof r.selectedTests]).join('|')}"`,`"${hb}"`].join(',');
        })].filter(row => row).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Reports_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    };

    const activeReports = reports.filter(r => r.reportData && !r.isDeleted && (!startDate || new Date(r.reportData.date) >= new Date(startDate)) && (!endDate || new Date(r.reportData.date) <= new Date(endDate)));
    const deletedReports = reports.filter(r => r.reportData && r.isDeleted && (!startDate || new Date(r.reportData.date) >= new Date(startDate)) && (!endDate || new Date(r.reportData.date) <= new Date(endDate)));
    const reportsToDisplay = viewMode === 'active' ? activeReports : deletedReports;

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-2 md:p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">Patient Report Logs</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        System Records & Archives
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2">
                        <span>📊</span> Export CSV
                    </button>
                    <button onClick={onBack} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95">
                        Back
                    </button>
                </div>
            </div>

            {/* Controls & Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* View Mode Toggles */}
                <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex w-fit">
                    <button 
                        onClick={() => setViewMode('active')} 
                        className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${viewMode === 'active' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        Active Records
                    </button>
                    {isAdmin && (
                        <button 
                            onClick={() => setViewMode('recycle')} 
                            className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${viewMode === 'recycle' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                        >
                            Recycle Bin
                        </button>
                    )}
                </div>

                {/* Date Filters */}
                <div className="flex gap-4 items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit lg:ml-auto">
                    <div className="px-4 border-r border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">From Date</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="font-bold text-slate-700 outline-none text-xs bg-transparent" />
                    </div>
                    <div className="px-4">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">To Date</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="font-bold text-slate-700 outline-none text-xs bg-transparent" />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                            {viewMode === 'active' ? 'Live Database' : 'Deleted Items'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Showing {reportsToDisplay.length} records
                        </p>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Action Controls</th>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Patient Identity</th>
                                <th className="px-6 py-4">Reference</th>
                                <th className="px-6 py-4">Bill ID</th>
                                <th className="px-6 py-4 text-center">Hb</th>
                                <th className="px-6 py-4 text-center">WBC</th>
                                <th className="px-6 py-4 text-center">PLT</th>
                                <th className="px-6 py-4 text-center">HIV</th>
                                <th className="px-6 py-4 text-center">Widal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportsToDisplay.map((r, i) => {
                                 const getP = (n:string) => r.reportData.haematologyParameters?.find(p=>p.investigation===n)?.result || r.reportData.whiteBloodCellParameters?.find(p=>p.investigation===n)?.result || r.reportData.plateletParameters?.find(p=>p.investigation===n)?.result || '-';
                                 const hb = r.selectedTests.cbc ? getP('HGB') : '-';
                                 const wbc = r.selectedTests.cbc ? getP('WBC') : '-';
                                 const plt = r.selectedTests.cbc ? getP('PLT') : '-';
                                 const widal = r.selectedTests.widal ? (r.reportData.widalReport?.parameters?.some(p=>p.result==='Reactive') ? 'React' : 'NR') : '-';
                                 
                                 return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onReprint(r)} className="bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 p-2 rounded-lg transition-all" title="View Report">
                                                    📄
                                                </button>
                                                <button onClick={() => handlePrintBill(r)} className="bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-700 p-2 rounded-lg transition-all" title="Print Bill">
                                                    🧾
                                                </button>
                                                {viewMode === 'active' ? (
                                                    <button onClick={() => handleDeleteReport(i)} className="bg-red-100 hover:bg-red-600 hover:text-white text-red-700 p-2 rounded-lg transition-all" title="Delete">
                                                        🗑️
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleRestoreReport(i)} className="bg-green-100 hover:bg-green-600 hover:text-white text-green-700 p-2 rounded-lg transition-all" title="Restore">
                                                        ♻️
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-bold text-slate-700">{r.reportData.date}</p>
                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(r.timestamp).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-black text-slate-800">{r.reportData.patientName}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">{r.reportData.age}</p>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-600">{r.reportData.refBy}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500 bg-slate-100 w-fit rounded px-2 py-1">{r.reportData.billNumber}</td>
                                        <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-700">{hb}</td>
                                        <td className="px-6 py-4 text-center font-mono text-xs text-slate-600">{wbc}</td>
                                        <td className="px-6 py-4 text-center font-mono text-xs text-slate-600">{plt}</td>
                                        <td className="px-6 py-4 text-center">
                                            {r.reportData.serology?.selection?.hiv ? (
                                                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">HIV Test</span>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center text-xs font-bold">
                                            {widal === 'React' ? <span className="text-red-600">POS</span> : <span className="text-slate-400">{widal}</span>}
                                        </td>
                                    </tr>
                                 )
                            })}
                            {reportsToDisplay.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-black uppercase text-xs tracking-widest italic bg-slate-50/30">
                                        No records found in this date range.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DetailedLogScreen;
