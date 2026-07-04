
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { FirebaseConfig } from '../types';
import firebaseConfig from '../firebase-applet-config.json';

let firestore: any = null;

export const initFirebase = (config: FirebaseConfig): boolean => {
    if (getApps().length === 0) {
        const app = initializeApp(firebaseConfig);
        firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL */
    } else {
        firestore = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
    }
    return true;
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
    if (!firestore) return;
    try {
        const cleanData = JSON.parse(JSON.stringify(data));
        const docRef = doc(firestore, 'omStore', key);
        await setDoc(docRef, { payload: cleanData });
    } catch (e: any) {
        handleCloudError(e, key);
    }
};

export const setupCloudListener = (onUpdate: (key: string, data: any) => void) => {
    if (!firestore) return () => {};
    
    const keys = [
        'patients', 'visits', 'labOrders', 'clinicalTemplates', 'notifications', 
        'labInventory', 'reportHistory', 'medicationMaster', 'consultants', 
        'wards', 'ipdAdmissions', 'billingRates',
        'pharmacyInventory', 'pharmacySuppliers', 'pharmacySales', 'specialties', 'systemUsers',
        'registryTemplates', 'registryRecords', 'appConfig', 'printSettings'
    ];
    
    const unsubs = keys.map(key => {
        const docRef = doc(firestore, 'omStore', key);
        return onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data && data.payload) {
                    onUpdate(key, data.payload);
                }
            }
        });
    });
    
    return () => {
        unsubs.forEach(u => u());
    };
};

const handleCloudError = (error: any, context: string) => {
    console.warn(`⚠️ Cloud Sync Limited for ${context}:`, error);
};
