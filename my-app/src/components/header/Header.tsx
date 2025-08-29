
import React from "react";

const Header = () => {
  // Navigate SPA-style to a path by pushing history and emitting popstate
  const navigate = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <header className="p-4">
      <nav className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-4">
          <a href="/" className="text-lg font-semibold">Neyssan</a>
          <a
            href="/profile/edit"
            onClick={(e) => navigate(e, "/profile/edit")}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Profile Editor
          </a>
        </div>
      </nav>
    </header>
  );
};

export default Header;
