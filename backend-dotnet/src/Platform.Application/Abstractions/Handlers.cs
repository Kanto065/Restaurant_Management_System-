namespace Platform.Application.Abstractions;

// One use case = one request record + one handler. Handlers are found by DependencyInjection.cs.
public interface ICommand<TResponse>;
public interface IQuery<TResponse>;

public interface ICommandHandler<in TCommand, TResponse> where TCommand : ICommand<TResponse>
{
    Task<Common.Result<TResponse>> Handle(TCommand command, CancellationToken ct);
}

public interface IQueryHandler<in TQuery, TResponse> where TQuery : IQuery<TResponse>
{
    Task<Common.Result<TResponse>> Handle(TQuery query, CancellationToken ct);
}
