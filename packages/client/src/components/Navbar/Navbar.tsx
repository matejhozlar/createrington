import { useAuth } from "@/contexts/auth";
import React, { useEffect, useState, useRef } from "react";
import styles from "./Navbar.module.scss";

interface NavItem {
  label: string;
  path?: string;
  onClick?: () => void;
  children?: NavItem[];
  adminOnly?: boolean;
  requiresAuth?: boolean;
}

export const Navbar: React.FC = () => {
  const { user, login, logout } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = [
    {
      label: "Home",
      path: "/",
    },
    {
      label: "Servers",
      children: [
        { label: "Server 1", path: "/servers/1", requiresAuth: true },
        { label: "Server 2", path: "/servers/2", requiresAuth: true },
        { label: "Server Status", path: "/servers/status" },
      ],
    },
    {
      label: "Admin",
      adminOnly: true,
      children: [
        { label: "Dashboard", path: "/admin/dashboard" },
        { label: "Waitlist", path: "/admin/waitlist" },
        { label: "Players", path: "/admin/players" },
        { label: "Settings", path: "/admin/settings" },
      ],
    },
  ];

  const getFilteredNavItems = (): NavItem[] => {
    return navItems.filter((item) => {
      if (item.adminOnly && (!user || !user.isAdmin)) {
        return false;
      }
      return true;
    });
  };

  const getFilteredChildren = (children?: NavItem[]): NavItem[] => {
    if (!children) return [];

    return children.filter((child) => {
      if (child.requiresAuth && !user) {
        return false;
      }
      return true;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (label: string) => {
    setActiveDropdown(activeDropdown === label ? null : label);
  };

  const handleNavigation = (path?: string, onClick?: () => void) => {
    if (onClick) {
      onClick();
    } else if (path) {
      window.location.assign(path);
    }
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>
          <a href="/" className={styles.logoLink}>
            <span className={styles.logoText}>MyServer</span>
          </a>
        </div>

        {/* Desktop Navigation */}
        <div className={styles.navItems} ref={dropdownRef}>
          {getFilteredNavItems().map((item) => (
            <div key={item.label} className={styles.navItem}>
              {item.children ? (
                <>
                  <button
                    className={`${styles.navButton} ${
                      activeDropdown === item.label ? styles.active : ""
                    }`}
                    onClick={() => toggleDropdown(item.label)}
                  >
                    {item.label}
                    <svg
                      className={styles.dropdownIcon}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M4 6l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {activeDropdown === item.label && (
                    <div className={styles.dropdown}>
                      {getFilteredChildren(item.children).map((child) => (
                        <button
                          key={child.label}
                          className={styles.dropdownItem}
                          onClick={() =>
                            handleNavigation(child.path, child.onClick)
                          }
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <a
                  href={item.path}
                  className={styles.navLink}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                >
                  {item.label}
                </a>
              )}
            </div>
          ))}
        </div>

        {/* User Section */}
        <div className={styles.userSection}>
          {user ? (
            <div className={styles.userMenu}>
              <button
                className={styles.userButton}
                onClick={() => toggleDropdown("user")}
              >
                {user.avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`}
                    alt={user.username}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <span className={styles.username}>{user.username}</span>
              </button>
              {activeDropdown === "user" && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.userInfo}>
                      <span className={styles.displayName}>
                        {user.username}
                      </span>
                      <span className={styles.minecraftName}>
                        {user.minecraftUsername}
                      </span>
                    </div>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleNavigation("/profile")}
                  >
                    Profile
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleNavigation("/settings")}
                  >
                    Settings
                  </button>
                  <div className={styles.dropdownDivider} />
                  <button
                    className={`${styles.dropdownItem} ${styles.logout}`}
                    onClick={logout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className={styles.loginButton} onClick={login}>
              Login with Discord
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className={styles.mobileMenuToggle}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {mobileMenuOpen ? (
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 12h18M3 6h18M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          {getFilteredNavItems().map((item) => (
            <div key={item.label} className={styles.mobileNavItem}>
              {item.children ? (
                <>
                  <button
                    className={styles.mobileNavButton}
                    onClick={() => toggleDropdown(item.label)}
                  >
                    {item.label}
                  </button>
                  {activeDropdown === item.label && (
                    <div className={styles.mobileDropdown}>
                      {getFilteredChildren(item.children).map((child) => (
                        <button
                          key={child.label}
                          className={styles.mobileDropdownItem}
                          onClick={() =>
                            handleNavigation(child.path, child.onClick)
                          }
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <a
                  href={item.path}
                  className={styles.mobileNavLink}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                      setMobileMenuOpen(false);
                    }
                  }}
                >
                  {item.label}
                </a>
              )}
            </div>
          ))}
          {!user && (
            <button
              className={styles.mobileLoginButton}
              onClick={() => {
                login();
                setMobileMenuOpen(false);
              }}
            >
              Login with Discord
            </button>
          )}
        </div>
      )}
    </nav>
  );
};
