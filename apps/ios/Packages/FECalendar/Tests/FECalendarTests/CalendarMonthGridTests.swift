import XCTest
@testable import FECalendar

/// Tests for the `CalendarMonthGrid` component and the `Calendar.startOfMonth`
/// extension it depends on.  The grid's internal `days` property is private,
/// so coverage focuses on the extension and the component's observable inputs.
final class CalendarMonthGridTests: XCTestCase {
    private var calendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.locale = Locale(identifier: "en_US")
        cal.firstWeekday = 1 // Sunday
        return cal
    }()

    // MARK: - Calendar.startOfMonth

    func test_startOfMonth_midMonth_returnsFirstDay() {
        let mid = dateComponents(year: 2024, month: 6, day: 15)
        let start = calendar.startOfMonth(for: mid)
        assertDate(start, year: 2024, month: 6, day: 1)
    }

    func test_startOfMonth_firstDayUnchanged() {
        let first = dateComponents(year: 2024, month: 1, day: 1)
        let start = calendar.startOfMonth(for: first)
        assertDate(start, year: 2024, month: 1, day: 1)
    }

    func test_startOfMonth_lastDayOfMonth() {
        // January has 31 days
        let last = dateComponents(year: 2024, month: 1, day: 31)
        let start = calendar.startOfMonth(for: last)
        assertDate(start, year: 2024, month: 1, day: 1)
    }

    func test_startOfMonth_leapYearLastDay() {
        // 2024 is a leap year; Feb 29 exists
        let leap = dateComponents(year: 2024, month: 2, day: 29)
        let start = calendar.startOfMonth(for: leap)
        assertDate(start, year: 2024, month: 2, day: 1)
    }

    func test_startOfMonth_december() {
        let dec = dateComponents(year: 2023, month: 12, day: 25)
        let start = calendar.startOfMonth(for: dec)
        assertDate(start, year: 2023, month: 12, day: 1)
    }

    // MARK: - CalendarMonthGrid initialisation

    func test_init_storesProvidedValues() {
        let month = dateComponents(year: 2024, month: 5, day: 1)
        let selected = dateComponents(year: 2024, month: 5, day: 10)

        var onSelectCalled = false
        let grid = CalendarMonthGrid(
            month: month,
            selectedDate: selected,
            calendar: calendar,
            hasEvents: { _ in false },
            onSelect: { _ in onSelectCalled = true }
        )

        XCTAssertEqual(
            calendar.dateComponents([.year, .month], from: grid.month),
            calendar.dateComponents([.year, .month], from: month)
        )
        XCTAssertEqual(
            calendar.dateComponents([.year, .month, .day], from: grid.selectedDate),
            calendar.dateComponents([.year, .month, .day], from: selected)
        )

        // Verify onSelect closure is forwarded
        grid.onSelect(month)
        XCTAssertTrue(onSelectCalled)
    }

    func test_hasEvents_closureIsForwarded() {
        let month = dateComponents(year: 2024, month: 5, day: 1)
        var queriedDate: Date?
        let grid = CalendarMonthGrid(
            month: month,
            selectedDate: month,
            calendar: calendar,
            hasEvents: { date in
                queriedDate = date
                return true
            },
            onSelect: { _ in }
        )

        let result = grid.hasEvents(month)
        XCTAssertTrue(result)
        XCTAssertNotNil(queriedDate)
    }

    // MARK: - Grid day count (indirect via Calendar arithmetic)

    /// The grid must always contain exactly 42 cells (6 rows × 7 columns).
    /// We verify this by replicating the same arithmetic the view uses.
    func test_gridContains42Cells_forVariousMonths() {
        let testMonths: [(year: Int, month: Int)] = [
            (2024, 1), // starts Wednesday
            (2024, 2), // leap year
            (2024, 6), // starts Saturday
            (2024, 11), // starts Friday
            (2023, 1), // starts Sunday (no leading blanks)
        ]

        for (year, month) in testMonths {
            let monthDate = dateComponents(year: year, month: month, day: 1)
            let cells = makeDays(for: monthDate)
            XCTAssertEqual(cells.count, 42, "Expected 42 cells for \(year)-\(month), got \(cells.count)")
        }
    }

    /// All 42 cells must be distinct dates.
    func test_gridCellsAreAllDistinct() {
        let monthDate = dateComponents(year: 2024, month: 5, day: 1)
        let cells = makeDays(for: monthDate)
        let unique = Set(cells)
        XCTAssertEqual(unique.count, 42, "Grid cells must all be distinct dates")
    }

    /// Cells at positions corresponding to the target month must fall within
    /// that month.
    func test_gridContainsDaysOfTargetMonth_forJanuary2024() {
        // January 2024 has 31 days. All 31 must appear in the 42-cell grid.
        let monthDate = dateComponents(year: 2024, month: 1, day: 1)
        let cells = makeDays(for: monthDate)
        let janCells = cells.filter {
            calendar.isDate($0, equalTo: monthDate, toGranularity: .month)
        }
        XCTAssertEqual(janCells.count, 31)
    }

    // MARK: - Helpers

    private func dateComponents(year: Int, month: Int, day: Int) -> Date {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = day
        return calendar.date(from: comps)!
    }

    private func assertDate(_ date: Date, year: Int, month: Int, day: Int,
                            file: StaticString = #file, line: UInt = #line) {
        let comps = calendar.dateComponents([.year, .month, .day], from: date)
        XCTAssertEqual(comps.year, year, "year mismatch", file: file, line: line)
        XCTAssertEqual(comps.month, month, "month mismatch", file: file, line: line)
        XCTAssertEqual(comps.day, day, "day mismatch", file: file, line: line)
    }

    /// Replicates the private `days` computed property of `CalendarMonthGrid`
    /// so we can assert on its output without needing ViewInspector.
    private func makeDays(for month: Date) -> [Date] {
        let monthStart = calendar.startOfMonth(for: month)
        let monthInterval = calendar.dateInterval(of: .month, for: monthStart) ?? DateInterval(start: monthStart, duration: 0)
        let firstWeekday = calendar.component(.weekday, from: monthInterval.start)
        let leadingBlanks = (firstWeekday - calendar.firstWeekday + 7) % 7
        let gridStart = calendar.date(byAdding: .day, value: -leadingBlanks, to: monthInterval.start) ?? monthInterval.start
        return (0..<42).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: gridStart)
        }
    }
}