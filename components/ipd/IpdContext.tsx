import React, { createContext, useContext, useState } from 'react';
import { IpdAdmission, ClinicalTemplate, Patient, ServicePrices, Consultant, VisitRecord, RegistryTemplate, AppPrintSettings } from '../../types';

interface TemplateModalState {
  isOpen: boolean;
  mode: "save" | "load";
  type: ClinicalTemplate["category"];
  payload?: any;
  onLoad?: (content: string) => void;
}

export interface IpdContextType {
  templateModal: TemplateModalState;
  setTemplateModal: React.Dispatch<React.SetStateAction<TemplateModalState>>;
  clinicalTemplates: ClinicalTemplate[];
  onUpdateTemplates: (data: ClinicalTemplate[]) => void;
  billingRates: ServicePrices;
  consultants: Consultant[];
  visits: VisitRecord[];
  patients: Patient[];
  getPatient: (id: string) => Patient | undefined;
  admissions: IpdAdmission[];
  handleUpdateAdmission: (activeAdmissionId: string, updatedFields: Partial<IpdAdmission>) => void;
  registryTemplates?: RegistryTemplate[];
  printSettings?: AppPrintSettings;
  userRole?: string;
  loggedInUserName?: string | null;
}

const IpdContext = createContext<IpdContextType | undefined>(undefined);

export const IpdContextProvider: React.FC<{
  children: React.ReactNode;
  value: Omit<IpdContextType, 'templateModal' | 'setTemplateModal'>;
}> = ({ children, value }) => {
  const [templateModal, setTemplateModal] = useState<TemplateModalState>({ isOpen: false, mode: "load", type: "admission_note" });

  return (
    <IpdContext.Provider value={{ ...value, templateModal, setTemplateModal }}>
      {children}
    </IpdContext.Provider>
  );
};

export const useIpdContext = () => {
  const context = useContext(IpdContext);
  if (!context) throw new Error('useIpdContext must be used within an IpdContextProvider');
  return context;
};
