import React from 'react';
import { SignIn } from '@clerk/chrome-extension';

export function SignInPage() {
  return <SignIn appearance={{ elements: { socialButtonsRoot: 'hidden', dividerRow: 'hidden' } }} />;
}