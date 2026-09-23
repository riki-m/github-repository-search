using System.Net;
using System.Text;
using RepositorySearch.Api.Services;
namespace RepositorySearch.Tests;

public sealed class GitHubTests
{
    [Theory]
    [InlineData("updated")]
    public async Task Sort_applies_upstream_to_the_requested_page(string ranking)
    {
        var handler = new StubHandler(HttpStatusCode.OK, """{"total_count":0,"incomplete_results":false,"items":[]}""");
        var service = new GitHubSearch(new HttpClient(handler) { BaseAddress = new("https://api.github.com/") });
        await service.Search("angular", default, 2, ranking);
        Assert.Equal($"https://api.github.com/search/repositories?q=angular&per_page=30&page=2&sort={ranking}&order=desc", handler.Uri!.AbsoluteUri);
    }
    [Fact]
    public async Task Later_page_preserves_query_and_enforces_search_result_limit()
    {
        var items = string.Join(",", Enumerable.Range(1, 30).Select(id => $"{{\"id\":{id}}}"));
        var handler = new StubHandler(HttpStatusCode.OK, $"{{\"total_count\":2000,\"incomplete_results\":false,\"items\":[{items}]}}");
        var service = new GitHubSearch(new HttpClient(handler) { BaseAddress = new("https://api.github.com/") });
        var result = await service.Search("HILAN-TEST in:name", default, 34);
        Assert.Equal("https://api.github.com/search/repositories?q=HILAN-TEST%20in%3Aname&per_page=30&page=34", handler.Uri!.AbsoluteUri);
        Assert.Equal(10, result.Items.Length);
        Assert.Equal(2000, result.TotalCount);
    }
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
    [InlineData(HttpStatusCode.Forbidden, 502)]
    [InlineData(HttpStatusCode.TooManyRequests, 429)]
    [InlineData(HttpStatusCode.InternalServerError, 502)]
    [InlineData(HttpStatusCode.UnprocessableEntity, 400)]
    public async Task Upstream_failures_are_translated(HttpStatusCode upstream, int expected)
    {
        var service = new GitHubSearch(new HttpClient(new StubHandler(upstream, "{}")) { BaseAddress = new("https://api.github.com/") });
        var error = await Assert.ThrowsAsync<GitHubException>(() => service.Search("test", default));
        Assert.Equal(expected, error.StatusCode);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"total_count\":\"wrong\",\"incomplete_results\":false,\"items\":[]}")]
    [InlineData("{\"total_count\":-1,\"incomplete_results\":false,\"items\":[]}")]
    [InlineData("{\"total_count\":0,\"incomplete_results\":false,\"items\":{}}")]
    public async Task Invalid_response_schema_is_a_controlled_upstream_failure(string body)
    {
        var service = new GitHubSearch(new HttpClient(new StubHandler(HttpStatusCode.OK, body)) { BaseAddress = new("https://api.github.com/") });
        var error = await Assert.ThrowsAsync<GitHubException>(() => service.Search("test", default));
        Assert.Equal(502, error.StatusCode);
    }
    [Theory]
    [InlineData("{\"message\":\"API rate limit exceeded\"}", true)]
    [InlineData("{\"message\":\"You have exceeded a secondary rate limit\"}", true)]
    [InlineData("{\"message\":\"Resource not accessible\"}", false)]
    [InlineData("not-json", false)]
    public async Task Forbidden_response_is_not_always_throttling(string body, bool limited)
    {
        var service = new GitHubSearch(new HttpClient(new StubHandler(HttpStatusCode.Forbidden, body)) { BaseAddress = new("https://api.github.com/") });
        var error = await Assert.ThrowsAsync<GitHubException>(() => service.Search("test", default));
        Assert.Equal(limited ? 429 : 502, error.StatusCode);
        Assert.DoesNotContain(body, error.Message);
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
