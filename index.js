const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');


dotenv.config();
require('./db');

require('./cron/meeting.cron');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());

// Morgan middleware (logs every request)
app.use(morgan("dev"));
app.use(express.json());

const meetingRoutes = require('./routes/meetings.route');
const taskRoutes = require('./routes/tasks.route');
const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
const adminRoutes = require('./routes/admin.route');
const attendanceRoutes = require('./routes/attendance.route');
const teamRoutes = require('./routes/team.route');
const tagRoutes = require('./routes/tags.route');

app.use('/api/meetings/', meetingRoutes);
app.use('/api/tasks/', taskRoutes);
app.use('/api/auth/', authRoutes);
app.use('/api/user/', userRoutes);
app.use('/api/admin/', adminRoutes);
app.use('/api/attendance/', attendanceRoutes);
app.use('/api/teams/', teamRoutes);
app.use('/api/tag/', tagRoutes);

app.get('/', (req, res) => {
  console.log("Works");
  res.send('It works!');
});

const axios = require("axios");

app.get('/dummy', (req, res) => {
    res.status(200).json({ message: 'OK' });
});

const BACKEND_URL = "https://cca-backend.onrender.com/dummy";

function keepAlive() {
  console.log("Pinging services...");
  axios.get(BACKEND_URL)
    .then(res => console.log("Backend pinged:", res.data))
    .catch(err => console.log("Backend ping failed:", err.message));
}

setInterval(keepAlive, 10 * 60 * 1000)
keepAlive();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});