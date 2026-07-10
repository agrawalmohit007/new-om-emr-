import React, { useState, useMemo, useCallback } from 'react';
import { RegistryTemplate, RegistryRecord, Patient, IpdAdmission, VisitRecord } from '../types';

interface AnalyticsTabProps {
    registryTemplates: RegistryTemplate[];
    registryRecords: RegistryRecord[];
    patients?: Patient[];
    admissions?: IpdAdmission[];
    visits?: VisitRecord[];
    consultants?: import('../types').Consultant[];
    onUpdateTemplates: (data: RegistryTemplate[]) => void;
    onUpdateRecords: (data: RegistryRecord[]) => void;
    clinicalTemplates?: import('../types').ClinicalTemplate[];
    onUpdateClinicalTemplates?: (data: import('../types').ClinicalTemplate[]) => void;
}

// Helper: get today's date string YYYY-MM-DD
const todayStr = () => new Date().toISOString().split('T')[0];
// Helper: first day of current month
const firstOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
    registryTemplates, registryRecords, patients = [], admissions = [], visits = [], consultants = [],
    onUpdateTemplates, onUpdateRecords, clinicalTemplates = [], onUpdateClinicalTemplates
}) => {
    const [activeRegistryId, setActiveRegistryId] = useState<string | null>(
        registryTemplates.length > 0 ? registryTemplates[0].id : null
    );
    const [showAddForm, setShowAddForm] = useState(false);
    
    // MTP Analytics State hooks
    const [showEnvelopeModal, setShowEnvelopeModal] = useState(false);
    const [envelopeRecord, setEnvelopeRecord] = useState<RegistryRecord | null>(null);
    const [envelopeTab, setEnvelopeTab] = useState<'doc-form-c' | 'doc-form-i' | 'doc-consent'>('doc-form-c');
    const [showReprintModal, setShowReprintModal] = useState(false);
    const [reprintPin, setReprintPin] = useState('');
    const [reprintReason, setReprintReason] = useState('');

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

    const handlePrintMtpForms = (record: RegistryRecord) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formCText = record.data['Form C Text'] 
          ? record.data['Form C Text'].replace(/\n/g, '<br/>')
          : `I, <strong>${record.data['Name']}</strong>, daughter/wife of <strong>${record.data['Relation (W/D of)']}</strong>, aged <strong>${record.data['Age']}</strong> years, residing at <strong>${record.data['Address']}</strong>, hereby give my consent for the medical termination of my pregnancy under the Medical Termination of Pregnancy Act, 1971.<br/><br/>Method of Termination: <strong>${record.data['Method']}</strong>`;

        const formIText = record.data['Form I Text']
          ? record.data['Form I Text'].replace(/\n/g, '<br/>')
          : `We/I, Registered Medical Practitioner(s), state that the termination of pregnancy for Patient Serial Number <strong>${record.data['Serial Number']}</strong> is necessitated under Section 3(2)(b)(i) of the Act as the continuation of the pregnancy would involve a risk to the physical or mental health of the pregnant woman.<br/><br/><strong>Reason for MTP:</strong> ${record.data['Indication']}`;

        const consentText = record.data['MTP Consent Text']
          ? record.data['MTP Consent Text'].replace(/\n/g, '<br/>')
          : `I, <strong>${record.data['Name']}</strong>, authorize <strong>${record.data['RMP Name']}</strong> to perform the MTP procedure. I have been informed of the clinical risks, potential complications, and alternative treatments. I agree to accept post-abortion contraceptive advice and have accepted <strong>${record.data['Contraceptive']}</strong>.`;

        printWindow.document.write(`
          <html>
            <head>
              <title>MTP Forms Set - ${record.data['Serial Number'] || 'Draft'}</title>
              <script src="/tailwind.js"></script>
              <style>
                @page { size: A4; margin: 20mm; }
                body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: black; background: white; }
                .page-break { page-break-after: always; }
              </style>
            </head>
            <body class="p-8 space-y-12 text-left">
              <!-- Form C -->
              <div class="page-break space-y-6">
                <h1 class="text-center font-bold text-lg uppercase underline mb-8">Form C (Consent Form)</h1>
                <p class="leading-relaxed text-sm">${formCText}</p>
                <div class="pt-24 flex justify-between text-sm">
                  <span>Date: ${record.data['Admission Date']}</span>
                  <div class="border-t border-black pt-1 w-48 text-center font-bold">Signature / Thumb Impression</div>
                </div>
              </div>
    
              <!-- Form I -->
              <div class="page-break space-y-6">
                <h1 class="text-center font-bold text-lg uppercase underline mb-4">Form I (RMP Opinion Form)</h1>
                <div class="text-right text-sm mb-8"><strong>Serial Number:</strong> ${record.data['Serial Number']}</div>
                <p class="leading-relaxed text-sm">${formIText}</p>
                <div class="pt-24 flex justify-between text-sm">
                  <div>
                    <p>1. ${record.data['RMP Name']}</p>
                    <div class="border-t border-black pt-1 w-48 text-center mt-12 font-bold">Signature of RMP</div>
                  </div>
                  ${record.data['Remarks']?.includes('2nd RMP') ? `
                  <div>
                    <p>2. ${record.data['Remarks'].split('2nd RMP: ')[1]?.split(' (')[0] || 'Second RMP'}</p>
                    <div class="border-t border-black pt-1 w-48 text-center mt-12 font-bold">Signature of RMP</div>
                  </div>` : ''}
                </div>
              </div>
    
              <!-- Procedural Consent -->
              <div class="space-y-6">
                <h1 class="text-center font-bold text-lg uppercase underline mb-8">MTP Informed Consent Form</h1>
                <p class="leading-relaxed text-sm">${consentText}</p>
                <div class="pt-24 flex justify-between text-sm">
                  <span>Date: ${record.data['Admission Date']}</span>
                  <div class="border-t border-black pt-1 w-48 text-center font-bold">Signature / Thumb Impression</div>
                </div>
              </div>
    
              <script>
                window.onload = () => { window.print(); window.close(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
    };

    const handleConfirmReprint = () => {
        if (!envelopeRecord) return;
        const matches = (consultants || []).filter(c => c.pin === reprintPin);
        if (matches.length === 0) {
            alert("❌ Invalid Doctor's PIN! Reprint request aborted.");
            return;
        }
        const doctorObj = matches[0];
        if (!reprintReason.trim()) {
            alert("❌ Please enter a reason for reprinting.");
            return;
        }

        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date().toLocaleDateString('en-IN');
        const reprintLogEntry = `[Reprinted by ${doctorObj.name} at ${timeStr} on ${dateStr} - Reason: ${reprintReason}]`;
        const oldRemarks = envelopeRecord.data['Remarks'] || '';
        const newRemarks = oldRemarks ? `${oldRemarks}; ${reprintLogEntry}` : reprintLogEntry;

        const updated = registryRecords.map(r => {
            if (r.id === envelopeRecord.id) {
                return { ...r, data: { ...r.data, 'Remarks': newRemarks } };
            }
            return r;
        });

        onUpdateRecords(updated);
        
        const updatedRecord = { ...envelopeRecord, data: { ...envelopeRecord.data, 'Remarks': newRemarks } };
        setEnvelopeRecord(updatedRecord);
        handlePrintMtpForms(updatedRecord);

        setShowReprintModal(false);
        setReprintPin('');
        setReprintReason('');
    };

    const handleUpdateMtpText = (field: 'Form C Text' | 'Form I Text' | 'MTP Consent Text', newText: string) => {
        if (!envelopeRecord || !onUpdateRecords) return;
        const updated = (registryRecords || []).map(r => {
            if (r.id === envelopeRecord.id) {
                const updatedRec = {
                    ...r,
                    data: {
                        ...r.data,
                        [field]: newText
                    }
                };
                setEnvelopeRecord(updatedRec);
                return updatedRec;
            }
            return r;
        });
        onUpdateRecords(updated);
    };

    const handleSaveTemplate = (category: string, content: string) => {
        if (!content.trim() || !onUpdateClinicalTemplates) return;
        const title = prompt("Enter a title for this template:", "New Template");
        if (!title) return;
        const newT = {
            id: `tmpl_${Date.now()}`,
            title,
            category,
            content
        };
        onUpdateClinicalTemplates([...clinicalTemplates, newT]);
    };

    const handlePrintMonthlyReport = () => {
        const mtpRecords = registryRecords.filter(r => {
            if (r.registryId !== 'mtp_register') return false;
            const recDate = r.data['Admission Date'];
            if (!recDate) return false;
            if (dateFrom && recDate < dateFrom) return false;
            if (dateTo && recDate > dateTo) return false;
            return true;
        });

        const total = mtpRecords.length;
        let medical = 0;
        let surgical = 0;
        let under12w = 0;
        let twelveTo20w = 0;
        let twentyTo24w = 0;
        
        const indications: Record<string, number> = {};
        const contraceptives: Record<string, number> = {};

        mtpRecords.forEach(r => {
            const method = r.data['Method'] || '';
            if (method.toLowerCase().includes('medical')) medical++;
            else surgical++;

            const gestStr = r.data['Gest. Weeks'] || '';
            const gestVal = parseInt(gestStr);
            if (!isNaN(gestVal)) {
                if (gestVal < 12) under12w++;
                else if (gestVal <= 20) twelveTo20w++;
                else twentyTo24w++;
            } else {
                under12w++;
            }

            const ind = r.data['Indication'] || 'Other';
            indications[ind] = (indications[ind] || 0) + 1;

            const contra = r.data['Contraceptive'] || 'None';
            contraceptives[contra] = (contraceptives[contra] || 0) + 1;
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head>
                    <title>MTP Monthly Report (Form II) - Statutory Summary</title>
                    <script src="/tailwind.js"></script>
                    <style>
                        @page { size: A4; margin: 20mm; }
                        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: black; background: white; }
                    </style>
                </head>
                <body class="p-8 space-y-8 text-left">
                    <div class="border-b-2 border-black pb-4 text-center">
                        <h1 class="text-xl font-bold uppercase">Form II (Monthly MTP Return Report)</h1>
                        <p class="text-xs font-semibold text-slate-500 uppercase mt-1">Maharashtra State Health Services Division Department</p>
                        <p class="text-xs font-bold text-slate-700 mt-2">
                            Reporting Period: \${new Date(dateFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} 
                            to 
                            \${new Date(dateTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>

                    <div class="grid grid-cols-2 gap-6 text-sm">
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Total Terminations Performed</h3>
                            <p class="text-3xl font-black text-slate-900">\${total}</p>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Method Breakdown</h3>
                            <p class="text-sm font-semibold">Medical (MTP Pill Kit): <strong>\${medical}</strong></p>
                            <p class="text-sm font-semibold mt-1">Surgical (MVA/EVA): <strong>\${surgical}</strong></p>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <h3 class="font-bold text-sm border-b pb-2">1. Gestational Age Distributions</h3>
                        <table class="w-full text-left text-xs border">
                            <thead>
                                <tr class="bg-slate-100 border-b">
                                    <th class="p-2">Gestational Age</th>
                                    <th class="p-2 text-right">No. of Cases</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b"><td class="p-2">&lt; 12 Weeks (First Trimester)</td><td class="p-2 text-right font-bold">\${under12w}</td></tr>
                                <tr class="border-b"><td class="p-2">12 to 20 Weeks</td><td class="p-2 text-right font-bold">\${twelveTo20w}</td></tr>
                                <tr><td class="p-2">20 to 24 Weeks (Extended statutory)</td><td class="p-2 text-right font-bold">\${twentyTo24w}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="space-y-4">
                        <h3 class="font-bold text-sm border-b pb-2">2. Clinical Indications Breakdown</h3>
                        <table class="w-full text-left text-xs border">
                            <thead>
                                <tr class="bg-slate-100 border-b">
                                    <th class="p-2">Indication Category</th>
                                    <th class="p-2 text-right">No. of Cases</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${Object.entries(indications).map(([ind, val]) => \`
                                    <tr class="border-b">
                                        <td class="p-2">\${ind}</td>
                                        <td class="p-2 text-right font-bold">\${val}</td>
                                    </tr>
                                \`).join('')}
                                \${Object.keys(indications).length === 0 ? '<tr><td colspan="2" class="p-4 text-center text-slate-400">No cases recorded.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <div class="space-y-4">
                        <h3 class="font-bold text-sm border-b pb-2">3. Post-Abortion Contraceptive Acceptance</h3>
                        <table class="w-full text-left text-xs border">
                            <thead>
                                <tr class="bg-slate-100 border-b">
                                    <th class="p-2">Contraceptive Accepted</th>
                                    <th class="p-2 text-right">No. of Cases</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${Object.entries(contraceptives).map(([contra, val]) => \`
                                    <tr class="border-b">
                                        <td class="p-2">\${contra}</td>
                                        <td class="p-2 text-right font-bold">\${val}</td>
                                    </tr>
                                \`).join('')}
                                \${Object.keys(contraceptives).length === 0 ? '<tr><td colspan="2" class="p-4 text-center text-slate-400">No cases recorded.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <div class="pt-24 flex justify-between text-xs">
                        <span>Report generated on: \${new Date().toLocaleDateString('en-IN')}</span>
                        <div class="border-t border-black pt-1 w-48 text-center font-bold">Authorized RMP Signature</div>
                    </div>

                    <script>
                        window.onload = () => { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

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
                                {activeTemplate.id === 'mtp_register' ? (
                                    <button
                                        onClick={handlePrintMonthlyReport}
                                        className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-5 py-2.5 rounded-xl text-xs font-black uppercase shadow-md transition-colors flex items-center gap-1.5"
                                    >
                                        🖨️ Print Monthly Report (Form II)
                                    </button>
                                ) : (
                                    <>
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
                                    </>
                                )}
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
                                                    <td key={f} className="p-1 px-3 border-r border-slate-100 last-of-type:border-none">
                                                        {activeTemplate.id === 'mtp_register' ? (
                                                            <span className="text-xs font-bold text-slate-700">{r.data[f] || ''}</span>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={r.data[f] || ''}
                                                                onChange={(e) => handleUpdateRecord(r.id, f, e.target.value)}
                                                                className="w-full min-w-[120px] bg-transparent border-b border-transparent focus:border-indigo-400 group-hover:border-slate-200 outline-none p-1 text-xs font-bold text-slate-700 transition-colors"
                                                                placeholder={`Enter ${f}`}
                                                            />
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="p-2 text-center border-l border-slate-100 flex items-center justify-center gap-2">
                                                    {activeTemplate.id === 'mtp_register' && (
                                                        <button
                                                            onClick={() => {
                                                                setEnvelopeRecord(r);
                                                                setShowEnvelopeModal(true);
                                                            }}
                                                            className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-black text-[9px] uppercase px-2 py-1 rounded-lg transition-colors"
                                                        >
                                                            👁️ Envelope
                                                        </button>
                                                    )}
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

            {/* View MTP Envelope Modal */}
            {showEnvelopeModal && envelopeRecord && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col text-left">
                        <button 
                            onClick={() => {
                                setShowEnvelopeModal(false);
                                setEnvelopeRecord(null);
                            }} 
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 font-black text-2xl"
                        >
                            &times;
                        </button>
                        
                        <div className="border-b pb-4 mb-4">
                            <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">📁 MTP Compliance Envelope Data</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase mt-0.5">Serial Code: {envelopeRecord.data['Serial Number']} · Patient Name: {envelopeRecord.data['Name']}</p>
                        </div>

                        {/* Navigation tabs */}
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit mb-4 shrink-0">
                            <button onClick={() => setEnvelopeTab('doc-form-c')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${envelopeTab === 'doc-form-c' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Form C (Consent)</button>
                            <button onClick={() => setEnvelopeTab('doc-form-i')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${envelopeTab === 'doc-form-i' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Form I (Opinion)</button>
                            <button onClick={() => setEnvelopeTab('doc-consent')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${envelopeTab === 'doc-consent' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Procedural Consent</button>
                        </div>

                        {/* Content display */}
                        <div className="flex-grow overflow-y-auto p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-xs leading-relaxed font-sans mb-4">
                            {envelopeTab === 'doc-form-c' && (() => {
                                const textValue = envelopeRecord.data['Form C Text'] || `I, ${envelopeRecord.data['Name']}, daughter/wife of ${envelopeRecord.data['Relation (W/D of)']}, aged ${envelopeRecord.data['Age']} years, residing at ${envelopeRecord.data['Address']}, hereby give my consent for the medical termination of my pregnancy under the Medical Termination of Pregnancy Act, 1971.\n\nMethod of Termination: ${envelopeRecord.data['Method']}`;
                                const templatesList = (clinicalTemplates || []).filter(t => t.category === 'mtp_form_c');
                                return (
                                    <div>
                                        <h4 className="text-center font-bold uppercase underline mb-4 text-sm">Form C (Consent Form)</h4>
                                        <div className="flex justify-between items-center bg-slate-100 p-2 rounded-xl mb-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase">Interactive Editor</span>
                                            <div className="flex items-center gap-2">
                                                {templatesList.length > 0 && (
                                                    <select 
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleUpdateMtpText('Form C Text', e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold text-slate-700 outline-none"
                                                    >
                                                        <option value="">-- Load Template --</option>
                                                        {templatesList.map(t => <option key={t.id} value={t.content}>{t.title}</option>)}
                                                    </select>
                                                )}
                                                <button 
                                                    onClick={() => handleSaveTemplate('mtp_form_c', textValue)} 
                                                    className="bg-white hover:bg-slate-200 border border-slate-200 text-[9px] font-black uppercase px-2 py-1 rounded shadow-sm"
                                                >
                                                    💾 Save as Template
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={textValue}
                                            onChange={(e) => handleUpdateMtpText('Form C Text', e.target.value)}
                                            className="w-full h-36 bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:outline-none focus:border-amber-500 mb-4"
                                        />
                                        <div className="mt-8 flex justify-between">
                                            <span>Date: {envelopeRecord.data['Admission Date']}</span>
                                            <div className="border-t border-slate-300 pt-1 w-48 text-center font-bold">Signature / Thumb Impression</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {envelopeTab === 'doc-form-i' && (() => {
                                const textValue = envelopeRecord.data['Form I Text'] || `We/I, Registered Medical Practitioner(s), state that the termination of pregnancy for Patient Serial Number ${envelopeRecord.data['Serial Number']} is necessitated under Section 3(2)(b)(i) of the Act as the continuation of the pregnancy would involve a risk to the physical or mental health of the pregnant woman.\n\nReason for MTP: ${envelopeRecord.data['Indication']}`;
                                const templatesList = (clinicalTemplates || []).filter(t => t.category === 'mtp_form_i');
                                return (
                                    <div>
                                        <h4 className="text-center font-bold uppercase underline mb-2 text-sm">Form I (RMP Opinion Form)</h4>
                                        <div className="text-right font-bold text-slate-500 mb-4">Serial Number: {envelopeRecord.data['Serial Number']}</div>
                                        <div className="flex justify-between items-center bg-slate-100 p-2 rounded-xl mb-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase">Interactive Editor</span>
                                            <div className="flex items-center gap-2">
                                                {templatesList.length > 0 && (
                                                    <select 
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleUpdateMtpText('Form I Text', e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold text-slate-700 outline-none"
                                                    >
                                                        <option value="">-- Load Template --</option>
                                                        {templatesList.map(t => <option key={t.id} value={t.content}>{t.title}</option>)}
                                                    </select>
                                                )}
                                                <button 
                                                    onClick={() => handleSaveTemplate('mtp_form_i', textValue)} 
                                                    className="bg-white hover:bg-slate-200 border border-slate-200 text-[9px] font-black uppercase px-2 py-1 rounded shadow-sm"
                                                >
                                                    💾 Save as Template
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={textValue}
                                            onChange={(e) => handleUpdateMtpText('Form I Text', e.target.value)}
                                            className="w-full h-36 bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:outline-none focus:border-amber-500 mb-4"
                                        />
                                        <div className="mt-8 flex justify-between">
                                            <div>
                                                <p>1. {envelopeRecord.data['RMP Name']}</p>
                                                <div className="border-t border-slate-300 pt-1 w-48 text-center mt-8 font-bold">Signature of RMP</div>
                                            </div>
                                            {envelopeRecord.data['Remarks']?.includes('2nd RMP') ? (
                                                <div>
                                                    <p>2. {envelopeRecord.data['Remarks'].split('2nd RMP: ')[1]?.split(' (')[0] || 'Second RMP'}</p>
                                                    <div className="border-t border-slate-300 pt-1 w-48 text-center mt-8 font-bold">Signature of RMP</div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })()}

                            {envelopeTab === 'doc-consent' && (() => {
                                const textValue = envelopeRecord.data['MTP Consent Text'] || `I, ${envelopeRecord.data['Name']}, authorize ${envelopeRecord.data['RMP Name']} to perform the MTP procedure. I have been informed of the clinical risks, potential complications, and alternative treatments. I agree to accept post-abortion contraceptive advice and have accepted ${envelopeRecord.data['Contraceptive']}.`;
                                const templatesList = (clinicalTemplates || []).filter(t => t.category === 'mtp_consent');
                                return (
                                    <div>
                                        <h4 className="text-center font-bold uppercase underline mb-4 text-sm">MTP Informed Consent Form</h4>
                                        <div className="flex justify-between items-center bg-slate-100 p-2 rounded-xl mb-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase">Interactive Editor</span>
                                            <div className="flex items-center gap-2">
                                                {templatesList.length > 0 && (
                                                    <select 
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleUpdateMtpText('MTP Consent Text', e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold text-slate-700 outline-none"
                                                    >
                                                        <option value="">-- Load Template --</option>
                                                        {templatesList.map(t => <option key={t.id} value={t.content}>{t.title}</option>)}
                                                    </select>
                                                )}
                                                <button 
                                                    onClick={() => handleSaveTemplate('mtp_consent', textValue)} 
                                                    className="bg-white hover:bg-slate-200 border border-slate-200 text-[9px] font-black uppercase px-2 py-1 rounded shadow-sm"
                                                >
                                                    💾 Save as Template
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={textValue}
                                            onChange={(e) => handleUpdateMtpText('MTP Consent Text', e.target.value)}
                                            className="w-full h-36 bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:outline-none focus:border-amber-500 mb-4"
                                        />
                                        <div className="mt-8 flex justify-between">
                                            <span>Date: {envelopeRecord.data['Admission Date']}</span>
                                            <div className="border-t border-slate-300 pt-1 w-48 text-center font-bold">Signature / Thumb Impression</div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Audit Trail remarks */}
                        {envelopeRecord.data['Remarks'] && (
                            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10px] text-amber-800 font-bold uppercase">
                                📜 Audit Remarks Trail: {envelopeRecord.data['Remarks']}
                            </div>
                        )}

                        {/* Footer buttons */}
                        <div className="border-t pt-4 flex justify-between items-center shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Envelope Data Verified Offline</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handlePrintMtpForms(envelopeRecord)} 
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-xl flex items-center gap-1 shadow-sm"
                                >
                                    🖨️ Print Form Set
                                </button>
                                <button 
                                    onClick={() => setShowReprintModal(true)} 
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl flex items-center gap-1 shadow-sm"
                                >
                                    🔄 Authenticated Reprint
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reprint Validation Modal */}
            {showReprintModal && envelopeRecord && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white border p-6 rounded-3xl max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl">
                        <div className="text-center">
                            <span className="text-3xl">🔐</span>
                            <h3 className="text-slate-800 font-black text-lg uppercase tracking-wide mt-2">PIN Verification Required</h3>
                            <p className="text-xs text-slate-400 mt-1">Reprinting MTP documents requires RMP credentials.</p>
                        </div>
                        
                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-1">Enter Doctor's PIN</label>
                            <input 
                                type="password" 
                                maxLength={4} 
                                placeholder="••••" 
                                value={reprintPin}
                                onChange={(e) => setReprintPin(e.target.value)}
                                className="w-full text-center p-3 bg-slate-50 text-slate-900 rounded-xl text-lg font-mono border border-slate-200 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-1">Reason for Reprinting</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Original envelope misplaced" 
                                value={reprintReason}
                                onChange={(e) => setReprintReason(e.target.value)}
                                className="w-full p-3 bg-slate-50 text-slate-900 rounded-xl text-xs border border-slate-200 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button 
                                onClick={() => {
                                    setShowReprintModal(false);
                                    setReprintPin('');
                                    setReprintReason('');
                                }} 
                                className="flex-grow py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmReprint} 
                                className="flex-grow py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase text-[10px] tracking-wider rounded-xl transition-colors"
                            >
                                Verify & Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsTab;
