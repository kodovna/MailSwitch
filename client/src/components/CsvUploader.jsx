import { useState, useRef } from 'react';

export default function CsvUploader({ onUpload, loading }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) onUpload(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
      />
      <div className="text-gray-500">
        {loading ? (
          <p className="text-lg">Processing...</p>
        ) : (
          <>
            <p className="text-lg font-medium">
              Drop your CSV file here or click to browse
            </p>
            <p className="mt-2 text-sm">
              Format: src_email, src_password, dst_email, dst_password
            </p>
          </>
        )}
      </div>
    </div>
  );
}
