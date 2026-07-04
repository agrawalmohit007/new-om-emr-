import React, { useState, useMemo, useCallback } from 'react';
import { RegistryTemplate, RegistryRecord, Patient, IpdAdmission, VisitRecord } from '../types';

interface AnalyticsTabProps {
    registryTemplates: RegistryTemplate[];
    registryRecords: RegistryRecord[];
    patients?: Patient[];
    admissions?: IpdAdmission[];
    visits?: VisitRecord[];
    onUpdateTemplates: (data: RegistryTemplate[]) => void;
    onUpdateRecords: (data: RegistryRecord[]) => void;
}

// Helper: get today's date string YYYY-MM-DD
const todayStr = () => new Date().toISOString().split('T')[0];
// Helper: first day of current month
const firstOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
    registryTemplates, registryRecords, patients = [], admissions = [], visits = [],
    onUpdateTemplates, onUpdateRecords
}) => {
    const [activeRegistryId, setActiveRegistryId] = useState<string | null>(
        registryTemplates.length > 0 ? registryTemplates[0].id : null
    );
    const [showAddForm, setShowAddForm] = useState(false);
    const [newRegistryDescription, setNewRegistryDescription] = useState('');
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

    // --- Search / Filter state ---
    const [searchName, setSearchName] = useState('');
    const [dateFrom, setDateFrom] = useState(firstOfMonthStr());
    const [dateTo, setDateTo] = useState(todayStr());
    const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});
    const [showFieldFilters, setShowFieldFilters] = useState(false);

    const activeTemplate = registryTemplates.find(t => t.id === activeRegistryId);
    const allRegistryRecords = registryRecords.filter(r => r.registryId === activeRegistryId)
        .sort((a, b) => b.timestamp - a.timestamp);

    // --- Smart filtered records ---
    const filteredRecords = useMemo(() => {
        return allRegistryRecords.filter(r => {
            // Date range filter (by record timestamp)
            const rDate = new Date(r.timestamp).toISOString().split('T')[0];
            if (dateFrom && rDate < dateFrom) return false;
            if (dateTo && rDate > dateTo) return false;

            // Name search — looks in any field that contains "name" in its key (case insensitive)
            if (searchName.trim()) {
                const q = searchName.trim().toLowerCase();
                const nameFields = Object.entries(r.data).filter(([k]) => k.toLowerCase().includes('name'));
                const anyNameMatch = nameFields.some(([, v]) => String(v || '').toLowerCase().includes(q));
                // Also check all fields as a fallback
                const anyFieldMatch = Object.values(r.data).some(v => String(v || '').toLowerCase().includes(q));
                if (!anyNameMatch && !anyFieldMatch) return false;
            }

            // Per-field filters
            for (const [field, filterVal] of Object.entries(fieldFilters)) {
                if (String(filterVal || '').trim() && !String(r.data[field] || '').toLowerCase().includes(String(filterVal || '').toLowerCase())) {
                    return false;
                }
            }

            return true;
        });
    }, [allRegistryRecords, searchName, dateFrom, dateTo, fieldFilters]);

    const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
        setSyncToast({ message, type });
        setTimeout(() => setSyncToast(null), 4000);
    };

    // --- Build source data payload for AI ---
    const buildSourceData = useCallback((filteredAdmissions: IpdAdmission[], filteredVisits: VisitRecord[]) => ({
        patients: patients.map(p => ({
            id: p.id,
            name: p.name,
            age: p.age,
            address: p.address,
            mobile: p.mobile,
            uhid: p.uhid,
            customFields: p.customFields || {}
        })),
        admissions: filteredAdmissions.map(a => ({
            id: a.id,
            patientId: a.patientId,
            admissionDate: a.admissionDate,
            dischargeDate: a.dischargeDate,
            diagnosis: a.diagnosis,
            customFields: a.customFields || {},
            operativeNotes: (a.operativeNotes || []).map(op => ({
                procedureName: op.procedureName,
                surgeonName: op.surgeonName,
                anesthesiaType: op.anesthesiaType,
                preOpDiagnosis: op.preOpDiagnosis,
                procedureDetails: op.procedureDetails,
                incisionType: op.incisionType,
                bloodLoss: op.bloodLoss,
                babyDetails: op.babyDetails,
                customFields: op.customFields || {}
            }))
        })),
        visits: filteredVisits.map(v => ({
            id: v.id,
            patientId: v.patientId,
            date: v.date,
            complaints: v.complaints,
            prescription: v.prescription,
            generalExamination: v.generalExamination,
            examinationDetails: v.examinationDetails,
            vitals: v.vitals,
            customFields: v.customFields || {}
        }))
    }), [patients, admissions, visits]);

    // --- Create new registry (with auto-populate) ---
    const handleCreateRegistry = async () => {
        if (!newRegistryDescription.trim()) return;
        setIsLoadingFields(true);
        try {
            const localApiKey = localStorage.getItem('gemini_api_key') || '';
            const res = await fetch('/api/generateRegistryFields', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: newRegistryDescription, apiKey: localApiKey })
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }

            if (data.fields && Array.isArray(data.fields)) {
                const cleanFields = Array.from(new Set(data.fields.map((f: string) => f.trim()))) as string[];
                const newRegistry: RegistryTemplate = {
                    id: `reg_${Date.now()}`,
                    name: newRegistryDescription,
                    fields: cleanFields,
                    fieldConfigs: data.fieldConfigs || [],
                    isMandatory: false
                };

                const sourceData = buildSourceData(admissions, visits);
                let autoRecords: RegistryRecord[] = [];
                try {
                    const popRes = await fetch('/api/populateRegistryData', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            description: newRegistryDescription,
                            fields: cleanFields,
                            sourceData,
                            apiKey: localApiKey
                        })
                    });
                    const popData = await popRes.json();
                    if (popData.records && Array.isArray(popData.records)) {
                        autoRecords = popData.records.map((r: any, index: number) => ({
                            id: `rec_auto_${Date.now()}_${index}`,
                            registryId: newRegistry.id,
                            timestamp: Date.now() - index * 1000,
                            data: r
                        }));
                    }
                } catch (popErr) {
                    console.error('Failed to auto-populate registry data', popErr);
                }

                onUpdateTemplates([...registryTemplates, newRegistry]);
                onUpdateRecords([...autoRecords, ...registryRecords]);
                setActiveRegistryId(newRegistry.id);
                setShowAddForm(false);
                setNewRegistryDescription('');
                showToast(`Registry created with ${autoRecords.length} records auto-populated.`, 'success');
            } else {
                alert('Failed to determine fields from AI.');
            }
        } catch (e: any) {
            alert('Error generating registry fields: ' + e.message);
        } finally {
            setIsLoadingFields(false);
        }
    };

    // --- Sync new data into existing registry ---
    const handleSyncNewData = async () => {
        if (!activeTemplate) return;
        setIsSyncing(true);
        try {
            const localApiKey = localStorage.getItem('gemini_api_key') || '';

            // Filter source data by the selected date range
            const filteredAdmissions = admissions.filter(a => {
                const d = a.admissionDate;
                return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
            });
            const filteredVisits = visits.filter(v => {
                const d = v.date;
                return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
            });

            const sourceData = buildSourceData(filteredAdmissions, filteredVisits);

            const popRes = await fetch('/api/populateRegistryData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: activeTemplate.name,
                    fields: activeTemplate.fields,
                    sourceData,
                    dateRange: dateFrom && dateTo ? { start: dateFrom, end: dateTo } : null,
                    apiKey: localApiKey
                })
            });
            const popData = await popRes.json();
            if (popData.error) { showToast(popData.error, 'error'); return; }

            if (popData.records && Array.isArray(popData.records)) {
                // Deduplication: find existing patient names in this registry
                const existingPatientNames = new Set(
                    allRegistryRecords.map(r => {
                        const nameField = Object.entries(r.data).find(([k]) => k.toLowerCase().includes('name'));
                        return nameField ? String(nameField[1]).toLowerCase().trim() : '';
                    }).filter(Boolean)
                );

                const newRecords: RegistryRecord[] = [];
                popData.records.forEach((r: any, index: number) => {
                    const nameField = Object.entries(r as Record<string, string>).find(([k]) => k.toLowerCase().includes('name'));
                    const patientName = nameField ? (nameField[1] as string).toLowerCase().trim() : '';
                    // Skip if already exists
                    if (patientName && existingPatientNames.has(patientName)) return;
                    newRecords.push({
                        id: `rec_sync_${Date.now()}_${index}`,
                        registryId: activeTemplate.id,
                        timestamp: Date.now() - index * 500,
                        data: r
                    });
                });

                if (newRecords.length === 0) {
                    showToast('No new entries found — all are already in the registry.', 'info');
                } else {
                    onUpdateRecords([...newRecords, ...registryRecords]);
                    showToast(`✅ ${newRecords.length} new entries added to registry.`, 'success');
                }
            }
        } catch (e: any) {
            showToast('Sync failed: ' + e.message, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    // --- Manual new entry ---
    const handleAddRecord = () => {
        if (!activeTemplate) return;
        const newRecord: RegistryRecord = {
            id: `rec_${Date.now()}`,
            registryId: activeTemplate.id,
            timestamp: Date.now(),
            data: {}
        };
        activeTemplate.fields.forEach(f => newRecord.data[f] = '');
        onUpdateRecords([newRecord, ...registryRecords]);
    };

    const handleUpdateRecord = (recordId: string, field: string, value: string) => {
        const updated = registryRecords.map(r => {
            if (r.id === recordId) return { ...r, data: { ...r.data, [field]: value } };
            return r;
        });
        onUpdateRecords(updated);
    };

    const handleDeleteRecord = (recordId: string) => {
        if (confirm('Delete this registry entry?')) {
            onUpdateRecords(registryRecords.filter(r => r.id !== recordId));
        }
    };

    const clearAllFilters = () => {
        setSearchName('');
        setDateFrom(firstOfMonthStr());
        setDateTo(todayStr());
        setFieldFilters({});
    };

    const hasActiveFilters = searchName.trim() || Object.values(fieldFilters).some(v => String(v || '').trim())
        || dateFrom !== firstOfMonthStr() || dateTo !== todayStr();

    const toastColors = {
        success: 'bg-emerald-500',
        info: 'bg-blue-500',
        error: 'bg-red-500'
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full min-h-[80vh] relative">

            {/* Toast Notification */}
            {syncToast && (
                <div className={`fixed top-6 right-6 z-50 ${toastColors[syncToast.type]} text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2 animate-pulse`}>
                    <span>{syncToast.message}</span>
                    <button onClick={() => setSyncToast(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
                </div>
            )}

            {/* ── LEFT PANEL: Registry List ── */}
            <div className="w-full md:w-1/4 bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Registries</h2>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase hover:bg-purple-700 transition-colors"
                    >
                        + Add
                    </button>
                </div>

                {showAddForm && (
                    <div className="mb-6 bg-purple-50 p-4 rounded-xl border border-purple-200">
                        <p className="text-[10px] font-black text-purple-600 uppercase mb-2">Describe Data Need</p>
                        <textarea
                            value={newRegistryDescription}
                            onChange={(e) => setNewRegistryDescription(e.target.value)}
                            placeholder="e.g. LSCS Register or Dengue Tracking"
                            className="w-full text-xs p-2 rounded-lg border font-bold h-20 outline-none resize-none focus:border-purple-400"
                        />
                        <button
                            onClick={handleCreateRegistry}
                            disabled={isLoadingFields}
                            className="mt-2 w-full bg-gradient-to-r from-purple-600 to-indigo-600 disabled:from-slate-300 disabled:to-slate-300 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {isLoadingFields ? (
                                <>
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                    </svg>
                                    AI Generating & Populating...
                                </>
                            ) : '✨ Generate & Auto-Populate'}
                        </button>
                    </div>
                )}

                <div className="space-y-2 overflow-y-auto max-h-[60vh]">
                    {registryTemplates.length === 0 && (
                        <p className="text-xs text-slate-400 font-bold text-center py-4">No registries yet. Create one using AI.</p>
                    )}
                    {registryTemplates.map(t => (
                        <div
                            key={t.id}
                            onClick={() => { setActiveRegistryId(t.id); setFieldFilters({}); }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                activeRegistryId === t.id
                                    ? 'bg-purple-100 border-purple-400 ring-1 ring-purple-400'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="font-bold text-sm text-slate-700 leading-tight">{t.name}</span>
                                <div className="flex flex-col items-end gap-1 ml-1">
                                    {t.isMandatory && (
                                        <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase">Mandatory</span>
                                    )}
                                    <span className="text-[9px] text-slate-400 font-bold">
                                        {registryRecords.filter(r => r.registryId === t.id).length} entries
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── RIGHT PANEL: Registry Table ── */}
            <div className="w-full md:w-3/4 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex flex-col gap-4">
                {activeTemplate ? (
                    <>
                        {/* Header row */}
                        <div className="flex flex-wrap justify-between items-start gap-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{activeTemplate.name}</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase">
                                    {filteredRecords.length} of {allRegistryRecords.length} entries
                                    {hasActiveFilters && <span className="ml-2 text-purple-500">(filtered)</span>}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Sync button */}
                                <button
                                    onClick={handleSyncNewData}
                                    disabled={isSyncing}
                                    className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-300 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-md transition-all"
                                    title="Sync new entries from the database into this registry"
                                >
                                    {isSyncing ? (
                                        <>
                                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                            </svg>
                                            Syncing...
                                        </>
                                    ) : '🔄 Sync New Data'}
                                </button>
                                {/* Manual entry */}
                                <button
                                    onClick={handleAddRecord}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase shadow-md transition-colors"
                                >
                                    + New Entry
                                </button>
                            </div>
                        </div>

                        {/* ── SEARCH / FILTER BAR ── */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-3">
                            {/* Row 1: Name search + Date range + toggle */}
                            <div className="flex flex-wrap gap-2 items-center">
                                {/* Name / Global Search */}
                                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 flex-1 min-w-[160px]">
                                    <span className="text-slate-400 text-sm">🔍</span>
                                    <input
                                        type="text"
                                        value={searchName}
                                        onChange={e => setSearchName(e.target.value)}
                                        placeholder="Search patient name or any value..."
                                        className="bg-transparent outline-none text-xs font-bold text-slate-700 placeholder-slate-400 w-full"
                                    />
                                    {searchName && (
                                        <button onClick={() => setSearchName('')} className="text-slate-400 hover:text-red-500 text-xs font-black">✕</button>
                                    )}
                                </div>

                                {/* Date From */}
                                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">From</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e => setDateFrom(e.target.value)}
                                        className="outline-none text-xs font-bold text-slate-700 bg-transparent"
                                    />
                                </div>

                                {/* Date To */}
                                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">To</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={e => setDateTo(e.target.value)}
                                        className="outline-none text-xs font-bold text-slate-700 bg-transparent"
                                    />
                                </div>

                                {/* Advanced field filters toggle */}
                                <button
                                    onClick={() => setShowFieldFilters(p => !p)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all ${
                                        showFieldFilters
                                            ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    ⚙️ Field Filters
                                </button>

                                {/* Clear all */}
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors"
                                    >
                                        ✕ Clear
                                    </button>
                                )}
                            </div>

                            {/* Row 2: Per-field filters (collapsible) */}
                            {showFieldFilters && (
                                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200">
                                    {activeTemplate.fields.map(field => (
                                        <div key={field} className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 min-w-[140px]">
                                            <span className="text-[10px] font-black text-indigo-500 uppercase whitespace-nowrap">{field}</span>
                                            <input
                                                type="text"
                                                value={fieldFilters[field] || ''}
                                                onChange={e => setFieldFilters(prev => ({ ...prev, [field]: e.target.value }))}
                                                placeholder="filter..."
                                                className="outline-none text-xs font-bold text-slate-700 bg-transparent w-full"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Results summary */}
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                                <span className={`px-2 py-0.5 rounded-full ${filteredRecords.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                    {filteredRecords.length} matching
                                </span>
                                <span>of {allRegistryRecords.length} total entries</span>
                                {dateFrom && dateTo && (
                                    <span className="text-slate-400">
                                        · {new Date(dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                        {' — '}
                                        {new Date(dateTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── TABLE ── */}
                        <div className="flex-grow overflow-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-3 font-black text-[10px] uppercase text-slate-500 tracking-wider border-b border-slate-200 w-10">#</th>
                                        {activeTemplate.fields.map(f => (
                                            <th key={f} className="p-3 font-black text-[10px] uppercase text-slate-500 tracking-wider border-b border-slate-200">
                                                {f}
                                            </th>
                                        ))}
                                        <th className="p-3 font-black text-[10px] uppercase text-slate-500 tracking-wider border-b border-slate-200 w-16">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={activeTemplate.fields.length + 2} className="p-10 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <span className="text-4xl">🗂️</span>
                                                    <p className="text-slate-400 font-bold uppercase text-xs">
                                                        {allRegistryRecords.length > 0
                                                            ? 'No entries match your filters.'
                                                            : 'No records yet. Use Sync New Data or + New Entry.'}
                                                    </p>
                                                    {allRegistryRecords.length > 0 && hasActiveFilters && (
                                                        <button onClick={clearAllFilters} className="text-xs text-blue-500 font-black underline">Clear filters</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((r, rIdx) => (
                                            <tr
                                                key={r.id}
                                                className="border-b border-slate-100 hover:bg-indigo-50/40 transition-colors group"
                                            >
                                                <td className="p-2 px-3 text-[10px] text-slate-400 font-black border-r border-slate-100">
                                                    {rIdx + 1}
                                                </td>
                                                {activeTemplate.fields.map(f => (
                                                    <td key={f} className="p-1 px-2 border-r border-slate-100 last-of-type:border-none">
                                                        <input
                                                            type="text"
                                                            value={r.data[f] || ''}
                                                            onChange={(e) => handleUpdateRecord(r.id, f, e.target.value)}
                                                            className="w-full min-w-[120px] bg-transparent border-b border-transparent focus:border-indigo-400 group-hover:border-slate-200 outline-none p-1 text-xs font-bold text-slate-700 transition-colors"
                                                            placeholder={`Enter ${f}`}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="p-2 text-center border-l border-slate-100">
                                                    <button
                                                        onClick={() => handleDeleteRecord(r.id)}
                                                        className="text-slate-300 hover:text-red-500 font-black p-1 rounded transition-colors"
                                                        title="Delete entry"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom hint */}
                        <p className="text-[10px] text-slate-400 font-bold uppercase text-center">
                            Click any cell to edit · Changes are saved automatically · Use Sync New Data after new admissions
                        </p>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-slate-400 gap-4">
                        <span className="text-5xl">📋</span>
                        <div className="text-center">
                            <p className="font-black uppercase text-sm mb-1">No registry selected</p>
                            <p className="text-xs font-bold">Create one using AI or select an existing registry from the left panel</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsTab;
