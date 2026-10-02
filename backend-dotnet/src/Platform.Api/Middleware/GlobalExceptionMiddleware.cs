using Platform.Api.Contracts;

namespace Platform.Api.Middleware;

/// <summary>Only unhandled exceptions land here (they used to be a bodyless 500). Handled
/// responses never pass through the catch, so they are untouched.</summary>
public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client went away (e.g. an SSE stream closed) - nothing to answer.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception {CorrelationId} on {Method} {Path}",
                context.TraceIdentifier, context.Request.Method, context.Request.Path);

            if (context.Response.HasStarted)
                throw;

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(
                $"Something went wrong (ref {context.TraceIdentifier}).", 500, "INTERNAL_ERROR"));
        }
    }
}
