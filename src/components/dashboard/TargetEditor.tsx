import { useState } from 'react';
import { SectionCard } from '../SectionCard';

export interface TargetEditorData {
  name: string;
  url: string;
  extractorSummary: string;
}

interface TargetEditorProps {
  onCancel: () => void;
  onSave: (data: TargetEditorData) => void;
  error?: string | null;
}

export function TargetEditor({ onCancel, onSave, error }: TargetEditorProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [extractorSummary, setExtractorSummary] = useState('');

  return (
    <SectionCard title="Target Editor" subtitle="Create or edit a target configuration">
      {error && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#fecaca',
            fontSize: '0.9rem',
          }}
        >
          <strong>Validation Error:</strong> {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, url, extractorSummary });
        }}
        className="form-layout"
      >
        <div className="form-group">
          <label>Target Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="e.g. Homepage pricing"
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
            }}
            placeholder="https://example.com"
            required
          />
        </div>
        <div className="form-group">
          <label>HTMLCut Extractor Rule</label>
          <input
            value={extractorSummary}
            onChange={(e) => {
              setExtractorSummary(e.target.value);
            }}
            placeholder="css:.price -> text"
            required
          />
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button-primary" type="submit">
            Save Target
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
