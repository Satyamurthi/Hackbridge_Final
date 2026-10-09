import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  CheckCheck,
  Trophy,
  Briefcase,
  FolderGit2,
  CheckSquare,
  Users,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../lib/auditAndNotifications';
import type { AppNotification, NotificationType } from '../../types/database';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!user?.id) return;
    const { notifications: data } = await fetchUserNotifications(user.id);
    setNotifications(data);
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsAsRead(user.id);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'awards_announced':
        return <Trophy className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'hiring_interest':
        return <Briefcase className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'submission_confirmed':
        return <FolderGit2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'evaluation_assigned':
        return <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'team_invite':
        return <Users className="w-4 h-4 text-purple-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const displayedNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-600 rounded-full ring-2 ring-white animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-3 pt-2 pb-1 flex gap-1 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === 'unread'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <p className="font-semibold text-slate-600">All caught up!</p>
                <p className="text-[11px] mt-0.5">No {filter === 'unread' ? 'unread ' : ''}notifications right now.</p>
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                    !notif.is_read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <div className="mt-0.5">{getNotificationIcon(notif.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-xs ${!notif.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                      <span>{formatRelativeTime(notif.created_at)}</span>
                      {notif.link && (
                        <span className="flex items-center gap-0.5 text-indigo-600 font-semibold hover:underline">
                          <span>View</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
