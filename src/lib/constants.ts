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
