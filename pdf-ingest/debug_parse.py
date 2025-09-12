import json
from app import normalize_from_text

SAMPLE = """ROBERT COOPER
SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442
DETAILS
1515 Pacific Ave
Los Angeles, CA 90291
United States
3868683442
email@email.com
Place of birth
San Antonio
Driving license
Full
LINKS
LinkedIn
Pinterest
PROFILE
Safety conscious, attentive Security Guard with eight years experience in protecting and
guarding VIP individuals in the military and defense sectors. Proficient at observing
surroundings and immediate settings for possible threats of nonhuman and human nature.
Presently finishing a bachelor’s in criminal justice and qualified as a CPO (Certified
Protection Guard).
EMPLOYMENT HISTORY
Security Guard at ADT Security, Port Washington
January 2021 — April 2022
Responsible for completing reports by recording information, observations, occurrences,
and surveillance activities, including interviewing of witnesses and acquiring signatures.
• Maintaining environments by monitoring the grounds and equipment controls.
• Logging into security headquarters on the hour during the day and every 2 hours
with the night shift, notifying control of all in order statuses.
• Utilizing armed force when necessary, to protect company belongings, visitors,
employees, and clients when needed.
• Apprehending suspects in the event of security breaches and detaining them until
the police arrive on the scene.
Resume Templates
Build this template
SKILLS
Investigation skills
Safety compliance
Criminal justice knowledge
Restraining devices
Martial arts/Physical combat
training
HOBBIES
Running, Mtb, Enduro
LANGUAGES
English
Spanish
Italian
Security Guard at Copwatch, Jogbani
January 2020 — April 2022
Primary purpose is to scan area of grounds for objects/ items that seem out of place and
notifying Center management of bags or packages that are unattended.
• Inspecting restrooms after closing time for vagrants/ unauthorized personnel.
• Monitoring selected areas via CCTV app on smart devices.
• Ensure flawless equipment operation by finishing preventive maintenance
necessities, reading the manufacturer's instructions, troubleshooting
malfunctions, organizing for repairs if needed, and assessing new equipment and
techniques
EDUCATION
Certified Protection Guard Program (CPOP), International Foundation for Protection
Guards, Alexandria
January 2021 — April 2022
Security Guard Certificate Program (SOCP), ASIS International, North Naples
April 2022 — April 2022
• Course Curriculum: Law Enforcement Ethics, Foundations in Criminal Law, Report
Writing, Criminal Profiling, Interviewing Techniques, Crisis Intervention.
S.A.F.E. Approach Level II Training, Hawaii Western College
January 2015 — November 2019
ACHIEVEMENTS
• Decreased theft of hotel items like linen, towels, décor pieces, and cutlery by 73%
by improving vigilance strategies, particularly for guests leaving the hotel.
• Enhancing detection/monitoring procedures by having 15 360 degrees CCTV
cameras installed at the back of shopping aisles and in storerooms, which cut
product stock theft by 93%.
• Introduced inventive loss prevention techniques by installing an X-ray scanning
system at every entrance and exit in the building, which reduced theft by 28%.
• Improved access control, which reduced unauthorized entry and solicitation by
26% using an announcement notification app, where visitors may be admitted/
declined entry straight from the employee’s smart device.
"""

profile = normalize_from_text(SAMPLE, filename="pasted_resume.txt")
print(json.dumps(profile.dict(), indent=2, ensure_ascii=False))
