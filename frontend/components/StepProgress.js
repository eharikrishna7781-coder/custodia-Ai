'use client';

import { Check } from 'lucide-react';

export default function StepProgress({ currentStep = 0, totalSteps = 6 }) {
  const steps = [
    { label: 'Triage', icon: '🩺', desc: 'Symptom check' },
    { label: 'Locator', icon: '🏥', desc: 'Find clinic' },
    { label: 'Booking', icon: '📅', desc: 'Appointment' },
    { label: 'Transport', icon: '🚑', desc: 'Arrange ride' },
    { label: 'Navigation', icon: '🗺️', desc: 'Live tracking' },
    { label: 'Report', icon: '📋', desc: 'Medical report' },
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-2 w-full max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-3 overflow-x-auto">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        const isUpcoming = idx > currentStep;

        return (
          <div key={idx} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              {/* Step circle */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : isActive
                    ? 'bg-primary-600 text-white ring-2 sm:ring-4 ring-primary-200 shadow-md'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
                title={step.desc}
                role="progressbar"
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${idx + 1}: ${step.label}${isCompleted ? ' - completed' : isActive ? ' - current' : ''}`}
              >
                {isCompleted ? <Check size={14} /> : <span>{idx + 1}</span>}
              </div>
              {/* Step label */}
              <span className={`text-[9px] sm:text-[10px] mt-0.5 sm:mt-1 font-medium whitespace-nowrap hidden sm:block ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : isCompleted
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 sm:mx-1.5 transition-all duration-300 ${
                idx < currentStep
                  ? 'bg-emerald-500'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
