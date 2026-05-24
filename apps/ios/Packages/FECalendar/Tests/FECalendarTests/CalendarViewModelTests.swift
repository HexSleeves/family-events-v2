import XCTest
import FECore
import FEData
import FEDataTesting
@testable import FECalendar

@MainActor
final class CalendarViewModelTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)

    private func event(id: String, daysFromNow: Int, isFree: Bool = false) -> EventDTO {
        let start = calendar.date(byAdding: .day, value: daysFromNow, to: Date()) ?? Date()
        return EventDTO(
            id: EventID(id),
            title: "Event \(id)",
            description: nil,
            startDatetime: start,
            endDatetime: nil,
            timezone: "UTC",
            venueName: nil,
            address: nil,
            cityID: nil,
            latitude: nil,
            longitude: nil,
            ageMin: nil,
            ageMax: nil,
            price: isFree ? nil : 5,
            isFree: isFree,
            sourceURL: nil,
            sourceName: nil,
            sourceID: nil,
            images: [],
            status: "published",
            aiConfidence: nil,
            aiTagProvider: nil,
            isFeatured: false,
            viewCount: 0,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0),
            tags: [],
            avgRating: 0,
            ratingCount: 0,
            isFavorited: false
        )
    }

    func test_refresh_groupsEventsByDay() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([
            event(id: "e1", daysFromNow: 0),
            event(id: "e2", daysFromNow: 0),
            event(id: "e3", daysFromNow: 3),
        ])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        XCTAssertEqual(vm.eventsByDay.values.flatMap { $0 }.count, 3)
        let today = calendar.startOfDay(for: Date())
        XCTAssertEqual(vm.events(on: today).count, 2)
    }

    func test_hasEvents_isTrueOnlyWhenGrouped() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([event(id: "e1", daysFromNow: 0)])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        let today = calendar.startOfDay(for: Date())
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
        XCTAssertTrue(vm.hasEvents(on: today))
        XCTAssertFalse(vm.hasEvents(on: tomorrow))
    }

    func test_loadIfNeeded_respectsCacheTTL() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([event(id: "e1", daysFromNow: 0)])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.loadIfNeeded()
        let firstCount = repo.fetchListCallCount
        await vm.loadIfNeeded()
        XCTAssertEqual(repo.fetchListCallCount, firstCount)
    }

    func test_refresh_bypassesCache() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        let firstCount = repo.fetchListCallCount
        await vm.refresh()
        XCTAssertEqual(repo.fetchListCallCount, firstCount + 1)
    }

    func test_moveMonth_changesDisplayedMonthAndRefetches() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        let originalMonth = vm.displayedMonth
        let countBefore = repo.fetchListCallCount
        await vm.moveMonth(by: 1)
        XCTAssertNotEqual(vm.displayedMonth, originalMonth)
        XCTAssertGreaterThan(repo.fetchListCallCount, countBefore)
    }

    // MARK: - updateCity

    func test_updateCity_sameCity_doesNotRefetch() async {
        let cityID = CityID("city_1")
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: cityID, calendar: calendar)
        await vm.refresh()
        let countBefore = repo.fetchListCallCount
        await vm.updateCity(cityID)
        XCTAssertEqual(repo.fetchListCallCount, countBefore, "same cityID must not trigger a refetch")
    }

    func test_updateCity_differentCity_refetches() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: CityID("city_1"), calendar: calendar)
        await vm.refresh()
        let countBefore = repo.fetchListCallCount
        await vm.updateCity(CityID("city_2"))
        XCTAssertGreaterThan(repo.fetchListCallCount, countBefore, "different cityID must trigger a refetch")
    }

    func test_updateCity_nilCity_refetches() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: CityID("city_1"), calendar: calendar)
        await vm.refresh()
        let countBefore = repo.fetchListCallCount
        await vm.updateCity(nil)
        XCTAssertGreaterThan(repo.fetchListCallCount, countBefore, "clearing cityID should trigger a refetch")
    }

    // MARK: - Error handling

    func test_refresh_setsErrorMessage_onFailure() async {
        struct TestError: Error {}
        let repo = FakeEventRepository()
        repo.fetchListResult = .failure(TestError())
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        XCTAssertNotNil(vm.errorMessage, "a fetch failure must set errorMessage")
        XCTAssertTrue(vm.eventsByDay.isEmpty)
    }

    func test_refresh_clearsErrorMessage_onSuccess() async {
        struct TestError: Error {}
        let repo = FakeEventRepository()
        repo.fetchListResult = .failure(TestError())
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        XCTAssertNotNil(vm.errorMessage)

        repo.fetchListResult = .success([])
        await vm.refresh()
        XCTAssertNil(vm.errorMessage, "successful refresh must clear a previous errorMessage")
    }

    func test_isLoading_falseAfterRefresh() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        XCTAssertFalse(vm.isLoading, "isLoading must be false once refresh completes")
    }

    // MARK: - Calendar.startOfMonth extension

    func test_startOfMonth_returnsFirstDayOfMonth() {
        var components = DateComponents()
        components.year = 2024
        components.month = 3
        components.day = 15
        let mid = calendar.date(from: components)!
        let start = calendar.startOfMonth(for: mid)
        let startComponents = calendar.dateComponents([.year, .month, .day], from: start)
        XCTAssertEqual(startComponents.year, 2024)
        XCTAssertEqual(startComponents.month, 3)
        XCTAssertEqual(startComponents.day, 1)
    }

    func test_startOfMonth_alreadyFirstDay_returnsSameDay() {
        var components = DateComponents()
        components.year = 2024
        components.month = 1
        components.day = 1
        let first = calendar.date(from: components)!
        let start = calendar.startOfMonth(for: first)
        XCTAssertEqual(calendar.dateComponents([.year, .month, .day], from: start),
                       calendar.dateComponents([.year, .month, .day], from: first))
    }

    func test_startOfMonth_lastDayOfMonth_returnsFirstOfSameMonth() {
        var components = DateComponents()
        components.year = 2024
        components.month = 2
        components.day = 29 // 2024 is a leap year
        let last = calendar.date(from: components)!
        let start = calendar.startOfMonth(for: last)
        let resultComponents = calendar.dateComponents([.year, .month, .day], from: start)
        XCTAssertEqual(resultComponents.year, 2024)
        XCTAssertEqual(resultComponents.month, 2)
        XCTAssertEqual(resultComponents.day, 1)
    }

    // MARK: - moveMonth backward

    func test_moveMonth_backward_changesDisplayedMonth() async {
        let repo = FakeEventRepository()
        repo.fetchListResult = .success([])
        let vm = CalendarViewModel(eventRepo: repo, userID: UserID("u1"), cityID: nil, calendar: calendar)
        await vm.refresh()
        let originalMonth = vm.displayedMonth
        await vm.moveMonth(by: -1)
        let movedBack = calendar.date(byAdding: .month, value: -1, to: originalMonth)!
        XCTAssertEqual(
            calendar.dateComponents([.year, .month], from: vm.displayedMonth),
            calendar.dateComponents([.year, .month], from: calendar.startOfMonth(for: movedBack))
        )
    }
}
