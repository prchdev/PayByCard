import { useState, useRef, useCallback } from 'react';
import {
  X, Upload, Download, FileText, CheckCircle, XCircle,
  AlertCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';

interface BulkRow {
  reference: string;
  payout_date: string;
  utr_reference: string;
  confirmed_amount: string;
}

interface ParsedRow extends BulkRow {
  row_number: number;
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

const TEMPLATE_HEADERS = ['Reference', 'Payout Date (MM/DD/YYYY)', 'UTR / Reference Number', 'Confirmed Amount'];
const TEMPLATE_SAMPLE = [
  ['PAY-20260610-123456', '06/10/2026', 'UTR123456789012', '10000.00'],
  ['PAY-20260610-789012', '06/10/2026', 'UTR987654321098', '25000.50'],
];

function downloadTemplate() {
  const escape = (v: string) => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    TEMPLATE_HEADERS.map(escape).join(','),
    ...TEMPLATE_SAMPLE.map(r => r.map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-payout-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): { rows: ParsedRow[]; headerError?: string } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { rows: [], headerError: 'File is empty' };

  // Normalise a CSV line respecting quoted fields
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headerCols = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const expected = ['reference', 'payoutdate', 'utrreferencenumber', 'confirmedamount'];
  const mismatches = expected.filter((e, i) => !headerCols[i]?.includes(e.replace('payoutdatemmddyyyy', 'payoutdate').slice(0, 8)));

  // lenient header check — just ensure we have 4 columns
  if (headerCols.length < 4) {
    return { rows: [], headerError: `Header row must have at least 4 columns: ${TEMPLATE_HEADERS.join(', ')}` };
  }
  // warn if column names look completely wrong
  if (!headerCols[0].includes('ref') && !headerCols[0].includes('pay')) {
    return { rows: [], headerError: `First column should be "Reference" — found "${lines[0].split(',')[0]}". Please use the provided template.` };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 4 || cols.every(c => !c)) continue; // skip blank rows

    const row: ParsedRow = {
      row_number: i,
      reference: cols[0] || '',
      payout_date: cols[1] || '',
      utr_reference: cols[2] || '',
      confirmed_amount: cols[3] || '',
    };

    // Client-side validation
    if (!row.reference) row.clientError = 'Reference is empty';
    else if (!row.payout_date) row.clientError = 'Payout Date is empty';
    else if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row.payout_date)) row.clientError = `Invalid date "${row.payout_date}" — use MM/DD/YYYY`;
    else if (!row.utr_reference) row.clientError = 'UTR / Reference Number is empty';
    else if (!row.confirmed_amount || isNaN(parseFloat(row.confirmed_amount.replace(/,/g, ''))) || parseFloat(row.confirmed_amount.replace(/,/g, '')) <= 0) {
      row.clientError = `Invalid amount "${row.confirmed_amount}"`;
    }

    rows.push(row);
  }

  return { rows };
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

  const validRows = parsedRows.filter(r => !r.clientError);
  const clientErrorRows = parsedRows.filter(r => r.clientError);
  const hasClientErrors = clientErrorRows.length > 0;

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file');
      return;
    }
    setFileName(file.name);
    setParseError('');
    setResults(null);
    setSummary(null);
    setApiError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, headerError } = parseCSV(text);
      if (headerError) { setParseError(headerError); setParsedRows([]); return; }
      if (rows.length === 0) { setParseError('No data rows found in the file'); setParsedRows([]); return; }
      if (rows.length > 500) { setParseError('Maximum 500 rows allowed per upload'); setParsedRows([]); return; }
      setParsedRows(rows);
    };
    reader.readAsText(file);
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

  const handleProcess = async () => {
    if (validRows.length === 0) return;
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
            rows: validRows.map(r => ({
              reference: r.reference,
              payout_date: r.payout_date,
              utr_reference: r.utr_reference,
              confirmed_amount: r.confirmed_amount,
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
              <p className="text-white/70 text-sm">Upload a CSV file to process multiple payouts at once</p>
            </div>
          </div>
          <button onClick={onClose} disabled={processing} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Template download */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                Download the template CSV, fill in the payout details, then upload below.
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
                <p className="text-sm font-medium text-gray-800">{fileName}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">Drop your CSV file here, or <span className="text-[#8c76f0]">browse</span></p>
                  <p className="text-xs text-gray-400 mt-1">Supports .csv files up to 500 rows</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onInputChange} />
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

          {/* Preview / results table */}
          {parsedRows.length > 0 && !results && (
            <div className="space-y-3">
              {/* Stats bar */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  <span className="text-gray-900 font-bold">{parsedRows.length}</span> rows parsed
                  {hasClientErrors && (
                    <span className="ml-2 text-red-600 font-semibold">· {clientErrorRows.length} with errors</span>
                  )}
                  {validRows.length > 0 && (
                    <span className="ml-2 text-green-600 font-semibold">· {validRows.length} valid</span>
                  )}
                </p>
                {hasClientErrors && (
                  <button
                    onClick={() => setShowErrors(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showErrors ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showErrors ? 'Hide' : 'Show'} errors
                  </button>
                )}
              </div>

              {hasClientErrors && showErrors && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-amber-100 border-b border-amber-200">
                    <p className="text-xs font-semibold text-amber-800">Rows with validation errors — these will be skipped</p>
                  </div>
                  <div className="divide-y divide-amber-100 max-h-40 overflow-y-auto">
                    {clientErrorRows.map(r => (
                      <div key={r.row_number} className="px-4 py-2 flex items-start gap-3">
                        <span className="text-xs text-amber-600 font-mono whitespace-nowrap">Row {r.row_number}</span>
                        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{r.reference || '(empty)'}</span>
                        <span className="text-xs text-red-700 flex-1">{r.clientError}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview of valid rows */}
              {validRows.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-600">{validRows.length} valid rows ready to process</p>
                  </div>
                  <div className="overflow-x-auto max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {['#', 'Reference', 'Payout Date', 'UTR / Ref No.', 'Amount'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {validRows.map(r => (
                          <tr key={r.row_number} className="hover:bg-purple-50/30">
                            <td className="px-3 py-2 text-gray-400">{r.row_number}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-[#8c76f0]">{r.reference}</td>
                            <td className="px-3 py-2 text-gray-700">{r.payout_date}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{r.utr_reference}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900">₹{parseFloat(r.confirmed_amount.replace(/,/g, '')).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results breakdown */}
          {results && (
            <div className="space-y-3">
              {resultSucceeded.length > 0 && (
                <div className="border border-green-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-green-50 border-b border-green-200">
                    <p className="text-xs font-semibold text-green-800">{resultSucceeded.length} payouts processed successfully</p>
                  </div>
                  <div className="divide-y divide-green-50 max-h-44 overflow-y-auto">
                    {resultSucceeded.map(r => (
                      <div key={r.row_number} className="px-4 py-2 flex items-center gap-3">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-xs text-gray-500 whitespace-nowrap">Row {r.row_number}</span>
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
                        <span className="text-xs text-gray-500 whitespace-nowrap">Row {r.row_number}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono font-semibold text-red-700 block">{r.reference}</span>
                          <span className="text-xs text-red-600">{r.error}</span>
                        </div>
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
              disabled={processing || validRows.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#8c76f0] to-[#7c63e0] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Processing {validRows.length} payout{validRows.length !== 1 ? 's' : ''}...</>
              ) : (
                <><Upload className="w-4 h-4" />Process {validRows.length} Payout{validRows.length !== 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
