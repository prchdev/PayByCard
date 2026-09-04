import * as XLSX from 'xlsx';

export interface AxisPayoutRow {
  amount: number;
  beneficiaryName: string;
  beneficiaryAccountNumber: string;
  beneficiaryIfsc: string;
  paymentReference: string;
}

function formatIndianDate(): string {
  const now = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return now;
}

function formatFileNameDateTime(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const time = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/:/g, '');
  return `${date}_${time}`;
}

/**
 * Load the original Axis Bank template from the public folder.
 * Returns the workbook and worksheet WITHOUT modifying them.
 * The template has 31 columns (A–AE) with multiline headers.
 */
async function loadTemplate(): Promise<{ wb: XLSX.WorkBook; ws: XLSX.WorkSheet }> {
  const response = await fetch('/templates/Axis_Bank_Bulk_Payout_Template.xlsx');
  if (!response.ok) {
    throw new Error('Failed to load Axis Bank template file.');
  }
  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true, cellNF: true, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { wb, ws };
}

/**
 * Map a payout row to the template's 31 columns by position.
 *
 * Column order in the Axis Bank template (A–AE):
 *   A  Debit Account Number (Mandatory)
 *   B  Transaction Amount (Mandatory)
 *   C  Transaction Currency (Non-Mandatory)
 *   D  Beneficiary Name (Mandatory)
 *   E  Beneficiary Account Number (Mandatory)
 *   F  Beneficiary IFSC Code (Mandatory)
 *   G  Transaction Date (Mandatory)
 *   H  Payment Mode (Mandatory)
 *   I  Customer Reference Number (Mandatory)
 *   J  Beneficiary Nickname/Code (Mandatory)
 *   K  Bank Account Type (Non-Mandatory)
 *   L  Beneficiary Type (Non-Mandatory)
 *   M  LEI (Non-Mandatory)
 *   N  Debit Narration (Non-Mandatory)
 *   O  Credit Narration (Non-Mandatory)
 *   P  Invoice Number (Non-Mandatory)
 *   Q  Beneficiary Address 1 (Non-Mandatory)
 *   R  Beneficiary Address 2 (Non-Mandatory)
 *   S  Beneficiary Address 3 (Non-Mandatory)
 *   T  Beneficiary City (Non-Mandatory)
 *   U  Beneficiary State (Non-Mandatory)
 *   V  Beneficiary Pin Code (Non-Mandatory)
 *   W  Beneficiary Email address 1 (Non-Mandatory)
 *   X  Beneficiary Email address 2 (Non-Mandatory)
 *   Y  Beneficiary Mobile Number (Non-Mandatory)
 *   Z  Add Info1 (Non-Mandatory)
 *   AA Add Info2 (Non-Mandatory)
 *   AB Add Info3 (Non-Mandatory)
 *   AC Add Info4 (Non-Mandatory)
 *   AD Add Info5 (Non-Mandatory)
 *   AE Add Info6 (Non-Mandatory)
 */
function mapRowToTemplate(
  row: AxisPayoutRow,
  companyBankAccount: string,
): (string | number)[] {
  const refNoDash = row.paymentReference.replace(/-/g, '');
  const refNoSpaces = row.beneficiaryName.replace(/\s+/g, '');
  const paymentMode = row.amount < 200000 ? 'N' : 'R';

  // 31 values matching columns A–AE
  return [
    companyBankAccount,          // A: Debit Account Number
    row.amount,                  // B: Transaction Amount
    'INR',                       // C: Transaction Currency
    row.beneficiaryName,         // D: Beneficiary Name
    row.beneficiaryAccountNumber,// E: Beneficiary Account Number
    row.beneficiaryIfsc,         // F: Beneficiary IFSC Code
    formatIndianDate(),          // G: Transaction Date
    paymentMode,                 // H: Payment Mode
    refNoDash,                   // I: Customer Reference Number
    refNoSpaces,                 // J: Beneficiary Nickname/Code
    '',                          // K: Bank Account Type
    '',                          // L: Beneficiary Type
    '',                          // M: LEI
    '',                          // N: Debit Narration
    '',                          // O: Credit Narration
    row.paymentReference,        // P: Invoice Number
    '',                          // Q: Beneficiary Address 1
    '',                          // R: Beneficiary Address 2
    '',                          // S: Beneficiary Address 3
    '',                          // T: Beneficiary City
    '',                          // U: Beneficiary State
    '',                          // V: Beneficiary Pin Code
    '',                          // W: Beneficiary Email address 1
    '',                          // X: Beneficiary Email address 2
    '',                          // Y: Beneficiary Mobile Number
    '',                          // Z: Add Info1
    '',                          // AA: Add Info2
    '',                          // AB: Add Info3
    '',                          // AC: Add Info4
    '',                          // AD: Add Info5
    '',                          // AE: Add Info6
  ];
}

/**
 * Append data rows to the existing worksheet WITHOUT changing headers,
 * column widths, styles, or any other formatting.
 * Uses XLSX.utils.sheet_add_aoa with origin to append after the header row.
 */
function appendRowsToSheet(
  ws: XLSX.WorkSheet,
  dataRows: (string | number)[][],
): void {
  XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 'A2' });
}

export async function downloadAxisBankPayoutTemplate(
  rows: AxisPayoutRow[],
  companyBankAccount: string,
): Promise<void> {
  if (!companyBankAccount) {
    throw new Error('Company bank account number is not configured. Please set it in Master Settings.');
  }

  const { wb, ws } = await loadTemplate();

  const dataRows = rows.map((row) => mapRowToTemplate(row, companyBankAccount));

  appendRowsToSheet(ws, dataRows);

  const fileName = `AxisBank_Payout_${formatFileNameDateTime()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generate an xlsx file with all transaction data and return it as a Blob.
 * Used for one-time verification of file creation logic.
 */
export async function generateAxisBankPayoutBlob(
  rows: AxisPayoutRow[],
  companyBankAccount: string,
): Promise<Blob> {
  if (!companyBankAccount) {
    throw new Error('Company bank account number is not configured. Please set it in Master Settings.');
  }

  const { wb, ws } = await loadTemplate();

  const dataRows = rows.map((row) => mapRowToTemplate(row, companyBankAccount));

  appendRowsToSheet(ws, dataRows);

  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
