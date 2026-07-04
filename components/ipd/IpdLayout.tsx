import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { IpdContextProvider } from './IpdContext';
import { IpdAdmission, RegistryTemplate, AppPrintSettings } from '../../types'; // wait, where is IpdDashboardProps defined?
import WardsScreen from './WardsScreen';
import AdmissionLayout from './admission/AdmissionLayout';

export interface IpdLayoutProps {
  wards: any[];
  patients: any[];
  visits: any[];
  admissions: any[];
  consultants: any[];
  billingRates?: any;
  clinicalTemplates: any[];
  registryTemplates?: RegistryTemplate[];
  printSettings?: AppPrintSettings;
  onUpdateWards: (w: any) => void;
  onUpdateAdmissions: (a: any) => void;
  onUpdateTemplates: (t: any) => void;
  onUpdatePatients: (p: any) => void;
  userRole?: string;
  loggedInUserName?: string | null;
}

export const IpdLayout: React.FC<IpdLayoutProps> = ({
  wards,
  patients,
  visits,
  admissions,
  consultants,
  billingRates,
  clinicalTemplates,
  registryTemplates,
  printSettings,
  onUpdateWards,
  onUpdateAdmissions,
  onUpdateTemplates,
  onUpdatePatients,
  userRole,
  loggedInUserName,
}) => {
  const getPatient = (id: string) => patients.find((p) => p.id === id);

  const handleUpdateAdmission = (activeAdmissionId: string, updatedFields: Partial<IpdAdmission>) => {
    const selectedAdmission = admissions.find((a) => a.id === activeAdmissionId);
    if (!selectedAdmission) return;
    const updated = { ...selectedAdmission, ...updatedFields };
    const newAdmissions = admissions.map((a) =>
      a.id === selectedAdmission.id ? updated : a
    );
    onUpdateAdmissions(newAdmissions);
  };

  return (
    <IpdContextProvider value={{
      clinicalTemplates,
      onUpdateTemplates,
      billingRates,
      consultants,
      visits,
      patients,
      getPatient,
      admissions,
      handleUpdateAdmission,
      registryTemplates,
      printSettings,
      userRole,
      loggedInUserName,
    }}>
      <div className="h-full flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/ipd/wards" replace />} />
          <Route path="/ipd" element={<Navigate to="/ipd/wards" replace />} />
          <Route path="/ipd/wards" element={<WardsScreen wards={wards} onUpdatePatients={onUpdatePatients} onUpdateAdmissions={onUpdateAdmissions} />} />
          <Route path="/ipd/registers" element={<WardsScreen wards={wards} onUpdatePatients={onUpdatePatients} onUpdateAdmissions={onUpdateAdmissions} />} />
          <Route path="/ipd/admission/:id/*" element={<AdmissionLayout wards={wards} />} />
          <Route path="*" element={<Navigate to="/ipd/wards" replace />} />
        </Routes>
      </div>
    </IpdContextProvider>
  );
};

export default IpdLayout;
