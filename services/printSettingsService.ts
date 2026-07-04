
import { AppPrintSettings } from '../types';

export const DEFAULT_PRINT_SETTINGS: AppPrintSettings = {
    lab: {
        marginTop: 5,
        marginBottom: 10,
        marginLeft: 15,
        marginRight: 5,
        headerHeight: 55,
        footerHeight: 10
    },
    prescription: {
        marginTop: 60, // 60mm padding top originally
        marginBottom: 20,
        marginLeft: 20,
        marginRight: 20,
        headerHeight: 0, // In Rx logic, marginTop usually covers the header area
        footerHeight: 20
    },
    bill: {
        marginTop: 5,
        marginBottom: 10,
        marginLeft: 10,
        marginRight: 10,
        headerHeight: 70, // 265px approx 70mm
        footerHeight: 10
    }
};

const STORAGE_KEY = 'app_print_settings';

export const getPrintSettings = (): AppPrintSettings => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            // Merge with default to ensure all keys exist if schema changes
            return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(stored) };
        } catch (e) {
            console.error("Failed to parse print settings", e);
            return DEFAULT_PRINT_SETTINGS;
        }
    }
    return DEFAULT_PRINT_SETTINGS;
};

export const savePrintSettings = (settings: AppPrintSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};
