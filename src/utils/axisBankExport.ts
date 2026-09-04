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
 */
async function loadTemplate(): Promise<{ wb: XLSX.WorkBook; ws: XLSX.WorkSheet; headers: string[] }> {
  const response = await fetch('/templates/Axis_Bank_Bulk_Payout_Template.xlsx');
  if (!response.ok) {
    throw new Error('Failed to load Axis Bank template file.');
  }
  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true, cellNF: true, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const existingData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  const headers = existingData[0] as string[];

  return { wb, ws, headers };
}

/**
 * Map a payout row to the template's column values.
 * Only fills columns that have data; all other columns remain blank
 * exactly as in the original template.
 */
function mapRowToTemplate(
  row: AxisPayoutRow,
  headers: string[],
  companyBankAccount: string,
): (string | number)[] {
  const refNoDash = row.paymentReference.replace(/-/g, '');
  const refNoSpaces = row.beneficiaryName.replace(/\s+/g, '');
  const paymentMode = row.amount < 200000 ? 'NEFT' : 'RTGS';

  const valueMap: Record<string, string | number> = {
    'Debit Account Number': companyBankAccount,
    'Transaction Amount': row.amount,
    'Transaction Currency': 'INR',
    'Beneficiary Name': row.beneficiaryName,
    'Beneficiary Account Number': row.beneficiaryAccountNumber,
    'Beneficiary IFSC Code': row.beneficiaryIfsc,
    'Transaction Date': formatIndianDate(),
    'Payment Mode': paymentMode,
    'Customer Reference Number': refNoDash,
    'Beneficiary Nickname/Code': refNoSpaces,
    'Invoice Number': row.paymentReference,
  };

  return headers.map((h) => (h in valueMap ? valueMap[h] : ''));
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

  const { wb, ws, headers } = await loadTemplate();

  const dataRows = rows.map((row) => mapRowToTemplate(row, headers, companyBankAccount));

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

  const { wb, ws, headers } = await loadTemplate();

  const dataRows = rows.map((row) => mapRowToTemplate(row, headers, companyBankAccount));

  appendRowsToSheet(ws, dataRows);

  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
