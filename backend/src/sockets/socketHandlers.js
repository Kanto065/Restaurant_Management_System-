/**
 * Socket.io event handlers
 */
export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    
    /**
     * Join restaurant room (for owners)
     */
    socket.on('join-restaurant', (restaurantId) => {
      socket.join(`restaurant-${restaurantId}`);
      console.log(`Owner joined restaurant room: ${restaurantId}`);
      socket.emit('joined', { room: `restaurant-${restaurantId}` });
    });
    
    /**
     * Leave restaurant room
     */
    socket.on('leave-restaurant', (restaurantId) => {
      socket.leave(`restaurant-${restaurantId}`);
      console.log(`Owner left restaurant room: ${restaurantId}`);
    });
    
    /**
     * Join order room (for customers)
     */
    socket.on('join-order', (orderId) => {
      socket.join(`order-${orderId}`);
      console.log(`Customer joined order room: ${orderId}`);
      socket.emit('joined', { room: `order-${orderId}` });
    });
    
    /**
     * Leave order room
     */
    socket.on('leave-order', (orderId) => {
      socket.leave(`order-${orderId}`);
      console.log(`Customer left order room: ${orderId}`);
    });
    
    /**
     * Get active rooms for debugging
     */
    socket.on('get-rooms', () => {
      socket.emit('rooms', Array.from(socket.rooms));
    });
    
    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
    
    /**
     * Handle errors
     */
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
  
  console.log('✅ Socket.io handlers initialized');
};

export default setupSocketHandlers;
