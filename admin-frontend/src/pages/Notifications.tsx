import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  Loader2, 
  ShoppingCart, 
  DollarSign, 
  PackageCheck, 
  XCircle,
  CheckCheck,
  Trash2,
  Filter,
  X,
  ChevronRight
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';

interface Notification {
  _id: string;
  restaurant: string;
  type: 'new_order' | 'payment_completed' | 'order_completed' | 'order_cancelled';
  title: string;
  message: string;
  order?: {
    _id: string;
    totalAmount: number;
    customerName: string;
    orderNumber: string;
  };
  data: {
    orderNumber: string;
    tableNumber: string;
    customerName: string;
    totalAmount: number;
    itemCount: number;
  };
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
}

interface NotificationResponse {
  notifications: Notification[];
  count: number;
}

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [filterType, filterRead]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      let url = '/api/notifications?limit=100';
      
      if (filterType !== 'all') {
        url += `&type=${filterType}`;
      }
      
      if (filterRead === 'read') {
        url += '&isRead=true';
      } else if (filterRead === 'unread') {
        url += '&isRead=false';
      }

      const response = await api.get<NotificationResponse>(url);
      if (response.success && response.data) {
        setNotifications(response.data.notifications);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get<{ unreadCount: number }>('/api/notifications/unread-count');
      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await api.put('/api/notifications/mark-all-read', {});
      if (response.success) {
        toast({
          title: 'Success',
          description: 'All notifications marked as read',
        });
        fetchNotifications();
        fetchUnreadCount();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark notifications as read',
        variant: 'destructive',
      });
    }
  };

  const deleteOldNotifications = async () => {
    try {
      setDeleteLoading(true);
      const response = await api.delete<{ deletedCount: number }>('/api/notifications/old?days=30');
      if (response.success) {
        toast({
          title: 'Success',
          description: `Deleted ${response.data?.deletedCount || 0} old notifications`,
        });
        fetchNotifications();
        fetchUnreadCount();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete old notifications',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterRead('all');
  };

  const hasActiveFilters = filterType !== 'all' || filterRead !== 'all';

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if it's unread
    if (!notification.isRead) {
      try {
        const response = await api.put(`/api/notifications/${notification._id}/read`, {});
        if (response.success) {
          // Update local state
          setNotifications(prev => 
            prev.map(n => 
              n._id === notification._id 
                ? { ...n, isRead: true, readAt: new Date().toISOString() }
                : n
            )
          );
          // Update unread count
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate to order details
    if (notification.order?._id) {
      navigate('/dashboard/orders', { 
        state: { orderId: notification.order._id } 
      });
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'new_order':
        return <ShoppingCart className="h-5 w-5" />;
      case 'payment_completed':
        return <DollarSign className="h-5 w-5" />;
      case 'order_completed':
        return <PackageCheck className="h-5 w-5" />;
      case 'order_cancelled':
        return <XCircle className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'new_order':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'payment_completed':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
      case 'order_completed':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'order_cancelled':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'new_order':
        return 'New Order';
      case 'payment_completed':
        return 'Payment';
      case 'order_completed':
        return 'Completed';
      case 'order_cancelled':
        return 'Cancelled';
      default:
        return type;
    }
  };

  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return notificationDate.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Manage and view all your notifications
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline">
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button onClick={() => setIsDeleteDialogOpen(true)} variant="outline">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Old
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Read</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length - unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter(n => {
                const today = new Date();
                const notifDate = new Date(n.createdAt);
                return notifDate.toDateString() === today.toDateString();
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="new_order">New Order</SelectItem>
                  <SelectItem value="payment_completed">Payment Completed</SelectItem>
                  <SelectItem value="order_completed">Order Completed</SelectItem>
                  <SelectItem value="order_cancelled">Order Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filterRead} onValueChange={setFilterRead}>
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">
                {hasActiveFilters ? 'No notifications match the selected filters.' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-6 hover:bg-muted/50 transition-colors cursor-pointer group ${
                      !notification.isRead ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 border ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base">
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <Badge variant="outline">
                            {getTypeLabel(notification.type)}
                          </Badge>
                        </div>
                        
                        <p className="text-muted-foreground mb-3">
                          {notification.message}
                        </p>
                        
                        {notification.data && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="secondary">
                              {notification.data.tableNumber}
                            </Badge>
                            <Badge variant="secondary">
                              ${notification.data.totalAmount.toFixed(2)}
                            </Badge>
                            <Badge variant="secondary">
                              {notification.data.itemCount} item{notification.data.itemCount !== 1 ? 's' : ''}
                            </Badge>
                            {notification.data.customerName && (
                              <Badge variant="secondary">
                                {notification.data.customerName}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatTimeAgo(notification.createdAt)}</span>
                          <span>•</span>
                          <span>{formatDateTime(notification.createdAt)}</span>
                          {notification.isRead && notification.readAt && (
                            <>
                              <span>•</span>
                              <span>Read {formatTimeAgo(notification.readAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Old Notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all notifications older than 30 days. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteOldNotifications}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Notifications;
