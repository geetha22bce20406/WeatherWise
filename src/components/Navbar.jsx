import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  CloudSun,
  Bell,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context";

export default function Navbar() {
  const { user, logout, alerts } = useApp();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const last = localStorage.getItem("ww_last") || "Vijayawada";
  const active = alerts.filter((a) => a.level !== "good");

  return (
    <nav className="nav">
      <Link to="/" className="brand">
        <CloudSun size={26} />
        Weather<b>Wise</b>
      </Link>

      <div className="nav-links">
        <NavLink to="/" end>
          Home
        </NavLink>

        <NavLink
          to={`/dashboard?city=${encodeURIComponent(last)}`}
        >
          Dashboard
        </NavLink>

        <NavLink to="/intelligence">
          <Sparkles size={14} /> Intelligence
        </NavLink>

        <NavLink to="/space">
          My Space
        </NavLink>
      </div>

      <div className="nav-right">
        <div className="bell-wrap">
          <button
            className="icon-btn"
            onClick={() => setOpen(!open)}
            aria-label="Alerts"
            aria-expanded={open}
          >
            <Bell size={18} />

            {active.length > 0 && (
              <span className="dot">{active.length}</span>
            )}
          </button>

          {open && (
            <div className="bell-pop glass">
              <strong>Alerts</strong>

              {alerts.length === 0 && (
                <p className="muted">
                  Open a city dashboard to see live alerts.
                </p>
              )}

              {alerts.map((a, index) => (
                <div
                  key={a.id ?? `${a.title}-${index}`}
                  className={`alert-row ${a.level}`}
                >
                  <span>{a.icon}</span>

                  <div>
                    <b>{a.title}</b>
                    <small>{a.text}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {user ? (
          <div className="user-chip">
            <span className="avatar">
              {user.name?.[0]?.toUpperCase() || "U"}
            </span>

            <span className="uname">{user.name}</span>

            <button
              className="icon-btn sm"
              onClick={() => {
                logout();
                navigate("/");
              }}
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link to="/auth" className="btn-glow sm">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}