import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Bell, Loader2, ShoppingCart, DollarSign, CheckCheck, Trash2, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

type NotificationType = 'NewOrder' | 'OrderStatusChanged' | 'PaymentReceived';

interface NotificationRow {
  id: string;
  type: NotificationType;
  payloadJson: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcons: Record<NotificationType, typeof ShoppingCart> = {
  NewOrder: ShoppingCart,
  OrderStatusChanged: ChevronRight,
  PaymentReceived: DollarSign,
};

const typeLabels: Record<NotificationType, string> = {
  NewOrder: 'New Order',
  OrderStatusChanged: 'Order Status Changed',
  PaymentReceived: 'Payment Received',
};

function parsePayload(json: string): { orderId?: string; status?: string } {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const Notifications = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => api.get<NotificationRow[]>('/api/admin/notifications'),
  });
  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/admin/notifications/${id}/read`, {}),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.put('/api/admin/notifications/mark-all-read', {}),
    onSuccess: () => { toast({ title: 'Success', description: 'All notifications marked as read.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/notifications/${id}`),
    onSuccess: invalidate,
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const handleClick = (notification: NotificationRow) => {
    if (!notification.isRead) markReadMutation.mutate(notification.id);
    const { orderId } = parsePayload(notification.payloadJson);
    if (orderId) navigate('/dashboard/orders', { state: { orderId } });
  };

  if (notificationsQuery.isLoading) {
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
          <p className="text-muted-foreground">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={unreadCount === 0 || markAllReadMutation.isPending}>
          <CheckCheck className="w-4 h-4 mr-2" />Mark All Read
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Notifications</CardTitle></CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Bell className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="divide-y">
                {notifications.map((n) => {
                  const Icon = typeIcons[n.type] ?? Bell;
                  const { status } = parsePayload(n.payloadJson);
                  return (
                    <div
                      key={n.id}
                      className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 ${!n.isRead ? 'bg-primary/5' : ''}`}
                      onClick={() => handleClick(n)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{typeLabels[n.type] ?? n.type}</p>
                            {!n.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {status ? `Status: ${status}` : ''} · {new Date(n.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(n.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;
