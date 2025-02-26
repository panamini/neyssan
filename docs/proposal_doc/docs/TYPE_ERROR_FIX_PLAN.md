# Type Error Resolution Plan

This document outlines the steps to resolve the TypeScript errors encountered during the proposal generator integration.

## Current Errors

The following errors need to be addressed:

-   Several `TS6133` errors: "'...' is declared but its value is never read." - Unused imports/variables.
-   `src/components/ProposalInputForm.tsx:40:15`: `Type instantiation is excessively deep and possibly infinite.` - Related to `zodResolver` and `formSchema`.
-   Several `TS7053` and `TS2538` errors in `src/services/tone-service.ts` related to `ToneMap`.

## Steps

1.  **Address `jsdom` error:** (Already done)

2.  **Define Missing Types:** (Mostly done - added index signature to `JobCaptureRequest`)

3.  **Fix Import Paths:**
    -   Change import paths from `''types'` to `'../types'` in:
        -   `src/services/proposal-handler.ts` (Done)
        -   `src/services/scraping-service.ts` (Done)
        -   `src/services/tone-service.ts` (Already correct)
        -   `src/services/platforms/upwork.ts`
    - Change import path of `UserProfileDoc` in `src/services/proposal-handler.ts` to `'../../convex/types/schema'` and alias as `UserProfile`. (Done)

4.  **Fix Type Errors in `src/services/proposal-handler.ts`:**
    - Add an index signature to the `JobCaptureRequest` interface. (Done)
    -   Access nested properties of `userProfile` correctly (e.g., `userProfile.preferences.tonePreference`).

5.  **Fix Type Errors in `src/services/tone-service.ts`:**
    -   Import and use `ToneMapType` for the `ToneMap` constant. (Already done)
    -   Remove `as const` from `ToneMap`. (Already done)

6.  **Fix Type Errors in `src/services/scraping-service.ts`:**
    -   Change `PLATFORMS.upwork` to `'upwork'` in the `switch` statement. (Done)

7.  **Address implicit any type error:**
    - Add explicit type `any` to the error parameter in the catch block of `src/services/scraping-service.ts:92`. (Done)

8.  **Clean Up Unused Imports/Variables:**
    - Address all remaining `TS6133` errors by removing or commenting out unused imports and variables. This will be done *before* addressing the `ProposalInputForm` error.

9.  **Address `ProposalInputForm` error:**
    -   This error is likely due to a complex type inference issue with Zod and React Hook Form. We will need to examine `src/components/ProposalInputForm.tsx` and potentially `src/components/ProposalDisplay.tsx` and the related form schema to resolve this. This will be the *last* step.

10. **Run `npx convex dev` and `npm run build` after each step to verify the fix.**