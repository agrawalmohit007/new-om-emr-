import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';
import { systemUsers, consultants, patients, visits, labOrders, fallbackStore, ipdAdmissions, pharmacyItems, pharmacySales, savedReports, clinicalTemplates, labInventoryItems, wards, appSettings } from './src/db/schema.js';

async function checkData() {
  console.log("Checking database tables...");

  try {
    const userCount = await db.select({ count: sql`count(*)` }).from(systemUsers);
    console.log(`System Users: ${userCount[0].count}`);

    const consultantCount = await db.select({ count: sql`count(*)` }).from(consultants);
    console.log(`Consultants: ${consultantCount[0].count}`);

    const patientCount = await db.select({ count: sql`count(*)` }).from(patients);
    console.log(`Patients: ${patientCount[0].count}`);

    const visitCount = await db.select({ count: sql`count(*)` }).from(visits);
    console.log(`Visits: ${visitCount[0].count}`);

    const labOrderCount = await db.select({ count: sql`count(*)` }).from(labOrders);
    console.log(`Lab Orders: ${labOrderCount[0].count}`);

    const fallbackCount = await db.select({ count: sql`count(*)` }).from(fallbackStore);
    console.log(`Fallback Store (legacy collections): ${fallbackCount[0].count}`);

    const admissionCount = await db.select({ count: sql`count(*)` }).from(ipdAdmissions);
    console.log(`IPD Admissions: ${admissionCount[0].count}`);

    const pharmacyItemsCount = await db.select({ count: sql`count(*)` }).from(pharmacyItems);
    console.log(`Pharmacy Items: ${pharmacyItemsCount[0].count}`);

    const pharmacySalesCount = await db.select({ count: sql`count(*)` }).from(pharmacySales);
    console.log(`Pharmacy Sales: ${pharmacySalesCount[0].count}`);

    const reportsCount = await db.select({ count: sql`count(*)` }).from(savedReports);
    console.log(`Saved Reports: ${reportsCount[0].count}`);

    const templatesCount = await db.select({ count: sql`count(*)` }).from(clinicalTemplates);
    console.log(`Clinical Templates: ${templatesCount[0].count}`);

    const labInventoryCount = await db.select({ count: sql`count(*)` }).from(labInventoryItems);
    console.log(`Lab Inventory Items: ${labInventoryCount[0].count}`);

    const wardsCount = await db.select({ count: sql`count(*)` }).from(wards);
    console.log(`Wards: ${wardsCount[0].count}`);

    const settingsCount = await db.select({ count: sql`count(*)` }).from(appSettings);
    console.log(`App Settings (Keys): ${settingsCount[0].count}`);

  } catch (error: any) {
    console.error("Error querying database:", error.message);
  } finally {
    process.exit(0);
  }
}

checkData();
