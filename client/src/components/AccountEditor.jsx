import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { formatBytes } from '../lib/format';
import Icon from './Icon';

const MAX_ACCOUNTS = 500;
const EMPTY_ACCOUNT = { src_email: '', src_password: '', dst_email: '', dst_password: '' };

// Email input with a suggestion list wider than the field (a native datalist is
// limited to the input width and cuts long addresses off).
function SuggestInput({ value, suggestions, onChange, placeholder, className }) {
  const inputRef = useRef();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const listRef = useRef();

  const query = value.trim().toLowerCase();
  const matches = query
    ? suggestions.filter((m) => m.email.includes(query) && m.email !== query)
    : [];
  const visible = open && matches.length > 0;

  // Keep the highlighted entry in view while moving with the arrow keys
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function show() {
    const rect = inputRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
    setActive(0);
    setOpen(true);
  }

  function pick(m) {
    setOpen(false);
    onChange(m.email);
  }

  function handleKeyDown(e) {
    if (!visible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => { onChange(e.target.value); show(); }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {visible && (
        <ul
          ref={listRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 min-w-[24rem] max-h-72 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg py-1"
        >
          {matches.map((m, i) => (
            <li
              key={m.email}
              // mousedown fires before the input's blur closes the list
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-baseline justify-between px-3 py-1.5 text-sm whitespace-nowrap cursor-pointer ${
                i === active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
            >
              <span>{m.email}</span>
              {m.usage != null && (
                <span className="ml-6 text-xs text-gray-400 tabular-nums">{formatBytes(m.usage * 1024)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AccountRow({ account, index, mailboxes, mailboxList, usage, onChange, onRemove }) {
  const [showPasswords, setShowPasswords] = useState(false);

  function handleChange(field, value) {
    onChange(index, { ...account, [field]: value });
  }

  // Picking a known address from the suggestions fills in the rest of the row
  async function handleSourceChange(value) {
    handleChange('src_email', value);
    if (!mailboxes.has(value.trim().toLowerCase())) return;
    try {
      onChange(index, { ...(await api.getMailboxAccount(value.trim())), dst_password: account.dst_password });
    } catch {
      // keep what was typed
    }
  }

  return (
    <tr className="group">
      <td className="px-3 py-2 text-gray-400 text-sm">{index + 1}</td>
      <td className="px-2 py-1.5">
        <div className="relative">
          <SuggestInput
            value={account.src_email}
            suggestions={mailboxList}
            onChange={handleSourceChange}
            placeholder="source@example.com"
            className={`w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${
              usage != null ? 'pr-20' : ''
            }`}
          />
          {usage != null && (
            <span
              title="Source mailbox size from the CSV"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 tabular-nums pointer-events-none"
            >
              {formatBytes(usage * 1024)}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <input
          type={showPasswords ? 'text' : 'password'}
          value={account.src_password}
          onChange={(e) => handleChange('src_password', e.target.value)}
          placeholder="password"
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="email"
          value={account.dst_email}
          onChange={(e) => handleChange('dst_email', e.target.value)}
          placeholder="dest@example.com"
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type={showPasswords ? 'text' : 'password'}
          value={account.dst_password}
          onChange={(e) => handleChange('dst_password', e.target.value)}
          placeholder="password"
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <div className="flex items-center gap-1 justify-center">
          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title={showPasswords ? 'Hide passwords' : 'Show passwords'}
          >
            {showPasswords ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Remove account"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AccountEditor({ accounts, onChange, onUploadCsv, uploading }) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [mailboxes, setMailboxes] = useState([]);
  const [domainOpen, setDomainOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [domainPassword, setDomainPassword] = useState('');
  const [domainMessage, setDomainMessage] = useState(null);
  const [domainLoading, setDomainLoading] = useState(false);

  useEffect(() => {
    api.getMailboxes().then((d) => setMailboxes(d.mailboxes)).catch(() => {});
  }, []);

  const mailboxSet = new Set(mailboxes.map((m) => m.email));

  // Domains of the CSV mailboxes with their mailbox count and total size (KB)
  const domains = new Map();
  for (const m of mailboxes) {
    const domain = m.email.slice(m.email.indexOf('@') + 1);
    const d = domains.get(domain) || { count: 0, usage: 0 };
    d.count += 1;
    d.usage += m.usage || 0;
    domains.set(domain, d);
  }

  // Source mailbox sizes (KB) from the CSV, looked up by the source login or the address;
  // unknown for anything not in it
  const usageBySource = new Map();
  for (const m of mailboxes) {
    if (m.usage == null) continue;
    usageBySource.set(m.email, m.usage);
    if (m.username) usageBySource.set(m.username.toLowerCase(), m.usage);
  }
  const usageOf = (acct) => usageBySource.get(String(acct.src_email || '').trim().toLowerCase());
  const known = accounts.map(usageOf).filter((u) => u != null);
  const totalKb = known.reduce((sum, u) => sum + u, 0);

  function handleFileUpload(file) {
    if (file) onUploadCsv(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files[0]);
  }

  function handleFileChange(e) {
    handleFileUpload(e.target.files[0]);
    e.target.value = '';
  }

  function handleAccountChange(index, updated) {
    const next = [...accounts];
    next[index] = updated;
    onChange(next);
  }

  function handleRemove(index) {
    onChange(accounts.filter((_, i) => i !== index));
  }

  function handleAdd() {
    onChange([...accounts, { ...EMPTY_ACCOUNT }]);
  }

  async function handleAddDomain() {
    if (!domain) return;
    setDomainLoading(true);
    setDomainMessage(null);
    try {
      const { accounts: fetched } = await api.getMailboxDomain(domain);
      // Drop untouched blank rows and skip mailboxes that are already in the table
      const current = accounts.filter((a) => a.src_email || a.dst_email);
      const present = new Set(current.map((a) => a.dst_email.trim().toLowerCase()));
      const toAdd = fetched
        .filter((a) => !present.has(a.dst_email))
        .map((a) => ({ ...a, dst_password: domainPassword }));

      if (current.length + toAdd.length > MAX_ACCOUNTS) {
        setDomainMessage({ error: true, text: `Too many accounts: ${current.length + toAdd.length} (maximum is ${MAX_ACCOUNTS} per job).` });
        return;
      }
      onChange([...current, ...toAdd]);
      const skipped = fetched.length - toAdd.length;
      setDomainMessage({
        text: `Added ${toAdd.length} mailbox${toAdd.length !== 1 ? 'es' : ''} from ${domain}` +
          (skipped > 0 ? `, ${skipped} already in the table.` : '.'),
      });
    } catch (err) {
      setDomainMessage({ error: true, text: err.message });
    } finally {
      setDomainLoading(false);
    }
  }

  return (
    <div>
      {/* CSV upload zone - compact when accounts exist */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
          accounts.length > 0 ? 'p-4' : 'p-10'
        } ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="text-gray-500">
          {uploading ? (
            <p className="inline-flex items-center gap-2 text-sm">
              <Icon name="spinner" />
              Processing CSV...
            </p>
          ) : accounts.length > 0 ? (
            <p className="inline-flex items-center gap-2 text-sm">
              <Icon name="upload" className="w-5 h-5" />
              <span>Drop a CSV to <span className="font-medium">replace</span> accounts, or{' '}
              <span className="text-indigo-600 font-medium">click to browse</span></span>
            </p>
          ) : (
            <>
              <Icon name="upload" className="w-10 h-10 mx-auto mb-2 text-gray-400" />
              <p className="text-lg font-medium">Drop your CSV file here or click to browse</p>
              <p className="mt-1 text-sm">Format: src_email, src_password, dst_email, dst_password</p>
              <p className="mt-3 text-sm text-gray-400">— or add accounts manually below —</p>
            </>
          )}
        </div>
      </div>

      {/* Accounts table */}
      {accounts.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              {known.length > 0 && (
                <span className="ml-2 font-normal text-gray-500">
                  &middot; {formatBytes(totalKb * 1024)}
                  {known.length < accounts.length && ` (${known.length} of ${accounts.length})`}
                </span>
              )}
            </h3>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-10">#</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 w-[34%]">Source Email</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 w-[12%]">Source Password</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 w-[28%]">Dest Email</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 w-[16%]">Dest Password</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((acct, i) => (
                <AccountRow
                  key={i}
                  account={acct}
                  index={i}
                  mailboxes={mailboxSet}
                  mailboxList={mailboxes}
                  usage={usageOf(acct)}
                  onChange={handleAccountChange}
                  onRemove={handleRemove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add account button */}
      <div className="mt-3 flex items-center gap-6">
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
      >
        <Icon name="plus" />
        Add Account Manually
      </button>
      {domains.size > 0 && (
        <button
          type="button"
          onClick={() => setDomainOpen(!domainOpen)}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <Icon name="globe" />
          Add Domain
        </button>
      )}
      </div>

      {domainOpen && domains.size > 0 && (
        <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-white flex flex-wrap items-end gap-4">
          <label className="text-sm text-gray-600">
            <span className="block mb-1">Domain</span>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm min-w-[18rem] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a domain...</option>
              {[...domains].sort(([a], [b]) => a.localeCompare(b)).map(([name, d]) => (
                <option key={name} value={name}>
                  {name} ({d.count} mailbox{d.count !== 1 ? 'es' : ''}{d.usage > 0 ? `, ${formatBytes(d.usage * 1024)}` : ''})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            <span className="block mb-1">Dest password for all (optional)</span>
            <input
              type="password"
              value={domainPassword}
              onChange={(e) => setDomainPassword(e.target.value)}
              autoComplete="new-password"
              className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <button
            type="button"
            onClick={handleAddDomain}
            disabled={!domain || domainLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <Icon name={domainLoading ? 'spinner' : 'plus'} />
            {domainLoading ? 'Adding...' : 'Add mailboxes'}
          </button>
          {domainMessage && (
            <p className={`w-full text-sm ${domainMessage.error ? 'text-red-600' : 'text-green-700'}`}>
              {domainMessage.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
