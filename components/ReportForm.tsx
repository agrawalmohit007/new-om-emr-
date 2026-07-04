
import React, { useState, useCallback, useEffect } from 'react';
import { CbcReportData, CbcParameter, SelectedTests, HormoneParameter, OtherHormoneParameter, AppPrintSettings } from '../types';
import { RestartIcon } from './icons/RestartIcon';
import ReportPreview from './ReportPreview';
import { PrintIcon } from './icons/PrintIcon';
import { BillIcon } from './icons/BillIcon';
import { generateInterpretation } from '../services/geminiService';

interface ReportFormProps {
  reportData: CbcReportData;
  selectedTests: SelectedTests;
  printSettings?: AppPrintSettings;
  onDataChange: <K extends keyof CbcReportData, V extends CbcReportData[K]>(field: K, value: V) => void;
  onParameterChange: (section: keyof CbcReportData, index: number, field: string, value: string) => void;
  onNestedChange: (path: string[], value: any) => void;
  onPrint: () => void;
  onPrintNoSave: () => void;
  onPrintBill: () => void;
  onReset: () => void;
  reportPreviewRef: React.Ref<HTMLDivElement>;
  isMobileView: boolean;
}

export const LoadingSpinner = ({ text = "Generating..."}) => (
    <>
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{text}</span>
    </>
);

const SectionTable = React.memo<{title: string; data: CbcParameter[]; sectionKey: keyof CbcReportData; onParameterChange: ReportFormProps['onParameterChange']}>(({title, data, sectionKey, onParameterChange}) => (
    <div className="mb-6">
      <h3 className="text-xl font-semibold text-blue-600 border-b-2 border-slate-200 pb-2 mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-700">
            <thead className="text-xs text-slate-600 uppercase bg-slate-100">
                <tr>
                    <th scope="col" className="px-4 py-3 border-b border-slate-200">Investigation</th>
                    <th scope="col" className="px-4 py-3 border-b border-slate-200">Result</th>
                    <th scope="col" className="px-4 py-3 border-b border-slate-200">Unit</th>
                    <th scope="col" className="px-4 py-3 border-b border-slate-200">Reference Range</th>
                </tr>
            </thead>
            <tbody>
                {data.map((param, index) => (
                    <tr key={`${sectionKey}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium whitespace-nowrap">{param.investigation}</td>
                        <td className="px-4 py-2">
                            <input type="text" value={param.result} onChange={(e) => onParameterChange(sectionKey, index, 'result', e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500" />
                        </td>
                         <td className="px-4 py-2">
                            <input type="text" value={param.unit} onChange={(e) => onParameterChange(sectionKey, index, 'unit', e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500" />
                        </td>
                        <td className="px-4 py-2">
                            <input type="text" value={param.referenceRange} onChange={(e) => onParameterChange(sectionKey, index, 'referenceRange', e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500" />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
));

const FormInput = React.memo<{label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; className?: string, disabled?: boolean, placeholder?: string, list?: string}>(({label, value, onChange, className = '', disabled=false, placeholder, list}) => (
  <div className={className}>
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <input type="text" value={value} onChange={onChange} list={list} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed" disabled={disabled} placeholder={placeholder}/>
  </div>
));

const FormSelect = React.memo<{label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode}>(({label, value, onChange, children}) => (
  <div>
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <select value={value} onChange={onChange} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
          <option value="">Select</option>
          {children}
      </select>
  </div>
));

const InterpretationBlock = React.memo<{ sectionKey: keyof CbcReportData, sectionTitle: string, sectionData: any, interpretation: string, patientName: string, age: string, onDataChange: (field: any, value: any) => void }>(({ sectionKey, sectionTitle, sectionData, interpretation, patientName, age, onDataChange }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const patientDetails = { patientName, age };
            const result = await generateInterpretation(sectionTitle, sectionData, patientDetails);
            onDataChange(sectionKey, result as any);
        } catch (error) { console.error(error); }
        finally { setIsGenerating(false); }
    };
    return (
        <div className="mt-4 mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200 shadow-sm">
            <h4 className="text-md font-semibold text-purple-600 mb-3">AI Report Interpretation</h4>
            <div className="space-y-3">
                <button onClick={handleGenerate} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors inline-flex items-center justify-center disabled:bg-purple-400">
                    {isGenerating ? <LoadingSpinner text="Generating..." /> : '✨ Generate Interpretation'}
                </button>
                <textarea value={interpretation} onChange={(e) => onDataChange(sectionKey, e.target.value as any)} rows={5} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800" placeholder="AI interpretation..." />
            </div>
        </div>
    )
});

const ReportForm: React.FC<ReportFormProps> = ({ 
    reportData, 
    selectedTests,
    printSettings,
    onDataChange, 
    onParameterChange,
    onNestedChange,
    onPrint,
    onPrintNoSave,
    onPrintBill,
    onReset,
    reportPreviewRef,
    isMobileView
}) => {
  const referringDoctors = ['Dr. Omprakash Agrawal', 'Dr. Manjulata Agrawal', 'Dr. Parul Agrawal', 'Dr. Mohit Agrawal'];
  const [refBySelection, setRefBySelection] = useState<'Other' | string>('');
  
  // Datalist options
  const urineColorOptions = ['Pale Yellow', 'Yellow', 'Dark Yellow', 'Reddish', 'Whitish'];
  const urineAppearanceOptions = ['Clear', 'Hazy', 'Turbid'];
  const urineQuantityOptions = ['Sufficient', '10 ml', '20 ml', '30 ml'];
  const urineSpecificGravityOptions = ['1.005', '1.010', '1.015', '1.020', '1.025', '1.030'];
  const urineReactionOptions = ['Acidic', 'Alkaline', 'Neutral', '6.0', '6.5', '7.0'];
  const urineChemicalOptions = ['Absent', 'Trace', 'Present (+)', 'Present (++)', 'Present (+++)', 'Present (++++)'];
  const urineMicroscopicOptions = ['Nil', '1-2 /HPF', '2-4 /HPF', '4-6 /HPF', '8-10 /HPF', '10-15 /HPF', 'Plenty'];
  const urineCastOptions = ['Absent', 'Hyaline Cast', 'Granular Cast', 'WBC Cast', 'RBC Cast'];
  const urineCrystalOptions = ['Absent', 'Calcium Oxalate', 'Uric Acid', 'Triple Phosphate', 'Amorphous Phosphates'];
  
  const serologyResultOptions = ['Non-Reactive', 'Reactive', 'Negative', 'Positive'];

  useEffect(() => {
    if (reportData.refBy && referringDoctors.includes(reportData.refBy)) setRefBySelection(reportData.refBy);
    else if (reportData.refBy) setRefBySelection('Other');
    else setRefBySelection('');
  }, [reportData.refBy]);

  const handleWidalParamChange = useCallback((index: number, field: string, value: string) => {
    onNestedChange(['widalReport', 'parameters', index.toString(), field], value);
  }, [onNestedChange]);
  
  const handleAddOtherHormone = () => {
      const newItem: OtherHormoneParameter = { testName: '', result: '', unit: '', referenceRange: '' };
      const updated = [...reportData.hormoneReport.otherHormones, newItem];
      onNestedChange(['hormoneReport', 'otherHormones'], updated);
  };

  const handleRemoveOtherHormone = (index: number) => {
      const updated = reportData.hormoneReport.otherHormones.filter((_, i) => i !== index);
      onNestedChange(['hormoneReport', 'otherHormones'], updated);
  };

  const handleOtherHormoneChange = (index: number, field: keyof OtherHormoneParameter, value: string) => {
      const updated = [...reportData.hormoneReport.otherHormones];
      updated[index][field] = value;
      onNestedChange(['hormoneReport', 'otherHormones'], updated);
  };

  return (
    <div className={`grid gap-8 ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
      <div className="lg:col-span-1 space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Edit Report (S.No: {reportData.serialNumber})</h2>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-blue-600 mb-4">Patient Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Patient's Name" value={reportData.patientName} onChange={(e) => onDataChange('patientName', e.target.value)} />
                <div>
                    <label className="block text-sm font-medium text-slate-600">Ref. By</label>
                    <select value={refBySelection} onChange={(e) => {setRefBySelection(e.target.value); if (e.target.value !== 'Other') onDataChange('refBy', e.target.value); else onDataChange('refBy', '');}} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">Select Doctor</option>
                        {referringDoctors.map(doc => <option key={doc} value={doc}>{doc}</option>)}
                        <option value="Other">Other</option>
                    </select>
                    {refBySelection === 'Other' && <input type="text" value={reportData.refBy} onChange={(e) => onDataChange('refBy', e.target.value)} placeholder="Other doctor's name" className="mt-2 w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />}
                </div>
                <FormInput label="Date" value={reportData.date} onChange={(e) => onDataChange('date', e.target.value)} />
                <FormInput label="Age" value={reportData.age} onChange={(e) => onDataChange('age', e.target.value)} />
                <FormInput label="Address" value={reportData.address} onChange={(e) => onDataChange('address', e.target.value)} className="sm:col-span-2" />
            </div>
        </div>

        {selectedTests.cbc && (
          <>
            <SectionTable title="Haematology" data={reportData.haematologyParameters} sectionKey="haematologyParameters" onParameterChange={onParameterChange} />
            <SectionTable title="White Blood Cell" data={reportData.whiteBloodCellParameters} sectionKey="whiteBloodCellParameters" onParameterChange={onParameterChange} />
            <SectionTable title="Platelet" data={reportData.plateletParameters} sectionKey="plateletParameters" onParameterChange={onParameterChange}/>
            <InterpretationBlock 
                sectionKey="cbcInterpretation" 
                sectionTitle="CBC" 
                sectionData={reportData.haematologyParameters} 
                interpretation={reportData.cbcInterpretation}
                patientName={reportData.patientName}
                age={reportData.age}
                onDataChange={onDataChange}
            />
          </>
        )}
        
        {selectedTests.other && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold text-blue-600 mb-4">Other Blood Tests</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormInput label="RBS" value={reportData.otherTests.randomBloodSugar} onChange={(e) => onNestedChange(['otherTests', 'randomBloodSugar'], e.target.value)} />
                  <FormSelect label="Blood Group" value={reportData.otherTests.bloodGroup} onChange={(e) => onNestedChange(['otherTests', 'bloodGroup'], e.target.value)}>
                      {['A', 'B', 'O', 'AB'].map(v => <option key={v} value={v}>{v}</option>)}
                  </FormSelect>
                  <FormSelect label="Rh Type" value={reportData.otherTests.rhType} onChange={(e) => onNestedChange(['otherTests', 'rhType'], e.target.value)}>
                      <option value="Positive">Positive</option>
                      <option value="Negative">Negative</option>
                  </FormSelect>
              </div>
          </div>
        )}

        {selectedTests.serology && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-blue-600 mb-4">Serology</h3>
                <div className="flex gap-4 mb-4 pb-4 border-b border-slate-200 flex-wrap">
                    <label className="flex items-center gap-2 font-bold text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={reportData.serology.selection.hiv} onChange={(e) => onNestedChange(['serology', 'selection', 'hiv'], e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                        HIV
                    </label>
                    <label className="flex items-center gap-2 font-bold text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={reportData.serology.selection.hbsag} onChange={(e) => onNestedChange(['serology', 'selection', 'hbsag'], e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                        HBsAg
                    </label>
                    <label className="flex items-center gap-2 font-bold text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={reportData.serology.selection.hcv} onChange={(e) => onNestedChange(['serology', 'selection', 'hcv'], e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                        HCV
                    </label>
                    <label className="flex items-center gap-2 font-bold text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={reportData.serology.selection.vdrl} onChange={(e) => onNestedChange(['serology', 'selection', 'vdrl'], e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                        VDRL
                    </label>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {reportData.serology.selection.hiv && (
                        <div className="grid grid-cols-2 gap-4">
                            <FormSelect label="HIV 1" value={reportData.serology.results.hiv1} onChange={(e) => onNestedChange(['serology', 'results', 'hiv1'], e.target.value)}>{serologyResultOptions.map(o => <option key={o} value={o}>{o}</option>)}</FormSelect>
                            <FormSelect label="HIV 2" value={reportData.serology.results.hiv2} onChange={(e) => onNestedChange(['serology', 'results', 'hiv2'], e.target.value)}>{serologyResultOptions.map(o => <option key={o} value={o}>{o}</option>)}</FormSelect>
                        </div>
                    )}
                    {reportData.serology.selection.hbsag && <FormSelect label="HBsAg" value={reportData.serology.results.hbsag} onChange={(e) => onNestedChange(['serology', 'results', 'hbsag'], e.target.value)}>{serologyResultOptions.map(o => <option key={o} value={o}>{o}</option>)}</FormSelect>}
                    {reportData.serology.selection.hcv && <FormSelect label="HCV" value={reportData.serology.results.hcv || 'Non-Reactive'} onChange={(e) => onNestedChange(['serology', 'results', 'hcv'], e.target.value)}>{serologyResultOptions.map(o => <option key={o} value={o}>{o}</option>)}</FormSelect>}
                    {reportData.serology.selection.vdrl && <FormSelect label="VDRL" value={reportData.serology.results.vdrl} onChange={(e) => onNestedChange(['serology', 'results', 'vdrl'], e.target.value)}>{serologyResultOptions.map(o => <option key={o} value={o}>{o}</option>)}</FormSelect>}
                </div>
            </div>
        )}

        {selectedTests.urine && (
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Urine Physical</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Quantity" value={reportData.urineReport.physicalExamination.quantity} onChange={(e) => onNestedChange(['urineReport', 'physicalExamination', 'quantity'], e.target.value)} list="urine-qty" />
                        <FormInput label="Color" value={reportData.urineReport.physicalExamination.urineColor} onChange={(e) => onNestedChange(['urineReport', 'physicalExamination', 'urineColor'], e.target.value)} list="urine-color" />
                        <FormInput label="Appearance" value={reportData.urineReport.physicalExamination.appearance} onChange={(e) => onNestedChange(['urineReport', 'physicalExamination', 'appearance'], e.target.value)} list="urine-app" />
                        <FormInput label="Sp. Gravity" value={reportData.urineReport.physicalExamination.specificGravity} onChange={(e) => onNestedChange(['urineReport', 'physicalExamination', 'specificGravity'], e.target.value)} list="urine-sg" />
                    </div>
                </div>
                {/* Datalists */}
                <datalist id="urine-qty">{urineQuantityOptions.map(o=><option key={o} value={o} />)}</datalist>
                <datalist id="urine-color">{urineColorOptions.map(o=><option key={o} value={o} />)}</datalist>
                <datalist id="urine-app">{urineAppearanceOptions.map(o=><option key={o} value={o} />)}</datalist>
                <datalist id="urine-sg">{urineSpecificGravityOptions.map(o=><option key={o} value={o} />)}</datalist>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Urine Chemical</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Albumin" value={reportData.urineReport.chemicalExamination.albumin} onChange={(e) => onNestedChange(['urineReport', 'chemicalExamination', 'albumin'], e.target.value)} list="urine-chem" />
                        <FormInput label="Sugar" value={reportData.urineReport.chemicalExamination.sugar} onChange={(e) => onNestedChange(['urineReport', 'chemicalExamination', 'sugar'], e.target.value)} list="urine-chem" />
                        <FormInput label="Bile Salt" value={reportData.urineReport.chemicalExamination.bileSalt} onChange={(e) => onNestedChange(['urineReport', 'chemicalExamination', 'bileSalt'], e.target.value)} list="urine-chem" />
                        <FormInput label="Ketone" value={reportData.urineReport.chemicalExamination.ketoneBody} onChange={(e) => onNestedChange(['urineReport', 'chemicalExamination', 'ketoneBody'], e.target.value)} list="urine-chem" />
                        <FormInput label="Reaction (pH)" value={reportData.urineReport.chemicalExamination.ph} onChange={(e) => onNestedChange(['urineReport', 'chemicalExamination', 'ph'], e.target.value)} list="urine-ph" />
                    </div>
                </div>
                <datalist id="urine-chem">{urineChemicalOptions.map(o=><option key={o} value={o} />)}</datalist>
                <datalist id="urine-ph">{urineReactionOptions.map(o=><option key={o} value={o} />)}</datalist>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Urine Microscopic</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Pus Cells" value={reportData.urineReport.microscopicExamination.pusCells} onChange={(e) => onNestedChange(['urineReport', 'microscopicExamination', 'pusCells'], e.target.value)} list="urine-mic" />
                        <FormInput label="RBC" value={reportData.urineReport.microscopicExamination.rbc} onChange={(e) => onNestedChange(['urineReport', 'microscopicExamination', 'rbc'], e.target.value)} list="urine-mic" />
                        <FormInput label="Epith. Cells" value={reportData.urineReport.microscopicExamination.epithelialCell} onChange={(e) => onNestedChange(['urineReport', 'microscopicExamination', 'epithelialCell'], e.target.value)} list="urine-mic" />
                        <FormInput label="Crystals" value={reportData.urineReport.microscopicExamination.crystal} onChange={(e) => onNestedChange(['urineReport', 'microscopicExamination', 'crystal'], e.target.value)} list="urine-cry" />
                        <FormInput label="Bacteria" value={reportData.urineReport.microscopicExamination.bacteria} onChange={(e) => onNestedChange(['urineReport', 'microscopicExamination', 'bacteria'], e.target.value)} />
                        <FormInput label="Casts" value={reportData.urineReport.microscopicExamination.cast} onChange={(e) => onNestedChange(['urineReport', 'microscopicExamination', 'cast'], e.target.value)} list="urine-cast" />
                    </div>
                </div>
                <datalist id="urine-mic">{urineMicroscopicOptions.map(o=><option key={o} value={o} />)}</datalist>
                <datalist id="urine-cry">{urineCrystalOptions.map(o=><option key={o} value={o} />)}</datalist>
                <datalist id="urine-cast">{urineCastOptions.map(o=><option key={o} value={o} />)}</datalist>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Other Urine Tests</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <FormInput label="UPT" value={reportData.urineReport.pregnancyTest} onChange={(e) => onNestedChange(['urineReport', 'pregnancyTest'], e.target.value)} placeholder="Positive / Negative" />
                        <FormInput label="Urine LH" value={reportData.urineReport.urineLh} onChange={(e) => onNestedChange(['urineReport', 'urineLh'], e.target.value)} placeholder="Positive / Negative" />
                    </div>
                </div>
            </div>
        )}

        {selectedTests.widal && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-blue-600 mb-4">Widal Test</h3>
                <div className="space-y-4">
                    {reportData.widalReport.parameters.map((p, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 items-end border-b pb-2">
                            <span className="col-span-3 text-xs font-bold text-slate-500">{p.investigation}</span>
                            <FormSelect label="Result" value={p.result} onChange={(e) => handleWidalParamChange(i, 'result', e.target.value)}>
                                <option value="Non-Reactive">Non-Reactive</option>
                                <option value="Reactive">Reactive</option>
                            </FormSelect>
                            <FormInput label="Titre" value={p.titre} onChange={(e) => handleWidalParamChange(i, 'titre', e.target.value)} />
                        </div>
                    ))}
                </div>
            </div>
        )}

        {selectedTests.crp && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-blue-600 mb-4">CRP</h3>
                <FormInput label="Result (mg/L)" value={reportData.crpReport.result} onChange={(e) => onNestedChange(['crpReport', 'result'], e.target.value)} />
            </div>
        )}

        {selectedTests.hormone && (
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Hormones & Diabetes</h3>
                    <div className="space-y-4">
                        {Object.keys(reportData.hormoneReport.selection).map((key) => {
                            if (!reportData.hormoneReport.selection[key as keyof typeof reportData.hormoneReport.selection]) return null;
                            const resKey = key as keyof typeof reportData.hormoneReport.results;
                            const res = reportData.hormoneReport.results[resKey];
                            return (
                                <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b pb-2">
                                    <span className="col-span-3 sm:col-span-1 font-bold text-slate-700 uppercase self-center">{key}</span>
                                    <FormInput label="Result" value={res.result} onChange={(e) => onNestedChange(['hormoneReport', 'results', key, 'result'], e.target.value)} />
                                    <FormInput label="Unit" value={res.unit} onChange={(e) => onNestedChange(['hormoneReport', 'results', key, 'unit'], e.target.value)} />
                                </div>
                            )
                        })}
                    </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-blue-600">Other Hormones</h3>
                        <button onClick={handleAddOtherHormone} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Add Custom Test</button>
                    </div>
                    {reportData.hormoneReport.otherHormones.map((item, i) => (
                        <div key={i} className="grid grid-cols-1 gap-2 mb-4 p-2 border rounded bg-white relative">
                            <button onClick={() => handleRemoveOtherHormone(i)} className="absolute top-1 right-1 text-red-500 font-bold">&times;</button>
                            <FormInput label="Test Name" value={item.testName} onChange={(e) => handleOtherHormoneChange(i, 'testName', e.target.value)} />
                            <div className="grid grid-cols-2 gap-2">
                                <FormInput label="Result" value={item.result} onChange={(e) => handleOtherHormoneChange(i, 'result', e.target.value)} />
                                <FormInput label="Unit" value={item.unit} onChange={(e) => handleOtherHormoneChange(i, 'unit', e.target.value)} />
                            </div>
                            <FormInput label="Ref Range" value={item.referenceRange} onChange={(e) => handleOtherHormoneChange(i, 'referenceRange', e.target.value)} />
                        </div>
                    ))}
                </div>
            </div>
        )}

        {selectedTests.semen && (
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Semen Analysis - Physical</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Volume" value={reportData.semenAnalysis.physicalExamination.volume} onChange={(e) => onNestedChange(['semenAnalysis', 'physicalExamination', 'volume'], e.target.value)} />
                        <FormInput label="Color" value={reportData.semenAnalysis.physicalExamination.colour} onChange={(e) => onNestedChange(['semenAnalysis', 'physicalExamination', 'colour'], e.target.value)} />
                        <FormInput label="pH" value={reportData.semenAnalysis.physicalExamination.ph} onChange={(e) => onNestedChange(['semenAnalysis', 'physicalExamination', 'ph'], e.target.value)} />
                        <FormInput label="Liquefaction" value={reportData.semenAnalysis.physicalExamination.liquefactionTime} onChange={(e) => onNestedChange(['semenAnalysis', 'physicalExamination', 'liquefactionTime'], e.target.value)} />
                        <FormInput label="Viscosity" value={reportData.semenAnalysis.physicalExamination.viscosity} onChange={(e) => onNestedChange(['semenAnalysis', 'physicalExamination', 'viscosity'], e.target.value)} />
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Semen Analysis - Microscopic</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Sperm Count" value={reportData.semenAnalysis.microscopicExamination.spermCount} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'spermCount'], e.target.value)} />
                        <FormInput label="Total Count" value={reportData.semenAnalysis.microscopicExamination.totalSpermCount} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'totalSpermCount'], e.target.value)} />
                        <FormInput label="Prog. Motility" value={reportData.semenAnalysis.microscopicExamination.progressiveMotility} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'progressiveMotility'], e.target.value)} />
                        <FormInput label="Non-Prog." value={reportData.semenAnalysis.microscopicExamination.nonProgressiveMotility} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'nonProgressiveMotility'], e.target.value)} />
                        <FormInput label="Immotile" value={reportData.semenAnalysis.microscopicExamination.immotile} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'immotile'], e.target.value)} />
                        <FormInput label="Total Motility" value={reportData.semenAnalysis.microscopicExamination.totalMotility} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'totalMotility'], e.target.value)} />
                        <FormInput label="Pus Cells" value={reportData.semenAnalysis.microscopicExamination.pusCells} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'pusCells'], e.target.value)} />
                        <FormInput label="Dead Sperm" value={reportData.semenAnalysis.microscopicExamination.deadSperm} onChange={(e) => onNestedChange(['semenAnalysis', 'microscopicExamination', 'deadSperm'], e.target.value)} />
                    </div>
                </div>
            </div>
        )}
      </div>
      <div className="lg:col-span-1">
        <div className="sticky top-8 print:static">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">Live Report Preview</h2>
            <div className="flex flex-col space-y-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Signing Doctor</label>
                    <select value={reportData.doctorName} onChange={(e) => onDataChange('doctorName', e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                        {referringDoctors.map(doc => <option key={doc} value={doc}>{doc}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <button onClick={onPrint} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center shadow-lg transform hover:scale-105">
                       <PrintIcon />
                        <span className="ml-2 font-black">Save &amp; Print Report</span>
                    </button>
                    <button onClick={onPrintBill} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center shadow-lg transform hover:scale-105">
                       <BillIcon />
                        <span className="ml-2 text-sm">Save &amp; Print Bill</span>
                    </button>
                </div>
                <button onClick={onPrintNoSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center text-sm shadow-md">
                    <PrintIcon />
                    <span className="ml-2">Print Report (No Save)</span>
                </button>
                <button onClick={onReset} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center">
                    <RestartIcon />
                    <span className="ml-2">Start New Report</span>
                </button>
            </div>
            <div id="print-container" className="p-2 bg-slate-200 rounded-lg shadow-inner border border-slate-300 h-[60vh] overflow-auto">
                <div className={`origin-top mx-auto ${isMobileView ? 'transform scale-[0.45]' : 'transform scale-[0.7]'}`}>
                     <ReportPreview reportData={reportData} selectedTests={selectedTests} ref={reportPreviewRef} settings={printSettings} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReportForm;
