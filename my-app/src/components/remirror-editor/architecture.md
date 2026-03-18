# Remirror Editor Data Flow Architecture

This diagram illustrates the data flow for the editor, ensuring that `RemirrorEditor` can safely handle both `string` (HTML) and `RemirrorJSON` content types.

```mermaid
graph TD
    subgraph ProfileReviewCard
        A[State: Section[]<br>content: string] --> B{RemirrorEditor};
    end

    subgraph RemirrorEditor
        B --> C{SectionEditor};
    end

    subgraph SectionEditor
        C --> D[ensureRemirrorDoc<br>(string | RemirrorJSON) -> RemirrorJSON];
        D --> E[useRemirror<br>content: RemirrorJSON];
        E --> F[Editor Change Event];
        F --> G[pmFragmentToHtml<br>RemirrorJSON -> string];
        G --> H[onSectionChange(htmlString)];
    end

    H --> I(Update State in ProfileReviewCard);
    I --> A;

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#ccf,stroke:#333,stroke-width:2px
    style E fill:#ccf,stroke:#333,stroke-width:2px
    style I fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#9f9,stroke:#333,stroke-width:2px
    style G fill:#9f9,stroke:#333,stroke-width:2px
```

### Key Data Transformations:

1.  **Input (`ProfileReviewCard` -> `RemirrorEditor`):** The parent component holds state where `Section.content` is an HTML `string`.
2.  **Coercion (`SectionEditor`):** The `ensureRemirrorDoc` utility is called at the component boundary. It takes the incoming `content` (string or JSON) and reliably converts it into a valid `RemirrorJSON` document. **This is the critical step that prevents runtime errors.**
3.  **Internal State (`useRemirror`):** The Remirror hook operates exclusively with the safe, structured `RemirrorJSON` object.
4.  **Output (`handleChange` -> `ProfileReviewCard`):** When the editor content changes, the `pmFragmentToHtml` utility converts the `RemirrorJSON` state back into an HTML `string`. This ensures the parent component receives the data in the format it expects, maintaining backward compatibility with the existing database schema.

This architecture isolates the type complexity, making the system robust and easier to maintain.

Do you approve this plan and architecture? Once you confirm, I will request to switch to `Code` mode to implement the necessary changes.