import * as XLSX from 'xlsx';

export interface AxisPayoutRow {
  amount: number;
  beneficiaryName: string;
  beneficiaryAccountNumber: string;
  beneficiaryIfsc: string;
  paymentReference: string;
}

interface MasterSettings {
  bank_account_number: string | null;
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

export async function downloadAxisBankPayoutTemplate(
  rows: AxisPayoutRow[],
  companyBankAccount: string,
): Promise<void> {
  if (!companyBankAccount) {
    throw new Error('Company bank account number is not configured. Please set it in Master Settings.');
  }

  const response = await fetch('/templates/Axis_Bank_Bulk_Payout_Template.xlsx');
  if (!response.ok) {
    throw new Error('Failed to load Axis Bank template file.');
  }
  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const existingData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  const headers = existingData[0] as string[];

  const dataRows = rows.map((row) => {
    const refNoDash = row.paymentReference.replace(/-/g, '');
    const refNoSpaces = row.beneficiaryName.replace(/\s+/g, '');
    const paymentMode = row.amount < 200000 ? 'NEFT' : 'RTGS';

    const values: Record<string, string | number> = {
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

    return headers.map((h) => values[h] ?? '');
  });

  const newWs = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  newWs['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 15) }));

  XLSX.utils.book_append_sheet(wb, newWs, wb.SheetNames[0], true);

  const fileName = `AxisBank_Payout_${formatFileNameDateTime()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
