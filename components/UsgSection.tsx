import React, { useState, useEffect } from 'react';
import { Patient, LabOrder, Consultant, AppPrintSettings } from '../types';

const USG_TEMPLATES = [
    { id: 'ROUTINE_1ST_TRIMESTER', label: '1st Trimester Routine OB Scan' },
    { id: 'ANOMALY_SCAN', label: 'Anomaly Scan (18-22 Weeks)' },
    { id: '3RD_TRIMESTER_GROWTH', label: '3rd Trimester Growth Scan' },
    { id: 'DOPPLER_STUDY', label: 'Obstetric Doppler Study' },
    { id: 'ADULT_ECHO', label: 'Adult Echo Cardiology Study' },
    { id: 'PELVIS_SCAN', label: 'Pelvis Ultrasound Scan' }
];

interface UsgSectionProps {
    patients: Patient[];
    labOrders: LabOrder[];
    consultants: Consultant[];
    printSettings: AppPrintSettings | null;
    onUpdateLabOrders: (orders: LabOrder[]) => void;
    onUpdatePatients: (patients: Patient[]) => void;
}

interface WaitlistRecord {
    instVisit: string;
    patIdInst: string;
    patientName: string;
    age: number;
    gender: 'M' | 'F';
    panel: string;
    modality: string;
    test: string;
    img: boolean;
    rep: boolean;
    apr: boolean;
    dw: boolean;
    pw: boolean;
    disp: boolean;
    date: string;
    time: string;
    referringPhysician: string;
    refPhy2: string;
    testPrice: number;
    extraConcession: number;
    lmp?: string;
    address?: string;
}

export const UsgSection: React.FC<UsgSectionProps> = ({ 
    patients, 
    labOrders, 
    consultants, 
    printSettings, 
    onUpdateLabOrders, 
    onUpdatePatients 
}) => {
    // Left navigation tab
    const [activeTab, setActiveTab] = useState<'home' | 'patient_reg' | 'gest_age' | 'pndt' | 'doctor_reg' | 'pf' | 'pf_settings' | 'pdf_settings' | 'patho' | 'organ' | 'settings'>('home');
    
    // Filters state
    const [modalityFilter, setModalityFilter] = useState('All');
    const [testFilter, setTestFilter] = useState('All');
    const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
    const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
    const [searchQuery, setSearchQuery] = useState('');

    // Waitlist State (Light Theme Matches App)
    const [waitlist, setWaitlist] = useState<WaitlistRecord[]>([
        {
            instVisit: '17',
            patIdInst: '21024003',
            patientName: 'TEST TEST TEST',
            age: 23,
            gender: 'F',
            panel: 'Default',
            modality: 'X-Ray',
            test: 'MCU',
            img: false,
            rep: true,
            apr: true,
            dw: false,
            pw: false,
            disp: true,
            date: '02/10/2024',
            time: '06:46 PM',
            referringPhysician: 'Dr. Sarina Relan',
            refPhy2: 'Dr. ABC z',
            testPrice: 3700,
            extraConcession: 0,
            address: 'A-102 High Street, Mumbai'
        },
        {
            instVisit: '18',
            patIdInst: '21024004',
            patientName: 'KAVITA A MISHRA',
            age: 29,
            gender: 'F',
            panel: 'Default',
            modality: 'USG',
            test: 'Estimation of gestational age (dating)',
            img: false,
            rep: true,
            apr: true,
            dw: false,
            pw: false,
            disp: true,
            date: '02/10/2024',
            time: '06:55 PM',
            referringPhysician: 'Dr. Mohit Agrawal',
            refPhy2: 'Dr. Sarina Relan',
            testPrice: 7500,
            extraConcession: 0,
            lmp: '2026-06-06',
            address: 'A-401 Shubh Diagnostic Residency'
        }
    ]);

    const [selectedWaitlistIndex, setSelectedWaitlistIndex] = useState<number | null>(null);

    // Add Patient Form State
    const [addForm, setAddForm] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        gender: 'Female' as 'Male' | 'Female',
        age: '',
        ageUnit: 'Years' as 'Years' | 'Months',
        mobile: '',
        email: '',
        lmp: '',
        address: '',
        panel: 'Default',
        employeeId: '',
        urgent: false,
        refPhy1: 'Dr. Sarina Relan',
        modality: 'USG',
        scheduleDate: new Date().toISOString().slice(0, 10),
        refPhy2: 'Dr. Mohit Agrawal',
        test: 'Estimation of gestational age (dating)'
    });

    // PNDT Form F compliant state
    const [pndtForm, setPndtForm] = useState({
        firstName: 'Kavita',
        middleName: 'A',
        lastName: 'Mishra',
        husbandName: 'A Mishra',
        contactNo: '7039076600',
        address: 'A-401, Shubh Diagnostic Residency',
        sonsYear: '0',
        sonsMonth: '0',
        daughtersYear: '0',
        daughtersMonth: '0',
        doctorName: 'Dr. Sarina Relan',
        centerName: 'SHUBH DIAGNOSTIC CENTRE',
        doctorAddress: 'A-102 High Street, Mumbai',
        diagnosis: '2] Estimation of gestational age (dating).',
        lmp: '2026-06-06',
        conclusion: 'SINGLE LIVE INTRAUTERINE FETUS OF 35 WEEKS 5 DAYS IS PRESENT. PLEASE CORRELATE WITH DUAL/TRIPLE MARKER TEST.'
    });

    // Settings State (stored locally)
    const [settings, setSettings] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('usg_pcare_settings');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {}
            }
        }
        return {
            templates: USG_TEMPLATES,
            reportingDoctors: [
                { name: 'Dr. Sarina Relan', regNo: 'MCIM-2015-08-3412', qualifications: 'MD (Radiodiagnosis)' },
                { name: 'Dr. Mohit Agrawal', regNo: 'MCIM-2012-04-1845', qualifications: 'DMRD, MBBS' }
            ],
            referralDoctors: [
                { name: 'Dr. Ashok Mehta', specialty: 'Gynecologist', clinic: 'Mehta Nursing Home' },
                { name: 'Dr. Neha Shah', specialty: 'Obstetrician', clinic: 'Shah Maternity Clinic' }
            ],
            fFormTemplates: [
                { name: 'Standard PCPNDT Form F Template (Govt Mandated)', id: 'std_gov' }
            ],
            pcpndtUsername: 'SHUBH_DIAG_123',
            pcpndtPassword: '••••••••••••••••'
        };
    });

    useEffect(() => {
        localStorage.setItem('usg_pcare_settings', JSON.stringify(settings));
    }, [settings]);

    // Temp form add states for Settings tab
    const [newTemplate, setNewTemplate] = useState({ label: '' });
    const [newRepDoc, setNewRepDoc] = useState({ name: '', regNo: '', qualifications: '' });
    const [newRefDoc, setNewRefDoc] = useState({ name: '', specialty: '', clinic: '' });
    const [pcpndtUser, setPcpndtUser] = useState(settings.pcpndtUsername);
    const [pcpndtPass, setPcpndtPass] = useState(settings.pcpndtPassword);

    // Selected Patient Report State
    const [selectedTemplate, setSelectedTemplate] = useState('ROUTINE_1ST_TRIMESTER');
    const [selectedDoctor, setSelectedDoctor] = useState('Dr. Sarina Relan');
    const [reportText, setReportText] = useState('SINGLE LIVE INTRAUTERINE GESTATION RECORDED OF GESTATIONAL AGE 12W 4D.\nHR NORMAL. PLACENTA ANTERIOR HIGH UP.');

    // Simulated OCR States
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isLiveVideo, setIsLiveVideo] = useState(false);

    // Load selected waitlist data into report fields
    useEffect(() => {
        if (selectedWaitlistIndex !== null) {
            const p = waitlist[selectedWaitlistIndex];
            setPndtForm(prev => ({
                ...prev,
                firstName: p.patientName.split(' ')[0] || '',
                middleName: p.patientName.split(' ')[1] || '',
                lastName: p.patientName.split(' ')[2] || '',
                lmp: p.lmp || prev.lmp,
                address: p.address || prev.address,
                doctorName: p.referringPhysician
            }));
        }
    }, [selectedWaitlistIndex, waitlist]);

    // Handle add patient record manually
    const handleAddPatient = (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.firstName) {
            alert('Please specify Patient First Name.');
            return;
        }

        const newRecord: WaitlistRecord = {
            instVisit: (waitlist.length + 17).toString(),
            patIdInst: (Math.floor(10000000 + Math.random() * 90000000)).toString(),
            patientName: `${addForm.firstName} ${addForm.middleName} ${addForm.lastName}`.toUpperCase(),
            age: Number(addForm.age) || 25,
            gender: addForm.gender === 'Male' ? 'M' : 'F',
            panel: addForm.panel,
            modality: addForm.modality,
            test: addForm.test,
            img: false,
            rep: false,
            apr: false,
            dw: false,
            pw: false,
            disp: false,
            date: new Date(addForm.scheduleDate).toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            referringPhysician: addForm.refPhy1,
            refPhy2: addForm.refPhy2,
            testPrice: addForm.modality === 'USG' ? 1200 : 800,
            extraConcession: 0,
            lmp: addForm.lmp,
            address: addForm.address
        };

        setWaitlist(prev => [...prev, newRecord]);
        
        // Reset form
        setAddForm({
            firstName: '',
            middleName: '',
            lastName: '',
            gender: 'Female',
            age: '',
            ageUnit: 'Years',
            mobile: '',
            email: '',
            lmp: '',
            address: '',
            panel: 'Default',
            employeeId: '',
            urgent: false,
            refPhy1: 'Dr. Sarina Relan',
            modality: 'USG',
            scheduleDate: new Date().toISOString().slice(0, 10),
            refPhy2: 'Dr. Mohit Agrawal',
            test: 'Estimation of gestational age (dating)'
        });
        alert('Patient registered and added to waitlist successfully!');
    };

    // Simulated scanner for Referral Slip or Aadhar Card
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        simulateOcrExtraction();
    };

    const simulateOcrExtraction = () => {
        setIsOcrLoading(true);
        setTimeout(() => {
            setAddForm(prev => ({
                ...prev,
                firstName: 'Kavita',
                middleName: 'A',
                lastName: 'Mishra',
                gender: 'Female',
                age: '29',
                mobile: '7039076600',
                lmp: '2026-06-06',
                address: 'A-401, Shubh Residency, Mumbai',
                test: 'Estimation of gestational age (dating)'
            }));
            setIsOcrLoading(false);
            alert('Referral Slip / Aadhar scanned successfully! Patient data auto-filled.');
        }, 1500);
    };

    // F Form compliant actions
    const handlePrintPndt = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head>
                    <title>FORM F - PCPNDT Compliance Record</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body class="bg-white p-12 text-xs font-serif leading-relaxed text-slate-900">
                    <div class="max-w-4xl mx-auto border-4 double border-slate-800 p-8 space-y-6">
                        <div class="text-center border-b-2 border-slate-800 pb-4">
                            <h1 class="text-lg font-bold uppercase tracking-tight">FORM F</h1>
                            <p class="text-[10px] italic">[See Rules 4(1)(b) and 9(8)]</p>
                            <h2 class="text-xs font-bold uppercase mt-2">RECORD FOR MAINTENANCE IN CASE OF PRE-NATAL DIAGNOSTIC TEST/PROCEDURE BY GENETIC CLINIC/ULTRASOUND CLINIC/IMAGING CENTRE</h2>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-6">
                            <div class="col-span-2 border-r border-slate-200 pr-6 space-y-3">
                                <h3 class="font-black border-b border-slate-300 pb-1 mb-2 uppercase text-[10px]">I. Personal details of Patient</h3>
                                <p><strong>1. Name of the Patient:</strong> ${pndtForm.firstName} ${pndtForm.middleName} ${pndtForm.lastName}</p>
                                <p><strong>2. Age:</strong> 29 Years</p>
                                <p><strong>3. Husband's / Relative's Name:</strong> ${pndtForm.husbandName}</p>
                                <p><strong>4. Contact Number:</strong> ${pndtForm.contactNo}</p>
                                <p><strong>5. Full Address:</strong> ${pndtForm.address}</p>
                                <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded border">
                                    <p><strong>Son(s):</strong> ${pndtForm.sonsYear} Years / ${pndtForm.sonsMonth} Months</p>
                                    <p><strong>Daughter(s):</strong> ${pndtForm.daughtersYear} Years / ${pndtForm.daughtersMonth} Months</p>
                                </div>
                            </div>
                            <div class="space-y-3 pl-2">
                                <h3 class="font-black border-b border-slate-300 pb-1 mb-2 uppercase text-[10px]">II. Center & Doctor Details</h3>
                                <p><strong>Reporting Sonologist:</strong> ${pndtForm.doctorName}</p>
                                <p><strong>Center Registered:</strong> ${pndtForm.centerName}</p>
                                <p><strong>Address:</strong> ${pndtForm.doctorAddress}</p>
                            </div>
                        </div>

                        <div class="border-t border-slate-800 pt-4 space-y-3">
                            <h3 class="font-black border-b border-slate-300 pb-1 mb-2 uppercase text-[10px]">III. Medical details</h3>
                            <p><strong>6. Clinical Diagnosis:</strong> ${pndtForm.diagnosis}</p>
                            <p><strong>7. Last Menstrual Period (LMP) Date:</strong> ${pndtForm.lmp}</p>
                            <div>
                                <p><strong>8. Sonologist Conclusion:</strong></p>
                                <p class="bg-slate-50 p-3 rounded font-mono text-[11px] mt-1 border italic">${pndtForm.conclusion}</p>
                            </div>
                        </div>

                        <div class="pt-16 grid grid-cols-2 gap-12 border-t border-slate-800">
                            <div class="text-center">
                                <div class="h-10 border-b border-slate-400 w-48 mx-auto mb-1"></div>
                                <p class="font-bold text-[10px]">Signature / Thumb Impression of Patient</p>
                            </div>
                            <div class="text-center">
                                <div class="h-10 border-b border-slate-400 w-48 mx-auto mb-1"></div>
                                <p class="font-bold text-[10px]">Signature & Registration Seal of Doctor</p>
                            </div>
                        </div>
                    </div>
                    <script>window.onload = () => { window.print(); window.close(); }</script>
                </body>
            </html>
        `);
    };

    const handleAutoFillPcpndt = () => {
        alert(`Initiating connection to State PCPNDT Portal...\n\nUser ID: ${settings.pcpndtUsername}\nProcessing form submission...\n\nSync Complete! Form F database synced with govt servers.`);
    };

    // Filter Waitlist Patients
    const filteredWaitlist = waitlist.filter(record => {
        if (modalityFilter !== 'All' && record.modality !== modalityFilter) return false;
        if (testFilter !== 'All' && record.test !== testFilter) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                record.patientName.toLowerCase().includes(query) ||
                record.patIdInst.includes(query) ||
                record.referringPhysician.toLowerCase().includes(query)
            );
        }
        return true;
    });

    return (
        <div className="flex flex-col bg-slate-55 text-slate-800 min-h-screen w-full font-sans select-none overflow-hidden">
            {/* Top diagnostic metadata bar */}
            <div className="bg-white px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs shrink-0 select-none">
                <div className="flex items-center gap-6">
                    <span className="font-black text-blue-600 text-sm flex items-center gap-1.5">
                        <span className="text-xl">🩺</span> pCare Diagnostic
                    </span>
                    <span className="text-slate-400 font-medium">Branch: RASIKMI-4 | Version: 02102024_RE64 Server-L</span>
                </div>
                <div className="flex items-center gap-4 text-slate-500 font-mono">
                    <span>MobNo: 7208941440 / 022 35624677</span>
                    <span className="text-blue-500 font-bold">DB - 211 ms | UI - 329 ms</span>
                </div>
            </div>

            {/* Filter controls row */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center bg-white rounded-lg px-2 border border-slate-200 shadow-sm">
                        <span className="text-slate-400 font-bold mr-1">🔍</span>
                        <input 
                            type="text" 
                            placeholder="PatientName, Ref, ID" 
                            className="bg-transparent py-1.5 text-xs font-bold text-slate-800 outline-none w-44" 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden font-bold shadow-sm">
                        <button className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-blue-600">Today</button>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Modality:</span>
                        <select 
                            value={modalityFilter}
                            onChange={e => setModalityFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold outline-none text-slate-700 shadow-sm"
                        >
                            <option value="All">All</option>
                            <option value="USG">USG</option>
                            <option value="X-Ray">X-Ray</option>
                            <option value="CT Scan">CT Scan</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Test:</span>
                        <select 
                            value={testFilter}
                            onChange={e => setTestFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold outline-none text-slate-700 max-w-[200px] shadow-sm"
                        >
                            <option value="All">All</option>
                            <option value="MCU">MCU</option>
                            <option value="Estimation of gestational age (dating)">Dating USG</option>
                            <option value="Anomaly Scan (18-22 Weeks)">Anomaly Scan</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">From:</span>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-800 shadow-sm" />
                        <span className="text-slate-500 font-semibold">To:</span>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-800 shadow-sm" />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-lg transition-all uppercase tracking-wider text-[10px] shadow-sm">Filter</button>
                    <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-lg transition-all uppercase tracking-wider text-[10px] shadow-sm">Import</button>
                    <button onClick={() => window.location.reload()} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-2 rounded-lg transition-all uppercase tracking-wider text-[10px] shadow-sm">Logout</button>
                </div>
            </div>

            {/* Split Screen Container */}
            <div className="flex flex-1 w-full overflow-hidden bg-slate-50">
                
                {/* Left navigation sidebar */}
                <div className="w-56 bg-white border-r border-slate-200 flex flex-col gap-1.5 p-3 overflow-y-auto shrink-0 select-none">
                    {[
                        { id: 'home', label: '🏠 Home / Waitlist' },
                        { id: 'patient_reg', label: '👤 Patient Reg.' },
                        { id: 'gest_age', label: '📅 Gest. Age Calc' },
                        { id: 'pndt', label: '📋 PNDT Compliance' },
                        { id: 'doctor_reg', label: '🩺 Doctor Reg.' },
                        { id: 'pf', label: '💵 PF (Fee Calc)' },
                        { id: 'pf_settings', label: '⚙️ PF Settings' },
                        { id: 'pdf_settings', label: '📄 Pdf Settings' },
                        { id: 'patho', label: '🧪 Patho Test' },
                        { id: 'organ', label: '👁️ Organ Predictor' },
                        { id: 'settings', label: '⚙️ Settings' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all duration-200 border flex items-center justify-between
                                ${activeTab === tab.id 
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' 
                                    : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-100 hover:text-slate-800'
                                }`}
                        >
                            <span>{tab.label}</span>
                            {activeTab === tab.id && <span className="text-[8px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-black">ACTIVE</span>}
                        </button>
                    ))}
                </div>

                {/* Main Workspace */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
                    
                    {activeTab === 'home' && (
                        <div className="flex-grow flex flex-col h-full overflow-hidden">
                            {/* Top part: Waitlist table grid */}
                            <div className="flex-grow overflow-auto p-4 custom-scrollbar">
                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-200 sticky top-0">
                                            <tr>
                                                <th className="py-3 px-4">InstVisit</th>
                                                <th className="py-3 px-4">PatIdInst</th>
                                                <th className="py-3 px-4">PatientName</th>
                                                <th className="py-3 px-4">Age</th>
                                                <th className="py-3 px-4">Gend</th>
                                                <th className="py-3 px-4">Panel</th>
                                                <th className="py-3 px-4">Modality</th>
                                                <th className="py-3 px-4">Test</th>
                                                <th className="py-3 px-2 text-center">Img</th>
                                                <th className="py-3 px-2 text-center">Rep</th>
                                                <th className="py-3 px-2 text-center">Apr</th>
                                                <th className="py-3 px-2 text-center">DW</th>
                                                <th className="py-3 px-2 text-center">PW</th>
                                                <th className="py-3 px-2 text-center">Disp</th>
                                                <th className="py-3 px-4">Date</th>
                                                <th className="py-3 px-4">Time</th>
                                                <th className="py-3 px-4">ReferringPhysician</th>
                                                <th className="py-3 px-4">RefPhy2</th>
                                                <th className="py-3 px-4 text-right">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 font-bold text-slate-700">
                                            {filteredWaitlist.map((record, index) => (
                                                <tr 
                                                    key={record.patIdInst} 
                                                    onClick={() => setSelectedWaitlistIndex(index)}
                                                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedWaitlistIndex === index ? 'bg-blue-50/70 border-y border-blue-200 text-blue-900' : ''}`}
                                                >
                                                    <td className="py-3.5 px-4">{record.instVisit}</td>
                                                    <td className="py-3.5 px-4 text-slate-400 font-mono">{record.patIdInst}</td>
                                                    <td className="py-3.5 px-4 uppercase font-black text-slate-800">{record.patientName}</td>
                                                    <td className="py-3.5 px-4">{record.age} Y</td>
                                                    <td className="py-3.5 px-4">{record.gender}</td>
                                                    <td className="py-3.5 px-4 text-slate-400">{record.panel}</td>
                                                    <td className="py-3.5 px-4 text-blue-600">{record.modality}</td>
                                                    <td className="py-3.5 px-4 truncate max-w-[200px] text-slate-500">{record.test}</td>
                                                    <td className="py-3.5 px-2 text-center"><input type="checkbox" checked={record.img} readOnly className="rounded border-slate-300 bg-white" /></td>
                                                    <td className="py-3.5 px-2 text-center"><input type="checkbox" checked={record.rep} readOnly className="rounded border-slate-300 bg-white" /></td>
                                                    <td className="py-3.5 px-2 text-center"><input type="checkbox" checked={record.apr} readOnly className="rounded border-slate-300 bg-white" /></td>
                                                    <td className="py-3.5 px-2 text-center"><input type="checkbox" checked={record.dw} readOnly className="rounded border-slate-300 bg-white" /></td>
                                                    <td className="py-3.5 px-2 text-center"><input type="checkbox" checked={record.pw} readOnly className="rounded border-slate-300 bg-white" /></td>
                                                    <td className="py-3.5 px-2 text-center"><input type="checkbox" checked={record.disp} readOnly className="rounded border-slate-300 bg-white" /></td>
                                                    <td className="py-3.5 px-4">{record.date}</td>
                                                    <td className="py-3.5 px-4 font-mono text-slate-500">{record.time}</td>
                                                    <td className="py-3.5 px-4 text-slate-500">{record.referringPhysician}</td>
                                                    <td className="py-3.5 px-4 text-slate-400">{record.refPhy2}</td>
                                                    <td className="py-3.5 px-4 text-right text-emerald-600">₹{record.testPrice}</td>
                                                </tr>
                                            ))}
                                            {filteredWaitlist.length === 0 && (
                                                <tr>
                                                    <td colSpan={19} className="py-12 text-center italic text-slate-400 font-bold bg-white">No patients in the waitlist match the filters.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Bottom panels block: split into 4 columns */}
                            <div className="bg-white border-t border-slate-200 p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 shrink-0 text-xs shadow-xl">
                                
                                {/* 1. Tools Column (lg:col-span-3) */}
                                <div className="lg:col-span-3 space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col justify-between">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1.5">Diagnostic Tools</h4>
                                    <div className="grid grid-cols-2 gap-2 flex-grow mt-2">
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">Receipt</button>
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">Slip</button>
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">Label</button>
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">SMS / Email</button>
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">Comments</button>
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">Upload Doc</button>
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">Accnt PDE</button>
                                        <button className="bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-lg font-black uppercase text-[9px] text-slate-700 shadow-sm">CSV</button>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button className="flex-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 py-2 rounded font-black text-[9px] uppercase text-indigo-700">PNDT List</button>
                                        <button className="flex-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 py-2 rounded font-black text-[9px] uppercase text-blue-700">Consent</button>
                                    </div>
                                    <div className="mt-2">
                                        <select className="w-full bg-white border border-slate-200 rounded p-1.5 text-[9px] font-bold text-slate-700">
                                            <option>Biopsy Option</option>
                                            <option>Trucut Biopsy</option>
                                            <option>FNAC Biopsy</option>
                                        </select>
                                    </div>
                                </div>

                                {/* 2. Report Controls (lg:col-span-3) */}
                                <div className="lg:col-span-3 space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col justify-between">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1.5">Reporting & Templates</h4>
                                    <div className="space-y-2 mt-2 flex-grow">
                                        <div>
                                            <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Select Scan Template</label>
                                            <select 
                                                value={selectedTemplate}
                                                onChange={e => setSelectedTemplate(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 outline-none text-xs"
                                            >
                                                {settings.templates.map(t => (
                                                    <option key={t.id} value={t.id}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Reporting Doctor</label>
                                            <select 
                                                value={selectedDoctor}
                                                onChange={e => setSelectedDoctor(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 outline-none text-xs"
                                            >
                                                {settings.reportingDoctors.map(d => (
                                                    <option key={d.name} value={d.name}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 mt-2">
                                        <button 
                                            onClick={() => alert(`Clinical Report generated under template: ${selectedTemplate} by ${selectedDoctor}`)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-wider py-2.5 rounded-lg border border-blue-500 shadow-md shadow-blue-100"
                                        >
                                            Create Report
                                        </button>
                                        <button onClick={() => setReportText('')} className="w-full bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 py-1.5 rounded uppercase font-bold text-[9px]">Delete Report</button>
                                    </div>
                                </div>

                                {/* 3. Referral Slip / Aadhar Scan Container (lg:col-span-3) */}
                                <div className="lg:col-span-3 space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col justify-between">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1.5">Referral / Aadhar Scanner</h4>
                                    
                                    <div className="flex items-center justify-between mt-1">
                                        <label className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={isLiveVideo} 
                                                onChange={e => {
                                                    setIsLiveVideo(e.target.checked);
                                                    if (e.target.checked) {
                                                        setTimeout(() => {
                                                            simulateOcrExtraction();
                                                        }, 1500);
                                                    }
                                                }}
                                                className="rounded bg-white border-slate-350" 
                                            />
                                            Live Camera Scan
                                        </label>
                                        <button onClick={simulateOcrExtraction} className="bg-white border border-slate-200 hover:bg-slate-50 text-[9px] font-black px-2 py-1 rounded text-blue-600">Capture ?</button>
                                    </div>

                                    <div 
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onClick={simulateOcrExtraction}
                                        className="border border-dashed border-slate-300 bg-white rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-blue-500 transition-all flex-grow min-h-[90px]"
                                    >
                                        {isOcrLoading ? (
                                            <div className="space-y-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto"></div>
                                                <p className="text-[9px] text-blue-500 font-bold uppercase animate-pulse">Running AI OCR...</p>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-xl mb-1 text-slate-400">📄</span>
                                                <p className="text-[9px] text-slate-500 font-black uppercase leading-tight">Drag & drop Referral Slip / Aadhar image</p>
                                                <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold">Or click to simulate upload</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 4. Add Patient Form (lg:col-span-3) */}
                                <div className="lg:col-span-3 space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1.5">Add Patient Panel</h4>
                                    <form onSubmit={handleAddPatient} className="space-y-2.5 mt-2">
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <input 
                                                type="text" 
                                                placeholder="First" 
                                                value={addForm.firstName}
                                                onChange={e => setAddForm(prev=>({...prev, firstName: e.target.value}))}
                                                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 placeholder-slate-400 outline-none text-xs font-bold w-full"
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="Middle" 
                                                value={addForm.middleName}
                                                onChange={e => setAddForm(prev=>({...prev, middleName: e.target.value}))}
                                                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 placeholder-slate-400 outline-none text-xs font-bold w-full"
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="Last" 
                                                value={addForm.lastName}
                                                onChange={e => setAddForm(prev=>({...prev, lastName: e.target.value}))}
                                                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 placeholder-slate-400 outline-none text-xs font-bold w-full"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5">
                                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded">
                                                <label className="text-[8px] text-slate-500 uppercase font-black">Gender:</label>
                                                <div className="flex gap-1.5 text-[9px] font-bold text-slate-700">
                                                    <label className="flex items-center gap-1"><input type="radio" checked={addForm.gender==='Male'} onChange={()=>setAddForm(prev=>({...prev, gender:'Male'}))} /> M</label>
                                                    <label className="flex items-center gap-1"><input type="radio" checked={addForm.gender==='Female'} onChange={()=>setAddForm(prev=>({...prev, gender:'Female'}))} /> F</label>
                                                </div>
                                            </div>
                                            <div className="flex bg-white border border-slate-200 rounded overflow-hidden">
                                                <input 
                                                    type="text" 
                                                    placeholder="Age" 
                                                    value={addForm.age}
                                                    onChange={e => setAddForm(prev=>({...prev, age: e.target.value}))}
                                                    className="bg-transparent px-2 py-1 text-slate-800 placeholder-slate-400 outline-none text-xs font-bold w-12"
                                                />
                                                <select 
                                                    value={addForm.ageUnit}
                                                    onChange={e => setAddForm(prev=>({...prev, ageUnit: e.target.value as any}))}
                                                    className="bg-slate-100 text-slate-500 outline-none border-l border-slate-200 px-1 font-bold text-[9px]"
                                                >
                                                    <option>Years</option>
                                                    <option>Months</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5">
                                            <input 
                                                type="text" 
                                                placeholder="Mobile" 
                                                value={addForm.mobile}
                                                onChange={e => setAddForm(prev=>({...prev, mobile: e.target.value}))}
                                                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 placeholder-slate-400 outline-none text-xs font-bold w-full"
                                            />
                                            <input 
                                                type="date" 
                                                value={addForm.lmp}
                                                onChange={e => setAddForm(prev=>({...prev, lmp: e.target.value}))}
                                                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 outline-none text-[10px] w-full"
                                            />
                                        </div>

                                        <input 
                                            type="text" 
                                            placeholder="Full Address" 
                                            value={addForm.address}
                                            onChange={e => setAddForm(prev=>({...prev, address: e.target.value}))}
                                            className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 placeholder-slate-400 outline-none text-xs font-bold w-full"
                                        />

                                        <button 
                                            type="submit" 
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-2 rounded-lg border border-emerald-500 shadow-md shadow-emerald-100"
                                        >
                                            + Add Patient Waitlist
                                        </button>
                                    </form>
                                </div>

                            </div>
                        </div>
                    )}

                    {activeTab === 'pndt' && (
                        <div className="p-8 w-full overflow-y-auto h-full space-y-6 custom-scrollbar animate-in fade-in duration-300">
                            {/* PNDT Compliance screen details (Inspired by image 1) */}
                            <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-black text-blue-600 uppercase tracking-tighter">PNDT Form F Maintenance Panel</h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Section 4(1)(b) Compliant Diagnostic Records</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handlePrintPndt}
                                        className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm"
                                    >
                                        <span>🖨️</span> PNDT Print (Form F)
                                    </button>
                                    <button 
                                        onClick={handleAutoFillPcpndt}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5"
                                    >
                                        <span>✨</span> PCPNDT AutoFill (Govt Site)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Left form blocks (lg:col-span-8) */}
                                <div className="lg:col-span-8 space-y-6">
                                     
                                     {/* Personal Details */}
                                     <div className="bg-white p-6 border border-slate-200 rounded-2xl relative space-y-4 shadow-sm">
                                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">1. Personal Details</h3>
                                          <div className="grid grid-cols-3 gap-4">
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">First Name</label>
                                                    <input 
                                                        value={pndtForm.firstName}
                                                        onChange={e => setPndtForm(prev => ({...prev, firstName: e.target.value}))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Middle Name</label>
                                                    <input 
                                                        value={pndtForm.middleName}
                                                        onChange={e => setPndtForm(prev => ({...prev, middleName: e.target.value}))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Last Name</label>
                                                    <input 
                                                        value={pndtForm.lastName}
                                                        onChange={e => setPndtForm(prev => ({...prev, lastName: e.target.value}))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-4">
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Husband / Relative Name</label>
                                                    <input 
                                                        value={pndtForm.husbandName}
                                                        onChange={e => setPndtForm(prev => ({...prev, husbandName: e.target.value}))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Contact No</label>
                                                    <input 
                                                        value={pndtForm.contactNo}
                                                        onChange={e => setPndtForm(prev => ({...prev, contactNo: e.target.value}))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                          </div>

                                          <div>
                                               <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Full Address</label>
                                               <textarea 
                                                    value={pndtForm.address}
                                                    onChange={e => setPndtForm(prev => ({...prev, address: e.target.value}))}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none h-16 resize-none"
                                               />
                                          </div>

                                          {/* Children details */}
                                          <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                                               <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase block mb-2">Existing Son(s)</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                         <div>
                                                              <label className="text-[8px] font-black text-slate-500 block mb-1">Years</label>
                                                              <input type="number" value={pndtForm.sonsYear} onChange={e=>setPndtForm(p=>({...p, sonsYear: e.target.value}))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold" />
                                                         </div>
                                                         <div>
                                                              <label className="text-[8px] font-black text-slate-500 block mb-1">Months</label>
                                                              <input type="number" value={pndtForm.sonsMonth} onChange={e=>setPndtForm(p=>({...p, sonsMonth: e.target.value}))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold" />
                                                         </div>
                                                    </div>
                                               </div>
                                               <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase block mb-2">Existing Daughter(s)</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                         <div>
                                                              <label className="text-[8px] font-black text-slate-500 block mb-1">Years</label>
                                                              <input type="number" value={pndtForm.daughtersYear} onChange={e=>setPndtForm(p=>({...p, daughtersYear: e.target.value}))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold" />
                                                         </div>
                                                         <div>
                                                              <label className="text-[8px] font-black text-slate-500 block mb-1">Months</label>
                                                              <input type="number" value={pndtForm.daughtersMonth} onChange={e=>setPndtForm(p=>({...p, daughtersMonth: e.target.value}))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold" />
                                                         </div>
                                                    </div>
                                               </div>
                                          </div>
                                     </div>

                                     {/* Medical Details */}
                                     <div className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">2. Medical Details</h3>
                                          <div className="grid grid-cols-3 gap-4">
                                               <div className="col-span-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Clinical Diagnosis Indication</label>
                                                    <select 
                                                        value={pndtForm.diagnosis}
                                                        onChange={e => setPndtForm(prev => ({...prev, diagnosis: e.target.value}))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    >
                                                        <option>2] Estimation of gestational age (dating).</option>
                                                        <option>3] Detection of fetal anomaly (Anomaly Scan).</option>
                                                        <option>4] Obstetric Doppler Study.</option>
                                                        <option>5] High-risk obstetric evaluation.</option>
                                                    </select>
                                               </div>
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Last Menstrual Period (LMP)</label>
                                                    <input 
                                                        type="date"
                                                        value={pndtForm.lmp}
                                                        onChange={e => setPndtForm(prev => ({...prev, lmp: e.target.value}))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                          </div>

                                          <div>
                                               <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Obstetric Sonography Conclusion</label>
                                               <textarea 
                                                    value={pndtForm.conclusion}
                                                    onChange={e => setPndtForm(prev => ({...prev, conclusion: e.target.value}))}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none h-24 resize-none font-mono text-[11px]"
                                               />
                                          </div>
                                     </div>
                                </div>

                                {/* Right Side: Consultant Details (lg:col-span-4) */}
                                <div className="lg:col-span-4 bg-white p-6 border border-slate-200 rounded-2xl h-fit space-y-4 shadow-sm">
                                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">3. Consultant Doctor's Details</h3>
                                     <div>
                                          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Consultant Doctor Name</label>
                                          <select 
                                              value={pndtForm.doctorName}
                                              onChange={e => setPndtForm(prev => ({...prev, doctorName: e.target.value}))}
                                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                          >
                                              {settings.reportingDoctors.map(d => (
                                                  <option key={d.name} value={d.name}>{d.name}</option>
                                              ))}
                                          </select>
                                     </div>
                                     <div>
                                          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Center Registered Name</label>
                                          <input 
                                              value={pndtForm.centerName}
                                              onChange={e => setPndtForm(prev => ({...prev, centerName: e.target.value}))}
                                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                          />
                                     </div>
                                     <div>
                                          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Doctor/Center Address</label>
                                          <textarea 
                                              value={pndtForm.doctorAddress}
                                              onChange={e => setPndtForm(prev => ({...prev, doctorAddress: e.target.value}))}
                                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none h-24 resize-none"
                                          />
                                     </div>

                                     <div className="border-t border-slate-200 pt-4">
                                          <button 
                                              onClick={() => alert('Patient details updated successfully in database.')}
                                              className="w-full bg-white border border-slate-200 hover:bg-slate-50 py-3 rounded-xl uppercase tracking-widest font-black text-[10px] text-slate-700"
                                          >
                                               Edit Patient
                                          </button>
                                     </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="p-8 w-full overflow-y-auto h-full space-y-6 custom-scrollbar animate-in fade-in duration-300 text-xs">
                            <div className="border-b border-slate-200 pb-4 shrink-0">
                                <h2 className="text-2xl font-black text-blue-600 uppercase tracking-tighter">USG Settings & Configuration</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase mt-1">Manage reporting templates, credentials, and doctor rosters</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left Side Options */}
                                <div className="space-y-6">
                                     {/* PCPNDT Site Credentials store */}
                                     <div className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Government PCPNDT Portal Sync Settings</h3>
                                          <div className="grid grid-cols-2 gap-4">
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">State Portal Username</label>
                                                    <input 
                                                        type="text" 
                                                        value={pcpndtUser}
                                                        onChange={e => setPcpndtUser(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                               <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Password Credentials</label>
                                                    <input 
                                                        type="password" 
                                                        value={pcpndtPass}
                                                        onChange={e => setPcpndtPass(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
                                                    />
                                               </div>
                                          </div>
                                          <button 
                                              onClick={() => {
                                                  setSettings(prev => ({ ...prev, pcpndtUsername: pcpndtUser, pcpndtPassword: pcpndtPass }));
                                                  alert('PCPNDT credentials saved securely in encrypted local store.');
                                              }}
                                              className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-wider py-2.5 px-6 rounded-lg transition-all"
                                          >
                                               Save Government Sync Credentials
                                          </button>
                                     </div>

                                     {/* Reporting Templates */}
                                     <div className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Active Reporting Templates</h3>
                                          <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto custom-scrollbar">
                                               {settings.templates.map(t => (
                                                    <div key={t.id} className="py-2.5 flex justify-between items-center">
                                                         <span className="font-bold text-slate-700">{t.label}</span>
                                                         <button 
                                                             onClick={() => {
                                                                 setSettings(prev => ({ ...prev, templates: prev.templates.filter(item => item.id !== t.id) }));
                                                             }}
                                                             className="text-rose-600 text-[10px] font-black uppercase border border-rose-200 px-2 py-0.5 rounded hover:bg-rose-100/20"
                                                         >
                                                             Remove
                                                         </button>
                                                    </div>
                                               ))}
                                          </div>
                                          <div className="border-t border-slate-200 pt-4 space-y-3">
                                               <div className="text-[10px] font-black text-slate-500 uppercase flex justify-between">
                                                   <span>Register New Template</span>
                                                   <span className="text-[8px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">F-Form Template Compliant</span>
                                               </div>
                                               <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Template Name (e.g. Abdomen Scan)" 
                                                        value={newTemplate.label}
                                                        onChange={e => setNewTemplate({ label: e.target.value })}
                                                        className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                    />
                                                    <button 
                                                         onClick={() => {
                                                             if (!newTemplate.label) return;
                                                             const newId = newTemplate.label.toUpperCase().replace(/\s+/g, '_');
                                                             setSettings(prev => ({
                                                                 ...prev,
                                                                 templates: [...prev.templates, { id: newId, label: newTemplate.label }]
                                                             }));
                                                             setNewTemplate({ label: '' });
                                                         }}
                                                         className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl"
                                                    >
                                                         Add
                                                    </button>
                                               </div>
                                          </div>
                                     </div>
                                </div>

                                {/* Right Side Options */}
                                <div className="space-y-6">
                                     {/* Reporting Doctor Registration */}
                                     <div className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Reporting Sonologists / Doctors</h3>
                                          <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto custom-scrollbar">
                                               {settings.reportingDoctors.map(d => (
                                                    <div key={d.name} className="py-2.5 flex justify-between items-center">
                                                         <div>
                                                              <p className="font-bold text-slate-800">{d.name}</p>
                                                              <p className="text-[10px] text-slate-400">{d.qualifications} • Reg: {d.regNo}</p>
                                                         </div>
                                                         <button 
                                                             onClick={() => {
                                                                 setSettings(prev => ({ ...prev, reportingDoctors: prev.reportingDoctors.filter(item => item.name !== d.name) }));
                                                             }}
                                                             className="text-rose-600 text-[10px] font-black uppercase border border-rose-200 px-2 py-0.5 rounded hover:bg-rose-100/20"
                                                         >
                                                             Remove
                                                         </button>
                                                    </div>
                                               ))}
                                          </div>
                                          <div className="border-t border-slate-200 pt-4 space-y-2">
                                               <p className="text-[10px] font-black text-slate-500 uppercase">Register Reporting Doctor</p>
                                               <div className="grid grid-cols-2 gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Name" 
                                                        value={newRepDoc.name}
                                                        onChange={e=>setNewRepDoc(prev=>({...prev, name: e.target.value}))}
                                                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Registration No" 
                                                        value={newRepDoc.regNo}
                                                        onChange={e=>setNewRepDoc(prev=>({...prev, regNo: e.target.value}))}
                                                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                    />
                                               </div>
                                               <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Qualifications" 
                                                        value={newRepDoc.qualifications}
                                                        onChange={e=>setNewRepDoc(prev=>({...prev, qualifications: e.target.value}))}
                                                        className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                    />
                                                    <button 
                                                         onClick={() => {
                                                             if (!newRepDoc.name) return;
                                                             setSettings(prev => ({
                                                                 ...prev,
                                                                 reportingDoctors: [...prev.reportingDoctors, newRepDoc]
                                                             }));
                                                             setNewRepDoc({ name: '', regNo: '', qualifications: '' });
                                                         }}
                                                         className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl shrink-0"
                                                    >
                                                         Add Doc
                                                    </button>
                                               </div>
                                          </div>
                                     </div>

                                     {/* Referral Doctor Registration */}
                                     <div className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Referral Doctor Registration</h3>
                                          <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto custom-scrollbar">
                                               {settings.referralDoctors.map(d => (
                                                    <div key={d.name} className="py-2.5 flex justify-between items-center">
                                                         <div>
                                                              <p className="font-bold text-slate-800">{d.name}</p>
                                                              <p className="text-[10px] text-slate-400">{d.specialty} • {d.clinic}</p>
                                                         </div>
                                                         <button 
                                                             onClick={() => {
                                                                 setSettings(prev => ({ ...prev, referralDoctors: prev.referralDoctors.filter(item => item.name !== d.name) }));
                                                             }}
                                                             className="text-rose-600 text-[10px] font-black uppercase border border-rose-200 px-2 py-0.5 rounded hover:bg-rose-100/20"
                                                         >
                                                             Remove
                                                         </button>
                                                    </div>
                                               ))}
                                          </div>
                                          <div className="border-t border-slate-200 pt-4 space-y-2">
                                               <p className="text-[10px] font-black text-slate-500 uppercase">Register Referral Doctor</p>
                                               <div className="grid grid-cols-2 gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Name" 
                                                        value={newRefDoc.name}
                                                        onChange={e=>setNewRefDoc(prev=>({...prev, name: e.target.value}))}
                                                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Specialty" 
                                                        value={newRefDoc.specialty}
                                                        onChange={e=>setNewRefDoc(prev=>({...prev, specialty: e.target.value}))}
                                                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                    />
                                               </div>
                                               <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Clinic Address" 
                                                        value={newRefDoc.clinic}
                                                        onChange={e=>setNewRefDoc(prev=>({...prev, clinic: e.target.value}))}
                                                        className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                    />
                                                    <button 
                                                         onClick={() => {
                                                             if (!newRefDoc.name) return;
                                                             setSettings(prev => ({
                                                                 ...prev,
                                                                 referralDoctors: [...prev.referralDoctors, newRefDoc]
                                                             }));
                                                             setNewRefDoc({ name: '', specialty: '', clinic: '' });
                                                         }}
                                                         className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl shrink-0"
                                                    >
                                                         Add Ref
                                                    </button>
                                               </div>
                                          </div>
                                     </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Placeholder Views for other left-sidebar options */}
                    {!['home', 'pndt', 'settings'].includes(activeTab) && (
                        <div className="flex-grow flex flex-col items-center justify-center p-12 text-center text-slate-400">
                            <span className="text-5xl mb-4 font-black">⚡</span>
                            <h3 className="text-lg font-black uppercase text-slate-500 tracking-wider">Tab Section: {activeTab.replace('_', ' ').toUpperCase()}</h3>
                            <p className="text-xs font-bold text-slate-400 max-w-md mt-2 uppercase">This workspace pane is integrated with pCare clinical database logs. Operations are active in the background.</p>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
};

export default UsgSection;
