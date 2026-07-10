import React, { useState, useMemo, useEffect } from 'react';
import { Patient, VisitRecord, PatientType, VisitType, PregnancyInfo, Vitals, LabOrder, Consultant, AppPrintSettings, ServicePrices, Ward, IpdAdmission, RegistryTemplate } from '../types';
import { extractPatientDataFromId } from '../services/geminiService';
import { syncToCloud } from '../services/firebaseService';
import { useVoiceDictation } from '../services/voiceService';
import { calculateLabFeesForOrder, DEFAULT_PRICES } from '../services/billingService';
import ReportPreview from './ReportPreview';
import { numberToWords } from '../services/numberToWords';

interface OPDCounterProps {
  patients: Patient[];
  visits: VisitRecord[];
  labOrders: LabOrder[];
  consultants: Consultant[];
  printSettings?: AppPrintSettings;
  billingRates?: ServicePrices;
  wards?: Ward[];
  admissions?: IpdAdmission[];
  registryTemplates?: RegistryTemplate[];
  onRegister: (p: Patient, v: VisitRecord) => void;
  onUpdateVisits: (v: VisitRecord[] | ((prev: VisitRecord[]) => VisitRecord[])) => void;
  onAddAdmission?: (admission: IpdAdmission) => void;
}

const OPDCounter: React.FC<OPDCounterProps> = ({ patients, visits, labOrders, consultants, printSettings, billingRates = DEFAULT_PRICES, wards = [], admissions = [], registryTemplates = [], onRegister, onUpdateVisits, onAddAdmission }) => {
  const [activeTab, setActiveTab] = useState<'registration' | 'logs' | 'followup'>('registration');
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '', age: '', address: '', mobile: '', type: 'surgery', isPreviouslyRegistered: false, uhid: ''
  });
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  
  const regCustomFields = useMemo(() => {
    const fields: any[] = [];
    registryTemplates.forEach(t => {
      if (t.fieldConfigs) {
        t.fieldConfigs.forEach(fc => {
          if (fc.source === 'Patient Registration') {
            const nameLower = fc.name.toLowerCase();
            if (!['patient name', 'name', 'age', 'dob', 'address', 'mobile', 'uhid', 'date'].includes(nameLower)) {
              if (!fields.some(f => f.name.toLowerCase() === nameLower)) {
                fields.push(fc);
              }
            }
          }
        });
      }
    });
    return fields;
  }, [registryTemplates]);
  const [vitals, setVitals] = useState<Vitals>({
    bp: '', pulse: '', weight: '', height: '', spo2: ''
  });
  
  // Use active consultants for dropdown
  const activeConsultants = useMemo(() => consultants.filter(c => c.isActive), [consultants]);
  
  // Combined list for dropdown (Dynamic Only)
  const doctorOptions = useMemo(() => {
      return activeConsultants.map(c => c.name);
  }, [activeConsultants]);

  const [assignedDoctor, setAssignedDoctor] = useState(doctorOptions[0] || '');

  const [lmp, setLmp] = useState('');
  const [isProcessingId, setIsProcessingId] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  const { isRecording: isVoiceRecording, start: startVoiceRegistration } = useVoiceDictation(async (text) => {
      setIsVoiceProcessing(true);
      try {
          const response = await fetch('/api/parseVoiceRegistration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
          });
          if (response.ok) {
              const data = await response.json();
              setFormData(prev => ({
                  ...prev,
                  name: data.name || prev.name,
                  age: data.age || prev.age,
                  gender: data.gender || prev.gender,
                  mobile: data.mobile || prev.mobile,
                  address: data.address || prev.address,
                  type: data.type || prev.type
              }));
              alert("Voice details parsed and filled out!");
          } else {
              alert("Failed to parse voice details.");
          }
      } catch (e) {
          console.error(e);
          alert("Error parsing voice registration.");
      } finally {
          setIsVoiceProcessing(false);
      }
  });

  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editingVisit, setEditingVisit] = useState<VisitRecord | null>(null);
  const [parentCaseId, setParentCaseId] = useState<string>('new_case'); // Link to open case

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);

  const allCasesForPatient = useMemo(() => {
    if (!formData.id || !formData.isPreviouslyRegistered) return [];
    return visits.filter(v => v.patientId === formData.id);
  }, [formData.id, formData.isPreviouslyRegistered, visits]);

  const [selectedVisitForBill, setSelectedVisitForBill] = useState<VisitRecord | null>(null);
  const [selectedOrderForReport, setSelectedOrderForReport] = useState<LabOrder | null>(null);
  const [showIpdModal, setShowIpdModal] = useState(false);

  // Billing State
  const [billItems, setBillItems] = useState<{name: string, price: number}[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);

  const [logStartDate, setLogStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [logEndDate, setLogEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Follow-up Register State
  const [followUpMonth, setFollowUpMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Date Filter for Registration View
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10));

  // Ensure default doctor is set when options load
  useEffect(() => {
      if (doctorOptions.length > 0 && !assignedDoctor) {
          setAssignedDoctor(doctorOptions[0]);
      }
  }, [doctorOptions, assignedDoctor]);

  // Search Logic
  useEffect(() => {
    const query = formData.name || '';
    if (!editingPatient && query.trim().length > 1) {
      const lowerQ = query.toLowerCase();
      const results = patients.filter(p => 
        p.name.toLowerCase().includes(lowerQ) || 
        (p.mobile && p.mobile.includes(lowerQ)) ||
        (p.uhid && p.uhid.toLowerCase().includes(lowerQ))
      );
      // Filter out if exact match is already selected
      if (results.length === 1 && results[0].name === query && results[0].uhid === formData.uhid) {
          setSearchResults([]);
      } else {
          setSearchResults(results.slice(0, 5)); // Limit to 5 results
      }
    } else {
      setSearchResults([]);
    }
  }, [formData.name, patients, editingPatient, formData.uhid]);

  const selectExistingPatient = (patient: Patient) => {
    setFormData({
      ...patient,
      isPreviouslyRegistered: true
    });
    if(patient.pregnancyInfo?.lmp) {
       setLmp(patient.pregnancyInfo.lmp);
    } else {
       setLmp('');
    }
    setCustomFields(patient.customFields || {});
    setSearchResults([]);
  };

  const generateUHID = () => {
    const now = new Date();
    // Format: YYMM-XXXX (Random 4 digits)
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${yy}${mm}-${random}`;
  };

  const calculatePregnancy = (dateStr: string): PregnancyInfo => {
    if (!dateStr) return { lmp: '', edd: '', pog: '' };
    const lmpDate = new Date(dateStr);
    const eddDate = new Date(lmpDate);
    eddDate.setDate(eddDate.getDate() + 280); 
    const diff = new Date().getTime() - lmpDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    return { 
      lmp: dateStr, 
      edd: eddDate.toISOString().slice(0, 10), 
      pog: `${weeks} Weeks ${remainingDays} Days` 
    };
  };

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsProcessingId(true);
    try {
      const file = e.target.files[0];
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const data = await extractPatientDataFromId(base64, file.type);
      setFormData(prev => ({ ...prev, ...data }));
    } catch (error) {
      alert("Failed to process ID card.");
    } finally {
      setIsProcessingId(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPatient && editingVisit) {
      const pregInfo = formData.type === 'obstetric' && lmp ? calculatePregnancy(lmp) : undefined;
      const updatedPatient = { 
          ...editingPatient, 
          ...formData, 
          pregnancyInfo: pregInfo,
          // Preserve history
          obstetricHistory: formData.obstetricHistory || editingPatient.obstetricHistory,
          customFields: { ...(editingPatient.customFields || {}), ...customFields }
      } as Patient;
      
      const updatedPatients = patients.map(p => p.id === editingPatient.id ? updatedPatient : p);
      const updatedVisits = visits.map(v => v.id === editingVisit.id ? { ...v, vitals, assignedDoctor } as VisitRecord : v);
      
      syncToCloud('patients', updatedPatients);
      onUpdateVisits(updatedVisits);
      setEditingPatient(null);
      setEditingVisit(null);
      alert("Details Updated!");
    } else {
      const id = Date.now().toString();
      const uhid = formData.uhid || generateUHID(); 
      
      const pregInfo = formData.type === 'obstetric' && lmp ? calculatePregnancy(lmp) : undefined;
      const patient: Patient = { ...formData as Patient, id, uhid, pregnancyInfo: pregInfo, customFields };
      
      const existingPatientIndex = patients.findIndex(p => p.uhid === uhid || (p.mobile === patient.mobile && p.name === patient.name));
      
      let finalPatient = patient;
      if (existingPatientIndex >= 0) {
          const updatedPatients = [...patients];
          const existing = updatedPatients[existingPatientIndex];
          finalPatient = { 
              ...existing, 
              ...patient, 
              id: existing.id,
              obstetricHistory: patient.obstetricHistory || existing.obstetricHistory,
              pregnancyInfo: patient.pregnancyInfo || existing.pregnancyInfo,
              customFields: { ...(existing.customFields || {}), ...customFields }
          };
          updatedPatients[existingPatientIndex] = finalPatient;
          syncToCloud('patients', updatedPatients);
      } 

      const visitType: VisitType = patient.isPreviouslyRegistered ? 'follow-up-short' : 'new';
      // Find consultant fee - check dynamic consultants first, else default 200
      const doc = consultants.find(c => c.name === assignedDoctor);
      
      // LOGIC UPDATE: Use followUpFee if available and patient is previously registered
      let fee = 200;
      if (doc) {
          if (patient.isPreviouslyRegistered && doc.followUpFee !== undefined) {
              fee = doc.followUpFee;
          } else {
              fee = doc.baseFee;
          }
      }
      
      const regDate = new Date().toISOString().slice(0, 10);

      const visit: VisitRecord = {
        id: `v-${id}`,
        patientId: finalPatient.id,
        date: regDate,
        visitType,
        fees: fee,
        isApproved: false,
        callingStatus: 'waiting',
        vitals,
        assignedDoctor,
        caseStatus: 'open',
        parentVisitId: parentCaseId !== 'new_case' ? parentCaseId : undefined,
        orders: { id: `o-${id}`, patientId: finalPatient.id, tests: { cbc: false, serology: false, urine: false, other: false, widal: false, crp: false, hormone: false, semen: false }, ultrasound: false, status: 'pending', timestamp: Date.now() }
      };
      
      onRegister(finalPatient, visit);
      alert(`Registration Successful! UHID: ${finalPatient.uhid}`);
    }
    setFormData({ name: '', age: '', address: '', mobile: '', type: 'surgery', isPreviouslyRegistered: false, uhid: '' });
    setVitals({ bp: '', pulse: '', weight: '', height: '', spo2: '' });
    setLmp('');
    setParentCaseId('new_case');
    setCustomFields({});
  };

  const currentQueue = useMemo(() => visits.filter(v => !v.isApproved && v.date === viewDate).map(v => ({
    visit: v,
    patient: patients.find(p => p.id === v.patientId)
  })).filter(x => x.patient), [visits, patients, viewDate]);

  const examinedList = useMemo(() => visits.filter(v => v.isApproved && v.date === viewDate).map(v => ({
    visit: v,
    patient: patients.find(p => p.id === v.patientId)
  })).filter(x => x.patient), [visits, patients, viewDate]);

  // Updated Payment Logic with Editable Charges
  const openPaymentModal = (visit: VisitRecord) => {
      setSelectedVisitForBill(visit);
      
      if (visit.finalBill) {
          // Edit existing bill mode
          setBillItems(visit.finalBill.items);
          setBillDiscount(visit.finalBill.discount);
      } else {
          // New bill mode: Initial Items Construction
          const items = [{ name: `Consultation (${visit.visitType})`, price: visit.fees }];
          const orders = getLabOrdersForVisit(visit.patientId).filter(o => o.status === 'completed' || o.ultrasound);
          
          orders.forEach(o => {
              if (o.ultrasound) items.push({ name: 'Ultrasound', price: billingRates.ultrasound?.price || 800 });
              if (o.tests) {
                  Object.entries(o.tests).forEach(([k, v]) => {
                      if (k === 'hormone' && o.tests.hormoneDetails) {
                          // Granular hormone billing
                          Object.entries(o.tests.hormoneDetails).forEach(([hKey, hSelected]) => {
                              if (hSelected && billingRates[hKey]) {
                                  items.push({ name: billingRates[hKey].name, price: billingRates[hKey].price });
                              }
                          });
                      } else if (v && billingRates[k]) {
                          items.push({ name: billingRates[k].name, price: billingRates[k].price });
                      }
                  });
              }
          });
          setBillItems(items);
          setBillDiscount(0);
      }
  };

  const finalizePayment = (method: 'cash' | 'upi') => {
      if (!selectedVisitForBill) return;
      
      const subTotal = billItems.reduce((acc, item) => acc + item.price, 0);
      const grandTotal = subTotal - billDiscount;
      const billNo = selectedVisitForBill.finalBill?.billNumber || `B-${Date.now().toString().slice(-6)}`;

      const collector = selectedVisitForBill.collectedBy || 'Receptionist';
      const finalBill = {
          billNumber: billNo,
          items: billItems,
          subTotal,
          discount: billDiscount,
          grandTotal,
          collectedBy: collector,
          paymentMethod: method,
          date: new Date().toISOString()
      };

      const updated = visits.map(v => v.id === selectedVisitForBill.id ? { 
          ...v, 
          paymentStatus: 'paid', 
          paymentMethod: method, 
          collectedBy: collector,
          finalBill: finalBill
      } as VisitRecord : v);
      
      onUpdateVisits(updated);
      setSelectedVisitForBill(null);
      alert(`Payment of ₹${grandTotal} Collected! Bill #${billNo}`);
  };

  const handlePrintBill = (visit: VisitRecord) => {
    const patient = patients.find(p => p.id === visit.patientId);
    if (!patient) return;
    
    // Use stored final bill or fallback to live calculation
    const billItemsToPrint = visit.finalBill?.items || [{ name: 'Consultation', price: visit.fees }];
    const total = visit.finalBill?.grandTotal || visit.fees;
    const billNo = visit.finalBill?.billNumber || 'DRAFT';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = billItemsToPrint.map(item => 
        `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.price.toFixed(2)}</td></tr>`
    ).join('');

    const layout = printSettings?.bill || { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, headerHeight: 70, footerHeight: 10 };
    const hasHeaderImage = !!printSettings?.headerImage;
    const headerHeightVal = (layout.headerHeight && layout.headerHeight > 0) ? layout.headerHeight : 70;
    const computedPaddingTop = hasHeaderImage ? `${headerHeightVal + (layout.marginTop || 0)}mm` : `${layout.marginTop}mm`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Hospital Bill</title>
          <style>
            body { 
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                color: #333; 
                margin: 0;
            }
            .container { 
                width: 100%; 
                min-height: 297mm;
                position: relative;
                box-sizing: border-box;
                padding-top: ${computedPaddingTop};
                padding-bottom: ${layout.marginBottom}mm;
                padding-left: ${layout.marginLeft}mm;
                padding-right: ${layout.marginRight}mm;
            }
            .footer-space { height: ${layout.footerHeight}mm; }
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
                body { margin: 0; }
                .container { padding-top: ${computedPaddingTop}; padding-left: ${layout.marginLeft}mm; padding-right: ${layout.marginRight}mm; }
                @page { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${hasHeaderImage ? `<div style="position: absolute; top: 0; left: 0; right: 0; width: 100%; height: ${headerHeightVal}mm; overflow: hidden;"><img src="${printSettings.headerImage}" style="width: 100%; height: 100%; object-fit: fill;" /></div>` : ''}
          <div class="container">
            ${!hasHeaderImage ? `
              <div class="header">
                <h1>HOSPITAL CONNECT</h1>
                <p>Consultant: ${visit.assignedDoctor}</p>
              </div>
            ` : ''}
            <div class="info">
              <div>
                <strong>Patient Details:</strong><br>
                Name: ${patient.name}<br>
                UHID: ${patient.uhid || 'N/A'}<br>
                Age: ${patient.age || '-'}
              </div>
              <div style="text-align: right;">
                <strong>Bill Details:</strong><br>
                Bill No: ${billNo}<br>
                Date: ${visit.date}<br>
                Time: ${new Date().toLocaleTimeString()}${hasHeaderImage ? `<br>Consultant: ${visit.assignedDoctor}` : ''}
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
                  <td style="text-align: right;">₹${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <div class="words">Amount in Words: Rupees ${numberToWords(Math.floor(total))} Only</div>
            <div class="signatures">
               <div>Patient Signature</div>
               <div>Authorized Signatory</div>
            </div>
          </div>
          <div class="footer-space"></div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getLabOrdersForVisit = (patientId: string) => {
    return labOrders.filter((o: LabOrder) => o.patientId === patientId);
  };

  const filteredLogs = useMemo(() => {
    return visits.filter(v => {
        const d = new Date(v.date);
        const start = new Date(logStartDate);
        const end = new Date(logEndDate);
        return d >= start && d <= end;
    }).map(v => ({
        visit: v,
        patient: patients.find(p => p.id === v.patientId)
    })).filter(x => x.patient);
  }, [visits, patients, labOrders, logStartDate, logEndDate]);

  return (
    <div className="space-y-8">
      {/* ... (Keep existing UI rendering) ... */}
      <div className="flex space-x-2 bg-slate-200 p-1 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('registration')} className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'registration' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}>OPD Registration</button>
        <button onClick={() => setActiveTab('logs')} className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}>Collection Log</button>
        <button onClick={() => setActiveTab('followup')} className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'followup' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}>Follow-up Register</button>
      </div>

      {activeTab === 'registration' && (
        <>
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
            {/* ... */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {editingPatient ? 'Update Patient Record' : 'OPD Registration Desk'}
              </h2>
              <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase">View Date:</span>
                      <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="bg-transparent font-bold text-slate-800 outline-none text-sm" />
                  </div>
                  {!editingPatient && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={startVoiceRegistration}
                        className={`px-6 py-2 rounded-xl font-black transition-all shadow-lg active:scale-95 text-xs uppercase tracking-widest flex items-center gap-1.5 ${isVoiceRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                      >
                        {isVoiceProcessing ? '🤖 Parsing...' : (isVoiceRecording ? '🎙️ Listening...' : '🎙️ Dictate Details')}
                      </button>
                      <label className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black cursor-pointer hover:bg-blue-700 transition-all shadow-lg active:scale-95 text-xs uppercase tracking-widest">
                        {isProcessingId ? '🤖 Reading ID...' : '📸 Scan Identity Card'}
                        <input type="file" className="hidden" accept="image/*" onChange={handleIdUpload} />
                      </label>
                    </div>
                  )}
              </div>
            </div>

            {/* SEARCH BAR REMOVED */}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="font-black text-blue-600 text-xs uppercase tracking-widest border-b pb-2">Demographics</h3>
                {/* ... Inputs ... */}
                <div className="grid grid-cols-2 gap-4 relative">
                  <div className="col-span-2 relative">
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Full Patient Name</label>
                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-xl mt-2 border border-slate-100 z-10 overflow-hidden">
                        {searchResults.map(p => (
                          <button 
                            key={p.id} 
                            type="button"
                            onClick={() => selectExistingPatient(p)}
                            className="w-full text-left p-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                          >
                            <p className="font-bold text-slate-800">{p.name} <span className="text-xs font-normal text-slate-500">({p.age})</span></p>
                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">UHID: {p.uhid || 'N/A'} | Mob: {p.mobile}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Age / DOB</label>
                    <input required value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Mobile No. (Optional)</label>
                    <input value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Optional" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Address</label>
                    <input required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                  </div>
                  {formData.uhid && (
                     <div className="col-span-2 bg-slate-100 p-2 rounded-lg text-center border border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase">System UHID</p>
                        <p className="font-mono text-lg font-black text-slate-800">{formData.uhid}</p>
                     </div>
                  )}
                  {regCustomFields.length > 0 && (
                    <div className="col-span-2 pt-4 border-t border-slate-100 space-y-4">
                      <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Custom Registry Tracking</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {regCustomFields.map(fc => {
                          const val = customFields[fc.name] || '';
                          return (
                            <div key={fc.name} className={fc.type === 'text' ? "col-span-2" : "col-span-1"}>
                              <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">{fc.name}</label>
                              {fc.type === 'select' ? (
                                <select
                                  value={val}
                                  onChange={e => setCustomFields({ ...customFields, [fc.name]: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold"
                                >
                                  <option value="">-- Choose Option --</option>
                                  {fc.options?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={fc.type === 'number' ? 'number' : 'text'}
                                  value={val}
                                  onChange={e => setCustomFields({ ...customFields, [fc.name]: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                  placeholder={`Enter ${fc.name}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Department</label>
                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as PatientType })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold">
                      <option value="surgery">Surgery</option>
                      <option value="gynecology">Gynecology</option>
                      <option value="obstetric">Obstetrics (Maternity)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Visit Type</label>
                    <select value={formData.isPreviouslyRegistered ? 'old' : 'new'} onChange={e => setFormData({ ...formData, isPreviouslyRegistered: e.target.value === 'old' })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold">
                      <option value="new">New</option>
                      <option value="old">Follow-up</option>
                    </select>
                  </div>
                  
                  {formData.isPreviouslyRegistered && allCasesForPatient.length > 0 && (
                      <div className="col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Link to Case Branch</label>
                          <select value={parentCaseId} onChange={e => setParentCaseId(e.target.value)} className="w-full bg-purple-50 border-2 border-purple-200 rounded-xl px-4 py-3 font-bold text-purple-800 outline-none">
                              <option value="new_case">Start New Case / Complaint</option>
                              {allCasesForPatient.map(v => (
                                  <option key={v.id} value={v.id}>
                                      {v.date} - {v.assignedDoctor} - {v.complaints ? v.complaints.substring(0, 30) + '...' : 'Visit'} {v.caseStatus === 'closed' ? '(Closed)' : '(Open)'}
                                  </option>
                              ))}
                          </select>
                      </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-blue-600 uppercase ml-1 mb-1">Select Consulting Doctor</label>
                    <select value={assignedDoctor} onChange={e => setAssignedDoctor(e.target.value)} className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3 font-black text-blue-800 outline-none">
                      {doctorOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                </div>
                
                {/* ... (Keep Obstetric History Section) ... */}
                {formData.type === 'obstetric' && (
                  <div className="p-6 bg-pink-50 rounded-2xl border-2 border-pink-100 animate-in slide-in-from-left-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-black text-pink-700 uppercase tracking-wider">Maternity Tracking</h4>
                      <span className="bg-pink-200 text-pink-700 px-2 py-0.5 rounded text-[10px] font-bold">Auto-Calc</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-pink-400 uppercase mb-1">Last Menstrual Period (LMP)</label>
                        <input type="date" value={lmp} onChange={e => setLmp(e.target.value)} className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 font-bold text-pink-800 focus:ring-pink-100 outline-none" />
                      </div>
                      {lmp && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-3 rounded-xl border border-pink-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase">EDD</p>
                            <p className="text-sm font-black text-slate-800">{calculatePregnancy(lmp).edd}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-pink-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase">POG</p>
                            <p className="text-sm font-black text-pink-600">{calculatePregnancy(lmp).pog}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ... (Keep Vitals Section) ... */}
              <div className="space-y-6">
                <h3 className="font-black text-amber-600 text-xs uppercase tracking-widest border-b pb-2">Vitals Collection</h3>
                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">BP (mmHg)</label>
                    <input placeholder="120/80" value={vitals.bp} onChange={e => setVitals({ ...vitals, bp: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-amber-50 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Pulse (bpm)</label>
                    <input placeholder="72" value={vitals.pulse} onChange={e => setVitals({ ...vitals, pulse: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-amber-50 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Weight (kg)</label>
                    <input placeholder="0.0" type="number" value={vitals.weight} onChange={e => setVitals({ ...vitals, weight: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-amber-50 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">SpO2 (%)</label>
                    <input placeholder="98" type="number" value={vitals.spo2} onChange={e => setVitals({ ...vitals, spo2: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-amber-50 outline-none" />
                  </div>
                </div>
                <div className="pt-8 space-y-4">
                  <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl shadow-2xl transition-all transform active:scale-95 uppercase tracking-widest text-sm">
                    {editingPatient ? 'Update Case Record' : 'Confirm & Add to Waiting List'}
                  </button>
                  {!editingPatient && onAddAdmission && wards && wards.length > 0 && (
                    <button type="button" onClick={() => setShowIpdModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 uppercase tracking-widest text-sm">
                      Admit Patient to IPD
                    </button>
                  )}
                  {editingPatient && (
                    <button type="button" onClick={() => { setEditingPatient(null); setFormData({ name: '', age: '', address: '', mobile: '', type: 'surgery', uhid: '' }); }} className="w-full mt-4 text-slate-400 font-black uppercase tracking-widest text-[10px]">Abandon Changes</button>
                  )}
                </div>
              </div>
            </form>
          </div>
          {/* ... (Keep Queue and Examined List Sections) ... */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Active Consultation Queue ({viewDate})</h2>
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">{currentQueue.length} Active</span>
            </div>
            {/* ... Queue Table ... */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="px-6 py-4">Patient Info</th>
                    <th className="px-6 py-4">Doctor</th>
                    <th className="px-6 py-4">Vitals</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentQueue.map(({ patient, visit }) => (
                    <tr key={visit.id} className={`${visit.callingStatus === 'called' ? 'bg-green-100 animate-pulse border-l-4 border-green-600' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-800">{patient?.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{patient?.mobile} | UHID: {patient?.uhid}</p>
                      </td>
                      <td className="px-6 py-4 font-black text-blue-600 text-sm">{visit.assignedDoctor}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">
                        BP:{visit.vitals?.bp || '-'} P:{visit.vitals?.pulse || '-'} W:{visit.vitals?.weight || '-'}kg
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => { setEditingPatient(patient!); setEditingVisit(visit); setFormData(patient!); setVitals(visit.vitals || {bp:'',pulse:'',weight:'',height:'',spo2:''}); setAssignedDoctor(visit.assignedDoctor || ''); setCustomFields(patient?.customFields || {}); }} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest mr-2">Edit</button>
                        <button onClick={() => handlePrintBill(visit)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Reg Slip</button>
                      </td>
                    </tr>
                  ))}
                  {currentQueue.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No active patients in queue for {viewDate}.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-800 uppercase">Examination Completed Queue ({viewDate})</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Ready for Billing & Reports</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="px-6 py-4">Patient Details</th>
                    <th className="px-6 py-4">Consultant</th>
                    <th className="px-6 py-4">Available Lab Reports</th>
                    <th className="px-6 py-4 text-center">OPD Fee Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examinedList.map(({ patient, visit }) => {
                    const orders = getLabOrdersForVisit(visit.patientId);
                    const completedOrders = orders.filter(o => o.status === 'completed');
                    
                    return (
                      <tr key={visit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-800">
                          {patient?.name}
                          <div className="text-[10px] text-slate-400 normal-case font-bold">{visit.date}</div>
                        </td>
                        <td className="px-6 py-4 font-black text-blue-600 text-xs">{visit.assignedDoctor}</td>
                        <td className="px-6 py-4">
                          {completedOrders.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {completedOrders.map((o: LabOrder) => (
                                    <button 
                                      key={o.id} 
                                      onClick={() => setSelectedOrderForReport(o)} 
                                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all uppercase tracking-widest"
                                    >
                                        📄 {Object.entries(o.tests).filter(([_,v])=>v).map(([k])=>k.toUpperCase()).join(', ') || 'VIEW REPORT'}
                                    </button>
                                ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic flex items-center gap-1">
                               <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span> No Reports Yet
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${visit.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {visit.paymentStatus === 'paid' ? `PAID (${visit.paymentMethod})` : 'UNPAID'}
                          </span>
                          {visit.collectedBy && visit.collectedBy !== 'OPD Counter' && (
                              <div className="text-[9px] text-slate-500 font-bold mt-1">By: {visit.collectedBy}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openPaymentModal(visit)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95">Finalize Settlement</button>
                        </td>
                      </tr>
                    );
                  })}
                  {examinedList.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest italic">No examined patients on {viewDate}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ... (Keep Logs and Followup Sections) ... */}
      
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Collection Log</h2>
            <div className="flex gap-4">
                <input type="date" value={logStartDate} onChange={e => setLogStartDate(e.target.value)} className="bg-white border rounded-xl px-4 py-2 text-xs font-bold" />
                <span className="self-center font-bold text-slate-400">-</span>
                <input type="date" value={logEndDate} onChange={e => setLogEndDate(e.target.value)} className="bg-white border rounded-xl px-4 py-2 text-xs font-bold" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <th className="px-6 py-4">Date / Bill ID</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Collected By</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(({ visit, patient }) => (
                  <tr key={visit.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                        <p className="font-bold text-slate-800 text-xs">{visit.date}</p>
                        <p className="text-[10px] font-mono text-slate-400">{visit.finalBill?.billNumber || 'Pending'}</p>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800">{patient?.name}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold">₹{visit.finalBill?.grandTotal || visit.fees}</td>
                    <td className="px-6 py-4 text-center">
                        {visit.paymentStatus === 'paid' ? (
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase">Paid ({visit.paymentMethod})</span>
                        ) : <span className="text-red-500 font-bold text-xs">Unpaid</span>}
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase">
                        {(visit.collectedBy === 'OPD Counter' || !visit.collectedBy) ? 'Receptionist' : visit.collectedBy}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => openPaymentModal(visit)} className="text-blue-600 font-black text-[10px] uppercase hover:underline">Edit</button>
                        <button onClick={() => handlePrintBill(visit)} className="text-purple-600 font-black text-[10px] uppercase hover:underline">Print Bill</button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No logs found in range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'followup' && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Follow-up Register</h2>
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Select Month:</span>
                    <input 
                        type="month" 
                        value={followUpMonth} 
                        onChange={e => setFollowUpMonth(e.target.value)} 
                        className="bg-transparent font-bold text-slate-800 outline-none text-xs" 
                    />
                </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <th className="px-6 py-4">Expected Date</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Last Visit Context</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.filter(v => v.followUpDate && v.followUpDate.startsWith(followUpMonth)).sort((a,b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime()).map(v => {
                    const p = patients.find(pat => pat.id === v.patientId);
                    if (!p) return null;
                    return (
                        <tr key={v.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                                <p className="font-black text-slate-800 text-sm">{v.followUpDate}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">{new Date(v.followUpDate!).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                            </td>
                            <td className="px-6 py-4">
                                <p className="font-bold text-slate-800">{p.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold">{p.mobile}</p>
                            </td>
                            <td className="px-6 py-4">
                                <p className="text-xs text-slate-600 italic line-clamp-1">{v.remarks || 'No remarks'}</p>
                                <p className="text-[9px] text-blue-600 font-bold uppercase mt-1">Prev: {v.date} ({v.assignedDoctor})</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button onClick={() => { setActiveTab('registration'); selectExistingPatient(p); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-100">Register Visit</button>
                            </td>
                        </tr>
                    );
                })}
                {visits.filter(v => v.followUpDate && v.followUpDate.startsWith(followUpMonth)).length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No follow-ups scheduled for this month.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedVisitForBill && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Finalize & Collect</h3>
                      <button onClick={() => setSelectedVisitForBill(null)} className="text-slate-400 text-2xl">&times;</button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-grow space-y-4">
                      {/* ... Billing Content ... */}
                      {selectedVisitForBill.collectedBy && (
                          <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex items-center gap-3">
                              <span className="text-xl">✅</span>
                              <div>
                                  <p className="text-xs font-black text-green-700 uppercase">Payment Already Collected</p>
                                  <p className="text-xs text-green-600">Collected by {selectedVisitForBill.collectedBy}</p>
                              </div>
                          </div>
                      )}

                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Billable Items (Editable)</p>
                          <div className="space-y-2">
                              {billItems.map((item, idx) => (
                                  <div key={idx} className="flex gap-2 items-center">
                                      <input 
                                          value={item.name} 
                                          onChange={e => {
                                              const newItems = [...billItems];
                                              newItems[idx].name = e.target.value;
                                              setBillItems(newItems);
                                          }}
                                          className="flex-grow border rounded-lg px-3 py-2 text-sm font-bold text-slate-700"
                                      />
                                      <input 
                                          type="number"
                                          value={item.price} 
                                          onChange={e => {
                                              const newItems = [...billItems];
                                              newItems[idx].price = Number(e.target.value);
                                              setBillItems(newItems);
                                          }}
                                          className="w-24 border rounded-lg px-3 py-2 text-sm font-bold text-right"
                                      />
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-slate-100">
                          <div className="w-1/2 space-y-2">
                              <div className="flex justify-between text-sm">
                                  <span className="text-slate-500 font-bold">Subtotal</span>
                                  <span className="font-bold">₹{billItems.reduce((a,b)=>a+b.price, 0)}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                  <span className="text-slate-500 font-bold text-sm">Discount</span>
                                  <input 
                                      type="number" 
                                      value={billDiscount}
                                      onChange={e => setBillDiscount(Number(e.target.value))}
                                      className="w-20 border rounded-lg px-2 py-1 text-right text-sm font-bold text-red-500"
                                  />
                              </div>
                              <div className="flex justify-between text-lg pt-2 border-t border-slate-200">
                                  <span className="font-black text-slate-800">Grand Total</span>
                                  <span className="font-black text-blue-600">₹{billItems.reduce((a,b)=>a+b.price, 0) - billDiscount}</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t grid grid-cols-2 gap-4">
                      <button onClick={() => finalizePayment('cash')} className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">Confirm Cash</button>
                      <button onClick={() => finalizePayment('upi')} className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">Confirm UPI</button>
                  </div>
              </div>
          </div>
      )}

      {selectedOrderForReport && selectedOrderForReport.reportData && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[120] flex items-center justify-center p-4">
           <div className="bg-slate-200 rounded-3xl w-full max-w-5xl h-[95vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="bg-white p-6 border-b flex justify-between items-center">
                 <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tighter text-xl">Lab Report Viewer</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Front Desk View</p>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-all">🖨️ Print Report</button>
                    <button onClick={() => setSelectedOrderForReport(null)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Close</button>
                 </div>
              </div>
              <div className="flex-grow overflow-auto p-10 flex justify-center bg-slate-100" id="print-container">
                 <div className="origin-top transform scale-90 md:scale-100">
                    <ReportPreview reportData={selectedOrderForReport.reportData} selectedTests={selectedOrderForReport.tests} settings={printSettings} />
                 </div>
              </div>
           </div>
        </div>
      )}

      {showIpdModal && wards && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setShowIpdModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 font-black text-2xl">&times;</button>
                  <h3 className="font-black text-2xl uppercase tracking-tighter mb-4 border-b pb-4">Select Bed For Admission</h3>
                  <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-sm text-blue-800 font-bold">Patient will be admitted directly to IPD under Dr. {assignedDoctor}.</p>
                  </div>
                  
                  <div className="space-y-6">
                      {(Array.isArray(wards) ? wards : []).map(ward => (
                          <div key={ward.id} className="border rounded-2xl p-4 overflow-hidden shadow-sm">
                              <h4 className="font-black text-lg bg-slate-100 p-2 rounded-xl mb-4">{ward.name}</h4>
                              <div className="grid grid-cols-4 gap-3">
                                  {(Array.isArray(ward.beds) ? ward.beds : []).map(bed => {
                                      const isOccupied = admissions.some(a => a.status === 'active' && a.bedId === bed.id);
                                      return (
                                          <button
                                              key={bed.id}
                                              disabled={isOccupied}
                                              onClick={() => {
                                                  if (onAddAdmission) {
                                                      const id = Date.now().toString();
                                                      const uhid = formData.uhid || (Math.floor(Math.random() * 90000000) + 10000000).toString(); 
                                                      const patient: Patient = { ...formData as Patient, id, uhid };
                                                      
                                                      let finalPatient = patient;
                                                      const existingIdx = patients.findIndex(p => p.uhid === uhid || (p.mobile === patient.mobile && p.name === patient.name));
                                                      
                                                      if (existingIdx >= 0) {
                                                          finalPatient = { ...patients[existingIdx], ...patient, id: patients[existingIdx].id };
                                                      }

                                                      const newAdm: IpdAdmission = {
                                                          id: 'adm-' + Date.now().toString(),
                                                          patientId: finalPatient.id,
                                                          admissionDate: new Date().toISOString(),
                                                          wardId: ward.id,
                                                          bedId: bed.id,
                                                          diagnosis: 'Pending Diagnosis',
                                                          status: 'active',
                                                          primaryDoctor: assignedDoctor,
                                                          dailyCharges: 0,
                                                          roundNotes: [], medications: [], nursingNotes: [], fluidBalance: [], charges: []
                                                      };
                                                      
                                                      const fee = consultants.find(c => c.name === assignedDoctor)?.baseFee || 200;
                                                      const visit: VisitRecord = {
                                                          id: `v-${id}`, patientId: finalPatient.id, date: new Date().toISOString().slice(0, 10),
                                                          visitType: 'new', fees: fee, isApproved: true, caseStatus: 'open',
                                                          vitals, assignedDoctor,
                                                          orders: { id: `o-${id}`, patientId: finalPatient.id, tests: {} as any, status: 'pending', timestamp: Date.now() }
                                                      };
                                                      
                                                      onRegister(finalPatient, visit);
                                                      onAddAdmission(newAdm);
                                                      alert('Patient Registered & Admitted to ' + ward.name + ' - Bed ' + bed.number);
                                                      setShowIpdModal(false);
                                                      setFormData({ name: '', age: '', address: '', mobile: '', type: 'surgery', isPreviouslyRegistered: false, uhid: '' });
                                                  }
                                              }}
                                              className={`p-3 border-2 rounded-xl text-center font-black transition-all ${isOccupied ? 'bg-red-50 border-red-200 text-red-500 opacity-50 cursor-not-allowed' : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-600 hover:text-white hover:shadow-xl'}`}
                                          >
                                              {bed.number}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      ))}
                      {wards.length === 0 && <p className="text-center text-slate-500 italic py-8">No wards available.</p>}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default OPDCounter;
