namespace Platform.Api.Contracts;

/// <summary>
/// Matches the existing admin-frontend's expected response envelope
/// ({ success, statusCode, message, data }) to minimize frontend churn during migration.
/// </summary>
public record ApiResponse<T>(bool Success, int StatusCode, string Message, T? Data)
{
    public static ApiResponse<T> Ok(T data, string message = "OK", int statusCode = 200) =>
        new(true, statusCode, message, data);

    public static ApiResponse<T> Fail(string message, int statusCode = 400) =>
        new(false, statusCode, message, default);
}
