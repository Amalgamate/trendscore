/**
 * ApproverStepVisualizer
 * Horizontal step-progress indicator for a multi-step approval workflow.
 */

import React from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a human-readable label for a step's approver configuration.
 */
function stepApproverLabel(step) {
  if (!step) return '';
  if (step.approverType === 'ROLE' && step.approverRoles?.length) {
    return step.approverRoles
      .map((r) => r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(' / ');
  }
  if (step.approverType === 'USER' && step.approverUserIds?.length) {
    return `${step.approverUserIds.length} user${step.approverUserIds.length > 1 ? 's' : ''}`;
  }
  return `Step ${step.stepNumber}`;
}

/**
 * Determine whether a given step number has been completed based on the
 * actions array (each action has at least { stepNumber, action }).
 */
function isStepCompleted(stepNumber, actions = []) {
  return actions.some(
    (a) =>
      a.stepNumber === stepNumber &&
      (a.action === 'APPROVE' || a.action === 'OVERRIDE'),
  );
}

function isStepRejected(stepNumber, actions = []) {
  return actions.some(
    (a) => a.stepNumber === stepNumber && a.action === 'REJECT',
  );
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   steps: Array<{
 *     stepNumber: number,
 *     approverType: 'ROLE' | 'USER',
 *     approverRoles?: string[],
 *     approverUserIds?: string[],
 *     minApprovals?: number,
 *   }>,
 *   currentStepNumber: number,
 *   actions?: Array<{ stepNumber: number, action: string, actedAt?: string }>,
 * }} props
 */
export function ApproverStepVisualizer({ steps = [], currentStepNumber = 1, actions = [] }) {
  if (!steps || steps.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">No workflow steps configured.</p>
    );
  }

  // Sort steps ascending
  const sorted = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1">
      {sorted.map((step, idx) => {
        const completed = isStepCompleted(step.stepNumber, actions);
        const rejected  = isStepRejected(step.stepNumber, actions);
        const isActive  = step.stepNumber === currentStepNumber && !completed && !rejected;
        const isFuture  = step.stepNumber > currentStepNumber && !completed && !rejected;

        // Connector line color
        const connectorActive = completed || isActive;

        return (
          <React.Fragment key={step.stepNumber}>
            {/* Step node */}
            <div className="flex flex-col items-center min-w-[80px] max-w-[110px]">
              {/* Icon */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  rejected
                    ? 'border-red-400 bg-red-50 text-red-500'
                    : completed
                    ? 'border-green-500 bg-green-50 text-green-600'
                    : isActive
                    ? 'border-[#002C60] bg-[#002C60] text-white shadow-md'
                    : 'border-gray-200 bg-gray-50 text-gray-300'
                }`}
              >
                {rejected ? (
                  <span className="text-[11px] font-bold">✕</span>
                ) : completed ? (
                  <CheckCircle size={16} />
                ) : isActive ? (
                  <Clock size={15} />
                ) : (
                  <Circle size={15} />
                )}
              </div>

              {/* Step number label */}
              <span
                className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${
                  rejected
                    ? 'text-red-500'
                    : completed
                    ? 'text-green-600'
                    : isActive
                    ? 'text-[#002C60]'
                    : 'text-gray-300'
                }`}
              >
                Step {step.stepNumber}
              </span>

              {/* Approver label */}
              <span
                className={`mt-0.5 text-[10px] text-center leading-tight px-1 ${
                  isFuture ? 'text-gray-300' : 'text-gray-500'
                }`}
              >
                {stepApproverLabel(step)}
              </span>

              {/* Min approvals hint */}
              {step.minApprovals && step.minApprovals > 1 && (
                <span className="mt-0.5 text-[9px] text-gray-400 italic">
                  {step.minApprovals} required
                </span>
              )}
            </div>

            {/* Connector line (except after last step) */}
            {idx < sorted.length - 1 && (
              <div className="flex-1 flex items-start pt-4">
                <div
                  className={`h-0.5 w-full transition-all ${
                    connectorActive ? 'bg-[#002C60]' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default ApproverStepVisualizer;
