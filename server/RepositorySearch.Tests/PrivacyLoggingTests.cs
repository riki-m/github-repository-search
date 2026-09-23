using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RepositorySearch.Api.Services;

namespace RepositorySearch.Tests;

public sealed class PrivacyLoggingTests
{
    [Fact]
    public async Task Normal_login_and_search_logs_contain_timing_but_no_sensitive_values()
    {
        using var capture = new CaptureLogs();
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureLogging(logging => logging.AddProvider(capture));
            builder.ConfigureServices(services => services.AddHttpClient<IGitHubSearch, GitHubSearch>()
                .ConfigurePrimaryHttpMessageHandler(() => new GitHubStub()));
        });
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { username = "demo1", password = "Demo1!Pass" });
        login.EnsureSuccessStatusCode();
        var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        (await client.GetAsync("/api/repositories?q=private-search-marker-3926")).EnsureSuccessStatusCode();

        var logs = string.Join('\n', capture.Messages);
        Assert.Contains("GitHub search completed in", logs);
        Assert.DoesNotContain("private-search-marker-3926", logs);
        Assert.DoesNotContain("Demo1!Pass", logs);
        Assert.DoesNotContain(token, logs);
        Assert.DoesNotContain("response-private-marker", logs);
    }

    private sealed class GitHubStub : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new
                {
                    total_count = 1,
                    incomplete_results = false,
                    items = new[] { FakeGitHub.Repository },
                    unused = "response-private-marker"
                })
            });
    }

    private sealed class CaptureLogs : ILoggerProvider
    {
        public ConcurrentQueue<string> Messages { get; } = new();
        public ILogger CreateLogger(string categoryName) => new CaptureLogger(Messages);
        public void Dispose() { }

        private sealed class CaptureLogger(ConcurrentQueue<string> messages) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
                Func<TState, Exception?, string> formatter) => messages.Enqueue(formatter(state, exception));
        }
    }
}
