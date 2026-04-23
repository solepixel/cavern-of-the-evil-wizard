import React from 'react';

interface ModalLayerProps {
  children: React.ReactNode;
}

export default function ModalLayer({ children }: ModalLayerProps) {
  return <>{children}</>;
}
