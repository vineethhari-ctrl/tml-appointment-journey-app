/* Shared records for all business analysts (optional).
   Leave url empty and the demo keeps each person's work in their own browser only.
   To share the records, create a free Firebase Realtime Database and paste its address here (steps: docs/PROJECT_BRIEF.md, "Shared records"):
     url:  "https://YOUR-PROJECT-default-rtdb.firebaseio.com"
   room is the name of the shared space; everyone who opens the page with the same url and room sees the same follow-ups, comments, decisions,
   claim and helpdesk changes and watchlist. Open the page with ?room=NAME to use another room (for example a private one for a test).
   SANDBOX DATA ONLY: anyone who knows the database address can read and write it. */
window.TMLJ_SYNC = { url: "", room: "tmlj-demo", pushSeconds: 2, pullSeconds: 5 };
