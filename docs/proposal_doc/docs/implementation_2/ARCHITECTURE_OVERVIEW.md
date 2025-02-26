# ARCHITECTURE OVERVIEW

This document provides a comprehensive overview of the Job Proposal Generator application's architecture. It details the system components, their roles, interactions, and the overall data flow.

## 1. System Components

The application is composed of the following key components:

*   **Chrome Extension:**  The user-facing interface for capturing job details directly from job platforms in the browser.
*   **MCP Scraping Service:** A dedicated Model Context Protocol (MCP) server responsible for scraping job description content from various online platforms.
*   **Proposal Generator (MCP Server):** Another MCP server that utilizes LangChain and OpenAI to generate job proposals based on scraped job details and user preferences.
*   **Convex Data Layer:** A real-time backend database (Convex) that stores proposals, user profiles, and application state. It also handles authentication via Clerk.
*   **React UI Components:** Frontend components built with React, Shadcn UI, and TailwindCSS for user interaction, displaying proposals, and managing user settings.

```mermaid
graph LR
    A[Chrome Extension] --> B{Job Capture}
    B --> C[Platform-Specific Parser]
    C --> D[MCP Scraping Service]
    D --> E[Proposal Generator (MCP Server)]
    E --> F[Convex Data Layer]
    F --> G[User Profile]
    G --> E
    F --> H[Save/Send Actions]
    H --> I[Employer Channels]
    J[React UI Components] -- API Calls --> F
    style E fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#f9f,stroke:#333,stroke-width:2px
    subgraph MCP Servers
    D
    E
    end
```

## 2. MCP Servers: Roles and Locations

The application leverages two distinct MCP servers to modularize functionalities:

*   **MCP Scraping Service (`/mcp/scraping-server`):**
    *   **Role:**  Exclusively responsible for web scraping. It receives job capture requests from the Chrome Extension, parses platform-specific job page structures, and extracts relevant job details (title, description, etc.).
    *   **Location:**  Resides in the `/mcp/scraping-server` directory.
    *   **Launch:**  MCP servers are designed to be launched and managed by the Model Context Protocol framework.  They are configured in the `cline_mcp_settings.json` (or Claude Desktop app config) to be automatically started when the application or Claude is initiated. The configuration specifies the command to run the server (e.g., `node`) and the path to the server's entry point (`build/index.js` after building the server). Environment variables required by the server (like API keys for scraping services, if any) are also configured in this settings file.

*   **Proposal Generator (MCP Server) (`/mcp/proposal-server`):**
    *   **Role:**  Handles the core logic of generating job proposals using LangChain and OpenAI. It receives scraped job content from the Scraping Service, retrieves user tone preferences from the Convex Data Layer, and generates tailored proposals.
    *   **Location:** Resides in the `/mcp/proposal-server` directory.
    *   **Launch:**  Similar to the Scraping Service, the Proposal Generator MCP server is launched and managed by the MCP framework based on its configuration in `cline_mcp_settings.json`.  It will require the `OPENAI_API_KEY` environment variable to be configured in its MCP settings to access the OpenAI API.

**MCP Server Launch Process Summary:**

1.  **Configuration:** MCP server configurations (command, arguments, environment variables, etc.) are defined in `cline_mcp_settings.json` or the Claude Desktop app configuration.
2.  **Automatic Startup:** When the application (or Claude) starts, the MCP framework reads these configurations and automatically launches each configured MCP server as a separate process.
3.  **Communication:**  The application (Chrome Extension, React UI, Convex functions) interacts with the MCP servers using the MCP protocol via `use_mcp_tool` and `access_mcp_resource` tools.

## 3. Data Flow and Interactions

The data flow within the application follows these steps:

1.  **Job Capture (Chrome Extension):**
    *   User initiates job capture from a job platform using the Chrome Extension.
    *   The extension sends a "job capture request" containing the URL and platform information to the application backend.

2.  **Scraping (MCP Scraping Service):**
    *   The application backend (likely a Convex function or a service within the React frontend) uses the `use_mcp_tool` to invoke a tool provided by the MCP Scraping Service (e.g., `scrape_job`).
    *   The Scraping Service receives the request, uses platform-specific parsers to scrape the job page content from the provided URL.
    *   The scraped job content is returned to the caller.

3.  **Proposal Generation (Proposal Generator MCP Server):**
    *   The application backend then uses `use_mcp_tool` again to call a tool from the Proposal Generator MCP server (e.g., `generate_proposal`).
    *   This request includes the scraped job content and potentially user preferences (tone, writing style) retrieved from the Convex Data Layer.
    *   The Proposal Generator utilizes LangChain and OpenAI (API key configured in its MCP settings) to generate a job proposal.
    *   The generated proposal content is returned.

4.  **Data Storage (Convex Data Layer):**
    *   The application backend stores the generated proposal in the Convex Data Layer, associating it with the user and relevant metadata (platform, job ID, status).

5.  **UI Interaction (React UI Components & Convex Data Layer):**
    *   React UI components fetch proposals and user data from the Convex Data Layer via Convex queries.
    *   User actions in the UI (e.g., saving, sending proposals, updating user settings) trigger Convex mutations to modify data in the Convex Data Layer.

6.  **Employer Channels (Save/Send Actions):**
    *   The application may provide functionality to send proposals to employer channels (e.g., email, platform messaging). This interaction would likely be initiated from the React UI or a Convex function, potentially using external services or APIs (though details are not fully specified in the provided docs).

## 4. Technology Stack

*   **Frontend:**
    *   **React:**  UI framework.
    *   **TypeScript:**  Language for type safety and development efficiency.
    *   **Shadcn UI, Radix UI, TailwindCSS:**  UI component library and styling.
    *   **React Query:**  Data fetching and caching (potentially for UI-Convex interactions).

*   **Backend (Convex Data Layer):**
    *   **Convex:**  Real-time serverless database and backend function platform.
    *   **Clerk:**  Authentication and user management integrated with Convex.
    *   **TypeScript:** Language for Convex functions and schema definitions.

*   **MCP Servers:**
    *   **Node.js:** Runtime environment for MCP servers.
    *   **TypeScript:** Language for MCP server implementation.
    *   **MCP SDK:**  Model Context Protocol SDK for building MCP servers.
    *   **LangChain:**  Framework for language model integration (in Proposal Generator).
    *   **OpenAI API:**  Large language model API for proposal generation (used by Proposal Generator).
    *   **Axios/Fetch:**  HTTP client for API requests (likely used in Scraping Service and Proposal Generator).

This architecture emphasizes modularity, separation of concerns (scraping, proposal generation, data management, UI), and leverages MCP servers to encapsulate external service integrations (scraping, LLM). Convex provides a real-time data layer and backend function environment, while React and UI libraries enable a modern user interface.
