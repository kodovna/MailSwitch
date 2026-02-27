import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ServerConfigForm from '../components/ServerConfigForm';
import CsvUploader from '../components/CsvUploader';
import CsvPreview from '../components/CsvPreview';
import { api } from '../lib/api';

const STEPS = ['Server Config', 'Upload CSV', 'Preview & Start'];

export default function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [serverConfig, setServerConfig] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('full');
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  // Auth verification state
  const [authResults, setAuthResults] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  function handleConfigVerified(config) {
    setServerConfig(config);
    setStep(1);
    setError(null);
  }

  async function handleUpload(file) {
    setError(null);
    setUploading(true);
    try {
      const data = await api.uploadCsv(file);
      setAccounts(data.accounts);
      setPreview(data.preview);
      setAuthResults([]);
      setVerified(false);
      setStep(2);
    } catch (err) {
      setError(err.message);
      setAccounts(null);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify() {
    if (!accounts || !serverConfig) return;
    setVerifying(true);
    setVerified(false);
    setError(null);

    // Initialize all as loading
    const initial = accounts.map(() => ({
      src: 'loading', srcError: '',
      dst: 'loading', dstError: '',
    }));
    setAuthResults([...initial]);

    // Test all accounts in parallel
    const results = [...initial];
    const promises = accounts.map(async (acct, i) => {
      // Test source auth
      const srcResult = await api.testAuth(
        serverConfig.srcHost, serverConfig.srcPort,
        acct.src_email, acct.src_password
      ).catch((err) => ({ success: false, error: err.message }));

      results[i] = {
        ...results[i],
        src: srcResult.success ? 'success' : 'error',
        srcError: srcResult.error || '',
      };
      setAuthResults([...results]);

      // Test destination auth
      const dstResult = await api.testAuth(
        serverConfig.dstHost, serverConfig.dstPort,
        acct.dst_email, acct.dst_password
      ).catch((err) => ({ success: false, error: err.message }));

      results[i] = {
        ...results[i],
        dst: dstResult.success ? 'success' : 'error',
        dstError: dstResult.error || '',
      };
      setAuthResults([...results]);
    });

    await Promise.all(promises);

    const allPassed = results.every((r) => r.src === 'success' && r.dst === 'success');
    setVerified(allPassed);
    setVerifying(false);

    if (!allPassed) {
      const failCount = results.filter((r) => r.src === 'error' || r.dst === 'error').length;
      setError(`${failCount} account${failCount !== 1 ? 's' : ''} failed authentication. Fix credentials and re-upload, or re-verify.`);
    }
  }

  async function handleStart() {
    if (!accounts || !serverConfig || !verified) return;
    setStarting(true);
    setError(null);
    try {
      const job = await api.createJob(accounts, mode, 300, serverConfig);
      await api.startJob(job.id);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  const passedCount = authResults.filter((r) => r.src === 'success' && r.dst === 'success').length;
  const totalCount = accounts?.length || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Email Migration</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
              i < step ? 'bg-indigo-600 text-white'
                : i === step ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-500'
            }`}>
              {i < step ? '\u2713' : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Server Config */}
      {step === 0 && (
        <ServerConfigForm onConfigVerified={handleConfigVerified} initialConfig={serverConfig} />
      )}

      {/* Step 2: CSV Upload */}
      {step === 1 && (
        <div>
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800 flex items-center justify-between">
            <span>
              {serverConfig.srcHost}:{serverConfig.srcPort} &rarr; {serverConfig.dstHost}:{serverConfig.dstPort}
            </span>
            <button
              onClick={() => setStep(0)}
              className="text-indigo-600 hover:underline text-sm"
            >
              Edit
            </button>
          </div>
          <CsvUploader onUpload={handleUpload} loading={uploading} />
        </div>
      )}

      {/* Step 3: Preview & Start */}
      {step === 2 && (
        <div>
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800 flex items-center justify-between">
            <span>
              {serverConfig.srcHost}:{serverConfig.srcPort} &rarr; {serverConfig.dstHost}:{serverConfig.dstPort}
            </span>
            <button
              onClick={() => setStep(0)}
              className="text-indigo-600 hover:underline text-sm"
            >
              Edit
            </button>
          </div>

          <CsvPreview accounts={preview} authResults={authResults} />

          {/* Verification progress */}
          {verifying && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
              Verifying accounts... {passedCount}/{totalCount} passed
            </div>
          )}

          {/* All verified banner */}
          {verified && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <span className="inline-block w-5 h-5 text-center leading-5 rounded-full bg-green-100 font-bold">&#10003;</span>
              All {totalCount} accounts authenticated successfully
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={() => { setStep(1); setAccounts(null); setPreview(null); setAuthResults([]); setVerified(false); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Back
            </button>

            <button
              onClick={handleVerify}
              disabled={verifying}
              className={`px-6 py-2 rounded-md font-medium disabled:opacity-50 ${
                verified
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {verifying ? 'Verifying...' : verified ? 'Re-verify' : 'Verify Accounts'}
            </button>

            {verified && (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
