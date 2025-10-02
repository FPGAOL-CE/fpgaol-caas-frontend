const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080; // Use the PORT environment variable or port 8080 by default.

// Serve the static Vue.js build files from the 'dist' directory.
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all other routes by serving the 'index.html' file.
// But only if the requested file doesn't exist (to allow static files to be served)
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'dist', req.path);
  
  // If the file exists, let express.static handle it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    // Otherwise, serve the Vue app
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
