# Running the React Frontend

## One-time setup (after installing Node.js)

```bash
cd /Users/annewhite/Desktop/lessons/frontend
npm install
```

## Every time you work on the app — open TWO terminal tabs:

### Tab 1: Django API
```bash
source /Users/annewhite/.local/share/virtualenvs/storefront-zd6irFOj/bin/activate
cd /Users/annewhite/Desktop/lessons
python manage.py runserver
```

### Tab 2: React dev server
```bash
cd /Users/annewhite/Desktop/lessons/frontend
npm run dev
```

Then open: http://localhost:5173

The React app proxies all `/api/` and `/media/` requests to Django on port 8000.

## What's built (Phase 1)
- Login / Register (teacher + student)
- Lesson library with search + filters
- Activity detail view
- Teacher dashboard (classrooms + activities + modules)
- Classroom detail (manage students, assigned activities + modules)
- Module list, builder, and detail
- Module student view (with sequential locking)
- Student dashboard (classrooms with activities + modules)
- Admin dashboard (approve teachers + activities)
- Join classroom

## What's built (Phase 2)
- Activity builder — create/edit with sections, prompt types (student/instruction/teacher note), response types (text/video/data table), resource links, PDF upload
- Student activity view — section-by-section navigation, text responses, live video recording, interactive data tables, progress bar
- Teacher response review — accordion per student, text/video/table display, inline feedback
