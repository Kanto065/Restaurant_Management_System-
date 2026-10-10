using Microsoft.Extensions.DependencyInjection;
using Platform.Application.Abstractions;

namespace Platform.Application;

public static class DependencyInjection
{
    /// <summary>Registers every ICommandHandler / IQueryHandler in this assembly.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        foreach (var type in typeof(DependencyInjection).Assembly.GetTypes().Where(t => t is { IsClass: true, IsAbstract: false }))
            foreach (var i in type.GetInterfaces().Where(i => i.IsGenericType &&
                i.GetGenericTypeDefinition() is var d && (d == typeof(ICommandHandler<,>) || d == typeof(IQueryHandler<,>))))
                services.AddScoped(i, type);
        return services;
    }
}
