// my-app/types/libphonenumber-js.d.ts
// Minimal ambient declarations for libphonenumber-js used by the project.
// This avoids TypeScript errors when the library's types are not installed.
// Keep small and conservative — expand if you need more features.

declare module "libphonenumber-js" {
  // CountryCode can be represented as an ISO 3166-1 alpha-2 country code string (e.g. "US", "FR")
  export type CountryCode = string;

  // Minimal representation of the parsed phone number object used in findPhoneNumbersInText()
  export interface PhoneNumberMatch {
    number: {
      // E.164 string, e.g. "+33123456789"
      number: string;
      // optional country / nationalNumber could be present, but not required here
      [key: string]: any;
    };
    // raw string matched (optional)
    [key: string]: any;
  }

  /**
   * findPhoneNumbersInText:
   * Accepts input text and optional defaultCountry and returns an iterable/array
   * of PhoneNumberMatch objects. We declare it returning an array for simplicity.
   */
  export function findPhoneNumbersInText(text: string, defaultCountry?: CountryCode): PhoneNumberMatch[];

  // If you need more exported symbols from libphonenumber-js, extend this declaration.
}
