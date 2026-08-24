CAMPUSPULSE FRONTEND

Files:
- index.html              Login
- student-dashboard.html  Student dashboard
- report.html             Complaint submission
- issue.html              Issue details / lifecycle
- admin.html              Admin dashboard
- map.html                Severity map (detailed 23-room floorplan, click a
                           room to open a sidebar of its grouped issues; each
                           room's dot reflects only its single worst issue)
- css/style.css           Complete styling
- js/api.js               Backend API wrapper
- js/auth.js              Login logic
- js/auth-guard.js        Route guard / logout
- js/student.js           Student dashboard logic
- js/report.js            Complaint submission logic
- js/issue.js             Issue details logic
- js/admin.js             Admin dashboard logic
- js/map.js               Severity map logic (Leaflet + floorplan image,
                           room polygons, worst-severity dots, room sidebar)
- js/locations.js         Shared campus room list (name + pixel rect,
                           x/y = rect center used for the dot)
- js/floorplan-image.js   Base64 floorplan image used by the map

Admin issue page (issue.html, admin only): opening an issue also loads
every individual report grouped under it (js/issue.js -> loadIssueReports),
showing each student's own comment via GET /api/issues/:id/reports. Reports
filed before this feature existed only have a duplicateCount number, no
comment text on file for those older ones.

Backend expected:
http://localhost:5000/api

Open index.html through a local web server, not file://, for reliable fetch behavior.

Quick local server:
Python:
  python3 -m http.server 5500

Then open:
  http://localhost:5500/

Use with the Express + SQLite backend in ../backend (see ../BACKEND_GUIDE.md).
