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
    private sealed class TestClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
