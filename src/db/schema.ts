import { pgTable, text, timestamp, jsonb, boolean, integer, bigint, real } from 'drizzle-orm/pg-core';

export const systemUsers = pgTable('system_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  roles: jsonb('roles').notNull(), // array of strings
  pin: text('pin').notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const consultants = pgTable('consultants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  qualifications: text('qualifications'),
  specialty: text('specialty'),
  baseFee: integer('base_fee'),
  followUpFee: integer('follow_up_fee'),
  pin: text('pin'),
  roles: jsonb('roles'), // array of strings
});

export const patients = pgTable('patients', {
  id: text('id').primaryKey(),
  uhid: text('uhid').notNull(),
  name: text('name').notNull(),
  age: text('age').notNull(),
  address: text('address'),
  mobile: text('mobile'),
  type: text('type').notNull(),
  isPreviouslyRegistered: boolean('is_previously_registered').default(false),
  pregnancyInfo: jsonb('pregnancy_info'), 
  obstetricHistory: text('obstetric_history'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const visits = pgTable('visits', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').references(() => patients.id).notNull(),
  date: text('date').notNull(),
  visitType: text('visit_type').notNull(),
  fees: integer('fees'),
  orders: jsonb('orders'), // Keeping simplified order reference here for legacy if needed
  isApproved: boolean('is_approved').default(false),
  callingStatus: text('calling_status'),
  vitals: jsonb('vitals'),
  paymentStatus: text('payment_status'),
  paymentMethod: text('payment_method'),
  assignedDoctor: text('assigned_doctor'),
  discount: integer('discount'),
  doctorActionStatus: text('doctor_action_status'),
  collectedBy: text('collected_by'),
  finalBill: jsonb('final_bill'),
  complaints: text('complaints'),
  visitObstetricHistory: text('visit_obstetric_history'),
  menstrualHistory: text('menstrual_history'),
  visitLmp: text('visit_lmp'),
  visitEdd: text('visit_edd'),
  visitPog: text('visit_pog'),
  generalExamination: text('general_examination'),
  examinationDetails: text('examination_details'),
  prescription: text('prescription'),
  remarks: text('remarks'),
  followUpDate: text('follow_up_date'),
  caseStatus: text('case_status').default('open'),
  parentVisitId: text('parent_visit_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const labOrders = pgTable('lab_orders', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').references(() => patients.id).notNull(),
  tests: jsonb('tests').notNull(),
  ultrasound: boolean('ultrasound').default(false),
  status: text('status').notNull(),
  reportData: jsonb('report_data'),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
});

// Since rewriting the entire app's sync logic to individual CRUD endpoints takes time,
// we create a fallback table for collections we haven't normalized yet.
export const fallbackStore = pgTable('fallback_store', {
  collection: text('collection').primaryKey(),
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wards = pgTable('wards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  beds: jsonb('beds').default([]),
});

export const clinicalTemplates = pgTable('clinical_templates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull(),
});

export const pharmacyItems = pgTable('pharmacy_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  genericName: text('generic_name'),
  quantity: real('quantity').notNull().default(0),
  batchNumber: text('batch_number').notNull(),
  expiryDate: text('expiry_date').notNull(),
  addedDate: text('added_date').notNull(),
  mrp: real('mrp').notNull().default(0),
  purchaseRate: real('purchase_rate').notNull().default(0),
  saleRate: real('sale_rate').notNull().default(0),
  gstPercentage: real('gst_percentage').notNull().default(0),
  supplierId: text('supplier_id'),
  rackLocation: text('rack_location'),
  minStockLevel: real('min_stock_level').notNull().default(0),
  rxGroup: jsonb('rx_group'),
});

export const pharmacySales = pgTable('pharmacy_sales', {
  id: text('id').primaryKey(),
  invoiceNo: text('invoice_no').notNull(),
  date: text('date').notNull(),
  patientName: text('patient_name').notNull(),
  doctorName: text('doctor_name').notNull(),
  items: jsonb('items').notNull(),
  subTotal: real('sub_total').notNull().default(0),
  totalGst: real('total_gst').notNull().default(0),
  discount: real('discount').notNull().default(0),
  grandTotal: real('grand_total').notNull().default(0),
  paymentMethod: text('payment_method').notNull(),
});

export const savedReports = pgTable('saved_reports', {
  id: text('id').primaryKey(),
  reportData: jsonb('report_data').notNull(),
  selectedTests: jsonb('selected_tests').notNull(),
  billData: jsonb('bill_data'),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  isDeleted: boolean('is_deleted').default(false),
  deletionReason: text('deletion_reason'),
  deletionTimestamp: bigint('deletion_timestamp', { mode: 'number' }),
});

export const labInventoryItems = pgTable('lab_inventory_items', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull().default(0),
  pricePerUnit: real('price_per_unit').notNull().default(0),
  totalPrice: real('total_price').notNull().default(0),
  orderDate: text('order_date').notNull(),
  installationDate: text('installation_date'),
  useBeforeDate: text('use_before_date').notNull(),
  isOpen: boolean('is_open').default(false),
  remainingTests: integer('remaining_tests').notNull().default(0),
  stripsPerBox: integer('strips_per_box'),
  pricePerStrip: real('price_per_strip'),
  unitsPerBox: integer('units_per_box'),
});

export const ipdAdmissions = pgTable('ipd_admissions', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').references(() => patients.id).notNull(),
  admissionDate: text('admission_date').notNull(),
  dischargeDate: text('discharge_date'),
  wardId: text('ward_id').notNull(),
  bedId: text('bed_id').notNull(),
  diagnosis: text('diagnosis').notNull(),
  insuranceProvider: text('insurance_provider'),
  policyNumber: text('policy_number'),
  status: text('status').notNull(),
  primaryDoctor: text('primary_doctor').notNull(),
  dailyCharges: integer('daily_charges').default(0),
  advanceAmount: integer('advance_amount'),
  totalBill: integer('total_bill'),
  payments: jsonb('payments'),
  discount: integer('discount'),
  
  // EMR Features stored as JSONB associated with this specific admission.
  // Overcomes the JSON fallbackStore pitfall where the entire hospital was written in 1 query!
  admissionNote: jsonb('admission_note'),
  roundNotes: jsonb('round_notes').default([]),
  medications: jsonb('medications').default([]),
  nursingNotes: jsonb('nursing_notes').default([]),
  fluidBalance: jsonb('fluid_balance').default([]),
  charges: jsonb('charges').default([]),
  labourProgress: jsonb('labour_progress').default([]),
  deliveryDetails: jsonb('delivery_details'),
  operativeNotes: jsonb('operative_notes').default([]),
  consentForms: jsonb('consent_forms').default([]),
  dischargeSummary: jsonb('discharge_summary'),
});
