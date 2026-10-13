# EDU MVP v0.3

Grade 6–8 Math teacher copilot.

## v0.3 changes
- Ask EDU composer now supports long multi-line prompts and IME composition (including Chinese input).
- Enter sends; Shift+Enter inserts a new line.
- Real editable PowerPoint (.pptx) generation from live class context.
- PPT deck uses class mastery, topic, standard, lesson length, and pasted teacher-material notes.
- AI-generated deck falls back to a safe demo deck if no API key is configured.

## Run
```bash
npm install
cp .env.example .env.local
# Add your OPENAI_API_KEY to .env.local
npm run dev
```
Open http://localhost:3000

Never commit or share `.env.local`.


## V0.5
- Teacher-editable lesson architecture and pacing
- School Knowledge moved into Lesson Studio
- Per-file PPT influence controls
- Uploaded files are attached to the OpenAI Responses request for PPT generation
- Teacher notes are treated as generation instructions and combined with pacing, mastery and file roles

## V1.9 School Accounts & Roles
Teacher access now uses Supabase Auth. New teachers join with an invite code created by School Admin. Run the Admin package's `EDU_V1_9_ACCOUNTS_ROLES.sql` once in the shared Supabase project before testing account creation.
