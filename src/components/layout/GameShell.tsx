import React from 'react';

interface GameShellProps {
  children: React.ReactNode;
}

export default function GameShell({ children }: GameShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base font-sans text-text-primary">
      <div className="pointer-events-none fixed inset-0 opacity-20 crt-scanlines" />
      {children}
    </div>
  );
}
