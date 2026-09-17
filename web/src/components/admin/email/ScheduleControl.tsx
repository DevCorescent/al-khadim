'use client';
import { Send, Clock } from 'lucide-react';

interface ScheduleControlProps {
  mode: 'now' | 'schedule';
  onModeChange: (mode: 'now' | 'schedule') => void;
  sendAt: string;
  onSendAtChange: (value: string) => void;
}

/** Send-now / schedule-for-later toggle + datetime picker, lifted out of the original Email Center composer. */
export default function ScheduleControl({ mode, onModeChange, sendAt, onSendAtChange }: ScheduleControlProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['now', 'schedule'] as const).map(m => (
          <button key={m} type="button" onClick={() => onModeChange(m)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg capitalize transition-all flex items-center gap-1.5 ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {m === 'now' ? <Send size={12} /> : <Clock size={12} />}
            {m === 'now' ? 'Send now' : 'Schedule'}
          </button>
        ))}
      </div>

      {mode === 'schedule' && (
        <div>
          <label className="label">Send at *</label>
          <input className="input" type="datetime-local" value={sendAt} onChange={e => onSendAtChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}
