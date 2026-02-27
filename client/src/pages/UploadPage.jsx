import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ServerConfigForm from '../components/ServerConfigForm';
import AccountEditor from '../components/AccountEditor';
import CsvPreview from '../components/CsvPreview';
import { api } from '../lib/api';

const SEC_LABEL = { ssl: 'SSL', starttls: 'STARTTLS', none: 'Plain' };

const STEPS = [
  { label: 'Server Config', desc: 'Connect to IMAP servers' },
  { label: 'Accounts', desc: 'Upload CSV or add manually' },
  { label: 'Verify & Start', desc: 'Check accounts and migrate' },
];

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

  async function handleCsvUpload(file) {
    setError(null);
    setUploading(true);
    try {
      const data = await api.uploadCsv(file);
      setAccounts(data.accounts);
      setAuthResults([]);
      setVerified(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleAccountsChange(updated) {
    setAccounts(updated);
    setAuthResults([]);
    setVerified(false);
  }

  async function runVerification(accts) {
    setVerifying(true);
    setVerified(false);
    setError(null);

    const initial = accts.map(() => ({
      src: 'loading', srcError: '',
      dst: 'loading', dstError: '',
    }));
    setAuthResults([...initial]);

    const results = [...initial];
    const promises = accts.map(async (acct, i) => {
      const srcResult = await api.testAuth(
        serverConfig.srcHost, serverConfig.srcPort, serverConfig.srcSecurity,
        acct.src_email, acct.src_password
      ).catch((err) => ({ success: false, error: err.message }));

      results[i] = {
        ...results[i],
        src: srcResult.success ? 'success' : 'error',
        srcError: srcResult.error || '',
      };
      setAuthResults([...results]);

      const dstResult = await api.testAuth(
        serverConfig.dstHost, serverConfig.dstPort, serverConfig.dstSecurity,
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
      setError(`${failCount} account${failCount !== 1 ? 's' : ''} failed authentication. Go back to fix credentials, or re-verify.`);
    }
  }

  function handleSaveAndVerify() {
    const valid = accounts.filter(
      (a) => a.src_email && a.src_password && a.dst_email && a.dst_password
    );
    if (valid.length === 0) {
      setError('Add at least one account with all fields filled.');
      return;
    }
    setAccounts(valid);
    setPreview(valid.map((a) => ({ src_email: a.src_email, dst_email: a.dst_email })));
    setError(null);
    setStep(2);
    runVerification(valid);
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
      <h1 className="text-2xl font-bold mb-2">New Migration</h1>
      <p className="text-sm text-gray-500 mb-8">Configure servers, upload accounts, verify and start.</p>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold border-2 transition-colors ${
                  i < step
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : i === step
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                }`}>
                  {i < step ? '\u2713' : i + 1}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-medium ${i <= step ? 'text-gray-900' : 'text-gray-400'}`}>
                    Step {i + 1}
                  </p>
                  <p className={`text-xs ${i <= step ? 'text-gray-500' : 'text-gray-400'}`}>
                    {s.label}
                  </p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${i < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Server Config */}
      {step === 0 && (
        <ServerConfigForm onConfigVerified={handleConfigVerified} initialConfig={serverConfig} />
      )}

      {/* Step 2: Accounts */}
      {step === 1 && (
        <div>
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 text-xs font-bold">1</span>
              <span className="font-medium">Servers:</span>
              {serverConfig.srcHost}:{serverConfig.srcPort} ({SEC_LABEL[serverConfig.srcSecurity]}) &rarr; {serverConfig.dstHost}:{serverConfig.dstPort} ({SEC_LABEL[serverConfig.dstSecurity]})
            </div>
            <button
              onClick={() => setStep(0)}
              className="text-indigo-600 hover:underline text-sm font-medium"
            >
              Edit
            </button>
          </div>

          <AccountEditor
            accounts={accounts || []}
            onChange={handleAccountsChange}
            onUploadCsv={handleCsvUpload}
            uploading={uploading}
          />

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => setStep(0)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              &larr; Back
            </button>
            <button
              onClick={handleSaveAndVerify}
              disabled={!accounts || accounts.length === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Save &amp; Verify
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Verify & Start */}
      {step === 2 && (
        <div>
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 text-xs font-bold">1</span>
              <span className="font-medium">Servers:</span>
              {serverConfig.srcHost}:{serverConfig.srcPort} ({SEC_LABEL[serverConfig.srcSecurity]}) &rarr; {serverConfig.dstHost}:{serverConfig.dstPort} ({SEC_LABEL[serverConfig.dstSecurity]})
            </div>
            <button
              onClick={() => setStep(0)}
              className="text-indigo-600 hover:underline text-sm font-medium"
            >
              Edit
            </button>
          </div>

          <CsvPreview accounts={preview} authResults={authResults} />

          {/* Verification progress */}
          {verifying && (
            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Verifying accounts... {passedCount}/{totalCount} passed
            </div>
          )}

          {/* All verified banner */}
          {verified && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-200 text-green-700 text-xs font-bold">&#10003;</span>
              All {totalCount} accounts authenticated successfully
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => { setStep(1); setAuthResults([]); setVerified(false); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              &larr; Back
            </button>

            {!verifying && (
              <button
                onClick={() => runVerification(accounts)}
                className="px-5 py-2 text-sm rounded-md font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                Re-verify
              </button>
            )}

            {verified && (
              <>
                <div className="h-6 w-px bg-gray-300" />

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Mode:</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="full">One-time Migration</option>
                    <option value="continuous">Continuous Sync</option>
                  </select>
                </div>

                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
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
