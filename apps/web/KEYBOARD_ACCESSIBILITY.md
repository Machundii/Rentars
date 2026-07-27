# Keyboard Accessibility — Audit & Status

## Primary Flow Coverage

| Step | Component | Status | Notes |
|------|-----------|--------|-------|
| Search input | `SearchAutocomplete`, `SearchBar` | ✅ Fixed | Arrow navigation, Enter to select, Escape to close, ARIA combobox/listbox/option roles |
| Filters | `FilterSidebar` | ✅ Fixed | `aria-expanded`, `aria-controls`, `aria-pressed` on toggle buttons; `htmlFor` on all inputs |
| Property card | `PropertyCard` | ✅ Fixed | Entire card surface is a focusable `<Link>`; wishlist button has `aria-pressed` + `aria-label` |
| Property detail | `PropertyDetail` | ✅ Inherited | Uses semantic HTML; standard links and buttons |
| Booking form | `BookingForm` | ✅ Fixed | `focus-visible` rings on all inputs; `aria-invalid` + `aria-describedby` on error states |
| Submit button | `BookingForm` | ✅ Fixed | Themed focus ring; disabled state communicated via `disabled` attribute |
| Skip navigation | `layout.tsx` | ✅ Added | `<a href="#main-content">` skip link; `.skip-nav` utility class in `globals.css` |

## Known Remaining Gaps

### Map controls (Leaflet)
- **Gap**: Leaflet map itself (`PropertyMap`) renders its tile layer, zoom controls, and marker
  cluster groups in a `<div>` canvas; individual price markers (`PriceMarker`) are Leaflet
  `DivIcon` elements injected as raw HTML and are not natively keyboard-reachable.
- **Impact**: Users who rely entirely on keyboard cannot interact with individual map markers
  or trigger the popup for a property.
- **Mitigation in place**: The Map view is toggled on/off; the default view is the keyboard-
  accessible List view. The "Near Me" and List/Map toggle buttons are proper `<button>` elements
  with visible focus styles.
- **Recommended fix**: Replace `DivIcon` markers with `react-leaflet`'s `Marker` + a custom
  keyboard handler layer, or provide an equivalent list of results below the map that mirrors
  the markers.

### Date picker / Calendar widget
- `BookingForm` uses native `<input type="date">` which inherits the browser's built-in
  keyboard handling (generally good). `AvailabilityCalendar` uses `react-day-picker`; its
  keyboard support depends on the library version and theme. Verify arrow-key navigation
  works across browsers.

### Wallet connection modal (`WalletConnectionModal`)
- Not audited in this pass. Should be checked for focus trap and Escape-to-close behaviour.

### Filter sidebar — range sliders
- Native `<input type="range">` supports arrow-key increment/decrement by default, but the
  step size (1 USDC at a time) may be impractical for large ranges. Consider adding explicit
  step values or a numeric input companion.

## Testing
Run the keyboard-accessibility test suite:
```bash
cd apps/web
yarn test src/tests/keyboard-accessibility.test.tsx
```
