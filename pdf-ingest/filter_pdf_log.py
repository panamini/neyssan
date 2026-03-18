import os
from datetime import datetime

# Input & output paths
input_log = "diagnostics/pdf_ingest_debug.log"
output_dir = "diagnostics/chunks"
os.makedirs(output_dir, exist_ok=True)

# Keywords to filter relevant lines
keywords = ["CONFIRM SAVE", "LLM", "PROFILE", "ERROR", "Exception"]

# Chunk size (lines per chunk)
chunk_size = 500

# Read the log and filter lines
filtered_lines = []
with open(input_log, "r") as f_in:
    for line in f_in:
        if any(k.lower() in line.lower() for k in keywords):
            filtered_lines.append(line)

# Write filtered lines in chunks
total_chunks = (len(filtered_lines) + chunk_size - 1) // chunk_size
for i in range(total_chunks):
    chunk_lines = filtered_lines[i * chunk_size : (i + 1) * chunk_size]
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    chunk_file = os.path.join(output_dir, f"pdf_ingest_chunk_{i+1}_{timestamp}.log")
    with open(chunk_file, "w") as f_out:
        f_out.writelines(chunk_lines)
    print(f"Saved chunk {i+1}/{total_chunks} to {chunk_file}")

print(f"\nTotal chunks created: {total_chunks}")
