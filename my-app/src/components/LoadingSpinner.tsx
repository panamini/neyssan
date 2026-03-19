"use client";

import React from 'react';
import { Loader2 } from "lucide-react";

const LoadingSpinner: React.FC = () => {
  return <Loader2 className="w-4 h-4 [color:var(--ti)] animate-spin" aria-hidden />;
};

export default LoadingSpinner;
