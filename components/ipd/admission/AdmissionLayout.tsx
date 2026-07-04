import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, NavLink } from 'react-router-dom';
import { Ward } from '../../../types';
import { useIpdContext } from '../IpdContext';
import { 
  AdmissionNoteModule, 
  DailyRoundsModule, 
  NursingStationModule, 
  LabourProgressModule, 
  OperativeNotesModule, 
  WardConsentModule, 
  DischargeSummaryModule, 
  IpdBillingModule 
} from '../../IpdDashboard'; // Assuming these remain exported from there

interface AdmissionLayoutProps {
  wards: Ward[];
}

const AdmissionLayout: React.FC<AdmissionLayoutProps> = ({ wards }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { 
    admissions, 
    getPatient, 
    visits, 
    clinicalTemplates, 
    consultants, 
    billingRates, 
    setTemplateModal, 
    templateModal,
    handleUpdateAdmission, 
    onUpdateTemplates,
    userRole
  } = useIpdContext();

  const [admissionsLoaded, setAdmissionsLoaded] = useState(false);

  useEffect(() => {
    // Using a simple timeout to mimic loading state since the central cloud listener fetches data
    const timer = setTimeout(() => {
      setAdmissionsLoaded(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const selectedAdmission = admissions.find(a => a.id === id);
  if (!admissionsLoaded) {
      return (
          <div className="flex-grow flex items-center justify-center h-full bg-slate-50">
             <div className="text-slate-400 font-bold uppercase tracking-widest text-sm animate-pulse">Loading Admission Data...</div>
          </div>
      );
  }

  if (!selectedAdmission) return <Navigate to="/ipd/wards" replace />;
  
  const patient = getPatient(selectedAdmission.patientId);

  const tabs = [
    { id: "consent", label: "Consent" },
    { id: "admission", label: "Admission" },
    { id: "rounds", label: "Rounds" },
    { id: "nursing", label: "Nursing" },
    { id: "surgery", label: "Surgery" },
    { id: "labour", label: "Labour" },
    { id: "discharge", label: "Discharge" },
    { id: "billing", label: "Billing" },
  ].filter(tab => {
    if (userRole === 'nurse') {
      return ['consent', 'rounds', 'nursing'].includes(tab.id);
    }
    return true;
  });

  const renderTemplateModal = () => {
    if (!templateModal?.isOpen) return null;

    const { mode, type, onLoad, payload } = templateModal;
    const filteredTemplates = clinicalTemplates.filter(t => t.category === type);

    return (
      <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 text-left animate-fade-in">
          <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
            <h3 className="text-xs font-black uppercase tracking-widest">
              {mode === 'load' ? `Load Template` : `Save Template`}
            </h3>
            <button 
              onClick={() => setTemplateModal({ isOpen: false, mode: 'load', type: 'admission_note' })}
              className="text-white hover:text-slate-200 font-black text-lg"
            >
              &times;
            </button>
          </div>

          <div className="p-6">
            {mode === 'load' ? (
              <div className="space-y-3">
                {filteredTemplates.length === 0 ? (
                  <p className="text-center text-slate-400 italic py-6 text-xs font-bold uppercase">No templates found ({type})</p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {filteredTemplates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          if (onLoad) onLoad(t.content);
                          setTemplateModal({ isOpen: false, mode: 'load', type: 'admission_note' });
                        }}
                        className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 font-bold text-xs transition-all uppercase tracking-wide text-slate-700"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <TemplateSaveForm 
                type={type} 
                payload={payload || ''} 
                clinicalTemplates={clinicalTemplates} 
                onUpdateTemplates={onUpdateTemplates} 
                onClose={() => setTemplateModal({ isOpen: false, mode: 'load', type: 'admission_note' })}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-white relative">
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-800">{patient?.name}</h2>
          <p className="text-xs text-slate-500 font-bold uppercase">
            IPD: {selectedAdmission.id} | Bed: {wards.find((w) => w.id === selectedAdmission.wardId)?.beds.find((b) => b.id === selectedAdmission.bedId)?.number}
          </p>
        </div>
        <button onClick={() => navigate('/ipd/wards')} className="bg-slate-200 px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-slate-300 transition">Close File</button>
      </div>
      <div className="flex gap-2 p-2 bg-slate-100 border-b overflow-x-auto">
        {tabs.map((tab) => {
          if (tab.id === "labour" && patient?.type !== "obstetric" && patient?.type !== "gynecology") return null;
          return (
            <NavLink 
              key={tab.id} 
              to={`/ipd/admission/${id}/${tab.id}`} 
              className={({ isActive }) => `px-4 py-2 rounded-lg text-xs font-black uppercase whitespace-nowrap ${isActive ? "bg-white text-blue-600 shadow" : "text-slate-500 hover:bg-slate-200 transition"}`}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </div>
      <div className="flex-grow overflow-y-auto p-6 bg-slate-50">
        <Routes>
          <Route path="/" element={<Navigate to="consent" replace />} />
          <Route path="admission" element={patient ? <AdmissionNoteModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} visits={visits} patient={patient} setTemplateModal={setTemplateModal} /> : null} />
          <Route path="rounds" element={<DailyRoundsModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} setTemplateModal={setTemplateModal} clinicalTemplates={clinicalTemplates} consultants={consultants} />} />
          <Route path="nursing" element={<NursingStationModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} setTemplateModal={setTemplateModal} patient={patient!} />} />
          <Route path="labour" element={<LabourProgressModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} setTemplateModal={setTemplateModal} />} />
          <Route path="surgery" element={<OperativeNotesModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} billingRates={billingRates} setTemplateModal={setTemplateModal} />} />
          <Route path="consent" element={patient ? <WardConsentModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} clinicalTemplates={clinicalTemplates} onUpdateTemplates={onUpdateTemplates} patient={patient} /> : null} />
          <Route path="discharge" element={patient ? <DischargeSummaryModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} setTemplateModal={setTemplateModal} patient={patient} /> : null} />
          <Route path="billing" element={<IpdBillingModule activeAdmission={selectedAdmission} onUpdateAdmission={(d) => handleUpdateAdmission(id!, d)} billingRates={billingRates} setTemplateModal={setTemplateModal} />} />
        </Routes>
      </div>
      {renderTemplateModal()}
    </div>
  );
};

const TemplateSaveForm: React.FC<{
  type: string;
  payload: string;
  clinicalTemplates: any[];
  onUpdateTemplates: (t: any[]) => void;
  onClose: () => void;
}> = ({ type, payload, clinicalTemplates, onUpdateTemplates, onClose }) => {
  const [title, setTitle] = useState('');
  
  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a template title');
      return;
    }
    const newTemplate = {
      id: 'T-' + Date.now(),
      title: title.trim(),
      category: type,
      content: payload
    };
    onUpdateTemplates([...clinicalTemplates, newTemplate]);
    alert('Template saved successfully!');
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Template Title</label>
        <input 
          type="text" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          className="w-full border rounded-xl p-3 font-bold text-sm bg-slate-50 focus:ring-4 focus:ring-blue-100 outline-none transition" 
          placeholder="e.g. Normal Delivery Note, LSCS Plan" 
        />
      </div>
      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Content Preview</label>
        <div className="w-full border rounded-xl p-4 bg-slate-50 text-xs font-bold text-slate-700 max-h-[150px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {payload}
        </div>
      </div>
      <button 
        onClick={handleSave} 
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transition active:scale-95"
      >
        Save Template
      </button>
    </div>
  );
};

export default AdmissionLayout;
