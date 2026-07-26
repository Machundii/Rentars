'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export interface HouseRules {
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  events_allowed?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  additional_rules?: string | null;
}

interface HouseRulesAcknowledgementProps {
  rules: HouseRules;
  /** Called with the UTC ISO timestamp when the tenant checks the box. */
  onAcknowledge: (acknowledgedAt: string) => void;
  /** Whether the tenant has already acknowledged. */
  acknowledged: boolean;
}

function RuleItem({
  allowed,
  label,
}: {
  allowed: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      {allowed ? (
        <CheckCircle size={18} className="text-green-600 flex-shrink-0" aria-hidden="true" />
      ) : (
        <XCircle size={18} className="text-red-400 flex-shrink-0" aria-hidden="true" />
      )}
      <span className="text-sm text-gray-700">{label}</span>
    </li>
  );
}

export default function HouseRulesAcknowledgement({
  rules,
  onAcknowledge,
  acknowledged,
}: HouseRulesAcknowledgementProps) {
  const [checked, setChecked] = useState(acknowledged);

  const hasAnyRule =
    rules.pets_allowed !== undefined ||
    rules.smoking_allowed !== undefined ||
    rules.events_allowed !== undefined ||
    rules.quiet_hours_start ||
    rules.additional_rules;

  // If the property has no rules at all, nothing to acknowledge — auto-pass
  if (!hasAnyRule) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nowChecked = e.target.checked;
    setChecked(nowChecked);
    if (nowChecked) {
      onAcknowledge(new Date().toISOString());
    } else {
      // un-checking removes acknowledgement
      onAcknowledge('');
    }
  };

  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-4"
      data-testid="house-rules-acknowledgement"
    >
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <AlertCircle size={18} className="text-amber-600" aria-hidden="true" />
        House rules — please read before booking
      </h3>

      <ul className="space-y-2">
        {rules.pets_allowed !== undefined && (
          <RuleItem
            allowed={rules.pets_allowed}
            label={`Pets ${rules.pets_allowed ? 'allowed' : 'not allowed'}`}
          />
        )}
        {rules.smoking_allowed !== undefined && (
          <RuleItem
            allowed={rules.smoking_allowed}
            label={`Smoking ${rules.smoking_allowed ? 'allowed' : 'not allowed'}`}
          />
        )}
        {rules.events_allowed !== undefined && (
          <RuleItem
            allowed={rules.events_allowed}
            label={`Events / parties ${rules.events_allowed ? 'allowed' : 'not allowed'}`}
          />
        )}
        {rules.quiet_hours_start && rules.quiet_hours_end && (
          <li className="flex items-center gap-3">
            <Clock size={18} className="text-blue-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm text-gray-700">
              Quiet hours: {rules.quiet_hours_start} – {rules.quiet_hours_end}
            </span>
          </li>
        )}
      </ul>

      {rules.additional_rules && (
        <div className="bg-white rounded border border-amber-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-600 mb-1">Additional rules</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{rules.additional_rules}</p>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          id="rules-acknowledge"
          checked={checked}
          onChange={handleChange}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          aria-describedby="rules-acknowledge-label"
        />
        <span
          id="rules-acknowledge-label"
          className="text-sm text-gray-700"
        >
          I have read and agree to the house rules above
        </span>
      </label>
    </div>
  );
}
