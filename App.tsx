
import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserRole, Patient, VisitRecord, LabOrder, CbcReportData, 
  ClinicalTemplate, InventoryItem, SavedReport, MedicationMasterData, Consultant, AppPrintSettings, AppConfig, Ward, IpdAdmission, ServicePrices, PharmacyItem, PharmacySupplier, PharmacySale, Specialty, SystemUser, RegistryTemplate, RegistryRecord
} from './types';
import { initFirebase, syncToCloud, setupCloudListener, getCloudConfig } from './services/firebaseService';
import { RestartIcon } from './components/icons/RestartIcon';
import LabView from './components/LabView';
import DoctorDashboard from './components/DoctorDashboard';
import OPDCounter from './components/OPDCounter';
import AdminPanel from './components/AdminPanel';
import MasterPanel from './components/MasterPanel';
import IpdLayout from './components/ipd/IpdLayout';
import PharmacyDashboard from './components/PharmacyDashboard';
import GlobalStats from './components/GlobalStats';
import AnalyticsTab from './components/AnalyticsTab';
import UsgSection from './components/UsgSection';
import { getPrintSettings, savePrintSettings } from './services/printSettingsService';
import AppConfigModal from './components/AppConfigModal';
import { DEFAULT_PRICES } from './services/billingService';
import { DataMigration } from './components/DataMigration';

const App: React.FC = () => {
  // Login & Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('none');
  const [loggedInUserName, setLoggedInUserName] = useState<string | null>(null);
  
  // Login Form State
  const [loginStep, setLoginStep] = useState<'credentials' | 'role_selection' | 'migration'>('credentials');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pin, setPin] = useState('');
  const [authenticatedUser, setAuthenticatedUser] = useState<SystemUser | Consultant | null>(null);

  // Print Settings State
  const [printSettings, setPrintSettings] = useState<AppPrintSettings>(getPrintSettings());
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  // App Centralized Configuration State
  const [appConfig, setAppConfig] = useState<AppConfig>({
      geminiKey: localStorage.getItem('gemini_api_key') || '',
      serialNumber: 'LIC-MOCK-12345-ACTIVE',
      isActivated: true,
      activatedFacilities: {
          opd: true,
          ipd: true,
          lab: true,
          pharmacy: true,
          usg: true
      },
      isMedMasterSetupDone: false,
      isBillingSetupDone: false
  });
  const [showAppConfig, setShowAppConfig] = useState(false);

  // Centralized State for Cloud Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [clinicalTemplates, setClinicalTemplates] = useState<ClinicalTemplate[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reportHistory, setReportHistory] = useState<SavedReport[]>([]);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [medicationMaster, setMedicationMaster] = useState<MedicationMasterData>({
    groups: [], drugs: [], frequencies: [], instructions: []
  });
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [billingRates, setBillingRates] = useState<ServicePrices>(DEFAULT_PRICES);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  
  // IPD & Pharmacy State
  const [wards, setWards] = useState<Ward[]>([]);
  const [ipdAdmissions, setIpdAdmissions] = useState<IpdAdmission[]>([]);
  const [pharmacyInventory, setPharmacyInventory] = useState<PharmacyItem[]>([]);
  const [pharmacySuppliers, setPharmacySuppliers] = useState<PharmacySupplier[]>([]);
  const [pharmacySales, setPharmacySales] = useState<PharmacySale[]>([]);
  const [registryTemplates, setRegistryTemplates] = useState<RegistryTemplate[]>([]);
  const [registryRecords, setRegistryRecords] = useState<RegistryRecord[]>([]);

  useEffect(() => {
    const config = getCloudConfig();
    if (config) {
        initFirebase(config);
    }

    const unsubscribe = setupCloudListener((key, data) => {
      if (key === 'patients') setPatients(data || []);
      if (key === 'visits') setVisits(data || []);
      if (key === 'labOrders') setLabOrders(data || []);
      if (key === 'clinicalTemplates') setClinicalTemplates(data || []);
      if (key === 'labInventory') setInventory(data || []);
      if (key === 'reportHistory') setReportHistory(data || []);
      if (key === 'notifications') setActiveNotification(data);
      if (key === 'printSettings') {
          if (data) {
              setPrintSettings(data);
              savePrintSettings(data);
          }
      }
      if (key === 'medicationMaster') setMedicationMaster(data || { groups: [], drugs: [], frequencies: [], instructions: [] });
      if (key === 'billingRates') setBillingRates(data ? { ...DEFAULT_PRICES, ...data } : DEFAULT_PRICES);
      if (key === 'pharmacyInventory') setPharmacyInventory(data || []);
      if (key === 'pharmacySuppliers') setPharmacySuppliers(data || []);
      if (key === 'pharmacySales') setPharmacySales(data || []);
      if (key === 'specialties') setSpecialties(data || []);
      if (key === 'systemUsers') setSystemUsers(data || []);
      if (key === 'registryRecords') setRegistryRecords(data || []);
      if (key === 'appConfig') {
          if (!data) {
              const defaults: AppConfig = {
                  geminiKey: localStorage.getItem('gemini_api_key') || '',
                  serialNumber: 'LIC-MOCK-12345-ACTIVE',
                  isActivated: true,
                  activatedFacilities: {
                      opd: true,
                      ipd: true,
                      lab: true,
                      pharmacy: true,
                      usg: true
                  },
                  isMedMasterSetupDone: false,
                  isBillingSetupDone: false
              };
              setAppConfig(defaults);
              syncToCloud('appConfig', defaults);
          } else {
              setAppConfig({
                  ...data,
                  activatedFacilities: data.activatedFacilities || {
                      opd: true,
                      ipd: true,
                      lab: true,
                      pharmacy: true,
                      usg: true
                  }
              });
              if (data.geminiKey) {
                  localStorage.setItem('gemini_api_key', data.geminiKey);
              }
          }
      }
      if (key === 'registryTemplates') {
          if (!data || data.length === 0) {
              const defaults: RegistryTemplate[] = [
                  { id: '1', name: 'High Risk Pregnancy Register', fields: ['Date', 'Patient Name', 'Age', 'Parity', 'LMP', 'EDD', 'Risk Factors', 'Action Taken', 'Outcome'], isMandatory: true },
                  { id: '2', name: 'EDD Register', fields: ['EDD Date', 'Patient Name', 'Age', 'Contact', 'Delivery Expected in', 'Actual Outcome', 'Mode of Delivery'], isMandatory: true },
                  { id: '3', name: 'MDR (Maternal Death Review)', fields: ['Date of Death', 'Patient Name', 'Age', 'Parity', 'Admission Date', 'Cause of Death', 'Review Committee Notes'], isMandatory: true },
                  { id: '4', name: 'OT Register', fields: ['Date', 'Patient Name', 'Age', 'Procedure', 'Surgeon', 'Anesthetist', 'Anesthesia Type', 'Complications'], isMandatory: true },
                  { id: '5', name: 'Delivery Register', fields: ['Date & Time', 'Patient Name', 'Age', 'Parity', 'Mode of Delivery', 'Baby Sex', 'Baby Weight', 'Apgar Score', 'Complications', 'Conducted By'], isMandatory: true },
              ];
              setRegistryTemplates(defaults);
              syncToCloud('registryTemplates', defaults);
          } else {
              setRegistryTemplates(data);
          }
      }
      
      if (key === 'consultants') {
          if (!data || data.length === 0) {
              const defaults: Consultant[] = [
                  { id: '1', name: 'Dr. Mohit Agrawal', department: 'obgyn', isActive: true, baseFee: 200, pin: '1401', roles: ['doctor'] },
                  { id: '2', name: 'Dr. Parul Agrawal', department: 'obgyn', isActive: true, baseFee: 200, pin: '0608', roles: ['doctor'] },
                  { id: '3', name: 'Dr. Manjulata Agrawal', department: 'obgyn', isActive: true, baseFee: 200, pin: '1411', roles: ['doctor'] },
                  { id: '4', name: 'Dr. Omprakash Agrawal', department: 'surgery', isActive: true, baseFee: 200, pin: '0709', roles: ['doctor'] }
              ];
              setConsultants(defaults);
              syncToCloud('consultants', defaults);
          } else {
              setConsultants(data);
          }
      }
      if (key === 'ipdAdmissions') setIpdAdmissions(data || []);
      if (key === 'wards') {
          if (!data || data.length === 0) {
              // Initialize default wards
              const defaultWards: Ward[] = [
                  { id: 'gen', name: 'General Ward', beds: Array.from({length: 10}, (_, i) => ({ id: `g-${i+1}`, number: `G-${i+1}`, type: 'general', status: 'available', pricePerDay: 500 })) },
                  { id: 'semi', name: 'Semi-Private', beds: Array.from({length: 6}, (_, i) => ({ id: `sp-${i+1}`, number: `SP-${i+1}`, type: 'semi_private', status: 'available', pricePerDay: 1200 })) },
                  { id: 'pvt', name: 'Private Room', beds: Array.from({length: 4}, (_, i) => ({ id: `p-${i+1}`, number: `P-${i+1}`, type: 'private', status: 'available', pricePerDay: 2500 })) },
                  { id: 'icu', name: 'ICU', beds: Array.from({length: 2}, (_, i) => ({ id: `icu-${i+1}`, number: `ICU-${i+1}`, type: 'icu', status: 'available', pricePerDay: 5000 })) },
                  { id: 'mat', name: 'Maternity Ward', beds: Array.from({length: 5}, (_, i) => ({ id: `m-${i+1}`, number: `M-${i+1}`, type: 'general', status: 'available', pricePerDay: 800 })) },
              ];
              setWards(defaultWards);
              syncToCloud('wards', defaultWards);
          } else {
              setWards(data);
          }
      }
    });
    return () => unsubscribe();
  }, []);

  // Combine System Users and Consultants for Login
  const allLoginUsers = useMemo(() => {
      const users = [...systemUsers];
      consultants.forEach(c => {
          // Avoid duplicates if consultant is also added as system user manually (rare but possible)
          if (!users.some(u => u.name === c.name)) {
              users.push({
                  id: c.id,
                  name: c.name,
                  roles: c.roles || ['doctor'],
                  pin: c.pin || '',
                  isActive: c.isActive
              } as SystemUser);
          }
      });
      return users.sort((a,b) => a.name.localeCompare(b.name));
  }, [systemUsers, consultants]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Master Bypass
    if (pin === '5473') {
        setUserRole('superadmin');
        setLoggedInUserName('Master Admin');
        setIsLoggedIn(true);
        setPin('');
        return;
    }

    const user = allLoginUsers.find(u => u.id === selectedUserId);
    if (user && user.pin === pin) {
        if (!user.isActive) { alert("Account Disabled"); return; }

        setAuthenticatedUser(user);
        setLoggedInUserName(user.name);
        
        // Handle Role Logic
        const legacyRole = 'role' in user ? user.role : undefined;
        const rawRoles = user.roles && user.roles.length > 0 ? user.roles : (legacyRole ? [legacyRole] : []);
        const roles = rawRoles.filter(r => {
            if (r === 'opd' && !appConfig.activatedFacilities.opd) return false;
            if (r === 'ipd' && !appConfig.activatedFacilities.ipd) return false;
            if (r === 'lab' && !appConfig.activatedFacilities.lab) return false;
            if (r === 'pharmacy' && !appConfig.activatedFacilities.pharmacy) return false;
            if (r === 'usg' && !appConfig.activatedFacilities.usg) return false;
            if (r === 'superadmin') return false; // superadmin tab is not present
            return true;
        });
        
        if (roles.length === 0) {
            alert("No active roles or facilities assigned to this user.");
            return;
        }

        if (roles.length === 1) {
            // Direct Login
            setUserRole(roles[0]);
            setIsLoggedIn(true);
        } else {
            // Multi-Role Selection
            setLoginStep('role_selection');
        }
        setPin('');
    } else {
        alert("Invalid User or PIN");
    }
  };

  const handleRoleSelect = (role: UserRole) => {
      setUserRole(role);
      setIsLoggedIn(true);
  };

  const handleOpenAppConfig = () => {
      const input = prompt("Enter Master PIN to Configure App Settings:");
      if (input === '5473') {
          setShowAppConfig(true);
      } else {
          alert("Incorrect PIN");
      }
  };

  const handleLogout = () => {
    setUserRole('none');
    setPin('');
    setIsLoggedIn(false);
    setLoggedInUserName(null);
    setAuthenticatedUser(null);
    setLoginStep('credentials');
    setSelectedUserId('');
  };

  const handleSwitchRole = () => {
      if (authenticatedUser) {
          setIsLoggedIn(false);
          setLoginStep('role_selection');
      } else {
          handleLogout();
      }
  };

  const updatePatients = (data: Patient[]) => { setPatients(data); syncToCloud('patients', data); };
  const updateVisits = (data: VisitRecord[]) => { setVisits(data); syncToCloud('visits', data); };
  const updateLabOrders = (data: LabOrder[]) => { setLabOrders(data); syncToCloud('labOrders', data); };
  const updateClinicalTemplates = (data: ClinicalTemplate[]) => { setClinicalTemplates(data); syncToCloud('clinicalTemplates', data); };
  const updateInventory = (data: InventoryItem[]) => { setInventory(data); syncToCloud('labInventory', data); };
  const updateReportHistory = (data: SavedReport[]) => { setReportHistory(data); syncToCloud('reportHistory', data); };
  const updateMedicationMaster = (data: MedicationMasterData) => { setMedicationMaster(data); syncToCloud('medicationMaster', data); };
  const updateConsultants = (data: Consultant[]) => { setConsultants(data); syncToCloud('consultants', data); };
  const updateSpecialties = (data: Specialty[]) => { setSpecialties(data); syncToCloud('specialties', data); };
  const updateWards = (data: Ward[]) => { setWards(data); syncToCloud('wards', data); };
  const updateAdmissions = (data: IpdAdmission[]) => { setIpdAdmissions(data); syncToCloud('ipdAdmissions', data); };
  const updateBillingRates = (data: ServicePrices) => { setBillingRates(data); syncToCloud('billingRates', data); };
  
  const updatePharmacyInventory = (data: PharmacyItem[]) => { setPharmacyInventory(data); syncToCloud('pharmacyInventory', data); };
  const updatePharmacySuppliers = (data: PharmacySupplier[]) => { setPharmacySuppliers(data); syncToCloud('pharmacySuppliers', data); };
  const updatePharmacySales = (data: PharmacySale[]) => { setPharmacySales(data); syncToCloud('pharmacySales', data); };
  const updateSystemUsers = (data: SystemUser[]) => { setSystemUsers(data); syncToCloud('systemUsers', data); };
  const updatePrintSettings = (data: AppPrintSettings) => { setPrintSettings(data); savePrintSettings(data); syncToCloud('printSettings', data); };

  const sendNotification = (msg: string) => {
    syncToCloud('notifications', msg);
    setTimeout(() => {
      syncToCloud('notifications', null);
    }, 5000);
  };

  const dismissNotification = () => {
    setActiveNotification(null);
    syncToCloud('notifications', null);
  };

  const renderDashboard = () => {
    switch (userRole) {
      case 'opd':
        return <OPDCounter 
                 patients={patients} 
                 visits={visits} 
                 labOrders={labOrders} 
                 consultants={consultants} 
                 printSettings={printSettings} 
                 billingRates={billingRates} 
                 wards={wards}
                 admissions={ipdAdmissions}
                 registryTemplates={registryTemplates}
                 onRegister={(p, v) => { updatePatients([...patients, p]); updateVisits([...visits, v]); }} 
                 onUpdateVisits={updateVisits} 
                 onAddAdmission={(adm) => updateAdmissions([...ipdAdmissions, adm])}
               />;
      case 'doctor':
        return <DoctorDashboard 
           doctorName={loggedInUserName || 'Doctor'} 
           patients={patients} 
           visits={visits} 
           labOrders={labOrders} 
           clinicalTemplates={clinicalTemplates} 
           medicationMaster={medicationMaster}
           pharmacyInventory={pharmacyInventory}
           pharmacySales={pharmacySales}
           printSettings={printSettings}
           billingRates={billingRates}
           ipdAdmissions={ipdAdmissions}
           consultants={consultants}
           registryTemplates={registryTemplates}
          onUpdateVisits={updateVisits} 
          onUpdatePatients={updatePatients} 
          onUpdateTemplates={updateClinicalTemplates} 
          onOrderLab={(o) => updateLabOrders([...labOrders, o])} 
          onCancelOrder={(id) => updateLabOrders(labOrders.filter(o => o.id !== id))} 
          onCallPatient={sendNotification} 
        />;
      case 'lab':
        return <LabView 
            patients={patients} 
            labOrders={labOrders} 
            printSettings={printSettings} 
            inventory={inventory}
            consultants={consultants}
            onUpdateInventory={updateInventory}
            onCompleteOrder={(id, data, tests) => {
              updateLabOrders(labOrders.map(o => o.id === id ? { ...o, status: 'completed', reportData: data } : o));
              const newReport: SavedReport = { reportData: data, selectedTests: tests, timestamp: Date.now() };
              updateReportHistory([newReport, ...reportHistory]);
            }} 
        />;
      case 'admin':
      case 'superadmin':
        return <AdminPanel 
          patients={patients} 
          visits={visits} 
          labOrders={labOrders} 
          inventory={inventory} 
          reportHistory={reportHistory} 
          consultants={consultants}
          specialties={specialties}
          printSettings={printSettings}
          billingRates={billingRates}
          wards={wards}
          systemUsers={systemUsers}
          onUpdateInventory={updateInventory} 
          onUpdateReports={updateReportHistory} 
          onUpdatePatients={updatePatients}
          onUpdateLabOrders={updateLabOrders}
          onUpdateVisits={updateVisits}
          onUpdateConsultants={updateConsultants}
          onUpdateSpecialties={updateSpecialties}
          onUpdateBillingRates={updateBillingRates}
          onUpdateWards={updateWards}
          onUpdateSystemUsers={updateSystemUsers}
          onUpdatePrintSettings={updatePrintSettings}
          userRole={userRole} 
        />;
      case 'master':
        return <MasterPanel 
          clinicalTemplates={clinicalTemplates} 
          onUpdateTemplates={updateClinicalTemplates} 
          medicationMaster={medicationMaster}
          onUpdateMedicationMaster={updateMedicationMaster}
          pharmacyInventory={pharmacyInventory}
          onUpdatePharmacyInventory={updatePharmacyInventory}
        />;
      case 'ipd':
      case 'nurse':
        return <IpdLayout
          wards={wards}
          patients={patients}
          visits={visits}
          admissions={ipdAdmissions}
          consultants={consultants}
          billingRates={billingRates}
          clinicalTemplates={clinicalTemplates}
          registryTemplates={registryTemplates}
          printSettings={printSettings}
          onUpdateWards={updateWards}
          onUpdateAdmissions={updateAdmissions}
          onUpdateTemplates={updateClinicalTemplates}
          onUpdatePatients={updatePatients}
          userRole={userRole}
          loggedInUserName={loggedInUserName}
        />;
      case 'pharmacy':
        return <PharmacyDashboard
          pharmacyInventory={pharmacyInventory}
          visits={visits}
          patients={patients}
          suppliers={pharmacySuppliers}
          sales={pharmacySales}
          printSettings={printSettings}
          onUpdateInventory={updatePharmacyInventory}
          onUpdateSuppliers={updatePharmacySuppliers}
          onUpdateSales={updatePharmacySales}
        />;
      case 'global_stats':
        return <GlobalStats 
            visits={visits} 
            patients={patients} 
            consultants={consultants} 
            reportHistory={reportHistory} 
            inventory={inventory}
            onUpdateInventory={updateInventory}
            onUpdateReports={updateReportHistory}
            onBack={handleLogout}
        />;
      case 'analytics':
        return <AnalyticsTab 
          registryTemplates={registryTemplates}
          registryRecords={registryRecords}
          patients={patients}
          admissions={ipdAdmissions}
          visits={visits}
          onUpdateTemplates={(t) => { setRegistryTemplates(t); syncToCloud('registryTemplates', t); }}
          onUpdateRecords={(r) => { setRegistryRecords(r); syncToCloud('registryRecords', r); }}
        />;
      case 'usg':
        return <UsgSection
          patients={patients}
          labOrders={labOrders}
          consultants={consultants}
          printSettings={printSettings}
          onUpdateLabOrders={updateLabOrders}
          onUpdatePatients={updatePatients}
        />;
      default:
        return null;
    }
  };

  // --- LOGIN SCREEN & ROLE SELECTION ---
  if (!isLoggedIn) {
    if (loginStep === 'migration') {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="w-full">
                    <button onClick={() => setLoginStep('credentials')} className="mb-4 text-blue-600 font-bold hover:underline absolute top-4 left-4 flex items-center gap-2">
                        &larr; Back to Login
                    </button>
                    <DataMigration />
                </div>
            </div>
        );
    }

    if (loginStep === 'role_selection' && authenticatedUser) {
        // Multi-Role Selection UI
        // Use type narrowing to safely access optional 'role' property if it exists on SystemUser
        const legacyRole = 'role' in authenticatedUser ? authenticatedUser.role : undefined;
        const rawRoles = authenticatedUser.roles && authenticatedUser.roles.length > 0 
            ? authenticatedUser.roles 
            : (legacyRole ? [legacyRole] : []);
        const roles = rawRoles.filter(r => {
            if (r === 'opd' && !appConfig.activatedFacilities.opd) return false;
            if (r === 'ipd' && !appConfig.activatedFacilities.ipd) return false;
            if (r === 'lab' && !appConfig.activatedFacilities.lab) return false;
            if (r === 'pharmacy' && !appConfig.activatedFacilities.pharmacy) return false;
            if (r === 'usg' && !appConfig.activatedFacilities.usg) return false;
            if (r === 'superadmin') return false; // superadmin tab is not present
            return true;
        });
            
        const roleLabels: Record<string, string> = {
            opd: 'OPD Reception', doctor: 'Consultant', lab: 'Laboratory', ipd: 'In-Patient', 
            pharmacy: 'Pharmacy', admin: 'Admin Panel', master: 'Clinical Master', 
            superadmin: 'Super Admin', global_stats: 'Statistics', analytics: 'Analytics', usg: 'USG Section', nurse: 'Nursing Station'
        };
        const roleIcons: Record<string, string> = {
            opd: '🏥', doctor: '🩺', lab: '🔬', ipd: '🛏️', 
            pharmacy: '💊', admin: '⚙️', master: '📚', 
            superadmin: '🔑', global_stats: '📊', analytics: '📈', usg: '📡', nurse: '👩‍⚕️'
        };

        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
                <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Welcome, {authenticatedUser.name}</h2>
                        <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-widest">Select Dashboard to Access</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {roles.map(r => (
                            <button 
                                key={r} 
                                onClick={() => handleRoleSelect(r)}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                            >
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">{roleIcons[r] || '👤'}</span>
                                <span className="font-black text-slate-700 uppercase text-xs tracking-widest group-hover:text-blue-700">{roleLabels[r] || r}</span>
                            </button>
                        ))}
                    </div>
                    <button onClick={handleLogout} className="mt-8 w-full text-slate-400 font-bold uppercase text-xs tracking-widest hover:text-red-500">Cancel / Sign Out</button>
                </div>
            </div>
        );
    }

    // Default Login Screen
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans relative">
        <div className="absolute top-4 right-4">
            <button onClick={handleOpenAppConfig} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <span>⚙️</span> App Config
            </button>
        </div>
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200">
          <div className="text-center mb-10">
            <div className="bg-blue-600 text-white w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black mx-auto mb-6 shadow-xl">H</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">J J Hospital Dondaicha</h1>
            <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-widest">Secure Cloud Entry</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Select User</label>
              <select 
                value={selectedUserId} 
                onChange={e => { setSelectedUserId(e.target.value); setPin(''); }} 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-sm"
              >
                <option value="">Select Account...</option>
                {allLoginUsers.map(u => (
                    <option key={u.id} value={u.id}>
                        {u.name} {u.roles?.includes('doctor') ? '(Dr)' : ''}
                    </option>
                ))}
              </select>
            </div>
            
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Portal PIN</label>
                <input type="password" autoFocus value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-5 text-slate-900 text-center text-4xl tracking-[1rem] focus:ring-4 focus:ring-blue-100 outline-none transition-all font-mono" placeholder="****" maxLength={4} />
            </div>
            
            <button type="submit" disabled={pin.length < 4} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-black py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 text-sm uppercase tracking-widest">Enter Secure Environment</button>
          </form>

          <div className="mt-8 text-center">
            <button 
               onClick={() => setLoginStep('migration')}
               className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest"
            >
               Database Migration Tool
            </button>
          </div>
        </div>
        
        {showAppConfig && (
            <AppConfigModal 
                appConfig={appConfig}
                systemUsers={systemUsers}
                consultants={consultants}
                medicationMaster={medicationMaster}
                billingRates={billingRates}
                onClose={() => setShowAppConfig(false)}
                onUpdateConfig={(cfg) => { setAppConfig(cfg); syncToCloud('appConfig', cfg); }}
                onUpdateSystemUsers={setSystemUsers}
                onUpdateConsultants={setConsultants}
                onUpdateMedicationMaster={setMedicationMaster}
                onUpdateBillingRates={setBillingRates}
            />
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 font-sans`}>
      <div className={`flex-grow flex flex-col w-full`}>
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-4 py-4 md:px-8 md:py-5">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4 cursor-pointer" onClick={handleSwitchRole}>
              <span className="bg-blue-600 text-white p-2 md:p-2.5 rounded-xl font-black text-lg md:text-xl shadow-lg transform hover:scale-110 transition-transform">H</span>
              <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tighter uppercase">Om EMR Portal<span className="text-blue-600">.</span></h1>
            </div>
            <div className="flex items-center space-x-3 md:space-x-6">
              <div className="text-right border-r pr-3 md:pr-6 border-slate-200">
                <p className="text-[10px] md:text-xs font-black text-slate-900 uppercase leading-none">
                    {loggedInUserName}
                </p>
                <p className="text-[8px] md:text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-1 md:mt-1.5 flex items-center justify-end gap-1 md:gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> {userRole.toUpperCase()} Portal
                </p>
              </div>
              <button onClick={handleLogout} className="bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 p-2 md:p-3 rounded-xl transition-all shadow-sm"><RestartIcon /></button>
            </div>
          </div>
        </header>

        {activeNotification && (
          <div onClick={dismissNotification} className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-bounce cursor-pointer hover:scale-105 active:scale-95 transition-all" title="Click to dismiss">
            <div className="bg-red-600 text-white px-6 md:px-10 py-3 md:py-4 rounded-full shadow-2xl font-black flex items-center space-x-3 md:space-x-4 border-2 md:border-4 border-white">
              <span className="text-lg md:text-2xl">🔔</span>
              <span className="uppercase tracking-widest text-xs md:text-sm">{activeNotification}</span>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto p-4 md:p-8 w-full">{renderDashboard()}</main>
      </div>
    </div>
  );
};

export default App;
