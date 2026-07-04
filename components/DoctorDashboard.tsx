
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Patient, VisitRecord, LabOrder, SelectedTests, ClinicalTemplate, PregnancyInfo, Vitals, MedicationMasterData, AppPrintSettings, ServicePrices, HormoneReportSelection, PharmacyItem, IpdAdmission, PharmacySale, Consultant } from '../types';
import ReportPreview from './ReportPreview';
import { syncToCloud } from '../services/firebaseService';
import { calculateLabFeesForOrder, DEFAULT_PRICES } from '../services/billingService';
import { translateMedicalText, predictPrescription, extractPrescriptionFromImage, executeAiComplete } from '../services/geminiService';
import { numberToWords } from '../services/numberToWords';

interface DoctorDashboardProps {
  doctorName: string;
  patients: Patient[];
  visits: VisitRecord[];
  labOrders: LabOrder[];
  clinicalTemplates: ClinicalTemplate[];
  medicationMaster?: MedicationMasterData;
  pharmacyInventory?: PharmacyItem[]; // Added for Stock Check
  pharmacySales?: PharmacySale[];
  printSettings?: AppPrintSettings;
  billingRates?: ServicePrices;
  ipdAdmissions?: IpdAdmission[];
  consultants?: Consultant[];
  wards?: import('../types').Ward[];
  onUpdateVisits: (v: VisitRecord[]) => void;
  onUpdatePatients: (p: Patient[]) => void;
  onUpdateTemplates: (t: ClinicalTemplate[]) => void;
  onOrderLab: (o: LabOrder) => void;
  onCancelOrder: (id: string) => void;
  onCallPatient: (name: string) => void;
  onAddAdmission?: (admission: IpdAdmission) => void;
}

const USG_INDICATIONS = [
  "i. To diagnose intra-uterine and/or ectopic pregnancy and confirm viability.",
  "ii. Estimation of gestation age (dating).",
  "iii. Detection of number of fetuses and their chorionicity.",
  "iv. Suspected pregnancy with IUCD in situ or suspected pregnancy following contraceptive failure/ MTP failure.",
  "v. Vaginal bleeding/ leaking.",
  "vi. Follow-up of cases of abortion.",
  "vii. Assessment of cervical canal and diameter of internal os.",
  "viii. Discrepancy between uterine size and period of amenorrhea.",
  "ix. Any suspected adenexal or uterine pathology/abnormality.",
  "x. Detection of chromosomal abnormalities, fetal structural defects and other abnormalities and their follow-up.",
  "xi. To evaluate fetal presentation and position.",
  "xii. Assessment of liquor amnii.",
  "xiii. Pre-term labor / pre-term premature rupture of membranes",
  "xiv. Evaluation of placental position, thickness, grading and abnormalities (placenta praevia, retro placental hemorrhage, abnormal adherence etc.)",
  "xv. Evaluation of umbilical cord- presentation, insertion, nuchal encirclement, number of vessels and presence of true knot.",
  "xvi. Evaluation of previous Caesarean Section scars.",
  "xvii. Evaluation of fetal growth parameters, fetal weight and fetal well being.",
  "xviii. Color flow mapping and duplex Doppler studies.",
  "xix. Ultrasound guided procedures such as medical termination of pregnancy, external cephalic version etc and their follow-up.",
  "xx. Adjunct to diagnostics and therapeutic invasive interventions such as chorionic villus sampling (CVS), amniocenteses, fetal skin biopsy, amnio-infusion, intrauterine infusion, placement of shunts, etc.",
  "xxi. Observation of intra-partum events.",
  "xxii. Medical/surgical conditions complicating pregnancy.",
  "xxiii. Research/scientific studies in recognized institutions"
];

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ 
  doctorName, patients, visits, labOrders, clinicalTemplates, medicationMaster, pharmacyInventory = [], pharmacySales = [], printSettings, billingRates = DEFAULT_PRICES, ipdAdmissions = [], consultants = [], wards = [], onUpdateVisits, onUpdatePatients, onUpdateTemplates, onOrderLab, onCancelOrder, onCallPatient, onAddAdmission
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'queue' | 'edd'>('queue');
  
  // Dashboard Drill-down state
  const [dashboardView, setDashboardView] = useState<'overview' | 'rx_stats' | 'opd_stats' | 'ipd_stats' | 'report_stats'>('overview');
  const [dashSearch, setDashSearch] = useState('');
  const [dashDateStart, setDashDateStart] = useState(new Date().toISOString().slice(0, 10));
  const [dashDateEnd, setDashDateEnd] = useState(new Date().toISOString().slice(0, 10));

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showMobileVitals, setShowMobileVitals] = useState(false);
  const [showMobileQueue, setShowMobileQueue] = useState(false);
  const [activeCenterCol, setActiveCenterCol] = useState<'col1' | 'col2' | 'col3'>('col1');
  const [aiCompleteModalOpen, setAiCompleteModalOpen] = useState(false);
  const [customAiPromptText, setCustomAiPromptText] = useState('');
  const [showReportPreview, setShowReportPreview] = useState<LabOrder | null>(null);
  const [prescriptionMode, setPrescriptionMode] = useState<'digital' | 'manual'>(() => {
    return (localStorage.getItem(`defaultRxMode_${doctorName}`) as 'digital' | 'manual') || 'digital';
  });
  
  const [localComplaints, setLocalComplaints] = useState('');
  const [localVisitOH, setLocalVisitOH] = useState('');
  const [localMH, setLocalMH] = useState('');
  const [localLmp, setLocalLmp] = useState('');
  const [localEdd, setLocalEdd] = useState('');
  const [localPog, setLocalPog] = useState('');
  const [localPulse, setLocalPulse] = useState('');
  const [localBp, setLocalBp] = useState('');
  const [localWeight, setLocalWeight] = useState('');
  const [localSpo2, setLocalSpo2] = useState('');
  const [localHeight, setLocalHeight] = useState('');
  const [localGenNotes, setLocalGenNotes] = useState('');
  const [localPhysExam, setLocalPhysExam] = useState('');
  const [localRx, setLocalRx] = useState('');
  const [lookAheadSuggestions, setLookAheadSuggestions] = useState<{ label: string; text: string; category: 'lab' | 'radiology' | 'vaccine' }[]>([]);
  const [localRemarks, setLocalRemarks] = useState('');
  const [localFollowUpDate, setLocalFollowUpDate] = useState('');
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, string>>({});

  // --- QUICK ADD PATIENT STATE ---
  const [showQuickAddPatientModal, setShowQuickAddPatientModal] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickAge, setQuickAge] = useState('');
  const [quickGender, setQuickGender] = useState<'male' | 'female' | 'other'>('male');
  const [quickMobile, setQuickMobile] = useState('');
  const [quickType, setQuickType] = useState<any>('general');
  const [quickComplaints, setQuickComplaints] = useState('');

  // --- EPISODE STATE ---
  const [localEpisodeId, setLocalEpisodeId] = useState('');
  const [localEpisodeName, setLocalEpisodeName] = useState('');
  const [localCaseStatus, setLocalCaseStatus] = useState<'open' | 'closed'>('open');

  // --- FIELD CUSTOMIZATION STATE ---
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showGlobalTemplatesModal, setShowGlobalTemplatesModal] = useState(false);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`globalTemplates_${doctorName}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const getDefaultFieldsForType = (type: string) => {
    const isObgyn = ['obgyn', 'obstetric', 'gynecology'].includes(type);
    const isObstetric = ['obstetric', 'obgyn'].includes(type);
    const isGynecology = ['gynecology', 'obgyn'].includes(type);
    const isSurgery = type === 'surgery';
    
    return [
      { id: 'complaints', name: 'Complaints', visible: true, label: '1. Complaints', colSpan: 1 },
      { id: 'obstetricHistory', name: 'Obstetric History', visible: isObstetric, label: '2. Obstetric History', colSpan: 1 },
      { id: 'menstrualHistory', name: 'Menstrual History', visible: isObgyn, label: '3. Menstrual History', colSpan: 2 },
      { id: 'generalExamination', name: 'General Examination', visible: true, label: '4. General Examination', colSpan: 1 },
      { id: 'examinationDetails', name: 'Physical Examination', visible: true, label: isSurgery ? '5. Surgical/Pre-Op Exam' : '5. Physical Examination', colSpan: 2 },
      { id: 'prescription', name: 'Prescription (Rx)', visible: true, label: '6. Prescription (Rx)', colSpan: 2 },
      { id: 'remarksFollowUp', name: 'Remarks & Follow Up', visible: true, label: '7. Remarks & Follow Up', colSpan: 1 },
      { id: 'labsOrder', name: 'Labs Order', visible: true, label: 'Labs Order', colSpan: 1 },
      { id: 'radiology', name: 'Radiology', visible: true, label: 'Radiology', colSpan: 1 }
    ];
  };

  const [fieldsConfig, setFieldsConfig] = useState<any[]>(() => {
    return getDefaultFieldsForType('general');
  });

  useEffect(() => {
    if (!selectedPatient) return;
    const pType = selectedPatient.type || 'general';
    const saved = localStorage.getItem(`fieldsConfig_${doctorName}_${pType}`);
    if (saved) {
      try {
        setFieldsConfig(JSON.parse(saved));
      } catch (e) {
        setFieldsConfig(getDefaultFieldsForType(pType));
      }
    } else {
      setFieldsConfig(getDefaultFieldsForType(pType));
    }
  }, [selectedPatient, doctorName]);

  // --- CUSTOM CALCULATIVE FIELDS ---
  const [customCalculativeFields, setCustomCalculativeFields] = useState<any[]>(() => {
    const saved = localStorage.getItem(`customCalculativeFields_${doctorName}`);
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return [
      { name: 'BMI', formula: '[weight] / (([height] / 100) * ([weight] / 100))', result: '' }
    ];
  });

  const evaluateFormula = (formulaStr: string, values: Record<string, number>): string => {
    try {
      let expr = formulaStr;
      for (const [key, val] of Object.entries(values)) {
        expr = expr.replaceAll(`[${key}]`, val.toString());
      }
      if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
        return 'Invalid chars';
      }
      const res = Function(`"use strict"; return (${expr})`)();
      return isNaN(res) || !isFinite(res) ? 'N/A' : Number(res).toFixed(2);
    } catch (e) {
      return 'Err';
    }
  };

  const [showUsgModal, setShowUsgModal] = useState(false);
  const [selectedUsgIndications, setSelectedUsgIndications] = useState<string[]>([]);
  const [showAncModal, setShowAncModal] = useState(false);
  const [showQuickRxModal, setShowQuickRxModal] = useState(false);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutionSource, setSubstitutionSource] = useState<{name: string, generic: string} | null>(null);
  
  // Billing Modal State
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [currentBillVisit, setCurrentBillVisit] = useState<VisitRecord | null>(null);
  const [billItems, setBillItems] = useState<{name: string, price: number}[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);

  const [qRxGroup, setQRxGroup] = useState('');
  const [qRxSelectedDrugs, setQRxSelectedDrugs] = useState<string[]>([]);
  const [qRxStaging, setQRxStaging] = useState<{drug: string, dose: string, freq: string, duration: string, advice: string}[]>([]);
  const [showPastVisitsModal, setShowPastVisitsModal] = useState(false);
  const [showBedSelectionForIpd, setShowBedSelectionForIpd] = useState(false);
  
  const [labSelection, setLabSelection] = useState<SelectedTests>({
    cbc: false, serology: false, urine: false, other: false, 
    widal: false, crp: false, hormone: false, semen: false,
    bloodSugar: false, bloodGroup: false,
    hormoneDetails: {
        tsh: false, ft3: false, ft4: false, t3: false, t4: false,
        fsh: false, lh: false, prolactin: false, amh: false, hba1c: false
    }
  });
  const [queueDate, setQueueDate] = useState(new Date().toISOString().slice(0, 10));
  const [isTranslating, setIsTranslating] = useState(false);

  // Manual Rx Image & OCR & Cropping State
  const [manualRxImage, setManualRxImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [dragStart, setDragStart] = useState<{ x: number, y: number, isResizing: boolean, handle?: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [templateConfig, setTemplateConfig] = useState<{ isOpen: boolean, type: string | null }>({ isOpen: false, type: null });

  const doctorVisits = useMemo(() => visits.filter(v => v.assignedDoctor === doctorName), [visits, doctorName]);
  
  const pendingVisits = useMemo(() => doctorVisits.filter(v => !v.isApproved && v.date === queueDate).map(v => ({
    ...v,
    patient: patients.find(p => p.id === v.patientId)
  })).filter(v => v.patient), [doctorVisits, patients, queueDate]);

  // --- STATS CALCULATION ---
  const dashboardStats = useMemo(() => {
      const myVisits = visits.filter(v => v.assignedDoctor === doctorName);
      const patientsChecked = myVisits.filter(v => v.isApproved).length;
      
      const myAdmissions = ipdAdmissions.filter(a => a.primaryDoctor === doctorName);
      const patientsAdmitted = myAdmissions.length;
      
      const patientsOperated = myAdmissions.filter(a => {
          const p = patients.find(pat => pat.id === a.patientId);
          return p?.type === 'surgery';
      }).length;

      const reportsOrdered = labOrders.filter(o => {
          const patientVisits = myVisits.filter(v => v.patientId === o.patientId);
          return patientVisits.length > 0;
      }).length;

      const drugsPrescribedCount = myVisits.filter(v => v.prescription && v.prescription.trim().length > 0).length;

      return { patientsChecked, patientsAdmitted, patientsOperated, reportsOrdered, drugsPrescribedCount };
  }, [visits, doctorName, ipdAdmissions, patients, labOrders]);

  const resetFilters = () => {
      setDashSearch('');
      setDashDateStart(new Date().toISOString().slice(0, 10));
      setDashDateEnd(new Date().toISOString().slice(0, 10));
  };

  const handlePatientClick = (p: Patient, visit?: VisitRecord) => {
      setSelectedPatient(p);
      setShowOrderModal(true);
      if (visit) {
          // Pre-load logic if needed for viewing old visits, 
          // currently showOrderModal effect loads latest or unapproved visit.
          // To view old visit, logic inside useEffect needs to handle passed visit ID.
          // For now, standard case sheet open.
      }
  };

  // Helper to calculate total collections
  const calculateCollections = () => {
      const opdVisits = doctorVisits.filter(v => v.date >= dashDateStart && v.date <= dashDateEnd && v.paymentStatus === 'paid');
      const ipdActive = ipdAdmissions.filter(a => a.primaryDoctor === doctorName && a.admissionDate >= dashDateStart && a.admissionDate <= dashDateEnd);
      
      let opdTotal = 0;
      let labTotal = 0;
      let usgTotal = 0;
      let ipdTotal = 0;

      opdVisits.forEach(v => {
          if (v.finalBill) {
              v.finalBill.items.forEach(item => {
                  if (item.name.toLowerCase().includes('consultation')) opdTotal += item.price;
                  else if (item.name.toLowerCase().includes('ultrasound')) usgTotal += item.price;
                  else labTotal += item.price; // Assume others are lab
              });
          } else {
              opdTotal += v.fees; // Fallback
          }
      });

      ipdActive.forEach(a => {
          ipdTotal += (a.advanceAmount || 0) + (a.totalBill || 0);
      });

      return { opdTotal, labTotal, usgTotal, ipdTotal, total: opdTotal + labTotal + usgTotal + ipdTotal };
  };

  const renderPrescriptionStats = () => {
      // 1. Filter visits by doctor and date
      const relevantVisits = doctorVisits.filter(v => v.isApproved && v.date >= dashDateStart && v.date <= dashDateEnd && v.prescription);
      
      // 2. Parse prescriptions
      const drugStats: Record<string, { count: number, qtyPrescribed: number }> = {};
      
      relevantVisits.forEach(v => {
          if (!v.prescription) return;
          const lines = v.prescription.split('\n');
          lines.forEach(line => {
              if (line.trim().length === 0) return;
              
              // Basic parsing assuming format "[Drug Name] [Dose] -- [Freq] -- [Duration] Days ([Advice])"
              // Fallback to name extraction if format differs
              // Strategy: Split by ' -- '
              const parts = line.split(' -- ');
              const drugNameFull = parts[0].trim();
              
              // Clean drug name (remove dose if attached at end or assume standard formatting)
              // Just use the first part as key for now
              const key = drugNameFull.toLowerCase();
              
              if (!drugStats[key]) drugStats[key] = { count: 0, qtyPrescribed: 0 };
              drugStats[key].count += 1;

              // Estimate Quantity
              if (parts.length >= 3) {
                  const freq = parts[1].trim().toLowerCase();
                  const durationStr = parts[2].trim();
                  const days = parseInt(durationStr) || 0;
                  
                  let perDay = 1;
                  if (freq.includes('bd')) perDay = 2;
                  else if (freq.includes('tds')) perDay = 3;
                  else if (freq.includes('qid')) perDay = 4;
                  else if (freq.includes('sos') || freq.includes('od') || freq.includes('hs')) perDay = 1;
                  
                  drugStats[key].qtyPrescribed += (perDay * days);
              }
          });
      });

      // 3. Match with Pharmacy Sales (Approximation by name)
      // Filter sales by date
      const relevantSales = pharmacySales.filter(s => s.date.startsWith(dashDateStart) || (s.date >= dashDateStart && s.date <= dashDateEnd));
      const purchasedStats: Record<string, number> = {};
      
      relevantSales.forEach(s => {
          s.items.forEach(item => {
              const key = item.name.toLowerCase();
              // Try to fuzzy match with drugStats keys
              const matchedKey = Object.keys(drugStats).find(k => k.includes(key) || key.includes(k));
              if (matchedKey) {
                  purchasedStats[matchedKey] = (purchasedStats[matchedKey] || 0) + item.qty;
              } else {
                  // Track unprescribed purchases or mismatch
                  purchasedStats[key] = (purchasedStats[key] || 0) + item.qty;
              }
          });
      });

      // Combine
      const rows = Object.keys(drugStats).map(key => ({
          name: key,
          count: drugStats[key].count,
          qtyPrescribed: drugStats[key].qtyPrescribed,
          qtyPurchased: purchasedStats[key] || 0
      })).filter(r => r.name.toLowerCase().includes(dashSearch.toLowerCase()));

      return (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                      <tr><th className="p-4">Drug Name</th><th className="p-4 text-center">Times Prescribed</th><th className="p-4 text-center">Est. Qty Prescribed</th><th className="p-4 text-center">Qty Purchased (Pharmacy)</th></tr>
                  </thead>
                  <tbody className="divide-y">
                      {rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                              <td className="p-4 font-bold capitalize">{r.name}</td>
                              <td className="p-4 text-center">{r.count}</td>
                              <td className="p-4 text-center">{r.qtyPrescribed > 0 ? r.qtyPrescribed : '-'}</td>
                              <td className="p-4 text-center font-black text-blue-600">{r.qtyPurchased}</td>
                          </tr>
                      ))}
                      {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center italic text-slate-400">No prescriptions found.</td></tr>}
                  </tbody>
              </table>
          </div>
      );
  };

  const renderPatientStats = (type: 'opd' | 'ipd') => {
      if (type === 'opd') {
          const list = doctorVisits
              .filter(v => v.isApproved && v.date >= dashDateStart && v.date <= dashDateEnd)
              .map(v => ({ visit: v, patient: patients.find(p => p.id === v.patientId) }))
              .filter(x => x.patient && x.patient.name.toLowerCase().includes(dashSearch.toLowerCase()));

          return (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                          <tr><th className="p-4">Date</th><th className="p-4">Patient Name</th><th className="p-4">Type</th><th className="p-4 text-right">Bill Amount</th><th className="p-4 text-center">Status</th></tr>
                      </thead>
                      <tbody className="divide-y">
                          {list.map(({visit, patient}, i) => (
                              <tr key={i} onClick={() => handlePatientClick(patient!, visit)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                                  <td className="p-4 text-xs font-bold text-slate-500">{visit.date}</td>
                                  <td className="p-4 font-black text-slate-800">{patient!.name} <span className="text-xs font-normal text-slate-400">({patient!.age})</span></td>
                                  <td className="p-4 text-xs uppercase font-bold">{visit.visitType}</td>
                                  <td className="p-4 text-right font-mono">₹{visit.finalBill?.grandTotal || visit.fees}</td>
                                  <td className="p-4 text-center">
                                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${visit.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{visit.paymentStatus || 'Pending'}</span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          );
      } else {
          const list = ipdAdmissions
              .filter(a => a.primaryDoctor === doctorName && a.admissionDate >= dashDateStart && a.admissionDate <= dashDateEnd)
              .map(a => ({ admission: a, patient: patients.find(p => p.id === a.patientId) }))
              .filter(x => x.patient && x.patient.name.toLowerCase().includes(dashSearch.toLowerCase()));

          return (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                          <tr><th className="p-4">Admit Date</th><th className="p-4">Patient Name</th><th className="p-4">Diagnosis</th><th className="p-4 text-right">Bill/Advance</th><th className="p-4 text-center">Status</th></tr>
                      </thead>
                      <tbody className="divide-y">
                          {list.map(({admission, patient}, i) => (
                              <tr key={i} className="hover:bg-purple-50 cursor-pointer transition-colors">
                                  <td className="p-4 text-xs font-bold text-slate-500">{new Date(admission.admissionDate).toLocaleDateString()}</td>
                                  <td className="p-4 font-black text-slate-800">{patient!.name}</td>
                                  <td className="p-4 text-xs font-bold">{admission.diagnosis}</td>
                                  <td className="p-4 text-right font-mono">₹{(admission.totalBill || admission.advanceAmount || 0)}</td>
                                  <td className="p-4 text-center">
                                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${admission.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{admission.status}</span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          );
      }
  };

  const renderReportStats = () => {
      const list = labOrders
          .filter(o => {
              // Check if order belongs to a patient seen by this doctor
              // Simple check: Is the patient currently in the doctor's visit list?
              // Better: Check if the order was created during a visit with this doctor. 
              // We'll approximate by checking if the patient has EVER seen this doctor.
              const patientSeen = doctorVisits.some(v => v.patientId === o.patientId);
              const orderDate = new Date(o.timestamp).toISOString().slice(0, 10);
              return patientSeen && orderDate >= dashDateStart && orderDate <= dashDateEnd;
          })
          .map(o => ({ order: o, patient: patients.find(p => p.id === o.patientId) }))
          .filter(x => x.patient && x.patient.name.toLowerCase().includes(dashSearch.toLowerCase()));

      return (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                      <tr><th className="p-4">Date</th><th className="p-4">Patient Name</th><th className="p-4">Tests</th><th className="p-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y">
                      {list.map(({order, patient}, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                              <td className="p-4 text-xs font-bold text-slate-500">{new Date(order.timestamp).toLocaleDateString()}</td>
                              <td className="p-4 font-black text-slate-800">{patient!.name}</td>
                              <td className="p-4 text-xs font-bold text-slate-600">
                                  {Object.keys(order.tests).filter(k => k!=='hormoneDetails' && (order.tests as any)[k]).join(', ')}
                                  {order.ultrasound && ' USG'}
                              </td>
                              <td className="p-4 text-right space-x-2">
                                  {order.status === 'completed' ? (
                                      <>
                                          <button onClick={() => setShowReportPreview(order)} className="text-blue-600 font-black text-xs hover:underline">View</button>
                                          <button onClick={() => { setShowReportPreview(order); setTimeout(() => window.print(), 500); }} className="text-purple-600 font-black text-xs hover:underline">Print</button>
                                      </>
                                  ) : (
                                      <span className="text-amber-500 text-[10px] font-bold uppercase">Pending</span>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      );
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setManualRxImage(null);
      setCroppedImage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Could not access camera. Please check permissions or upload an image.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setManualRxImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setManualRxImage(event.target.result as string);
          setCroppedImage(null);
          setCropBox({ x: 10, y: 10, w: 80, h: 80 });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCrop = () => {
    if (imageRef.current && manualRxImage) {
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      
      const cropX = (cropBox.x / 100) * img.naturalWidth;
      const cropY = (cropBox.y / 100) * img.naturalHeight;
      const cropW = (cropBox.w / 100) * img.naturalWidth;
      const cropH = (cropBox.h / 100) * img.naturalHeight;

      canvas.width = cropW;
      canvas.height = cropH;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          img,
          cropX, cropY, cropW, cropH,
          0, 0, cropW, cropH
        );
        const croppedDataUrl = canvas.toDataURL('image/jpeg');
        setCroppedImage(croppedDataUrl);
      }
    }
  };

  const runOcr = async () => {
    const imgToProcess = croppedImage || manualRxImage;
    if (!imgToProcess) return;
    setIsOcrLoading(true);
    try {
      const base64Data = imgToProcess.split(',')[1];
      const mimeType = imgToProcess.split(';')[0].split(':')[1];
      const ocrResult = await extractPrescriptionFromImage(base64Data, mimeType);
      
      if (ocrResult.complaints) setLocalComplaints(prev => prev ? `${prev}\n${ocrResult.complaints}` : ocrResult.complaints);
      if (ocrResult.bp) setLocalBp(ocrResult.bp);
      if (ocrResult.pulse) setLocalPulse(ocrResult.pulse);
      if (ocrResult.weight) setLocalWeight(ocrResult.weight);
      if (ocrResult.spo2) setLocalSpo2(ocrResult.spo2);
      if (ocrResult.prescription) setLocalRx(prev => prev ? `${prev}\n${ocrResult.prescription}` : ocrResult.prescription);
      if (ocrResult.remarks) setLocalRemarks(prev => prev ? `${prev}\n${ocrResult.remarks}` : ocrResult.remarks);
      
      alert("AI Prescription OCR Complete! Form fields auto-mapped successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to extract data: " + (err.message || err));
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleCropMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize') => {
    e.preventDefault();
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      isResizing: type === 'resize',
      handle: type
    });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !manualRxImage) return;
    const container = e.currentTarget.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / container.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / container.height) * 100;

    setDragStart(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);

    setCropBox(prev => {
      let newX = prev.x;
      let newY = prev.y;
      let newW = prev.w;
      let newH = prev.h;

      if (dragStart.isResizing) {
        newW = Math.max(10, Math.min(100 - prev.x, prev.w + deltaX));
        newH = Math.max(10, Math.min(100 - prev.y, prev.h + deltaY));
      } else {
        newX = Math.max(0, Math.min(100 - prev.w, prev.x + deltaX));
        newY = Math.max(0, Math.min(100 - prev.h, prev.y + deltaY));
      }

      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  const handleCropMouseUp = () => {
    setDragStart(null);
  };

  useEffect(() => {
    if (showOrderModal && selectedPatient) {
      const reversedVisits = [...visits].reverse();
      const activeVisit = reversedVisits.find(v => v.patientId === selectedPatient.id && !v.isApproved) 
                        || reversedVisits.find(v => v.patientId === selectedPatient.id && v.isApproved);
      
      setLocalComplaints(activeVisit?.complaints || '');
      setLocalVisitOH(activeVisit?.visitObstetricHistory || selectedPatient.obstetricHistory || '');
      setLocalMH(activeVisit?.menstrualHistory || '');
      setLocalLmp(activeVisit?.visitLmp || selectedPatient.pregnancyInfo?.lmp || '');
      setLocalEdd(activeVisit?.visitEdd || selectedPatient.pregnancyInfo?.edd || '');
      
      let calculatedPog = activeVisit?.visitPog || selectedPatient.pregnancyInfo?.pog || '';
      const currentLmp = activeVisit?.visitLmp || selectedPatient.pregnancyInfo?.lmp;
      if (!activeVisit?.visitPog && currentLmp) {
         const diff = new Date().getTime() - new Date(currentLmp).getTime();
         const days = Math.floor(diff / (1000 * 60 * 60 * 24));
         calculatedPog = `${Math.floor(days / 7)}w ${days % 7}d`;
      }
      setLocalPog(calculatedPog);
      setLocalPulse(activeVisit?.vitals?.pulse || '');
      setLocalBp(activeVisit?.vitals?.bp || '');
      setLocalWeight(activeVisit?.vitals?.weight || '');
      setLocalSpo2(activeVisit?.vitals?.spo2 || '');
      setLocalHeight(activeVisit?.vitals?.height || '');
      setLocalEpisodeId(activeVisit?.episodeId || '');
      setLocalEpisodeName(activeVisit?.episodeName || '');
      setLocalCaseStatus(activeVisit?.caseStatus || 'open');
      setLocalGenNotes(activeVisit?.generalExamination || '');
      setLocalPhysExam(activeVisit?.examinationDetails || '');
      setLocalRx(activeVisit?.prescription || '');
      setLocalRemarks(activeVisit?.remarks || '');
      setLocalFollowUpDate(activeVisit?.followUpDate || '');
      setLocalCustomFields(activeVisit?.customFields || {});
      
      setLabSelection({
        cbc: false, serology: false, urine: false, other: false, 
        widal: false, crp: false, hormone: false, semen: false,
        bloodSugar: false, bloodGroup: false,
        hormoneDetails: {
            tsh: false, ft3: false, ft4: false, t3: false, t4: false,
            fsh: false, lh: false, prolactin: false, amh: false, hba1c: false
        }
      });
    }
  }, [showOrderModal, selectedPatient, visits]);

  // Helper to check stock status - returns available quantity
  const getStockLevel = (drugName: string) => {
      const item = pharmacyInventory.find(i => i.name.toLowerCase() === drugName.toLowerCase());
      return item ? item.quantity : 0;
  };

  const getAlternatives = (drugName: string) => {
      const original = pharmacyInventory.find(i => i.name.toLowerCase() === drugName.toLowerCase());
      if(!original || !original.genericName) return [];
      
      // Find other items with matching generic name that have stock
      return pharmacyInventory.filter(i => 
          i.genericName?.toLowerCase() === original.genericName?.toLowerCase() && 
          i.id !== original.id &&
          i.quantity > 0
      );
  };

  useEffect(() => {
    if (!localPog) {
      setLookAheadSuggestions([]);
      return;
    }
    const match = localPog.match(/\d+/);
    if (!match) {
      setLookAheadSuggestions([]);
      return;
    }
    const weeks = parseInt(match[0], 10);
    if (isNaN(weeks)) {
      setLookAheadSuggestions([]);
      return;
    }

    const suggestions: { label: string; text: string; category: 'lab' | 'radiology' | 'vaccine' }[] = [];

    if (weeks >= 6 && weeks <= 12) {
        suggestions.push({ label: "🔬 Initial ANC Labs (CBC, Ur, Gr, TSH)", text: "Initial ANC Labs (CBC, Urine R/E, Blood Grouping, TSH)", category: 'lab' });
        suggestions.push({ label: "🔍 NT/NB Scan (11w-13w)", text: "Ultrasonography (USG): NT/NB Scan", category: 'radiology' });
    }
    if (weeks >= 13 && weeks <= 20) {
        suggestions.push({ label: "🔍 Anomaly Scan (18w-22w)", text: "Ultrasonography (USG): Target Anomaly Scan", category: 'radiology' });
    }
    if (weeks >= 20 && weeks <= 26) {
        suggestions.push({ label: "🔬 Oral Glucose Test (OGTT at 24w)", text: "Oral Glucose Tolerance Test (OGTT)", category: 'lab' });
        suggestions.push({ label: "💉 TT/Td Vaccine (1st/2nd dose)", text: "Inj Td (Tetanus & adult Diphtheria) vaccine", category: 'vaccine' });
    }
    if (weeks >= 26 && weeks <= 32) {
        suggestions.push({ label: "🔍 Growth Scan (28w-32w)", text: "Ultrasonography (USG): Obstetric Growth Scan with Doppler", category: 'radiology' });
        suggestions.push({ label: "💉 TDAP Vaccine (28w-32w)", text: "Inj TDAP (Tetanus, Diphtheria, Pertussis) vaccine", category: 'vaccine' });
        suggestions.push({ label: "🔬 Repeat CBC & Urine R/E", text: "Complete Blood Count (CBC), Urine R/E", category: 'lab' });
    }
    if (weeks >= 32 && weeks <= 38) {
        suggestions.push({ label: "🔬 GBS Screening (35w-37w)", text: "Vaginal/Rectal swab for Group B Streptococcus (GBS) screening", category: 'lab' });
        suggestions.push({ label: "🔍 Obstetric Color Doppler", text: "Ultrasonography (USG): Obstetric Color Doppler", category: 'radiology' });
    }

    setLookAheadSuggestions(suggestions);
  }, [localPog]);

  const handleDrugClick = (drugName: string) => {
      const stock = getStockLevel(drugName);
      
      if (stock > 0) {
          // Normal Toggle behavior
          toggleQRxDrug(drugName);
      } else {
          // Out of Stock Logic
          const originalItem = pharmacyInventory.find(i => i.name.toLowerCase() === drugName.toLowerCase());
          setSubstitutionSource({ name: drugName, generic: originalItem?.genericName || '' });
          setShowSubstitutionModal(true);
      }
  };

  const handleSubstitute = (replacementName: string) => {
      toggleQRxDrug(replacementName);
      setShowSubstitutionModal(false);
      setSubstitutionSource(null);
  };

  const handleForceAdd = () => {
      if (substitutionSource) {
          toggleQRxDrug(substitutionSource.name);
          setShowSubstitutionModal(false);
          setSubstitutionSource(null);
      }
  };

    const handleAiComplete = async (customPrompt?: string) => {
    if (!selectedPatient) return;
    setIsAiLoading(true);
    try {
        const currentFields = {
            complaints: localComplaints,
            menstrualHistory: localMH,
            obstetricHistory: localVisitOH,
            genNotes: localGenNotes,
            physExam: localPhysExam,
            rx: localRx,
            lmp: localLmp,
            edd: localEdd,
            pog: localPog
        };

        const prediction = await executeAiComplete(
            'opd',
            currentFields,
            customPrompt
        );

        if (prediction.complaints) setLocalComplaints(prediction.complaints);
        if (prediction.menstrualHistory) setLocalMH(prediction.menstrualHistory);
        if (prediction.obstetricHistory) setLocalVisitOH(prediction.obstetricHistory);
        if (prediction.genNotes) setLocalGenNotes(prediction.genNotes);
        if (prediction.physExam) setLocalPhysExam(prediction.physExam);
        if (prediction.rx) setLocalRx(prediction.rx);
    } catch (err: any) {
        console.error("AI Complete Failed", err);
        if (err.message?.includes('503') || err.message?.includes('high demand') || err.status === 'UNAVAILABLE') {
            alert("The AI model is currently experiencing high demand. Please try again in a few moments.");
        } else {
            alert("Failed to get AI predictions. Please try again.");
        }
    } finally {
        setIsAiLoading(false);
    }
  };

  // ... (Previous Helper Functions: handleSaveCaseData, handleApprove, Billing, Print, Calculations) ...
  const handleSaveCaseData = (silent = false) => {
    if (!selectedPatient) return;
    const pregInfo: PregnancyInfo | undefined = localLmp ? { lmp: localLmp, edd: localEdd, pog: localPog } : selectedPatient.pregnancyInfo;
    const updatedPatients = patients.map(p => p.id === selectedPatient.id ? { ...p, obstetricHistory: localVisitOH, pregnancyInfo: pregInfo } : p);
    onUpdatePatients(updatedPatients);

    const reversedVisits = [...visits].reverse();
    const activeVisit = reversedVisits.find(v => v.patientId === selectedPatient.id && !v.isApproved)
                      || reversedVisits.find(v => v.patientId === selectedPatient.id && v.isApproved);
    
    if (activeVisit) {
      const updatedVisits = visits.map(v => v.id === activeVisit.id ? { 
        ...v, 
        complaints: localComplaints,
        visitObstetricHistory: localVisitOH,
        menstrualHistory: localMH,
        visitLmp: localLmp,
        visitEdd: localEdd,
        visitPog: localPog,
        vitals: { ...v.vitals, pulse: localPulse, bp: localBp, weight: localWeight, spo2: localSpo2, height: localHeight } as Vitals,
        generalExamination: localGenNotes,
        examinationDetails: localPhysExam, 
        prescription: localRx,
        remarks: localRemarks,
        followUpDate: localFollowUpDate,
        episodeId: localEpisodeId,
        episodeName: localEpisodeName,
        caseStatus: localCaseStatus,
        customFields: localCustomFields
      } : v);
      onUpdateVisits(updatedVisits);
    }
    if(!silent) alert("Case record saved.");
  };

  const handleApprove = (visitId: string) => {
    if (!selectedPatient) return;
    handleSaveCaseData(true);
    const updatedVisits = visits.map(v => v.id === visitId ? { ...v, isApproved: true, callingStatus: 'waiting' } as VisitRecord : v);
    onUpdateVisits(updatedVisits);
    setShowOrderModal(false);
  };

  const handleQuickAddPatient = () => {
    if (!quickName.trim()) {
      alert("Please enter patient name.");
      return;
    }
    if (!quickAge.trim()) {
      alert("Please enter patient age.");
      return;
    }


    const patientId = 'pat-' + Date.now();
    const newPatient: Patient = {
      id: patientId,
      uhid: 'UHID-' + Date.now().toString().slice(-6),
      name: quickName,
      age: quickAge,
      address: '',
      mobile: quickMobile,
      type: quickType,
      registeredDate: new Date().toISOString().slice(0, 10),
      isPreviouslyRegistered: false,
      customFields: { gender: quickGender }
    };

    const newVisit: VisitRecord = {
      id: 'visit-' + Date.now(),
      patientId: patientId,
      date: queueDate,
      visitType: 'new',
      fees: 0,
      orders: { id: `o-${Date.now()}`, patientId: patientId, tests: {} as any, status: 'pending', timestamp: Date.now() },
      isApproved: false,
      callingStatus: 'waiting',
      assignedDoctor: doctorName,
      complaints: quickComplaints
    };

    onUpdatePatients([...patients, newPatient]);
    onUpdateVisits([...visits, newVisit]);

    // Reset fields
    setQuickName('');
    setQuickAge('');
    setQuickGender('male');
    setQuickMobile('');
    setQuickType('general');
    setQuickComplaints('');
    setShowQuickAddPatientModal(false);
    
    alert(`Patient ${newPatient.name} added directly to Queue for ${queueDate}.`);
  };

  const handleOpenBilling = () => {
      const activeVisit = visits.find(v => v.patientId === selectedPatient?.id && (!v.isApproved || v.date === queueDate));
      if (!activeVisit) {
          alert("No active visit found for billing.");
          return;
      }

      setCurrentBillVisit(activeVisit);
      
      const items = [{ name: `Consultation (${activeVisit.visitType})`, price: activeVisit.fees }];
      const orders = labOrders.filter(o => o.patientId === activeVisit.patientId && new Date(o.timestamp).toISOString().slice(0,10) === activeVisit.date); 
      
      orders.forEach(o => {
          if (o.ultrasound) items.push({ name: 'Ultrasound', price: billingRates.ultrasound?.price || 800 });
          if (o.tests) {
              Object.entries(o.tests).forEach(([k, v]) => {
                  if (k === 'hormone' && o.tests.hormoneDetails) {
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
      setShowBillingModal(true);
  };

  const handleFinalizeBill = (method: 'cash' | 'upi') => {
      if (!currentBillVisit) return;
      const subTotal = billItems.reduce((acc, item) => acc + item.price, 0);
      const grandTotal = subTotal - billDiscount;
      const billNo = `B-${Date.now().toString().slice(-6)}`;
      const finalBill = {
          billNumber: billNo, items: billItems, subTotal, discount: billDiscount, grandTotal,
          collectedBy: doctorName, paymentMethod: method, date: new Date().toISOString()
      };
      const updated = visits.map(v => v.id === currentBillVisit.id ? { 
          ...v, paymentStatus: 'paid', paymentMethod: method, collectedBy: doctorName, finalBill: finalBill
      } as VisitRecord : v);
      onUpdateVisits(updated);
      setShowBillingModal(false);
      setCurrentBillVisit(null);
      alert(`Payment of ₹${grandTotal} Collected! Bill #${billNo}`);
  };

  const handlePrintBill = (visit: VisitRecord) => {
    const patient = patients.find(p => p.id === visit.patientId);
    if (!patient) return;
    const billItemsToPrint = visit.finalBill?.items || [{ name: 'Consultation', price: visit.fees }];
    const total = visit.finalBill?.grandTotal || visit.fees;
    const billNo = visit.finalBill?.billNumber || 'DRAFT';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const rows = billItemsToPrint.map(item => `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.price.toFixed(2)}</td></tr>`).join('');
    const layout = printSettings?.bill || { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, headerHeight: 70, footerHeight: 10 };
    printWindow.document.write(`<html><head><title>Hospital Bill</title><style>body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding-top: ${layout.marginTop}mm; padding-bottom: ${layout.marginBottom}mm; padding-left: ${layout.marginLeft}mm; padding-right: ${layout.marginRight}mm;} .header-space { height: ${layout.headerHeight}mm; } .container { width: 100%; } .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; } .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; } .header p { margin: 5px 0 0; font-size: 14px; } .info { display: flex; justify-content: space-between; margin-bottom: 20px; } .info div { line-height: 1.6; font-size: 14px; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } th { text-align: left; padding: 10px; border-bottom: 2px solid #333; font-size: 12px; text-transform: uppercase; } .total-row td { border-top: 2px solid #333; font-weight: bold; font-size: 16px; color: #000; padding: 10px; } .words { font-style: italic; font-size: 13px; margin-bottom: 40px; } .signatures { display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; font-weight: bold; } .signatures div { border-top: 1px solid #333; padding-top: 5px; width: 40%; text-align: center; } @media print { body { padding: 0; padding-top: ${layout.marginTop}mm; padding-left: ${layout.marginLeft}mm; } @page { margin: 0; } }</style></head><body><div class="header-space"></div><div class="container"><div class="header"><h1>J J HOSPITAL DONDAICHA</h1><p>Consultant: ${visit.assignedDoctor}</p></div><div class="info"><div><strong>Patient Details:</strong><br>Name: ${patient.name}<br>UHID: ${patient.uhid || 'N/A'}<br>Age: ${patient.age || '-'}</div><div style="text-align: right;"><strong>Bill Details:</strong><br>Bill No: ${billNo}<br>Date: ${visit.date}<br>Time: ${new Date().toLocaleTimeString()}</div></div><table><thead><tr><th>Description</th><th style="text-align: right;">Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td>Grand Total</td><td style="text-align: right;">₹${total.toFixed(2)}</td></tr></tfoot></table><div class="words">Amount in Words: Rupees ${numberToWords(Math.floor(total))} Only</div><div class="signatures"><div>Patient Signature</div><div>Authorized Signatory</div></div></div><script>window.onload = () => { window.print(); window.close(); }</script></body></html>`);
    printWindow.document.close();
  };

  const calculateEdd = (lmpDateStr: string) => {
    if (!lmpDateStr) return;
    const lmp = new Date(lmpDateStr);
    const edd = new Date(lmp);
    edd.setDate(edd.getDate() + 280);
    setLocalEdd(edd.toISOString().split('T')[0]);
    const today = new Date();
    const diff = today.getTime() - lmp.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const remDays = days % 7;
    setLocalPog(`${weeks}w ${remDays}d`);
  };

  const handlePrintPrescription = () => {
    if (!selectedPatient) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const mhParts = [];
    if (localLmp) mhParts.push(`LMP: ${localLmp}`);
    if (localEdd) mhParts.push(`EDD: ${localEdd}`);
    if (localPog) mhParts.push(`POG: ${localPog}`);
    const mhText = (localMH ? localMH + ' ' : '') + (mhParts.length > 0 ? `(${mhParts.join(' | ')})` : '');
    const genExamParts = [];
    if (localPulse) genExamParts.push(`Puls: ${localPulse}`);
    if (localBp) genExamParts.push(`BP: ${localBp}`);
    if (localWeight) genExamParts.push(`Wt: ${localWeight}kg`);
    if (localSpo2) genExamParts.push(`SpO2: ${localSpo2}%`);
    const genExamText = (localGenNotes ? localGenNotes + ' ' : '') + (genExamParts.length > 0 ? `[${genExamParts.join(', ')}]` : '');
    
    // Dynamic doctor lookup
    const docObj = consultants.find(c => c.name === doctorName);
    const selectedDoctor = { qualifications: docObj?.qualifications || '', specialty: docObj?.specialty || '' };

    let contentHtml = `
      <div class="line-item flex flex-wrap gap-4 border border-slate-200 rounded-xl p-3 bg-slate-50/50 mb-6 text-slate-700" style="font-size: 12px;">
        ${selectedPatient.name ? `<span style="margin-right: 16px;"><strong>PATIENT NAME:</strong> ${selectedPatient.name.toUpperCase()}</span>` : ''}
        ${selectedPatient.age ? `<span style="margin-right: 16px;"><strong>AGE/SEX:</strong> ${selectedPatient.age} ${selectedPatient.customFields?.gender ? '/ ' + selectedPatient.customFields.gender.toUpperCase() : ''}</span>` : ''}
        ${selectedPatient.mobile ? `<span style="margin-right: 16px;"><strong>CONTACT:</strong> ${selectedPatient.mobile}</span>` : ''}
        ${selectedPatient.uhid ? `<span class="flex-grow text-right"><strong>UHID:</strong> ${selectedPatient.uhid}</span>` : ''}
      </div>
    `;

    fieldsConfig.forEach(field => {
      if (!field.visible) return;

      if (field.id === 'complaints' && localComplaints.trim()) {
        contentHtml += `
          <div class="paragraph-item text-left mb-4">
            <div class="font-black text-[10px] uppercase tracking-wider text-slate-400 mb-1">${field.label}</div>
            <div class="whitespace-pre-wrap pl-2 leading-relaxed text-slate-800" style="font-size: 13px;">${localComplaints}</div>
          </div>
        `;
      } else if (field.id === 'obstetricHistory' && localVisitOH.trim()) {
        contentHtml += `
          <div class="line-item text-left mb-3">
            <span class="font-black text-[10px] uppercase tracking-wider text-slate-400 mr-2">${field.label}:</span>
            <span class="text-slate-800 font-bold" style="font-size: 13px;">${localVisitOH}</span>
          </div>
        `;
      } else if (field.id === 'menstrualHistory' && mhText.trim()) {
        contentHtml += `
          <div class="paragraph-item text-left mb-4">
            <div class="font-black text-[10px] uppercase tracking-wider text-slate-400 mb-1">${field.label}</div>
            <div class="whitespace-pre-wrap pl-2 leading-relaxed text-slate-800" style="font-size: 13px;">${mhText}</div>
          </div>
        `;
      } else if (field.id === 'generalExamination' && genExamText.trim()) {
        contentHtml += `
          <div class="line-item text-left mb-3">
            <span class="font-black text-[10px] uppercase tracking-wider text-slate-400 mr-2">${field.label}:</span>
            <span class="text-slate-800 font-bold" style="font-size: 13px;">${genExamText}</span>
          </div>
        `;
      } else if (field.id === 'examinationDetails' && localPhysExam.trim()) {
        contentHtml += `
          <div class="paragraph-item text-left mb-4">
            <div class="font-black text-[10px] uppercase tracking-wider text-slate-400 mb-1">${field.label}</div>
            <div class="whitespace-pre-wrap pl-2 leading-relaxed text-slate-800" style="font-size: 13px;">${localPhysExam}</div>
          </div>
        `;
      } else if (field.id === 'prescription' && localRx.trim()) {
        contentHtml += `
          <div class="mt-6 border-t border-slate-100 pt-4 text-left">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-2xl font-serif font-black text-blue-600">Rx</span>
              <div class="h-[1px] bg-blue-100 flex-grow"></div>
            </div>
            <div class="whitespace-pre-wrap text-[15px] font-black leading-loose pl-3 text-slate-900">${localRx}</div>
          </div>
        `;
      } else if (field.id === 'remarksFollowUp' && (localRemarks.trim() || localFollowUpDate)) {
        contentHtml += `
          <div class="mt-6 border-t border-slate-100 pt-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-left">
            ${localRemarks.trim() ? `<div class="mb-2"><span class="font-black text-[10px] uppercase tracking-wider text-slate-400">Remarks:</span> <span class="text-slate-800 ml-2 font-bold" style="font-size: 12px;">${localRemarks}</span></div>` : ''}
            ${localFollowUpDate ? `<div><span class="font-black text-[10px] uppercase tracking-wider text-slate-400">Follow-up Date:</span> <span class="text-blue-600 ml-2 font-black" style="font-size: 12px;">${new Date(localFollowUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>` : ''}
          </div>
        `;
      } else if (field.id.startsWith('custom_') && localCustomFields[field.id]?.trim()) {
        contentHtml += `
          <div class="paragraph-item text-left mb-4">
            <div class="font-black text-[10px] uppercase tracking-wider text-slate-400 mb-1">${field.label}</div>
            <div class="whitespace-pre-wrap pl-2 leading-relaxed text-slate-800" style="font-size: 13px;">${localCustomFields[field.id]}</div>
          </div>
        `;
      }
    });

    const layout = printSettings?.prescription || { marginTop: 60, marginBottom: 20, marginLeft: 20, marginRight: 20, headerHeight: 0, footerHeight: 20 };
    printWindow.document.write(`<html><head><title>Prescription - ${selectedPatient.name}</title><script src="https://cdn.tailwindcss.com"></script><style>@page { size: A4; margin: 0; } body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding-top: ${layout.marginTop}mm; padding-bottom: ${layout.marginBottom}mm; padding-left: ${layout.marginLeft}mm; padding-right: ${layout.marginRight}mm; background: white; color: black; min-height: 297mm; position: relative; box-sizing: border-box; } .line-item { margin-bottom: 8px; font-size: 14px; } .paragraph-item { margin-bottom: 16px; font-size: 14px; } .footer { position: absolute; bottom: ${layout.marginBottom}mm; right: ${layout.marginRight}mm; text-align: right; } </style></head><body><div style="height: ${layout.headerHeight}mm"></div><div class="max-w-[190mm] mx-auto">${contentHtml}</div><div class="footer"><div class="h-16 w-52 border-b border-slate-300 mb-2 ml-auto"></div><p class="font-black uppercase text-sm">${doctorName}</p><p class="text-[11px] font-bold text-slate-500 uppercase tracking-tight">${selectedDoctor.qualifications}</p><p class="text-[11px] font-bold text-slate-500 uppercase tracking-tight">${selectedDoctor.specialty}</p></div><script>window.onload = () => { window.print(); window.close(); }</script></body></html>`);
    printWindow.document.close();
  };

  const handlePrintUsgReferral = () => {
    if (!selectedPatient) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const mhParts = [];
    if (localLmp) mhParts.push(`LMP: ${localLmp}`);
    if (localEdd) mhParts.push(`EDD: ${localEdd}`);
    if (localPog) mhParts.push(`POG: ${localPog}`);
    const mhText = (localMH ? localMH + ' ' : '') + (mhParts.length > 0 ? `(${mhParts.join(' | ')})` : '');
    const indicationsHtml = selectedUsgIndications.map(ind => `<li class="mb-2">${ind}</li>`).join('');
    printWindow.document.write(`<html><head><title>USG OBS Referral - ${selectedPatient.name}</title><script src="https://cdn.tailwindcss.com"></script><style>@page { size: A4; margin: 0; } body { font-family: 'Inter', sans-serif; padding: 40px; padding-top: 60mm; background: white; color: black; }</style></head><body class="text-slate-900"><div class="border-b-2 border-slate-900 pb-4 mb-8"><h1 class="text-2xl font-black uppercase tracking-tighter">USG OBS Referral Slip</h1><p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Obstetrics & Gynecology Department</p></div><div class="space-y-6"><div class="grid grid-cols-2 gap-8 bg-slate-50 p-6 rounded-2xl border border-slate-200"><div class="space-y-2"><p class="text-[10px] font-black text-slate-400 uppercase">Referred By Doctor</p><p class="font-black text-blue-700 text-lg">${doctorName}</p></div><div class="text-right"><p class="text-[10px] font-black text-slate-400 uppercase">Date</p><p class="font-bold text-slate-900">${new Date().toLocaleDateString('en-IN')}</p></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-b pb-6"><div class="space-y-1"><p class="text-[10px] font-black text-slate-400 uppercase">Name of Patient</p><p class="font-bold text-lg">${selectedPatient.name}</p></div><div class="space-y-1"><p class="text-[10px] font-black text-slate-400 uppercase">Age</p><p class="font-bold">${selectedPatient.age}</p></div><div class="space-y-1"><p class="text-[10px] font-black text-slate-400 uppercase">Address</p><p class="font-bold">${selectedPatient.address || 'Not Provided'}</p></div><div class="space-y-1"><p class="text-[10px] font-black text-slate-400 uppercase">Mobile Number</p><p class="font-bold">${selectedPatient.mobile}</p></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="bg-slate-50 p-4 rounded-xl border border-slate-200"><h3 class="text-[10px] font-black text-slate-400 uppercase mb-2">Menstrual History</h3><p class="text-sm font-medium whitespace-pre-wrap">${mhText || 'N/A'}</p></div><div class="bg-slate-50 p-4 rounded-xl border border-slate-200"><h3 class="text-[10px] font-black text-slate-400 uppercase mb-2">Obstetric History</h3><p class="text-sm font-medium whitespace-pre-wrap">${localVisitOH || 'N/A'}</p></div></div><div class="mt-8"><h3 class="text-[11px] font-black text-slate-900 uppercase border-l-4 border-blue-600 pl-3 mb-4 tracking-widest">Indication for Sonography (OBS)</h3><ul class="list-disc pl-8 text-sm font-medium text-slate-800 leading-relaxed">${indicationsHtml || '<li>Routine obstetric examination</li>'}</ul></div></div><div class="mt-24 border-t-2 border-slate-100 pt-10 flex justify-between items-end"><div class="text-[9px] font-bold text-slate-400 uppercase italic">* Referral generated for Diagnostic Ultrasound.<br>* Please carry all previous reports.</div><div class="text-center"><div class="h-14 w-40 border-b border-slate-300 mb-2"></div><p class="font-black uppercase text-xs text-slate-900">${doctorName}</p><p class="text-[9px] font-bold text-slate-400 uppercase">Consultant Signature</p></div></div><script>window.onload = () => { window.print(); window.close(); }</script></body></html>`);
    printWindow.document.close();
    setShowUsgModal(false);
    setSelectedUsgIndications([]);
  };

  // ... (Rest of component remains unchanged)
  const handleToggleIndication = (ind: string) => {
    setSelectedUsgIndications(prev => 
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    );
  };

  const handleSaveTemplate = (category: string, content: string) => {
    if (!content.trim()) return;
    const title = prompt("Enter a title for this template:", "New Template");
    if (!title) return;
    onUpdateTemplates([...clinicalTemplates, { id: Date.now().toString(), title, content, category: category as any }]);
    alert("Template saved!");
  };

  const useTemplate = (t: ClinicalTemplate) => {
    const setters: Record<string, Function> = {
      complaints: setLocalComplaints,
      oh: setLocalVisitOH,
      mh: setLocalMH,
      gen_exam: setLocalGenNotes,
      phys_exam: setLocalPhysExam,
      prescription: setLocalRx,
      remarks: setLocalRemarks
    };
    const setter = setters[t.category];
    if (setter) {
      setter((prev: string) => prev ? prev + '\n' + t.content : t.content);
    } else if (t.category.startsWith('custom_')) {
      setLocalCustomFields(prev => ({
        ...prev,
        [t.category]: prev[t.category] ? prev[t.category] + '\n' + t.content : t.content
      }));
    }
    setTemplateConfig({ isOpen: false, type: null });
  };

  const handleSaveGlobalTemplate = () => {
    const title = prompt("Enter a title for this Case Preset:", "Normal Follow-up");
    if (!title) return;

    const customFieldsConfig = fieldsConfig.filter(f => f.id.startsWith('custom_'));
    const templateObj = {
      id: `gt-${Date.now()}`,
      title,
      complaints: localComplaints,
      visitObstetricHistory: localVisitOH,
      menstrualHistory: localMH,
      generalExamination: localGenNotes,
      examinationDetails: localPhysExam,
      prescription: localRx,
      remarks: localRemarks,
      customFieldsConfig,
      customFieldsValues: localCustomFields
    };

    const updated = [...globalTemplates, templateObj];
    setGlobalTemplates(updated);
    localStorage.setItem(`globalTemplates_${doctorName}`, JSON.stringify(updated));
    alert("Case Preset template saved successfully!");
  };

  const handleLoadGlobalTemplate = () => {
    setShowGlobalTemplatesModal(true);
  };

  const applyGlobalTemplate = (gt: any) => {
    if (gt.complaints !== undefined) setLocalComplaints(gt.complaints);
    if (gt.visitObstetricHistory !== undefined) setLocalVisitOH(gt.visitObstetricHistory);
    if (gt.menstrualHistory !== undefined) setLocalMH(gt.menstrualHistory);
    if (gt.generalExamination !== undefined) setLocalGenNotes(gt.generalExamination);
    if (gt.examinationDetails !== undefined) setLocalPhysExam(gt.examinationDetails);
    if (gt.prescription !== undefined) setLocalRx(gt.prescription);
    if (gt.remarks !== undefined) setLocalRemarks(gt.remarks);

    // Dynamic field creation:
    // If template has custom fields config, import them into doctor's active fieldsConfig
    if (gt.customFieldsConfig && Array.isArray(gt.customFieldsConfig)) {
      let currentFields = [...fieldsConfig];
      let fieldsChanged = false;

      gt.customFieldsConfig.forEach((field: any) => {
        const exists = currentFields.some(f => f.id === field.id);
        if (!exists) {
          const labsIndex = currentFields.findIndex(f => f.id === 'labsOrder');
          if (labsIndex !== -1) {
            currentFields.splice(labsIndex, 0, field);
          } else {
            currentFields.push(field);
          }
          fieldsChanged = true;
        } else {
          currentFields = currentFields.map(f => f.id === field.id ? { ...f, visible: true } : f);
          fieldsChanged = true;
        }
      });

      if (fieldsChanged) {
        setFieldsConfig(currentFields);
        const pType = selectedPatient?.type || 'general';
        localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(currentFields));
      }
    }

    if (gt.customFieldsValues) {
      setLocalCustomFields(prev => ({
        ...prev,
        ...gt.customFieldsValues
      }));
    }

    setShowGlobalTemplatesModal(false);
    alert("Case Preset loaded!");
  };

  const deleteGlobalTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this Case Preset?")) {
      const updated = globalTemplates.filter(t => t.id !== id);
      setGlobalTemplates(updated);
      localStorage.setItem(`globalTemplates_${doctorName}`, JSON.stringify(updated));
    }
  };

  const toggleLabTest = (key: keyof SelectedTests) => {
    setLabSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleHormoneDetail = (key: keyof HormoneReportSelection) => {
      setLabSelection(prev => ({ ...prev, hormone: true, hormoneDetails: { ...prev.hormoneDetails, [key]: !prev.hormoneDetails?.[key] } }));
  };

  const handlePlaceLabOrder = () => {
    if (!selectedPatient) return;
    const hasHormone = labSelection.hormone || (labSelection.hormoneDetails && Object.values(labSelection.hormoneDetails).some(v => v));
    const finalTests = { ...labSelection, hormone: hasHormone };
    if (!Object.values(finalTests).some(v => v === true || (typeof v === 'object' && v !== null))) {
        alert("Please select at least one test to order.");
        return;
    }
    const newOrder: LabOrder = {
      id: `o-${Date.now()}`, patientId: selectedPatient.id, tests: { ...finalTests, other: finalTests.other || finalTests.bloodSugar || finalTests.bloodGroup } as SelectedTests, ultrasound: false, status: 'pending', timestamp: Date.now()
    };
    onOrderLab(newOrder);
    alert("Lab Order Placed Successfully!");
    setLabSelection({
        cbc: false, serology: false, urine: false, other: false, widal: false, crp: false, hormone: false, semen: false, bloodSugar: false, bloodGroup: false, hormoneDetails: { tsh: false, ft3: false, ft4: false, t3: false, t4: false, fsh: false, lh: false, prolactin: false, amh: false, hba1c: false }
    });
  };

  const prefillANCProfile = () => {
    setLabSelection(prev => ({ ...prev, cbc: true, serology: true, urine: true, bloodSugar: true, bloodGroup: true, hormone: true, hormoneDetails: { ...prev.hormoneDetails, tsh: true } }));
  };

  const handleOrderUSG = () => {
    if (!selectedPatient) return;
    onOrderLab({ id: `usg-${Date.now()}`, patientId: selectedPatient.id, status: 'pending', timestamp: Date.now(), tests: {} as any, ultrasound: true });
    if (selectedPatient.type === 'obstetric') { setShowUsgModal(true); } else { alert("USG Order Placed (Non-Obstetric)."); }
  };

  const handleAddToStaging = () => {
      if (qRxSelectedDrugs.length === 0) return;
      
      const newEntries = qRxSelectedDrugs.map(drugName => {
          // Find drug details from master to prepopulate defaults
          const drugDetails = medicationMaster?.drugs.find(d => d.name === drugName);
          return {
              drug: drugName,
              dose: drugDetails?.defaultDose || '',
              freq: drugDetails?.defaultFrequency || '',
              duration: drugDetails?.defaultDuration || '',
              advice: drugDetails?.defaultAdvice || ''
          };
      });
      
      setQRxStaging(prev => [...prev, ...newEntries]);
      setQRxSelectedDrugs([]); 
  };

  const updateStagingItem = (index: number, field: 'freq' | 'advice' | 'duration' | 'dose', value: string) => {
      setQRxStaging(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleQuickRxConfirm = () => {
      const formattedRx = qRxStaging.map(item => {
          // Format: [Drug Name] [Dose] -- [Freq] -- [Duration] Days ([Advice])
          let line = item.drug;
          if (item.dose) line += ` ${item.dose}`;
          if (item.freq) line += ` -- ${item.freq}`;
          if (item.duration) line += ` -- ${item.duration} Days`;
          if (item.advice) line += ` (${item.advice})`;
          return line;
      }).join('\n');
      setLocalRx(prev => prev ? prev + '\n' + formattedRx : formattedRx);
      setQRxStaging([]); setQRxGroup(''); setQRxSelectedDrugs([]); setShowQuickRxModal(false);
  };

  const toggleQRxDrug = (drugName: string) => {
      setQRxSelectedDrugs(prev => prev.includes(drugName) ? prev.filter(d => d !== drugName) : [...prev, drugName]);
  };

  const handleTranslateRx = async (lang: 'Marathi' | 'Hindi') => {
      if (!localRx.trim()) return;
      setIsTranslating(true);
      try {
          const translated = await translateMedicalText(localRx, lang);
          setLocalRx(prev => prev + '\n\n' + translated);
      } catch (error) { alert('Translation failed. Please try again.'); } finally { setIsTranslating(false); }
  };

  const eddGroups = useMemo(() => {
      const groups: Record<string, Patient[]> = {};
      const seenMap = new Set<string>();
      patients.forEach(p => {
          if(p.type === 'obstetric' && p.pregnancyInfo?.edd) {
              const uniqueKey = `${p.name.trim().toLowerCase()}|${p.pregnancyInfo.edd}`;
              if (!seenMap.has(uniqueKey)) {
                  seenMap.add(uniqueKey);
                  const date = new Date(p.pregnancyInfo.edd);
                  const key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                  if(!groups[key]) groups[key] = [];
                  groups[key].push(p);
              }
          }
      });
      const sortedKeys = Object.keys(groups).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
      return sortedKeys.map(key => ({ month: key, patients: groups[key].sort((a,b) => new Date(a.pregnancyInfo!.edd).getTime() - new Date(b.pregnancyInfo!.edd).getTime()) }));
  }, [patients]);

  // Design D: All visible fields in single auto-flow grid order
  const visibleFields = useMemo(() => {
    return [...fieldsConfig].filter(f => f.visible);
  }, [fieldsConfig]);

  const [showMoreActions, setShowMoreActions] = React.useState(false);

  const patientEpisodes = useMemo(() => {
    if (!selectedPatient) return [];
    
    const epMap: Record<string, { name: string, status: string, visits: VisitRecord[] }> = {};
    const standalone: VisitRecord[] = [];
    
    const approvedVisits = visits
      .filter(v => v.patientId === selectedPatient.id && v.isApproved)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      
    approvedVisits.forEach(v => {
      if (v.episodeId) {
        if (!epMap[v.episodeId]) {
          epMap[v.episodeId] = {
            name: v.episodeName || 'Unnamed Episode',
            status: v.caseStatus || 'open',
            visits: []
          };
        }
        epMap[v.episodeId].visits.push(v);
      } else {
        standalone.push(v);
      }
    });
    
    const list = Object.entries(epMap).map(([id, val]) => ({
      id,
      ...val
    }));
    
    if (standalone.length > 0) {
      list.push({
        id: 'standalone',
        name: 'Standalone Visits',
        status: 'closed',
        visits: standalone
      });
    }
    
    return list;
  }, [selectedPatient, visits]);

  const renderEMRField = (fieldId: string) => {
    const config = fieldsConfig.find(f => f.id === fieldId);
    if (!config || !config.visible) return null;

    switch (fieldId) {
      case 'complaints':
        return (
          <div key="complaints" className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative text-left shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-3">{config.label}</h3>
            <textarea value={localComplaints} onChange={e => setLocalComplaints(e.target.value)} className="w-full h-16 text-sm bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none text-slate-800" placeholder="Primary complaints..."/>
            <div className="absolute top-6 right-6 flex gap-1">
              <button onClick={() => setTemplateConfig({ isOpen: true, type: 'complaints' })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
              <button onClick={() => handleSaveTemplate('complaints', localComplaints)} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
            </div>
          </div>
        );
      case 'obstetricHistory':
        return (
          <div key="obstetricHistory" className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative text-left shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-3">{config.label}</h3>
            <input value={localVisitOH} onChange={e => setLocalVisitOH(e.target.value)} className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all text-slate-800" placeholder="G_P_L_A_ status (one line)..."/>
            <div className="absolute top-6 right-6 flex gap-1">
                <button onClick={() => setTemplateConfig({ isOpen: true, type: 'oh' })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
                <button onClick={() => handleSaveTemplate('oh', localVisitOH)} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
            </div>
          </div>
        );
      case 'menstrualHistory':
        return (
          <div key="menstrualHistory" className="bg-pink-50/50 p-6 rounded-2xl border border-pink-100 relative space-y-4 text-left shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[10px] font-black text-pink-600 uppercase tracking-widest border-b border-pink-200 pb-2 mb-3">{config.label}</h3>
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-[8px] font-black text-pink-400 uppercase block mb-1">LMP Date</label>
                    {selectedPatient.pregnancyInfo?.lmp ? (
                        <div className="w-full bg-pink-100/50 border border-pink-205 rounded-lg px-2 py-1.5 text-xs font-bold text-pink-850">
                            {selectedPatient.pregnancyInfo.lmp}
                        </div>
                    ) : (
                        <input type="date" value={localLmp} onChange={e => { setLocalLmp(e.target.value); calculateEdd(e.target.value); }} className="w-full bg-white border border-pink-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none text-slate-800" />
                    )}
                </div>
                <div>
                    <label className="text-[8px] font-black text-pink-400 uppercase block mb-1">EDD</label>
                    <input type="date" value={localEdd} onChange={e => setLocalEdd(e.target.value)} className="w-full bg-white border border-pink-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none text-slate-800" />
                </div>
                <div>
                    <label className="text-[8px] font-black text-pink-400 uppercase block mb-1">POG</label>
                    <input value={localPog} onChange={e => setLocalPog(e.target.value)} className="w-full bg-white border border-pink-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none text-slate-800" placeholder="e.g. 12w 4d" />
                </div>
            </div>
            <textarea value={localMH} onChange={e => setLocalMH(e.target.value)} className="w-full h-16 text-sm bg-white border border-pink-200 rounded-xl px-4 py-2 font-bold focus:ring-4 focus:ring-pink-100 outline-none transition-all resize-none text-slate-800" placeholder="Cycle regularity, flow details..."/>
            <div className="absolute top-6 right-6 flex gap-1">
              <button onClick={() => setTemplateConfig({ isOpen: true, type: 'mh' })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-pink-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
              <button onClick={() => handleSaveTemplate('mh', localMH)} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-pink-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
            </div>
          </div>
        );
      case 'generalExamination':
        return (
          <div key="generalExamination" className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 relative space-y-4 text-left shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-200 pb-2 mb-1">{config.label}</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                    <label className="text-[8px] font-black text-blue-400 uppercase block mb-1">Pulse (bpm)</label>
                    <input value={localPulse} onChange={e => setLocalPulse(e.target.value)} className="w-full text-xs font-black outline-none text-slate-800" placeholder="--" />
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                    <label className="text-[8px] font-black text-blue-400 uppercase block mb-1">BP (mmHg)</label>
                    <input value={localBp} onChange={e => setLocalBp(e.target.value)} className="w-full text-xs font-black outline-none text-slate-800" placeholder="120/80" />
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                    <label className="text-[8px] font-black text-blue-400 uppercase block mb-1">Weight (kg)</label>
                    <input value={localWeight} onChange={e => setLocalWeight(e.target.value)} className="w-full text-xs font-black outline-none text-slate-800" placeholder="--" />
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                    <label className="text-[8px] font-black text-blue-400 uppercase block mb-1">Height (cm)</label>
                    <input value={localHeight} onChange={e => setLocalHeight(e.target.value)} className="w-full text-xs font-black outline-none text-slate-800" placeholder="--" />
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100 col-span-2">
                    <label className="text-[8px] font-black text-blue-400 uppercase block mb-1">SpO2 (%)</label>
                    <input value={localSpo2} onChange={e => setLocalSpo2(e.target.value)} className="w-full text-xs font-black outline-none text-slate-800" placeholder="98" />
                </div>
            </div>
            
            {customCalculativeFields.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-blue-100 space-y-2 mt-2">
                <span className="text-[8px] font-black text-blue-400 uppercase block text-left">Calculated Metrics</span>
                <div className="grid grid-cols-2 gap-2">
                  {customCalculativeFields.map((cf, idx) => {
                    const wNum = parseFloat(localWeight) || 0;
                    const hNum = parseFloat(localHeight) || 0;
                    const pNum = parseFloat(localPulse) || 0;
                    const sNum = parseFloat(localSpo2) || 0;
                    const calculated = evaluateFormula(cf.formula, { weight: wNum, height: hNum, pulse: pNum, spo2: sNum });
                    return (
                      <div key={idx} className="bg-blue-50/50 p-2 rounded-lg text-xs font-bold text-blue-800 text-left">
                        <span className="block text-[8px] text-blue-400 uppercase">{cf.name}</span>
                        <span>{calculated}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <textarea value={localGenNotes} onChange={e => setLocalGenNotes(e.target.value)} className="w-full h-14 text-sm bg-white border border-blue-200 rounded-xl px-4 py-2 font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none text-slate-800" placeholder="Pallor, Edema, Icterus..."/>
            <div className="absolute top-6 right-6 flex gap-1">
              <button onClick={() => setTemplateConfig({ isOpen: true, type: 'gen_exam' })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-blue-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
              <button onClick={() => handleSaveTemplate('gen_exam', localGenNotes)} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-blue-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
            </div>
          </div>
        );
      case 'examinationDetails':
        return (
          <div key="examinationDetails" className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative text-left shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-3 shrink-0">{config.label}</h3>
            <textarea value={localPhysExam} onChange={e => setLocalPhysExam(e.target.value)} className="w-full h-16 text-sm bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none text-slate-800" placeholder="Systemic examination..."/>
            <div className="absolute top-6 right-6 flex gap-1">
              <button onClick={() => setTemplateConfig({ isOpen: true, type: 'phys_exam' })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
              <button onClick={() => handleSaveTemplate('phys_exam', localPhysExam)} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
            </div>
          </div>
        );
      case 'prescription':
        return (
          <div key="prescription" className="bg-green-50/10 p-6 rounded-2xl border-2 border-green-150 relative min-h-[200px] flex flex-col text-left shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[10px] font-black text-green-600 uppercase tracking-widest border-b border-green-100 pb-2 mb-3 shrink-0">{config.label}</h3>
            <div className="absolute top-2 right-6 flex gap-2">
                <button onClick={() => handleTranslateRx('Marathi')} disabled={isTranslating} className="text-[9px] bg-white border border-green-200 px-2 py-1 rounded-lg uppercase font-bold text-green-700 hover:bg-green-50 transition-all">{isTranslating ? '...' : 'अ'}</button>
                <button onClick={() => handleTranslateRx('Hindi')} disabled={isTranslating} className="text-[9px] bg-white border border-green-200 px-2 py-1 rounded-lg uppercase font-bold text-green-700 hover:bg-green-50 transition-all">{isTranslating ? '...' : 'अ'}</button>
            </div>
            <textarea value={localRx} onChange={e => setLocalRx(e.target.value)} className="flex-grow w-full text-lg bg-white border border-green-200 rounded-xl px-4 py-2 font-black focus:ring-4 focus:ring-green-50 outline-none transition-all resize-none text-slate-800" placeholder="Medications..."/>
            <div className="absolute bottom-4 right-6 flex gap-1">
              <button onClick={() => setShowQuickRxModal(true)} className="bg-white p-1 rounded-lg border border-green-100 text-[10px] shadow-sm font-black px-2.5 text-green-600 transition-all hover:bg-green-50">Quick Rx</button>
              <button onClick={() => setTemplateConfig({ isOpen: true, type: 'prescription' })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-green-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
              <button onClick={() => handleSaveTemplate('prescription', localRx)} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-green-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
            </div>
          </div>
        );
      case 'remarksFollowUp':
        return (
          <div key="remarksFollowUp" className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative text-left shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-3">{config.label}</h3>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Doctor Remarks / Special Instructions</label>
                    <textarea value={localRemarks} onChange={e => setLocalRemarks(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm h-16 resize-none text-slate-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Special instructions..."/>
                </div>
                <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Follow-up Date</label>
                    <input type="date" value={localFollowUpDate} onChange={e => setLocalFollowUpDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm text-slate-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                </div>
            </div>
            <div className="absolute top-6 right-6 flex gap-1">
              <button onClick={() => setTemplateConfig({ isOpen: true, type: 'remarks' })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
              <button onClick={() => handleSaveTemplate('remarks', localRemarks)} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
            </div>
          </div>
        );
      case 'labsOrder':
        return (
          <div key="labsOrder" className="space-y-4 text-left">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">{config.label}</h3>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-2 gap-2">
                   {['cbc', 'serology', 'urine', 'crp', 'bloodSugar', 'bloodGroup', 'widal', 'semen'].map(test => (
                       <label key={test} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-100 rounded">
                           <input 
                               type="checkbox" 
                               checked={labSelection[test as keyof SelectedTests] as boolean} 
                               onChange={() => toggleLabTest(test as keyof SelectedTests)}
                               className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                           />
                           <span className="text-[10px] font-black uppercase text-slate-700">{test}</span>
                       </label>
                   ))}
               </div>
               <div className="bg-white p-3 rounded-xl border border-purple-100">
                   <label className="flex items-center gap-2 cursor-pointer mb-2 border-b border-purple-50 pb-2">
                       <input 
                           type="checkbox" 
                           checked={labSelection.hormone} 
                           onChange={() => toggleLabTest('hormone')}
                           className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300"
                       />
                       <span className="text-[10px] font-black uppercase text-purple-700">Hormone Panel</span>
                   </label>
                   {labSelection.hormone && (
                       <div className="grid grid-cols-2 gap-2 pl-2">
                           {(['tsh', 'ft3', 'ft4', 't3', 't4', 'fsh', 'lh', 'prolactin', 'amh', 'hba1c'] as Array<keyof HormoneReportSelection>).map(hKey => (
                               <label key={hKey} className="flex items-center gap-2 cursor-pointer">
                                   <input 
                                       type="checkbox"
                                       checked={labSelection.hormoneDetails?.[hKey] || false}
                                       onChange={() => toggleHormoneDetail(hKey)}
                                       className="h-3 w-3 rounded text-purple-500 focus:ring-purple-400 border-gray-300"
                                   />
                                   <span className="text-[9px] font-bold text-slate-600 uppercase">{hKey}</span>
                               </label>
                           ))}
                       </div>
                   )}
               </div>
               <div className="flex gap-2 pt-2">
                   <button onClick={prefillANCProfile} className="flex-1 bg-pink-100 text-pink-700 hover:bg-pink-200 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all">Select ANC</button>
                   <button onClick={handlePlaceLabOrder} className="flex-[2] bg-blue-600 text-white hover:bg-blue-700 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest shadow-md transition-all active:scale-95">Place Lab Order</button>
               </div>
            </div>
          </div>
        );
      case 'radiology':
        return (
          <div key="radiology" className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-left">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{config.label}</h3>
             <div className="grid grid-cols-2 gap-2">
                 <button onClick={handleOrderUSG} className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300 py-3 rounded-xl font-black uppercase tracking-widest text-[9px]">Order USG ({billingRates.ultrasound?.price || 800}/-)</button>
                 <button onClick={() => setShowUsgModal(true)} className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300 py-3 rounded-xl font-black uppercase tracking-widest text-[9px]">Print Referral</button>
             </div>
          </div>
        );
      default:
        if (fieldId.startsWith('custom_')) {
          return (
            <div key={fieldId} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative text-left shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-3">{config.label}</h3>
              <textarea 
                value={localCustomFields[fieldId] || ''} 
                onChange={e => setLocalCustomFields(prev => ({ ...prev, [fieldId]: e.target.value }))} 
                className="w-full h-16 text-sm bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none text-slate-800" 
                placeholder={`Enter ${config.name}...`}
              />
              <div className="absolute top-6 right-6 flex gap-1">
                <button onClick={() => setTemplateConfig({ isOpen: true, type: fieldId })} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Load Template">📋</button>
                <button onClick={() => handleSaveTemplate(fieldId, localCustomFields[fieldId] || '')} className="bg-white hover:bg-slate-100 p-1 rounded-lg border border-slate-100 text-sm shadow-sm transition-all" title="Save Template">💾</button>
                <button 
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this custom field?")) {
                      const updated = fieldsConfig.filter(f => f.id !== fieldId);
                      setFieldsConfig(updated);
                      const pType = selectedPatient?.type || 'general';
                      localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(updated));
                    }
                  }}
                  className="bg-red-50 text-red-500 hover:bg-red-100 p-1 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-200 transition-all hover:scale-105 active:scale-95 shadow-sm"
                  title="Delete Custom Field"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        }
        return null;
    }
  };

  const renderLeftSidebarContent = () => (
    <>
       <div className="p-4 border-b border-slate-100 space-y-1">
         <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">{selectedPatient?.type} CONSULT</p>
         <h2 className="text-xl font-black text-slate-900 uppercase leading-tight">{selectedPatient?.name}</h2>
         <div className="flex items-center gap-2 mt-1">
           <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[8px] font-black uppercase">ACTIVE</span>
           <span className="text-[9px] font-bold text-slate-400">ID: {selectedPatient?.uhid || selectedPatient?.id}</span>
         </div>
       </div>

       <div className="p-4 border-b border-slate-100">
         <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">EPISODE TYPE</label>
         <select 
             value={localEpisodeId} 
             onChange={(e) => {
               const val = e.target.value;
               if (val === 'new') {
                 const newName = prompt("Enter new Episode name (e.g. ANC 2026, Post-Op):");
                 if (newName) {
                   const newId = `ep-${Date.now()}`;
                   setLocalEpisodeId(newId);
                   setLocalEpisodeName(newName);
                 }
               } else {
                 const matched = visits.find(v => v.episodeId === val);
                 setLocalEpisodeId(val);
                 setLocalEpisodeName(matched?.episodeName || '');
               }
             }}
             className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
           >
             <option value="">Standard Visit</option>
             {selectedPatient && Array.from(new Set(visits.filter(v => v.patientId === selectedPatient.id && v.episodeId).map(v => JSON.stringify({ id: v.episodeId, name: v.episodeName }))))
               .map(str => {
                 const ep = JSON.parse(str as string);
                 return <option key={ep.id} value={ep.id}>{ep.name}</option>;
               })
             }
             <option value="new">+ Start New Episode...</option>
         </select>
       </div>

       <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><span className="text-blue-500">📈</span> VITALS & EXAM</h3>
            <button onClick={() => setTemplateConfig({ isOpen: true, type: 'gen_exam' })} className="text-[10px] text-slate-400 hover:text-blue-500">⚙️</button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
             <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">PULSE (BPM)</label>
                <input value={localPulse} onChange={e => setLocalPulse(e.target.value)} className="w-full bg-transparent text-sm font-black text-slate-800 outline-none" placeholder="--" />
             </div>
             <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">BP (MMHG)</label>
                <input value={localBp} onChange={e => setLocalBp(e.target.value)} className="w-full bg-transparent text-sm font-black text-slate-800 outline-none" placeholder="120/80" />
             </div>
             <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">WT (KG)</label>
                <input value={localWeight} onChange={e => setLocalWeight(e.target.value)} className="w-full bg-transparent text-sm font-black text-slate-800 outline-none" placeholder="--" />
             </div>
             <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">SPO2 (%)</label>
                <input value={localSpo2} onChange={e => setLocalSpo2(e.target.value)} className="w-full bg-transparent text-sm font-black text-slate-800 outline-none" placeholder="--" />
             </div>
          </div>

          {/* DYNAMIC CALCULATED VITALS */}
          {customCalculativeFields.length > 0 && (
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-2 mb-3">
              <span className="text-[8px] font-black text-blue-400 uppercase block text-left">Calculated Metrics</span>
              <div className="grid grid-cols-2 gap-2">
                {customCalculativeFields.map((cf, idx) => {
                  const evaluateFormula = (formulaStr, vars) => {
                    try {
                      let f = formulaStr.toLowerCase();
                      Object.keys(vars).forEach(k => { f = f.replace(new RegExp(k, 'g'), vars[k] || 0); });
                      return new Function('return ' + f)().toFixed(2);
                    } catch (e) { return 'Err'; }
                  };
                  const wNum = parseFloat(localWeight) || 0;
                  const hNum = parseFloat(localHeight) || 0;
                  const pNum = parseFloat(localPulse) || 0;
                  const sNum = parseFloat(localSpo2) || 0;
                  const calculated = evaluateFormula(cf.formula, { weight: wNum, height: hNum, pulse: pNum, spo2: sNum });
                  return (
                    <div key={idx} className="bg-white p-2 rounded-lg text-xs font-bold text-blue-800 text-left border border-blue-50">
                      <span className="block text-[8px] text-blue-400 uppercase">{cf.name}</span>
                      <span>{calculated}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <textarea 
            value={localGenNotes} 
            onChange={e => setLocalGenNotes(e.target.value)} 
            className="w-full h-14 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white resize-none" 
            placeholder="General notes (e.g. Pallor present)"
          />
       </div>

       <div className="p-4 border-b border-slate-100 bg-blue-50/30">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5 mb-3"><span>✨</span> AI INSIGHTS</h3>
          <ul className="list-disc pl-4 text-xs font-bold text-slate-600 space-y-2 marker:text-blue-300 mb-3">
             {isAiLoading ? (
                 <li className="animate-pulse">Analyzing case data...</li>
             ) : (
               <>
                 <li>Potential risk of anemia based on pallor finding.</li>
                 <li>Blood pressure is slightly elevated (Stage 1).</li>
                 <li>POG and LMP are consistent with gestational age.</li>
               </>
             )}
          </ul>

          {selectedPatient?.type === 'obstetric' && lookAheadSuggestions.length > 0 && (
             <div className="mt-3 pt-3 border-t border-blue-100/50">
               <h4 className="text-[8px] font-black uppercase text-blue-500 tracking-wider mb-2">🤰 Look-Ahead Prompts (Trimester Milestones):</h4>
               <div className="flex flex-col gap-1.5">
                  {lookAheadSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const currentVal = localRemarks.trim();
                          const appendStr = `- ${s.text}`;
                          if (!currentVal.includes(s.text)) {
                            setLocalRemarks(prev => `${prev}${prev ? '\n' : ''}${appendStr}`);
                          }
                        }}
                        className="text-left bg-white border border-blue-100 hover:bg-blue-50 p-2 rounded-xl text-[9px] font-bold text-slate-700 transition flex items-center justify-between"
                        title="Click to advise this test/vaccine in Doctor Remarks"
                      >
                         <span>{s.label}</span>
                         <span className="text-blue-500 font-bold ml-1">＋</span>
                      </button>
                  ))}
               </div>
             </div>
          )}
       </div>

       <div className="p-4 space-y-2 mt-auto">
         <button onClick={handleLoadGlobalTemplate} className="w-full py-2.5 rounded-lg border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors">
            📋 LOAD PRESET
         </button>
         <button onClick={handleSaveGlobalTemplate} className="w-full py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors">
            💾 SAVE PRESET
         </button>
       </div>
    </>
  );

  const renderRightSidebarContent = () => (
    <>
       <div className="p-4 border-b border-slate-100 flex justify-between items-center">
         <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5"><span className="text-lg">👥</span> QUEUE ({pendingVisits.length})</h3>
         <span className="text-slate-400 text-sm">»</span>
       </div>
       
       <div className="flex-1 overflow-y-auto custom-scrollbar">
         <div className="divide-y divide-slate-100">
            {pendingVisits.map(v => (
               <div 
                 key={v.id} 
                 onClick={() => {
                    handleSaveCaseData(true);
                    setSelectedPatient(v.patient || null);
                 }}
                 className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedPatient && v.patientId === selectedPatient.id ? 'bg-blue-50/50 relative' : ''}`}
               >
                  {selectedPatient && v.patientId === selectedPatient.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>}
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <p className={`text-xs font-black ${selectedPatient && v.patientId === selectedPatient.id ? 'text-blue-700' : 'text-slate-800'}`}>{v.patient?.name}</p>
                      <p className="text-[9px] font-bold text-slate-400">ID: {v.patient?.uhid || v.patient?.id}</p>
                    </div>
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${selectedPatient && v.patientId === selectedPatient.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                       {selectedPatient && v.patientId === selectedPatient.id ? 'IN CONSULT' : 'WAITING'}
                    </span>
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 text-right mt-1">Wait: {Math.floor((new Date().getTime() - new Date(v.createdAt || v.timestamp || Date.now()).getTime()) / 60000) || 0}m</p>
               </div>
            ))}
         </div>
       </div>
       
       <div className="p-4 border-t border-slate-100">
         <button onClick={() => setShowOrderModal(false)} className="w-full py-2.5 rounded-lg bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-colors">
            VIEW FULL QUEUE
         </button>
       </div>
       <div className="bg-slate-50 p-2 text-center border-t border-slate-200 flex justify-between items-center px-4">
         <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div><span className="text-[8px] text-slate-400 uppercase font-bold">System Online</span></div>
         <span className="text-[8px] text-slate-400 uppercase font-bold">ID: 299-X-MALI</span>
       </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        {/* Tabs */}
        <div className="flex space-x-2 bg-slate-200 p-1 rounded-2xl w-fit">
            <button onClick={() => setActiveTab('stats')} className={`px-8 py-3 rounded-xl font-black transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'stats' ? 'bg-white text-purple-600 shadow-xl' : 'text-slate-600 hover:text-slate-800'}`}>My Dashboard</button>
            <button onClick={() => setActiveTab('queue')} className={`px-8 py-3 rounded-xl font-black transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'queue' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-600 hover:text-slate-800'}`}>Queue</button>
            <button onClick={() => setActiveTab('edd')} className={`px-8 py-3 rounded-xl font-black transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'edd' ? 'bg-white text-pink-600 shadow-xl' : 'text-slate-600 hover:text-slate-800'}`}>EDD</button>
        </div>

        {/* Doctor name & Settings Gear */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <span className="font-black text-xs text-slate-800 uppercase tracking-tight">Dr. {doctorName}</span>
            <button 
              onClick={() => setShowCustomizeModal(true)} 
              title="Customize EMR Fields & Default Rx Mode"
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-sm shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              ⚙️
            </button>
        </div>

        {/* Prescription Toggle */}
        <div className="flex bg-slate-200 p-1 rounded-2xl border border-slate-300">
            <button onClick={() => setPrescriptionMode('digital')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${prescriptionMode === 'digital' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Digital Rx</button>
            <button onClick={() => setPrescriptionMode('manual')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${prescriptionMode === 'manual' ? 'bg-white shadow text-purple-600' : 'text-slate-500'}`}>Manual Rx</button>
        </div>
      </div>

      {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in duration-500">
              
              {dashboardView === 'overview' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                        <div onClick={() => { setDashboardView('opd_stats'); resetFilters(); }} className="bg-blue-600 p-6 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all cursor-pointer">
                            <p className="text-xs font-black uppercase opacity-80 tracking-widest">Patients Checked</p>
                            <p className="text-4xl font-black mt-2">{dashboardStats.patientsChecked}</p>
                        </div>
                        <div onClick={() => { setDashboardView('ipd_stats'); resetFilters(); }} className="bg-purple-600 p-6 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all cursor-pointer">
                            <p className="text-xs font-black uppercase opacity-80 tracking-widest">Patients Admitted</p>
                            <p className="text-4xl font-black mt-2">{dashboardStats.patientsAdmitted}</p>
                        </div>
                        <div onClick={() => { setDashboardView('ipd_stats'); resetFilters(); }} className="bg-red-500 p-6 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all cursor-pointer">
                            <p className="text-xs font-black uppercase opacity-80 tracking-widest">Patients Operated</p>
                            <p className="text-4xl font-black mt-2">{dashboardStats.patientsOperated}</p>
                        </div>
                        <div onClick={() => { setDashboardView('report_stats'); resetFilters(); }} className="bg-green-600 p-6 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all cursor-pointer">
                            <p className="text-xs font-black uppercase opacity-80 tracking-widest">Lab Orders</p>
                            <p className="text-4xl font-black mt-2">{dashboardStats.reportsOrdered}</p>
                        </div>
                        <div onClick={() => { setDashboardView('rx_stats'); resetFilters(); }} className="bg-amber-500 p-6 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all cursor-pointer">
                            <p className="text-xs font-black uppercase opacity-80 tracking-widest">Prescriptions</p>
                            <p className="text-4xl font-black mt-2">{dashboardStats.drugsPrescribedCount}</p>
                        </div>
                    </div>

                    {/* Collection Summary Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Financial Collection Analytics</h3>
                            <div className="flex gap-4 items-center">
                                <input type="date" value={dashDateStart} onChange={e => setDashDateStart(e.target.value)} className="border rounded-lg px-2 py-1 text-xs font-bold" />
                                <span className="font-bold text-slate-400">-</span>
                                <input type="date" value={dashDateEnd} onChange={e => setDashDateEnd(e.target.value)} className="border rounded-lg px-2 py-1 text-xs font-bold" />
                            </div>
                        </div>
                        
                        {(() => {
                            const { opdTotal, labTotal, usgTotal, ipdTotal, total } = calculateCollections();
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                    <div className="col-span-1 md:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                                        <p className="text-sm font-black text-slate-500 uppercase">Total Period Collection</p>
                                        <p className="text-3xl font-black text-slate-800">₹{total.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                        <p className="text-[10px] font-black text-blue-500 uppercase">OPD (Consultation)</p>
                                        <p className="text-xl font-black text-blue-700">₹{opdTotal.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                        <p className="text-[10px] font-black text-green-500 uppercase">Laboratory</p>
                                        <p className="text-xl font-black text-green-700">₹{labTotal.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                                        <p className="text-[10px] font-black text-purple-500 uppercase">Ultrasound (USG)</p>
                                        <p className="text-xl font-black text-purple-700">₹{usgTotal.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                        <p className="text-[10px] font-black text-red-500 uppercase">IPD / Day Care</p>
                                        <p className="text-xl font-black text-red-700">₹{ipdTotal.toLocaleString()}</p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                  </>
              )}

              {/* Drill-Down Views */}
              {dashboardView !== 'overview' && (
                  <div className="space-y-4">
                      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                          <h3 className="text-lg font-black text-slate-800 uppercase">
                              {dashboardView === 'rx_stats' ? 'Prescription Analysis' : 
                               dashboardView === 'opd_stats' ? 'OPD Patient Records' : 
                               dashboardView === 'ipd_stats' ? 'Admissions & Surgeries' : 'Lab Reports Log'}
                          </h3>
                          <div className="flex gap-4 items-center">
                              <input placeholder="Search..." value={dashSearch} onChange={e => setDashSearch(e.target.value)} className="border rounded-xl px-4 py-2 text-xs font-bold" />
                              <input type="date" value={dashDateStart} onChange={e => setDashDateStart(e.target.value)} className="border rounded-xl px-4 py-2 text-xs font-bold" />
                              <input type="date" value={dashDateEnd} onChange={e => setDashDateEnd(e.target.value)} className="border rounded-xl px-4 py-2 text-xs font-bold" />
                              <button onClick={() => setDashboardView('overview')} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest">Back to Dashboard</button>
                          </div>
                      </div>

                      {dashboardView === 'rx_stats' && renderPrescriptionStats()}
                      {dashboardView === 'opd_stats' && renderPatientStats('opd')}
                      {dashboardView === 'ipd_stats' && renderPatientStats('ipd')}
                      {dashboardView === 'report_stats' && renderReportStats()}
                  </div>
              )}
          </div>
      )}

      {/* Queue Tab – Mobile Responsive */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="px-4 sm:px-6 py-4 border-b bg-slate-50 flex flex-wrap justify-between items-center gap-3">
             <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase">Date:</span>
                <input type="date" value={queueDate} onChange={e => setQueueDate(e.target.value)} className="bg-transparent font-bold text-slate-800 outline-none text-xs" />
             </div>
             <button 
               onClick={() => setShowQuickAddPatientModal(true)} 
               className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 rounded-xl uppercase text-[9px] tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-1.5"
             >
               <span>➕</span> Quick Add Patient
             </button>
          </div>

          {/* Mobile: Card list */}
          <div className="sm:hidden divide-y divide-slate-100">
            {pendingVisits.map(v => (
              <div key={v.id} className={`px-4 py-4 ${v.callingStatus === 'called' ? 'bg-green-50 animate-pulse' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-black text-slate-800 text-base">{v.patient?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{v.patient?.mobile} · {v.patient?.age}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => onCallPatient(v.patient?.name || '')} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">Call</button>
                    <button onClick={() => { setSelectedPatient(v.patient || null); setShowOrderModal(true); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">Case</button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-lg p-1.5 text-center"><div className="text-[8px] font-black text-slate-400 uppercase">BP</div><div className="text-xs font-bold text-slate-700">{v.vitals?.bp || '--'}</div></div>
                  <div className="bg-slate-50 rounded-lg p-1.5 text-center"><div className="text-[8px] font-black text-slate-400 uppercase">Pulse</div><div className="text-xs font-bold text-slate-700">{v.vitals?.pulse || '--'}</div></div>
                  <div className="bg-slate-50 rounded-lg p-1.5 text-center"><div className="text-[8px] font-black text-slate-400 uppercase">Wt</div><div className="text-xs font-bold text-slate-700">{v.vitals?.weight || '--'}</div></div>
                  <div className="bg-slate-50 rounded-lg p-1.5 text-center"><div className="text-[8px] font-black text-slate-400 uppercase">SpO₂</div><div className="text-xs font-bold text-slate-700">{v.vitals?.spo2 || '--'}</div></div>
                </div>
                <p className="text-xs text-slate-500 italic line-clamp-1">{v.complaints || 'No complaints'}</p>
              </div>
            ))}
            {pendingVisits.length === 0 && <div className="px-4 py-10 text-center text-slate-400 italic text-sm">No waiting patients for {queueDate}.</div>}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-6 lg:px-8 py-5">Patient Identity</th>
                  <th className="px-6 lg:px-8 py-5">Vitals</th>
                  <th className="px-6 lg:px-8 py-5 hidden lg:table-cell">Complaints</th>
                  <th className="px-6 lg:px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingVisits.map(v => (
                  <tr key={v.id} className={`${v.callingStatus === 'called' ? 'bg-green-50 animate-pulse' : 'hover:bg-slate-50'}`}>
                    <td className="px-6 lg:px-8 py-5">
                      <p className="font-black text-slate-800 text-base">{v.patient?.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{v.patient?.mobile} | {v.patient?.age}</p>
                    </td>
                    <td className="px-6 lg:px-8 py-5">
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-600">
                        <span>BP: <b>{v.vitals?.bp}</b></span>
                        <span>PLS: <b>{v.vitals?.pulse}</b></span>
                        <span>WT: <b>{v.vitals?.weight}kg</b></span>
                        <span>O2: <b>{v.vitals?.spo2}%</b></span>
                      </div>
                    </td>
                    <td className="px-6 lg:px-8 py-5 max-w-[200px] hidden lg:table-cell">
                      <p className="text-xs text-slate-600 font-bold line-clamp-2 italic">{v.complaints || 'No complaints noted'}</p>
                    </td>
                    <td className="px-6 lg:px-8 py-5 text-right space-x-2">
                      <button onClick={() => onCallPatient(v.patient?.name || '')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Call</button>
                      <button onClick={() => { setSelectedPatient(v.patient || null); setShowOrderModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Case</button>
                    </td>
                  </tr>
                ))}
                {pendingVisits.length === 0 && (
                  <tr><td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic">No waiting patients for {queueDate}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDD View */}
      {activeTab === 'edd' && (
        <div className="space-y-8">
            {eddGroups.map((group, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-xl border border-pink-100 overflow-hidden">
                    <div className="bg-pink-50 p-4 border-b border-pink-100 flex justify-between items-center">
                        <h3 className="font-black text-pink-600 uppercase tracking-widest">{group.month}</h3>
                        <span className="bg-white text-pink-500 px-3 py-1 rounded-full text-xs font-bold">{group.patients.length} Deliveries</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.patients.map(p => (
                            <div key={p.id} className="p-4 border border-pink-50 rounded-xl hover:bg-pink-50/50 transition-colors cursor-pointer" onClick={() => { setSelectedPatient(p); setShowOrderModal(true); }}>
                                <p className="font-black text-slate-800">{p.name}</p>
                                <div className="flex justify-between mt-2 text-xs">
                                    <span className="text-slate-500 font-bold">EDD: {new Date(p.pregnancyInfo!.edd).toLocaleDateString()}</span>
                                    <span className="text-pink-500 font-bold">{p.pregnancyInfo!.pog}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {eddGroups.length === 0 && <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">No obstetric patients with EDD found.</div>}
        </div>
      )}

      {/* Main Order Modal – Full-screen on mobile, large modal on desktop */}
      {showOrderModal && selectedPatient && (
        <div className="fixed inset-0 bg-slate-500/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1600px] h-full flex flex-col border border-slate-200 overflow-hidden">
             
             {/* ── TOP HEADER ────────────────────────── */}
             <div className="flex justify-between items-center px-4 py-2 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar">
                   <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                      <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-black">✚</span>
                      </div>
                      <span className="text-sm font-black text-slate-800 tracking-tighter">EMR DASHBOARD</span>
                   </div>
                   
                   <div className="flex gap-1">
                     {selectedPatient.type === 'obstetric' && (
                       <button onClick={(e) => { e.stopPropagation(); setShowAncModal(true); }} className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 whitespace-nowrap transition-colors">
                           ANC
                       </button>
                     )}
                     <button onClick={() => setShowPastVisitsModal(true)} className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 whitespace-nowrap transition-colors">
                        VISITS
                     </button>
                     <button onClick={handleOpenBilling} className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 whitespace-nowrap transition-colors">
                        PAYMENT
                     </button>
                     <button onClick={() => setShowMobileVitals(true)} className="xl:hidden px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 whitespace-nowrap transition-colors flex items-center gap-1">
                        🌡️ Vitals
                     </button>
                     <button onClick={() => setShowMobileQueue(true)} className="xl:hidden px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 whitespace-nowrap transition-colors flex items-center gap-1">
                        👥 Queue ({pendingVisits.length})
                     </button>
                     <button 
                        onClick={(e) => {
                          if (e.ctrlKey) {
                            setCustomAiPromptText('');
                            setAiCompleteModalOpen(true);
                          } else {
                            handleAiComplete();
                          }
                        }} 
                        disabled={isAiLoading} 
                        className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-blue-600 bg-blue-50 hover:bg-blue-100 whitespace-nowrap transition-colors flex items-center gap-1"
                        title="Click to auto-complete. Ctrl + Click to enter custom instructions."
                      >
                         {isAiLoading ? '⏳ AI...' : '✨ AI COMPLETE'}
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button onClick={() => setShowCustomizeModal(true)} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">⚙️</button>
                  <button onClick={handlePrintPrescription} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">🖨️</button>
                  <button
                     onClick={() => {
                       const v = visits.find(vis => vis.patientId === selectedPatient.id && !vis.isApproved) || visits.find(vis => vis.patientId === selectedPatient.id && vis.isApproved);
                       if (v) handleApprove(v.id);
                     }}
                     className="bg-blue-600 text-white px-5 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-sm"
                  >
                     ✓ COMPLETE CASE
                  </button>
                  <button onClick={() => setShowOrderModal(false)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">✖</button>
                </div>
             </div>

             {/* ── MAIN CONTENT (3 Panels Layout) ────────────────────────── */}
             <div className="flex flex-1 overflow-hidden bg-slate-50/50">
                
                {/* 1. LEFT SIDEBAR: Context, Vitals, Presets */}
                <div className="hidden xl:flex w-[300px] shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-auto custom-scrollbar">
                   {renderLeftSidebarContent()}
                </div>

                {/* 2. CENTER: The 3 Columns */}
                 <div className="flex-1 flex flex-col overflow-y-hidden bg-slate-50/50">
                    
                    {/* Mobile Center Column Switcher Tabs */}
                    <div className="flex border-b border-slate-200 bg-white lg:hidden shrink-0">
                       <button 
                         onClick={() => setActiveCenterCol('col1')} 
                         className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${activeCenterCol === 'col1' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                       >
                          📋 History/Exam
                       </button>
                       <button 
                         onClick={() => setActiveCenterCol('col2')} 
                         className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${activeCenterCol === 'col2' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                       >
                          💊 Prescription
                       </button>
                       <button 
                         onClick={() => setActiveCenterCol('col3')} 
                         className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${activeCenterCol === 'col3' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                       >
                          🔬 Investigations
                       </button>
                    </div>

                    <div className="flex-grow flex flex-col lg:flex-row overflow-x-auto overflow-y-auto custom-scrollbar">
                        {/* COL 1: Clinical History, Menstrual, Physical Exam, and Custom Fields */}
                        <div className={`w-full lg:w-1/3 min-w-[320px] p-4 md:p-6 overflow-y-auto custom-scrollbar border-r border-slate-200/50 space-y-6 ${activeCenterCol === 'col1' ? 'block' : 'hidden lg:block'}`}>
                            {visibleFields
                                .filter(f => !['generalExamination', 'labsOrder', 'radiology', 'prescription', 'remarksFollowUp'].includes(f.id))
                                .map(f => renderEMRField(f.id))}
                        </div>

                        {/* COL 2: Rx, Remarks */}
                        <div className={`w-full lg:w-1/3 min-w-[320px] p-4 md:p-6 overflow-y-auto custom-scrollbar border-r border-slate-200/50 space-y-6 ${activeCenterCol === 'col2' ? 'block' : 'hidden lg:block'}`}>
                            {visibleFields
                                .filter(f => ['prescription', 'remarksFollowUp'].includes(f.id))
                                .map(f => renderEMRField(f.id))}
                        </div>

                        {/* COL 3: Investigations, Radiology */}
                        <div className={`w-full lg:w-1/3 min-w-[320px] p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-6 ${activeCenterCol === 'col3' ? 'block' : 'hidden lg:block'}`}>
                            {visibleFields
                                .filter(f => ['labsOrder', 'radiology'].includes(f.id))
                                .map(f => renderEMRField(f.id))}
                            
                        </div>
                    </div>
                </div>

                {/* 3. RIGHT SIDEBAR: Queue */}
                <div className="hidden xl:flex w-[280px] shrink-0 border-l border-slate-200 bg-white flex flex-col">
                   {renderRightSidebarContent()}
                </div>

              </div>

              {/* Mobile Sliding Modal Sheet for Vitals */}
              {showMobileVitals && (
                 <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[55] flex justify-start xl:hidden">
                    <div className="bg-white w-[300px] h-full flex flex-col shadow-2xl p-4 relative">
                       <button onClick={() => setShowMobileVitals(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 text-lg border-0 bg-transparent cursor-pointer">✖</button>
                       <div className="flex-grow overflow-y-auto mt-6">
                          {renderLeftSidebarContent()}
                       </div>
                    </div>
                 </div>
              )}

              {/* Mobile Sliding Modal Sheet for Queue */}
              {showMobileQueue && (
                 <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[55] flex justify-end xl:hidden">
                    <div className="bg-white w-[280px] h-full flex flex-col shadow-2xl p-4 relative">
                       <button onClick={() => setShowMobileQueue(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 text-lg border-0 bg-transparent cursor-pointer">✖</button>
                       <div className="flex-grow overflow-y-auto mt-6">
                          {renderRightSidebarContent()}
                       </div>
                    </div>
                 </div>
              )}
              {/* AI Complete Custom Prompt Dialogue */}
              {aiCompleteModalOpen && (
                 <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-100 text-left animate-fade-in">
                       <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-4 border-b pb-2">AI Complete Prompt</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Write diagnosis, case summary, or brief guidelines:</p>
                       <textarea
                         value={customAiPromptText}
                         onChange={(e) => setCustomAiPromptText(e.target.value)}
                         className="w-full h-32 border rounded-xl p-3 text-xs font-bold text-slate-700 bg-slate-50 focus:ring-4 focus:ring-blue-100 outline-none transition resize-none mb-4"
                         placeholder="e.g. anc 5 months all normal / acute appendicitis post-op day 1 normal"
                       />
                       <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setAiCompleteModalOpen(false)}
                            className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold uppercase text-[10px] tracking-wider transition-all"
                          >
                             Cancel
                          </button>
                          <button
                            onClick={() => {
                              setAiCompleteModalOpen(false);
                              handleAiComplete(customAiPromptText);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-lg transition-all active:scale-95"
                          >
                             Complete
                          </button>
                       </div>
                    </div>
                 </div>
              )}

            </div>
         </div>
      )}
      
      {/* Quick Rx Modal */}
      {showQuickRxModal && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col relative">
                  <h3 className="text-xl font-black text-slate-800 uppercase mb-4">Quick Prescription Builder</h3>
                  
                  <div className="flex gap-4 h-full overflow-hidden">
                      {/* Groups */}
                      <div className="w-1/4 border-r pr-4 overflow-y-auto">
                          {medicationMaster?.groups.map(g => (
                              <button key={g} onClick={() => setQRxGroup(g)} className={`w-full text-left p-3 rounded-xl font-bold text-xs uppercase mb-2 ${qRxGroup === g ? 'bg-purple-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                  {g}
                              </button>
                          ))}
                      </div>
                      
                      {/* Drugs with Stock Check */}
                      <div className="w-1/4 border-r pr-4 overflow-y-auto">
                          {medicationMaster?.drugs.filter(d => d.group === qRxGroup).map(d => {
                              const stock = getStockLevel(d.name);
                              const isSelected = qRxSelectedDrugs.includes(d.name);
                              
                              return (
                                  <button 
                                      key={d.id} 
                                      onClick={() => handleDrugClick(d.name)} 
                                      className={`w-full text-left p-3 rounded-xl font-bold text-xs mb-2 border transition-all flex justify-between items-center group
                                          ${isSelected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}
                                          ${stock <= 0 && !isSelected ? 'text-red-500 border-red-100 bg-red-50/50' : ''}
                                      `}
                                  >
                                      <span>{d.name}</span>
                                      {stock <= 0 && !isSelected && (
                                          <span className="text-[10px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-2">OUT</span>
                                      )}
                                  </button>
                              )
                          })}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex-grow flex flex-col">
                          <div className="mb-4">
                              <button onClick={handleAddToStaging} disabled={qRxSelectedDrugs.length === 0} className="w-full bg-blue-600 text-white py-2 rounded-xl font-black uppercase text-xs disabled:bg-slate-200">Add Selected to Rx</button>
                          </div>
                          <div className="flex-grow overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                              {qRxStaging.map((item, i) => (
                                  <div key={i} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-xs">
                                      <p className="font-black text-slate-800 mb-2">{item.drug}</p>
                                      <div className="grid grid-cols-4 gap-2 mb-2">
                                          <input value={item.dose} onChange={e => updateStagingItem(i, 'dose', e.target.value)} className="border p-1 rounded font-bold text-slate-600" placeholder="Dose" />
                                          <select value={item.freq} onChange={e => updateStagingItem(i, 'freq', e.target.value)} className="border p-1 rounded font-bold text-slate-600">
                                              <option value="">Freq</option>
                                              {medicationMaster?.frequencies.map(f => <option key={f} value={f}>{f}</option>)}
                                          </select>
                                          <input value={item.duration} onChange={e => updateStagingItem(i, 'duration', e.target.value)} className="border p-1 rounded font-bold text-slate-600" placeholder="Days" type="number" />
                                          <select value={item.advice} onChange={e => updateStagingItem(i, 'advice', e.target.value)} className="border p-1 rounded font-bold text-slate-600">
                                              <option value="">Advice</option>
                                              {medicationMaster?.instructions.map(a => <option key={a} value={a}>{a}</option>)}
                                          </select>
                                      </div>
                                  </div>
                              ))}
                          </div>
                          <div className="mt-4 flex gap-2">
                              <button onClick={handleQuickRxConfirm} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs">Insert into Rx</button>
                              <button onClick={() => setShowQuickRxModal(false)} className="flex-1 bg-slate-200 text-slate-800 py-3 rounded-xl font-black uppercase text-xs">Close</button>
                          </div>
                      </div>
                  </div>

                  {/* Substitution Modal Overlay */}
                  {showSubstitutionModal && substitutionSource && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[70] flex items-center justify-center p-8 rounded-2xl">
                          <div className="w-full max-w-lg">
                              <div className="text-center mb-6">
                                  <span className="text-4xl">⚠️</span>
                                  <h4 className="text-xl font-black text-red-600 uppercase mt-2">Out of Stock</h4>
                                  <p className="font-bold text-slate-800 text-lg mt-1">{substitutionSource.name}</p>
                                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                      Generic: {substitutionSource.generic || 'Unknown'}
                                  </p>
                              </div>

                              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-6">
                                  <div className="bg-green-100 px-4 py-2 border-b border-green-200">
                                      <p className="text-[10px] font-black text-green-800 uppercase tracking-widest">Available Substitutes (Same Salt)</p>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto">
                                      {getAlternatives(substitutionSource.name).map(alt => (
                                          <button 
                                              key={alt.id}
                                              onClick={() => handleSubstitute(alt.name)}
                                              className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-green-50 flex justify-between items-center group transition-colors"
                                          >
                                              <div>
                                                  <p className="font-bold text-slate-800 text-sm group-hover:text-green-700">{alt.name}</p>
                                                  <p className="text-[10px] text-slate-400 font-bold">Qty: {alt.quantity}</p>
                                              </div>
                                              <span className="bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase group-hover:bg-green-600 group-hover:text-white group-hover:border-green-600">Select</span>
                                          </button>
                                      ))}
                                      {getAlternatives(substitutionSource.name).length === 0 && (
                                          <p className="p-6 text-center text-slate-400 text-xs italic">No matching substitutes found in pharmacy stock.</p>
                                      )}
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  <button onClick={handleForceAdd} className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Use Original Anyway</button>
                                  <button onClick={() => { setShowSubstitutionModal(false); setSubstitutionSource(null); }} className="bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border border-red-100">Cancel</button>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Template Selection Modal */}
      {templateConfig.isOpen && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
                  <h3 className="text-lg font-black text-slate-800 uppercase mb-4">Select Template</h3>
                  <div className="overflow-y-auto flex-grow space-y-2 custom-scrollbar">
                      {clinicalTemplates.filter(t => t.category === templateConfig.type).map(t => (
                          <button key={t.id} onClick={() => useTemplate(t)} className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors">
                              <p className="font-bold text-slate-800 text-sm mb-1">{t.title}</p>
                              <p className="text-xs text-slate-500 line-clamp-2 italic">{t.content}</p>
                          </button>
                      ))}
                      {clinicalTemplates.filter(t => t.category === templateConfig.type).length === 0 && (
                          <p className="text-center text-slate-400 italic py-8">No templates found for this category.</p>
                      )}
                  </div>
                  <button onClick={() => setTemplateConfig({isOpen: false, type: null})} className="mt-4 bg-slate-200 text-slate-800 py-3 rounded-xl font-bold uppercase text-xs w-full">Cancel</button>
              </div>
          </div>
      )}

      {/* Case Presets Selection Modal (Global Templates) */}
      {showGlobalTemplatesModal && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-black text-purple-700 uppercase">Select Case Preset (Global Template)</h3>
                      <button onClick={() => setShowGlobalTemplatesModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
                  </div>
                  <div className="overflow-y-auto flex-grow space-y-3 pr-1 custom-scrollbar">
                      {globalTemplates.map(gt => (
                          <div 
                              key={gt.id} 
                              onClick={() => applyGlobalTemplate(gt)} 
                              className="w-full text-left p-4 bg-purple-50/30 hover:bg-purple-50 rounded-xl border border-purple-100 transition-all cursor-pointer relative group shadow-sm flex justify-between items-start"
                          >
                              <div className="flex-grow pr-8">
                                  <p className="font-black text-slate-800 text-sm mb-1 uppercase tracking-tight">{gt.title}</p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-bold text-slate-500 uppercase mt-2">
                                      {gt.complaints?.trim() && <span className="truncate">Complaints: Yes</span>}
                                      {gt.prescription?.trim() && <span className="truncate text-green-700 font-extrabold">Prescription: Yes</span>}
                                      {gt.generalExamination?.trim() && <span className="truncate">Gen Exam: Yes</span>}
                                      {gt.customFieldsConfig?.length > 0 && <span className="truncate text-purple-700 font-extrabold">Custom Fields: {gt.customFieldsConfig.length}</span>}
                                  </div>
                              </div>
                              <button 
                                  onClick={(e) => deleteGlobalTemplate(gt.id, e)} 
                                  className="text-red-500 hover:text-red-700 text-xs font-black uppercase tracking-wider bg-red-50 border border-red-100 rounded-lg p-1.5 transition-all shadow-sm shrink-0"
                                  title="Delete Preset"
                              >
                                  Delete
                              </button>
                          </div>
                      ))}
                      {globalTemplates.length === 0 && (
                          <p className="text-center text-slate-400 italic py-12">No case presets saved yet. Set up EMR fields and click "Save Case Preset" to create one!</p>
                      )}
                  </div>
                  <button onClick={() => setShowGlobalTemplatesModal(false)} className="mt-4 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-xs w-full">Close</button>
              </div>
          </div>
      )}

      {/* ANC Modal */}
      {showAncModal && selectedPatient && selectedPatient.type === 'obstetric' && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-8 max-w-4xl w-full h-[90vh] overflow-y-auto relative">
                  <button onClick={() => setShowAncModal(false)} className="absolute top-6 right-6 text-3xl font-light text-slate-400 hover:text-slate-600">&times;</button>
                  <h2 className="text-3xl font-black text-pink-600 uppercase tracking-tighter mb-2">Antenatal Care Record</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">{selectedPatient.name} ({selectedPatient.age})</p>
                  <div className="grid grid-cols-2 gap-8 mb-8">
                      <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100">
                          <h4 className="font-black text-pink-400 uppercase text-xs tracking-widest mb-4">Pregnancy Dating</h4>
                          <div className="space-y-3">
                              <div className="flex justify-between border-b border-pink-100 pb-2"><span className="text-sm font-bold text-slate-600">LMP</span><span className="text-sm font-black text-slate-800">{selectedPatient.pregnancyInfo?.lmp || 'Not Set'}</span></div>
                              <div className="flex justify-between border-b border-pink-100 pb-2"><span className="text-sm font-bold text-slate-600">EDD</span><span className="text-sm font-black text-slate-800">{selectedPatient.pregnancyInfo?.edd || 'Not Set'}</span></div>
                              <div className="flex justify-between"><span className="text-sm font-bold text-slate-600">Current POG</span><span className="text-sm font-black text-pink-600">{selectedPatient.pregnancyInfo?.pog || 'Not Set'}</span></div>
                          </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                           <h4 className="font-black text-slate-400 uppercase text-xs tracking-widest mb-4">Previous History</h4>
                           <p className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{selectedPatient.obstetricHistory || 'No history recorded.'}</p>
                      </div>
                  </div>
                  <h4 className="font-black text-slate-800 uppercase text-sm tracking-widest mb-4">Visit History (Grouped by Episodes)</h4>
                  <div className="space-y-6 mt-4">
                      {patientEpisodes.map(ep => (
                          <div key={ep.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                              <div className="flex justify-between items-center border-b pb-2 mb-3">
                                  <span className="font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                      📂 Episode: {ep.name}
                                  </span>
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${ep.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                      {ep.status === 'open' ? 'Active' : 'Closed'}
                                  </span>
                              </div>
                              
                              <table className="w-full text-left text-sm bg-white rounded-xl overflow-hidden border">
                                  <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase border-b">
                                      <tr>
                                          <th className="p-3">Date</th>
                                          <th className="p-3">Weight</th>
                                          <th className="p-3">BP</th>
                                          <th className="p-3">POG</th>
                                          <th className="p-3">Investigations</th>
                                          <th className="p-3">Rx Prescribed</th>
                                          <th className="p-3">Notes</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                      {ep.visits.map(v => {
                                          const visitOrders = labOrders.filter(o => o.patientId === selectedPatient.id && new Date(o.timestamp).toISOString().slice(0,10) === v.date);
                                          return (
                                              <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                                  <td className="p-3 font-bold text-xs">{v.date}</td>
                                                  <td className="p-3 text-xs">{v.vitals?.weight || '-'}</td>
                                                  <td className="p-3 text-xs">{v.vitals?.bp || '-'}</td>
                                                  <td className="p-3 text-xs">{v.visitPog || '-'}</td>
                                                  <td className="p-3">
                                                      {visitOrders.map((ord, idx) => (
                                                          <button key={idx} onClick={() => setShowReportPreview(ord)} className="block text-[9px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded mb-1 border border-blue-100 hover:bg-blue-100">
                                                              {ord.ultrasound ? 'USG Report' : 'Lab Report'}
                                                          </button>
                                                      ))}
                                                      {visitOrders.length === 0 && <span className="text-[10px] text-slate-400">None</span>}
                                                  </td>
                                                  <td className="p-3 text-xs font-medium text-slate-700 whitespace-pre-wrap">{v.prescription || '-'}</td>
                                                  <td className="p-3 text-xs italic text-slate-500 max-w-xs truncate">{v.generalExamination}</td>
                                              </tr>
                                          );
                                      })}
                                      {ep.visits.length === 0 && (
                                          <tr>
                                              <td colSpan={7} className="p-4 text-center text-xs text-slate-400 italic">No visit records in this episode.</td>
                                          </tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      ))}
                      {patientEpisodes.length === 0 && (
                          <div className="text-center py-8 bg-slate-50 border border-dashed rounded-2xl text-slate-400 italic text-sm">
                              No history recorded yet for this patient.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* IPD Bed Selection Modal */}
      {showBedSelectionForIpd && selectedPatient && wards && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setShowBedSelectionForIpd(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 font-black text-2xl">&times;</button>
                  <h3 className="font-black text-2xl uppercase tracking-tighter mb-4 border-b pb-4">Select Bed For Admission</h3>
                  
                  <div className="space-y-6">
                      {wards.map(ward => (
                          <div key={ward.id} className="border rounded-2xl p-4 overflow-hidden shadow-sm">
                              <h4 className="font-black text-lg bg-slate-100 p-2 rounded-xl mb-4">{ward.name}</h4>
                              <div className="grid grid-cols-4 gap-3">
                                  {ward.beds.map(bed => {
                                      const isOccupied = ipdAdmissions.some(a => a.status === 'active' && a.bedId === bed.id);
                                      return (
                                          <button
                                              key={bed.id}
                                              disabled={isOccupied}
                                              onClick={() => {
                                                  if (onAddAdmission) {
                                                      const newAdm: IpdAdmission = {
                                                          id: 'adm-' + Date.now().toString(),
                                                          patientId: selectedPatient.id,
                                                          admissionDate: new Date().toISOString(),
                                                          wardId: ward.id,
                                                          bedId: bed.id,
                                                          diagnosis: localComplaints || 'Pending Diagnosis',
                                                          status: 'active',
                                                          primaryDoctor: doctorName,
                                                          dailyCharges: 0,
                                                          roundNotes: [], medications: [], nursingNotes: [], fluidBalance: [], charges: []
                                                      };
                                                      onAddAdmission(newAdm);
                                                      alert('Patient admitted to ' + ward.name + ' - Bed ' + bed.number);
                                                      setShowBedSelectionForIpd(false);
                                                      setShowOrderModal(false);
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

      {/* Past Visits Modal */}
{/* Past Visits Modal */}
      {showPastVisitsModal && selectedPatient && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-8 max-w-5xl w-full h-[90vh] overflow-y-auto relative">
                  <button onClick={() => setShowPastVisitsModal(false)} className="absolute top-6 right-6 text-3xl font-light text-slate-400 hover:text-slate-600">&times;</button>
                  <h2 className="text-3xl font-black text-orange-600 uppercase tracking-tighter mb-2">Past Visits & Reports</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">{selectedPatient.name} ({selectedPatient.age})</p>
                  
                  <div className="mb-4">
                      <button onClick={() => {
                          const date = prompt("Enter report date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
                          const title = prompt("Enter report title:");
                          if (date && title) {
                              onOrderLab({
                                  id: `ext-${Date.now()}`,
                                  patientId: selectedPatient.id,
                                  status: 'completed',
                                  timestamp: Date.now(),
                                  tests: {} as any,
                                  ultrasound: title.toLowerCase().includes('usg') || title.toLowerCase().includes('ultrasound'),
                                  reportData: { title, isExternal: true, externalLink: 'External Report Uploaded on ' + new Date().toLocaleString() } as any
                              });
                          }
                      }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg uppercase text-[10px] tracking-widest shadow">
                          + Upload External Report
                      </button>
                  </div>

                  <div className="space-y-6 mt-4">
                      {patientEpisodes.map(ep => (
                          <div key={ep.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left">
                              <div className="flex justify-between items-center border-b pb-2 mb-4">
                                  <span className="font-black text-sm uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                      📂 Episode: {ep.name}
                                  </span>
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${ep.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                      {ep.status === 'open' ? 'Active' : 'Closed'}
                                  </span>
                              </div>
                              
                              <table className="w-full text-left text-sm bg-white rounded-xl overflow-hidden border">
                                  <thead className="bg-slate-100 text-xs font-black text-slate-500 uppercase border-b">
                                      <tr>
                                          <th className="p-3">Date</th>
                                          <th className="p-3">Visit Type</th>
                                          <th className="p-3">Vitals</th>
                                          <th className="p-3">Investigations</th>
                                          <th className="p-3">Notes & Rx</th>
                                          <th className="p-3">External</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                      {ep.visits.map(v => {
                                          const visitOrders = labOrders.filter(o => o.patientId === selectedPatient.id && new Date(o.timestamp).toISOString().slice(0,10) === v.date);
                                          return (
                                              <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                                  <td className="p-3 font-bold text-xs">{v.date}</td>
                                                  <td className="p-3 text-xs">{v.visitType}</td>
                                                  <td className="p-3 text-[10px] leading-relaxed">
                                                      BP: {v.vitals?.bp || '-'} <br/>
                                                      HR: {v.vitals?.pulse || '-'} bpm <br/>
                                                      WT: {v.vitals?.weight || '-'} kg <br/>
                                                      HT: {v.vitals?.height || '-'} cm
                                                  </td>
                                                  <td className="p-3">
                                                      {visitOrders.map((ord, idx) => (
                                                          <button key={idx} onClick={() => {
                                                              if ((ord.reportData as any)?.isExternal) {
                                                                  alert((ord.reportData as any).title + ' : ' + (ord.reportData as any).externalLink);
                                                              } else {
                                                                  setShowReportPreview(ord);
                                                              }
                                                          }} className="block text-[9px] bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded mb-1 border border-blue-100 hover:bg-blue-100 w-full text-left">
                                                              📄 {(ord.reportData as any)?.title || (ord.ultrasound ? 'USG Report' : 'Lab Report')}
                                                          </button>
                                                      ))}
                                                      {visitOrders.length === 0 && <span className="text-xs text-slate-400">None</span>}
                                                  </td>
                                                  <td className="p-3 text-[11px] leading-relaxed text-slate-700 max-w-xs break-words">
                                                      <div className="font-bold text-slate-800">Complaints: {v.complaints || '-'}</div>
                                                      <div className="italic text-slate-500 mt-1">Exam: {v.generalExamination || '-'}</div>
                                                      <div className="text-blue-600 font-bold mt-1">Rx: {v.prescription || '-'}</div>
                                                  </td>
                                                  <td className="p-3">
                                                      <button onClick={() => {
                                                          const title = prompt("Enter report title:");
                                                          if (title) {
                                                              onOrderLab({
                                                                  id: `ext-${Date.now()}`,
                                                                  patientId: selectedPatient.id,
                                                                  status: 'completed',
                                                                  timestamp: Date.parse(v.date),
                                                                  tests: {} as any,
                                                                  ultrasound: title.toLowerCase().includes('usg') || title.toLowerCase().includes('ultrasound'),
                                                                  reportData: { title, isExternal: true, externalLink: 'External Report Uploaded on ' + new Date().toLocaleString() } as any
                                                              });
                                                          }
                                                      }} className="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold hover:bg-slate-200">Upload</button>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Billing Modal */}
      {showBillingModal && currentBillVisit && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Collect Payment</h3><button onClick={() => { setShowBillingModal(false); setCurrentBillVisit(null); }} className="text-slate-400 text-2xl">&times;</button></div>
                  <div className="p-6 overflow-y-auto flex-grow space-y-4">
                      {currentBillVisit.collectedBy && <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex items-center gap-3"><span className="text-xl">✅</span><div><p className="text-xs font-black text-green-700 uppercase">Payment Already Collected</p><p className="text-xs text-green-600">Collected by {currentBillVisit.collectedBy}</p></div></div>}
                      <div><p className="text-[10px] font-black text-slate-400 uppercase mb-2">Billable Items (Editable)</p><div className="space-y-2">{billItems.map((item, idx) => (<div key={idx} className="flex gap-2 items-center"><input value={item.name} onChange={e => { const newItems = [...billItems]; newItems[idx].name = e.target.value; setBillItems(newItems); }} className="flex-grow border rounded-lg px-3 py-2 text-sm font-bold text-slate-700" /><input type="number" value={item.price} onChange={e => { const newItems = [...billItems]; newItems[idx].price = Number(e.target.value); setBillItems(newItems); }} className="w-24 border rounded-lg px-3 py-2 text-sm font-bold text-right" /></div>))}</div></div>
                      <div className="flex justify-end pt-4 border-t border-slate-100"><div className="w-1/2 space-y-2"><div className="flex justify-between text-sm"><span className="text-slate-500 font-bold">Subtotal</span><span className="font-bold">₹{billItems.reduce((a,b)=>a+b.price, 0)}</span></div><div className="flex justify-between items-center gap-2"><span className="text-slate-500 font-bold text-sm">Discount</span><input type="number" value={billDiscount} onChange={e => setBillDiscount(Number(e.target.value))} className="w-20 border rounded-lg px-2 py-1 text-right text-sm font-bold text-red-500" /></div><div className="flex justify-between text-lg pt-2 border-t border-slate-200"><span className="font-black text-slate-800">Grand Total</span><span className="font-black text-blue-600">₹{billItems.reduce((a,b)=>a+b.price, 0) - billDiscount}</span></div></div></div>
                  </div>
                  <div className="p-6 bg-slate-50 border-t grid grid-cols-2 gap-4"><button onClick={() => handleFinalizeBill('cash')} className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">Confirm Cash</button><button onClick={() => handleFinalizeBill('upi')} className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">Confirm UPI</button></div>
              </div>
          </div>
      )}

      {/* Report Preview Modal */}
      {showReportPreview && showReportPreview.reportData && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[120] flex items-center justify-center p-4">
           <div className="bg-slate-200 rounded-3xl w-full max-w-5xl h-[95vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="bg-white p-6 border-b flex justify-between items-center"><div><h3 className="font-black text-slate-900 uppercase tracking-tighter text-xl">Lab Report Viewer</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Read Only Mode</p></div><div className="flex gap-4"><button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-all">🖨️ Print Report</button><button onClick={() => setShowReportPreview(null)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Close</button></div></div>
              <div className="flex-grow overflow-auto p-10 flex justify-center bg-slate-100" id="print-container"><div className="origin-top transform scale-90 md:scale-100"><ReportPreview reportData={showReportPreview.reportData} selectedTests={showReportPreview.tests} settings={printSettings} /></div></div>
           </div>
        </div>
      )}

      {/* USG Referral Modal */}
      {showUsgModal && selectedPatient && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">USG Referral</h3>
                      <button onClick={() => setShowUsgModal(false)} className="text-slate-400 text-2xl">&times;</button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-grow space-y-4">
                      <p className="text-xs font-bold text-slate-500 uppercase">Select Indications for Sonography</p>
                      <div className="grid grid-cols-2 gap-2">
                          {USG_INDICATIONS.map(ind => (
                              <label key={ind} className="flex items-center gap-2 p-2 bg-slate-50 rounded border hover:bg-purple-50 cursor-pointer">
                                  <input type="checkbox" checked={selectedUsgIndications.includes(ind)} onChange={(e) => {
                                      if (e.target.checked) setSelectedUsgIndications(prev => [...prev, ind]);
                                      else setSelectedUsgIndications(prev => prev.filter(i => i !== ind));
                                  }} className="rounded text-purple-600 focus:ring-purple-500" />
                                  <span className="text-[10px] font-bold text-slate-700 uppercase">{ind}</span>
                              </label>
                          ))}
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 border-t flex justify-end gap-4">
                      <button onClick={() => setShowUsgModal(false)} className="px-6 py-2 rounded-xl text-slate-600 font-bold uppercase text-xs">Cancel</button>
                      <button onClick={handlePrintUsgReferral} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">Print Referral</button>
                  </div>
              </div>
          </div>
      )}

      {/* Customize UI Fields Modal */}
      {showCustomizeModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button onClick={() => setShowCustomizeModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-905 font-black text-2xl">&times;</button>
            <h3 className="font-black text-2xl uppercase tracking-tighter mb-2 border-b pb-4">Customize EMR Fields & Formulas</h3>
            
            <div className="flex-grow overflow-y-auto space-y-6 pr-2">
              <div className="bg-slate-50 border p-4 rounded-2xl text-left">
                <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-2">Default Prescription Mode</h4>
                <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
                    <button 
                      onClick={() => {
                        localStorage.setItem(`defaultRxMode_${doctorName}`, 'digital');
                        setPrescriptionMode('digital');
                      }} 
                      className={`px-4 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${(localStorage.getItem(`defaultRxMode_${doctorName}`) || 'digital') === 'digital' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                    >
                      Digital Rx
                    </button>
                    <button 
                      onClick={() => {
                        localStorage.setItem(`defaultRxMode_${doctorName}`, 'manual');
                        setPrescriptionMode('manual');
                      }} 
                      className={`px-4 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${(localStorage.getItem(`defaultRxMode_${doctorName}`) || 'digital') === 'manual' ? 'bg-white shadow text-purple-600' : 'text-slate-500'}`}
                    >
                      Manual Rx
                    </button>
                </div>
              </div>

              <div>
                <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3">Field Visibility, Renaming & Ordering</h4>
                <div className="space-y-2">
                  {fieldsConfig.map((field, index) => (
                    <div key={field.id} className="flex items-center justify-between bg-slate-50 border p-3 rounded-xl gap-4 text-left">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={field.visible} 
                          onChange={(e) => {
                            const updated = fieldsConfig.map(f => f.id === field.id ? { ...f, visible: e.target.checked } : f);
                            setFieldsConfig(updated);
                            const pType = selectedPatient?.type || 'general';
                            localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(updated));
                          }}
                          className="h-4 w-4 rounded text-blue-600 border-gray-300"
                        />
                        <span className="font-bold text-slate-600 text-xs uppercase">{field.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={field.label} 
                          onChange={(e) => {
                            const updated = fieldsConfig.map(f => f.id === field.id ? { ...f, label: e.target.value } : f);
                            setFieldsConfig(updated);
                            const pType = selectedPatient?.type || 'general';
                            localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(updated));
                          }}
                          className="bg-white border rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none w-48"
                        />
                        <div className="flex gap-1">
                          <button 
                            disabled={index === 0} 
                            onClick={() => {
                              const updated = [...fieldsConfig];
                              const temp = updated[index];
                              updated[index] = updated[index - 1];
                              updated[index - 1] = temp;
                              setFieldsConfig(updated);
                              const pType = selectedPatient?.type || 'general';
                              localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(updated));
                            }} 
                            className="bg-white border hover:bg-slate-100 rounded px-1.5 py-0.5 text-xs disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button 
                            disabled={index === fieldsConfig.length - 1} 
                            onClick={() => {
                              const updated = [...fieldsConfig];
                              const temp = updated[index];
                              updated[index] = updated[index + 1];
                              updated[index + 1] = temp;
                              setFieldsConfig(updated);
                              const pType = selectedPatient?.type || 'general';
                              localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(updated));
                            }} 
                            className="bg-white border hover:bg-slate-100 rounded px-1.5 py-0.5 text-xs disabled:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Custom EMR Text Fields</h4>
                  <button 
                    onClick={() => {
                      const label = prompt("Enter text field label (e.g. Family History):");
                      if (label) {
                        const newId = 'custom_' + Date.now();
                        const nextNum = fieldsConfig.length + 1;
                        const newField = { 
                          id: newId, 
                          name: label, 
                          visible: true, 
                          label: `${nextNum}. ${label}` 
                        };
                        const updated = [...fieldsConfig, newField];
                        setFieldsConfig(updated);
                        const pType = selectedPatient?.type || 'general';
                        localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(updated));
                      }
                    }} 
                    className="bg-green-600 text-white font-black text-[9px] uppercase px-3 py-1.5 rounded-lg hover:bg-green-700 transition-all hover:scale-105 active:scale-95 shadow-sm"
                  >
                    + Add Text Field
                  </button>
                </div>
                <div className="space-y-2 mb-4">
                  {fieldsConfig.filter(f => f.id.startsWith('custom_')).map((f) => (
                    <div key={f.id} className="bg-slate-50 border p-3 rounded-xl flex items-center justify-between text-left">
                      <div>
                        <div className="font-bold text-xs text-slate-800">{f.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-1">Field ID: {f.id}</div>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${f.name}"?`)) {
                            const updated = fieldsConfig.filter(field => field.id !== f.id);
                            setFieldsConfig(updated);
                            const pType = selectedPatient?.type || 'general';
                            localStorage.setItem(`fieldsConfig_${doctorName}_${pType}`, JSON.stringify(updated));
                          }
                        }} 
                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs px-2 py-1 rounded-lg transition-all hover:scale-105 active:scale-95"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {fieldsConfig.filter(f => f.id.startsWith('custom_')).length === 0 && (
                    <p className="text-xs text-slate-400 italic mb-4">No custom text fields defined for this patient type yet.</p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Custom Calculative Fields (Formulas)</h4>
                  <button 
                    onClick={() => {
                      const name = prompt("Enter field name (e.g. Weight Change):");
                      const formula = prompt("Enter formula. Use [weight], [height], [pulse], [spo2] as variables. (e.g. [weight] - 70):");
                      if (name && formula) {
                        const updated = [...customCalculativeFields, { name, formula, result: '' }];
                        setCustomCalculativeFields(updated);
                        localStorage.setItem(`customCalculativeFields_${doctorName}`, JSON.stringify(updated));
                      }
                    }} 
                    className="bg-blue-600 text-white font-black text-[9px] uppercase px-3 py-1.5 rounded-lg hover:bg-blue-700"
                  >
                    + Add Formula
                  </button>
                </div>
                <div className="space-y-2">
                  {customCalculativeFields.map((cf, idx) => (
                    <div key={idx} className="bg-slate-50 border p-3 rounded-xl flex items-center justify-between text-left">
                      <div>
                        <div className="font-bold text-xs text-slate-800">{cf.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{cf.formula}</div>
                      </div>
                      <button 
                        onClick={() => {
                          const updated = customCalculativeFields.filter((_, i) => i !== idx);
                          setCustomCalculativeFields(updated);
                          localStorage.setItem(`customCalculativeFields_${doctorName}`, JSON.stringify(updated));
                        }} 
                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs px-2 py-1 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {customCalculativeFields.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No custom formula fields defined.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-4 flex justify-end">
              <button onClick={() => setShowCustomizeModal(false)} className="bg-slate-900 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl hover:bg-slate-800">Done</button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Add Patient Modal */}
      {showQuickAddPatientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative flex flex-col gap-4 text-left">
            <button 
              onClick={() => setShowQuickAddPatientModal(false)} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 font-black text-2xl"
            >
              &times;
            </button>
            
            <div>
              <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Quick Add Patient</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Register walk-in patient from cabin</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={quickName} 
                  onChange={e => setQuickName(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none text-slate-800" 
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Age</label>
                  <input 
                    type="number" 
                    value={quickAge} 
                    onChange={e => setQuickAge(e.target.value)} 
                    className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none text-slate-800" 
                    placeholder="Age"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Gender</label>
                  <select 
                    value={quickGender} 
                    onChange={e => setQuickGender(e.target.value as any)} 
                    className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none text-slate-800"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Mobile Number (Optional)</label>
                <input 
                  type="text" 
                  value={quickMobile} 
                  onChange={e => setQuickMobile(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none text-slate-800" 
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Patient Type / Department</label>
                <select 
                  value={quickType} 
                  onChange={e => setQuickType(e.target.value as any)} 
                  className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none text-slate-800"
                >
                  <option value="general">General Medicine</option>
                  <option value="obstetric">Obstetrics (Pregnancy / ANC)</option>
                  <option value="gynecology">Gynecology</option>
                  <option value="surgery">General Surgery / Pre-Op</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Chief Complaints</label>
                <textarea 
                  value={quickComplaints} 
                  onChange={e => setQuickComplaints(e.target.value)} 
                  className="w-full h-16 border rounded-xl px-3 py-2 text-sm font-bold outline-none text-slate-800 resize-none" 
                  placeholder="Primary complaints..."
                />
              </div>
            </div>

            <div className="border-t pt-4 flex justify-end gap-3">
              <button 
                onClick={() => setShowQuickAddPatientModal(false)} 
                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold uppercase text-xs transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleQuickAddPatient} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-black uppercase text-xs shadow-lg transition-all active:scale-95"
              >
                Register & Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
