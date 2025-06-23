const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Handle specific routes
app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signin', 'index.html'));
});

app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events', 'index.html'));
});

// Handle the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 