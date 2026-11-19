// Where each gallery was taken, for the pins on the globe.
//
// Keys match a gallery's title exactly (the folder name in photos/, tidied up —
// "02-china spring 2026" becomes "China Spring 2026"), or the title you gave a
// gallery on the upload page. A gallery with no entry here still shows in the
// photos below the globe; it just doesn't get a pin.
//
//   name — what the pin and the trip heading say
//   date — the month you went, as "YYYY-MM" (or just "YYYY"). The photo list
//          is sorted newest first and split under month-and-year headings.
//   lat / lng — decimal degrees (right-click a spot in Google Maps to copy them)
//
// Places you've been but haven't posted photos from go in VISITED: they get a
// small, quieter pin that isn't clickable.
window.PLACES = {
  "Banff": { name: "Banff, Alberta", date: "2024-06", lat: 51.1784, lng: -115.5708 },
  // Placeholder spot near Lake Tai (Suzhou) — move it to wherever you were.
  "China Spring 2026": { name: "China", date: "2026-04", lat: 31.2989, lng: 120.5853 },
};

window.VISITED = [
  // { name: "Kyoto", lat: 35.0116, lng: 135.7681 },
];
