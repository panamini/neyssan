import React from 'react';
import '../style.css';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from './layout/root-layout';
import { Home } from './routes/home';
import { Settings } from './routes/settings';

const router = createMemoryRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]);

export default function PopupIndex() {
  return <RouterProvider key="popup-router" router={router} />;
}
