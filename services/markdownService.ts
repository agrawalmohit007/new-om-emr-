

import { CbcReportData, SelectedTests, CbcParameter, HormoneReportSelection, HormoneReportResults } from '../types';

const isAbnormal = (resultStr: string, rangeStr: string): boolean => {
    if (!resultStr || !rangeStr || resultStr.trim() === '' || rangeStr.trim() === '') return false;

    // Handle special text-based results
    const lowerResult = resultStr.toLowerCase();
    const lowerRange = rangeStr.toLowerCase();
    
    if (lowerRange.includes('non-reactive') && lowerResult.includes('reactive')) return true;
    if (lowerRange.includes('nonreactive') && lowerResult.includes('reactive')) return true;
    if (lowerRange.includes('absent') && (lowerResult.includes('present') || lowerResult.includes('+'))) return true;
    if (lowerRange.includes('nil') && (lowerResult.includes('present') || lowerResult.includes('+'))) return true;

    // Attempt to parse numbers
    const resultNum = parseFloat(resultStr);
    if (isNaN(resultNum)) return false; // Can't compare if result isn't a number

    // Clean up range string by removing parentheses and contents
    const cleanRangeStr = rangeStr.replace(/\(.*\)/g, '').trim();

    // Type 1: "lower - upper" or "lower – upper"
    const rangeMatch = cleanRangeStr.match(/([\d.,]+)\s*[-–]\s*([\d.,]+)/);
    if (rangeMatch) {
        const lowerBound = parseFloat(rangeMatch[1].replace(/,/g, ''));
        const upperBound = parseFloat(rangeMatch[2].replace(/,/g, ''));
        if (!isNaN(lowerBound) && !isNaN(upperBound)) {
            return resultNum < lowerBound || resultNum > upperBound;
        }
    }

    // Type 2: "< upper" or "> lower"
    const limitMatch = cleanRangeStr.match(/([<>])\s*([\d.,]+)/);
    if (limitMatch) {
        const operator = limitMatch[1];
        const limit = parseFloat(limitMatch[2].replace(/,/g, ''));
        if (!isNaN(limit)) {
            if (operator === '<') return resultNum >= limit;
            if (operator === '>') return resultNum <= limit;
        }
    }
    
    return false;
};

const formatResult = (result: string, range: string) => {
    return isAbnormal(result, range) ? `**${result}**` : result;
};


const generateMarkdownReport = (reportData: CbcReportData, selectedTests: SelectedTests): string => {
    if (!reportData || !selectedTests) return '';
    
    let md = '';

    // Header
    md += `# Medical Report\n\n`;
    md += `**Lab Serial No:** ${reportData.serialNumber}\n`;
    md += `**Bill No:** ${reportData.billNumber}\n\n`;


    // Patient Details
    md += `## Patient Details\n`;
    md += `| | |\n`;
    md += `|---|---|\n`;
    md += `| **Patient's Name** | ${reportData.patientName || ''} |\n`;
    md += `| **Ref. By** | ${reportData.refBy || ''} |\n`;
    md += `| **Date** | ${reportData.date || ''} |\n`;
    md += `| **Age** | ${reportData.age || ''} |\n`;
    md += `| **Address** | ${reportData.address || ''} |\n\n`;

    // Helper for tables
    const createCbcTable = (title: string, data: CbcParameter[]) => {
        const filteredData = data.filter(p => p.result && p.result.trim() !== '');
        if (filteredData.length === 0) return '';

        let tableMd = `### ${title}\n`;
        tableMd += `| Investigation | Result | Unit | Reference Range |\n`;
        tableMd += `|---|---|---|---|\n`;
        filteredData.forEach(row => {
            tableMd += `| ${row.investigation} | ${formatResult(row.result, row.referenceRange)} | ${row.unit} | ${row.referenceRange} |\n`;
        });
        return tableMd + '\n';
    };

    // CBC
    if (selectedTests.cbc) {
        const cbcMd = createCbcTable("Haematology Parameters", reportData.haematologyParameters) +
                      createCbcTable("White Blood Cell Parameters", reportData.whiteBloodCellParameters) +
                      createCbcTable("Platelet Parameters", reportData.plateletParameters);
        if (cbcMd.trim()) {
            md += `## Complete Blood Count (CBC)\n\n`;
            md += cbcMd;
            if (reportData.cbcInterpretation) {
                md += `**Interpretation:**\n${reportData.cbcInterpretation}\n\n`;
            }
        }
    }
    
    // Other Tests
    if (selectedTests.other) {
        const { otherTests } = reportData;
        const hasContent = otherTests.randomBloodSugar || otherTests.bloodGroup || otherTests.rhType;
        if (hasContent) {
            md += `## Other Blood Tests\n\n`;
            if (otherTests.randomBloodSugar) md += `* **Random Blood Sugar:** ${formatResult(otherTests.randomBloodSugar, '70-140')}\n`;
            if (otherTests.bloodGroup) md += `* **Blood Group:** ${otherTests.bloodGroup}\n`;
            if (otherTests.rhType) md += `* **Rh Type:** ${otherTests.rhType}\n`;
            md += '\n';
            if (reportData.otherTestsInterpretation) {
                md += `**Interpretation:**\n${reportData.otherTestsInterpretation}\n\n`;
            }
        }
    }
    
    // Serology
    if (selectedTests.serology) {
        const { selection, results } = reportData.serology;
        const hasContent = selection.hbsag || selection.hiv || selection.vdrl;
        if (hasContent) {
            md += `## Serology Report\n\n`;
            if(selection.hiv) md += `* **HIV I & II:** ${formatResult(results.hiv1, 'NonReactive')} / ${formatResult(results.hiv2, 'NonReactive')}\n`;
            if(selection.hbsag) md += `* **HBsAg:** ${formatResult(results.hbsag, 'NonReactive')}\n`;
            if(selection.vdrl) md += `* **VDRL:** ${formatResult(results.vdrl, 'NonReactive')}\n`;
            md += '\n';
            if (reportData.serologyInterpretation) {
                md += `**Interpretation:**\n${reportData.serologyInterpretation}\n\n`;
            }
        }
    }

    // Urine
    if (selectedTests.urine) {
        const { urineReport } = reportData;
        const createList = (title: string, data: Record<string, any>, labels: Record<string, string>) => {
            let listMd = `### ${title}\n`;
            let content = '';
            for (const [key, value] of Object.entries(data)) {
                if (value && typeof value === 'string' && value.trim()) {
                    content += `* **${labels[key] || key}:** ${formatResult(value, 'absent')}\n`;
                }
            }
            return content ? listMd + content + '\n' : '';
        };
        const physical = createList('Physical Examination', urineReport.physicalExamination, {quantity: 'Quantity', urineColor: 'Urine Color', appearance: 'Appearance', specificGravity: 'Specific Gravity'});
        const chemical = createList('Chemical Examination', urineReport.chemicalExamination, {albumin: 'Albumin', sugar: 'Sugar', bileSalt: 'Bile Salt', ketoneBody: 'Ketone Body', ph: 'pH'});
        const microscopic = createList('Microscopic Examination', urineReport.microscopicExamination, {pusCells: 'Pus Cells', rbc: 'R.B.C.', epithelialCell: 'Epithelial Cell', crystal: 'Crystal', bacteria: 'Bacteria', cast: 'Cast'});
        
        if (physical || chemical || microscopic) {
            md += `## Urine Report\n\n`;
            md += physical;
            md += chemical;
            md += microscopic;
            if (reportData.urineReportInterpretation) {
                md += `**Interpretation:**\n${reportData.urineReportInterpretation}\n\n`;
            }
        }
    }

    // Widal
    if (selectedTests.widal && reportData.widalReport.parameters.some(p => p.result)) {
        md += `## Widal Test Report\n\n`;
        md += `| Investigation | Result | Observed Titre | Reference Value | Unit |\n`;
        md += `|---|---|---|---|---|\n`;
        reportData.widalReport.parameters.forEach(p => {
            if (p.result) {
                md += `| ${p.investigation} | ${formatResult(p.result, 'Non-Reactive')} | ${p.titre} | ${p.referenceValue} | ${p.unit} |\n`;
            }
        });
        md += `\n`;
        if (reportData.widalReportInterpretation) {
            md += `**Interpretation:**\n${reportData.widalReportInterpretation}\n\n`;
        }
    }

    // CRP
    if (selectedTests.crp && reportData.crpReport.result) {
        md += `## CRP Report\n\n`;
        md += `* **Result:** ${formatResult(reportData.crpReport.result, reportData.crpReport.referenceRange)} ${reportData.crpReport.unit}\n`;
        md += `* **Reference Range:** ${reportData.crpReport.referenceRange} ${reportData.crpReport.unit}\n\n`;
        if (reportData.crpReportInterpretation) {
            md += `**Interpretation:**\n${reportData.crpReportInterpretation}\n\n`;
        }
    }

    // Hormone
    if (selectedTests.hormone) {
        const { selection, results, otherHormones } = reportData.hormoneReport;
        const hasStandard = Object.keys(selection).some(key => selection[key as keyof HormoneReportSelection] && results[key as keyof HormoneReportResults].result);
        const hasOther = otherHormones && otherHormones.length > 0;
        
        if (hasStandard || hasOther) {
            md += `## Hormone & Diabetes Report\n\n`;
            md += `| Investigation | Result | Unit | Reference Range |\n`;
            md += `|---|---|---|---|\n`;
            
            // Standard
            Object.entries(selection).forEach(([key, isSelected]) => {
                if (isSelected) {
                    const resultData = results[key as keyof HormoneReportResults];
                    if (resultData && resultData.result) {
                        md += `| ${key.toUpperCase()} | ${formatResult(resultData.result, resultData.referenceRange)} | ${resultData.unit} | ${resultData.referenceRange} |\n`;
                    }
                }
            });

            // Other
            if(otherHormones) {
                otherHormones.forEach(item => {
                    md += `| ${item.testName} | ${formatResult(item.result, item.referenceRange)} | ${item.unit} | ${item.referenceRange} |\n`;
                });
            }

            md += '\n';
            if (reportData.hormoneReportInterpretation) {
                md += `**Interpretation:**\n${reportData.hormoneReportInterpretation}\n\n`;
            }
        }
    }
    
    // Semen Analysis
    if (selectedTests.semen) {
        const { physicalExamination, microscopicExamination } = reportData.semenAnalysis;
        // Fix for "Property 'trim' does not exist on type 'unknown'" by checking type
        const hasPhysical = Object.values(physicalExamination).some(v => typeof v === 'string' && v.trim().length > 0);
        const hasMicroscopic = Object.entries(microscopicExamination).filter(([k]) => !k.endsWith('Number')).some(([_,v]) => v && String(v).trim());
        if (hasPhysical || hasMicroscopic) {
            md += `## Semen Analysis Report\n\n`;
            
            if (hasPhysical) {
                md += `### Physical Examination\n`;
                if(physicalExamination.volume) md += `* **Volume:** ${formatResult(physicalExamination.volume, '>= 1.4')} ml\n`;
                if(physicalExamination.colour) md += `* **Colour:** ${physicalExamination.colour}\n`;
                if(physicalExamination.ph) md += `* **pH:** ${formatResult(physicalExamination.ph, '>= 7.2')}\n`;
                if(physicalExamination.liquefactionTime) md += `* **Liquefaction Time:** ${formatResult(physicalExamination.liquefactionTime, '< 60')} min\n`;
                if(physicalExamination.viscosity) md += `* **Viscosity:** ${physicalExamination.viscosity}\n`;
                md += '\n';
            }

            if (hasMicroscopic) {
                md += `### Microscopic Examination\n`;
                if(microscopicExamination.spermCount) md += `* **Sperm Count:** ${formatResult(microscopicExamination.spermCount, '>= 16')} million/ml\n`;
                if(microscopicExamination.totalSpermCount) md += `* **Total Sperm Count:** ${formatResult(microscopicExamination.totalSpermCount, '>= 39')} million\n`;
                if(microscopicExamination.progressiveMotility) md += `* **Progressive Motility:** ${formatResult(microscopicExamination.progressiveMotility, '>= 30')} %\n`;
                if(microscopicExamination.nonProgressiveMotility) md += `* **Non-Progressive Motility:** ${microscopicExamination.nonProgressiveMotility} %\n`;
                if(microscopicExamination.immotile) md += `* **Immotile:** ${microscopicExamination.immotile} %\n`;
                if(microscopicExamination.totalMotility) md += `* **Total Motility:** ${formatResult(microscopicExamination.totalMotility, '>= 42')} %\n`;
                if(microscopicExamination.pusCells) md += `* **Pus Cells:** ${formatResult(microscopicExamination.pusCells, '< 5')} /HPF\n`;
                if(microscopicExamination.deadSperm) md += `* **Dead Sperm:** ${formatResult(microscopicExamination.deadSperm, '< 46')} %\n`;
                md += '\n';
            }

            if (reportData.semenAnalysisInterpretation) {
                md += `**Interpretation:**\n${reportData.semenAnalysisInterpretation}\n\n`;
            }
        }
    }


    // Footer
    md += `\n---\n\n`;
    md += `**${reportData.doctorName}**\n`;

    return md;
}

export { generateMarkdownReport };