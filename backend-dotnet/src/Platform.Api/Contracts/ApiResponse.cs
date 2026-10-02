using System.Text.Json.Serialization;

namespace Platform.Api.Contracts;

/// <summary>
/// Matches the existing admin-frontend's expected response envelope
/// ({ success, statusCode, message, data }) to minimize frontend churn during migration.
/// ErrorCode (e.g. FEATURE_DISABLED) is only written when set, so existing responses are unchanged.
/// </summary>
public record ApiResponse<T>(
    bool Success, int StatusCode, string Message, T? Data,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ErrorCode = null)
{
    public static ApiResponse<T> Ok(T data, string message = "OK", int statusCode = 200) =>
        new(true, statusCode, message, data);

    public static ApiResponse<T> Fail(string message, int statusCode = 400, string? errorCode = null) =>
        new(false, statusCode, message, default, errorCode);
}
