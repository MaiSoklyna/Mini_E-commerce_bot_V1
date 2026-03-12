import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import * as authService from '../services/authService';
import * as notificationService from '../services/notificationService';

const MENU_ITEMS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    label: 'My Orders',
    path: '/orders',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    label: 'Saved Addresses',
    path: null,
    isAddress: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    label: 'Notifications',
    path: '/notifications',
    hasNotifBadge: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: 'Support',
    path: '/support',
  },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, setUser, logout, loginPending, startLoginSession } = useAuth();

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || user.username || '', phone: user.phone || '' });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      notificationService.getNotifications(100)
        .then(data => setNotificationCount(data.filter(n => !n.is_read).length))
        .catch(() => {});
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const data = await authService.updateProfile(token, formData);
      setUser(data);
      setEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/', { replace: true });
    }
  };

  const getInitials = () => {
    if (!user) return '?';
    const name = user.name || user.username || 'User';
    return name.charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <div className="page-container">
        <PageHeader title="Profile" showBack={false} />
        <EmptyState
          icon="🔒"
          title="Login Required"
          description="Please login via Telegram to view your profile"
          actionLabel={loginPending ? 'Waiting for Telegram...' : 'Login via Telegram'}
          onAction={startLoginSession}
          className="pt-20"
        />
      </div>
    );
  }

  return (
    <div className="page-container animate-fadeIn pb-20">
      <PageHeader title="Profile" showBack={false} />

      <div className="px-4 pt-5">
        {/* Avatar Card */}
        <div className="bg-card rounded-card border border-border-light p-6 mb-4 text-center shadow-card">
          <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-accent to-cyan text-black flex items-center justify-center text-2xl font-heading font-bold mx-auto mb-3">
            {getInitials()}
          </div>
          <h2 className="text-lg font-heading font-bold text-primary">
            {user.name || user.username || 'User'}
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {user.phone || user.telegram_id || 'No phone number'}
          </p>
        </div>

        {/* Edit Profile */}
        <div className="bg-card rounded-card border border-border-light p-4 mb-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-heading font-semibold text-primary">Profile Information</h3>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-accent text-xs font-semibold">
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                  placeholder="+855 12 345 678"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 border border-border-light text-primary rounded-button py-2.5 text-sm font-semibold hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-accent text-black rounded-button py-2.5 text-sm font-semibold disabled:opacity-40 active:scale-[0.97] transition-all"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Name</span>
                <span className="text-primary font-medium">{user.name || 'Not set'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Phone</span>
                <span className="text-primary font-medium">{user.phone || 'Not set'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="bg-card rounded-card border border-border-light overflow-hidden mb-4 shadow-card">
          {MENU_ITEMS.map((item, index) => (
            <button
              key={index}
              onClick={() => item.path && navigate(item.path)}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border-light/50 last:border-0 hover:bg-surface active:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3 text-text-secondary">
                {item.icon}
                <span className="text-sm font-medium text-primary">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.hasNotifBadge && notificationCount > 0 && (
                  <span className="bg-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
                {item.isAddress && user.address && (
                  <span className="text-[11px] text-text-tertiary max-w-[140px] truncate">{user.address}</span>
                )}
                {item.path && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Version */}
        <div className="text-center mb-4">
          <p className="text-[11px] text-text-tertiary">Favourite of Shop v1.0</p>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full text-danger text-sm font-semibold py-3 text-center hover:opacity-80 transition-opacity rounded-button"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
