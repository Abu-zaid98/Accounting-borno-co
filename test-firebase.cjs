const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const app = initializeApp({
  projectId: "accounting-system-6e376",
  databaseURL: "https://accounting-system-6e376-default-rtdb.firebaseio.com"
});

const rtdb = getDatabase(app);

get(ref(rtdb, 'users'))
  .then(snap => {
    console.log("Success! Data:");
    console.log(snap.val());
    process.exit(0);
  })
  .catch(err => {
    console.error("Firebase Error:", err.message);
    process.exit(1);
  });
