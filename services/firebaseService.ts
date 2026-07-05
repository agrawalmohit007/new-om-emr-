
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { FirebaseConfig } from '../types';
import firebaseConfig from '../firebase-applet-config.json';

let firestore: any = null;

export const initFirebase = (config: FirebaseConfig): boolean => {
    try {
        if (getApps().length === 0) {
            const app = initializeApp(firebaseConfig);
            firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL */
        } else {
            firestore = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
        }
        return true;
    } catch (e) {
        console.warn("⚠️ Firebase failed to initialize (device is likely offline):", e);
        firestore = null;
        return false;
    }
};

export const isCloudConfigured = (): boolean => true;

export const getCloudConfig = (): FirebaseConfig | null => {
    return {
        projectId: "gen-lang-client-0175658349",
        appId: "1:187251144542:web:cd340ba97ae4a3f81001cf",
        apiKey: "AIzaSyC_jxP3VDDBfk3Fny9u1y6iHmMLRVtTfjc",
        authDomain: "gen-lang-client-0175658349.firebaseapp.com",
        storageBucket: "gen-lang-client-0175658349.firebasestorage.app",
        messagingSenderId: "187251144542"
    };
};

export const syncToCloud = async (key: string, data: any) => {
    // 1. Always save to local server database first (Drizzle/Postgres)
    try {
        const cleanData = JSON.parse(JSON.stringify(data));
        await fetch(`/api/collection/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: cleanData })
        });
    } catch (e) {
        console.error(`Failed to save ${key} to local server:`, e);
    }

    // 2. Sync to Firebase Cloud if online and configured
    if (!firestore || !navigator.onLine) return;
    try {
        const cleanData = JSON.parse(JSON.stringify(data));
        const docRef = doc(firestore, 'omStore', key);
        await setDoc(docRef, { payload: cleanData });
    } catch (e: any) {
        handleCloudError(e, key);
    }
};

export const setupCloudListener = (onUpdate: (key: string, data: any) => void) => {
    const keys = [
        'patients', 'visits', 'labOrders', 'clinicalTemplates', 'notifications', 
        'labInventory', 'reportHistory', 'medicationMaster', 'consultants', 
        'wards', 'ipdAdmissions', 'billingRates',
        'pharmacyInventory', 'pharmacySuppliers', 'pharmacySales', 'specialties', 'systemUsers',
        'registryTemplates', 'registryRecords', 'appConfig', 'printSettings'
    ];

    // 1. Fetch initial data for all collections from the local server computer database at startup
    keys.forEach(async (key) => {
        try {
            const res = await fetch(`/api/collection/${key}`);
            if (res.ok) {
                const result = await res.json();
                if (result && result.payload !== undefined) {
                    onUpdate(key, result.payload);
                }
            }
        } catch (e) {
            console.warn(`Failed to fetch initial ${key} from local server:`, e);
        }
    });

    // 2. Set up SSE (Server-Sent Events) listener for local server updates
    let eventSource: EventSource | null = null;
    try {
        eventSource = new EventSource('/api/stream');
        eventSource.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data && data.collection) {
                    const res = await fetch(`/api/collection/${data.collection}`);
                    if (res.ok) {
                        const result = await res.json();
                        if (result && result.payload !== undefined) {
                            onUpdate(data.collection, result.payload);
                        }
                    }
                }
            } catch (e) {
                console.error("Error parsing local stream event:", e);
            }
        };
    } catch (e) {
        console.warn("SSE local stream failed to initialize:", e);
    }

    // 3. Set up Firebase cloud snapshot listeners (if online)
    let firebaseUnsubs: (() => void)[] = [];
    if (firestore) {
        try {
            firebaseUnsubs = keys.map(key => {
                const docRef = doc(firestore, 'omStore', key);
                return onSnapshot(docRef, async (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data && data.payload !== undefined) {
                            onUpdate(key, data.payload);
                            // Sync cloud updates back to local server
                            try {
                                await fetch(`/api/collection/${key}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ payload: data.payload })
                                });
                            } catch (e) {
                                // Quiet ignore
                            }
                        }
                    }
                }, (err) => {
                    console.warn(`Firebase snapshot listener error for ${key}:`, err);
                });
            });
        } catch (e) {
            console.warn("Failed to setup Firebase listeners:", e);
        }
    }

    return () => {
        if (eventSource) eventSource.close();
        firebaseUnsubs.forEach(u => u());
    };
};

const handleCloudError = (error: any, context: string) => {
    console.warn(`⚠️ Cloud Sync Limited for ${context}:`, error);
};
