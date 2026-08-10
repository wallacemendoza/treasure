import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Avatar, Button } from "../components/ui";
import { cn } from "../utils/cn";
import treasureLogo from "../assets/treasure-logo.png";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/members", label: "Members" },
  { to: "/events", label: "Events" },
  { to: "/discipline", label: "Discipline" },
  { to: "/treasury", label: "Treasury" },
  { to: "/settings", label: "Settings" },
];

function AppLayout() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileOpen && "sidebar-open")}>
        <div className="sidebar-top">
          <div className="brand-wrap">
            <img className="brand-logo" src={treasureLogo} alt="Treasure USA Chapter logo" />
            <div>
              <p className="brand-title">PORTAL</p>
              <p className="brand-subtitle">USA CHAPTER</p>
            </div>
          </div>

          <nav className="nav-links" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn("nav-link", isActive && "nav-link-active")}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="user-mini-card">
            <Avatar name={profile?.username ?? "User"} />
            <div>
              <p className="user-name">{profile?.username ?? "Unknown user"}</p>
              <p className="user-role">{profile?.access_role ?? "viewer"}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="main-frame">
        <header className="mobile-topbar">
          <Button type="button" variant="secondary" onClick={() => setMobileOpen((prev) => !prev)}>
            {mobileOpen ? "Close" : "Menu"}
          </Button>
          <div className="mobile-brand">
            <img className="mobile-brand-logo" src={treasureLogo} alt="Balaios MC USA logo" />
            <p className="mobile-title">PORTAL — BALAIOS MC USA</p>
          </div>
        </header>

        <div className="topbar">
          <div className="topbar-brand">
            <div style={{ textAlign: "right" }}>
              <p className="topbar-title">
                BALAIOS<span> MC</span>
              </p>
              <p className="topbar-subtitle">Balaios MC USA · Portal</p>
            </div>
            <img className="topbar-logo" src={treasureLogo} alt="Balaios MC USA logo" />
          </div>
        </div>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;