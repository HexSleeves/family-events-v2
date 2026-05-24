import XCTest
@testable import FamilyEvents

final class WhatsNewSheetTests: XCTestCase {
    private let storageKey = "seen-tabs-onboarding-v2"

    override func setUp() {
        super.setUp()
        // Reset the flag before each test so state doesn't leak between tests.
        UserDefaults.standard.removeObject(forKey: storageKey)
    }

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: storageKey)
        super.tearDown()
    }

    func testShouldShow_returnsTrueWhenKeyNotSet() {
        // Key removed in setUp; shouldShow must report true.
        XCTAssertTrue(WhatsNewSheet.shouldShow)
    }

    func testShouldShow_returnsFalseAfterKeySet() {
        UserDefaults.standard.set(true, forKey: storageKey)
        XCTAssertFalse(WhatsNewSheet.shouldShow)
    }

    func testShouldShow_returnsTrueWhenKeyExplicitlyFalse() {
        // Storing `false` is equivalent to "never seen" — should still show.
        UserDefaults.standard.set(false, forKey: storageKey)
        XCTAssertTrue(WhatsNewSheet.shouldShow)
    }

    func testShouldShow_remainsFalseAfterMultipleReads() {
        UserDefaults.standard.set(true, forKey: storageKey)
        XCTAssertFalse(WhatsNewSheet.shouldShow)
        XCTAssertFalse(WhatsNewSheet.shouldShow, "repeated reads must stay false once seen")
    }

    func testShouldShow_trueAfterKeyRemoved() {
        UserDefaults.standard.set(true, forKey: storageKey)
        XCTAssertFalse(WhatsNewSheet.shouldShow)
        UserDefaults.standard.removeObject(forKey: storageKey)
        XCTAssertTrue(WhatsNewSheet.shouldShow, "removing the key should reset shouldShow to true")
    }
}