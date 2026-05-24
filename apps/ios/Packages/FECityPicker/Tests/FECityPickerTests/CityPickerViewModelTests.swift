import XCTest
import FECore
import FEData
import FEDataTesting
@testable import FECityPicker

private func makeRepo(_ cities: [CitySummary]) -> FakeCityRepository {
    let repo = FakeCityRepository()
    repo.citiesResult = .success(cities)
    return repo
}

@MainActor
final class CityPickerViewModelTests: XCTestCase {
    func test_load_success_populatesAllCities() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "Austin", region: "TX"),
            CitySummary(id: CityID("c2"), name: "Boston", region: "MA"),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        XCTAssertEqual(vm.allCities.count, 2)
        XCTAssertEqual(vm.loadState, .loaded)
    }

    func test_load_failure_setsFailedState() async {
        struct Boom: Error {}
        let repo = FakeCityRepository()
        repo.citiesResult = .failure(Boom())
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        if case .failed = vm.loadState {
            // ok
        } else {
            XCTFail("Expected .failed, got \(vm.loadState)")
        }
    }

    func test_filteredCities_matchesNameCaseInsensitively() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "Austin", region: "TX"),
            CitySummary(id: CityID("c2"), name: "Boston", region: "MA"),
            CitySummary(id: CityID("c3"), name: "San Francisco", region: "CA"),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        vm.searchText = "san"
        XCTAssertEqual(vm.filteredCities.map(\.id), [CityID("c3")])
        vm.searchText = "AUSTIN"
        XCTAssertEqual(vm.filteredCities.map(\.id), [CityID("c1")])
    }

    func test_filteredCities_matchesRegion() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "Austin", region: "TX"),
            CitySummary(id: CityID("c2"), name: "Houston", region: "TX"),
            CitySummary(id: CityID("c3"), name: "Boston", region: "MA"),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        vm.searchText = "TX"
        XCTAssertEqual(Set(vm.filteredCities.map(\.id)), [CityID("c1"), CityID("c2")])
    }

    func test_emptySearch_returnsAll() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "Austin", region: "TX"),
            CitySummary(id: CityID("c2"), name: "Boston", region: "MA"),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        vm.searchText = "   "
        XCTAssertEqual(vm.filteredCities.count, 2)
    }

    func test_sectionedCities_groupsByLeadingLetter() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "Austin", region: "TX"),
            CitySummary(id: CityID("c2"), name: "Atlanta", region: "GA"),
            CitySummary(id: CityID("c3"), name: "Boston", region: "MA"),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        let sections = vm.sectionedCities
        XCTAssertEqual(sections.map(\.letter), ["A", "B"])
        XCTAssertEqual(sections[0].cities.map(\.name), ["Atlanta", "Austin"])
        XCTAssertEqual(sections[1].cities.map(\.name), ["Boston"])
    }

    // MARK: - Additional edge cases

    func test_initialState_isIdle() {
        let repo = makeRepo([])
        let vm = CityPickerViewModel(cityRepo: repo)
        XCTAssertEqual(vm.loadState, .idle)
        XCTAssertTrue(vm.allCities.isEmpty)
        XCTAssertTrue(vm.searchText.isEmpty)
    }

    func test_filteredCities_beforeLoad_isEmpty() {
        let repo = makeRepo([CitySummary(id: CityID("c1"), name: "Austin", region: "TX")])
        let vm = CityPickerViewModel(cityRepo: repo)
        // No load called yet; allCities is empty
        vm.searchText = ""
        XCTAssertTrue(vm.filteredCities.isEmpty)
    }

    func test_sectionedCities_empty_returnsEmpty() {
        let repo = makeRepo([])
        let vm = CityPickerViewModel(cityRepo: repo)
        XCTAssertTrue(vm.sectionedCities.isEmpty)
    }

    func test_sectionedCities_nonLetterName_bucketsToHash() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "123 Town", region: nil),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        let sections = vm.sectionedCities
        XCTAssertEqual(sections.map(\.letter), ["#"])
        XCTAssertEqual(sections[0].cities.map(\.name), ["123 Town"])
    }

    func test_load_recovery_afterFailure() async {
        struct Boom: Error {}
        let repo = FakeCityRepository()
        repo.citiesResult = .failure(Boom())
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()

        if case .failed = vm.loadState {} else {
            XCTFail("Expected failed state after first load")
        }

        // Now provide a successful result and reload
        repo.citiesResult = .success([CitySummary(id: CityID("c1"), name: "Austin", region: "TX")])
        await vm.load()
        XCTAssertEqual(vm.loadState, .loaded)
        XCTAssertEqual(vm.allCities.count, 1)
    }

    func test_filteredCities_noMatchReturnsEmpty() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "Austin", region: "TX"),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        vm.searchText = "zzznomatch"
        XCTAssertTrue(vm.filteredCities.isEmpty)
    }

    func test_sectionedCities_sortedAlphabetically() async {
        let repo = makeRepo([
            CitySummary(id: CityID("c1"), name: "Denver", region: "CO"),
            CitySummary(id: CityID("c2"), name: "Chicago", region: "IL"),
            CitySummary(id: CityID("c3"), name: "Atlanta", region: "GA"),
        ])
        let vm = CityPickerViewModel(cityRepo: repo)
        await vm.load()
        let letters = vm.sectionedCities.map(\.letter)
        XCTAssertEqual(letters, letters.sorted(), "section letters must appear in alphabetical order")
    }
}
