import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface CreateTicketModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = {
  'Account Related': [
    'Unable to Change Password',
    'Unable to View Transactions',
    'Dashboard Data is Not Loading Properly',
    'Not Getting Notification Emails',
    'Not Getting Notification SMS',
  ],
  'KYC Related': [
    'KYC Pending for Long Time',
    'KYC Rejected Even with Correct Data',
    'Update Address & its KYC Document',
    'Update PAN Number & its KYC Document',
    'Update Company/Business Information and its KYC Document',
  ],
  'Transaction Related': [
    'Money Deducted But Transaction Failed',
    'Money Deducted But Page Redirection Failed',
    'Transaction Settlement Pending',
    'Unable to Use Credit Card',
    'Credit Card Transaction is Failing',
    'Raise Charges Related Dispute',
    'Transactions History Mismatch',
    'Wrong Beneficiary Details',
  ],
  'Report Fraud': [
    'Report Fraud Transaction',
    'My Account is Compromised',
  ],
};

export default function CreateTicketModal({ userId, onClose, onSuccess }: CreateTicketModalProps) {
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
    setSubCategory('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (files.length + selectedFiles.length > 3) {
      setError('Maximum 3 files allowed');
      return;
    }

    const invalidFiles = selectedFiles.filter(file => {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      const maxSize = 1048576;
      return !validTypes.includes(file.type) || file.size > maxSize;
    });

    if (invalidFiles.length > 0) {
      setError('Files must be PNG, JPG, JPEG, or PDF and less than 1MB each');
      return;
    }

    setFiles([...files, ...selectedFiles]);
    setError('');
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-support-ticket`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            category,
            sub_category: subCategory,
            description,
            ip: 'user',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create ticket');
      }

      const ticketId = result.ticket.id;

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ticketId', ticketId);
        formData.append('userId', userId);
        formData.append('ip', 'user');

        const uploadResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-ticket-attachment`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          console.error('Failed to upload file:', file.name);
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create Support Ticket</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-900">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category <span className="text-red-600">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={handleCategoryChange}
              required
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
            >
              <option value="">Select a category</option>
              {Object.keys(CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {category && (
            <div>
              <label htmlFor="subCategory" className="block text-sm font-medium text-gray-700 mb-2">
                Sub-Category <span className="text-red-600">*</span>
              </label>
              <select
                id="subCategory"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
              >
                <option value="">Select a sub-category</option>
                {CATEGORIES[category as keyof typeof CATEGORIES].map((subCat) => (
                  <option key={subCat} value={subCat}>
                    {subCat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description of Help Needed <span className="text-red-600">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              required
              rows={6}
              maxLength={1000}
              placeholder="Please describe your issue in detail..."
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-none"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{description.length}/1000</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments (Optional - Max 3 files)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 3}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#8c76f0] hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-gray-600"
            >
              <Upload className="w-5 h-5" />
              <span className="text-sm font-medium">
                {files.length >= 3 ? 'Maximum files reached' : 'Upload Files (PNG, JPG, JPEG, PDF - Max 1MB each)'}
              </span>
            </button>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-900">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
            <p className="text-sm text-purple-900 font-medium">
              Please provide as much detail as possible to help us resolve your issue quickly.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
