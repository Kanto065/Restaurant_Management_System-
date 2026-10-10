using Microsoft.AspNetCore.Mvc;
using Platform.Application.Common;

namespace Platform.Api.Contracts;

public static class ResultExtensions
{
    /// <summary>Wraps a use-case result in the standard ApiResponse envelope; the error type picks the status.</summary>
    public static ActionResult<ApiResponse<T>> ToActionResult<T>(this ControllerBase c, Result<T> result, string message = "OK")
    {
        if (result.IsSuccess)
            return c.Ok(ApiResponse<T>.Ok(result.Value!, message));

        var status = result.Error!.Type switch
        {
            ErrorType.NotFound => 404,
            ErrorType.Conflict => 409,
            _ => 400,
        };
        return c.StatusCode(status, ApiResponse<T>.Fail(result.Error.Description, status));
    }
}
