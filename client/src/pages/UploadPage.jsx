import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CsvUploader from '../components/CsvUploader';
import CsvPreview from '../components/CsvPreview';
import { api } from '../lib/api';

export default function UploadPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('full');
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  async function handleUpload(file) {
    setError(null);
    setUploading(true);
    try {
      const data = await api.uploadCsv(file);
      setAccounts(data.accounts);
      setPreview(data.preview);
    } catch (err) {
      setError(err.message);
      setAccounts(null);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleStart() {
    if (!accounts) return;
    setStarting(true);
    setError(null);
    try {
      const job = await api.createJob(accounts, mode);
      await api.startJob(job.id);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Email Migration</h1>

      <CsvUploader onUpload={handleUpload} loading={uploading} />

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {preview && <CsvPreview accounts={preview} />}

      {accounts && (
        <div className="mt-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="full">One-time Migration</option>
              <option value="continuous">Continuous Sync</option>
            </select>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {starting ? 'Starting...' : 'Start Migration'}
          </button>
        </div>
      )}
    </div>
  );
}
