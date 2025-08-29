import re

# Input and output files
input_log = "pdf-ingest/diagnostics/pdf_ingest_debug.log"
output_log = "pdf-ingest/diagnostics/pdf_ingest_debug_excerpt.log"

# Regex patterns for lines we care about
patterns = [
    r"ProgrammingError:.*",             # SQL errors
    r"ValueError:.*",                   # UUID/placeholder parsing errors
    r"==== CONFIRM SAVE.*",             # Confirm-save API calls
    r"==== ENQUEUE LLM-REFINE.*",      # LLM enqueue calls
    r"==== WORKER LOGS.*",              # Worker logs section
    r"INFO:.*placeholder.*",            # Placeholder creation info
    r"ERROR:.*",                        # Any ERROR logs
]

compiled_patterns = [re.compile(p) for p in patterns]

with open(input_log, "r") as infile, open(output_log, "w") as outfile:
    for line in infile:
        if any(p.search(line) for p in compiled_patterns):
            outfile.write(line)

print(f"Extracted relevant log lines to {output_log}")
