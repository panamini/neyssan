
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
    <header className="p-4 bg-background text-foreground">
      <nav className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-4">
          <a href="/" className="text-lg font-semibold">Neyssan</a>
          <a
            href="/profile/edit"
            onClick={(e) => navigate(e, "/profile/edit")}
            className="text-sm text-muted hover:text-foreground"
          >
            Profile Editor
          </a>
        </div>
      </nav>
    </header>
  );
};
 
export default Header;
