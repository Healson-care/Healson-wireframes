// sessionStorage key used to send an unregistered lead back to the page
// they were on (e.g. the booking flow) once they finish /register.
export const POST_REGISTER_REDIRECT_KEY = "healson_post_register_redirect";

// sessionStorage key holding the provider id a visitor had clicked on in
// /book right before getting blocked by the auth-required popup — lets
// /book resume straight at that provider's slot picker after they finish
// registering/logging in, instead of restarting from the provider list.
export const BOOK_RESUME_PROVIDER_KEY = "healson_book_resume_provider";

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
export const STREETS_BY_CITY: Record<string, string[]> = {
  "תל אביב": ["הרצל 12", "אבן גבירול 50", "דיזנגוף 100"],
  "ירושלים": ["יפו 22", "בן יהודה 8", "עמק רפאים 15"],
  "חיפה": ["הרצל 8", "הנביאים 30", "מוריה 45"],
  "ראשון לציון": ["רוטשילד 20", "הרצל 5"],
  "פתח תקווה": ["חובבי ציון 10", "רוטשילד 60"],
  "רמת גן": ["ביאליק 12", "ז'בוטינסקי 40"],
  "הרצליה": ["סוקולוב 25", "בן גוריון 90"],
  "באר שבע": ["רגר 15", "הפלמח 33"],
};
export const DEFAULT_STREETS = ["הרחוב הראשי 1", "שדרות העצמאות 10"];
