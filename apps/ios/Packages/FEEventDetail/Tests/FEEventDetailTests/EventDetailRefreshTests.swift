import XCTest
import FECore
import FEData
import FEDataTesting
@testable import FEEventDetail

@MainActor
final class EventDetailRefreshTests: XCTestCase {
    private func makeVM(_ repo: FakeEventRepository) -> EventDetailViewModel {
        EventDetailViewModel(
            eventRepo: repo,
            favoriteRepo: FakeFavoriteRepo(),
            userID: UserID("u1"),
            eventID: EventID("e1")
        )
    }

    func test_loadIfNeeded_skipsWhenFresh() async {
        let repo = FakeEventRepository()
        repo.fetchByIDsResult = .success([EventDTO.fixture(id: "e1", title: "Stub")])
        let vm = makeVM(repo)
        await vm.load()
        let first = repo.fetchByIDsCallCount
        await vm.loadIfNeeded()
        XCTAssertEqual(repo.fetchByIDsCallCount, first, "TTL-fresh state must not re-fetch")
    }

    func test_refresh_alwaysReFetches() async {
        let repo = FakeEventRepository()
        repo.fetchByIDsResult = .success([EventDTO.fixture(id: "e1", title: "Stub")])
        let vm = makeVM(repo)
        await vm.load()
        let first = repo.fetchByIDsCallCount
        await vm.refresh()
        XCTAssertEqual(repo.fetchByIDsCallCount, first + 1, "refresh() must bypass cache")
    }

    func test_refresh_isRefreshableConformance() async {
        let repo = FakeEventRepository()
        let refreshable: any Refreshable = makeVM(repo)
        await refreshable.refresh()
        XCTAssertGreaterThan(repo.fetchByIDsCallCount, 0)
    }

    func test_commentObservation_appliesInsertChange() async throws {
        let commentRepo = StreamingCommentRepo()
        let vm = EventDetailViewModel(
            eventRepo: FakeEventRepository(),
            favoriteRepo: FakeFavoriteRepo(),
            commentRepo: commentRepo,
            userID: UserID("u1"),
            eventID: EventID("e1")
        )
        vm.startObservingComments()
        let dto = CommentDTO(
            id: "c_new",
            userID: UserID("u_other"),
            eventID: EventID("e1"),
            body: "hello",
            isApproved: true,
            isFlagged: false,
            createdAt: Date(),
            updatedAt: Date()
        )
        commentRepo.emit(.inserted(dto))
        try await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertEqual(vm.comments.first?.id, "c_new")
        vm.stopObservingComments()
    }

    func test_commentObservation_appliesDeleteChange() async throws {
        let commentRepo = StreamingCommentRepo()
        let preexisting = CommentDTO(
            id: "c_existing",
            userID: UserID("u_other"),
            eventID: EventID("e1"),
            body: "old",
            isApproved: true,
            isFlagged: false,
            createdAt: Date(),
            updatedAt: Date()
        )
        commentRepo.seed = [preexisting]
        let vm = EventDetailViewModel(
            eventRepo: FakeEventRepository(),
            favoriteRepo: FakeFavoriteRepo(),
            commentRepo: commentRepo,
            userID: UserID("u1"),
            eventID: EventID("e1")
        )
        await vm.load()
        XCTAssertEqual(vm.comments.count, 1)
        vm.startObservingComments()
        commentRepo.emit(.deleted(commentID: "c_existing"))
        try await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertTrue(vm.comments.isEmpty)
        vm.stopObservingComments()
    }
}

/// In-process CommentRepo that exposes an async stream the test drives by
/// hand, so we can assert exactly when `applyCommentChange` runs.
private final class StreamingCommentRepo: CommentRepo, @unchecked Sendable {
    var seed: [CommentDTO] = []
    private var continuation: AsyncStream<CommentChange>.Continuation?

    func comments(for eventID: EventID) async throws -> [CommentDTO] { seed }
    func addComment(body: String, for userID: UserID, eventID: EventID) async throws -> CommentDTO {
        CommentDTO(
            id: UUID().uuidString,
            userID: userID,
            eventID: eventID,
            body: body,
            isApproved: true,
            isFlagged: false,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
    func observeComments(for eventID: EventID) -> AsyncStream<CommentChange> {
        AsyncStream { continuation in
            self.continuation = continuation
        }
    }
    func emit(_ change: CommentChange) {
        continuation?.yield(change)
    }
}
