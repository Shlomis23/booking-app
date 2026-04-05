import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  primary: 'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300 shadow-sm shadow-violet-100',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-300',
  ghost: 'text-gray-600 hover:bg-gray-100 disabled:opacity-50',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
