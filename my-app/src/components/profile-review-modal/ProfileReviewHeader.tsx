"use client";

import React from 'react';

interface ProfileReviewHeaderProps {
  onClose: () => void;
}

export function ProfileReviewHeader({ onClose }: ProfileReviewHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <h2 className="text-xl font-bold md:text-2xl">Review and Refine Profile</h2>
      <button onClick={onClose} className="[color:var(--tg2)] hover:[color:var(--tm2)]">&times;</button>
    </div>
  );
}