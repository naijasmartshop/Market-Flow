import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <input 
        className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all placeholder:text-gray-400 ${className}`}
        {...props}
      />
    </div>
  );
};