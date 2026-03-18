import React, { useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/chrome-extension';

export function Home() {
  const { getToken } = useAuth();
  const { user } = useUser();

  const storeFreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken({ template: "convex" });
      if (!token) {
        console.error("No token returned from Clerk");
        return null;
      }
      await chrome.storage.local.set({ authToken: token });
      console.log("Auth token stored:", token);
      return token;
    } catch (error) {
      console.error("Error fetching token:", error);
      return null;
    }
  }, [getToken]);

  useEffect(() => {
    storeFreshToken();

    if (user) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || "Your Name";
      chrome.storage.local.set({ userName: fullName }, () => console.log("User name stored:", fullName));
    }

    const handleMessage = (message: any, _: any, sendResponse: (response: any) => void) => {
      if (message.action === "refreshToken") {
        console.log("Received refreshToken request");
        storeFreshToken().then(token => {
          console.log("Sending refreshed token:", token);
          sendResponse({ token });
        });
        return true; // Keep channel open
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [user, storeFreshToken]);

  const handleTest = () => {
    console.log("Sending test message...");
    chrome.runtime.sendMessage({ action: "test" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Messaging error:", chrome.runtime.lastError.message);
        alert("Failed to reach background script!");
        return;
      }
      if (response?.success) {
        console.log("Test succeeded:", response);
        alert(`Background says: ${response.message}`);
      } else {
        console.log("Test failed:", response);
        alert("Test failed!");
      }
    });
  };

  return (
    <div style={{ padding: '10px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Welcome!</h1>
      <p style={{ marginBottom: '1rem' }}>You’re logged in. Use the extension on job sites.</p>
      <button
        onClick={handleTest}
        style={{ backgroundColor: '#007bff', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Test Background
      </button>
    </div>
  );
}