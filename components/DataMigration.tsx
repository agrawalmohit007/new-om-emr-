import React, { useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const sourceConfig = {
  apiKey: "AIzaSyBuz3PJGUd7JA5QpP-QVN5l3PNA6NxOR3E",
  authDomain: "instasnapdx.firebaseapp.com",
  projectId: "instasnapdx",
  storageBucket: "instasnapdx.firebasestorage.app",
  messagingSenderId: "580157172250",
  appId: "1:580157172250:web:5936b1fb8db593705fffa3"
};

const targetConfig = {
  apiKey: "AIzaSyAKGpjbTrvwlOd7DBFtvzMW3jpMzVLTlRc",
  authDomain: "om-emr.firebaseapp.com",
  projectId: "om-emr",
  storageBucket: "om-emr.firebasestorage.app",
  messagingSenderId: "1042034377181",
  appId: "1:1042034377181:web:f85c9ccc8ab8cdc0ecf634"
};

const COLLECTION = 'lab_app_data';

const keys = [
  'patients', 'visits', 'labOrders', 'clinicalTemplates', 'notifications', 
  'labInventory', 'reportHistory', 'medicationMaster', 'consultants', 
  'wards', 'ipdAdmissions', 'billingRates',
  'pharmacyInventory', 'pharmacySuppliers', 'pharmacySales', 'specialties', 'systemUsers'
];

export const DataMigration: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready to migrate.');
  const [logs, setLogs] = useState<string[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);

  const log = (msg: string) => {
    setLogs(prev => [...prev, msg]);
    console.log(msg);
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    setStatus('Migrating...');
    setLogs([]);

    try {
      // Initialize Source App (instasnapdx)
      let sourceApp;
      if (!getApps().find(app => app.name === 'sourceApp')) {
        sourceApp = initializeApp(sourceConfig, 'sourceApp');
      } else {
        sourceApp = getApps().find(app => app.name === 'sourceApp')!;
      }
      const sourceDb = getFirestore(sourceApp);

      // Initialize Target App (om-emr) - This might already be initialized as default
      let targetApp;
      if (!getApps().find(app => app.name === 'targetApp')) {
        targetApp = initializeApp(targetConfig, 'targetApp');
      } else {
        targetApp = getApps().find(app => app.name === 'targetApp')!;
      }
      const targetDb = getFirestore(targetApp);

      log('Initialized both Firebase applications.');

      for (const key of keys) {
        log(`Migrating ${key}...`);
        try {
          const sourceDocRef = doc(sourceDb, COLLECTION, key);
          const sourceDocSnap = await getDoc(sourceDocRef);
          
          if (sourceDocSnap.exists()) {
            const data = sourceDocSnap.data();
            const targetDocRef = doc(targetDb, COLLECTION, key);
            await setDoc(targetDocRef, data);
            log(`✅ Successfully migrated ${key}.`);
          } else {
            log(`⚠️ No data found for ${key} in source database.`);
          }
        } catch (e: any) {
          log(`❌ Failed to migrate ${key}: ${e.message}`);
        }
      }

      setStatus('Migration Complete!');
    } catch (error: any) {
      log(`❌ Migration failed: ${error.message}`);
      setStatus('Migration Failed.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Database Migration Tool</h2>
      <p className="mb-4 text-gray-600">
        This tool will copy all data from the old project (instasnapdx) to the new project (om-emr).
      </p>
      <div className="mb-4">
        <button
          onClick={handleMigration}
          disabled={isMigrating}
          className={`px-4 py-2 rounded text-white font-medium ${isMigrating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isMigrating ? 'Migrating...' : 'Start Migration'}
        </button>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold mb-2">Status: {status}</h3>
        <div className="bg-gray-100 p-4 rounded h-64 overflow-y-auto text-sm font-mono">
          {logs.map((L, i) => (
            <div key={i} className="mb-1">{L}</div>
          ))}
          {logs.length === 0 && <span className="text-gray-400">Waiting to start...</span>}
        </div>
      </div>
    </div>
  );
};
