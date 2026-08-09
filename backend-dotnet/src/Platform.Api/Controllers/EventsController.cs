using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Infrastructure.Realtime;

namespace Platform.Api.Controllers;

/// <summary>
/// Server-Sent Events stream of order events (OrderCreated/OrderStatusChanged/PaymentReceived)
/// for the caller's active restaurant. Replaces the earlier SignalR OrderHub: one-directional
/// server-to-client push is all this needs, so plain SSE avoids WebSocket framing overhead and
/// the Redis backplane SignalR would otherwise require to fan out across API replicas.
/// </summary>
[ApiController]
[Route("api/events")]
[Authorize] // StaffOnly or PosDeviceOnly - both carry active_restaurant_id, checked below.
public class EventsController(SseConnectionManager sse) : ControllerBase
{
    [HttpGet("orders")]
    public async Task Orders(CancellationToken clientDisconnected)
    {
        var tokenType = User.FindFirstValue("token_type");
        if (tokenType != "staff" && tokenType != "device")
        {
            Response.StatusCode = 403;
            return;
        }

        if (!Guid.TryParse(User.FindFirstValue("active_restaurant_id"), out var restaurantId))
        {
            Response.StatusCode = 400;
            return;
        }

        Response.Headers.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no"; // disable nginx/proxy buffering of the stream

        var channel = sse.Subscribe(restaurantId);
        try
        {
            // Comment ping so proxies/load balancers don't idle-timeout the connection.
            await Response.WriteAsync(": connected\n\n", clientDisconnected);
            await Response.Body.FlushAsync(clientDisconnected);

            await foreach (var message in channel.Reader.ReadAllAsync(clientDisconnected))
            {
                await Response.WriteAsync($"data: {message}\n\n", clientDisconnected);
                await Response.Body.FlushAsync(clientDisconnected);
            }
        }
        catch (OperationCanceledException)
        {
            // Client disconnected - expected, not an error.
        }
        finally
        {
            sse.Unsubscribe(restaurantId, channel);
        }
    }
}
