namespace Platform.Application.Common;

public enum ErrorType { Failure, Validation, NotFound, Conflict }

public sealed record Error(string Code, string Description, ErrorType Type)
{
    public static Error NotFound(string code, string description) => new(code, description, ErrorType.NotFound);
    public static Error Validation(string code, string description) => new(code, description, ErrorType.Validation);
    public static Error Conflict(string code, string description) => new(code, description, ErrorType.Conflict);
}

/// <summary>Expected failures (not found, bad input) are returned, not thrown - exceptions stay
/// for the unexpected. The API layer maps <see cref="Error.Type"/> to an HTTP status.</summary>
public readonly record struct Result<T>(T? Value, Error? Error)
{
    public bool IsSuccess => Error is null;

    public static implicit operator Result<T>(T value) => new(value, null);
    public static implicit operator Result<T>(Error error) => new(default, error);
}
