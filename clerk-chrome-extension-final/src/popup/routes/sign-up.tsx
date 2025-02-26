import React from 'react';
import { SignUp } from '@clerk/chrome-extension';

export function SignUpPage() {
  return <SignUp appearance={{ elements: { socialButtonsRoot: 'hidden', dividerRow: 'hidden' } }} />;
}