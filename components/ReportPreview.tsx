
import React from 'react';
import { CbcReportData, CbcParameter, SelectedTests, HormoneReportResults, HormoneReportSelection, AppPrintSettings } from '../types';


export const doctorCredentials: Record<string, { qualifications: string; specialty: string; }> = {
    'Dr. Mohit Agrawal': { qualifications: 'MBBS, M.D.(Obst. & Gynae), FMAS', specialty: 'प्रसूती, स्त्रीरोग तज्ञ व लेप्रोस्कोपिस्ट' },
    'Dr. Parul Agrawal': { qualifications: 'MBBS, M.S.(Obst. Gynae)', specialty: 'प्रसूती व स्त्रीरोग तज्ञ' },
    'Dr. Manjulata Agrawal': { qualifications: 'MBBS, M.D.(Obst. & Gynae) D.A.', specialty: 'प्रसूती, स्त्रीरोग तज्ञ व बधिरिकर तज्ञ' },
    'Dr. Omprakash Agrawal': { qualifications: 'MBBS, M.S. (Gen.Surg.)', specialty: 'जनरल सर्जन' },
};

const toSentenceCase = (str: any): string => {
    if (str === null || str === undefined) return '';
    const val = String(str);
    const trimmed = val.trim();
    if (trimmed.length === 0) return '';

    // Don't modify purely numeric, ranges, or special character-led strings
    if (!isNaN(parseFloat(trimmed)) && isFinite(trimmed as any) && !trimmed.toLowerCase().includes('e')) return trimmed;
    if (/^[\d.,\s-]+$/.test(trimmed)) return trimmed; // e.g., "10 - 15"
    if (/^[+<>]/.test(trimmed)) return trimmed; // e.g., "+1", "< 6.0"

    // Convert camelCase to space-separated, then process
    const spacedStr = trimmed.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    return spacedStr.charAt(0).toUpperCase() + spacedStr.slice(1).toLowerCase();
};

const PatientDetails: React.FC<{reportData: CbcReportData}> = ({ reportData }) => (
    <div className="text-xs border-y-2 border-black py-0.5 my-1">
        <table className="w-full border-collapse">
            <tbody>
                <tr>
                    <td className="font-bold w-[16%] py-0.5">Patient's Name</td>
                    <td className="w-[1%] py-0.5">:</td>
                    <td className="w-[33%] py-0.5">{reportData.patientName}</td>
                    <td className="font-bold w-[10%] py-0.5 pl-4">Date</td>
                    <td className="w-[1%] py-0.5">:</td>
                    <td className="w-[39%] py-0.5">{reportData.date}</td>
                </tr>
                <tr>
                    <td className="font-bold py-0.5">Ref. By</td>
                    <td className="py-0.5">:</td>
                    <td className="py-0.5">{reportData.refBy}</td>
                    <td className="font-bold py-0.5 pl-4">Age</td>
                    <td className="py-0.5">:</td>
                    <td className="py-0.5">{reportData.age}</td>
                </tr>
                <tr>
                    <td className="font-bold py-0.5">Address</td>
                    <td className="py-0.5">:</td>
                    <td colSpan={4} className="py-0.5">{reportData.address}</td>
                </tr>
            </tbody>
        </table>
    </div>
);

const ReportPage: React.FC<{children: React.ReactNode, reportData: CbcReportData, className?: string, title: string, settings?: AppPrintSettings}> = ({ children, reportData, className, title, settings }) => {
    const selectedDoctor = doctorCredentials[reportData.doctorName] || { qualifications: '', specialty: '' };
    // Default 55mm header height if not provided in settings
    const layout = settings?.lab || { marginTop: 10, marginBottom: 10, marginLeft: 15, marginRight: 5, headerHeight: 55, footerHeight: 10 };
    const hasHeaderImage = !!settings?.headerImage;
    const headerHeightVal = (layout.headerHeight && layout.headerHeight > 0) ? layout.headerHeight : 55;
    const computedPaddingTop = hasHeaderImage ? `${headerHeightVal + (layout.marginTop || 0)}mm` : `${layout.marginTop}mm`;
    
    return (
        <div 
            className={`report-page bg-white text-black font-sans shadow-lg w-[794px] h-[1123px] flex flex-col mb-4 overflow-hidden relative ${className}`}
        >
            {hasHeaderImage && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: `${headerHeightVal}mm`, overflow: 'hidden' }}>
                    <img src={settings.headerImage} style={{ width: '100%', height: '100%', objectFit: 'fill' }} alt="Hospital Header" />
                </div>
            )}
            <div 
                className="flex flex-col h-full relative"
                style={{
                    paddingTop: computedPaddingTop,
                    paddingBottom: `${layout.marginBottom}mm`,
                    paddingLeft: `${layout.marginLeft}mm`,
                    paddingRight: `${layout.marginRight}mm`,
                    boxSizing: 'border-box'
                }}
            >
                {!hasHeaderImage && (
                    <header style={{ height: `${layout.headerHeight}mm` }} className="w-full flex-shrink-0" />
                )}
                
                {/* Report Title & Patient Details */}
                 <div className="text-center mb-1 flex-shrink-0">
                    <h2 className="text-base font-bold underline decoration-1 underline-offset-2">
                        {title}
                    </h2>
                </div>
                <div className="flex-shrink-0">
                    <PatientDetails reportData={reportData} />
                </div>
                
                {/* MAIN CONTENT - Grows to fill available space */}
                <main className="flex-grow flex flex-col overflow-hidden relative">
                    {children}
                </main>

                {/* FOOTER - Absolute bottom relative to content area (inside padding) */}
                <footer className="text-xs pt-1 flex-shrink-0 w-full" style={{ minHeight: `${layout.footerHeight}mm` }}>
                    <div className="text-center font-bold text-sm mb-2 border-t-2 border-black pt-1">
                        --- End of Report ---
                    </div>
                    <div className="flex justify-end items-end">
                        <div className="text-right">
                            <div className="h-10"></div> {/* Space for signature */}
                            <p className="font-bold">{reportData.doctorName}</p>
                            <p>{selectedDoctor.qualifications}</p>
                            <p>{selectedDoctor.specialty}</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    )
}

const CbcPage: React.FC<{ reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }> = ({ reportData, selectedTests, settings }) => {
    const SectionTable: React.FC<{ title: string, data: CbcParameter[] }> = ({ title, data }) => {
        const filteredData = data.filter(p => p.result && p.result.trim() !== '');
        if (filteredData.length === 0) return null;

        return (
            <div className="mb-3 border border-black">
                <h3 className="text-xs font-bold bg-gray-300 text-black py-1 px-2 uppercase border-b border-black">{title}</h3>
                <table className="w-full text-[11px] text-left text-black border-collapse">
                    <thead className="bg-gray-100">
                        <tr className="border-b border-black">
                            <th className="font-bold py-1 px-2 w-[40%] text-left">Investigation</th>
                            <th className="font-bold py-1 px-2 w-[15%] text-left">Result</th>
                            <th className="font-bold py-1 px-2 w-[15%] text-left">Unit</th>
                            <th className="font-bold py-1 px-2 w-[30%] text-left">Reference Range</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((param) => (
                            <tr key={param.investigation} className="border-b border-gray-300 last:border-b-0">
                                <td className="py-1 px-2 font-medium">{param.investigation}</td>
                                <td className="py-1 px-2 font-bold">{param.result}</td>
                                <td className="py-1 px-2">{param.unit}</td>
                                <td className="py-1 px-2">{param.referenceRange}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const hasCbcContent = reportData.haematologyParameters.some(p => p.result) || reportData.whiteBloodCellParameters.some(p => p.result) || reportData.plateletParameters.some(p => p.result);

    if (!selectedTests.cbc || !hasCbcContent) {
        return null;
    }
    
    // Explicitly exclude P-LCC and P-LCR from legacy data if present
    const filteredPlatelets = reportData.plateletParameters.filter(p => p.investigation !== 'P-LCC' && p.investigation !== 'P-LCR');

    return (
        <ReportPage reportData={reportData} title="Complete Blood Count (CBC)" settings={settings}>
            <div className="flex-grow pt-2">
                <SectionTable title="Haematology Parameters" data={reportData.haematologyParameters} />
                <SectionTable title="White Blood Cell Parameters" data={reportData.whiteBloodCellParameters} />
                <SectionTable title="Platelet Parameters" data={filteredPlatelets} />
                
                {reportData.cbcInterpretation && (
                    <div className="mt-2">
                        <h3 className="text-xs font-bold text-gray-800">Interpretation</h3>
                        <p className="text-[10px] whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.cbcInterpretation)}</p>
                    </div>
                )}
            </div>
        </ReportPage>
    )
}

const OtherTestsPage: React.FC<{ reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }> = ({ reportData, selectedTests, settings }) => {
    // Show if 'other' is selected OR specific sub-tests like bloodSugar or bloodGroup are selected
    const shouldShow = selectedTests.other || selectedTests.bloodSugar || selectedTests.bloodGroup;

    const hasBloodSugar = reportData.otherTests.randomBloodSugar && reportData.otherTests.randomBloodSugar.trim() !== '';
    const hasBloodGrouping = (reportData.otherTests.bloodGroup && reportData.otherTests.bloodGroup.trim() !== '') || (reportData.otherTests.rhType && reportData.otherTests.rhType.trim() !== '');

    if (!shouldShow || (!hasBloodSugar && !hasBloodGrouping)) {
        return null;
    }

    return (
        <ReportPage reportData={reportData} title="BLOOD TESTS" settings={settings}>
            <div className="flex-grow pt-2">
                {hasBloodSugar && (
                    <div className="mt-4">
                        <h3 className="text-base font-bold text-gray-800 mb-1">BLOOD SUGAR</h3>
                        <table className="w-full text-xs text-left text-black">
                            <tbody>
                                <tr className="border-b border-gray-400">
                                    <td className="p-2 font-bold w-1/3">Random Blood Sugar</td>
                                    <td className="p-2 font-semibold w-2/3">{toSentenceCase(reportData.otherTests.randomBloodSugar)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {hasBloodGrouping && (
                    <div className="mt-4">
                        <h3 className="text-base font-bold text-gray-800 mb-1">BLOOD GROUPING</h3>
                        <table className="w-full text-xs text-left text-black">
                            <tbody>
                                {reportData.otherTests.bloodGroup && reportData.otherTests.bloodGroup.trim() !== '' && (
                                    <tr className="border-b border-gray-400">
                                        <td className="p-2 font-bold w-1/3">Blood Grouping</td>
                                        <td className="p-2 font-semibold w-2/3">{toSentenceCase(reportData.otherTests.bloodGroup)}</td>
                                    </tr>
                                )}
                                {reportData.otherTests.rhType && reportData.otherTests.rhType.trim() !== '' && (
                                    <tr className="border-b border-gray-400 last:border-0">
                                        <td className="p-2 font-bold w-1/3">Rh Typing</td>
                                        <td className="p-2 font-semibold w-2/3">{toSentenceCase(reportData.otherTests.rhType)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div className="text-[10px] leading-tight text-gray-600 mt-2 px-1">
                            <p><strong>Note:</strong> Kindly Confirm With Forward And Reverse Grouping All O Rh Positive Blood Group Needs Confirmation By Du Test It Is Recommended That To Recheck And Confirm Blood Group Before Transfusion Or Therapeutic Intervention</p>
                        </div>
                    </div>
                )}

                 {reportData.otherTestsInterpretation && (
                    <div className="mt-4">
                        <h3 className="text-sm font-bold text-gray-800">Interpretation</h3>
                        <p className="text-xs whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.otherTestsInterpretation)}</p>
                    </div>
                )}
            </div>
        </ReportPage>
    )
}


const SerologyPage: React.FC<{reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings}> = ({ reportData, selectedTests, settings }) => {
    const { results, selection } = reportData.serology;

    if (!selectedTests.serology || (!selection.hiv && !selection.hbsag && !selection.vdrl && !selection.hcv)) {
        return null;
    }

    const SerologySection: React.FC<{
        title: string;
        tests: { name: string; result: string }[];
        note: React.ReactNode;
    }> = ({ title, tests, note }) => (
        <div className="mb-4">
            <h3 className="text-base font-bold text-gray-800 mb-2">{title}</h3>
            <table className="w-full text-sm text-left text-black border border-black">
                <thead className="bg-gray-300">
                    <tr>
                        <th className="font-bold p-2 w-1/2 text-black uppercase tracking-wider text-left">Test Name</th>
                        <th className="font-bold p-2 w-1/2 text-black uppercase tracking-wider text-left">Result</th>
                    </tr>
                </thead>
                <tbody>
                    {tests.map(test => (
                         <tr key={test.name}>
                            <td className="p-2 font-normal">{test.name}</td>
                            <td className="p-2 font-bold">{toSentenceCase(test.result)}</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={2} className="p-2 border-t border-gray-400">
                             <div className="text-[10px] leading-tight text-gray-600">
                                {note}
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );

    return (
         <ReportPage reportData={reportData} title="SEROLOGY REPORT" settings={settings}>
            <div className="flex-grow pt-2">
                {selection.hbsag && (
                    <SerologySection 
                        title="HBsAg"
                        tests={[{ name: 'Hepatitis B Surface Antigen', result: results.hbsag }]}
                        note={<><strong>Note:</strong> This is a screening test. All reactive samples should be confirmed by a supplemental assay.</>}
                    />
                )}
                
                {selection.hcv && (
                    <SerologySection 
                        title="HCV"
                        tests={[{ name: 'Hepatitis C Virus', result: results.hcv || 'Non-Reactive' }]}
                        note={<><strong>Note:</strong> This is a screening test. All reactive samples should be confirmed by a supplemental assay.</>}
                    />
                )}

                {selection.vdrl && (
                     <SerologySection 
                        title="VDRL"
                        tests={[{ name: 'VDRL', result: results.vdrl }]}
                        note={<><strong>Note:</strong> Non-reactive in the VDRL test does not exclude the possibility of syphilitic infection. It has to be correlated with clinical findings.</>}
                    />
                )}

                 {selection.hiv && (
                     <SerologySection 
                        title="HIV"
                        tests={[
                            { name: 'HIV-1', result: results.hiv1 },
                            { name: 'HIV-2', result: results.hiv2 }
                        ]}
                        note={<><strong>Note:</strong> This is a screening test. All reactive samples must be confirmed by Western Blot assay.</>}
                    />
                )}
                
                {reportData.serologyInterpretation && (
                    <div className="mt-4">
                        <h3 className="text-sm font-bold text-gray-800">Interpretation</h3>
                        <p className="text-xs whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.serologyInterpretation)}</p>
                    </div>
                )}
            </div>
        </ReportPage>
    );
};

const UrinePage: React.FC<{ reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }> = ({ reportData, selectedTests, settings }) => {
    if (!selectedTests.urine) return null;
    const { physicalExamination, chemicalExamination, microscopicExamination, pregnancyTest, urineLh } = reportData.urineReport;

    const hasPhysical = Object.values(physicalExamination).some(v => typeof v === 'string' && v.trim() !== '');
    const hasChemical = Object.values(chemicalExamination).some(v => typeof v === 'string' && v.trim() !== '');
    const hasMicroscopic = Object.values(microscopicExamination).some(v => typeof v === 'string' && v.trim() !== '');
    const hasOther = (pregnancyTest && pregnancyTest.trim() !== '') || (urineLh && urineLh.trim() !== '');
    
    if (!hasPhysical && !hasChemical && !hasMicroscopic && !hasOther) return null;

    const ExaminationTable: React.FC<{title: string, data: any, labels: Record<string, string>}> = ({title, data, labels}) => {
        const filteredData = Object.entries(data).filter(([_, value]) => typeof value === 'string' && value.trim() !== '');
        if(filteredData.length === 0) return null;

        return (
             <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800 mb-1">{title}</h3>
                <table className="w-full text-xs text-left text-black">
                    <tbody>
                        {filteredData.map(([key, value]) => (
                            <tr key={key} className="border-b border-gray-400 last:border-0">
                                <td className="p-2 w-1/2">{labels[key]}</td>
                                <td className="p-2 w-1/2 font-semibold">{toSentenceCase(value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <ReportPage reportData={reportData} title="URINE ROUTINE & MICROSCOPY REPORT" settings={settings}>
            <div className="flex-grow pt-2">
                <ExaminationTable 
                    title="PHYSICAL EXAMINATION"
                    data={physicalExamination}
                    labels={{quantity: 'Quantity', urineColor: 'Urine Color', appearance: 'Appearance', specificGravity: 'Specific Gravity'}}
                />
                 <ExaminationTable 
                    title="CHEMICAL EXAMINATION"
                    data={chemicalExamination}
                    labels={{albumin: 'Albumin', sugar: 'Sugar', bileSalt: 'Bile Salt', ketoneBody: 'Ketone Body', ph: 'Reaction (pH)'}}
                />
                 <ExaminationTable 
                    title="MICROSCOPIC EXAMINATION"
                    data={microscopicExamination}
                    labels={{pusCells: 'Pus Cells', rbc: 'R.B.C.', epithelialCell: 'Epithelial Cell', crystal: 'Crystal', bacteria: 'Bacteria', cast: 'Cast'}}
                />

                {(pregnancyTest || urineLh) && (
                     <div className="mb-4">
                        <h3 className="text-base font-bold text-gray-800 mb-1">OTHER URINE TESTS</h3>
                        <table className="w-full text-xs text-left text-black">
                            <tbody>
                                {pregnancyTest && (
                                     <tr className="border-b border-gray-400">
                                        <td className="p-2 w-1/2">Urine Pregnancy Test (UPT)</td>
                                        <td className="p-2 w-1/2 font-semibold">{toSentenceCase(pregnancyTest)}</td>
                                    </tr>
                                )}
                                {urineLh && (
                                     <tr className="border-b border-gray-400">
                                        <td className="p-2 w-1/2">Urine LH Test</td>
                                        <td className="p-2 w-1/2 font-semibold">{toSentenceCase(urineLh)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {reportData.urineReportInterpretation && (
                    <div className="mt-4">
                        <h3 className="text-sm font-bold text-gray-800">Interpretation</h3>
                        <p className="text-xs whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.urineReportInterpretation)}</p>
                    </div>
                )}
            </div>
        </ReportPage>
    )
}

const WidalPage: React.FC<{ reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }> = ({ reportData, selectedTests, settings }) => {
    const { parameters } = reportData.widalReport;
    const hasContent = parameters.some(p => p.result);

    if (!selectedTests.widal || !hasContent) return null;

    return (
        <ReportPage reportData={reportData} title="WIDAL SLIDE AGGLUTINATION TEST" settings={settings}>
            <div className="flex-grow flex flex-col pt-2">
                 <table className="w-full text-xs text-left text-black border-collapse mt-4 border border-black">
                    <thead className="bg-gray-300">
                        <tr>
                            <th className="font-bold p-2 w-[35%] text-black uppercase tracking-wider text-left">Investigation</th>
                            <th className="font-bold p-2 w-[15%] text-black uppercase tracking-wider text-left">Result</th>
                            <th className="font-bold p-2 w-[15%] text-black uppercase tracking-wider text-left">Observed Titre</th>
                            <th className="font-bold p-2 w-[20%] text-black uppercase tracking-wider text-left">Reference Value</th>
                            <th className="font-bold p-2 w-[15%] text-black uppercase tracking-wider text-left">Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parameters.filter(p=>p.result).map((param, index) => (
                           <tr key={index}>
                                <td className="p-2">{param.investigation}</td>
                                <td className="p-2 font-semibold">{toSentenceCase(param.result)}</td>
                                <td className="p-2 font-semibold">{toSentenceCase(param.titre)}</td>
                                <td className="p-2">{param.referenceValue}</td>
                                <td className="p-2">{param.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 <div className="mt-4 text-xs space-y-2 text-gray-700">
                    <div>
                        <span className="font-bold">Interpretation: </span>
                        <span><span className="font-semibold text-black">Reactive</span>: Indicates presence of IgM & IgG antibodies against Salmonella spp. </span>
                        <span><span className="font-semibold text-black">Non-Reactive</span>: Indicates absence of IgM & IgG antibodies against Salmonella spp.</span>
                    </div>
                    <div>
                        <p className="font-bold text-gray-800">Note:</p>
                        <ol className="list-decimal list-inside pl-1">
                            <li>Rising titers are significant.</li>
                            <li>The recommended Widal test is by Tube Agglutination Method.</li>
                        </ol>
                    </div>
                    <div>
                        <p className="font-bold text-gray-800">Comments:</p>
                        <ul className="list-disc list-inside pl-1 space-y-1">
                            <li>This test measures somatic O and flagellar H antibodies against Typhoid and Paratyphoid bacilli. The agglutinins usually appear at the end of the first week of infection and increase steadily till the third/fourth week after which the decline starts.</li>
                            <li>A positive Widal test may occur because of typhoid vaccination or previous typhoid infection and in certain autoimmune diseases. The nonspecific febrile disease may cause this titer to increase (anamnestic reaction).</li>
                            <li>The test may be falsely negative in cases of Enteric fever treated with antibiotics in the early stages. The recommended test especially in the first week after infection is Blood Culture.</li>
                        </ul>
                    </div>

                    {reportData.widalReportInterpretation && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">AI Comments</h3>
                            <p className="text-xs whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.widalReportInterpretation)}</p>
                        </div>
                    )}
                </div>
            </div>
        </ReportPage>
    )
}

const CrpPage: React.FC<{ reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }> = ({ reportData, selectedTests, settings }) => {
    if (!selectedTests.crp || !reportData.crpReport.result) return null;

    return (
         <ReportPage reportData={reportData} title="C-REACTIVE PROTEIN (CRP) REPORT" settings={settings}>
            <div className="flex-grow pt-2">
                <table className="w-full text-xs text-left text-black border-collapse mt-4 border border-black">
                     <thead className="bg-gray-300">
                        <tr>
                            <th className="font-bold p-2 w-[40%] text-black uppercase tracking-wider text-left">Investigation</th>
                            <th className="font-bold p-2 w-[20%] text-black uppercase tracking-wider text-left">Result</th>
                            <th className="font-bold p-2 w-[20%] text-black uppercase tracking-wider text-left">Unit</th>
                            <th className="font-bold p-2 w-[20%] text-black uppercase tracking-wider text-left">Reference Range</th>
                        </tr>
                    </thead>
                    <tbody>
                         <tr>
                            <td className="p-2">C-REACTIVE PROTEIN (CRP)</td>
                            <td className="p-2 font-semibold">{toSentenceCase(reportData.crpReport.result)}</td>
                            <td className="p-2">{reportData.crpReport.unit}</td>
                            <td className="p-2">{reportData.crpReport.referenceRange}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div className="mt-4 text-xs space-y-3 text-gray-700">
                    <div>
                        <h4 className="font-bold text-sm mb-1 text-gray-800">Interpretation</h4>
                         <p className="mb-1">Measurement of CRP is useful for the detection and evaluation of infection, tissue injury, inflammatory disorders, and associated diseases.</p>
                         <p className="mb-1">High sensitivity CRP (hsCRP) measurements may be used as an independent risk marker for the identification of individuals at risk for future cardiovascular disease.</p>
                         <p className="mb-1">Increase in CRP values are non-specific and should not be interpreted without a complete history.</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm mb-1 text-gray-800">Clinical Significance of Increased CRP Level</h4>
                         <p className="mb-1">The level of CRP in the blood is normally low. A high or increasing amount of CRP in the blood suggests the presence of inflammation but will not identify its location or the cause.</p>
                        <ul className="list-disc list-inside pl-2 space-y-1">
                            <li><strong>Suspected bacterial infection:</strong> A high CRP level can provide confirmation that you have a serious bacterial infection.</li>
                            <li><strong>Chronic inflammatory disease:</strong> High levels of CRP suggest a flare-up if you have a chronic inflammatory disease or that treatment has not been effective.</li>
                        </ul>
                    </div>
                </div>

                {reportData.crpReportInterpretation && (
                    <div className="mt-4">
                        <h3 className="text-sm font-bold text-gray-800">AI Comments</h3>
                        <p className="text-xs whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.crpReportInterpretation)}</p>
                    </div>
                )}
            </div>
        </ReportPage>
    )
}


const HormonePage: React.FC<{ reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }> = ({ reportData, selectedTests, settings }) => {
    const { selection, results, otherHormones } = reportData.hormoneReport;
    const hasStandard = Object.keys(selection).some(key => selection[key as keyof HormoneReportSelection] && results[key as keyof HormoneReportResults].result);
    const hasOther = otherHormones && otherHormones.length > 0;
    
    if (hasStandard || hasOther) {
        return (
            <ReportPage reportData={reportData} title="HORMONE & DIABETES REPORT" settings={settings}>
                 <div className="flex-grow pt-2">
                    {Object.entries({
                        "Thyroid Profile": ['tsh', 't3', 't4', 'ft3', 'ft4'],
                        "Fertility Hormones": ['fsh', 'lh', 'amh', 'prolactin'],
                        "Diabetes Marker": ['hba1c'],
                    }).map(([groupName, tests]) => {
                         const activeTests = tests.filter(key => selection[key as keyof HormoneReportSelection] && results[key as keyof HormoneReportResults].result);
                         if (activeTests.length === 0) return null;
                         
                         return (
                             <div className="mb-4" key={groupName}>
                                <h3 className="text-base font-bold text-gray-800 mb-2">{groupName.toUpperCase()}</h3>
                                <table className="w-full text-xs text-left text-black border border-black">
                                    <thead className="bg-gray-300">
                                        <tr>
                                            <th className="font-bold p-2 w-[30%] text-black uppercase tracking-wider text-left">Investigation</th>
                                            <th className="font-bold p-2 w-[15%] text-black uppercase tracking-wider text-left">Result</th>
                                            <th className="font-bold p-2 w-[15%] text-black uppercase tracking-wider text-left">Unit</th>
                                            <th className="font-bold p-2 w-[40%] text-black uppercase tracking-wider text-left">Reference Range</th>
                                        </tr>
                                    </thead>
                                   <tbody>
                                     {activeTests.map(key => {
                                        const hormoneKey = key as keyof HormoneReportResults;
                                        const param = results[hormoneKey];
                                        return (
                                          <tr key={key}>
                                            <td className="p-2">{key.toUpperCase()}</td>
                                            <td className="p-2 font-semibold">{toSentenceCase(param.result)}</td>
                                            <td className="p-2">{param.unit}</td>
                                            <td className="p-2 whitespace-pre-wrap">{param.referenceRange}</td>
                                        </tr>
                                     )})}
                                   </tbody>
                                </table>
                            </div>
                         )
                    })}
    
                    {hasOther && (
                        <div className="mb-4">
                            <h3 className="text-base font-bold text-gray-800 mb-2">OTHER HORMONE TESTS</h3>
                            <table className="w-full text-xs text-left text-black border border-black">
                                <thead className="bg-gray-300">
                                    <tr>
                                        <th className="font-bold p-2 w-[30%] text-black uppercase tracking-wider text-left">Investigation</th>
                                        <th className="font-bold p-2 w-[15%] text-black uppercase tracking-wider text-left">Result</th>
                                        <th className="font-bold p-2 w-[15%] text-black uppercase tracking-wider text-left">Unit</th>
                                        <th className="font-bold p-2 w-[40%] text-black uppercase tracking-wider text-left">Reference Range</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {otherHormones.map((item, index) => (
                                        <tr key={index}>
                                            <td className="p-2">{item.testName}</td>
                                            <td className="p-2 font-semibold">{toSentenceCase(item.result)}</td>
                                            <td className="p-2">{item.unit}</td>
                                            <td className="p-2 whitespace-pre-wrap">{item.referenceRange}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {reportData.hormoneReportInterpretation && (
                        <div className="mt-4">
                            <h3 className="text-sm font-bold text-gray-800">Interpretation</h3>
                            <p className="text-xs whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.hormoneReportInterpretation)}</p>
                        </div>
                    )}
                </div>
            </ReportPage>
        );
    }
    
    return null;
};

const SemenPage: React.FC<{ reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }> = ({ reportData, selectedTests, settings }) => {
    if (!selectedTests.semen) return null;
    const { physicalExamination, microscopicExamination } = reportData.semenAnalysis;

    // Fix for "Property 'trim' does not exist on type 'unknown'" by checking type
    const hasPhysical = Object.values(physicalExamination).some(v => typeof v === 'string' && v.trim().length > 0);
    const hasMicroscopic = Object.entries(microscopicExamination).filter(([k]) => !k.endsWith('Number')).some(([_,v]) => v && String(v).trim());

    if (!hasPhysical && !hasMicroscopic) return null;

    const AnalysisTable: React.FC<{title: string, data: any, labels: Record<string, string>, units?: Record<string,string>}> = ({title, data, labels, units}) => {
        return (
             <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800 mb-1">{title}</h3>
                <table className="w-full text-xs text-left text-black border-collapse border border-black">
                    <thead className="bg-gray-300">
                        <tr>
                            <th className="font-bold p-2 w-[40%] text-black uppercase tracking-wider text-left">Parameter</th>
                            <th className="font-bold p-2 w-[30%] text-black uppercase tracking-wider text-left">Result</th>
                            <th className="font-bold p-2 w-[30%] text-black uppercase tracking-wider text-left">Normal Range</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(data).map(([key, value]) => {
                            if (!labels[key]) return null;
                            return (
                                <tr key={key} className="border-b border-gray-400 last:border-0">
                                    <td className="p-2 font-medium">{labels[key]}</td>
                                    <td className="p-2 font-bold">{toSentenceCase(value)} {units?.[key] || ''}</td>
                                    <td className="p-2 text-slate-600">
                                        {key === 'volume' ? '>= 1.4 ml' : 
                                         key === 'ph' ? '>= 7.2' : 
                                         key === 'liquefactionTime' ? '< 60 min' : 
                                         key === 'spermCount' ? '>= 16 million/ml' : 
                                         key === 'totalSpermCount' ? '>= 39 million' : 
                                         key === 'progressiveMotility' ? '>= 30 %' : 
                                         key === 'totalMotility' ? '>= 42 %' : 
                                         key === 'deadSperm' ? '< 46 %' : 
                                         key === 'pusCells' ? '< 5 /HPF' : '-'}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <ReportPage reportData={reportData} title="SEMEN ANALYSIS REPORT" settings={settings}>
            <div className="flex-grow pt-2">
                {hasPhysical && (
                    <AnalysisTable 
                        title="PHYSICAL EXAMINATION"
                        data={physicalExamination}
                        labels={{volume: 'Volume', colour: 'Colour', ph: 'pH', liquefactionTime: 'Liquefaction Time', viscosity: 'Viscosity'}}
                        units={{volume: 'ml', liquefactionTime: 'min'}}
                    />
                )}
                {hasMicroscopic && (
                    <AnalysisTable 
                        title="MICROSCOPIC EXAMINATION"
                        data={microscopicExamination}
                        labels={{spermCount: 'Sperm Count', totalSpermCount: 'Total Sperm Count', progressiveMotility: 'Progressive Motility', nonProgressiveMotility: 'Non-Progressive Motility', immotile: 'Immotile', totalMotility: 'Total Motility', pusCells: 'Pus Cells', deadSperm: 'Vitality (Live Sperm)'}}
                        units={{spermCount: 'mill/ml', totalSpermCount: 'million', progressiveMotility: '%', nonProgressiveMotility: '%', immotile: '%', totalMotility: '%', deadSperm: '%'}}
                    />
                )}
                
                {reportData.semenAnalysisInterpretation && (
                    <div className="mt-4">
                        <h3 className="text-sm font-bold text-gray-800">Interpretation</h3>
                        <p className="text-xs whitespace-pre-wrap border-l-2 border-gray-300 pl-2 mt-1">{toSentenceCase(reportData.semenAnalysisInterpretation)}</p>
                    </div>
                )}
            </div>
        </ReportPage>
    )
}

const UsgPage: React.FC<{ reportData: CbcReportData, settings?: AppPrintSettings }> = ({ reportData, settings }) => {
    if (!reportData.html) return null;
    return (
        <ReportPage reportData={reportData} title={reportData.title || "ULTRASOUND REPORT"} settings={settings} className="print:break-after-page">
            <div className="p-4" dangerouslySetInnerHTML={{ __html: reportData.html }} />
        </ReportPage>
    );
};

const ReportPreview = React.forwardRef<HTMLDivElement, { reportData: CbcReportData, selectedTests: SelectedTests, settings?: AppPrintSettings }>((props, ref) => {
    // If it's a USG report or external, only render that page
    if (props.reportData.html) {
        return (
            <div ref={ref} className="flex flex-col items-center gap-8 bg-slate-200 p-8 print:p-0 print:bg-white print:gap-0 print:w-full print:block w-fit mx-auto">
                <UsgPage {...props} />
            </div>
        );
    }

    return (
        <div ref={ref} className="flex flex-col items-center gap-8 bg-slate-200 p-8 print:p-0 print:bg-white print:gap-0 print:w-full print:block w-fit mx-auto">
            <CbcPage {...props} />
            <OtherTestsPage {...props} />
            <SerologyPage {...props} />
            <UrinePage {...props} />
            <WidalPage {...props} />
            <CrpPage {...props} />
            <HormonePage {...props} />
            <SemenPage {...props} />
        </div>
    );
});

export default ReportPreview;
