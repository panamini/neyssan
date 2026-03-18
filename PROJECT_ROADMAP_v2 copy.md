graph TD
    subgraph Frontend (React Components)
        App[App.tsx]
        Login[Clerk Sign-In]
        Editor[ProfileEditorUnified.tsx]
        Modal[ProfileReviewModal.tsx]
    end

    subgraph Backend (Convex Functions)
        Mutation[upsertProfile]
        QueryLatest[getLatestCV]
        QueryCount[getProfileCount]
    end

    subgraph Database
        DB[userProfiles Table]
    end

    Login -- Clerk Auth Token --> App
    App -- checks user status --> Editor
    Editor -- calls `useQuery` --> QueryCount
    QueryCount -- returns number --> Editor
    Editor -- if count > 1 --> ReuseBtn[Show "Reuse CV" Button]
    ReuseBtn -- onClick --> Editor
    Editor -- calls `useQuery` --> QueryLatest
    QueryLatest -- returns latest CV --> Editor
    Editor -- opens --> Modal
    Modal -- calls `useMutation` --> Mutation
    Mutation -- saves data --> DB