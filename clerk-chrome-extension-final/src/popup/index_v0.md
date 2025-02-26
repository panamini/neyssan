import React from 'react';
import '../style.css';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from './layout/root-layout';
import { Home } from './routes/home';
import { Settings } from './routes/settings';
import { SignInPage } from './routes/sign-in';
import { SignUpPage } from './routes/sign-up';

const router = createMemoryRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/sign-up', element: <SignUpPage /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]);

export default function PopupIndex() {
  return <RouterProvider key="popup-router" router={router} />;
}