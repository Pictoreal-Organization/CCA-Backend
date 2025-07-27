const express = require('express');
const cors = require('cors');

require('dotenv').config();
require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());


const meetingRoutes = require('./routes/meetings.route');
const taskRoutes = require('./routes/tasks.route');

app.use(express.json());
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
// app.use('/', taskRoutes);

app.get('/', (req, res) => {
  console.log("Works");
  res.send('It works!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});