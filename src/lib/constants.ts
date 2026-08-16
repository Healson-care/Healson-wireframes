// sessionStorage key used to send an unregistered lead back to the page
// they were on (e.g. the booking flow) once they finish /client/login.
export const POST_REGISTER_REDIRECT_KEY = "healson_post_register_redirect";

// sessionStorage key holding the provider id a visitor had clicked on in
// /book right before getting blocked by the auth-required popup — lets
// /book resume straight at that provider's slot picker after they finish
// registering/logging in, instead of restarting from the provider list.
export const BOOK_RESUME_PROVIDER_KEY = "healson_book_resume_provider";

// sessionStorage key holding the JSON-serialized selected service item
// (name/service_type/duration) alongside BOOK_RESUME_PROVIDER_KEY, so the
// resumed flow lands on the right consultation type instead of losing which
// service the visitor had chosen before the doctor they picked required login.
export const BOOK_RESUME_ITEM_KEY = "healson_book_resume_item";

// Maps a clinic's city to its broader geographic region, so provider search
// can filter by region instead of by individual city/branch.
export const REGION_BY_CITY: Record<string, string> = {
  "תל אביב": "מרכז",
  "רמת גן": "מרכז",
  "גבעתיים": "מרכז",
  "פתח תקווה": "מרכז",
  "הרצליה": "מרכז",
  "רעננה": "מרכז",
  "כפר סבא": "מרכז",
  "בני ברק": "מרכז",
  "חולון": "מרכז",
  "בת ים": "מרכז",
  "ראשון לציון": "מרכז",
  "רחובות": "מרכז",
  "נס ציונה": "מרכז",
  "חיפה": "צפון",
  "קריות": "צפון",
  "נהריה": "צפון",
  "עכו": "צפון",
  "טבריה": "צפון",
  "נצרת": "צפון",
  "כרמיאל": "צפון",
  "צפת": "צפון",
  "ירושלים": "ירושלים והסביבה",
  "בית שמש": "ירושלים והסביבה",
  "מעלה אדומים": "ירושלים והסביבה",
  "באר שבע": "דרום",
  "אשדוד": "דרום",
  "אשקלון": "דרום",
  "אילת": "דרום",
};

export const OTHER_REGION_LABEL = "אחר";

export function getRegionForCity(city: string): string {
  return REGION_BY_CITY[city] ?? OTHER_REGION_LABEL;
}

// Address is picked, not typed — a closed list keeps it demo-friendly (no
// free text to validate/normalize). This app makes no external/network
// calls (see utils.ts), so there's no real geo/address database behind it —
// a real deployment would connect to one (e.g. the Israeli postal/city
// registry) instead of this fixed list; a UI note below the fields says so.
// Streets are keyed by city, same pattern as K_LEVELS_BY_KUPAH, so picking a
// city narrows the street list instead of showing every street at once;
// cities without their own curated streets fall back to DEFAULT_STREETS.
// Shared between /client/login (registration) and /client/profile so both
// build the address the same way.
export const CITIES = [
  "תל אביב",
  "ירושלים",
  "חיפה",
  "ראשון לציון",
  "פתח תקווה",
  "אשדוד",
  "נתניה",
  "באר שבע",
  "בני ברק",
  "חולון",
  "רמת גן",
  "בת ים",
  "אשקלון",
  "רחובות",
  "הרצליה",
  "כפר סבא",
  "מודיעין",
  "רעננה",
  "בית שמש",
  "נצרת",
  "לוד",
  "רמלה",
  "רמת השרון",
  "גבעתיים",
  "הוד השרון",
  "נהריה",
  "קריית אתא",
  "קריית גת",
  "קריית ביאליק",
  "קריית שמונה",
  "אילת",
  "טבריה",
  "עכו",
  "דימונה",
];
// Street names only — the house number is its own field (see formatAddress
// below), so numbers must not be baked into these options.
export const STREETS_BY_CITY: Record<string, string[]> = {
  "תל אביב": ["הרצל", "אבן גבירול", "דיזנגוף"],
  "ירושלים": ["יפו", "בן יהודה", "עמק רפאים"],
  "חיפה": ["הרצל", "הנביאים", "מוריה"],
  "ראשון לציון": ["רוטשילד", "הרצל"],
  "פתח תקווה": ["חובבי ציון", "רוטשילד"],
  "רמת גן": ["ביאליק", "ז'בוטינסקי"],
  "הרצליה": ["סוקולוב", "בן גוריון"],
  "באר שבע": ["רגר", "הפלמח"],
};
export const DEFAULT_STREETS = ["הרחוב הראשי", "שדרות העצמאות"];

/** Patient.address is a single string in the form "רחוב מספר, עיר".
 * formatAddress/parseAddress are the only places that know that shape, so
 * registration and the profile compose and re-read it identically. */
export function formatAddress(parts: { street: string; houseNumber: string; city: string }): string {
  const line = [parts.street.trim(), parts.houseNumber.trim()].filter(Boolean).join(" ");
  return [line, parts.city.trim()].filter(Boolean).join(", ");
}

/** Best-effort inverse of formatAddress, used to prefill the profile's
 * pickers. Falls back to blank fields for anything that doesn't match a
 * known city (e.g. an address entered before this field existed). */
export function parseAddress(address: string): { city: string; street: string; houseNumber: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  let city = "";
  let line = "";
  if (parts.length >= 2) {
    line = parts[0];
    city = CITIES.includes(parts[1]) ? parts[1] : "";
  } else if (parts.length === 1) {
    if (CITIES.includes(parts[0])) city = parts[0];
    else line = parts[0];
  }
  // The street list carries no numbers, so a trailing number on this line
  // can only have come from the house-number field.
  const match = line.match(/^(.*?)\s+(\d+\S*)$/);
  return match
    ? { city, street: match[1], houseNumber: match[2] }
    : { city, street: line, houseNumber: "" };
}
