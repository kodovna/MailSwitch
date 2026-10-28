import { useState } from 'react';
import { api } from '../lib/api';
import Icon from './Icon';

const SECURITY_OPTIONS = [
  { value: 'ssl', label: 'SSL/TLS', port: 993, desc: 'Implicit TLS (recommended)' },
  { value: 'starttls', label: 'STARTTLS', port: 143, desc: 'Upgrade to TLS after connect' },
  { value: 'none', label: 'None', port: 143, desc: 'Plain text (air-gapped / internal)' },
];

function SecuritySelect({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {SECURITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            value === opt.value
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatusMessage({ status, error }) {
  if (status === 'success') {
    return (
      <p className="text-sm text-green-600 flex items-center gap-1">
        <Icon name="check-circle" />
        Connected successfully
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="text-sm text-red-600 flex items-center gap-1">
        <Icon name="x-circle" className="w-4 h-4 shrink-0" />
        {error}
      </p>
    );
  }
  return null;
}

export default function ServerConfigForm({ onConfigVerified, initialConfig }) {
  const [srcHost, setSrcHost] = useState(initialConfig?.srcHost || 'mail.compsys.cz');
  const [srcPort, setSrcPort] = useState(initialConfig?.srcPort || 993);
  const [srcSecurity, setSrcSecurity] = useState(initialConfig?.srcSecurity || 'ssl');
  const [dstHost, setDstHost] = useState(initialConfig?.dstHost || 'mail.webglobe.cz');
  const [dstPort, setDstPort] = useState(initialConfig?.dstPort || 993);
  const [dstSecurity, setDstSecurity] = useState(initialConfig?.dstSecurity || 'ssl');
  const [testing, setTesting] = useState(false);
  const [srcStatus, setSrcStatus] = useState(null);
  const [dstStatus, setDstStatus] = useState(null);
  const [srcError, setSrcError] = useState('');
  const [dstError, setDstError] = useState('');

  function handleSrcSecurityChange(sec) {
    setSrcSecurity(sec);
    setSrcPort(SECURITY_OPTIONS.find((o) => o.value === sec).port);
    setSrcStatus(null);
  }

  function handleDstSecurityChange(sec) {
    setDstSecurity(sec);
    setDstPort(SECURITY_OPTIONS.find((o) => o.value === sec).port);
    setDstStatus(null);
  }

  async function handleTest() {
    setTesting(true);
    setSrcStatus('loading');
    setDstStatus('loading');
    setSrcError('');
    setDstError('');

    const [srcResult, dstResult] = await Promise.all([
      api.testConnection(srcHost, srcPort, srcSecurity).catch((err) => ({ success: false, error: err.message })),
      api.testConnection(dstHost, dstPort, dstSecurity).catch((err) => ({ success: false, error: err.message })),
    ]);

    setSrcStatus(srcResult.success ? 'success' : 'error');
    setDstStatus(dstResult.success ? 'success' : 'error');
    setSrcError(srcResult.error || '');
    setDstError(dstResult.error || '');
    setTesting(false);
  }

  const canTest = srcHost.trim() && dstHost.trim();
  const bothPassed = srcStatus === 'success' && dstStatus === 'success';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">IMAP Server Configuration</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-3">
            <Icon name="server" className="w-4 h-4 text-gray-400" />
            Source Server
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Host</label>
              <input
                type="text"
                value={srcHost}
                onChange={(e) => { setSrcHost(e.target.value); setSrcStatus(null); }}
                placeholder="imap.source.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Security</label>
              <SecuritySelect value={srcSecurity} onChange={handleSrcSecurityChange} />
              <p className="text-xs text-gray-400 mt-1">
                {SECURITY_OPTIONS.find((o) => o.value === srcSecurity).desc}
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Port</label>
              <input
                type="number"
                value={srcPort}
                onChange={(e) => { setSrcPort(e.target.value); setSrcStatus(null); }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <StatusMessage status={srcStatus} error={srcError} />
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-3">
            <Icon name="server" className="w-4 h-4 text-gray-400" />
            Destination Server
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Host</label>
              <input
                type="text"
                value={dstHost}
                onChange={(e) => { setDstHost(e.target.value); setDstStatus(null); }}
                placeholder="imap.destination.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Security</label>
              <SecuritySelect value={dstSecurity} onChange={handleDstSecurityChange} />
              <p className="text-xs text-gray-400 mt-1">
                {SECURITY_OPTIONS.find((o) => o.value === dstSecurity).desc}
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Port</label>
              <input
                type="number"
                value={dstPort}
                onChange={(e) => { setDstPort(e.target.value); setDstStatus(null); }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <StatusMessage status={dstStatus} error={dstError} />
          </div>
        </div>
      </div>

      {bothPassed && (
        <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <Icon name="check-circle" className="w-5 h-5" />
          Both servers connected successfully
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={!canTest || testing}
          className={`inline-flex items-center gap-1.5 px-6 py-2 rounded-md font-medium disabled:opacity-50 ${
            bothPassed
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          <Icon name={testing ? 'spinner' : bothPassed ? 'refresh' : 'bolt'} />
          {testing ? 'Testing...' : bothPassed ? 'Re-test' : 'Test Connections'}
        </button>

        {bothPassed && (
          <button
            onClick={() => onConfigVerified({
              srcHost, srcPort: Number(srcPort), srcSecurity,
              dstHost, dstPort: Number(dstPort), dstSecurity,
            })}
            className="inline-flex items-center gap-1.5 px-6 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700"
          >
            Next
            <Icon name="arrow-right" />
          </button>
        )}
      </div>
    </div>
  );
}
