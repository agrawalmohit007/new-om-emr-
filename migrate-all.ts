import { db, pool } from './src/db/index.js';
import { eq } from 'drizzle-orm';
import { 
    fallbackStore, appSettings, wards, clinicalTemplates, 
    pharmacyItems, pharmacySales, savedReports, labInventoryItems 
} from './src/db/schema.js';

async function migrate() {
    try {
        const fallbackData = await db.select().from(fallbackStore);
        
        for (const row of fallbackData) {
            const id = row.collection;
            const payload = row.payload as any;

            console.log(`Migrating ${id}...`);

            if (id === 'pharmacyInventory') {
                for (const item of payload) {
                    await db.insert(pharmacyItems).values({
                        id: item.id,
                        name: item.name,
                        genericName: item.genericName,
                        quantity: item.quantity,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        addedDate: item.addedDate,
                        mrp: item.mrp,
                        purchaseRate: item.purchaseRate,
                        saleRate: item.saleRate,
                        gstPercentage: item.gstPercentage,
                        supplierId: item.supplierId,
                        rackLocation: item.rackLocation,
                        minStockLevel: item.minStockLevel,
                        rxGroup: item.rxGroup
                    }).onConflictDoNothing();
                }
            } else if (id === 'pharmacySales') {
                for (const item of payload) {
                    await db.insert(pharmacySales).values({
                        id: item.id,
                        invoiceNo: item.invoiceNo,
                        date: item.date,
                        patientName: item.patientName,
                        doctorName: item.doctorName,
                        items: item.items,
                        subTotal: item.subTotal,
                        totalGst: item.totalGst,
                        discount: item.discount,
                        grandTotal: item.grandTotal,
                        paymentMethod: item.paymentMethod
                    }).onConflictDoNothing();
                }
            } else if (id === 'reportHistory') {
                for (const item of payload) {
                    await db.insert(savedReports).values({
                        id: item.id || `report_${item.timestamp}`,
                        reportData: item.reportData,
                        selectedTests: item.selectedTests,
                        billData: item.billData,
                        timestamp: item.timestamp,
                        isDeleted: item.isDeleted,
                        deletionReason: item.deletionReason,
                        deletionTimestamp: item.deletionTimestamp
                    }).onConflictDoNothing();
                }
            } else if (id === 'clinicalTemplates') {
                for (const item of payload) {
                    await db.insert(clinicalTemplates).values({
                        id: item.id,
                        title: item.title,
                        content: item.content,
                        category: item.category
                    }).onConflictDoNothing();
                }
            } else if (id === 'labInventory') {
                for (const item of payload) {
                    await db.insert(labInventoryItems).values({
                        id: item.id,
                        category: item.category,
                        name: item.name,
                        quantity: item.quantity,
                        pricePerUnit: item.pricePerUnit,
                        totalPrice: item.totalPrice,
                        orderDate: item.orderDate,
                        installationDate: item.installationDate,
                        useBeforeDate: item.useBeforeDate,
                        isOpen: item.isOpen,
                        remainingTests: item.remainingTests,
                        stripsPerBox: item.stripsPerBox,
                        pricePerStrip: item.pricePerStrip,
                        unitsPerBox: item.unitsPerBox
                    }).onConflictDoNothing();
                }
            } else if (id === 'wards') {
                for (const item of payload) {
                    await db.insert(wards).values({
                        id: item.id,
                        name: item.name,
                        beds: item.beds
                    }).onConflictDoNothing();
                }
            } else if (id === 'billingRates' || id === 'medicationMaster') {
                // these will go to appSettings
                await db.insert(appSettings).values({
                    key: id,
                    value: payload
                }).onConflictDoUpdate({
                    target: appSettings.key,
                    set: { value: payload }
                });
            } else {
                console.log(`Skipping unknown collection: ${id}`);
                continue;
            }

            // delete after migrating
            await db.delete(fallbackStore).where(eq(fallbackStore.collection, id));
            console.log(`Finished migrating ${id}`);
        }

    } catch(e: any) {
        console.error("Migration error:", e);
    } finally {
        pool.end();
    }
}
migrate();
