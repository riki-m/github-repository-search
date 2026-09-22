using System.Net;
using System.Text;
using RepositorySearch.Api.Services;
namespace RepositorySearch.Tests;

public sealed class GitHubTests
{
    [Fact]
    public async Task Query_is_encoded_and_full_json_is_retained()
    {
        var handler = new StubHandler(HttpStatusCode.OK, """{"total_count":1,"incomplete_results":false,"items":[{"id":42,"extra":{"retained":true}}]}""");
        var service = new GitHubSearch(new HttpClient(handler) { BaseAddress = new("https://api.github.com/") });
        var result = await service.Search("angular & q=other", default);
        Assert.Contains("q=angular%20%26%20q%3Dother", handler.Uri!.AbsoluteUri);
        Assert.True(Assert.Single(result.Items).GetProperty("extra").GetProperty("retained").GetBoolean());
    }
    [Theory]
    [InlineData(HttpStatusCode.Forbidden, 429)]
    [InlineData(HttpStatusCode.TooManyRequests, 429)]
    [InlineData(HttpStatusCode.InternalServerError, 502)]
    [InlineData(HttpStatusCode.UnprocessableEntity, 400)]
    public async Task Upstream_failures_are_translated(HttpStatusCode upstream, int expected)
    {
        var service = new GitHubSearch(new HttpClient(new StubHandler(upstream, "{}")) { BaseAddress = new("https://api.github.com/") });
        var error = await Assert.ThrowsAsync<GitHubException>(() => service.Search("test", default));
        Assert.Equal(expected, error.StatusCode);
    }
    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public Uri? Uri { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Uri = request.RequestUri;
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }
}
