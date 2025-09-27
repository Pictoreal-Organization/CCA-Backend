const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');


dotenv.config();
require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());


const meetingRoutes = require('./routes/meetings.route');
const taskRoutes = require('./routes/tasks.route');
const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
const adminRoutes = require('./routes/admin.route');

app.use(express.json());
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/auth/', authRoutes);
app.use('/api/user/', userRoutes);
app.use('/api/admin/', adminRoutes);

app.get('/', (req, res) => {
  console.log("Works");
  res.send('It works!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});