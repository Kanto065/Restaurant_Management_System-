# Notification Click Implementation Guide

## Backend API - Already Implemented ✅

The backend already has a fully functional endpoint to mark notifications as read when clicked.

### Endpoint Details

**Mark Notification as Read**
```
PUT /api/notifications/:id/read
```

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "6908acf513221cf448ebef99",
      "type": "new_order",
      "title": "New Order Received",
      "message": "Order #ORD-20251103-U6KCNR has been placed",
      "isRead": true,
      "readAt": "2025-11-03T13:25:03.903Z",
      "order": {...},
      "createdAt": "2025-11-03T13:24:37.651Z",
      "updatedAt": "2025-11-03T13:25:03.904Z"
    }
  }
}
```

## Frontend Implementation (React/Next.js Example)

### Option 1: Click on Notification Item

```javascript
const handleNotificationClick = async (notificationId) => {
  try {
    // Mark as read
    const response = await fetch(
      `http://localhost:7878/api/notifications/${notificationId}/read`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      // Update local state to reflect read status
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId 
            ? { ...notif, isRead: true, readAt: data.data.notification.readAt }
            : notif
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Optional: Navigate to order details or take other action
      // router.push(`/orders/${data.data.notification.order._id}`);
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};
```

### Option 2: Automatic Mark as Read on Modal Open

```javascript
const NotificationModal = ({ notifications, isOpen, onClose }) => {
  const markVisibleNotificationsAsRead = async () => {
    const unreadIds = notifications
      .filter(n => !n.isRead)
      .map(n => n._id);
    
    // Mark all unread notifications as read
    const promises = unreadIds.map(id =>
      fetch(`http://localhost:7878/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    );
    
    await Promise.all(promises);
    
    // Refresh notifications list
    fetchNotifications();
  };
  
  useEffect(() => {
    if (isOpen) {
      markVisibleNotificationsAsRead();
    }
  }, [isOpen]);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {notifications.map(notification => (
        <NotificationItem 
          key={notification._id} 
          notification={notification}
          onClick={() => handleNotificationClick(notification._id)}
        />
      ))}
    </Modal>
  );
};
```

### Option 3: Individual Click Handler with Visual Feedback

```javascript
const NotificationItem = ({ notification, onClick }) => {
  const [isRead, setIsRead] = useState(notification.isRead);
  
  const handleClick = async () => {
    if (!isRead) {
      try {
        const response = await fetch(
          `http://localhost:7878/api/notifications/${notification._id}/read`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const data = await response.json();
        
        if (data.success) {
          setIsRead(true);
          onClick?.(notification);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    } else {
      onClick?.(notification);
    }
  };
  
  return (
    <div 
      onClick={handleClick}
      className={`notification-item ${isRead ? 'read' : 'unread'}`}
      style={{
        backgroundColor: isRead ? '#ffffff' : '#f0f7ff',
        borderLeft: isRead ? 'none' : '4px solid #3b82f6',
        cursor: 'pointer'
      }}
    >
      <h4>{notification.title}</h4>
      <p>{notification.message}</p>
      <span className="timestamp">
        {new Date(notification.createdAt).toLocaleString()}
      </span>
    </div>
  );
};
```

## Features Available

✅ **Mark Single Notification as Read** - `PUT /api/notifications/:id/read`
✅ **Mark All as Read** - `PUT /api/notifications/mark-all-read`
✅ **Get Unread Count** - `GET /api/notifications/unread-count`
✅ **Filter Notifications** - `GET /api/notifications?isRead=false`
✅ **Automatic Timestamps** - `readAt` field is set automatically
✅ **Real-time Updates** - Socket.io event `new-order-notification` for instant notifications

## Testing

**Test the endpoint:**
```bash
# Get a notification ID
curl -X GET http://localhost:7878/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"

# Mark it as read
curl -X PUT http://localhost:7878/api/notifications/NOTIFICATION_ID/read \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify unread count decreased
curl -X GET http://localhost:7878/api/notifications/unread-count \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Summary

The backend is **100% ready** for notification click functionality:

1. ✅ Endpoint exists and tested
2. ✅ Marks notification as read
3. ✅ Sets `readAt` timestamp
4. ✅ Updates `isRead` to true
5. ✅ Returns updated notification
6. ✅ Validates ownership (only owner can mark their notifications)
7. ✅ Returns 404 if notification not found
8. ✅ Unread count automatically updates

**Frontend just needs to call this endpoint when a notification is clicked!**
