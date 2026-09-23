using RepositorySearch.Api.Services;
namespace RepositorySearch.Tests;

public sealed class SessionTests
{
    [Fact]
    public void Expired_session_is_unavailable()
    {
        var clock = new TestClock();
        var store = new SessionStore(clock);
        var session = store.Create("demo1");
        Assert.NotNull(store.Find(session.Id, "demo1"));
        clock.Now = clock.Now.AddHours(1);
        Assert.Null(store.Find(session.Id, "demo1"));
    }
    [Fact]
    public void Session_cannot_be_read_with_another_identity()
    {
        var store = new SessionStore(TimeProvider.System);
        var session = store.Create("demo1");
        Assert.Null(store.Find(session.Id, "demo2"));
    }
    [Fact]
    public void Session_capacity_is_bounded_and_expiry_frees_capacity()
    {
        var clock = new TestClock();
        var store = new SessionStore(clock);
        for (var i = 0; i < 1000; i++) store.Create("demo");
        Assert.Throws<InvalidOperationException>(() => store.Create("demo"));
        clock.Now = clock.Now.AddHours(2);
        Assert.NotNull(store.Create("demo"));
    }
    [Fact]
    public async Task Concurrent_saves_respect_capacity_and_remain_idempotent()
    {
        var session = new SessionStore(TimeProvider.System).Create("demo1");
        session.Remember(Enumerable.Range(1, 120).Select(id => System.Text.Json.JsonSerializer.SerializeToElement(new { id, nested = new { preserved = true } })));
        // Release workers together: the capacity check and insertion must share a lock.
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(1, 120).Select(async id => { await start.Task; return session.Bookmark(id); }).ToArray();
        start.SetResult();
        var results = await Task.WhenAll(tasks);
        Assert.Equal(100, results.Count(r => r == BookmarkResult.Saved));
        Assert.Equal(20, results.Count(r => r == BookmarkResult.LimitReached));
        var saved = session.Bookmarks();
        Assert.Equal(100, saved.Length);
        Assert.Equal(BookmarkResult.Saved, session.Bookmark(saved[0].GetProperty("id").GetInt64()));
        Assert.All(saved, item => Assert.True(item.GetProperty("nested").GetProperty("preserved").GetBoolean()));
    }
    [Fact]
    public void Search_cache_eviction_does_not_remove_bookmarks()
    {
        var session = new SessionStore(TimeProvider.System).Create("demo1");
        session.Remember(Enumerable.Range(1, 300).Select(id => System.Text.Json.JsonSerializer.SerializeToElement(new { id })));
        Assert.Equal(BookmarkResult.Saved, session.Bookmark(1));
        session.Remember([System.Text.Json.JsonSerializer.SerializeToElement(new { id = 301 })]);
        Assert.Equal(BookmarkResult.Saved, session.Bookmark(1));
        Assert.Equal(BookmarkResult.NotFound, session.Bookmark(2));
        Assert.Equal(BookmarkResult.NotFound, session.Bookmark(-1));
        Assert.Equal(BookmarkResult.Saved, session.Bookmark(301));
        Assert.Equal(2, session.Bookmarks().Length);
    }
    private sealed class TestClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
