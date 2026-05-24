import XCTest
@testable import FamilyEvents

final class TabTests: XCTestCase {
    func testAllCasesExposed() {
        XCTAssertEqual(AppTab.allCases, [.plan, .explore, .map, .calendar, .saved])
    }

    func testSystemImagesAreNonEmpty() {
        for tab in AppTab.allCases {
            XCTAssertFalse(tab.systemImage.isEmpty, "tab \(tab) is missing systemImage")
        }
    }

    // MARK: - New map / calendar cases (added in 5-tab PR)

    func testTitlesAreNonEmpty() {
        for tab in AppTab.allCases {
            XCTAssertFalse(tab.title.isEmpty, "tab \(tab) is missing title")
        }
    }

    func testMapTabTitle() {
        XCTAssertEqual(AppTab.map.title, "Map")
    }

    func testCalendarTabTitle() {
        XCTAssertEqual(AppTab.calendar.title, "Calendar")
    }

    func testMapTabSystemImage() {
        XCTAssertEqual(AppTab.map.systemImage, "map.fill")
    }

    func testCalendarTabSystemImage() {
        XCTAssertEqual(AppTab.calendar.systemImage, "calendar")
    }

    func testRawValueMatchesId() {
        for tab in AppTab.allCases {
            XCTAssertEqual(tab.id, tab.rawValue, "id should equal rawValue for tab \(tab)")
        }
    }

    func testMapRawValue() {
        XCTAssertEqual(AppTab.map.rawValue, "map")
    }

    func testCalendarRawValue() {
        XCTAssertEqual(AppTab.calendar.rawValue, "calendar")
    }

    func testInitFromRawValue() {
        XCTAssertEqual(AppTab(rawValue: "map"), .map)
        XCTAssertEqual(AppTab(rawValue: "calendar"), .calendar)
    }

    func testUnknownRawValueReturnsNil() {
        XCTAssertNil(AppTab(rawValue: "admin"))
        XCTAssertNil(AppTab(rawValue: ""))
    }
}
