import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 border-b border-gray-100 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
