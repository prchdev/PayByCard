import { useState, useRef, useCallback } from 'react';
import {
  X, Upload, Download, FileText, CheckCircle, XCircle,
  AlertCircle, Loader2, ChevronDown, ChevronUp, FileSpreadsheet,
} from 'lucide-react';
import { useTableSort, SortableTh } from './TableSort';
import * as XLSX from 'xlsx';

interface ParsedRow {
  row_number: number;
  crn: string;
  reference: string;          // CRN with hyphens removed
  transaction_date: string;  // DD/MM/YYYY
  utr: string;
  amount_raw: string;        // raw amount text (e.g. "INR 5,000.00")
  amount: number;            // parsed numeric amount
  status: string;            // "Successful" / "Failed"
  clientError?: string;
}

interface RowResult {
  row_number: number;
  reference: string;
  success: boolean;
  error?: string;
}

interface BulkPayoutModalProps {
  adminId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TEMPLATE_URL = '/templates/AxisBank_Bulk_Update_Payout_Template.xlsx';

function downloadTemplate() {
  const a = document.createElement('a');
  a.href = TEMPLATE_URL;
  a.download = 'Bulk_Update_Payout.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/INR/i, '').replace(/,/g, '').trim();
  return parseFloat(cleaned);
}

function parseXlsx(file: File, callback: (rows: ParsedRow[], headerError?: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      if (jsonRows.length === 0) {
        callback([], 'No data rows found in the file');
        return;
      }

      const rows: ParsedRow[] = [];
      for (let i = 0; i < jsonRows.length; i++) {
        const r = jsonRows[i];
        const crn = String(r['CRN'] ?? r['crn'] ?? '').trim();
        const txnDate = String(r['Transaction Date'] ?? r['transaction_date'] ?? r['TransactionDate'] ?? '').trim();
        const utr = String(r['UTR'] ?? r['utr'] ?? '').trim();
        const amountRaw = String(r['Amount'] ?? r['amount'] ?? '').trim();
        const status = String(r['Status'] ?? r['status'] ?? '').trim();

        if (!crn && !txnDate && !utr && !amountRaw && !status) continue;

        const reference = crn.replace(/-/g, '');
        const amount = parseAmount(amountRaw);

        const row: ParsedRow = {
          row_number: i + 2,
          crn,
          reference,
          transaction_date: txnDate,
          utr,
          amount_raw: amountRaw,
          amount,
          status,
        };

        if (!crn) row.clientError = 'CRN is empty';
        else if (crn === '-') row.clientError = 'CRN is "-" (no reference)';
        else if (!txnDate) row.clientError = 'Transaction Date is empty';
        else if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(txnDate)) row.clientError = `Invalid date "${txnDate}" — use DD/MM/YYYY`;
        else if (!utr) row.clientError = 'UTR is empty';
        else if (utr === '-') row.clientError = 'UTR is "-" (no UTR)';
        else if (!amountRaw) row.clientError = 'Amount is empty';
        else if (isNaN(amount) || amount <= 0) row.clientError = `Invalid amount "${amountRaw}"`;
        else if (!status) row.clientError = 'Status is empty';

        rows.push(row);
      }

      if (rows.length === 0) {
        callback([], 'No valid data rows found');
        return;
      }
      if (rows.length > 500) {
        callback([], 'Maximum 500 rows allowed per upload');
        return;
      }

      callback(rows);
    } catch {
      callback([], 'Failed to parse XLSX file. Please ensure it is a valid Excel file.');
    }
  };
  reader.readAsArrayBuffer(file);
}

export default function BulkPayoutModal({ adminId, onClose, onSuccess }: BulkPayoutModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; succeeded: number; failed: number } | null>(null);
  const [showErrors, setShowErrors] = useState(true);
  const [apiError, setApiError] = useState('');
  const [checkingDb, setCheckingDb] = useState(false);
  const [dbChecked, setDbChecked] = useState(false);
  const [eligibleRows, setEligibleRows] = useState<ParsedRow[]>([]);
  const [ineligibleRows, setIneligibleRows] = useState<ParsedRow[]>([]);

  const clientErrorRows = parsedRows.filter(r => r.clientError);
  const hasClientErrors = clientErrorRows.length > 0;
  const successfulRows = parsedRows.filter(r => !r.clientError && r.status.toLowerCase() === 'successful');
  const failedStatusRows = parsedRows.filter(r => !r.clientError && r.status.toLowerCase() !== 'successful');

  const rowAccessor = (r: ParsedRow, key: string) => {
    switch (key) {
      case 'rowNum': return r.row_number;
      case 'crn': return r.crn;
      case 'txnDate': return r.transaction_date;
      case 'utr': return r.utr;
      case 'amount': return r.amount;
      case 'status': return r.status;
      default: return '';
    }
  };

  const eligibleSort = useTableSort(eligibleRows, rowAccessor);
  const successfulSort = useTableSort(successfulRows, rowAccessor);

  const handleFile = useCallback((file: File) => {
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isXlsx) {
      setParseError('Please upload an .xlsx file');
      return;
    }
    setFileName(file.name);
    setParseError('');
    setResults(null);
    setSummary(null);
    setApiError('');
    setDbChecked(false);
    setEligibleRows([]);
    setIneligibleRows([]);

    parseXlsx(file, (rows, headerError) => {
      if (headerError) { setParseError(headerError); setParsedRows([]); return; }
      setParsedRows(rows);
    });
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  // Automatically check DB status after parsing
  const checkDbStatus = useCallback(async (rowsToCheck: ParsedRow[]) => {
    if (rowsToCheck.length === 0) return;
    setCheckingDb(true);
    setApiError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-payout`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId,
            dry_run: true,
            rows: rowsToCheck.map(r => ({
              reference: r.reference,
              payout_date: r.transaction_date,
              utr_reference: r.utr,
              confirmed_amount: String(r.amount),
            })),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Database check failed');

      const previewMap = new Map<string, { action: string; reason?: string; current_status?: string }>();
      (data.preview || []).forEach((p: { reference: string; action: string; reason?: string; current_status?: string }) => {
        previewMap.set(p.reference, p);
      });

      const eligible: ParsedRow[] = [];
      const ineligible: ParsedRow[] = [];
      rowsToCheck.forEach(r => {
        const dbResult = previewMap.get(r.reference);
        if (dbResult && dbResult.action === 'will_update') {
          eligible.push(r);
        } else {
          ineligible.push({ ...r, clientError: dbResult?.reason || 'Not eligible for update' });
        }
      });

      setEligibleRows(eligible);
      setIneligibleRows(ineligible);
      setDbChecked(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Database check failed');
    } finally {
      setCheckingDb(false);
    }
  }, [adminId]);

  // Trigger DB check automatically when successful rows are available
  if (successfulRows.length > 0 && !dbChecked && !checkingDb && !apiError) {
    checkDbStatus(successfulRows);
  }

  const handleProcess = async () => {
    if (eligibleRows.length === 0) return;
    setProcessing(true);
    setApiError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-payout`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId,
            rows: eligibleRows.map(r => ({
              reference: r.reference,
              payout_date: r.transaction_date,
              utr_reference: r.utr,
              confirmed_amount: String(r.amount),
            })),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk processing failed');
      setResults(data.results);
      setSummary(data.summary);
      if (data.summary?.succeeded > 0) onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const resetFile = () => {
    setParsedRows([]);
    setParseError('');
    setResults(null);
    setSummary(null);
    setApiError('');
    setFileName('');
    setDbChecked(false);
    setEligibleRows([]);
    setIneligibleRows([]);
  };

  const resultFailed = results?.filter(r => !r.success) ?? [];
  const resultSucceeded = results?.filter(r => r.success) ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-[#8c76f0] to-[#7c63e0] rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Bulk Update Payout</h2>
              <p className="text-white/70 text-sm">Upload an XLSX file to update multiple transaction statuses</p>
            </div>
          </div>
          <button onClick={onClose} disabled={processing} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Template download */}
          {!results && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  Download the template XLSX, fill in the transaction details, then upload below.
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap ml-3"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </button>
            </div>
          )}

          {/* Drop zone */}
          {!results && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragging ? 'border-[#8c76f0] bg-purple-50' : 'border-gray-300 hover:border-[#8c76f0] hover:bg-purple-50/30'
              }`}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              {fileName ? (
                <div>
                  <p className="text-sm font-medium text-gray-800">{fileName}</p>
                  <p className="text-xs text-gray-500 mt-1">Click to choose a different file</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">Drop your XLSX file here, or <span className="text-[#8c76f0]">browse</span></p>
                  <p className="text-xs text-gray-400 mt-1">Supports .xlsx files up to 500 rows</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onInputChange} />
            </div>
          )}

          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          )}

          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          {/* Loading state while checking DB */}
          {checkingDb && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#8c76f0] animate-spin mr-2" />
              <p className="text-sm text-gray-600">Checking transaction status in database...</p>
            </div>
          )}

          {/* Parsed rows with DB-checked results */}
          {parsedRows.length > 0 && !results && !checkingDb && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  <span className="text-gray-900 font-bold">{parsedRows.length}</span> rows parsed
                  {hasClientErrors && (
                    <span className="ml-2 text-red-600 font-semibold">· {clientErrorRows.length} with errors</span>
                  )}
                  {dbChecked && (
                    <>
                      <span className="ml-2 text-green-600 font-semibold">· {eligibleRows.length} eligible for update</span>
                      {ineligibleRows.length > 0 && (
                        <span className="ml-2 text-amber-600 font-semibold">· {ineligibleRows.length} already completed/refunded</span>
                      )}
                    </>
                  )}
                  {!dbChecked && successfulRows.length > 0 && (
                    <span className="ml-2 text-gray-500 font-semibold">· {successfulRows.length} Successful (checking...)</span>
                  )}
                  {failedStatusRows.length > 0 && (
                    <span className="ml-2 text-gray-500 font-semibold">· {failedStatusRows.length} other status (skipped)</span>
                  )}
                </p>
                <button onClick={resetFile} className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Choose different file
                </button>
              </div>

              {hasClientErrors && (
                <div>
                  <button
                    onClick={() => setShowErrors(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
                  >
                    {showErrors ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showErrors ? 'Hide' : 'Show'} {clientErrorRows.length} rows with errors
                  </button>
                  {showErrors && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2 bg-amber-100 border-b border-amber-200">
                        <p className="text-xs font-semibold text-amber-800">Rows with validation errors — these will be skipped</p>
                      </div>
                      <div className="divide-y divide-amber-100 max-h-40 overflow-y-auto">
                        {clientErrorRows.map(r => (
                          <div key={r.row_number} className="px-4 py-2 flex items-start gap-3">
                            <span className="text-xs text-amber-600 font-mono whitespace-nowrap">Row {r.row_number}</span>
                            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{r.crn || '(empty)'}</span>
                            <span className="text-xs text-red-700 flex-1">{r.clientError}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Eligible rows (DB confirmed not completed/refunded) */}
              {dbChecked && eligibleRows.length > 0 && (
                <div className="border border-green-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-semibold text-green-800">{eligibleRows.length} transactions eligible for update</p>
                  </div>
                  <div className="overflow-x-auto max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <SortableTh label="#" sortKey="rowNum" sortConfig={eligibleSort.sortConfig} onSort={eligibleSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="CRN" sortKey="crn" sortConfig={eligibleSort.sortConfig} onSort={eligibleSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="Txn Date" sortKey="txnDate" sortConfig={eligibleSort.sortConfig} onSort={eligibleSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="UTR" sortKey="utr" sortConfig={eligibleSort.sortConfig} onSort={eligibleSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="Amount" sortKey="amount" sortConfig={eligibleSort.sortConfig} onSort={eligibleSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="Status" sortKey="status" sortConfig={eligibleSort.sortConfig} onSort={eligibleSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {eligibleSort.sortedData.map(r => (
                          <tr key={r.row_number} className="hover:bg-green-50/30">
                            <td className="px-3 py-2 text-gray-400">{r.row_number}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-[#8c76f0]">{r.crn}</td>
                            <td className="px-3 py-2 text-gray-700">{r.transaction_date}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{r.utr}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2"><span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full text-xs font-medium">{r.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ineligible rows (already completed/refunded/not found) */}
              {dbChecked && ineligibleRows.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-semibold text-amber-800">{ineligibleRows.length} transactions will be skipped (already completed/refunded or not found)</p>
                  </div>
                  <div className="divide-y divide-amber-100 max-h-40 overflow-y-auto">
                    {ineligibleRows.map(r => (
                      <div key={r.row_number} className="px-4 py-2 flex items-start gap-3">
                        <span className="text-xs font-mono font-semibold text-gray-700 whitespace-nowrap">{r.crn}</span>
                        <span className="text-xs text-amber-700 flex-1">{r.clientError}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show all successful rows before DB check completes */}
              {!dbChecked && successfulRows.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-600">{successfulRows.length} rows with "Successful" status — checking database...</p>
                  </div>
                  <div className="overflow-x-auto max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <SortableTh label="#" sortKey="rowNum" sortConfig={successfulSort.sortConfig} onSort={successfulSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="CRN" sortKey="crn" sortConfig={successfulSort.sortConfig} onSort={successfulSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="Txn Date" sortKey="txnDate" sortConfig={successfulSort.sortConfig} onSort={successfulSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="UTR" sortKey="utr" sortConfig={successfulSort.sortConfig} onSort={successfulSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="Amount" sortKey="amount" sortConfig={successfulSort.sortConfig} onSort={successfulSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                          <SortableTh label="Status" sortKey="status" sortConfig={successfulSort.sortConfig} onSort={successfulSort.handleSort} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {successfulSort.sortedData.map(r => (
                          <tr key={r.row_number} className="hover:bg-purple-50/30">
                            <td className="px-3 py-2 text-gray-400">{r.row_number}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-[#8c76f0]">{r.crn}</td>
                            <td className="px-3 py-2 text-gray-700">{r.transaction_date}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{r.utr}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2"><span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full text-xs font-medium">{r.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results summary */}
          {summary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total Rows</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{summary.succeeded}</p>
                <p className="text-xs text-green-600 mt-0.5">Succeeded</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
                <p className="text-xs text-red-500 mt-0.5">Failed</p>
              </div>
            </div>
          )}

          {/* Results breakdown */}
          {results && (
            <div className="space-y-3">
              {resultSucceeded.length > 0 && (
                <div className="border border-green-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-green-50 border-b border-green-200">
                    <p className="text-xs font-semibold text-green-800">{resultSucceeded.length} transactions updated successfully</p>
                  </div>
                  <div className="divide-y divide-green-50 max-h-44 overflow-y-auto">
                    {resultSucceeded.map(r => (
                      <div key={r.row_number} className="px-4 py-2 flex items-center gap-3">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-xs font-mono font-semibold text-green-700">{r.reference}</span>
                        <span className="text-xs text-green-600 ml-auto">Completed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resultFailed.length > 0 && (
                <div className="border border-red-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                    <p className="text-xs font-semibold text-red-800">{resultFailed.length} rows failed</p>
                  </div>
                  <div className="divide-y divide-red-50 max-h-44 overflow-y-auto">
                    {resultFailed.map(r => (
                      <div key={r.row_number} className="px-4 py-2 flex items-start gap-3">
                        <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-mono font-semibold text-red-700 block">{r.reference}</span>
                        <span className="text-xs text-red-600">{r.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={handleProcess}
              disabled={processing || !dbChecked || eligibleRows.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#8c76f0] to-[#7c63e0] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Processing {eligibleRows.length} update{eligibleRows.length !== 1 ? 's' : ''}...</>
              ) : !dbChecked ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Checking database...</>
              ) : eligibleRows.length === 0 ? (
                <><XCircle className="w-4 h-4" />No eligible transactions</>
              ) : (
                <><CheckCircle className="w-4 h-4" />Confirm {eligibleRows.length} Update{eligibleRows.length !== 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
