const express = require('express');
require('./db');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 5000;
// const meetingRoutes = require('./routes/meetings');
// const taskRoutes = require('./routes/tasks');

const meetingRoutes = require('./routes/meetings.route');
const taskRoutes = require('./routes/tasks.route');



app.use(express.json());
app.use('/meet', meetingRoutes);
app.use('/task', taskRoutes);

app.get('/', (req, res) => {
  console.log("Works");
  res.send('It works!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});