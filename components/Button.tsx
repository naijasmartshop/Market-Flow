import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading = false,
  className = '',
  ...props 
}) => {
  const baseStyle = "w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30",
    secondary: "bg-white text-slate-700 hover:bg-gray-50 border border-gray-200 shadow-sm",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30",
    outline: "border-2 border-brand-600 text-brand-600 hover:bg-brand-50",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
      ) : children}
    </button>
  );
};