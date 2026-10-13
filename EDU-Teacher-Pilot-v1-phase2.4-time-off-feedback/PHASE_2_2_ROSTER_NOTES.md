# EDU Teacher Pilot Phase 2.2 — Real Roster Attendance

- New classes start with 0 students.
- Removed generated Student 1..N attendance placeholders.
- Attendance reads the selected class's real roster from Supabase.
- Students who join with a Class Code appear automatically.
- Teachers can add a roster student by name and optional email.
- Existing school student emails connect immediately; otherwise the row shows Awaiting account until the student joins.
- Attendance submissions include class_id and roster/student identifiers for School Admin.

Run the full latest EDU_PILOT_V1_SETUP.sql in Supabase before testing this build.
