# Phase 2.3 Attendance Sync

Teacher Attendance now gives explicit submission feedback and writes the real class roster snapshot to `student_attendance` for School Admin.

## Teacher behavior
- Submit button shows `Submitting…` while saving.
- Success shows `✓ Attendance submitted`, a confirmation panel, and submission time.
- Changing a student's status after a successful submission changes the action to `Save changes`.
- Failed submissions are visibly reported and are not presented as successful.
- Local attendance history is only updated after the Supabase submission succeeds.

## Database
Run `EDU_PHASE_2_3_ATTENDANCE_SYNC.sql` once in the same Supabase project as Teacher and School Admin. It guarantees the columns School Admin needs: class/date, real roster JSON, counts, and submitted timestamp.
