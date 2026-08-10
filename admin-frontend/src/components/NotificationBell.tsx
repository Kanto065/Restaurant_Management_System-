import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, ShoppingCart, DollarSign, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';

type NotificationType = 'NewOrder' | 'OrderStatusChanged' | 'PaymentReceived';

interface Notification {
  id: string;
  type: NotificationType;
  payloadJson: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_LABEL: Record<NotificationType, string> = {
  NewOrder: 'New Order',
  OrderStatusChanged: 'Order Status Updated',
  PaymentReceived: 'Payment Received',
};

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  NewOrder: <ShoppingCart className="h-4 w-4" />,
  OrderStatusChanged: <RefreshCw className="h-4 w-4" />,
  PaymentReceived: <DollarSign className="h-4 w-4" />,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  NewOrder: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  OrderStatusChanged: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  PaymentReceived: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

function parseOrderId(payloadJson: string): string | null {
  try {
    const payload = JSON.parse(payloadJson) as { orderId?: string; status?: string };
    return payload.orderId ?? null;
  } catch {
    return null;
  }
}

function formatTimeAgo(date: string) {
  const diffInSeconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get<number>('/api/admin/notifications/unread-count');
      if (response.success && typeof response.data === 'number') {
        setUnreadCount(response.data);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<Notification[]>('/api/admin/notifications');
      if (response.success && response.data) {
        setNotifications(response.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await api.put('/api/admin/notifications/mark-all-read', {});
      if (response.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        const response = await api.put(`/api/admin/notifications/${notification.id}/read`, {});
        if (response.success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    const orderId = parseOrderId(notification.payloadJson);
    if (orderId) {
      setIsOpen(false);
      navigate('/dashboard/orders', { state: { orderId } });
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={markAllAsRead} title="Mark all as read">
              <CheckCheck className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Bell className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground text-center">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer group ${
                    !notification.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[notification.type]}`}>
                      {TYPE_ICON[notification.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm leading-tight">{TYPE_LABEL[notification.type]}</p>
                        {!notification.isRead && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatTimeAgo(notification.createdAt)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
