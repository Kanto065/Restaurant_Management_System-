# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Platform.slnx .
COPY src/Platform.Domain/Platform.Domain.csproj src/Platform.Domain/
COPY src/Platform.Application/Platform.Application.csproj src/Platform.Application/
COPY src/Platform.Infrastructure/Platform.Infrastructure.csproj src/Platform.Infrastructure/
COPY src/Platform.Api/Platform.Api.csproj src/Platform.Api/
RUN dotnet restore src/Platform.Api/Platform.Api.csproj

COPY src/ src/
RUN dotnet publish src/Platform.Api/Platform.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN useradd --uid 5678 --user-group --system --no-create-home appuser
COPY --from=build /app .
RUN chown -R appuser:appuser /app
USER appuser

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Platform.Api.dll"]
