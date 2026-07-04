
import { BillItem, CbcReportData, SelectedTests, HormoneReportSelection, LabOrder, ServicePrices } from '../types';

export const DEFAULT_PRICES: ServicePrices = {
    cbc: { name: 'Complete Blood Count (CBC)', price: 200 },
    bloodGroup: { name: 'Blood Grouping & Rh Typing', price: 50 },
    hiv: { name: 'HIV I & II', price: 100 },
    hbsag: { name: 'HBsAg', price: 100 },
    vdrl: { name: 'VDRL', price: 100 },
    urine: { name: 'Urine R/M', price: 100 },
    upt: { name: 'Urine Pregnancy Test (UPT)', price: 100 },
    urineLh: { name: 'Urine LH Test', price: 100 },
    bloodSugar: { name: 'Random Blood Sugar', price: 50 },
    rbs: { name: 'Random Blood Sugar', price: 50 },
    tsh: { name: 'TSH', price: 300 },
    t4: { name: 'T4', price: 300 },
    ft4: { name: 'FT4', price: 300 },
    t3: { name: 'T3', price: 300 },
    ft3: { name: 'FT3', price: 300 },
    amh: { name: 'AMH', price: 800 },
    lh: { name: 'Serum LH', price: 400 },
    fsh: { name: 'FSH', price: 400 },
    prolactin: { name: 'Serum Prolactin', price: 400 },
    crp: { name: 'CRP', price: 300 },
    hba1c: { name: 'HbA1c', price: 300 },
    widal: { name: 'Widal Test', price: 300 },
    ultrasound: { name: 'Ultrasound', price: 800 },
    serology: { name: 'Serology (HIV/HBsAg/VDRL)', price: 300 } // Batch price if general serology selected
};

export const calculateLabFeesForOrder = (order: LabOrder, prices: ServicePrices = DEFAULT_PRICES): number => {
    let total = 0;
    if (order.ultrasound) total += prices.ultrasound?.price || 0;
    
    // Sum up individual tests based on selection
    if (order.tests) {
        Object.entries(order.tests).forEach(([key, isSelected]) => {
            if (isSelected) {
                // Mapping specific keys or general ones
                if (key === 'serology') {
                    // Use batch price if generic serology flag is true, but usually this is just a category.
                    // If granular selection isn't available in order yet, use batch price.
                    total += prices.serology?.price || 300;
                } else if (key === 'hormone') {
                    // Check for granular hormone details
                    if (order.tests.hormoneDetails) {
                        Object.entries(order.tests.hormoneDetails).forEach(([hKey, hSelected]) => {
                            if (hSelected && prices[hKey]) {
                                total += prices[hKey].price;
                            }
                        });
                    } else {
                        // Fallback if no specific hormone selected but category is checked (unlikely in new flow)
                        // Maybe charge for TSH as default or nothing
                    }
                } else if (key === 'other') {
                    // For legacy 'other', we don't know unless specified. 
                    // New orders will use bloodSugar/bloodGroup booleans.
                } else if (prices[key]) {
                    total += prices[key].price;
                }
            }
        });
    }
    return total;
};

export const generateBillItemsFromReport = (selectedTests: SelectedTests, reportData: CbcReportData, prices: ServicePrices = DEFAULT_PRICES): BillItem[] => {
    const items: BillItem[] = [];

    if (selectedTests.cbc && prices.cbc) {
        items.push({ id: 'cbc', testName: prices.cbc.name, price: prices.cbc.price });
    }
    
    // Granular other blood tests
    if ((selectedTests.bloodSugar || (selectedTests.other && reportData.otherTests.randomBloodSugar)) && prices.bloodSugar) {
        items.push({ id: 'bloodSugar', testName: prices.bloodSugar.name, price: prices.bloodSugar.price });
    }
    if ((selectedTests.bloodGroup || (selectedTests.other && (reportData.otherTests.bloodGroup || reportData.otherTests.rhType))) && prices.bloodGroup) {
        items.push({ id: 'bloodGroup', testName: prices.bloodGroup.name, price: prices.bloodGroup.price });
    }

    if (selectedTests.serology) {
        if (reportData.serology.selection.hiv && prices.hiv) {
             items.push({ id: 'hiv', testName: prices.hiv.name, price: prices.hiv.price });
        }
        if (reportData.serology.selection.hbsag && prices.hbsag) {
             items.push({ id: 'hbsag', testName: prices.hbsag.name, price: prices.hbsag.price });
        }
        if (reportData.serology.selection.vdrl && prices.vdrl) {
             items.push({ id: 'vdrl', testName: prices.vdrl.name, price: prices.vdrl.price });
        }
    }
    
    if (selectedTests.urine && prices.urine) {
        items.push({ id: 'urine', testName: prices.urine.name, price: prices.urine.price });
        if (reportData.urineReport.pregnancyTest && prices.upt) {
            items.push({ id: 'upt', testName: prices.upt.name, price: prices.upt.price });
        }
        if (reportData.urineReport.urineLh && prices.urineLh) {
             items.push({ id: 'urineLh', testName: prices.urineLh.name, price: prices.urineLh.price });
        }
    }
    
    if (selectedTests.widal && prices.widal) {
        items.push({ id: 'widal', testName: prices.widal.name, price: prices.widal.price });
    }
    
    if (selectedTests.crp && prices.crp) {
        items.push({ id: 'crp', testName: prices.crp.name, price: prices.crp.price });
    }
    
    if (selectedTests.hormone) {
        const hormoneSelection = reportData.hormoneReport.selection;
        (Object.keys(hormoneSelection) as Array<keyof HormoneReportSelection>).forEach(key => {
            if (hormoneSelection[key] && prices[key]) {
                items.push({ id: key, testName: prices[key].name, price: prices[key].price });
            }
        });
    }

    return items;
};

export const getAllBillableItems = (prices: ServicePrices = DEFAULT_PRICES): BillItem[] => {
    return Object.entries(prices).map(([id, { name, price }]) => ({
        id,
        testName: name,
        price,
    }));
};
